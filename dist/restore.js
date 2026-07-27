import * as core from '@actions/core';
import { hasSaveToken } from './core';
import { applySaveTokenPolicy, applyRestoreOnlyTokenPolicy, applyCliPlanEnv, applyMiseSetup, actionErrorMessage, buildActionTrustState, buildGenericVerificationSpecs, buildFlagArgs, buildPlan, ensureBoringCache, execBoringCache, getInputs, isPullRequestEvent, saveConfigured, loadDiagnosticsConfig, parseEntries, readLogTail, resolveCliCapabilityVersion, resolveVerificationTags, restorePhaseSummary, runDiagnosticsGroup, serializeTools, verifyVerificationSpecs, writeActionEvidence, writeActionFailureEvidence, } from './utils';
import { DockerBuildFailure, runModeRestore } from './mode-handlers';
const MAX_RESTORE_DIAGNOSTIC_CHARS = 8_000;
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
        core.info(`trust-state: status=${trustState.status} event=${trustState.event_name || '(none)'} save-policy=${trustState.save_policy} save-on-pull-request=${String(trustState.save_on_pull_request)}`);
        core.info(`token-capabilities: restore=${String(trustState.token_capabilities.restore)} save=${String(trustState.token_capabilities.save)}`);
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
async function restoreEntries(workspace, entriesString, flagArgs) {
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
        const restoreExitCode = await execBoringCache(restoreArgs, {
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
        const saveEnabled = saveConfigured(inputs);
        delete process.env.BORINGCACHE_SAVE_ON_PULL_REQUEST;
        const saveAllowed = saveEnabled ? applySaveTokenPolicy(inputs) : false;
        if (!saveEnabled) {
            applyRestoreOnlyTokenPolicy();
        }
        const trustState = buildActionTrustState(inputs, {
            saveConfigured: saveEnabled,
            saveAllowed,
        });
        const effectiveInputs = saveEnabled && saveAllowed
            ? inputs
            : { ...inputs, readOnly: true };
        const cliPlatform = inputs.cliPlatform || undefined;
        if (inputs.cliVersion.toLowerCase() !== 'skip') {
            await ensureBoringCache(buildCliSetupOptions(inputs, cliPlatform));
        }
        const cliCapabilityVersion = await resolveCliCapabilityVersion(inputs.cliVersion);
        const capabilityInputs = { ...effectiveInputs, cliVersion: cliCapabilityVersion };
        const plan = await buildPlan(capabilityInputs);
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
        const archiveRestore = await restoreEntries(plan.workspace, plan.archiveEntries, buildFlagArgs(inputs));
        if (plan.setup === 'mise') {
            await applyMiseSetup(plan.runtimeTools, plan.workingDirectory);
        }
        const modeRestore = await runModeRestore(plan, effectiveInputs);
        const genericSaveEntries = archiveRestore.saveEntries;
        const verificationSpecs = [
            ...buildGenericVerificationSpecs(plan),
            ...(modeRestore.verificationSpecs || []),
        ];
        const resolvedTags = resolveVerificationTags(verificationSpecs, plan.workingDirectory);
        const saveCapable = saveEnabled && hasSaveToken();
        const saveExpectedSpecs = verificationSpecs.filter((spec) => spec.saveExpected);
        const deferredVerifySpecs = saveCapable ? saveExpectedSpecs : [];
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
            save_configured: saveEnabled,
            save_allowed: saveAllowed,
            save_capable: saveCapable,
            verify_mode: inputs.verify,
            verify_save_tags: deferredVerifyTags,
            token_capabilities: {
                ...trustState.token_capabilities,
            },
        });
        restoreFailureContext = {
            ...restoreFailureContext,
            cache_tag: modeRestore.cacheTag || plan.cacheTagPrefix || '',
            resolved_entries: plan.archiveEntries,
            resolved_tags: resolvedTags,
            cache_hit: overallHit,
            mode_evidence: modeRestore.evidence || {},
            trust_state: trustState,
            save_configured: saveEnabled,
            save_allowed: saveAllowed,
            save_capable: saveCapable,
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
        core.saveState('save-configured', String(saveEnabled));
        core.saveState('save-allowed', String(saveAllowed));
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
        if (!saveEnabled) {
            core.info('Post step save is disabled by save-policy: off.');
        }
        if (saveEnabled && isPullRequestEvent() && !saveAllowed) {
            core.info('Post step will stay restore-only unless save-on-pull-request: true is set.');
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
