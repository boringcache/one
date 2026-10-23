import { routineInfo } from './core/diagnostics';
import * as core from '@actions/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { archiveRunArgs } from './core/plan';
import { transferArtifact } from './core/artifacts';
import { startWorkloadIdentity, stopWorkloadIdentity } from './core/workload-identity';
import { applyTrustEnvPolicy, applyCliPlanEnv, actionEvidenceProductRefs, actionErrorMessage, buildActionTrustState, buildPlan, ensureBoringCache, ensureCiRunStartedAt, ensureXcodePlugin, execBoringCache, getActionState, getInputs, loadDiagnosticsConfig, SAVE_ALWAYS_ENVIRONMENT, prepareCandidateReceiptFile, publishCandidateOutputs, readLogTail, resolveCliCapabilityVersion, resolveTrustDecision, restorePhaseSummary, runDiagnosticsGroup, saveActionState, writeActionEvidence, writeActionFailureEvidence, } from './utils';
import { DockerBuildFailure, runModeRestore } from './mode-handlers';
import { readBoundedJsonObject } from './modes/shared';
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
async function restoreArchiveProfiles(plan, inputs) {
    if (!plan.archiveEntries.trim()) {
        return { hit: false, evaluated: false };
    }
    const evidenceFile = path.join(os.tmpdir(), `boringcache-one-archive-restore-${process.pid}.json`);
    fs.rmSync(evidenceFile, { force: true });
    const args = [
        ...archiveRunArgs(plan.archiveProfiles, inputs),
        '--phase', 'restore',
        '--phase-evidence-json', evidenceFile,
        '--fail-on-cache-error',
    ];
    if (inputs.lookupOnly) {
        args.push('--lookup-only');
    }
    if (inputs.failOnCacheMiss) {
        args.push('--fail-on-cache-miss');
    }
    if (inputs.verbose) {
        args.push('--verbose');
    }
    let stdout = '';
    let stderr = '';
    const exitCode = await execBoringCache(args, {
        cwd: plan.workingDirectory,
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
    const evidence = readBoundedJsonObject(evidenceFile);
    fs.rmSync(evidenceFile, { force: true });
    if (exitCode !== 0) {
        const detail = restoreFailureDetail(stdout, stderr, plan.archiveEntries.split('\n'));
        if (inputs.failOnCacheError || inputs.failOnCacheMiss) {
            throw new Error(detail);
        }
        core.warning(`Cache restore failed: ${detail}`);
        core.warning('Treating the failed restore as a cache miss.');
        return { hit: false, evaluated: true };
    }
    if (typeof evidence?.cache_hit !== 'boolean') {
        core.warning('boringcache run --phase restore reported no cache_hit; cache-hit is not evaluated.');
        return { hit: false, evaluated: false };
    }
    return { hit: evidence.cache_hit, evaluated: true };
}
export async function run() {
    const originalCwd = process.cwd();
    let restoreFailureContext = {};
    let failureOperation = 'restore';
    try {
        ensureCiRunStartedAt();
        if (core.getInput('mode').trim().toLowerCase() === 'artifact')
            failureOperation = 'artifact transfer';
        const inputs = getInputs();
        if (inputs.savePolicy === 'always') {
            core.exportVariable(SAVE_ALWAYS_ENVIRONMENT, 'true');
        }
        if (inputs.artifact) {
            failureOperation = `artifact ${inputs.artifact.command}`;
            process.chdir(inputs.workingDirectory);
        }
        restoreFailureContext = {
            diagnostics_level: loadDiagnosticsConfig(inputs).level,
        };
        const cliPlatform = inputs.cliPlatform || undefined;
        let installedCliVersion = inputs.cliVersion;
        if (inputs.cliVersion.toLowerCase() !== 'skip') {
            installedCliVersion = await ensureBoringCache(buildCliSetupOptions(inputs, cliPlatform))
                || inputs.cliVersion;
        }
        if (inputs.mode.trim().toLowerCase() === 'xcode') {
            await ensureXcodePlugin(installedCliVersion);
        }
        await startWorkloadIdentity();
        const trustDecision = await resolveTrustDecision(inputs.artifact?.command === 'pull' ? 'restore' : inputs.trustPolicy);
        applyTrustEnvPolicy(trustDecision);
        const trustState = buildActionTrustState(trustDecision);
        const effectiveInputs = {
            ...inputs,
            readOnly: trustDecision.resolved === 'restore',
            stage: trustDecision.resolved === 'stage',
        };
        if (inputs.artifact) {
            if (inputs.artifact.command === 'push' && !trustDecision.write_allowed) {
                throw new Error(`Artifact upload denied: ${trustDecision.detail}`);
            }
            saveActionState('resolved-mode', 'artifact');
            const evidence = await transferArtifact(inputs.artifact);
            writeActionEvidence('restore', {
                phase_status: 'completed',
                phase_summary: {
                    status: 'completed',
                    headline: inputs.artifact.command === 'push' ? 'Artifact uploaded' : 'Artifact downloaded',
                    detail: `Artifact ${evidence.artifact_id} is ready.`,
                    next_step: '',
                },
                mode: 'artifact',
                working_directory: inputs.workingDirectory,
                mode_evidence: evidence,
                trust_state: trustState,
            }, actionEvidenceProductRefs(inputs.cliVersion));
            return;
        }
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
        const archiveRestore = await restoreArchiveProfiles(plan, effectiveInputs);
        const modeRestore = await runModeRestore(plan, effectiveInputs);
        const completedPlan = {
            ...plan,
            workspace: modeRestore.workspace || plan.workspace,
        };
        if (!completedPlan.workspace) {
            throw new Error('The BoringCache CLI mode plan did not resolve a workspace. Set workspace in .boringcache.toml.');
        }
        const stagedCandidates = publishCandidateOutputs(candidateReceiptFile);
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
        saveActionState('generic-cache-entries', completedPlan.archiveEntries);
        saveActionState('archive-profiles', JSON.stringify(completedPlan.archiveProfiles));
        saveActionState('generic-cache-workspace', completedPlan.workspace);
        await emitRestoreDiagnostics(completedPlan, inputs, resolvedTags, overallHit, trustState);
        if (!trustDecision.write_allowed) {
            routineInfo(`Post step is restore-only (trust-policy: ${inputs.trustPolicy}).`);
        }
    }
    catch (error) {
        try {
            await stopWorkloadIdentity();
        }
        catch {
            core.warning('Unable to finish Machine connection cleanup after startup failed.');
        }
        writeActionFailureEvidence('restore', error, restoreFailureContext);
        if (error instanceof DockerBuildFailure)
            failureOperation = 'Docker build';
        core.setFailed(`boringcache/one ${failureOperation} failed: ${actionErrorMessage(error)}`);
    }
    finally {
        process.chdir(originalCwd);
    }
}
