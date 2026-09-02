import * as core from '@actions/core';
import * as fs from 'fs';
import { hasStageToken, hasSaveToken, missingStageTokenMessage, missingSaveTokenMessage, removeActionStateDocument, } from './core';
import { actionErrorMessage, buildActionTrustState, ensureBoringCache, execBoringCache, getActionState, getInputs, applyTrustEnvPolicy, loadDiagnosticsConfig, readLogTail, normalizeTrustPolicy, parseSavedTrustDecision, resolveCliCapabilityVersion, resolveTrustDecision, runDiagnosticsGroup, saveActionState, parseEntries, postPhaseSummary, prepareCandidateReceiptFile, publishCandidateOutputs, writeActionEvidence, writeActionFailureEvidence, useCandidateReceiptFile, } from './utils';
import { runModeSave } from './mode-handlers';
function buildCliSetupOptions(cliVersion, cliPlatform) {
    return {
        version: cliVersion,
        platform: cliPlatform,
    };
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
async function emitPostStepDiagnostics(inputs, resolvedMode, workingDirectory, genericWorkspace, genericEntries, trustState, saveStatus) {
    const diagnostics = loadDiagnosticsConfig(inputs);
    const proxyLogPath = getActionState('proxy-log-path') || getActionState('mode-proxy-log-path');
    const candidateReceiptFile = getActionState('candidate-receipt-file');
    const stagedCandidates = publishCandidateOutputs(candidateReceiptFile);
    const xcodeEvidencePath = getActionState('mode-xcode-evidence-json');
    const xcodeEvidence = readXcodeEvidence(xcodeEvidencePath);
    writeActionEvidence('post', {
        phase_status: 'completed',
        phase_summary: postPhaseSummary(saveStatus, trustState),
        resolved_mode: resolvedMode || '',
        working_directory: workingDirectory || process.cwd(),
        workspace: genericWorkspace || '',
        generic_entries: genericEntries || '',
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
        let resolvedMode = getActionState('resolved-mode');
        if (!resolvedMode) {
            core.info('Post step skipped: the main step did not create a lifecycle plan.');
            return;
        }
        const inputs = getInputs();
        strictPostFailure = inputs.failOnCacheError;
        const cliVersion = getActionState('cli-version');
        let cliCapabilityVersion = getActionState('cli-capability-version');
        const cliPlatform = getActionState('cli-platform') || inputs.cliPlatform || undefined;
        let workingDirectory = getActionState('working-directory');
        let genericEntries = getActionState('generic-cache-entries');
        let genericWorkspace = getActionState('generic-cache-workspace');
        const verbose = getActionState('verbose') === 'true';
        const requestedTrustPolicy = normalizeTrustPolicy(getActionState('trust-policy') || inputs.trustPolicy);
        const savedTrustDecision = getActionState('trust-decision');
        const trustDecision = savedTrustDecision
            ? parseSavedTrustDecision(savedTrustDecision, requestedTrustPolicy)
            : await resolveTrustDecision(requestedTrustPolicy);
        const resolvedTrustPolicy = trustDecision.resolved;
        applyTrustEnvPolicy(trustDecision);
        const trustState = buildActionTrustState(trustDecision);
        if (['cargo', 'docker', 'buildkit'].includes(resolvedMode)) {
            core.info(`Post step skipped: mode ${resolvedMode} completed its synchronous CLI lifecycle in the main Action step.`);
            return;
        }
        let candidateReceiptFile = getActionState('candidate-receipt-file');
        if (resolvedTrustPolicy === 'stage' && !candidateReceiptFile) {
            candidateReceiptFile = prepareCandidateReceiptFile();
            saveActionState('candidate-receipt-file', candidateReceiptFile);
        }
        useCandidateReceiptFile(candidateReceiptFile);
        postFailureContext = {
            resolved_mode: resolvedMode || '',
            working_directory: workingDirectory || '',
            workspace: genericWorkspace || '',
            generic_entries: genericEntries || '',
            diagnostics_level: loadDiagnosticsConfig(inputs).level,
            trust_state: trustState,
        };
        if (cliVersion.toLowerCase() !== 'skip') {
            await ensureBoringCache(buildCliSetupOptions(cliVersion, cliPlatform));
        }
        if (!cliCapabilityVersion) {
            cliCapabilityVersion = await resolveCliCapabilityVersion(cliVersion);
        }
        postFailureContext = {
            ...postFailureContext,
            resolved_mode: resolvedMode || '',
            working_directory: workingDirectory || process.cwd(),
            workspace: genericWorkspace || '',
            generic_entries: genericEntries || '',
        };
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
            await emitPostStepDiagnostics(inputs, resolvedMode, workingDirectory || process.cwd(), genericWorkspace, genericEntries, trustState, resolvedMode && resolvedMode !== 'archive' ? 'mode_post_restore_only' : 'restore_only');
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
            await emitPostStepDiagnostics(inputs, resolvedMode, workingDirectory || process.cwd(), genericWorkspace, genericEntries, trustState, resolvedMode && resolvedMode !== 'archive' ? 'mode_post_missing_token' : 'skipped_missing_token');
            return;
        }
        if (resolvedMode && resolvedMode !== 'archive') {
            await runModeSave(resolvedMode);
        }
        if (!genericEntries || !genericWorkspace) {
            await emitPostStepDiagnostics(inputs, resolvedMode, workingDirectory || process.cwd(), genericWorkspace, genericEntries, trustState, resolvedTrustPolicy === 'stage' && resolvedMode && resolvedMode !== 'archive'
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
        await emitPostStepDiagnostics(inputs, resolvedMode, workingDirectory || process.cwd(), genericWorkspace, genericEntries, trustState, resolvedTrustPolicy === 'stage'
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
        removeActionStateDocument();
    }
}
