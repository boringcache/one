import * as core from '@actions/core';
import * as fs from 'fs';
import { hasSaveToken, missingSaveTokenMessage } from './core';
import { actionErrorMessage, appendSaveExcludeArgs, assertCrossOsArchiveTransportSupported, assertExternalSymlinkRoundTripSupported, assertLegacyArchiveEntriesAreLossless, buildActionTrustState, buildPlan, ensureBoringCache, execBoringCache, getInputs, applyPullRequestSaveScopeEnv, isPullRequestEvent, loadDiagnosticsConfig, readLogTail, readSavedSaveAllowance, readSavedSaveConfiguration, resolveCliCapabilityVersion, resolveVerificationTags, runDiagnosticsGroup, normalizeVerifyTimeoutSeconds, parseEntries, postPhaseSummary, saveSkippedByConfigurationMessage, saveSkippedByPolicyMessage, supportsPortableArchiveArgs, splitExcludeInput, verifyVerificationSpecs, writeActionEvidence, writeActionFailureEvidence, } from './utils';
import { runModeSave } from './mode-handlers';
function toSaveEntries(entriesString) {
    if (!entriesString.trim()) {
        return '';
    }
    return parseEntries(entriesString, 'restore', {
        resolvePaths: false,
        separatorMode: 'newline',
    })
        .map((entry) => `${entry.tag}:${entry.savePath}`)
        .join('\n');
}
function parseSavedVerificationSpecs(raw) {
    if (!raw.trim()) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed
            .filter((spec) => {
            return spec && typeof spec.tag === 'string' && typeof spec.noPlatform === 'boolean' && typeof spec.noGit === 'boolean';
        })
            .map((spec) => ({
            tag: spec.tag,
            noPlatform: spec.noPlatform,
            noGit: spec.noGit,
            pathHint: spec.pathHint,
            saveExpected: spec.saveExpected,
        }));
    }
    catch {
        return [];
    }
}
function filterVerifiableSpecs(specs) {
    return specs.filter((spec) => !spec.pathHint || fs.existsSync(spec.pathHint));
}
function parseSavedExcludes(raw, legacy) {
    if (raw.trim()) {
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            throw new Error('Saved BoringCache exclusion state is invalid JSON; refusing to save a cache with dropped or changed exclusions.');
        }
        if (!Array.isArray(parsed) || !parsed.every((pattern) => typeof pattern === 'string')) {
            throw new Error('Saved BoringCache exclusion state is not a string array; refusing to save a cache with dropped or changed exclusions.');
        }
        return parsed;
    }
    return splitExcludeInput(legacy);
}
function buildCliSetupOptions(inputs, cliVersion, cliPlatform) {
    return {
        version: cliVersion,
        platform: cliPlatform,
        ...(inputs.trustedWorkspaceSigningKeyFingerprint
            ? { trustedWorkspaceSigningKeyFingerprint: inputs.trustedWorkspaceSigningKeyFingerprint }
            : {}),
    };
}
function parseSavedTagList(raw) {
    return new Set(raw
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean));
}
function buildLegacyVerificationSpecs(verifySaveTags, entriesString, workingDirectory, noPlatform) {
    if (!entriesString.trim()) {
        return verifySaveTags.map((tag) => ({
            tag,
            noPlatform: true,
            noGit: true,
        }));
    }
    const entrySpecs = parseEntries(entriesString, 'restore', {
        resolvePaths: false,
        separatorMode: 'newline',
    })
        .map((entry) => ({
        tag: entry.tag,
        noPlatform,
        noGit: false,
        pathHint: entry.savePath,
        saveExpected: true,
    }));
    const resolvedEntryTags = resolveVerificationTags(entrySpecs, workingDirectory);
    const pathHintsByResolvedTag = new Map();
    resolvedEntryTags.forEach((resolvedTag, index) => {
        const pathHint = entrySpecs[index]?.pathHint;
        if (pathHint) {
            pathHintsByResolvedTag.set(resolvedTag, pathHint);
        }
    });
    return verifySaveTags.map((tag) => ({
        tag,
        noPlatform: true,
        noGit: true,
        pathHint: pathHintsByResolvedTag.get(tag),
        saveExpected: true,
    }));
}
async function emitPostStepDiagnostics(inputs, resolvedMode, workingDirectory, genericWorkspace, genericEntries, verifyMode, verifySaveTags, trustState, saveStatus) {
    const diagnostics = loadDiagnosticsConfig(inputs);
    const proxyLogPath = core.getState('proxy-log-path') || core.getState('mode-proxy-log-path');
    writeActionEvidence('post', {
        phase_status: 'completed',
        phase_summary: postPhaseSummary(saveStatus, trustState),
        resolved_mode: resolvedMode || '',
        working_directory: workingDirectory || process.cwd(),
        workspace: genericWorkspace || '',
        generic_entries: genericEntries || '',
        verify_mode: verifyMode,
        verify_save_tags: verifySaveTags,
        trust_state: trustState,
        diagnostics_level: diagnostics.level,
        save_status: saveStatus,
        proxy_log_path: proxyLogPath || '',
    });
    await runDiagnosticsGroup(diagnostics, 'BoringCache Post-Step Diagnostics', async () => {
        core.info(`resolved-mode: ${resolvedMode || '(none)'}`);
        core.info(`working-directory: ${workingDirectory || process.cwd()}`);
        core.info(`workspace: ${genericWorkspace || '(none)'}`);
        core.info(`generic-entries: ${genericEntries || '(none)'}`);
        core.info(`verify-mode: ${verifyMode}`);
        core.info(`verify-save-tags: ${verifySaveTags.join(',') || '(none)'}`);
        core.info(`trust-state: status=${trustState.status} event=${trustState.event_name || '(none)'} save-policy=${trustState.save_policy} save-on-pull-request=${String(trustState.save_on_pull_request)}`);
        if (diagnostics.includeLogs) {
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
export async function run() {
    const originalCwd = process.cwd();
    let postFailureContext = {};
    let strictPostFailure = false;
    try {
        const inputs = getInputs();
        strictPostFailure = inputs.failOnCacheError;
        const cliVersion = core.getState('cli-version') || inputs.cliVersion;
        let cliCapabilityVersion = core.getState('cli-capability-version');
        const cliPlatform = core.getState('cli-platform') || inputs.cliPlatform || undefined;
        let resolvedMode = core.getState('resolved-mode');
        let workingDirectory = core.getState('working-directory');
        let genericEntries = core.getState('generic-cache-entries');
        let genericWorkspace = core.getState('generic-cache-workspace');
        let excludes = parseSavedExcludes(core.getState('generic-cache-excludes'), core.getState('generic-cache-exclude'));
        let noPlatform = core.getState('no-platform') === 'true';
        let enableCrossOsArchive = core.getState('enableCrossOsArchive') === 'true';
        let force = core.getState('force') === 'true';
        let verbose = core.getState('verbose') === 'true';
        const verifyMode = (core.getState('verify-mode') || inputs.verify);
        strictPostFailure ||= verifyMode === 'check';
        const verifyTimeoutSeconds = normalizeVerifyTimeoutSeconds(core.getState('verify-timeout-seconds') || String(inputs.verifyTimeoutSeconds));
        const verifyRequireServerSignature = core.getState('verify-require-server-signature') === 'true' || inputs.verifyRequireServerSignature;
        const saveConfigured = readSavedSaveConfiguration(inputs, core.getState('save-configured'));
        const saveAllowed = readSavedSaveAllowance(inputs, core.getState('save-allowed'));
        const trustState = buildActionTrustState(inputs, {
            saveConfigured,
            saveAllowed,
        });
        let verifySaveTags = core.getState('verify-save-tags')
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean);
        let verifySaveSpecs = parseSavedVerificationSpecs(core.getState('verify-save-specs'));
        postFailureContext = {
            resolved_mode: resolvedMode || '',
            working_directory: workingDirectory || '',
            workspace: genericWorkspace || '',
            generic_entries: genericEntries || '',
            verify_mode: verifyMode,
            verify_save_tags: verifySaveTags,
            diagnostics_level: loadDiagnosticsConfig(inputs).level,
            trust_state: trustState,
        };
        if (saveAllowed && isPullRequestEvent() && inputs.saveOnPullRequest) {
            applyPullRequestSaveScopeEnv();
        }
        if (cliVersion.toLowerCase() !== 'skip') {
            await ensureBoringCache(buildCliSetupOptions(inputs, cliVersion, cliPlatform));
        }
        if (!cliCapabilityVersion) {
            cliCapabilityVersion = await resolveCliCapabilityVersion(cliVersion);
        }
        if (!resolvedMode || (!genericEntries && !genericWorkspace)) {
            const plan = await buildPlan({
                ...inputs,
                cliVersion: cliCapabilityVersion,
                readOnly: inputs.readOnly || !saveAllowed,
            });
            resolvedMode = plan.mode;
            if (!workingDirectory) {
                workingDirectory = plan.workingDirectory;
            }
            if (!genericWorkspace) {
                genericWorkspace = plan.workspace;
            }
            if (!genericEntries) {
                genericEntries = [plan.runtimeEntry, toSaveEntries(plan.archiveEntries)]
                    .filter(Boolean)
                    .join('\n');
            }
            excludes = plan.archiveExcludes;
            noPlatform = inputs.noPlatform;
            enableCrossOsArchive = inputs.enableCrossOsArchive;
            force = inputs.force;
            verbose = inputs.verbose;
        }
        postFailureContext = {
            ...postFailureContext,
            resolved_mode: resolvedMode || '',
            working_directory: workingDirectory || process.cwd(),
            workspace: genericWorkspace || '',
            generic_entries: genericEntries || '',
        };
        if (verifySaveSpecs.length === 0 && verifySaveTags.length > 0) {
            verifySaveSpecs = buildLegacyVerificationSpecs(verifySaveTags, genericEntries || '', workingDirectory || process.cwd(), enableCrossOsArchive || noPlatform);
        }
        if (workingDirectory) {
            process.chdir(workingDirectory);
        }
        if (!saveConfigured) {
            if (resolvedMode && resolvedMode !== 'archive') {
                await runModeSave(resolvedMode, { allowSaves: false });
            }
            if (genericEntries || (resolvedMode && resolvedMode !== 'archive')) {
                core.info(saveSkippedByConfigurationMessage());
            }
            await emitPostStepDiagnostics(inputs, resolvedMode, workingDirectory || process.cwd(), genericWorkspace, genericEntries, verifyMode, verifySaveTags, trustState, resolvedMode && resolvedMode !== 'archive' ? 'mode_post_skipped_configuration' : 'skipped_configuration');
            return;
        }
        if (!saveAllowed) {
            if (resolvedMode && resolvedMode !== 'archive') {
                await runModeSave(resolvedMode, { allowSaves: false });
            }
            if (genericEntries || (resolvedMode && resolvedMode !== 'archive')) {
                core.notice(saveSkippedByPolicyMessage());
            }
            await emitPostStepDiagnostics(inputs, resolvedMode, workingDirectory || process.cwd(), genericWorkspace, genericEntries, verifyMode, verifySaveTags, trustState, resolvedMode && resolvedMode !== 'archive' ? 'mode_post_skipped_policy' : 'skipped_policy');
            return;
        }
        if (!hasSaveToken()) {
            if (resolvedMode && resolvedMode !== 'archive') {
                await runModeSave(resolvedMode, { allowSaves: false });
            }
            if (genericEntries || (resolvedMode && resolvedMode !== 'archive')) {
                core.notice(`Save skipped: ${missingSaveTokenMessage()}`);
            }
            await emitPostStepDiagnostics(inputs, resolvedMode, workingDirectory || process.cwd(), genericWorkspace, genericEntries, verifyMode, verifySaveTags, trustState, resolvedMode && resolvedMode !== 'archive' ? 'mode_post_missing_save_token' : 'skipped_missing_save_token');
            return;
        }
        if (resolvedMode && resolvedMode !== 'archive') {
            await runModeSave(resolvedMode);
            const skippedModeVerifyTags = parseSavedTagList(core.getState('mode-skipped-verify-tags'));
            if (skippedModeVerifyTags.size > 0) {
                verifySaveTags = verifySaveTags.filter((tag) => !skippedModeVerifyTags.has(tag));
                verifySaveSpecs = verifySaveSpecs.filter((spec) => !skippedModeVerifyTags.has(spec.tag));
            }
        }
        if (!genericEntries || !genericWorkspace) {
            if (verifyMode !== 'none' && verifySaveSpecs.length > 0 && genericWorkspace) {
                await verifyVerificationSpecs(genericWorkspace, verifySaveSpecs, {
                    mode: verifyMode,
                    timeoutSeconds: verifyTimeoutSeconds,
                    requireServerSignature: verifyRequireServerSignature,
                    verbose,
                    acceptPendingSaveExpected: true,
                });
            }
            await emitPostStepDiagnostics(inputs, resolvedMode, workingDirectory || process.cwd(), genericWorkspace, genericEntries, verifyMode, verifySaveTags, trustState, resolvedMode && resolvedMode !== 'archive' ? 'mode_post_no_generic_save' : 'no_generic_save');
            return;
        }
        const saveEntries = parseEntries(genericEntries, 'save', {
            resolvePaths: false,
            separatorMode: 'newline',
        })
            .map((entry) => `${entry.tag}:${entry.savePath}`);
        const portableArchiveArgs = supportsPortableArchiveArgs(cliCapabilityVersion);
        if (enableCrossOsArchive) {
            assertCrossOsArchiveTransportSupported(cliCapabilityVersion);
        }
        const args = ['save', genericWorkspace];
        if (portableArchiveArgs) {
            for (const entry of saveEntries) {
                args.push('--entry', entry);
            }
        }
        else {
            assertLegacyArchiveEntriesAreLossless(saveEntries, 'save');
            args.push(saveEntries.join(','));
        }
        if (force) {
            args.push('--force');
        }
        if (enableCrossOsArchive || noPlatform) {
            args.push('--no-platform');
        }
        if (enableCrossOsArchive) {
            args.push('--archive-transport');
        }
        if (verbose) {
            args.push('--verbose');
        }
        appendSaveExcludeArgs(args, excludes, cliCapabilityVersion);
        if (inputs.failOnCacheError) {
            args.push('--fail-on-cache-error');
        }
        if (inputs.allowExternalSymlinks) {
            assertExternalSymlinkRoundTripSupported(cliCapabilityVersion);
            args.push('--allow-external-symlinks');
        }
        await execBoringCache(args);
        const verifiableSaveSpecs = filterVerifiableSpecs(verifySaveSpecs);
        if (verifyMode !== 'none' && verifiableSaveSpecs.length > 0) {
            await verifyVerificationSpecs(genericWorkspace, verifiableSaveSpecs, {
                mode: verifyMode,
                timeoutSeconds: verifyTimeoutSeconds,
                requireServerSignature: verifyRequireServerSignature,
                verbose,
                acceptPendingSaveExpected: true,
            });
        }
        await emitPostStepDiagnostics(inputs, resolvedMode, workingDirectory || process.cwd(), genericWorkspace, genericEntries, verifyMode, verifySaveTags, trustState, resolvedMode && resolvedMode !== 'archive' ? 'mode_post_and_generic_save' : 'saved');
    }
    catch (error) {
        writeActionFailureEvidence('post', error, postFailureContext);
        const message = `boringcache/one save failed: ${actionErrorMessage(error)}`;
        if (strictPostFailure) {
            core.setFailed(message);
        }
        else {
            core.warning(`${message}. The build remains successful because fail-on-cache-error is false.`);
        }
    }
    finally {
        process.chdir(originalCwd);
    }
}
