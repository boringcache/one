import { routineInfo } from '../core/diagnostics';
import * as core from '@actions/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { hasSaveCredential, missingSaveTokenMessage, startRegistryProxy, stopRegistryProxy, } from '../core';
import { compilerCacheModeState, finishCompilerCacheSave, sccacheServerLifecycle, sccacheStatsDetail, stopSccacheServer, } from './compiler-cache';
import { actionProxyOptions, adapterVerificationSpecs, appendCliPublicationPolicy, checkDirectCacheTagStatus, plannedCacheCheck, plannedCacheHit, plannedProxyEnv, emptyDirectCacheTagCheckStatus, execBoringCache, exportEnvVars, readBoundedJsonObject, getModeState, planningReadOnly, resolveAdapterCliPlan, resolvePreferredPort, saveModeState, saveProxyModeState, setProxyOutputs, stopProxyFromState, } from './shared';
const CARGO_FAILED_START_PROXY_STOP_TIMEOUT_MS = 10_000;
const CARGO_LIFECYCLE_ENV = 'BORINGCACHE_CARGO_LIFECYCLE';
function phaseEvidencePath(phase) {
    return path.join(os.tmpdir(), `boringcache-one-cargo-${phase}-${process.pid}.json`);
}
function readPhaseEvidence(file) {
    const document = readBoundedJsonObject(file);
    fs.rmSync(file, { force: true });
    return document;
}
function seconds(milliseconds) {
    return typeof milliseconds === 'number' ? Math.round(milliseconds / 100) / 10 : null;
}
function setPhaseOutputs(phase, evidence) {
    if (!evidence) {
        return;
    }
    const duration = seconds(evidence.phase_duration_ms);
    if (duration !== null) {
        core.setOutput(`${phase}-duration-seconds`, String(duration));
    }
    if (typeof evidence.transferred_bytes === 'number') {
        core.setOutput(`${phase}-transferred-bytes`, String(evidence.transferred_bytes));
    }
    if (phase === 'publish' && typeof evidence.logical_bytes === 'number') {
        core.setOutput('publish-logical-bytes', String(evidence.logical_bytes));
    }
    const archiveSeconds = seconds(evidence.archive_duration_ms);
    if (phase === 'publish' && archiveSeconds !== null) {
        core.setOutput('snapshot-duration-seconds', String(archiveSeconds));
    }
}
export function cargoArchiveVerificationSpecs(cargoPlan, _workingDirectory) {
    return adapterVerificationSpecs(cargoPlan);
}
export function cargoCompilerCacheEnabled(cargoPlan) {
    // Compatible older CLIs predate the explicit layer field and always compose
    // sccache, so a missing value preserves their released behavior.
    return cargoPlan.cargo_cache?.compiler_cache !== 'none';
}
export function cargoCompilerCacheTag(cargoPlan) {
    // Older CLIs exposed only the adapter-level tag. Prefer the explicit layer
    // identity while preserving their released dry-run contract.
    return cargoPlan.cargo_cache?.compiler_cache_tag || cargoPlan.tag;
}
export async function runCargoRestore(plan, inputs) {
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const cargoPlan = await resolveAdapterCliPlan('cargo', plan.workspace, plan.workingDirectory, '', requestedPort, planningReadOnly(inputs), {});
    const wrappedCommand = cargoPlan.command || [];
    const jobLifecycle = wrappedCommand.length === 0;
    const targetEntry = (cargoPlan.archive_entries || []).find((entry) => entry.kind === 'cargo-target' || entry.requested === 'cargo-target');
    const compilerCacheEnabled = cargoCompilerCacheEnabled(cargoPlan);
    const compilerCacheTag = cargoCompilerCacheTag(cargoPlan);
    const [targetPreflight, compilerPreflight] = await Promise.all([
        targetEntry
            ? checkDirectCacheTagStatus(plannedCacheCheck(cargoPlan, targetEntry.resolved_tag || targetEntry.tag))
            : emptyDirectCacheTagCheckStatus(),
        compilerCacheEnabled
            ? checkDirectCacheTagStatus(plannedCacheCheck(cargoPlan, compilerCacheTag))
            : emptyDirectCacheTagCheckStatus(),
    ]);
    const cacheHit = plannedCacheHit(cargoPlan, {
        [targetEntry?.resolved_tag || targetEntry?.tag || '']: targetPreflight,
        [compilerCacheTag]: compilerPreflight,
    });
    const cacheTag = targetEntry?.tag || (compilerCacheEnabled ? compilerCacheTag : '');
    if (inputs.failOnCacheMiss && !inputs.lookupOnly) {
        throw new Error('mode=cargo does not support fail-on-cache-miss while restoring yet; '
            + 'the CLI adapter does not expose that lifecycle hook. Use lookup-only for a preflight check.');
    }
    if (inputs.lookupOnly && inputs.failOnCacheMiss && !cacheHit) {
        throw new Error(`Cargo cache miss for ${cacheTag || 'the CLI-owned Cargo layers'}`);
    }
    const verificationSpecs = cargoArchiveVerificationSpecs(cargoPlan, plan.workingDirectory);
    const resolvedEntries = (cargoPlan.archive_entries || [])
        .map((entry) => entry.tag_path_pair)
        .join('\n');
    if (inputs.lookupOnly) {
        return {
            workspace: cargoPlan.workspace,
            cacheHit,
            cacheTag,
            resolvedEntries,
            verificationSpecs,
            evidence: {
                command_executed: false,
                lookup_only: true,
                target_cache_available: targetPreflight.cacheEntryHit,
                compiler_cache_available: compilerPreflight.kvHit,
                cargo_cache: cargoPlan.cargo_cache,
                archive_entries: cargoPlan.archive_entries || [],
            },
        };
    }
    if (!jobLifecycle) {
        return runWrappedCargoCommand({
            plan,
            inputs,
            cargoPlan,
            command: wrappedCommand,
            compilerCacheEnabled,
            cacheTag,
            resolvedEntries,
            verificationSpecs,
            targetPreflight,
            compilerPreflight,
        });
    }
    if (process.env[CARGO_LIFECYCLE_ENV] === 'active') {
        throw new Error('mode: cargo already started a Cargo cache lifecycle in this job. It now restores before the '
            + "job's Cargo steps and publishes in the post step, so one step covers all of them. Remove the "
            + 'extra mode: cargo step.');
    }
    const restoreEvidenceFile = phaseEvidencePath('restore');
    const restoreArgs = [
        'cargo',
        '--workspace',
        cargoPlan.workspace,
        '--port',
        String(cargoPlan.proxy.port),
        '--phase',
        'restore',
        '--phase-evidence-json',
        restoreEvidenceFile,
    ];
    appendCliPublicationPolicy(restoreArgs, cargoPlan.proxy.read_only);
    if (inputs.failOnCacheError) {
        restoreArgs.push('--fail-on-cache-error');
    }
    const startedAt = Date.now();
    const restoreExitCode = await execBoringCache(restoreArgs, {
        cwd: plan.workingDirectory,
        ignoreReturnCode: true,
    });
    if (restoreExitCode !== 0) {
        fs.rmSync(restoreEvidenceFile, { force: true });
        throw new Error(`boringcache cargo restore phase exited with code ${restoreExitCode}`);
    }
    const restoreEvidence = readPhaseEvidence(restoreEvidenceFile);
    const targetRestore = restoreEvidence?.target_restore || 'unknown';
    core.setOutput('target-restore', targetRestore);
    setPhaseOutputs('restore', restoreEvidence);
    let proxyPort = cargoPlan.proxy.port;
    if (compilerCacheEnabled) {
        const proxy = await startRegistryProxy(actionProxyOptions({
            command: 'cache-registry',
            workspace: cargoPlan.workspace,
            tag: compilerCacheTag,
            host: cargoPlan.proxy.host || '127.0.0.1',
            port: cargoPlan.proxy.port,
            verbose: inputs.verbose,
            readOnly: cargoPlan.proxy.read_only,
        }, cargoPlan.proxy, inputs.failOnCacheError));
        proxyPort = proxy.port;
        exportEnvVars(plannedProxyEnv(cargoPlan, proxy.port));
        try {
            await sccacheServerLifecycle.start();
        }
        catch (error) {
            try {
                await stopRegistryProxy(proxy.pid, proxy.port, CARGO_FAILED_START_PROXY_STOP_TIMEOUT_MS);
            }
            catch (cleanupError) {
                const detail = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
                core.warning(`sccache startup failed and the BoringCache proxy could not be stopped cleanly: ${detail}`);
            }
            throw error;
        }
        saveModeState('proxy-pid', String(proxy.pid));
        saveProxyModeState(proxy);
        setProxyOutputs(proxy.port);
    }
    else {
        exportEnvVars(cargoPlan.env_vars || {});
    }
    exportEnvVars({ [CARGO_LIFECYCLE_ENV]: 'active' });
    saveModeState('cargo-lifecycle', 'job');
    saveModeState('workspace', cargoPlan.workspace);
    saveModeState('cargo-working-directory', plan.workingDirectory);
    saveModeState('cargo-read-only', String(cargoPlan.proxy.read_only));
    saveModeState('cargo-fail-on-cache-error', String(inputs.failOnCacheError));
    saveModeState('cargo-compiler-cache', String(compilerCacheEnabled));
    if (compilerCacheEnabled) {
        saveModeState('sccache-check-args', JSON.stringify(plannedCacheCheck(cargoPlan, compilerCacheTag)));
    }
    saveModeState('sccache-tag', compilerCacheTag);
    saveModeState('sccache-preflight-cache-entry-hit', String(compilerPreflight.cacheEntryHit));
    saveModeState('sccache-preflight-kv-hit', String(compilerPreflight.kvHit));
    saveModeState('sccache-preflight-kv-checked', String(compilerPreflight.kvChecked));
    return {
        workspace: cargoPlan.workspace,
        cacheHit: restoreEvidence?.cache_hit,
        cacheTag,
        resolvedEntries,
        verificationSpecs,
        evidence: {
            command_executed: false,
            lifecycle: 'job',
            restore_elapsed_seconds: Math.round((Date.now() - startedAt) / 100) / 10,
            restore_phase: restoreEvidence,
            proxy_port: proxyPort,
            target_cache_available: targetPreflight.cacheEntryHit,
            compiler_cache_available: compilerPreflight.kvHit,
            target_restore: targetRestore,
            cargo_reuse: null,
            cargo_cache: cargoPlan.cargo_cache,
            archive_entries: cargoPlan.archive_entries || [],
        },
    };
}
export async function runCargoSave(options = {}) {
    if (getModeState('cargo-lifecycle') !== 'job') {
        return;
    }
    const workspace = getModeState('workspace');
    const workingDirectory = getModeState('cargo-working-directory') || '.';
    const compilerCacheEnabled = getModeState('cargo-compiler-cache') === 'true';
    const readOnly = getModeState('cargo-read-only') === 'true';
    const failOnCacheError = getModeState('cargo-fail-on-cache-error') === 'true';
    const sccacheStats = compilerCacheEnabled ? await stopSccacheServer() : null;
    const sccacheStatsDetailText = compilerCacheEnabled ? sccacheStatsDetail(sccacheStats) : '';
    let publishFailure = null;
    let compilerFailure = null;
    const saveEvidenceFile = phaseEvidencePath('save');
    try {
        if (workingDirectory !== '.' && !fs.existsSync(workingDirectory)) {
            core.notice(`Cargo publish skipped: ${workingDirectory} no longer exists.`);
        }
        else if (workspace && options.allowSaves !== false && !readOnly) {
            if (hasSaveCredential()) {
                const saveArgs = [
                    'cargo',
                    '--workspace',
                    workspace,
                    '--phase',
                    'save',
                    '--phase-evidence-json',
                    saveEvidenceFile,
                ];
                appendCliPublicationPolicy(saveArgs, readOnly);
                if (failOnCacheError) {
                    saveArgs.push('--fail-on-cache-error');
                }
                const saveExitCode = await execBoringCache(saveArgs, {
                    cwd: workingDirectory,
                    ignoreReturnCode: true,
                });
                if (saveExitCode !== 0) {
                    const detail = `boringcache cargo publish phase exited with code ${saveExitCode}`;
                    if (failOnCacheError) {
                        throw new Error(detail);
                    }
                    core.warning(detail);
                }
            }
            else {
                core.notice(`Save skipped: ${missingSaveTokenMessage()}`);
            }
        }
    }
    catch (error) {
        publishFailure = error;
    }
    const publishEvidence = readPhaseEvidence(saveEvidenceFile);
    setPhaseOutputs('publish', publishEvidence);
    if (publishEvidence) {
        const changed = publishEvidence.unchanged
            ? 'unchanged, nothing republished'
            : `${publishEvidence.transferred_bytes ?? 0} changed bytes`;
        routineInfo(`Cargo publish phase: ${seconds(publishEvidence.phase_duration_ms) ?? '?'}s, `
            + `${publishEvidence.entry_count ?? 0} entries, ${changed}.`);
    }
    await stopProxyFromState();
    if (compilerCacheEnabled) {
        const state = compilerCacheModeState('sccache');
        try {
            await finishCompilerCacheSave('sccache', state, sccacheStats, sccacheStatsDetailText, options);
        }
        catch (error) {
            compilerFailure = error instanceof Error ? error : new Error(String(error));
        }
        if (failOnCacheError && !compilerFailure) {
            compilerFailure = nativeCompilerCacheFailure(sccacheStats, readOnly);
        }
    }
    if (publishFailure) {
        throw publishFailure;
    }
    if (compilerFailure) {
        throw compilerFailure;
    }
}
function nativeCompilerCacheFailure(stats, readOnly) {
    if (!stats) {
        return null;
    }
    const failures = [];
    if (stats.cacheReadErrors) {
        failures.push(`cache_read_errors=${stats.cacheReadErrors}`);
    }
    if (stats.cacheTimeouts) {
        failures.push(`cache_timeouts=${stats.cacheTimeouts}`);
    }
    if (!readOnly && stats.cacheWriteErrors) {
        failures.push(`cache_write_errors=${stats.cacheWriteErrors}`);
    }
    if (!failures.length) {
        return null;
    }
    return new Error(`sccache evidence reported ${failures.join(', ')}`);
}
async function runWrappedCargoCommand(input) {
    const { cargoPlan, inputs, plan } = input;
    const nativeEvidencePath = input.compilerCacheEnabled
        ? path.join(os.tmpdir(), `boringcache-one-cargo-native-${process.pid}-${Date.now()}.json`)
        : '';
    const args = ['cargo', '--workspace', cargoPlan.workspace, '--port', String(cargoPlan.proxy.port)];
    appendCliPublicationPolicy(args, cargoPlan.proxy.read_only);
    if (inputs.failOnCacheError) {
        args.push('--fail-on-cache-error');
    }
    if (nativeEvidencePath) {
        args.push('--native-tool-evidence-json', nativeEvidencePath);
    }
    const restoreEvidencePath = cargoPlan.cargo_cache?.wrapped_restore_evidence === true
        ? phaseEvidencePath('restore')
        : '';
    if (restoreEvidencePath) {
        args.push('--phase-evidence-json', restoreEvidencePath);
    }
    const startedAt = Date.now();
    let nativeToolEvidence = null;
    let restoreEvidence = null;
    try {
        const exitCode = await execBoringCache(args, {
            cwd: plan.workingDirectory,
            ignoreReturnCode: true,
        });
        if (exitCode !== 0) {
            throw new Error(`boringcache cargo exited with code ${exitCode}`);
        }
        nativeToolEvidence = nativeEvidencePath ? readBoundedJsonObject(nativeEvidencePath) : null;
        restoreEvidence = restoreEvidencePath ? readPhaseEvidence(restoreEvidencePath) : null;
    }
    finally {
        if (nativeEvidencePath) {
            fs.rmSync(nativeEvidencePath, { force: true });
        }
        if (restoreEvidencePath) {
            fs.rmSync(restoreEvidencePath, { force: true });
        }
    }
    const targetRestore = restoreEvidence?.target_restore || 'unknown';
    core.setOutput('target-restore', targetRestore);
    saveModeState('cargo-lifecycle', 'command');
    return {
        workspace: cargoPlan.workspace,
        cacheHit: restoreEvidence?.cache_hit,
        cacheTag: input.cacheTag,
        resolvedEntries: input.resolvedEntries,
        verificationSpecs: input.verificationSpecs,
        evidence: {
            command: input.command,
            elapsed_seconds: Math.round((Date.now() - startedAt) / 100) / 10,
            native_tool: nativeToolEvidence,
            command_executed: true,
            lifecycle: 'command',
            target_cache_available: input.targetPreflight.cacheEntryHit,
            compiler_cache_available: input.compilerPreflight.kvHit,
            target_restore: targetRestore,
            restore_phase: restoreEvidence,
            cargo_reuse: null,
            cargo_cache: cargoPlan.cargo_cache,
            archive_entries: cargoPlan.archive_entries || [],
        },
    };
}
