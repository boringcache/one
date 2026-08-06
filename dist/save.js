import * as core from '@actions/core';
import * as fs from 'fs';
import { hasStageToken, hasSaveToken, missingStageTokenMessage, missingSaveTokenMessage, } from './core';
import { actionErrorMessage, buildActionTrustState, buildPlan, ensureBoringCache, ensureXcodePlugin, execBoringCache, getInputs, applyTrustTokenPolicy, loadDiagnosticsConfig, readLogTail, normalizeTrustPolicy, resolveCliCapabilityVersion, resolveTrustPolicy, resolveVerificationTags, runDiagnosticsGroup, normalizeVerifyTimeoutSeconds, parseEntries, postPhaseSummary, prepareCandidateReceiptFile, publishCandidateOutputs, verifyVerificationSpecs, writeActionEvidence, writeActionFailureEvidence, useCandidateReceiptFile, } from './utils';
import { runModeSave } from './mode-handlers';
function toSaveEntries(entriesString) {
    if (!entriesString.trim()) {
        return '';
    }
    return parseEntries(entriesString, 'restore', {
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
            includePrTag: spec.includePrTag,
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
function readXcodeEvidence(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
        return null;
    }
    try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile() || stat.size > 1024 * 1024) {
            core.warning(`Ignoring invalid Xcode evidence file: ${filePath}`);
            return null;
        }
        const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return value && typeof value === 'object' && !Array.isArray(value)
            ? value
            : null;
    }
    catch (error) {
        core.warning(`Unable to read Xcode evidence from ${filePath}: ${error instanceof Error ? error.message : error}`);
        return null;
    }
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
    const candidateReceiptFile = core.getState('candidate-receipt-file');
    const stagedCandidates = publishCandidateOutputs(candidateReceiptFile);
    const xcodeEvidencePath = core.getState('mode-xcode-evidence-json');
    const xcodeEvidence = readXcodeEvidence(xcodeEvidencePath);
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
        staged_candidates: stagedCandidates,
        xcode_evidence_path: xcodeEvidencePath || '',
        xcode_evidence: xcodeEvidence || {},
    });
    await runDiagnosticsGroup(diagnostics, 'BoringCache Post-Step Diagnostics', async () => {
        core.info(`resolved-mode: ${resolvedMode || '(none)'}`);
        core.info(`working-directory: ${workingDirectory || process.cwd()}`);
        core.info(`workspace: ${genericWorkspace || '(none)'}`);
        core.info(`generic-entries: ${genericEntries || '(none)'}`);
        core.info(`verify-mode: ${verifyMode}`);
        core.info(`verify-save-tags: ${verifySaveTags.join(',') || '(none)'}`);
        core.info(`trust-state: status=${trustState.status} event=${trustState.event_name || '(none)'} requested=${trustState.requested_policy} resolved=${trustState.resolved_policy}`);
        core.info(`staged-candidates: ${stagedCandidates.map((candidate) => candidate.id).join(',') || '(none)'}`);
        if (xcodeEvidence) {
            core.info(`xcode-evidence: ${JSON.stringify(xcodeEvidence)}`);
        }
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
        let force = core.getState('force') === 'true';
        let verbose = core.getState('verbose') === 'true';
        const verifyMode = (core.getState('verify-mode') || inputs.verify);
        strictPostFailure ||= verifyMode === 'check';
        const verifyTimeoutSeconds = normalizeVerifyTimeoutSeconds(core.getState('verify-timeout-seconds') || String(inputs.verifyTimeoutSeconds));
        const verifyRequireServerSignature = core.getState('verify-require-server-signature') === 'true' || inputs.verifyRequireServerSignature;
        const requestedTrustPolicy = normalizeTrustPolicy(core.getState('trust-policy') || inputs.trustPolicy);
        const savedResolvedPolicy = core.getState('resolved-trust-policy');
        const savedTrustStatus = core.getState('trust-status');
        const fallbackResolution = resolveTrustPolicy(requestedTrustPolicy);
        const resolvedTrustPolicy = savedResolvedPolicy === 'restore'
            || savedResolvedPolicy === 'stage'
            || savedResolvedPolicy === 'publish'
            ? savedResolvedPolicy
            : fallbackResolution.resolved;
        applyTrustTokenPolicy(resolvedTrustPolicy);
        const trustState = buildActionTrustState(requestedTrustPolicy, resolvedTrustPolicy, (savedTrustStatus || fallbackResolution.status));
        if (resolvedMode === 'cargo') {
            core.info('Post step skipped: mode cargo completed its synchronous CLI lifecycle in the main Action step.');
            return;
        }
        let candidateReceiptFile = core.getState('candidate-receipt-file');
        if (resolvedTrustPolicy === 'stage' && !candidateReceiptFile) {
            candidateReceiptFile = prepareCandidateReceiptFile();
            core.saveState('candidate-receipt-file', candidateReceiptFile);
        }
        useCandidateReceiptFile(candidateReceiptFile);
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
        if (cliVersion.toLowerCase() !== 'skip') {
            await ensureBoringCache(buildCliSetupOptions(inputs, cliVersion, cliPlatform));
        }
        if ((resolvedMode || inputs.mode).trim().toLowerCase() === 'xcode') {
            await ensureXcodePlugin(cliVersion);
        }
        if (!cliCapabilityVersion) {
            cliCapabilityVersion = await resolveCliCapabilityVersion(cliVersion);
        }
        if (!resolvedMode || (!genericEntries && !genericWorkspace)) {
            const plan = await buildPlan({
                ...inputs,
                cliVersion: cliCapabilityVersion,
                readOnly: resolvedTrustPolicy === 'restore',
                stage: resolvedTrustPolicy === 'stage',
            });
            resolvedMode = plan.mode;
            if (!workingDirectory) {
                workingDirectory = plan.workingDirectory;
            }
            if (!genericWorkspace) {
                genericWorkspace = plan.workspace;
            }
            if (!genericEntries) {
                genericEntries = toSaveEntries(plan.archiveEntries);
            }
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
            verifySaveSpecs = buildLegacyVerificationSpecs(verifySaveTags, genericEntries || '', workingDirectory || process.cwd(), false);
        }
        if (workingDirectory) {
            process.chdir(workingDirectory);
        }
        if (resolvedTrustPolicy === 'restore') {
            if (resolvedMode && resolvedMode !== 'archive') {
                await runModeSave(resolvedMode, { allowSaves: false });
            }
            if (genericEntries || (resolvedMode && resolvedMode !== 'archive')) {
                core.info(`Save skipped: trust-policy ${requestedTrustPolicy} resolved to restore.`);
            }
            await emitPostStepDiagnostics(inputs, resolvedMode, workingDirectory || process.cwd(), genericWorkspace, genericEntries, verifyMode, verifySaveTags, trustState, resolvedMode && resolvedMode !== 'archive' ? 'mode_post_restore_only' : 'restore_only');
            return;
        }
        const requiredTokenPresent = resolvedTrustPolicy === 'stage' ? hasStageToken() : hasSaveToken();
        if (!requiredTokenPresent) {
            if (resolvedMode && resolvedMode !== 'archive') {
                await runModeSave(resolvedMode, { allowSaves: false });
            }
            if (genericEntries || (resolvedMode && resolvedMode !== 'archive')) {
                core.notice(`Save skipped: ${resolvedTrustPolicy === 'stage' ? missingStageTokenMessage() : missingSaveTokenMessage()}`);
            }
            await emitPostStepDiagnostics(inputs, resolvedMode, workingDirectory || process.cwd(), genericWorkspace, genericEntries, verifyMode, verifySaveTags, trustState, resolvedMode && resolvedMode !== 'archive' ? 'mode_post_missing_token' : 'skipped_missing_token');
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
            await emitPostStepDiagnostics(inputs, resolvedMode, workingDirectory || process.cwd(), genericWorkspace, genericEntries, verifyMode, verifySaveTags, trustState, resolvedTrustPolicy === 'stage' && resolvedMode && resolvedMode !== 'archive'
                ? 'mode_post_staged'
                : resolvedMode && resolvedMode !== 'archive'
                    ? 'mode_post_no_generic_save'
                    : 'no_generic_save');
            return;
        }
        const saveEntries = parseEntries(genericEntries, 'save', {
            separatorMode: 'newline',
        })
            .map((entry) => `${entry.tag}:${entry.savePath}`);
        const args = ['save', genericWorkspace];
        for (const entry of saveEntries) {
            args.push('--entry', entry);
        }
        if (force) {
            args.push('--force');
        }
        if (resolvedTrustPolicy === 'stage') {
            args.push('--stage');
        }
        if (verbose) {
            args.push('--verbose');
        }
        if (inputs.failOnCacheError) {
            args.push('--fail-on-cache-error');
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
        await emitPostStepDiagnostics(inputs, resolvedMode, workingDirectory || process.cwd(), genericWorkspace, genericEntries, verifyMode, verifySaveTags, trustState, resolvedTrustPolicy === 'stage'
            ? resolvedMode && resolvedMode !== 'archive'
                ? 'mode_post_and_generic_stage'
                : 'staged'
            : resolvedMode && resolvedMode !== 'archive'
                ? 'mode_post_and_generic_save'
                : 'saved');
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
