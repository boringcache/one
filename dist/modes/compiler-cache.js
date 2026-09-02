import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { hasSaveToken, missingSaveTokenMessage, startRegistryProxy, } from '../core';
import { actionProxyOptions, adapterVerificationSpecs, checkDirectCacheProxyTagStatus, directCachePreflightEvidence, exportEnvVars, getModeState, markModeVerifyTagSkipped, proxyPlanningReadOnly, resolveAdapterCliPlan, resolvePreferredPort, rewritePlannedProxyPort, saveModeState, saveProxyModeState, setProxyOutputs, stopProxyFromState, } from './shared';
export async function startSccacheServer() {
    await exec.exec('sccache', ['--start-server'], { ignoreReturnCode: true });
}
export async function stopSccacheServer() {
    let output = '';
    try {
        await exec.exec('sccache', ['--show-stats'], {
            ignoreReturnCode: true,
            listeners: {
                stdout: (data) => {
                    const text = data.toString();
                    output += text;
                    process.stdout.write(text);
                },
                stderr: (data) => {
                    const text = data.toString();
                    output += text;
                    process.stderr.write(text);
                },
            },
        });
    }
    catch {
    }
    finally {
        try {
            await exec.exec('sccache', ['--stop-server'], { ignoreReturnCode: true });
        }
        catch {
        }
    }
    return summarizeSccacheStats(output);
}
export function parseSccacheIntegerStat(output, label) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = output.match(new RegExp(`^${escaped}\\s+(\\d+)$`, 'm'));
    return match ? Number.parseInt(match[1], 10) : null;
}
export function parseSccacheTextStat(output, label) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = output.match(new RegExp(`^${escaped}\\s+(.+)$`, 'm'));
    return match ? match[1].trim() : null;
}
export function summarizeSccacheStats(output) {
    if (!output.trim()) {
        return null;
    }
    const compileRequests = parseSccacheIntegerStat(output, 'Compile requests');
    const cacheHits = parseSccacheIntegerStat(output, 'Cache hits');
    const cacheMisses = parseSccacheIntegerStat(output, 'Cache misses');
    if (compileRequests === null || cacheHits === null || cacheMisses === null) {
        return null;
    }
    return {
        compileRequests,
        cacheHits,
        cacheMisses,
        rustHitRate: parseSccacheTextStat(output, 'Cache hits rate (Rust)'),
    };
}
export const CCACHE_NON_CACHEABLE_COUNTERS = [
    'autoconf_test',
    'bad_compiler_arguments',
    'called_for_link',
    'called_for_preprocessing',
    'compile_failed',
    'compiler_check_failed',
    'compiler_produced_no_output',
    'compiler_produced_stdout',
    'could_not_find_compiler',
    'could_not_use_modules',
    'could_not_use_precompiled_header',
    'disabled',
    'error_hashing_extra_file',
    'internal_error',
    'missing_cache_file',
    'missing_input_file',
    'modified_input_file',
    'multiple_source_files',
    'no_input_file',
    'output_to_stdout',
    'preprocessor_error',
    'recache',
    'unsupported_code_directive',
    'unsupported_compiler_option',
    'unsupported_environment_variable',
];
export function summarizeCcacheStats(output) {
    if (!output.trim()) {
        return null;
    }
    try {
        const counters = JSON.parse(output);
        const counter = (name) => {
            const value = counters[name];
            return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
        };
        const cacheHits = counter('direct_cache_hit') + counter('preprocessed_cache_hit');
        const cacheMisses = counter('cache_miss');
        const nonCacheableCalls = CCACHE_NON_CACHEABLE_COUNTERS.reduce((total, name) => total + counter(name), 0);
        return {
            compileRequests: cacheHits + cacheMisses + nonCacheableCalls,
            cacheHits,
            cacheMisses,
            remoteHits: counter('remote_storage_hit'),
            remoteMisses: counter('remote_storage_miss'),
        };
    }
    catch (error) {
        core.warning(`Failed to parse ccache stats JSON: ${error.message}`);
        return null;
    }
}
export async function stopCcacheStorageHelpers(statsLog, statsDirectory) {
    let output = '';
    const env = { ...process.env, CCACHE_STATSLOG: statsLog };
    try {
        await exec.exec('ccache', ['--print-log-stats', '--format=json'], {
            env,
            ignoreReturnCode: true,
            listeners: {
                stdout: (data) => {
                    const text = data.toString();
                    output += text;
                    process.stdout.write(text);
                },
                stderr: (data) => {
                    process.stderr.write(data.toString());
                },
            },
        });
    }
    catch {
    }
    finally {
        try {
            await exec.exec('ccache', ['--stop-storage-helpers'], { env, ignoreReturnCode: true });
        }
        catch {
        }
        await fs.promises.rm(statsDirectory, { recursive: true, force: true });
    }
    return summarizeCcacheStats(output);
}
export function compilerCacheEnvForStartedProxy(plan, actualPort) {
    const envVars = {};
    for (const [key, value] of Object.entries(plan.env_vars || {})) {
        envVars[key] = rewritePlannedProxyPort(value, plan.proxy.port, actualPort);
    }
    envVars.BORINGCACHE_PROXY_PORT = String(actualPort);
    return envVars;
}
export function sccacheEnvForStartedProxy(plan, actualPort) {
    const envVars = compilerCacheEnvForStartedProxy(plan, actualPort);
    envVars.SCCACHE_IDLE_TIMEOUT = process.env.SCCACHE_IDLE_TIMEOUT
        || envVars.SCCACHE_IDLE_TIMEOUT
        || '0';
    return envVars;
}
export async function startCompilerCacheProxy(adapter, plan, inputs) {
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const proxyPlan = await resolveAdapterCliPlan(adapter, plan.workspace, plan.workingDirectory, '', requestedPort, proxyPlanningReadOnly(inputs.readOnly), {});
    const preflight = await checkDirectCacheProxyTagStatus(proxyPlan.workspace, proxyPlan.tag, {
        noPlatform: proxyPlan.proxy.no_platform,
        noGit: proxyPlan.proxy.no_git,
    });
    const proxy = await startRegistryProxy(actionProxyOptions({
        command: 'cache-registry',
        workspace: proxyPlan.workspace,
        tag: proxyPlan.tag,
        host: proxyPlan.proxy.host || '127.0.0.1',
        port: proxyPlan.proxy.port,
        noGit: proxyPlan.proxy.no_git,
        noPlatform: proxyPlan.proxy.no_platform,
        verbose: inputs.verbose,
        readOnly: proxyPlan.proxy.read_only,
    }, proxyPlan.proxy, inputs.failOnCacheError));
    saveModeState('workspace', proxyPlan.workspace);
    saveModeState(`${adapter}-tag`, proxyPlan.tag);
    saveModeState(`${adapter}-no-platform`, String(proxyPlan.proxy.no_platform));
    saveModeState(`${adapter}-no-git`, String(proxyPlan.proxy.no_git));
    saveModeState(`${adapter}-preflight-cache-entry-hit`, String(preflight.cacheEntryHit));
    saveModeState(`${adapter}-preflight-kv-hit`, String(preflight.kvHit));
    saveModeState(`${adapter}-preflight-kv-checked`, String(preflight.kvChecked));
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy);
    core.setOutput('cache-hit', String(preflight.kvHit));
    setProxyOutputs(proxy.port);
    return { proxyPlan, proxy, preflight };
}
export function compilerCacheModeState(tool) {
    return {
        workspace: getModeState('workspace'),
        tag: getModeState(`${tool}-tag`),
        noPlatform: getModeState(`${tool}-no-platform`) === 'true',
        noGit: getModeState(`${tool}-no-git`) === 'true',
        hit: getModeState(`${tool}-preflight-kv-hit`) === 'true',
        cacheEntryHit: getModeState(`${tool}-preflight-cache-entry-hit`) === 'true',
        kvHit: getModeState(`${tool}-preflight-kv-hit`) === 'true',
        kvChecked: getModeState(`${tool}-preflight-kv-checked`) === 'true',
    };
}
export async function finishCompilerCacheSave(tool, state, stats, statsDetail, options) {
    if (!state.workspace || !state.tag || options.allowSaves === false) {
        return;
    }
    if (!hasSaveToken()) {
        core.notice(`Save skipped: ${missingSaveTokenMessage()}`);
        return;
    }
    if (!stats || stats.compileRequests === 0) {
        markModeVerifyTagSkipped(state.tag);
        if (state.kvHit) {
            core.info(`Skipping ${tool} post-save verification for ${state.tag}: no compile requests were observed.`);
        }
        else if (state.cacheEntryHit) {
            core.info(`Skipping ${tool} post-save verification for ${state.tag}: signed cache entry existed, but no compile requests were observed.`);
        }
        else {
            core.info(`Skipping ${tool} save for ${state.tag}: no compile requests were observed.`);
        }
        return;
    }
    const postShutdownStatus = await checkDirectCacheProxyTagStatus(state.workspace, state.tag, {
        noPlatform: state.noPlatform,
        noGit: state.noGit,
    });
    core.info(`${tool} proxy stats for ${state.tag}: ${statsDetail}`);
    if (stats.cacheHits > 0) {
        return;
    }
    if (state.kvHit) {
        core.warning(`${tool} proxy saw 0 cache hits across ${stats.compileRequests} compile requests even though direct KV rows existed for '${state.tag}' before startup. Check ${tool} key churn, emitted tag semantics, and proxy read logs.`);
    }
    else if (state.cacheEntryHit && postShutdownStatus.kvHit) {
        core.notice(`${tool} proxy saw 0 cache hits across ${stats.compileRequests} compile requests for '${state.tag}'. A signed cache entry existed before startup, but direct KV rows were absent; the run populated the proxy KV cache for future runs.`);
    }
    else if (state.cacheEntryHit && state.kvChecked && postShutdownStatus.kvChecked) {
        core.warning(`${tool} proxy saw 0 cache hits across ${stats.compileRequests} compile requests for '${state.tag}'. A signed cache entry existed before startup, but direct KV rows were absent and still were not visible after shutdown. Check proxy KV publish logs and save token scope.`);
    }
    else if (state.cacheEntryHit) {
        core.warning(`${tool} proxy saw 0 cache hits across ${stats.compileRequests} compile requests for '${state.tag}'. A signed cache entry existed before startup, but this CLI/API did not report direct KV row visibility. Check boringcache/one cli-version alignment and proxy read/write logs.`);
    }
    else if (postShutdownStatus.kvHit) {
        core.notice(`${tool} proxy saw 0 cache hits across ${stats.compileRequests} compile requests, but '${state.tag}' published successfully. This looks like a cold fill.`);
    }
    else if (postShutdownStatus.cacheEntryHit) {
        core.warning(`${tool} proxy saw 0 cache hits across ${stats.compileRequests} compile requests and '${state.tag}' had a signed cache entry after shutdown, but direct KV rows were not visible. Check boringcache/one cli-version alignment and proxy KV publish logs.`);
    }
    else {
        core.notice(`${tool} proxy saw 0 cache hits across ${stats.compileRequests} compile requests and '${state.tag}' was not reported as direct KV rows during post-shutdown verification. This usually means a cold fill; check proxy publish logs if the next run also misses.`);
    }
}
export async function runCcacheRestore(plan, inputs) {
    const statsDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'boringcache-ccache-'));
    const statsLog = path.join(statsDirectory, 'stats.log');
    try {
        const { proxyPlan, proxy, preflight } = await startCompilerCacheProxy('ccache', plan, inputs);
        const envVars = compilerCacheEnvForStartedProxy(proxyPlan, proxy.port);
        envVars.CCACHE_STATSLOG = statsLog;
        exportEnvVars(envVars);
        saveModeState('ccache-stats-directory', statsDirectory);
        saveModeState('ccache-stats-log', statsLog);
        return {
            workspace: proxyPlan.workspace,
            cacheHit: preflight.kvHit,
            cacheTag: proxyPlan.tag,
            evidence: directCachePreflightEvidence(preflight),
            verificationSpecs: adapterVerificationSpecs(proxyPlan),
        };
    }
    catch (error) {
        await fs.promises.rm(statsDirectory, { recursive: true, force: true });
        throw error;
    }
}
export async function runCcacheSave(options = {}) {
    const state = compilerCacheModeState('ccache');
    const statsLog = getModeState('ccache-stats-log');
    const statsDirectory = getModeState('ccache-stats-directory');
    const stats = statsLog && statsDirectory
        ? await stopCcacheStorageHelpers(statsLog, statsDirectory)
        : null;
    await stopProxyFromState();
    const statsDetail = stats
        ? `compile_requests=${stats.compileRequests}, cache_hits=${stats.cacheHits}, cache_misses=${stats.cacheMisses}, remote_hits=${stats.remoteHits}, remote_misses=${stats.remoteMisses}`
        : '';
    await finishCompilerCacheSave('ccache', state, stats, statsDetail, options);
}
export async function runSccacheRestore(plan, inputs) {
    const { proxyPlan, proxy, preflight } = await startCompilerCacheProxy('sccache', plan, inputs);
    exportEnvVars(sccacheEnvForStartedProxy(proxyPlan, proxy.port));
    await startSccacheServer();
    return {
        workspace: proxyPlan.workspace,
        cacheHit: preflight.kvHit,
        cacheTag: proxyPlan.tag,
        evidence: directCachePreflightEvidence(preflight),
        verificationSpecs: adapterVerificationSpecs(proxyPlan),
    };
}
export async function runSccacheSave(options = {}) {
    const state = compilerCacheModeState('sccache');
    const sccacheStats = await stopSccacheServer();
    await stopProxyFromState();
    const rustHitRate = sccacheStats?.rustHitRate || 'unknown';
    const statsDetail = sccacheStats
        ? `compile_requests=${sccacheStats.compileRequests}, cache_hits=${sccacheStats.cacheHits}, cache_misses=${sccacheStats.cacheMisses}, rust_hit_rate=${rustHitRate}`
        : '';
    await finishCompilerCacheSave('sccache', state, sccacheStats, statsDetail, options);
}
