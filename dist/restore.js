import * as core from '@actions/core';
import { applyTrustEnvPolicy, applyCliPlanEnv, actionEvidenceProductRefs, actionErrorMessage, buildActionTrustState, buildFlagArgs, buildPlan, ensureBoringCache, execBoringCache, getActionState, getInputs, loadDiagnosticsConfig, parseEntries, prepareCandidateReceiptFile, publishCandidateOutputs, readLogTail, resolveCliCapabilityVersion, resolveTrustDecision, restorePhaseSummary, runDiagnosticsGroup, saveActionState, writeActionEvidence, writeActionFailureEvidence, } from './utils';
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
    };
}
async function emitRestoreDiagnostics(plan, inputs, resolvedTags, overallHit, trustState) {
    const diagnostics = loadDiagnosticsConfig(inputs);
    await runDiagnosticsGroup(diagnostics, 'BoringCache Diagnostics', async () => {
        core.info(`workspace: ${plan.workspace}`);
        core.info(`mode: ${plan.mode}`);
        core.info(`working-directory: ${plan.workingDirectory}`);
        core.info(`cache-tag: ${plan.cacheTagPrefix || '(none)'}`);
        core.info(`resolved-entries: ${plan.archiveEntries || '(none)'}`);
        core.info(`resolved-tags: ${resolvedTags.join(',') || '(none)'}`);
        core.info(`cache-hit: ${overallHit === undefined ? 'not evaluated' : String(overallHit)}`);
        core.info(`trust-state: status=${trustState.status} event=${trustState.event_name || '(none)'} requested=${trustState.requested_policy} resolved=${trustState.resolved_policy}`);
        core.info(`token-capabilities: restore=${String(trustState.token_capabilities.restore)} stage=${String(trustState.token_capabilities.stage)} save=${String(trustState.token_capabilities.save)}`);
        if (diagnostics.includeLogs) {
            const proxyLogPath = getActionState('proxy-log-path');
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
        return { hit: false, evaluated: false, saveEntries: '' };
    }
    const parsedEntries = parseEntries(entriesString, 'restore', {
        separatorMode: 'newline',
    });
    if (parsedEntries.length === 0) {
        return { hit: false, evaluated: false, saveEntries: '' };
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
        const restoreExitCode = await restoreProcess;
        if (restoreExitCode === 0) {
            return { hit: true, evaluated: true, saveEntries };
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
    return { hit: false, evaluated: true, saveEntries };
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
    if (restoreFlagArgs.includes('--include-pr-tag')) {
        args.push('--include-pr-tag');
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
        };
        const cliPlatform = inputs.cliPlatform || undefined;
        if (inputs.cliVersion.toLowerCase() !== 'skip') {
            await ensureBoringCache(buildCliSetupOptions(inputs, cliPlatform));
        }
        const trustDecision = await resolveTrustDecision(inputs.trustPolicy);
        applyTrustEnvPolicy(trustDecision);
        const trustState = buildActionTrustState(trustDecision);
        const effectiveInputs = {
            ...inputs,
            readOnly: trustDecision.resolved === 'restore',
            stage: trustDecision.resolved === 'stage',
        };
        const candidateReceiptFile = effectiveInputs.stage ? prepareCandidateReceiptFile() : '';
        saveActionState('candidate-receipt-file', candidateReceiptFile);
        const cliCapabilityVersion = await resolveCliCapabilityVersion(inputs.cliVersion);
        const capabilityInputs = { ...effectiveInputs, cliVersion: cliCapabilityVersion };
        const plan = await buildPlan(capabilityInputs);
        if (effectiveInputs.stage && !['archive', 'docker', 'buildkit'].includes(plan.mode)) {
            throw new Error(`trust-policy stage is not available for ${plan.mode}; direct tool caches do not yet have an immutable candidate boundary.`);
        }
        // Persist one versioned lifecycle document before starting any process that
        // may need post-step cleanup. GitHub state carries only its opaque id.
        saveActionState('resolved-mode', plan.mode);
        saveActionState('cli-version', inputs.cliVersion);
        saveActionState('cli-capability-version', cliCapabilityVersion);
        saveActionState('cli-platform', cliPlatform || '');
        saveActionState('working-directory', plan.workingDirectory);
        saveActionState('verbose', String(inputs.verbose));
        saveActionState('diagnostics-level', loadDiagnosticsConfig(inputs).level);
        saveActionState('diagnostics-log-lines', String(loadDiagnosticsConfig(inputs).logLines));
        saveActionState('trust-policy', inputs.trustPolicy);
        saveActionState('trust-decision', JSON.stringify(trustDecision));
        restoreFailureContext = {
            ...restoreFailureContext,
            workspace: plan.workspace,
            mode: plan.mode,
            working_directory: plan.workingDirectory,
            cache_tag: plan.cacheTagPrefix || '',
            trust_state: trustState,
        };
        process.chdir(plan.workingDirectory);
        await applyCliPlanEnv(plan);
        const archiveRestorePromise = restoreEntries(plan.workspace, plan.archiveEntries, buildFlagArgs(effectiveInputs));
        const archiveRestore = await archiveRestorePromise;
        const modeRestore = await runModeRestore(plan, effectiveInputs);
        const completedPlan = {
            ...plan,
            workspace: modeRestore.workspace || plan.workspace,
        };
        if (!completedPlan.workspace) {
            throw new Error('The BoringCache CLI mode plan did not resolve a workspace. Set workspace in .boringcache.toml.');
        }
        const stagedCandidates = publishCandidateOutputs(candidateReceiptFile);
        const genericSaveEntries = archiveRestore.saveEntries;
        const resolvedTags = Array.from(new Set([
            ...completedPlan.archiveVerificationTags,
            ...(modeRestore.verificationSpecs || []).map((spec) => spec.tag),
        ]));
        const saveCapable = trustDecision.write_allowed;
        const overallHit = modeRestore.cacheHit ?? (archiveRestore.evaluated ? archiveRestore.hit : undefined);
        const cacheResult = overallHit === undefined ? 'not_evaluated' : overallHit ? 'hit' : 'miss';
        const resolvedEntries = modeRestore.resolvedEntries ?? completedPlan.archiveEntries;
        const diagnostics = loadDiagnosticsConfig(inputs);
        core.setOutput('cache-hit', overallHit === undefined ? '' : String(overallHit));
        writeActionEvidence('restore', {
            phase_status: 'completed',
            phase_summary: restorePhaseSummary({
                cacheHit: overallHit,
                trustState,
                saveCapable,
            }),
            workspace: completedPlan.workspace,
            mode: completedPlan.mode,
            working_directory: completedPlan.workingDirectory,
            cache_tag: modeRestore.cacheTag || completedPlan.cacheTagPrefix || '',
            resolved_entries: resolvedEntries,
            resolved_tags: resolvedTags,
            cache_hit: overallHit,
            cache_result: cacheResult,
            mode_evidence: modeRestore.evidence || {},
            diagnostics_level: diagnostics.level,
            trust_state: trustState,
            trust_policy: trustDecision.resolved,
            token_capabilities: {
                ...trustState.token_capabilities,
            },
            staged_candidates: stagedCandidates,
        }, actionEvidenceProductRefs(cliCapabilityVersion));
        restoreFailureContext = {
            ...restoreFailureContext,
            workspace: completedPlan.workspace,
            cache_tag: modeRestore.cacheTag || completedPlan.cacheTagPrefix || '',
            resolved_entries: resolvedEntries,
            resolved_tags: resolvedTags,
            cache_hit: overallHit,
            cache_result: cacheResult,
            mode_evidence: modeRestore.evidence || {},
            trust_state: trustState,
            trust_policy: trustDecision.resolved,
        };
        saveActionState('generic-cache-entries', genericSaveEntries);
        saveActionState('generic-cache-workspace', completedPlan.workspace);
        await emitRestoreDiagnostics(completedPlan, inputs, resolvedTags, overallHit, trustState);
        if (!trustDecision.write_allowed) {
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
