import * as core from '@actions/core';
import { hasSaveToken } from './core';
import { applySaveTokenPolicy, applyRestoreOnlyTokenPolicy, applyPresetCacheEnv, applyMiseSetup, actionErrorMessage, buildActionTrustState, buildGenericVerificationSpecs, buildFlagArgs, buildPlan, ensureBoringCache, execBoringCache, getInputs, isPullRequestEvent, saveConfigured, loadDiagnosticsConfig, parseEntries, readLogTail, resolveVerificationTags, restorePhaseSummary, runDiagnosticsGroup, serializeTools, verifyVerificationSpecs, writeActionEvidence, writeActionFailureEvidence, } from './utils';
import { runModeRestore } from './mode-handlers';
function buildRuntimeRestoreFlagArgs(inputs) {
    const flagArgs = [];
    if (inputs.enableCrossOsArchive || inputs.noPlatform) {
        flagArgs.push('--no-platform');
    }
    if (inputs.verbose) {
        flagArgs.push('--verbose');
    }
    return flagArgs;
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
async function emitRestoreDiagnostics(plan, inputs, resolvedTags, overallHit, runtimeHit, trustState) {
    const diagnostics = loadDiagnosticsConfig(inputs);
    await runDiagnosticsGroup(diagnostics, 'BoringCache Diagnostics', async () => {
        core.info(`workspace: ${plan.workspace}`);
        core.info(`setup: ${plan.setup}`);
        core.info(`mode: ${plan.mode}`);
        core.info(`preset: ${plan.preset}`);
        core.info(`working-directory: ${plan.workingDirectory}`);
        core.info(`cache-tag: ${plan.cacheTagPrefix || '(none)'}`);
        core.info(`runtime-cache-tag: ${plan.runtimeTag || '(none)'}`);
        core.info(`resolved-entries: ${plan.archiveEntries || '(none)'}`);
        core.info(`resolved-tags: ${resolvedTags.join(',') || '(none)'}`);
        core.info(`cache-hit: ${String(overallHit)}`);
        core.info(`runtime-cache-hit: ${String(runtimeHit)}`);
        core.info(`verify-mode: ${inputs.verify}`);
        core.info(`trust-state: status=${trustState.status} event=${trustState.event_name || '(none)'} save-policy=${trustState.save_policy} save-on-pull-request=${String(trustState.save_on_pull_request)}`);
        core.info(`token-capabilities: restore=${String(trustState.token_capabilities.restore)} save=${String(trustState.token_capabilities.save)} legacy-api-only=${String(trustState.token_capabilities.legacy_api_only)}`);
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
async function restoreEntries(workspace, entriesString, flagArgs, restoreCandidates = []) {
    if (!entriesString.trim()) {
        return { hit: false, saveEntries: '' };
    }
    const parsedEntries = parseEntries(entriesString, 'restore', { resolvePaths: false });
    if (parsedEntries.length === 0) {
        return { hit: false, saveEntries: '' };
    }
    const restoreEntriesArg = parsedEntries.map((entry) => `${entry.tag}:${entry.restorePath}`).join(',');
    const saveEntries = parsedEntries.map((entry) => `${entry.tag}:${entry.savePath}`).join(',');
    const restoreMissShouldFail = flagArgs.includes('--fail-on-cache-miss');
    const primaryHit = await checkEntries(workspace, parsedEntries.map((entry) => entry.tag), flagArgs);
    let selectedRestoreEntries = restoreEntriesArg;
    let hit = primaryHit;
    if (!hit) {
        for (const candidate of restoreCandidates) {
            if (!candidate.entries.trim()) {
                continue;
            }
            const candidateEntries = parseEntries(candidate.entries, 'restore', { resolvePaths: false });
            const candidateHit = await checkEntries(workspace, candidateEntries.map((entry) => entry.tag), flagArgs);
            if (candidateHit) {
                core.info(`Cache hit with restore key ${candidate.tagPrefix}`);
                selectedRestoreEntries = candidate.entries;
                hit = true;
                break;
            }
        }
    }
    if (!hit && restoreMissShouldFail) {
        throw new Error(`Cache restore failed for ${restoreEntriesArg}`);
    }
    const restoreFlagArgs = hit ? flagArgs : flagArgs.filter((arg) => arg !== '--fail-on-cache-miss');
    const restoreExitCode = await execBoringCache(['restore', workspace, selectedRestoreEntries, ...restoreFlagArgs], { ignoreReturnCode: true });
    if (restoreExitCode !== 0) {
        throw new Error(`Cache restore failed for ${selectedRestoreEntries}`);
    }
    return {
        hit,
        saveEntries,
    };
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
        const plan = await buildPlan(inputs);
        restoreFailureContext = {
            ...restoreFailureContext,
            workspace: plan.workspace,
            setup: plan.setup,
            mode: plan.mode,
            preset: plan.preset,
            working_directory: plan.workingDirectory,
            cache_tag: plan.cacheTagPrefix || '',
            runtime_cache_tag: plan.runtimeTag || '',
            trust_state: trustState,
        };
        process.chdir(plan.workingDirectory);
        await applyPresetCacheEnv(plan);
        const runtimeRestore = await restoreEntries(plan.workspace, plan.runtimeEntry || '', buildRuntimeRestoreFlagArgs(inputs));
        const archiveRestore = await restoreEntries(plan.workspace, plan.archiveEntries, buildFlagArgs(inputs), plan.archiveRestoreCandidates);
        let usedMiseRuntime = false;
        if (plan.setup === 'mise') {
            usedMiseRuntime = await applyMiseSetup(plan.runtimeTools, runtimeRestore.hit, plan.workingDirectory);
        }
        const modeRestore = await runModeRestore(plan, effectiveInputs);
        const genericSaveEntries = [usedMiseRuntime ? runtimeRestore.saveEntries : '', archiveRestore.saveEntries]
            .filter(Boolean)
            .join(',');
        const verificationSpecs = [
            ...buildGenericVerificationSpecs(plan, inputs, usedMiseRuntime),
            ...(modeRestore.verificationSpecs || []),
        ];
        const resolvedTags = resolveVerificationTags(verificationSpecs, plan.workingDirectory);
        const saveCapable = saveEnabled && hasSaveToken();
        const saveExpectedSpecs = verificationSpecs.filter((spec) => spec.saveExpected);
        const deferredVerifySpecs = saveCapable ? saveExpectedSpecs : [];
        const immediateVerifySpecs = verificationSpecs.filter((spec) => !spec.saveExpected);
        const deferredVerifyTags = resolveVerificationTags(deferredVerifySpecs, plan.workingDirectory);
        const overallHit = modeRestore.cacheHit ?? (runtimeRestore.hit || archiveRestore.hit);
        const diagnostics = loadDiagnosticsConfig(inputs);
        core.setOutput('cache-hit', String(overallHit));
        core.setOutput('runtime-cache-hit', String(runtimeRestore.hit));
        core.setOutput('diagnostics-level', diagnostics.level);
        core.setOutput('resolved-mode', plan.mode);
        core.setOutput('resolved-tools', serializeTools(plan.runtimeTools));
        core.setOutput('workspace', plan.workspace);
        core.setOutput('cache-tag', modeRestore.cacheTag || plan.cacheTagPrefix);
        core.setOutput('runtime-cache-tag', plan.runtimeTag || '');
        core.setOutput('resolved-entries', plan.archiveEntries);
        core.setOutput('resolved-tags', resolvedTags.join(','));
        writeActionEvidence('restore', {
            phase_status: 'completed',
            phase_summary: restorePhaseSummary({
                cacheHit: overallHit,
                runtimeCacheHit: runtimeRestore.hit,
                trustState,
                saveCapable,
            }),
            workspace: plan.workspace,
            setup: plan.setup,
            mode: plan.mode,
            preset: plan.preset,
            working_directory: plan.workingDirectory,
            cache_tag: modeRestore.cacheTag || plan.cacheTagPrefix || '',
            runtime_cache_tag: plan.runtimeTag || '',
            resolved_entries: plan.archiveEntries,
            resolved_tags: resolvedTags,
            cache_hit: overallHit,
            runtime_cache_hit: runtimeRestore.hit,
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
            runtime_cache_hit: runtimeRestore.hit,
            mode_evidence: modeRestore.evidence || {},
            trust_state: trustState,
            save_configured: saveEnabled,
            save_allowed: saveAllowed,
            save_capable: saveCapable,
            verify_save_tags: deferredVerifyTags,
        };
        core.saveState('resolved-mode', plan.mode);
        core.saveState('cli-version', inputs.cliVersion);
        core.saveState('cli-platform', cliPlatform || '');
        core.saveState('working-directory', plan.workingDirectory);
        core.saveState('generic-cache-entries', genericSaveEntries);
        core.saveState('generic-cache-workspace', plan.workspace);
        core.saveState('runtime-mise-used', String(usedMiseRuntime));
        core.saveState('generic-cache-exclude', inputs.exclude);
        core.saveState('no-platform', String(inputs.noPlatform));
        core.saveState('enableCrossOsArchive', String(inputs.enableCrossOsArchive));
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
        await emitRestoreDiagnostics(plan, inputs, resolvedTags, overallHit, runtimeRestore.hit, trustState);
        if (!saveEnabled) {
            core.info('Post step save is disabled by save-policy: off.');
        }
        if (saveEnabled && isPullRequestEvent() && !saveAllowed) {
            core.info('Post step will stay restore-only unless save-on-pull-request: true is set.');
        }
    }
    catch (error) {
        writeActionFailureEvidence('restore', error, restoreFailureContext);
        core.setFailed(`boringcache/one restore failed: ${actionErrorMessage(error)}`);
    }
    finally {
        process.chdir(originalCwd);
    }
}
