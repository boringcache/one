import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execBoringCache as execBoringCacheCore, getActionState, hasRestoreToken, hasSaveToken, missingSaveTokenMessage, startRegistryProxy, stopRegistryProxy, proxyStopTimeoutMs, saveActionState, } from '../core';
import { DEFAULT_OCI_HYDRATION_POLICY, requireCliVerificationTags, } from '../utils';
export async function waitForArchiveMaterialization(options) {
    await options.archiveMaterialized;
}
export class DockerBuildFailure extends Error {
    constructor(message) {
        super(message);
        this.name = 'DockerBuildFailure';
    }
}
export async function runDockerBuildOperation(operation) {
    try {
        return await operation();
    }
    catch (error) {
        if (error instanceof DockerBuildFailure) {
            throw error;
        }
        throw new DockerBuildFailure(error instanceof Error ? error.message : String(error));
    }
}
export function actionProxyOptions(options, proxyPlan, failOnCacheError = false) {
    // CLI <=1.14 reported "warm" but did not support --startup-mode. Omitting
    // the new flag preserves that CLI's default while newer plans are explicit.
    const plannedStartupMode = proxyPlan?.startup_mode;
    return {
        ...options,
        failOnCacheError,
        onDemand: plannedStartupMode === 'on-demand',
        startupMode: plannedStartupMode === 'warm'
            ? options.startupMode
            : plannedStartupMode || options.startupMode,
        warmupStrategy: proxyPlan?.warmup_strategy,
        ociPrefetchRefs: proxyPlan?.oci_prefetch_refs || [],
        ociRequiredReadableRefs: options.ociRequiredReadableRefs || [],
        ociHydration: proxyPlan?.oci_hydration || options.ociHydration || DEFAULT_OCI_HYDRATION_POLICY,
        metadataHints: proxyPlan?.metadata_hints || options.metadataHints || {},
    };
}
export function adapterVerificationSpecs(plan) {
    return requireCliVerificationTags(plan.verification_tags, plan.adapter || 'adapter')
        .map((tag) => ({ tag, saveExpected: !plan.proxy.read_only }));
}
export const SUPPORTED_CLI_DRY_RUN_SCHEMA_VERSION = 1;
export const SUPPORTED_CLI_SETUP_SCHEMA_VERSION = 1;
export function assertSupportedCliDryRunSchema(adapter, plan) {
    if (plan.schema_version !== SUPPORTED_CLI_DRY_RUN_SCHEMA_VERSION) {
        const actual = plan.schema_version === undefined ? 'missing' : String(plan.schema_version);
        throw new Error(`boringcache ${adapter} dry-run JSON schema_version ${actual} is not supported by this action `
            + `(expected ${SUPPORTED_CLI_DRY_RUN_SCHEMA_VERSION}). Update boringcache/one or pin cli-version.`);
    }
}
export function parsePortInput(value, inputName) {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
        throw new Error(`Unsupported ${inputName} "${value}". Expected a TCP port from 1 to 65535.`);
    }
    const port = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(port) || port < 1 || port > 65_535) {
        throw new Error(`Unsupported ${inputName} "${value}". Expected a TCP port from 1 to 65535.`);
    }
    return port;
}
export async function resolvePreferredPort(value, inputName) {
    if (value.trim()) {
        return parsePortInput(value, inputName);
    }
    return 0;
}
export function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}
export function proxyPlanningReadOnly(requestedReadOnly) {
    return requestedReadOnly || (!hasSaveToken() && hasRestoreToken());
}
export function appendCliPublicationPolicy(args, readOnly) {
    args.push(readOnly ? '--read-only' : '--write');
}
export function requireAdapterSetupPlan(adapter, setup) {
    if (!setup || (!Object.keys(setup.env_vars || {}).length && !(setup.files || []).length && !(setup.directories || []).length)) {
        throw new Error(`boringcache ${adapter} dry-run JSON did not include adapter setup planning data`);
    }
    const setupSchemaVersion = setup.schema_version ?? SUPPORTED_CLI_SETUP_SCHEMA_VERSION;
    if (setupSchemaVersion !== SUPPORTED_CLI_SETUP_SCHEMA_VERSION) {
        throw new Error(`boringcache ${adapter} setup schema_version ${setupSchemaVersion} is not supported by this action `
            + `(expected ${SUPPORTED_CLI_SETUP_SCHEMA_VERSION}). Update boringcache/one or pin cli-version.`);
    }
    return setup;
}
export function exportEnvVars(envVars) {
    for (const [key, value] of Object.entries(envVars)) {
        process.env[key] = value;
        core.exportVariable(key, value);
    }
}
export function applyAdapterSetupPlan(setup) {
    exportEnvVars(setup.env_vars || {});
    for (const directory of setup.directories || []) {
        ensureDir(directory);
    }
    for (const file of setup.files || []) {
        ensureDir(path.dirname(file.path));
        if (file.mode === 'append') {
            if (fs.existsSync(file.path) && fs.readFileSync(file.path, 'utf8').includes(file.content)) {
                continue;
            }
            fs.appendFileSync(file.path, file.content);
        }
        else if (file.mode === 'write') {
            fs.writeFileSync(file.path, file.content);
        }
        else {
            throw new Error(`Unsupported adapter setup file mode for ${file.path}`);
        }
        if (file.executable) {
            fs.chmodSync(file.path, 0o700);
        }
    }
}
export function prependExistingNixConfig(setup) {
    const planned = setup.env_vars?.NIX_CONFIG;
    const existing = process.env.NIX_CONFIG;
    if (!planned || !existing?.trim()) {
        return;
    }
    setup.env_vars = {
        ...setup.env_vars,
        NIX_CONFIG: `${existing.replace(/\n+$/, '')}\n${planned}`,
    };
}
export function setupFilePath(setup, suffix) {
    return (setup.files || []).find((file) => file.path.endsWith(suffix))?.path || '';
}
export function setupDirectory(setup) {
    return (setup.directories || [])[0] || '';
}
export function requireSetupFilePath(setup, suffix, label) {
    const filePath = setupFilePath(setup, suffix);
    if (!filePath) {
        throw new Error(`boringcache adapter setup plan did not include ${label}`);
    }
    return filePath;
}
export function requireSetupDirectory(setup, label) {
    const directory = setupDirectory(setup);
    if (!directory) {
        throw new Error(`boringcache adapter setup plan did not include ${label}`);
    }
    return directory;
}
export function modeStateKey(key) {
    return `mode-${key}`;
}
export function saveModeState(key, value) {
    saveActionState(modeStateKey(key), value);
}
export function getModeState(key) {
    return getActionState(modeStateKey(key));
}
export function getModeStateList(key) {
    return getModeState(key)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
}
export function appendModeStateListValue(key, value) {
    if (!value) {
        return;
    }
    const existing = getModeState(key)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    if (existing.includes(value)) {
        return;
    }
    existing.push(value);
    saveModeState(key, existing.join(','));
}
export function markModeVerifyTagSkipped(tag) {
    appendModeStateListValue('skipped-verify-tags', tag);
}
export function registryProxyLogPath(port) {
    return path.join(os.tmpdir(), `boringcache-proxy-${port}.log`);
}
export function setProxyOutputs(port) {
    const logPath = registryProxyLogPath(port);
    saveActionState('proxy-port', String(port));
    saveActionState('proxy-log-path', logPath);
    core.setOutput('proxy-port', String(port));
}
export function saveProxyModeState(proxy) {
    saveModeState('proxy-port', String(proxy.port));
    saveModeState('proxy-log-path', registryProxyLogPath(proxy.port));
    if (proxy.shutdownBudgetSecs !== undefined) {
        saveModeState('proxy-shutdown-budget-secs', String(proxy.shutdownBudgetSecs));
    }
}
export function reportedProxyStopTimeoutMs() {
    const reported = Number.parseInt(getModeState('proxy-shutdown-budget-secs'), 10);
    return proxyStopTimeoutMs(Number.isFinite(reported) ? reported : null);
}
export function getModeStateBoolean(key) {
    return getModeState(key) === 'true';
}
export function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
export async function execBoringCache(args, options) {
    return execBoringCacheCore(args, options);
}
export function emitCliPlannerWarnings(stderr) {
    for (const line of stderr.split('\n').map((value) => value.trim()).filter(Boolean)) {
        if (line.startsWith('warning:')) {
            core.warning(line.replace(/^warning:\s*/, ''));
        }
    }
}
async function preflightAdapterRequirements(adapter, workingDirectory) {
    let stdout = '';
    let stderr = '';
    const exitCode = await execBoringCache(['system', 'requirements', adapter, '--check'], {
        cwd: workingDirectory,
        ignoreReturnCode: true,
        silent: true,
        listeners: {
            stdout: (data) => {
                stdout += data.toString();
            },
            stderr: (data) => {
                stderr += data.toString();
            },
        },
    });
    if (exitCode !== 0) {
        throw new Error(stderr.trim()
            || stdout.trim()
            || `boringcache system requirements ${adapter} --check exited with code ${exitCode}`);
    }
}
async function preflightPlannedRequirements(adapter, plan, workingDirectory) {
    if (Array.isArray(plan.setup?.required_tools) && plan.setup.required_tools.length > 0) {
        await preflightAdapterRequirements(adapter, workingDirectory);
    }
}
export async function resolveAdapterCliPlan(adapter, workspace, workingDirectory, inputCacheTag, preferredPort, readOnly, options = {}) {
    const args = [adapter];
    if (workspace.trim()) {
        args.push('--workspace', workspace.trim());
    }
    const trimmedCacheTag = inputCacheTag.trim();
    if (trimmedCacheTag) {
        args.push('--tag', trimmedCacheTag);
    }
    if (preferredPort > 0) {
        args.push('--port', String(preferredPort));
    }
    if (options.stage) {
        args.push('--stage');
    }
    else {
        appendCliPublicationPolicy(args, readOnly);
    }
    if (options.failOnCacheError) {
        args.push('--fail-on-cache-error');
    }
    args.push('--dry-run', '--json');
    let stdout = '';
    let stderr = '';
    const exitCode = await exec.exec('boringcache', args, {
        cwd: workingDirectory,
        ignoreReturnCode: true,
        silent: true,
        listeners: {
            stdout: (data) => {
                stdout += data.toString();
            },
            stderr: (data) => {
                stderr += data.toString();
            },
        },
    });
    if (exitCode !== 0) {
        throw new Error(stderr.trim() || stdout.trim() || `boringcache ${adapter} --dry-run --json exited with code ${exitCode}`);
    }
    emitCliPlannerWarnings(stderr);
    let plan;
    try {
        plan = JSON.parse(stdout);
    }
    catch (error) {
        throw new Error(`Failed to parse boringcache ${adapter} dry-run JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    assertSupportedCliDryRunSchema(adapter, plan);
    await preflightPlannedRequirements(adapter, plan, workingDirectory);
    return plan;
}
export async function saveSimpleCache(workspace, cacheKey, cacheDir, flags = {}) {
    if (!hasSaveToken()) {
        core.notice(`Skipping cache save (${missingSaveTokenMessage()})`);
        return;
    }
    if (!fs.existsSync(cacheDir) || fs.readdirSync(cacheDir).length === 0) {
        core.notice('No cache files to save');
        return;
    }
    const args = ['save', workspace, `${cacheKey}:${cacheDir}`, '--force'];
    if (flags.verbose) {
        args.push('--verbose');
    }
    await execBoringCache(args);
}
export async function startPortableCacheProxy(workspace, port, tag, readOnly = false, proxyPlan) {
    const proxy = await startRegistryProxy(actionProxyOptions({
        command: 'cache-registry',
        workspace,
        tag,
        host: proxyPlan.host || '127.0.0.1',
        port,
        noPlatform: proxyPlan.no_platform,
        noGit: proxyPlan.no_git,
        readOnly,
    }, proxyPlan));
    return proxy;
}
export function emptyDirectCacheTagCheckStatus() {
    return {
        hit: false,
        cacheEntryHit: false,
        kvHit: false,
        kvChecked: false,
    };
}
export function checkResultHasKvProbe(result) {
    return typeof result.kv_entry_count === 'number'
        || typeof result.kv_total_size === 'number'
        || (result.status === 'hit' && result.cache_type === 'kv');
}
export function checkResultHasKvRows(result) {
    if (typeof result.kv_entry_count === 'number') {
        return result.kv_entry_count > 0;
    }
    return result.status === 'hit' && result.cache_type === 'kv';
}
export function checkResultHasCacheEntryHit(result) {
    if (result.status !== 'hit') {
        return false;
    }
    return result.cache_type !== 'kv';
}
export async function checkDirectCacheTagStatus(workspace, tag, { noPlatform = false, noGit = false, requireServerSignature = false, } = {}) {
    const args = ['check', workspace, tag, '--json'];
    if (requireServerSignature) {
        args.unshift('--require-server-signature');
    }
    if (noPlatform) {
        args.push('--no-platform');
    }
    if (noGit) {
        args.push('--no-git');
    }
    let stdout = '';
    const exitCode = await execBoringCache(args, {
        ignoreReturnCode: true,
        silent: true,
        listeners: {
            stdout: (data) => {
                stdout += data.toString();
            },
        },
    });
    if (exitCode !== 0) {
        return emptyDirectCacheTagCheckStatus();
    }
    try {
        const summary = JSON.parse(stdout);
        const results = summary.results || [];
        const cacheEntryHit = results.some(checkResultHasCacheEntryHit);
        const kvHit = results.some(checkResultHasKvRows);
        const kvChecked = results.some(checkResultHasKvProbe);
        const legacyHit = results.length === 0 && typeof summary.hits === 'number' && summary.hits > 0;
        return {
            hit: cacheEntryHit || kvHit || legacyHit,
            cacheEntryHit: cacheEntryHit || legacyHit,
            kvHit,
            kvChecked,
        };
    }
    catch (error) {
        core.warning(`Failed to parse boringcache check JSON for ${tag}: ${error.message}`);
        return emptyDirectCacheTagCheckStatus();
    }
}
export async function checkDirectCacheProxyTagStatus(workspace, tag, options = {}) {
    const strictStatus = await checkDirectCacheTagStatus(workspace, tag, {
        ...options,
        requireServerSignature: true,
    });
    if (strictStatus.kvChecked || strictStatus.kvHit) {
        return strictStatus;
    }
    const kvStatus = await checkDirectCacheTagStatus(workspace, tag, {
        ...options,
        requireServerSignature: false,
    });
    return {
        hit: strictStatus.cacheEntryHit || kvStatus.kvHit,
        cacheEntryHit: strictStatus.cacheEntryHit,
        kvHit: kvStatus.kvHit,
        kvChecked: kvStatus.kvChecked || kvStatus.kvHit,
    };
}
export function directCachePreflightEvidence(preflight) {
    return {
        cache_preflight: {
            cache_entry_hit: preflight.cacheEntryHit,
            kv_hit: preflight.kvHit,
            kv_checked: preflight.kvChecked,
        },
    };
}
export function rewritePlannedProxyPort(value, plannedPort, actualPort) {
    if (plannedPort === actualPort) {
        return value;
    }
    return value.replace(new RegExp(`:${plannedPort}(?=/|$)`), `:${actualPort}`);
}
export function readBoundedJsonObject(filePath) {
    try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile() || stat.size > 1024 * 1024) {
            core.warning(`Ignoring invalid Cargo native-tool evidence file: ${filePath}`);
            return null;
        }
        const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return value && typeof value === 'object' && !Array.isArray(value)
            ? value
            : null;
    }
    catch (error) {
        core.warning(`Unable to read Cargo native-tool evidence: ${error instanceof Error ? error.message : error}`);
        return null;
    }
}
export async function captureCommand(command, args) {
    let stdout = '';
    let stderr = '';
    const exitCode = await exec.exec(command, args, {
        ignoreReturnCode: true,
        silent: true,
        listeners: {
            stdout: (data) => {
                stdout += data.toString();
            },
            stderr: (data) => {
                stderr += data.toString();
            },
        },
    });
    return { exitCode, stdout: stdout.trim(), stderr: stderr.trim() };
}
export async function stopProxyFromState() {
    const proxyPid = getModeState('proxy-pid');
    if (proxyPid) {
        const proxyPort = Number.parseInt(getModeState('proxy-port'), 10);
        await stopRegistryProxy(parseInt(proxyPid, 10), Number.isFinite(proxyPort) ? proxyPort : undefined, reportedProxyStopTimeoutMs());
    }
}
