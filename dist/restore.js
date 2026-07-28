import * as core from '@actions/core';
import { applyTrustTokenPolicy, applyCliPlanEnv, applyMiseSetup, actionErrorMessage, buildActionTrustState, buildGenericVerificationSpecs, buildFlagArgs, buildPlan, ensureBoringCache, ensureXcodePlugin, execBoringCache, getInputs, loadDiagnosticsConfig, parseEntries, prepareCandidateReceiptFile, publishCandidateOutputs, readLogTail, resolveCliCapabilityVersion, resolveTrustPolicy, resolveVerificationTags, restorePhaseSummary, runDiagnosticsGroup, serializeTools, verifyVerificationSpecs, writeActionEvidence, writeActionFailureEvidence, } from './utils';
import { DockerBuildFailure, runModeRestore } from './mode-handlers';
const MAX_RESTORE_DIAGNOSTIC_CHARS = 8_000;
const ARCHIVE_OVERLAP_MODES = new Set([
    'bazel',
    'ccache',
    'go',
    'gradle',
    'maven',
    'nx',
    'sccache',
    'turbo',
    'xcode',
]);
function modeRestoreCanOverlapArchive(mode) {
    return ARCHIVE_OVERLAP_MODES.has(mode);
}
function appendRestoreDiagnostic(current, data) {
    return `${current}${data.toString()}`.slice(-MAX_RESTORE_DIAGNOSTIC_CHARS);
}
function restoreFailureDetail(stdout, stderr, entries) {
    const cliDetail = stderr.trim() || stdout.trim();
    return actionErrorMessage(cliDetail || `Cache restore failed for ${entries.join(', ')}`);
}
function buildCliSetupOptions(inputs, cliPlatform) {
    return {
        version: inputs.cliVersion,
        platform: cliPlatform,
        ...(inputs.trustedWorkspaceSigningKeyFingerprint
            ? { trustedWorkspaceSigningKeyFingerprint: inputs.trustedWorkspaceSigningKeyFingerprint }
            : {}),
    };
}
async function emitRestoreDiagnostics(plan, inputs, resolvedTags, overallHit, trustState) {
    const diagnostics = loadDiagnosticsConfig(inputs);
    await runDiagnosticsGroup(diagnostics, 'BoringCache Diagnostics', async () => {
        core.info(`workspace: ${plan.workspace}`);
        core.info(`setup: ${plan.setup}`);
        core.info(`mode: ${plan.mode}`);
        core.info(`working-directory: ${plan.workingDirectory}`);
        core.info(`cache-tag: ${plan.cacheTagPrefix || '(none)'}`);
        core.info(`resolved-entries: ${plan.archiveEntries || '(none)'}`);
        core.info(`resolved-tags: ${resolvedTags.join(',') || '(none)'}`);
        core.info(`cache-hit: ${String(overallHit)}`);
        core.info(`verify-mode: ${inputs.verify}`);
        core.info(`trust-state: status=${trustState.status} event=${trustState.event_name || '(none)'} requested=${trustState.requested_policy} resolved=${trustState.resolved_policy}`);
        core.info(`token-capabilities: restore=${String(trustState.token_capabilities.restore)} stage=${String(trustState.token_capabilities.stage)} save=${String(trustState.token_capabilities.save)}`);
        if (diagnostics.includeLogs) {
            const proxyLogPath = core.getState('proxy-log-path');
            if (proxyLogPath) {
                const logTail = readLogTail(proxyLogPath, diagnostics.logLines);
                core.info(`proxy-log-path: ${proxyLogPath}`);
                if (logTail.length > 0) {
                    core.info(`proxy-log-tail (${logTail.length} lines):`);
                    for (const line of logTail) {
                        core.info(line);
                    }
                }
            }
        }
    });
}
async function restoreEntries(workspace, entriesString, flagArgs, onRestoreStart) {
    if (!entriesString.trim()) {
        return { hit: false, saveEntries: '' };
    }
    const parsedEntries = parseEntries(entriesString, 'restore', {
        separatorMode: 'newline',
    });
    if (parsedEntries.length === 0) {
        return { hit: false, saveEntries: '' };
    }
    const primaryRestoreEntries = parsedEntries.map((entry) => `${entry.tag}:${entry.restorePath}`);
    const restoreEntriesArg = primaryRestoreEntries.join(',');
    const saveEntries = parsedEntries.map((entry) => `${entry.tag}:${entry.savePath}`).join('\n');
    const restoreMissShouldFail = flagArgs.includes('--fail-on-cache-miss');
    const restoreErrorsShouldFail = flagArgs.includes('--fail-on-cache-error');
    const attempts = [{
            entries: primaryRestoreEntries,
            tags: parsedEntries.map((entry) => entry.tag),
        }];
    const failedAttempts = [];
    for (const attempt of attempts) {
        const remotelyPresent = await checkEntries(workspace, attempt.tags, flagArgs);
        if (!remotelyPresent) {
            continue;
        }
        // The Action needs a truthful materialization result even when the workflow chooses
        // best-effort cache behavior. Make this internal invocation strict, then soften a failure
        // back to cache-hit=false below unless the user requested strict errors.
        const restoreFlagArgs = flagArgs.includes('--fail-on-cache-error')
            ? [...flagArgs]
            : [...flagArgs, '--fail-on-cache-error'];
        const restoreArgs = [
            'restore', workspace,
            ...attempt.entries.flatMap((entry) => ['--entry', entry]),
            ...restoreFlagArgs,
        ];
        let stdout = '';
        let stderr = '';
        const restoreProcess = execBoringCache(restoreArgs, {
            ignoreReturnCode: true,
            listeners: {
                stdout: (data) => {
                    stdout = appendRestoreDiagnostic(stdout, data);
                },
                stderr: (data) => {
                    stderr = appendRestoreDiagnostic(stderr, data);
                },
            },
        });
        onRestoreStart?.();
        const restoreExitCode = await restoreProcess;
        if (restoreExitCode === 0) {
            return { hit: true, saveEntries };
        }
        const detail = restoreFailureDetail(stdout, stderr, attempt.entries);
        failedAttempts.push(detail);
        core.warning(`Cache entry was found but could not be restored: ${detail}`);
    }
    if (failedAttempts.length > 0) {
        const detail = failedAttempts[failedAttempts.length - 1];
        if (restoreErrorsShouldFail || restoreMissShouldFail) {
            throw new Error(detail);
        }
        core.warning('No available cache candidate could be materialized; treating the restore as a miss.');
    }
    else if (restoreMissShouldFail) {
        throw new Error(`Cache restore failed for ${restoreEntriesArg}`);
    }
    return { hit: false, saveEntries };
}
async function checkEntries(workspace, tags, restoreFlagArgs) {
    const checkTags = tags.map((tag) => tag.trim()).filter(Boolean);
    if (checkTags.length === 0) {
        return false;
    }
    let stdout = '';
    const args = ['check', workspace, checkTags.join(','), ...checkFlagArgs(restoreFlagArgs), '--json'];
    const exitCode = await execBoringCache(args, {
        ignoreReturnCode: true,
        silent: true,
        listeners: {
            stdout: (data) => {
                stdout += data.toString();
            },
        },
    });
    if (!stdout.trim()) {
        if (exitCode !== 0) {
            core.warning(`Cache check failed for ${checkTags.join(',')}; treating as a miss.`);
        }
        else {
            core.warning(`boringcache check --json produced no output for ${checkTags.join(',')}; treating as a miss.`);
        }
        return false;
    }
    let summary;
    try {
        summary = JSON.parse(stdout);
    }
    catch (error) {
        core.warning(`Failed to parse boringcache check JSON for ${checkTags.join(',')}: ${error instanceof Error ? error.message : String(error)}; treating as a miss.`);
        return false;
    }
    return (summary.results || []).some((result) => result.status === 'hit');
}
function checkFlagArgs(restoreFlagArgs) {
    const args = [];
    if (restoreFlagArgs.includes('--no-platform')) {
        args.push('--no-platform');
    }
    if (restoreFlagArgs.includes('--no-git')) {
        args.push('--no-git');
    }
    return args;
}
export async function run() {
    const originalCwd = process.cwd();
    let restoreFailureContext = {};
    try {
        const inputs = getInputs();
        restoreFailureContext = {
            diagnostics_level: loadDiagnosticsConfig(inputs).level,
            verify_mode: inputs.verify,
        };
        const trustResolution = resolveTrustPolicy(inputs.trustPolicy);
        applyTrustTokenPolicy(trustResolution.resolved);
        const trustState = buildActionTrustState(inputs.trustPolicy, trustResolution.resolved, trustResolution.status);
        const effectiveInputs = {
            ...inputs,
            readOnly: trustResolution.resolved === 'restore',
            stage: trustResolution.resolved === 'stage',
        };
        const candidateReceiptFile = effectiveInputs.stage ? prepareCandidateReceiptFile() : '';
        core.saveState('candidate-receipt-file', candidateReceiptFile);
        const cliPlatform = inputs.cliPlatform || undefined;
        if (inputs.cliVersion.toLowerCase() !== 'skip') {
            await ensureBoringCache(buildCliSetupOptions(inputs, cliPlatform));
        }
        if (inputs.mode.trim().toLowerCase() === 'xcode') {
            await ensureXcodePlugin(inputs.cliVersion);
        }
        const cliCapabilityVersion = await resolveCliCapabilityVersion(inputs.cliVersion);
        const capabilityInputs = { ...effectiveInputs, cliVersion: cliCapabilityVersion };
        const plan = await buildPlan(capabilityInputs);
        const hasCandidateImports = inputs.cacheCandidates.trim().length > 0;
        if (effectiveInputs.stage && hasCandidateImports) {
            throw new Error('trust-policy stage cannot import cache-candidates; stage one immutable output, then select it in a separate restore or publish run.');
        }
        if (effectiveInputs.stage && !['archive', 'docker', 'buildkit'].includes(plan.mode)) {
            throw new Error(`trust-policy stage is not available for ${plan.mode}; direct tool caches do not yet have an immutable candidate boundary.`);
        }
        if (hasCandidateImports && !['docker', 'buildkit'].includes(plan.mode)) {
            throw new Error('cache-candidates are supported only for Docker and BuildKit cache manifests. Archives promote one exact complete snapshot, and direct tool caches retain authoritative tool keys.');
        }
        if (effectiveInputs.stage && inputs.dockerToolCache.trim()) {
            throw new Error('trust-policy stage cannot be combined with docker-tool-cache until direct tool caches have an immutable candidate boundary.');
        }
        restoreFailureContext = {
            ...restoreFailureContext,
            workspace: plan.workspace,
            setup: plan.setup,
            mode: plan.mode,
            working_directory: plan.workingDirectory,
            cache_tag: plan.cacheTagPrefix || '',
            trust_state: trustState,
        };
        process.chdir(plan.workingDirectory);
        await applyCliPlanEnv(plan);
        let signalArchiveRestoreStarted = () => { };
        const archiveRestoreStarted = new Promise((resolve) => {
            let signaled = false;
            signalArchiveRestoreStarted = () => {
                if (!signaled) {
                    signaled = true;
                    resolve();
                }
            };
        });
        const archiveRestorePromise = restoreEntries(plan.workspace, plan.archiveEntries, buildFlagArgs(inputs), signalArchiveRestoreStarted);
        void archiveRestorePromise.then(signalArchiveRestoreStarted, signalArchiveRestoreStarted);
        await archiveRestoreStarted;
        try {
            if (plan.setup === 'mise') {
                await applyMiseSetup(plan.runtimeTools, plan.workingDirectory);
            }
        }
        catch (error) {
            // The archive restore was already in flight so mise could benefit from
            // restored package-manager state. Settle it before preserving the setup error.
            await archiveRestorePromise.catch(() => undefined);
            throw error;
        }
        const [archiveRestore, modeRestore] = modeRestoreCanOverlapArchive(plan.mode)
            ? await Promise.all([
                archiveRestorePromise,
                runModeRestore(plan, effectiveInputs, {
                    archiveMaterialized: archiveRestorePromise,
                }),
            ])
            : [
                await archiveRestorePromise,
                await runModeRestore(plan, effectiveInputs),
            ];
        const stagedCandidates = publishCandidateOutputs(candidateReceiptFile);
        const genericSaveEntries = archiveRestore.saveEntries;
        const verificationSpecs = [
            ...buildGenericVerificationSpecs(plan, effectiveInputs.stage),
            ...(modeRestore.verificationSpecs || []),
        ];
        const resolvedTags = resolveVerificationTags(verificationSpecs, plan.workingDirectory);
        const saveCapable = trustResolution.resolved !== 'restore';
        const saveExpectedSpecs = verificationSpecs.filter((spec) => spec.saveExpected);
        const deferredVerifySpecs = trustResolution.resolved === 'publish' ? saveExpectedSpecs : [];
        const immediateVerifySpecs = verificationSpecs.filter((spec) => !spec.saveExpected);
        const deferredVerifyTags = resolveVerificationTags(deferredVerifySpecs, plan.workingDirectory);
        const overallHit = modeRestore.cacheHit ?? archiveRestore.hit;
        const diagnostics = loadDiagnosticsConfig(inputs);
        core.setOutput('cache-hit', String(overallHit));
        core.setOutput('diagnostics-level', diagnostics.level);
        core.setOutput('resolved-mode', plan.mode);
        core.setOutput('resolved-tools', serializeTools(plan.runtimeTools));
        core.setOutput('workspace', plan.workspace);
        core.setOutput('cache-tag', modeRestore.cacheTag || plan.cacheTagPrefix);
        core.setOutput('resolved-entries', plan.archiveEntries);
        core.setOutput('resolved-tags', resolvedTags.join(','));
        writeActionEvidence('restore', {
            phase_status: 'completed',
            phase_summary: restorePhaseSummary({
                cacheHit: overallHit,
                trustState,
                saveCapable,
            }),
            workspace: plan.workspace,
            setup: plan.setup,
            mode: plan.mode,
            working_directory: plan.workingDirectory,
            cache_tag: modeRestore.cacheTag || plan.cacheTagPrefix || '',
            resolved_entries: plan.archiveEntries,
            resolved_tags: resolvedTags,
            cache_hit: overallHit,
            mode_evidence: modeRestore.evidence || {},
            diagnostics_level: diagnostics.level,
            trust_state: trustState,
            trust_policy: trustResolution.resolved,
            verify_mode: inputs.verify,
            verify_save_tags: deferredVerifyTags,
            token_capabilities: {
                ...trustState.token_capabilities,
            },
            staged_candidates: stagedCandidates,
        });
        restoreFailureContext = {
            ...restoreFailureContext,
            cache_tag: modeRestore.cacheTag || plan.cacheTagPrefix || '',
            resolved_entries: plan.archiveEntries,
            resolved_tags: resolvedTags,
            cache_hit: overallHit,
            mode_evidence: modeRestore.evidence || {},
            trust_state: trustState,
            trust_policy: trustResolution.resolved,
            verify_save_tags: deferredVerifyTags,
        };
        core.saveState('resolved-mode', plan.mode);
        core.saveState('cli-version', inputs.cliVersion);
        core.saveState('cli-capability-version', cliCapabilityVersion);
        core.saveState('cli-platform', cliPlatform || '');
        core.saveState('working-directory', plan.workingDirectory);
        core.saveState('generic-cache-entries', genericSaveEntries);
        core.saveState('generic-cache-workspace', plan.workspace);
        core.saveState('force', String(inputs.force));
        core.saveState('verbose', String(inputs.verbose));
        core.saveState('diagnostics-level', diagnostics.level);
        core.saveState('diagnostics-log-lines', String(diagnostics.logLines));
        core.saveState('resolved-tags', resolvedTags.join(','));
        core.saveState('verify-save-specs', JSON.stringify(deferredVerifySpecs));
        core.saveState('verify-save-tags', deferredVerifyTags.join(','));
        core.saveState('verify-mode', inputs.verify);
        core.saveState('verify-timeout-seconds', String(inputs.verifyTimeoutSeconds));
        core.saveState('verify-require-server-signature', String(inputs.verifyRequireServerSignature));
        core.saveState('trust-policy', inputs.trustPolicy);
        core.saveState('resolved-trust-policy', trustResolution.resolved);
        core.saveState('trust-status', trustResolution.status);
        if (!saveCapable && inputs.verify !== 'none' && saveExpectedSpecs.length > 0) {
            core.info('Skipping save-expected tag verification in restore step: no save-capable token is available.');
        }
        if (inputs.verify !== 'none' && immediateVerifySpecs.length > 0) {
            await verifyVerificationSpecs(plan.workspace, immediateVerifySpecs, {
                mode: inputs.verify,
                timeoutSeconds: inputs.verifyTimeoutSeconds,
                requireServerSignature: inputs.verifyRequireServerSignature,
                verbose: inputs.verbose,
            });
        }
        await emitRestoreDiagnostics(plan, inputs, resolvedTags, overallHit, trustState);
        if (trustResolution.resolved === 'restore') {
            core.info(`Post step is restore-only (trust-policy: ${inputs.trustPolicy}).`);
        }
    }
    catch (error) {
        writeActionFailureEvidence('restore', error, restoreFailureContext);
        const failureOperation = error instanceof DockerBuildFailure ? 'Docker build' : 'restore';
        core.setFailed(`boringcache/one ${failureOperation} failed: ${actionErrorMessage(error)}`);
    }
    finally {
        process.chdir(originalCwd);
    }
}
