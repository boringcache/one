"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runModeRestore = runModeRestore;
exports.runModeSave = runModeSave;
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const core_1 = require("./core");
const utils_1 = require("./utils");
const DOCKER_CACHE_DIR_FROM = path.join(os.tmpdir(), 'boringcache-one-buildkit-cache-from');
const DOCKER_CACHE_DIR_TO = path.join(os.tmpdir(), 'boringcache-one-buildkit-cache-to');
const DOCKER_METADATA_FILE = path.join(os.tmpdir(), 'boringcache-one-docker-metadata.json');
const BUILDKIT_CACHE_DIR_FROM = path.join(os.tmpdir(), 'boringcache-one-buildkit-local-from');
const BUILDKIT_CACHE_DIR_TO = path.join(os.tmpdir(), 'boringcache-one-buildkit-local-to');
const BUILDKIT_METADATA_FILE = path.join(os.tmpdir(), 'boringcache-one-buildkit-metadata.json');
const DEFAULT_REGISTRY_CACHE_REF_TAG = 'buildcache';
const MAX_PROXY_METADATA_HINTS = 8;
const MAX_PROXY_METADATA_HINT_KEY_BYTES = 32;
const MAX_PROXY_METADATA_HINT_VALUE_BYTES = 64;
const PROXY_METADATA_HINT_PRIORITY = [
    'docker_immutable_run_ref',
    'docker_alias_promotion_refs',
    'ci_provider',
    'ci_run_uid',
    'ci_run_started_at',
    'ci_ref_type',
    'ci_pr_number',
    'docker_cache_ref_tag',
    'ci_run_attempt',
    'ci_ref_name',
    'ci_commit_sha',
];
function actionProxyOptions(options, proxyPlan) {
    return {
        ...options,
        onDemand: (proxyPlan === null || proxyPlan === void 0 ? void 0 : proxyPlan.startup_mode) === 'on-demand',
        ociPrefetchRefs: (proxyPlan === null || proxyPlan === void 0 ? void 0 : proxyPlan.oci_prefetch_refs) || [],
        ociHydration: (proxyPlan === null || proxyPlan === void 0 ? void 0 : proxyPlan.oci_hydration) || options.ociHydration || utils_1.DEFAULT_OCI_HYDRATION_POLICY,
        metadataHints: commandLineSafeMetadataHints((proxyPlan === null || proxyPlan === void 0 ? void 0 : proxyPlan.metadata_hints) || {}),
    };
}
function commandLineSafeMetadataHints(rawHints) {
    const orderedKeys = Object.keys(rawHints).sort((left, right) => {
        const leftPriority = PROXY_METADATA_HINT_PRIORITY.indexOf(normalizeMetadataHintKey(left) || left);
        const rightPriority = PROXY_METADATA_HINT_PRIORITY.indexOf(normalizeMetadataHintKey(right) || right);
        const normalizedLeft = leftPriority === -1 ? Number.MAX_SAFE_INTEGER : leftPriority;
        const normalizedRight = rightPriority === -1 ? Number.MAX_SAFE_INTEGER : rightPriority;
        if (normalizedLeft !== normalizedRight) {
            return normalizedLeft - normalizedRight;
        }
        return left.localeCompare(right);
    });
    const hints = {};
    for (const rawKey of orderedKeys) {
        const key = normalizeMetadataHintKey(rawKey);
        if (!key || Object.prototype.hasOwnProperty.call(hints, key)) {
            continue;
        }
        const value = normalizeMetadataHintValue(key, rawHints[rawKey]);
        if (!value) {
            core.debug(`Skipping proxy metadata hint ${rawKey}: value is not command-line safe`);
            continue;
        }
        hints[key] = value;
        if (Object.keys(hints).length >= MAX_PROXY_METADATA_HINTS) {
            break;
        }
    }
    return hints;
}
function normalizeMetadataHintKey(rawKey) {
    const normalized = rawKey.trim().toLowerCase().replace(/-/g, '_');
    if (!normalized || Buffer.byteLength(normalized, 'utf8') > MAX_PROXY_METADATA_HINT_KEY_BYTES) {
        return null;
    }
    return /^[a-z0-9_]+$/.test(normalized) ? normalized : null;
}
function normalizeMetadataHintValue(key, rawValue) {
    let value = String(rawValue || '');
    if (key === 'docker_alias_promotion_refs') {
        value = value
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
            .join('/');
    }
    const normalized = value.trim().toLowerCase().replace(/\s+/g, '-');
    if (!normalized || Buffer.byteLength(normalized, 'utf8') > MAX_PROXY_METADATA_HINT_VALUE_BYTES) {
        return null;
    }
    return /^[a-z0-9_.:/-]+$/.test(normalized) ? normalized : null;
}
let rustLastOutput = '';
function currentHomeDir() {
    return process.env.HOME || os.homedir();
}
async function runModeRestore(plan, inputs) {
    switch (plan.mode) {
        case 'docker':
            return runDockerRestore(plan, inputs);
        case 'buildkit':
            return runBuildkitRestore(plan, inputs);
        case 'bazel':
            return runBazelRestore(plan, inputs);
        case 'gradle':
            return runGradleRestore(plan, inputs);
        case 'maven':
            return runMavenRestore(plan, inputs);
        case 'rust-sccache':
            return runRustRestore(plan, inputs);
        case 'turbo-proxy':
            return runTurboProxyRestore(plan, inputs);
        case 'archive':
            return {};
    }
}
async function runModeSave(mode) {
    switch (mode) {
        case 'docker':
            await runDockerSave();
            return;
        case 'buildkit':
            await runBuildkitSave();
            return;
        case 'bazel':
            await shutdownBazelServer();
            await stopProxyFromState();
            return;
        case 'gradle':
        case 'maven':
        case 'turbo-proxy':
            await stopProxyFromState();
            return;
        case 'rust-sccache':
            await runRustSave();
            return;
        case 'archive':
            return;
    }
}
function parseBoolean(value, defaultValue = false) {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }
    return String(value).trim().toLowerCase() === 'true';
}
function parseList(input, separator = /[\n,]/) {
    return input
        .split(separator)
        .map((item) => item.trim())
        .filter(Boolean);
}
function parseMultiline(input) {
    return input
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}
function slugify(value) {
    return value.replace(/[^a-zA-Z0-9]/g, '-');
}
function sanitizeBuilderToken(value) {
    return slugify(value)
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
}
function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}
function modeStateKey(key) {
    return `mode-${key}`;
}
function saveModeState(key, value) {
    core.saveState(modeStateKey(key), value);
}
function getModeState(key) {
    return core.getState(modeStateKey(key));
}
function appendModeStateListValue(key, value) {
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
function markModeVerifyTagSkipped(tag) {
    appendModeStateListValue('skipped-verify-tags', tag);
}
function addLocalBinPaths() {
    const home = currentHomeDir();
    core.addPath(path.join(home, '.local', 'bin'));
    core.addPath(path.join(home, '.boringcache', 'bin'));
}
function registryProxyLogPath(port) {
    return path.join(os.tmpdir(), `boringcache-proxy-${port}.log`);
}
function setProxyOutputs(port) {
    const logPath = registryProxyLogPath(port);
    core.saveState('proxy-port', String(port));
    core.saveState('proxy-log-path', logPath);
    core.setOutput('proxy-port', String(port));
    core.setOutput('proxy-log-path', logPath);
}
function saveProxyModeState(port) {
    saveModeState('proxy-port', String(port));
    saveModeState('proxy-log-path', registryProxyLogPath(port));
}
async function shutdownBazelServer() {
    await exec.exec('bazel', ['shutdown'], {
        ignoreReturnCode: true,
        silent: true,
    });
}
async function execBoringCache(args, options) {
    return (0, core_1.execBoringCache)(args, options);
}
function emitCliPlannerWarnings(stderr) {
    for (const line of stderr.split('\n').map((value) => value.trim()).filter(Boolean)) {
        if (line.startsWith('warning:')) {
            core.warning(line.replace(/^warning:\s*/, ''));
        }
    }
}
async function resolveAdapterCliPlan(adapter, workspace, workingDirectory, inputCacheTag, preferredPort, noPlatform, noGit, readOnly) {
    const args = [adapter, '--workspace', workspace];
    const trimmedCacheTag = inputCacheTag.trim();
    if (trimmedCacheTag) {
        args.push('--tag', trimmedCacheTag);
    }
    if (preferredPort > 0) {
        args.push('--port', String(preferredPort));
    }
    if (noPlatform) {
        args.push('--no-platform');
    }
    if (noGit) {
        args.push('--no-git');
    }
    if (readOnly) {
        args.push('--read-only');
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
    try {
        return JSON.parse(stdout);
    }
    catch (error) {
        throw new Error(`Failed to parse boringcache ${adapter} dry-run JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function resolveDockerCliPlan(workspace, workingDirectory, inputCacheTag, preferredPort, host, endpointHost, noPlatform, noGit, readOnly, cacheMode, cacheRefTag, ociHydration) {
    var _a;
    const args = ['docker', '--workspace', workspace];
    const trimmedCacheTag = inputCacheTag.trim();
    const trimmedCacheRefTag = cacheRefTag.trim();
    if (trimmedCacheTag) {
        args.push('--tag', trimmedCacheTag);
    }
    if (preferredPort > 0) {
        args.push('--port', String(preferredPort));
    }
    if (host.trim()) {
        args.push('--host', host.trim());
    }
    if (endpointHost.trim()) {
        args.push('--endpoint-host', endpointHost.trim());
    }
    if (noPlatform) {
        args.push('--no-platform');
    }
    if (noGit) {
        args.push('--no-git');
    }
    if (readOnly) {
        args.push('--read-only');
    }
    if (cacheMode.trim()) {
        args.push('--cache-mode', cacheMode.trim());
    }
    if (trimmedCacheRefTag) {
        args.push('--cache-ref-tag', trimmedCacheRefTag);
    }
    const trimmedOciHydration = ociHydration.trim();
    if (trimmedOciHydration) {
        args.push('--oci-hydration', trimmedOciHydration);
    }
    args.push('--dry-run', '--json', '--', 'docker', 'buildx', 'build', '.');
    let stdout = '';
    let stderr = '';
    const env = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
            env[key] = value;
        }
    }
    if (env.GITHUB_ACTIONS === 'true' && !env.BORINGCACHE_CI_RUN_STARTED_AT) {
        env.BORINGCACHE_CI_RUN_STARTED_AT = new Date().toISOString();
        process.env.BORINGCACHE_CI_RUN_STARTED_AT = env.BORINGCACHE_CI_RUN_STARTED_AT;
    }
    const exitCode = await exec.exec('boringcache', args, {
        cwd: workingDirectory,
        env,
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
        throw new Error(stderr.trim() || stdout.trim() || `boringcache docker --dry-run --json exited with code ${exitCode}`);
    }
    emitCliPlannerWarnings(stderr);
    let plan;
    try {
        plan = JSON.parse(stdout);
    }
    catch (error) {
        throw new Error(`Failed to parse boringcache docker dry-run JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!((_a = plan.oci_cache) === null || _a === void 0 ? void 0 : _a.registry_ref) || !plan.oci_cache.cache_from) {
        throw new Error('boringcache docker dry-run JSON did not include OCI cache planning data');
    }
    return plan;
}
async function restoreSimpleCache(workspace, cacheKey, cacheDir, flags = {}) {
    if (!(0, core_1.hasRestoreToken)()) {
        core.notice(`Skipping cache restore (${(0, core_1.missingRestoreTokenMessage)()})`);
        return;
    }
    const args = ['restore', workspace, `${cacheKey}:${cacheDir}`];
    if (flags.verbose) {
        args.push('--verbose');
    }
    await execBoringCache(args);
}
async function saveSimpleCache(workspace, cacheKey, cacheDir, flags = {}) {
    if (!(0, core_1.hasSaveToken)()) {
        core.notice(`Skipping cache save (${(0, core_1.missingSaveTokenMessage)()})`);
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
    if (flags.exclude) {
        args.push('--exclude', flags.exclude);
    }
    await execBoringCache(args);
}
function getEffectiveRegistryTag(cacheTag, registryTag) {
    return registryTag || cacheTag;
}
function getRegistryCacheFlags(ref, cacheMode) {
    return {
        from: `type=registry,ref=${ref},registry.insecure=true`,
        to: `type=registry,ref=${ref},mode=${cacheMode},registry.insecure=true`,
    };
}
function extractRegistryCacheRefTag(cacheFrom) {
    var _a;
    const refMatch = cacheFrom.match(/(?:^|,)ref=([^,]+)/);
    const ref = (_a = refMatch === null || refMatch === void 0 ? void 0 : refMatch[1]) === null || _a === void 0 ? void 0 : _a.trim();
    if (!ref) {
        return null;
    }
    const lastSlash = ref.lastIndexOf('/');
    const lastColon = ref.lastIndexOf(':');
    if (lastColon <= lastSlash || lastColon === ref.length - 1) {
        return null;
    }
    return ref.slice(lastColon + 1);
}
function registryCacheFromRefTags(ociCache) {
    var _a;
    if (!ociCache) {
        return [];
    }
    if ((_a = ociCache.cache_from_ref_tags) === null || _a === void 0 ? void 0 : _a.length) {
        return ociCache.cache_from_ref_tags;
    }
    return (ociCache.cache_from_refs || [])
        .map(extractRegistryCacheRefTag)
        .filter((tag) => Boolean(tag));
}
function setRegistryCacheOutputs(spec) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    core.setOutput('registry-ref', spec.ref);
    core.setOutput('cache-from', spec.from);
    core.setOutput('cache-to', spec.to || '');
    core.setOutput('docker-cache-run-ref', ((_a = spec.ociCache) === null || _a === void 0 ? void 0 : _a.immutable_run_ref_tag) || '');
    core.setOutput('docker-cache-from-refs', registryCacheFromRefTags(spec.ociCache).join('\n'));
    core.setOutput('docker-cache-promotion-refs', (((_b = spec.ociCache) === null || _b === void 0 ? void 0 : _b.promotion_ref_tags) || []).join('\n'));
    core.setOutput('docker-ci-provider', ((_d = (_c = spec.ociCache) === null || _c === void 0 ? void 0 : _c.run_metadata) === null || _d === void 0 ? void 0 : _d.provider) || '');
    core.setOutput('docker-ci-run-id', ((_f = (_e = spec.ociCache) === null || _e === void 0 ? void 0 : _e.run_metadata) === null || _f === void 0 ? void 0 : _f.run_uid) || '');
    core.setOutput('docker-ci-run-attempt', ((_h = (_g = spec.ociCache) === null || _g === void 0 ? void 0 : _g.run_metadata) === null || _h === void 0 ? void 0 : _h.run_attempt) || '');
    core.setOutput('docker-ci-ref-type', ((_k = (_j = spec.ociCache) === null || _j === void 0 ? void 0 : _j.run_metadata) === null || _k === void 0 ? void 0 : _k.source_ref_type) || '');
    core.setOutput('docker-ci-ref-name', ((_m = (_l = spec.ociCache) === null || _l === void 0 ? void 0 : _l.run_metadata) === null || _m === void 0 ? void 0 : _m.source_ref_name) || '');
    core.setOutput('docker-ci-run-started-at', ((_p = (_o = spec.ociCache) === null || _o === void 0 ? void 0 : _o.run_metadata) === null || _p === void 0 ? void 0 : _p.run_started_at) || '');
    core.setOutput('cache-dir', '');
    core.setOutput('save-cache-dir', '');
}
function setLocalCacheOutputs(cacheDirFrom, cacheDirTo, cacheMode) {
    core.setOutput('registry-ref', '');
    core.setOutput('cache-from', `type=local,src=${cacheDirFrom}`);
    core.setOutput('cache-to', `type=local,dest=${cacheDirTo},mode=${cacheMode}`);
    core.setOutput('docker-cache-run-ref', '');
    core.setOutput('docker-cache-from-refs', '');
    core.setOutput('docker-cache-promotion-refs', '');
    core.setOutput('docker-ci-provider', '');
    core.setOutput('docker-ci-run-id', '');
    core.setOutput('docker-ci-run-attempt', '');
    core.setOutput('docker-ci-ref-type', '');
    core.setOutput('docker-ci-ref-name', '');
    core.setOutput('docker-ci-run-started-at', '');
    core.setOutput('cache-dir', cacheDirFrom);
    core.setOutput('save-cache-dir', cacheDirTo);
}
async function inspectDockerTemplate(containerName, template) {
    let output = '';
    const result = await exec.exec('docker', ['inspect', '-f', template, containerName], {
        ignoreReturnCode: true,
        silent: true,
        listeners: {
            stdout: (data) => {
                output += data.toString();
            },
        },
    });
    const value = output.trim();
    if (result !== 0 || !value || value === '<no value>') {
        return null;
    }
    return value;
}
async function getContainerGateway(containerName) {
    const directGateway = await inspectDockerTemplate(containerName, '{{.NetworkSettings.Gateway}}');
    if (directGateway) {
        return directGateway;
    }
    const networkGateways = await inspectDockerTemplate(containerName, '{{range .NetworkSettings.Networks}}{{if .Gateway}}{{.Gateway}}{{"\\n"}}{{end}}{{end}}');
    if (networkGateways) {
        const firstGateway = networkGateways
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find(Boolean);
        if (firstGateway) {
            return firstGateway;
        }
    }
    core.warning(`Could not determine gateway for container ${containerName}, falling back to 172.17.0.1`);
    return '172.17.0.1';
}
async function getContainerNetworkMode(containerName) {
    const networkMode = await inspectDockerTemplate(containerName, '{{.HostConfig.NetworkMode}}');
    if (!networkMode) {
        core.warning(`Could not determine network mode for container ${containerName}, assuming bridge`);
        return 'bridge';
    }
    return networkMode;
}
async function setupQemuIfNeeded(platforms) {
    if (!platforms) {
        return;
    }
    const result = await exec.exec('docker', ['run', '--privileged', '--rm', 'tonistiigi/binfmt', '--install', 'all'], { ignoreReturnCode: true });
    if (result !== 0) {
        throw new Error(`Failed to set up QEMU for multi-platform builds (exit ${result})`);
    }
}
function buildxBuilderName() {
    const runId = String(process.env.GITHUB_RUN_ID || Date.now());
    const actionId = sanitizeBuilderToken(process.env.GITHUB_ACTION || 'one') || 'one';
    const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return `boringcache-${runId}-${actionId}-${uniqueSuffix}`;
}
async function setupBuildxBuilder(driver, driverOpts, buildkitdConfigInline, registryMode) {
    const builderName = buildxBuilderName();
    let driverToUse = driver || 'docker-container';
    if (driverToUse === 'docker') {
        core.warning('Buildx driver "docker" does not support cache export; falling back to "docker-container".');
        driverToUse = 'docker-container';
    }
    const effectiveDriverOpts = [...driverOpts];
    if (registryMode && driverToUse === 'docker-container' && !effectiveDriverOpts.some((opt) => opt.startsWith('network='))) {
        effectiveDriverOpts.push('network=host');
    }
    let configPath = '';
    if (buildkitdConfigInline.trim()) {
        configPath = path.join(os.tmpdir(), `buildkitd-${Date.now()}.toml`);
        fs.writeFileSync(configPath, buildkitdConfigInline);
    }
    const args = ['buildx', 'create', '--name', builderName, '--driver', driverToUse];
    for (const driverOpt of effectiveDriverOpts) {
        args.push('--driver-opt', driverOpt);
    }
    if (configPath) {
        args.push('--config', configPath);
    }
    args.push('--use');
    const createResult = await exec.exec('docker', args, { ignoreReturnCode: true });
    if (createResult !== 0) {
        throw new Error(`Failed to create buildx builder (exit ${createResult})`);
    }
    return builderName;
}
async function cleanupBuildxBuilder(builderName) {
    if (!builderName) {
        return;
    }
    const removeResult = await exec.exec('docker', ['buildx', 'rm', '--force', builderName], {
        ignoreReturnCode: true,
    });
    if (removeResult !== 0) {
        core.warning(`Failed to remove buildx builder ${builderName} (exit ${removeResult})`);
    }
}
async function getBuilderPlatforms(builderName) {
    let output = '';
    const result = await exec.exec('docker', ['buildx', 'inspect', builderName, '--bootstrap'], {
        ignoreReturnCode: true,
        silent: true,
        listeners: {
            stdout: (data) => {
                output += data.toString();
            },
        },
    });
    if (result !== 0) {
        return '';
    }
    const line = output.split('\n').find((value) => value.trim().startsWith('Platforms:'));
    return line ? line.replace('Platforms:', '').trim() : '';
}
async function buildDockerImage(opts) {
    const args = ['buildx', 'build', '--builder', opts.builder, '-f', opts.dockerfile];
    for (const tag of opts.tags) {
        args.push('-t', `${opts.image}:${tag}`);
    }
    for (const buildArg of opts.buildArgs) {
        args.push('--build-arg', buildArg);
    }
    for (const secret of opts.secrets) {
        args.push('--secret', secret);
    }
    if (opts.target) {
        args.push('--target', opts.target);
    }
    if (opts.platforms) {
        args.push('--platform', opts.platforms);
    }
    if (opts.push) {
        args.push('--push');
    }
    if (opts.load) {
        args.push('--load');
    }
    if (opts.noCache) {
        args.push('--no-cache');
    }
    if (opts.cacheFrom) {
        args.push('--cache-from', opts.cacheFrom);
        if (opts.cacheTo) {
            args.push('--cache-to', opts.cacheTo);
        }
    }
    else if (opts.cacheDirFrom) {
        args.push('--cache-from', `type=local,src=${opts.cacheDirFrom}`);
        args.push('--cache-to', `type=local,dest=${opts.cacheDirTo},mode=${opts.cacheMode}`);
    }
    args.push('--metadata-file', DOCKER_METADATA_FILE);
    args.push('.');
    const result = await exec.exec('docker', args, {
        cwd: opts.context,
        env: {
            ...process.env,
            DOCKER_BUILDKIT: '1',
        },
    });
    if (result !== 0) {
        throw new Error(`docker buildx build failed with exit code ${result}`);
    }
}
function readDockerMetadata() {
    if (!fs.existsSync(DOCKER_METADATA_FILE)) {
        return { imageId: '', digest: '' };
    }
    try {
        const data = JSON.parse(fs.readFileSync(DOCKER_METADATA_FILE, 'utf8'));
        return {
            imageId: data['containerimage.config.digest'] || '',
            digest: data['containerimage.digest'] || '',
        };
    }
    catch (error) {
        core.warning(`Failed to parse Docker metadata file: ${error.message}`);
        return { imageId: '', digest: '' };
    }
}
function materializeMaybeFile(value, filename, rootDir) {
    if (!value.trim()) {
        return '';
    }
    const candidate = path.resolve(rootDir, value);
    if (fs.existsSync(candidate)) {
        return candidate;
    }
    const target = path.join(os.tmpdir(), filename);
    fs.writeFileSync(target, value);
    return target;
}
async function installBuildctl() {
    addLocalBinPaths();
    try {
        const result = await exec.exec('buildctl', ['--version'], {
            ignoreReturnCode: true,
            silent: true,
        });
        if (result === 0) {
            return;
        }
    }
    catch {
    }
    const version = 'v0.19.0';
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'buildctl-'));
    const archivePath = path.join(tmpDir, 'buildkit.tar.gz');
    const installDir = path.join(currentHomeDir(), '.local', 'bin');
    try {
        const url = `https://github.com/moby/buildkit/releases/download/${version}/buildkit-${version}.linux-amd64.tar.gz`;
        const curlCode = await exec.exec('curl', ['-fsSL', '--output', archivePath, url], { ignoreReturnCode: true });
        if (curlCode !== 0) {
            throw new Error(`Failed to download buildctl from ${url}`);
        }
        await exec.exec('tar', ['-xzf', archivePath, '-C', tmpDir]);
        await fs.promises.mkdir(installDir, { recursive: true });
        const srcPath = path.join(tmpDir, 'bin', process.platform === 'win32' ? 'buildctl.exe' : 'buildctl');
        const destPath = path.join(installDir, process.platform === 'win32' ? 'buildctl.exe' : 'buildctl');
        await fs.promises.copyFile(srcPath, destPath);
        if (process.platform !== 'win32') {
            await fs.promises.chmod(destPath, 0o755);
        }
        core.addPath(installDir);
    }
    finally {
        await fs.promises.rm(tmpDir, { recursive: true, force: true });
    }
}
async function buildWithBuildctl(opts) {
    var _a;
    const args = ['--addr', opts.addr];
    if (opts.tlsCa || opts.tlsCert || opts.tlsKey) {
        if (opts.tlsCa) {
            args.push('--tlscacert', opts.tlsCa);
        }
        if (opts.tlsCert) {
            args.push('--tlscert', opts.tlsCert);
        }
        if (opts.tlsKey) {
            args.push('--tlskey', opts.tlsKey);
        }
    }
    if (opts.tlsSkipVerify) {
        args.push('--tlsskipverify');
    }
    args.push('build', '--frontend', 'dockerfile.v0');
    args.push('--local', `context=${opts.contextPath}`);
    args.push('--local', `dockerfile=${opts.dockerfileDir}`);
    args.push('--opt', `filename=${opts.dockerfileName}`);
    if (opts.noCache) {
        args.push('--no-cache');
    }
    if (opts.platforms) {
        args.push('--opt', `platform=${opts.platforms}`);
    }
    if (opts.target) {
        args.push('--opt', `target=${opts.target}`);
    }
    for (const buildArg of opts.buildArgs) {
        args.push('--opt', `build-arg:${buildArg}`);
    }
    for (const secret of opts.secrets) {
        args.push('--secret', secret);
    }
    for (const ssh of opts.sshSpecs) {
        args.push('--ssh', ssh);
    }
    if (opts.importCache) {
        args.push('--import-cache', opts.importCache);
        if (opts.exportCache) {
            args.push('--export-cache', opts.exportCache);
        }
    }
    else if (opts.cacheDirFrom) {
        args.push('--import-cache', `type=local,src=${opts.cacheDirFrom}`);
        args.push('--export-cache', `type=local,dest=${opts.cacheDirTo},mode=${opts.cacheMode}`);
    }
    if ((_a = opts.output) === null || _a === void 0 ? void 0 : _a.trim()) {
        args.push('--output', opts.output.trim());
    }
    else {
        const nameParams = opts.imageTags.map((tag) => `name=${tag}`).join(',');
        args.push('--output', `type=image,${nameParams},push=${opts.push ? 'true' : 'false'}`);
    }
    args.push('--metadata-file', opts.metadataFile);
    const result = await exec.exec('buildctl', args);
    if (result !== 0) {
        throw new Error(`buildctl failed with exit code ${result}`);
    }
}
function readBuildkitDigest(metadataFile) {
    if (!fs.existsSync(metadataFile)) {
        return '';
    }
    try {
        const data = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
        return data['containerimage.digest'] || '';
    }
    catch (error) {
        core.warning(`Failed to parse BuildKit metadata file: ${error.message}`);
        return '';
    }
}
function writeBazelrc(port, readOnly, extraLines = '') {
    const bazelrcPath = path.join(currentHomeDir(), '.bazelrc');
    const remoteMaxConnections = parseInt(process.env.BORINGCACHE_BAZEL_REMOTE_MAX_CONNECTIONS || '', 10);
    const maxConnections = Number.isFinite(remoteMaxConnections) && remoteMaxConnections > 0
        ? remoteMaxConnections
        : 64;
    const normalizedExtraLines = extraLines
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    const configLines = [
        '',
        '# BoringCache remote cache',
        `build --remote_cache=http://127.0.0.1:${port}`,
        `build --remote_upload_local_results=${!readOnly}`,
        // Keep remote cache writes synchronous by default so seed/warm handoff
        // remains deterministic across isolated CI runners.
        'build --remote_cache_async=false',
        'build --remote_download_minimal',
        `build --remote_max_connections=${maxConnections}`,
    ];
    if (normalizedExtraLines.length > 0) {
        configLines.push(...normalizedExtraLines);
    }
    configLines.push('');
    const config = configLines.join('\n');
    fs.appendFileSync(bazelrcPath, config);
}
function resolveGradleHome(input) {
    const gradleHome = input || '~/.gradle';
    if (gradleHome.startsWith('~')) {
        return path.join(currentHomeDir(), gradleHome.slice(1));
    }
    return path.resolve(gradleHome);
}
function resolveUserPath(input, workingDirectory) {
    if (input.startsWith('~')) {
        return path.join(currentHomeDir(), input.slice(1));
    }
    if (path.isAbsolute(input)) {
        return input;
    }
    return path.resolve(workingDirectory, input);
}
function writeGradleInitScript(gradleHome, port, readOnly) {
    const initDir = path.join(gradleHome, 'init.d');
    fs.mkdirSync(initDir, { recursive: true });
    const initScript = `gradle.settingsEvaluated { settings ->
    settings.buildCache {
        remote(HttpBuildCache) {
            url = "http://127.0.0.1:${port}/cache/"
            push = ${!readOnly}
            allowInsecureProtocol = true
        }
    }
}
`;
    fs.writeFileSync(path.join(initDir, 'boringcache-cache.gradle'), initScript);
}
function enableGradleBuildCache(gradleHome) {
    fs.mkdirSync(gradleHome, { recursive: true });
    fs.appendFileSync(path.join(gradleHome, 'gradle.properties'), '\norg.gradle.caching=true\n');
}
function ensureMavenBuildCacheExtension(extensionsPath, version) {
    const extensionBlock = [
        '  <extension>',
        '    <groupId>org.apache.maven.extensions</groupId>',
        '    <artifactId>maven-build-cache-extension</artifactId>',
        `    <version>${version}</version>`,
        '  </extension>',
    ].join('\n');
    fs.mkdirSync(path.dirname(extensionsPath), { recursive: true });
    if (fs.existsSync(extensionsPath)) {
        const existing = fs.readFileSync(extensionsPath, 'utf8');
        if (existing.includes('<artifactId>maven-build-cache-extension</artifactId>')) {
            return;
        }
        if (existing.includes('</extensions>')) {
            fs.writeFileSync(extensionsPath, existing.replace('</extensions>', `${extensionBlock}\n</extensions>`));
            return;
        }
    }
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<extensions xmlns="http://maven.apache.org/EXTENSIONS/1.0.0"
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xsi:schemaLocation="http://maven.apache.org/EXTENSIONS/1.0.0 https://maven.apache.org/xsd/core-extensions-1.0.0.xsd">
${extensionBlock}
</extensions>
`;
    fs.writeFileSync(extensionsPath, content);
}
function writeMavenBuildCacheConfig(configPath, port, readOnly, cacheId) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<cache xmlns="http://maven.apache.org/BUILD-CACHE-CONFIG/1.2.0"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://maven.apache.org/BUILD-CACHE-CONFIG/1.2.0 https://maven.apache.org/xsd/build-cache-config-1.2.0.xsd">
  <configuration>
    <remote enabled="true" saveToRemote="${!readOnly}" transport="resolver" id="${cacheId}">
      <url>http://127.0.0.1:${port}</url>
    </remote>
  </configuration>
</cache>
`;
    fs.writeFileSync(configPath, content);
}
async function execRustBoringCache(args) {
    rustLastOutput = '';
    let output = '';
    const code = await execBoringCache(args, {
        silent: true,
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
    rustLastOutput = output;
    return code;
}
function wasRustCacheHit(exitCode) {
    if (exitCode !== 0) {
        return false;
    }
    if (!rustLastOutput) {
        return true;
    }
    return ![/Cache miss/i, /No cache entries/i, /Found 0\//i].some((pattern) => pattern.test(rustLastOutput));
}
function getCargoHome() {
    return process.env.CARGO_HOME || path.join(currentHomeDir(), '.cargo');
}
function configureCargoEnv() {
    const cargoHome = getCargoHome();
    process.env.CARGO_HOME = cargoHome;
    core.exportVariable('CARGO_HOME', cargoHome);
    core.addPath(path.join(cargoHome, 'bin'));
    core.exportVariable('CARGO_INCREMENTAL', '0');
    core.exportVariable('CARGO_TERM_COLOR', 'always');
}
async function setupRustToolchain(version, options) {
    const profile = options.profile || 'minimal';
    await exec.exec('rustup', ['toolchain', 'install', version, '--profile', profile, '--no-self-update']);
    await exec.exec('rustup', ['default', version]);
    for (const target of parseList(options.targets || '', /,/)) {
        await exec.exec('rustup', ['target', 'add', target]);
    }
    for (const component of parseList(options.components || '', /,/)) {
        await exec.exec('rustup', ['component', 'add', component]);
    }
    await exec.exec('rustc', ['--version']);
}
async function detectRustVersion(workingDir, inputVersion) {
    if (inputVersion) {
        return inputVersion;
    }
    const toolchainToml = path.join(workingDir, 'rust-toolchain.toml');
    try {
        const content = await fs.promises.readFile(toolchainToml, 'utf-8');
        const match = content.match(/channel\s*=\s*["']([^"']+)["']/);
        if (match === null || match === void 0 ? void 0 : match[1]) {
            return match[1];
        }
    }
    catch {
    }
    const toolchainFile = path.join(workingDir, 'rust-toolchain');
    try {
        return (await fs.promises.readFile(toolchainFile, 'utf-8')).trim();
    }
    catch {
    }
    const toolVersionsFile = path.join(workingDir, '.tool-versions');
    try {
        const content = await fs.promises.readFile(toolVersionsFile, 'utf-8');
        const rustLine = content.split('\n').find((line) => line.startsWith('rust '));
        if (rustLine) {
            return rustLine.split(/\s+/)[1].trim();
        }
    }
    catch {
    }
    return 'stable';
}
async function hasGitDependencies(lockPath) {
    try {
        const content = await fs.promises.readFile(lockPath, 'utf-8');
        return content.includes('source = "git+');
    }
    catch {
        return false;
    }
}
function getSccacheDir() {
    return process.env.SCCACHE_DIR || path.join(currentHomeDir(), '.cache', 'sccache');
}
function configureSccacheEnv(cacheSize) {
    const sccacheDir = getSccacheDir();
    process.env.RUSTC_WRAPPER = 'sccache';
    core.exportVariable('RUSTC_WRAPPER', 'sccache');
    process.env.SCCACHE_DIR = sccacheDir;
    core.exportVariable('SCCACHE_DIR', sccacheDir);
    process.env.SCCACHE_CACHE_SIZE = cacheSize;
    core.exportVariable('SCCACHE_CACHE_SIZE', cacheSize);
    core.exportVariable('CC', 'sccache cc');
    core.exportVariable('CXX', 'sccache c++');
    core.exportVariable('SCCACHE_IDLE_TIMEOUT', process.env.SCCACHE_IDLE_TIMEOUT || '0');
    fs.mkdirSync(sccacheDir, { recursive: true });
}
async function startSccacheServer() {
    await exec.exec('sccache', ['--start-server'], { ignoreReturnCode: true });
}
async function installSccache(versionInput = '0.14.0') {
    addLocalBinPaths();
    if (await (0, core_1.hasToolVersionOnPath)('sccache', versionInput)) {
        core.info(`Using existing sccache ${versionInput} from PATH`);
        return;
    }
    const normalizedVersion = versionInput.startsWith('v') ? versionInput : `v${versionInput}`;
    let assetName = null;
    if (process.platform === 'linux') {
        if (process.arch === 'x64') {
            assetName = `sccache-${normalizedVersion}-x86_64-unknown-linux-musl`;
        }
        else if (process.arch === 'arm64') {
            assetName = `sccache-${normalizedVersion}-aarch64-unknown-linux-musl`;
        }
    }
    else if (process.platform === 'darwin' && process.arch === 'arm64') {
        assetName = `sccache-${normalizedVersion}-aarch64-apple-darwin`;
    }
    else if (process.platform === 'win32' && process.arch === 'x64') {
        assetName = `sccache-${normalizedVersion}-x86_64-pc-windows-msvc`;
    }
    if (!assetName) {
        await exec.exec('cargo', ['install', 'sccache', '--locked']);
        return;
    }
    const extension = process.platform === 'win32' ? '.zip' : '.tar.gz';
    const url = `https://github.com/mozilla/sccache/releases/download/${normalizedVersion}/${assetName}${extension}`;
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sccache-'));
    const archivePath = path.join(tempDir, `sccache${extension}`);
    try {
        const curlCode = await exec.exec('curl', ['-sS', '--fail', '--location', '--output', archivePath, url], {
            ignoreReturnCode: true,
        });
        if (curlCode !== 0) {
            throw new Error(`Failed to download sccache from ${url}`);
        }
        if (process.platform === 'win32') {
            await exec.exec('unzip', ['-q', archivePath, '-d', tempDir]);
        }
        else {
            await exec.exec('tar', ['-xzf', archivePath, '-C', tempDir]);
        }
        const installDir = path.join(currentHomeDir(), '.local', 'bin');
        await fs.promises.mkdir(installDir, { recursive: true });
        const binaryName = process.platform === 'win32' ? 'sccache.exe' : 'sccache';
        const srcPath = path.join(tempDir, assetName, binaryName);
        const destPath = path.join(installDir, binaryName);
        await fs.promises.copyFile(srcPath, destPath);
        if (process.platform !== 'win32') {
            await fs.promises.chmod(destPath, 0o755);
        }
        core.addPath(installDir);
    }
    finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
}
async function stopSccacheServer() {
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
async function startPortableCacheProxy(workspace, port, tag, readOnly = false, proxyPlan) {
    const proxy = await (0, core_1.startRegistryProxy)(actionProxyOptions({
        command: 'cache-registry',
        workspace,
        tag,
        host: '127.0.0.1',
        port,
        noPlatform: true,
        noGit: true,
        readOnly,
    }, proxyPlan));
    return proxy;
}
function parseSccacheIntegerStat(output, label) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = output.match(new RegExp(`^${escaped}\\s+(\\d+)$`, 'm'));
    return match ? Number.parseInt(match[1], 10) : null;
}
function parseSccacheTextStat(output, label) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = output.match(new RegExp(`^${escaped}\\s+(.+)$`, 'm'));
    return match ? match[1].trim() : null;
}
function summarizeSccacheStats(output) {
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
async function checkRustTagHit(workspace, tag, { noPlatform = false, noGit = false } = {}) {
    const args = ['check', workspace, tag];
    if (noPlatform) {
        args.push('--no-platform');
    }
    if (noGit) {
        args.push('--no-git');
    }
    const exitCode = await execBoringCache(args, {
        ignoreReturnCode: true,
        silent: true,
    });
    return exitCode === 0;
}
function configureTurboRemoteEnv(apiUrl, token, team) {
    core.exportVariable('TURBO_API', apiUrl);
    core.exportVariable('TURBO_TOKEN', token);
    core.exportVariable('TURBO_TEAM', team || 'team_boringcache');
}
function resolveNodePackageManagerCacheDir(packageManager) {
    if (!packageManager) {
        return null;
    }
    switch (packageManager.name) {
        case 'pnpm':
            return process.env.PNPM_STORE_DIR || process.env.NPM_CONFIG_STORE_DIR || packageManager.cacheDir;
        case 'yarn':
            return process.env.YARN_CACHE_FOLDER || packageManager.cacheDir;
        case 'npm':
            return process.env.npm_config_cache || process.env.NPM_CONFIG_CACHE || packageManager.cacheDir;
    }
}
function configureNodePackageManagerEnv(packageManager) {
    if (!packageManager) {
        return null;
    }
    const cacheDir = resolveNodePackageManagerCacheDir(packageManager);
    if (!cacheDir) {
        return null;
    }
    ensureDir(cacheDir);
    switch (packageManager.name) {
        case 'pnpm':
            core.exportVariable('PNPM_STORE_DIR', cacheDir);
            core.exportVariable('NPM_CONFIG_STORE_DIR', cacheDir);
            break;
        case 'yarn':
            core.exportVariable('YARN_CACHE_FOLDER', cacheDir);
            core.exportVariable('YARN_ENABLE_GLOBAL_CACHE', 'false');
            break;
        case 'npm':
            core.exportVariable('npm_config_cache', cacheDir);
            core.exportVariable('NPM_CONFIG_CACHE', cacheDir);
            break;
    }
    return cacheDir;
}
async function ensureCorepackPackageManager(workingDirectory, packageManager, runtimeTools) {
    if (!packageManager || packageManager.name === 'npm' || runtimeTools.some((tool) => tool.name === packageManager.name)) {
        return;
    }
    const corepackEnabled = await exec.exec('corepack', ['enable'], { cwd: workingDirectory, ignoreReturnCode: true });
    if (corepackEnabled !== 0) {
        core.notice(`corepack enable failed for ${packageManager.name}; continuing without corepack bootstrap`);
        return;
    }
    if (packageManager.packageManagerField) {
        await exec.exec('corepack', ['install'], { cwd: workingDirectory, ignoreReturnCode: true });
        return;
    }
    if (packageManager.version) {
        await exec.exec('corepack', ['prepare', `${packageManager.name}@${packageManager.version}`, '--activate'], { cwd: workingDirectory, ignoreReturnCode: true });
    }
}
function configureSccacheProxyEnv(port) {
    const endpoint = `http://127.0.0.1:${port}/`;
    core.exportVariable('SCCACHE_WEBDAV_ENDPOINT', endpoint);
    core.exportVariable('RUSTC_WRAPPER', 'sccache');
    core.exportVariable('CC', 'sccache cc');
    core.exportVariable('CXX', 'sccache c++');
    core.exportVariable('SCCACHE_IDLE_TIMEOUT', process.env.SCCACHE_IDLE_TIMEOUT || '0');
}
function overrideRustArchiveEntry(entry, inputName) {
    const overrideTag = core.getInput(inputName).trim();
    if (!overrideTag) {
        return entry;
    }
    return {
        ...entry,
        tag: overrideTag,
        tagPathPair: `${overrideTag}:${entry.path}`,
    };
}
function getRustArchiveEntry(entries, requested, description) {
    var _a;
    const entry = entries.get(requested);
    if (!((_a = entry === null || entry === void 0 ? void 0 : entry.path) === null || _a === void 0 ? void 0 : _a.trim())) {
        throw new Error(`CLI dry-run did not resolve a ${description} path for ${requested}.`);
    }
    return entry;
}
function saveRustArchiveEntryState(key, entry) {
    saveModeState(`${key}-tag`, entry.tag);
    saveModeState(`${key}-path`, entry.path);
}
function readRustArchiveEntryState(key) {
    const tag = getModeState(`${key}-tag`);
    const entryPath = getModeState(`${key}-path`);
    if (!tag || !entryPath) {
        return null;
    }
    return {
        requested: key,
        tag,
        path: entryPath,
        tagPathPair: `${tag}:${entryPath}`,
    };
}
function buildRustCacheArgs(action, workspace, entry, verbose, exclude = '') {
    const args = [action, workspace, entry.tagPathPair];
    if (verbose) {
        args.push('--verbose');
    }
    if (action === 'save' && exclude) {
        args.push('--exclude', exclude);
    }
    return args;
}
function toolEnabled(plan, toolName) {
    return plan.runtimeTools.some((tool) => tool.name === toolName);
}
async function runDockerRestore(plan, inputs) {
    var _a;
    const context = path.resolve(plan.workingDirectory, core.getInput('context') || '.');
    const dockerfile = core.getInput('dockerfile') || 'Dockerfile';
    const dockerCommand = core.getInput('docker-command') || 'build';
    const shouldBuild = dockerCommand !== 'setup';
    const imageInput = core.getInput('image') || '';
    const image = shouldBuild
        ? core.getInput('image', { required: true })
        : (imageInput || 'boringcache/docker-setup');
    const tags = parseList(core.getInput('tags') || 'latest');
    const buildArgs = parseMultiline(core.getInput('build-args') || '');
    const secrets = parseMultiline(core.getInput('secrets') || '');
    const target = core.getInput('target') || '';
    const platforms = core.getInput('platforms') || '';
    const push = parseBoolean(core.getInput('push'), false);
    const load = parseBoolean(core.getInput('load'), true) && !platforms;
    const noCache = parseBoolean(core.getInput('no-cache'), false);
    const cacheMode = core.getInput('cache-mode') || 'max';
    const driver = core.getInput('driver') || 'docker-container';
    const driverOpts = parseMultiline(core.getInput('driver-opts') || '');
    const buildkitdConfigInline = core.getInput('buildkitd-config-inline') || '';
    const cacheBackend = core.getInput('cache-backend') || 'registry';
    const registryTagInput = core.getInput('registry-tag') || '';
    const registryRefTagInput = core.getInput('registry-ref-tag') || '';
    const localCacheTag = inputs.cacheTag || slugify(image);
    const cacheFlags = { verbose: inputs.verbose, exclude: inputs.exclude };
    const useRegistryProxy = cacheBackend !== 'local';
    let registryVerification = null;
    let resolvedWorkspace = plan.workspace;
    let resolvedCacheTag = localCacheTag;
    saveModeState('workspace', plan.workspace);
    saveModeState('cache-tag', localCacheTag);
    saveModeState('verbose', String(inputs.verbose));
    saveModeState('exclude', inputs.exclude);
    const builderName = await setupBuildxBuilder(driver, driverOpts, buildkitdConfigInline, useRegistryProxy);
    saveModeState('builder-name', builderName);
    core.setOutput('buildx-name', builderName);
    core.setOutput('buildx-platforms', await getBuilderPlatforms(builderName));
    await setupQemuIfNeeded(platforms);
    if (useRegistryProxy) {
        let proxyBindHost = '127.0.0.1';
        let refHost = '127.0.0.1';
        if (driver === 'docker-container') {
            const containerName = `buildx_buildkit_${builderName}0`;
            const networkMode = await getContainerNetworkMode(containerName);
            if (networkMode !== 'host') {
                proxyBindHost = '0.0.0.0';
                refHost = await getContainerGateway(containerName);
            }
        }
        const requestedPort = parseInt(inputs.proxyPort || '5000', 10);
        const dockerPlan = await resolveDockerCliPlan(plan.workspace, plan.workingDirectory, getEffectiveRegistryTag(localCacheTag, registryTagInput), requestedPort, proxyBindHost, refHost, inputs.proxyNoPlatform, inputs.proxyNoGit, inputs.readOnly, cacheMode, registryRefTagInput || DEFAULT_REGISTRY_CACHE_REF_TAG, inputs.ociHydration);
        const cacheTag = dockerPlan.tag;
        const proxy = await (0, core_1.startRegistryProxy)(actionProxyOptions({
            command: 'cache-registry',
            workspace: dockerPlan.workspace,
            tag: cacheTag,
            host: proxyBindHost,
            port: dockerPlan.proxy.port,
            noGit: dockerPlan.proxy.no_git,
            noPlatform: dockerPlan.proxy.no_platform,
            verbose: inputs.verbose,
            readOnly: dockerPlan.proxy.read_only,
        }, dockerPlan.proxy));
        saveModeState('proxy-pid', String(proxy.pid));
        saveProxyModeState(proxy.port);
        saveModeState('workspace', dockerPlan.workspace);
        saveModeState('cache-tag', cacheTag);
        setProxyOutputs(proxy.port);
        resolvedWorkspace = dockerPlan.workspace;
        resolvedCacheTag = cacheTag;
        registryVerification = {
            noPlatform: dockerPlan.proxy.no_platform,
            noGit: dockerPlan.proxy.no_git,
            saveExpected: !dockerPlan.proxy.read_only,
        };
        setRegistryCacheOutputs({
            ref: dockerPlan.oci_cache.registry_ref,
            from: `${dockerPlan.oci_cache.cache_from},registry.insecure=true`,
            to: dockerPlan.oci_cache.cache_to
                ? `${dockerPlan.oci_cache.cache_to},registry.insecure=true`
                : undefined,
            ociCache: dockerPlan.oci_cache,
        });
        if (shouldBuild) {
            await buildDockerImage({
                dockerfile,
                context,
                image,
                tags,
                buildArgs,
                secrets,
                target,
                platforms,
                push,
                load,
                noCache,
                builder: builderName,
                cacheMode,
                cacheFrom: `${dockerPlan.oci_cache.cache_from},registry.insecure=true`,
                cacheTo: dockerPlan.oci_cache.cache_to
                    ? `${dockerPlan.oci_cache.cache_to},registry.insecure=true`
                    : undefined,
            });
        }
    }
    else {
        ensureDir(DOCKER_CACHE_DIR_FROM);
        ensureDir(DOCKER_CACHE_DIR_TO);
        saveModeState('cache-dir', DOCKER_CACHE_DIR_TO);
        await restoreSimpleCache(plan.workspace, localCacheTag, DOCKER_CACHE_DIR_FROM, cacheFlags);
        setLocalCacheOutputs(DOCKER_CACHE_DIR_FROM, DOCKER_CACHE_DIR_TO, cacheMode);
        if (shouldBuild) {
            await buildDockerImage({
                dockerfile,
                context,
                image,
                tags,
                buildArgs,
                secrets,
                target,
                platforms,
                push,
                load,
                noCache,
                builder: builderName,
                cacheMode,
                cacheDirFrom: DOCKER_CACHE_DIR_FROM,
                cacheDirTo: DOCKER_CACHE_DIR_TO,
            });
        }
    }
    if (shouldBuild) {
        const { imageId, digest } = readDockerMetadata();
        core.setOutput('image-id', imageId);
        core.setOutput('digest', digest);
    }
    core.setOutput('workspace', resolvedWorkspace);
    core.setOutput('cache-tag', resolvedCacheTag);
    return {
        cacheTag: resolvedCacheTag,
        verificationSpecs: [{
                tag: resolvedCacheTag,
                noPlatform: (registryVerification === null || registryVerification === void 0 ? void 0 : registryVerification.noPlatform) || false,
                noGit: (registryVerification === null || registryVerification === void 0 ? void 0 : registryVerification.noGit) || false,
                pathHint: plan.workingDirectory,
                // docker-command=setup defers the build to later workflow steps, so treat
                // this as save-expected in write-capable runs and verify after post-save.
                saveExpected: (_a = registryVerification === null || registryVerification === void 0 ? void 0 : registryVerification.saveExpected) !== null && _a !== void 0 ? _a : !inputs.readOnly,
            }],
    };
}
async function runDockerSave() {
    const builderName = getModeState('builder-name');
    try {
        const proxyPid = getModeState('proxy-pid');
        if (proxyPid) {
            await (0, core_1.stopRegistryProxy)(parseInt(proxyPid, 10));
            return;
        }
        const workspace = getModeState('workspace');
        const cacheDir = getModeState('cache-dir');
        const cacheTag = getModeState('cache-tag');
        if (!workspace || !cacheDir || !cacheTag) {
            return;
        }
        addLocalBinPaths();
        await saveSimpleCache(workspace, cacheTag, cacheDir, {
            verbose: getModeState('verbose') === 'true',
            exclude: getModeState('exclude'),
        });
    }
    finally {
        await cleanupBuildxBuilder(builderName);
    }
}
async function runBuildkitRestore(plan, inputs) {
    var _a;
    const workspaceRoot = process.env.GITHUB_WORKSPACE || plan.workingDirectory;
    const contextInput = core.getInput('context') || '.';
    const contextPath = path.resolve(plan.workingDirectory, contextInput);
    const dockerfileInput = core.getInput('dockerfile') || 'Dockerfile';
    const dockerfilePath = path.resolve(plan.workingDirectory, contextInput, dockerfileInput);
    const dockerfileDir = path.dirname(dockerfilePath);
    const dockerfileName = path.basename(dockerfilePath);
    if (!fs.existsSync(contextPath)) {
        throw new Error(`Context path does not exist: ${contextPath}`);
    }
    if (!fs.existsSync(dockerfilePath)) {
        throw new Error(`Dockerfile does not exist: ${dockerfilePath}`);
    }
    const image = core.getInput('image', { required: true });
    const tags = parseList(core.getInput('tags') || 'latest');
    const imageTags = tags.length > 0 ? tags.map((tag) => `${image}:${tag}`) : [`${image}:latest`];
    const push = parseBoolean(core.getInput('push'), false);
    const output = core.getInput('output') || '';
    const buildArgs = parseMultiline(core.getInput('build-args') || '');
    const secrets = parseMultiline(core.getInput('secrets') || '');
    const sshSpecs = parseMultiline(core.getInput('ssh') || '');
    const target = core.getInput('target') || '';
    const platforms = core.getInput('platforms') || '';
    const noCache = parseBoolean(core.getInput('no-cache'), false);
    const cacheMode = core.getInput('cache-mode') || 'max';
    const buildkitHost = core.getInput('buildkit-host', { required: true });
    const tlsCaInput = core.getInput('buildkit-tls-ca') || '';
    const tlsCertInput = core.getInput('buildkit-tls-cert') || '';
    const tlsKeyInput = core.getInput('buildkit-tls-key') || '';
    const tlsSkipVerify = parseBoolean(core.getInput('buildkit-tls-skip-verify'), false);
    const cacheBackend = core.getInput('cache-backend') || 'registry';
    const registryTagInput = core.getInput('registry-tag') || '';
    const registryRefTagInput = core.getInput('registry-ref-tag') || '';
    const localCacheTag = inputs.cacheTag || slugify(image);
    const cacheFlags = { verbose: inputs.verbose, exclude: inputs.exclude };
    const useRegistryProxy = cacheBackend !== 'local';
    let registryVerification = null;
    let resolvedWorkspace = plan.workspace;
    let resolvedCacheTag = localCacheTag;
    saveModeState('workspace', plan.workspace);
    saveModeState('cache-tag', localCacheTag);
    saveModeState('verbose', String(inputs.verbose));
    saveModeState('exclude', inputs.exclude);
    if (fs.existsSync(BUILDKIT_METADATA_FILE)) {
        fs.rmSync(BUILDKIT_METADATA_FILE);
    }
    await installBuildctl();
    const tlsCa = materializeMaybeFile(tlsCaInput, 'buildkit-ca.pem', workspaceRoot);
    const tlsCert = materializeMaybeFile(tlsCertInput, 'buildkit-cert.pem', workspaceRoot);
    const tlsKey = materializeMaybeFile(tlsKeyInput, 'buildkit-key.pem', workspaceRoot);
    if (useRegistryProxy) {
        let proxyBindHost = '127.0.0.1';
        let refHost = '127.0.0.1';
        if (buildkitHost.startsWith('docker-container://')) {
            const containerName = buildkitHost.replace('docker-container://', '');
            const networkMode = await getContainerNetworkMode(containerName);
            if (networkMode !== 'host') {
                proxyBindHost = '0.0.0.0';
                refHost = await getContainerGateway(containerName);
            }
        }
        const requestedPort = parseInt(inputs.proxyPort || '5000', 10);
        const dockerPlan = await resolveDockerCliPlan(plan.workspace, plan.workingDirectory, getEffectiveRegistryTag(localCacheTag, registryTagInput), requestedPort, proxyBindHost, refHost, inputs.proxyNoPlatform, inputs.proxyNoGit, inputs.readOnly, cacheMode, registryRefTagInput || DEFAULT_REGISTRY_CACHE_REF_TAG, inputs.ociHydration);
        const cacheTag = dockerPlan.tag;
        const proxy = await (0, core_1.startRegistryProxy)(actionProxyOptions({
            command: 'cache-registry',
            workspace: dockerPlan.workspace,
            tag: cacheTag,
            host: proxyBindHost,
            port: dockerPlan.proxy.port,
            noGit: dockerPlan.proxy.no_git,
            noPlatform: dockerPlan.proxy.no_platform,
            verbose: inputs.verbose,
            readOnly: dockerPlan.proxy.read_only,
        }, dockerPlan.proxy));
        saveModeState('proxy-pid', String(proxy.pid));
        saveProxyModeState(proxy.port);
        saveModeState('workspace', dockerPlan.workspace);
        saveModeState('cache-tag', cacheTag);
        setProxyOutputs(proxy.port);
        resolvedWorkspace = dockerPlan.workspace;
        resolvedCacheTag = cacheTag;
        registryVerification = {
            noPlatform: dockerPlan.proxy.no_platform,
            noGit: dockerPlan.proxy.no_git,
            saveExpected: !dockerPlan.proxy.read_only,
        };
        setRegistryCacheOutputs({
            ref: dockerPlan.oci_cache.registry_ref,
            from: `${dockerPlan.oci_cache.cache_from},registry.insecure=true`,
            to: dockerPlan.oci_cache.cache_to
                ? `${dockerPlan.oci_cache.cache_to},registry.insecure=true`
                : undefined,
            ociCache: dockerPlan.oci_cache,
        });
        await buildWithBuildctl({
            addr: buildkitHost,
            tlsCa,
            tlsCert,
            tlsKey,
            tlsSkipVerify,
            contextPath,
            dockerfileDir,
            dockerfileName,
            buildArgs,
            secrets,
            sshSpecs,
            target,
            platforms,
            cacheMode,
            importCache: `${dockerPlan.oci_cache.cache_from},registry.insecure=true`,
            exportCache: dockerPlan.oci_cache.cache_to
                ? `${dockerPlan.oci_cache.cache_to},registry.insecure=true`
                : undefined,
            output,
            imageTags,
            push,
            noCache,
            metadataFile: BUILDKIT_METADATA_FILE,
        });
    }
    else {
        ensureDir(BUILDKIT_CACHE_DIR_FROM);
        ensureDir(BUILDKIT_CACHE_DIR_TO);
        saveModeState('cache-dir', BUILDKIT_CACHE_DIR_TO);
        await restoreSimpleCache(plan.workspace, localCacheTag, BUILDKIT_CACHE_DIR_FROM, cacheFlags);
        setLocalCacheOutputs(BUILDKIT_CACHE_DIR_FROM, BUILDKIT_CACHE_DIR_TO, cacheMode);
        await buildWithBuildctl({
            addr: buildkitHost,
            tlsCa,
            tlsCert,
            tlsKey,
            tlsSkipVerify,
            contextPath,
            dockerfileDir,
            dockerfileName,
            buildArgs,
            secrets,
            sshSpecs,
            target,
            platforms,
            cacheMode,
            cacheDirFrom: BUILDKIT_CACHE_DIR_FROM,
            cacheDirTo: BUILDKIT_CACHE_DIR_TO,
            output,
            imageTags,
            push,
            noCache,
            metadataFile: BUILDKIT_METADATA_FILE,
        });
    }
    core.setOutput('digest', readBuildkitDigest(BUILDKIT_METADATA_FILE));
    core.setOutput('workspace', resolvedWorkspace);
    core.setOutput('cache-tag', resolvedCacheTag);
    return {
        cacheTag: resolvedCacheTag,
        verificationSpecs: [{
                tag: resolvedCacheTag,
                noPlatform: (registryVerification === null || registryVerification === void 0 ? void 0 : registryVerification.noPlatform) || false,
                noGit: (registryVerification === null || registryVerification === void 0 ? void 0 : registryVerification.noGit) || false,
                pathHint: plan.workingDirectory,
                saveExpected: (_a = registryVerification === null || registryVerification === void 0 ? void 0 : registryVerification.saveExpected) !== null && _a !== void 0 ? _a : !inputs.readOnly,
            }],
    };
}
async function runBuildkitSave() {
    const proxyPid = getModeState('proxy-pid');
    if (proxyPid) {
        await (0, core_1.stopRegistryProxy)(parseInt(proxyPid, 10));
        return;
    }
    const workspace = getModeState('workspace');
    const cacheDir = getModeState('cache-dir');
    const cacheTag = getModeState('cache-tag');
    if (!workspace || !cacheDir || !cacheTag) {
        return;
    }
    addLocalBinPaths();
    await saveSimpleCache(workspace, cacheTag, cacheDir, {
        verbose: getModeState('verbose') === 'true',
        exclude: getModeState('exclude'),
    });
}
async function runBazelRestore(plan, inputs) {
    var _a, _b;
    const inputVersion = core.getInput('bazel-version') || '';
    const bazelrcLines = core.getInput('bazelrc-lines') || '';
    const runtimeVersion = ((_a = plan.runtimeTools.find((tool) => tool.name === 'bazel')) === null || _a === void 0 ? void 0 : _a.version) || '';
    const bazelVersion = inputVersion || runtimeVersion;
    const requestedPort = parseInt(inputs.proxyPort || '0', 10) || await (0, core_1.findAvailablePort)();
    const proxyPlan = await resolveAdapterCliPlan('bazel', plan.workspace, plan.workingDirectory, inputs.cacheTag, requestedPort, inputs.proxyNoPlatform, inputs.proxyNoGit, inputs.readOnly);
    const workspace = proxyPlan.workspace;
    const cacheTag = proxyPlan.tag;
    saveModeState('proxy-pid', '');
    if (bazelVersion) {
        core.exportVariable('USE_BAZEL_VERSION', bazelVersion);
    }
    const proxy = await (0, core_1.startRegistryProxy)(actionProxyOptions({
        command: 'cache-registry',
        workspace,
        tag: cacheTag,
        host: '127.0.0.1',
        port: proxyPlan.proxy.port,
        noGit: proxyPlan.proxy.no_git,
        noPlatform: proxyPlan.proxy.no_platform,
        verbose: inputs.verbose,
        readOnly: proxyPlan.proxy.read_only,
    }, proxyPlan.proxy));
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy.port);
    writeBazelrc(proxy.port, (_b = proxy.readOnly) !== null && _b !== void 0 ? _b : proxyPlan.proxy.read_only, bazelrcLines);
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('workspace', workspace);
    return {
        cacheTag,
        verificationSpecs: [{
                tag: cacheTag,
                noPlatform: proxyPlan.proxy.no_platform,
                noGit: proxyPlan.proxy.no_git,
                pathHint: plan.workingDirectory,
                saveExpected: !proxyPlan.proxy.read_only,
            }],
    };
}
async function runGradleRestore(plan, inputs) {
    var _a;
    const requestedPort = parseInt(inputs.proxyPort || '0', 10) || await (0, core_1.findAvailablePort)();
    const proxyPlan = await resolveAdapterCliPlan('gradle', plan.workspace, plan.workingDirectory, inputs.cacheTag, requestedPort, inputs.proxyNoPlatform, inputs.proxyNoGit, inputs.readOnly);
    const workspace = proxyPlan.workspace;
    const cacheTag = proxyPlan.tag;
    const gradleHome = resolveGradleHome(core.getInput('gradle-home') || '');
    const enableBuildCache = parseBoolean(core.getInput('enable-build-cache'), true);
    const proxy = await (0, core_1.startRegistryProxy)(actionProxyOptions({
        command: 'cache-registry',
        workspace,
        tag: cacheTag,
        host: '127.0.0.1',
        port: proxyPlan.proxy.port,
        noGit: proxyPlan.proxy.no_git,
        noPlatform: proxyPlan.proxy.no_platform,
        verbose: inputs.verbose,
        readOnly: proxyPlan.proxy.read_only,
    }, proxyPlan.proxy));
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy.port);
    writeGradleInitScript(gradleHome, proxy.port, (_a = proxy.readOnly) !== null && _a !== void 0 ? _a : proxyPlan.proxy.read_only);
    if (enableBuildCache) {
        enableGradleBuildCache(gradleHome);
    }
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('workspace', workspace);
    return {
        cacheTag,
        verificationSpecs: [{
                tag: cacheTag,
                noPlatform: proxyPlan.proxy.no_platform,
                noGit: proxyPlan.proxy.no_git,
                pathHint: plan.workingDirectory,
                saveExpected: !proxyPlan.proxy.read_only,
            }],
    };
}
async function runMavenRestore(plan, inputs) {
    var _a;
    const requestedPort = parseInt(inputs.proxyPort || '0', 10) || await (0, core_1.findAvailablePort)();
    const proxyPlan = await resolveAdapterCliPlan('maven', plan.workspace, plan.workingDirectory, inputs.cacheTag, requestedPort, inputs.proxyNoPlatform, inputs.proxyNoGit, inputs.readOnly);
    const workspace = proxyPlan.workspace;
    const cacheTag = proxyPlan.tag;
    const workingDirectory = plan.workingDirectory;
    const extensionsPath = resolveUserPath(core.getInput('maven-extensions-path') || '.mvn/extensions.xml', workingDirectory);
    const buildCacheConfigPath = resolveUserPath(core.getInput('maven-build-cache-config-path') || '.mvn/maven-build-cache-config.xml', workingDirectory);
    const localRepo = resolveUserPath(core.getInput('maven-local-repo') || '~/.m2/repository', workingDirectory);
    const extensionVersion = core.getInput('maven-build-cache-extension-version') || '1.2.2';
    const cacheId = core.getInput('maven-build-cache-id') || 'boringcache';
    const proxy = await (0, core_1.startRegistryProxy)(actionProxyOptions({
        command: 'cache-registry',
        workspace,
        tag: cacheTag,
        host: '127.0.0.1',
        port: proxyPlan.proxy.port,
        noGit: proxyPlan.proxy.no_git,
        noPlatform: proxyPlan.proxy.no_platform,
        verbose: inputs.verbose,
        readOnly: proxyPlan.proxy.read_only,
    }, proxyPlan.proxy));
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy.port);
    ensureMavenBuildCacheExtension(extensionsPath, extensionVersion);
    writeMavenBuildCacheConfig(buildCacheConfigPath, proxy.port, (_a = proxy.readOnly) !== null && _a !== void 0 ? _a : proxyPlan.proxy.read_only, cacheId);
    ensureDir(localRepo);
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('maven-extensions-path', extensionsPath);
    core.setOutput('maven-build-cache-config-path', buildCacheConfigPath);
    core.setOutput('maven-local-repo', localRepo);
    core.setOutput('workspace', workspace);
    return {
        cacheTag,
        verificationSpecs: [{
                tag: cacheTag,
                noPlatform: proxyPlan.proxy.no_platform,
                noGit: proxyPlan.proxy.no_git,
                pathHint: plan.workingDirectory,
                saveExpected: !proxyPlan.proxy.read_only,
            }],
    };
}
async function runTurboProxyRestore(plan, inputs) {
    const turboApiUrl = core.getInput('turbo-api-url') || '';
    const turboToken = core.getInput('turbo-token') || 'boringcache';
    const turboTeam = core.getInput('turbo-team') || '';
    const preferredPort = parseInt(core.getInput('turbo-port') || inputs.proxyPort || '4227', 10);
    const turboPlan = await resolveAdapterCliPlan('turbo', plan.workspace, plan.workingDirectory, inputs.cacheTag, preferredPort, false, false, inputs.readOnly);
    const workspace = turboPlan.workspace;
    const cacheTag = turboPlan.tag;
    const packageManager = await (0, utils_1.detectNodePackageManager)(plan.workingDirectory);
    const packageManagerCacheDir = configureNodePackageManagerEnv(packageManager);
    await ensureCorepackPackageManager(plan.workingDirectory, packageManager, plan.runtimeTools);
    if (packageManager) {
        core.setOutput('package-manager', packageManager.name);
        core.setOutput('package-manager-cache-dir', packageManagerCacheDir || packageManager.cacheDir);
    }
    if (turboApiUrl) {
        configureTurboRemoteEnv(turboApiUrl, turboToken, turboTeam);
        core.setOutput('workspace', workspace);
        core.setOutput('cache-tag', cacheTag);
        return { cacheTag, verificationSpecs: [] };
    }
    let proxy;
    try {
        proxy = await startPortableCacheProxy(workspace, turboPlan.proxy.port || preferredPort, cacheTag, turboPlan.proxy.read_only, turboPlan.proxy);
    }
    catch {
        proxy = await startPortableCacheProxy(workspace, await (0, core_1.findAvailablePort)(), cacheTag, turboPlan.proxy.read_only, turboPlan.proxy);
    }
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy.port);
    configureTurboRemoteEnv(`http://127.0.0.1:${proxy.port}`, turboToken, turboTeam);
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('workspace', workspace);
    return {
        cacheTag,
        verificationSpecs: [{
                tag: cacheTag,
                noPlatform: true,
                noGit: true,
                pathHint: plan.workingDirectory,
                saveExpected: !inputs.readOnly,
            }],
    };
}
async function runRustRestore(plan, inputs) {
    var _a, _b;
    const cacheTagPrefix = (inputs.cacheTag || plan.cacheTagPrefix || '').trim();
    const inputVersion = core.getInput('rust-version') || core.getInput('toolchain');
    const workingDir = plan.workingDirectory;
    const cacheCargo = core.getInput('cache-cargo') !== 'false';
    const cacheCargoBin = core.getInput('cache-cargo-bin') === 'true';
    const cacheTarget = core.getInput('cache-target') !== 'false';
    const useSccache = core.getInput('sccache') === 'true';
    const sccacheVersion = core.getInput('sccache-version') || '0.14.0';
    const sccacheMode = core.getInput('sccache-mode') || 'local';
    const sccacheCacheSize = core.getInput('sccache-cache-size') || '5G';
    const targets = core.getInput('targets');
    const components = core.getInput('components');
    const profile = core.getInput('profile') || 'minimal';
    const rustVersion = await detectRustVersion(workingDir, inputVersion);
    configureCargoEnv();
    const rustMajorMinor = ((_a = rustVersion.match(/^(\d+\.\d+)/)) === null || _a === void 0 ? void 0 : _a[1]) || rustVersion;
    const rustToolTagSuffix = `rust${rustMajorMinor}`;
    const lockPath = path.join(workingDir, 'Cargo.lock');
    const hasGitDeps = cacheCargo && await hasGitDependencies(lockPath);
    if (useSccache && sccacheMode !== 'proxy') {
        configureSccacheEnv(sccacheCacheSize);
    }
    const rustEntryIds = [];
    if (cacheCargo) {
        rustEntryIds.push('cargo-registry');
        if (hasGitDeps) {
            rustEntryIds.push('cargo-git');
        }
    }
    if (cacheCargoBin) {
        rustEntryIds.push('cargo-bin');
    }
    if (cacheTarget) {
        rustEntryIds.push('target');
    }
    if (useSccache) {
        rustEntryIds.push('sccache-dir');
    }
    const rustEntriesPlan = rustEntryIds.length > 0
        ? await (0, utils_1.resolveCliArchiveEntries)(workingDir, {
            workspaceInput: inputs.workspace.trim(),
            entryIds: rustEntryIds,
            cacheTag: cacheTagPrefix,
            toolTagSuffix: rustToolTagSuffix,
            fallbackWorkspace: plan.workspace,
        })
        : { workspace: plan.workspace, entries: [], envVars: {} };
    for (const [key, value] of Object.entries(rustEntriesPlan.envVars)) {
        core.exportVariable(key, value);
    }
    const rustEntries = new Map(rustEntriesPlan.entries.map((entry) => [entry.requested, entry]));
    const workspace = rustEntriesPlan.workspace || plan.workspace;
    const cargoRegistryEntry = cacheCargo
        ? overrideRustArchiveEntry(getRustArchiveEntry(rustEntries, 'cargo-registry', 'cargo registry cache'), 'cargo-tag')
        : null;
    const cargoGitEntry = cacheCargo && hasGitDeps
        ? overrideRustArchiveEntry(getRustArchiveEntry(rustEntries, 'cargo-git', 'cargo git cache'), 'cargo-git-tag')
        : null;
    const cargoBinEntry = cacheCargoBin
        ? overrideRustArchiveEntry(getRustArchiveEntry(rustEntries, 'cargo-bin', 'cargo bin cache'), 'cargo-bin-tag')
        : null;
    const targetEntry = cacheTarget
        ? overrideRustArchiveEntry(getRustArchiveEntry(rustEntries, 'target', 'Rust target cache'), 'target-tag')
        : null;
    const sccacheEntry = useSccache
        ? overrideRustArchiveEntry(getRustArchiveEntry(rustEntries, 'sccache-dir', 'sccache cache'), 'sccache-tag')
        : null;
    core.setOutput('workspace', workspace);
    core.setOutput('rust-version', rustVersion);
    core.setOutput('cache-tag', cacheTagPrefix);
    core.setOutput('cargo-tag', (cargoRegistryEntry === null || cargoRegistryEntry === void 0 ? void 0 : cargoRegistryEntry.tag) || '');
    core.setOutput('cargo-git-tag', (cargoGitEntry === null || cargoGitEntry === void 0 ? void 0 : cargoGitEntry.tag) || '');
    core.setOutput('cargo-bin-tag', (cargoBinEntry === null || cargoBinEntry === void 0 ? void 0 : cargoBinEntry.tag) || '');
    core.setOutput('target-tag', (targetEntry === null || targetEntry === void 0 ? void 0 : targetEntry.tag) || '');
    core.setOutput('sccache-tag', (sccacheEntry === null || sccacheEntry === void 0 ? void 0 : sccacheEntry.tag) || '');
    saveModeState('workspace', workspace);
    saveModeState('cache-tag-prefix', cacheTagPrefix);
    saveModeState('rust-version', rustVersion);
    saveModeState('working-dir', workingDir);
    saveModeState('cache-cargo', String(cacheCargo));
    saveModeState('cache-cargo-bin', String(cacheCargoBin));
    saveModeState('cache-target', String(cacheTarget));
    saveModeState('use-sccache', String(useSccache));
    saveModeState('sccache-mode', sccacheMode);
    saveModeState('verbose', String(inputs.verbose));
    saveModeState('skipped-verify-tags', '');
    let registryRestored = false;
    let cargoGitRestored = false;
    let cargoBinRestored = false;
    let targetRestored = false;
    let sccacheRestored = false;
    if (cargoRegistryEntry) {
        const registryResult = await execRustBoringCache(buildRustCacheArgs('restore', workspace, cargoRegistryEntry, inputs.verbose));
        registryRestored = wasRustCacheHit(registryResult);
        saveRustArchiveEntryState('cargo-registry', cargoRegistryEntry);
    }
    if (cargoGitEntry) {
        const cargoGitResult = await execRustBoringCache(buildRustCacheArgs('restore', workspace, cargoGitEntry, inputs.verbose));
        cargoGitRestored = wasRustCacheHit(cargoGitResult);
        saveRustArchiveEntryState('cargo-git', cargoGitEntry);
    }
    if (cargoBinEntry) {
        const binResult = await execRustBoringCache(buildRustCacheArgs('restore', workspace, cargoBinEntry, inputs.verbose));
        cargoBinRestored = wasRustCacheHit(binResult);
        saveRustArchiveEntryState('cargo-bin', cargoBinEntry);
    }
    if (targetEntry) {
        const targetResult = await execRustBoringCache(buildRustCacheArgs('restore', workspace, targetEntry, inputs.verbose));
        targetRestored = wasRustCacheHit(targetResult);
        saveRustArchiveEntryState('target', targetEntry);
    }
    if (useSccache && sccacheEntry) {
        await installSccache(sccacheVersion);
        if (sccacheMode === 'proxy') {
            const requestedPort = parseInt(inputs.proxyPort || '0', 10) || await (0, core_1.findAvailablePort)();
            const proxyPlan = await resolveAdapterCliPlan('sccache', workspace, workingDir, sccacheEntry.tag, requestedPort, true, true, inputs.readOnly);
            sccacheRestored = await checkRustTagHit(proxyPlan.workspace, proxyPlan.tag, {
                noPlatform: proxyPlan.proxy.no_platform,
                noGit: proxyPlan.proxy.no_git,
            });
            const proxy = await (0, core_1.startRegistryProxy)(actionProxyOptions({
                command: 'cache-registry',
                workspace: proxyPlan.workspace,
                tag: proxyPlan.tag,
                host: '127.0.0.1',
                port: proxyPlan.proxy.port,
                noGit: proxyPlan.proxy.no_git,
                noPlatform: proxyPlan.proxy.no_platform,
                verbose: inputs.verbose,
                readOnly: proxyPlan.proxy.read_only,
            }, proxyPlan.proxy));
            configureSccacheProxyEnv(proxy.port);
            await startSccacheServer();
            saveModeState('proxy-pid', String(proxy.pid));
            saveProxyModeState(proxy.port);
            saveRustArchiveEntryState('sccache', {
                ...sccacheEntry,
                tag: proxyPlan.tag,
                tagPathPair: `${proxyPlan.tag}:${sccacheEntry.path}`,
            });
            saveModeState('sccache-preflight-hit', String(sccacheRestored));
            setProxyOutputs(proxy.port);
        }
        else {
            const sccacheResult = await execRustBoringCache(buildRustCacheArgs('restore', workspace, sccacheEntry, inputs.verbose));
            sccacheRestored = wasRustCacheHit(sccacheResult);
            await startSccacheServer();
            saveRustArchiveEntryState('sccache', sccacheEntry);
            saveModeState('sccache-preflight-hit', String(sccacheRestored));
        }
    }
    if (!(plan.setup === 'mise' && toolEnabled(plan, 'rust'))) {
        await setupRustToolchain(rustVersion, { profile, targets, components });
    }
    const cacheHit = registryRestored || cargoGitRestored || cargoBinRestored || targetRestored || sccacheRestored;
    core.setOutput('cache-hit', String(cacheHit));
    core.setOutput('sccache-hit', String(sccacheRestored));
    const verificationSpecs = [];
    if (cargoRegistryEntry) {
        verificationSpecs.push({
            tag: cargoRegistryEntry.tag,
            noPlatform: false,
            noGit: false,
            pathHint: cargoRegistryEntry.path,
            saveExpected: true,
        });
    }
    if (cargoGitEntry) {
        verificationSpecs.push({
            tag: cargoGitEntry.tag,
            noPlatform: false,
            noGit: false,
            pathHint: cargoGitEntry.path,
            saveExpected: true,
        });
    }
    if (cargoBinEntry) {
        verificationSpecs.push({
            tag: cargoBinEntry.tag,
            noPlatform: false,
            noGit: false,
            pathHint: cargoBinEntry.path,
            saveExpected: true,
        });
    }
    if (targetEntry) {
        verificationSpecs.push({
            tag: targetEntry.tag,
            noPlatform: false,
            noGit: false,
            pathHint: targetEntry.path,
            saveExpected: true,
        });
    }
    if (sccacheEntry) {
        verificationSpecs.push({
            tag: ((_b = readRustArchiveEntryState('sccache')) === null || _b === void 0 ? void 0 : _b.tag) || sccacheEntry.tag,
            noPlatform: sccacheMode === 'proxy',
            noGit: sccacheMode === 'proxy',
            pathHint: sccacheMode === 'proxy' ? workingDir : sccacheEntry.path,
            saveExpected: sccacheMode !== 'proxy' || !inputs.readOnly,
        });
    }
    return { cacheHit, cacheTag: cacheTagPrefix, verificationSpecs };
}
async function runRustSave() {
    const workspace = getModeState('workspace');
    const cacheCargo = getModeState('cache-cargo') === 'true';
    const cacheCargoBin = getModeState('cache-cargo-bin') === 'true';
    const cacheTarget = getModeState('cache-target') === 'true';
    const useSccache = getModeState('use-sccache') === 'true';
    const sccacheMode = getModeState('sccache-mode') || 'local';
    const verbose = getModeState('verbose') === 'true';
    const exclude = core.getInput('exclude');
    if (!workspace) {
        return;
    }
    if (!(0, core_1.hasSaveToken)()) {
        if (useSccache && sccacheMode === 'proxy') {
            await stopSccacheServer();
            await stopProxyFromState();
        }
        core.notice(`Save skipped: ${(0, core_1.missingSaveTokenMessage)()}`);
        return;
    }
    if (cacheCargo) {
        const cargoRegistryEntry = readRustArchiveEntryState('cargo-registry');
        const cargoGitEntry = readRustArchiveEntryState('cargo-git');
        if (cargoRegistryEntry) {
            await execRustBoringCache(buildRustCacheArgs('save', workspace, cargoRegistryEntry, verbose, exclude));
        }
        if (cargoGitEntry) {
            await execRustBoringCache(buildRustCacheArgs('save', workspace, cargoGitEntry, verbose, exclude));
        }
    }
    if (cacheCargoBin) {
        const cargoBinEntry = readRustArchiveEntryState('cargo-bin');
        if (cargoBinEntry) {
            await execRustBoringCache(buildRustCacheArgs('save', workspace, cargoBinEntry, verbose, exclude));
        }
    }
    if (cacheTarget) {
        const targetEntry = readRustArchiveEntryState('target');
        if (targetEntry) {
            await execRustBoringCache(buildRustCacheArgs('save', workspace, targetEntry, verbose, exclude));
        }
    }
    if (useSccache) {
        if (sccacheMode === 'proxy') {
            const sccacheTag = getModeState('sccache-tag');
            const preflightHit = getModeState('sccache-preflight-hit') === 'true';
            const sccacheStats = await stopSccacheServer();
            await stopProxyFromState();
            if (sccacheTag && (!sccacheStats || sccacheStats.compileRequests === 0)) {
                markModeVerifyTagSkipped(sccacheTag);
                if (preflightHit) {
                    core.info(`Skipping sccache post-save verification for ${sccacheTag}: no compile requests were observed.`);
                }
                else {
                    core.info(`Skipping sccache save for ${sccacheTag}: no compile requests were observed.`);
                }
                return;
            }
            if (sccacheTag && sccacheStats && sccacheStats.compileRequests > 0) {
                const postShutdownHit = await checkRustTagHit(workspace, sccacheTag, { noPlatform: true, noGit: true });
                const rustHitRate = sccacheStats.rustHitRate || 'unknown';
                core.info(`sccache proxy stats for ${sccacheTag}: compile_requests=${sccacheStats.compileRequests}, cache_hits=${sccacheStats.cacheHits}, cache_misses=${sccacheStats.cacheMisses}, rust_hit_rate=${rustHitRate}`);
                if (sccacheStats.cacheHits === 0) {
                    if (preflightHit) {
                        core.warning(`sccache proxy saw 0 cache hits across ${sccacheStats.compileRequests} compile requests for existing tag '${sccacheTag}'. Check emitted tag semantics and BORINGCACHE_SAVE_TOKEN/BORINGCACHE_RESTORE_TOKEN alignment.`);
                    }
                    else if (!postShutdownHit) {
                        core.warning(`sccache proxy saw 0 cache hits across ${sccacheStats.compileRequests} compile requests and '${sccacheTag}' was still missing after shutdown. Check BORINGCACHE_SAVE_TOKEN scope and proxy publish logs.`);
                    }
                    else {
                        core.notice(`sccache proxy saw 0 cache hits across ${sccacheStats.compileRequests} compile requests, but '${sccacheTag}' published successfully. This looks like a cold fill.`);
                    }
                }
            }
        }
        else {
            const sccacheEntry = readRustArchiveEntryState('sccache');
            const sccacheTag = (sccacheEntry === null || sccacheEntry === void 0 ? void 0 : sccacheEntry.tag) || '';
            const preflightHit = getModeState('sccache-preflight-hit') === 'true';
            if (sccacheEntry) {
                const sccacheStats = await stopSccacheServer();
                if (!sccacheStats || sccacheStats.compileRequests === 0) {
                    markModeVerifyTagSkipped(sccacheTag);
                    if (preflightHit) {
                        core.info(`Skipping sccache post-save verification for ${sccacheTag}: no compile requests were observed.`);
                    }
                    else {
                        core.info(`Skipping sccache save for ${sccacheTag}: no compile requests were observed.`);
                    }
                    return;
                }
                await execRustBoringCache(buildRustCacheArgs('save', workspace, sccacheEntry, verbose, exclude));
            }
        }
    }
}
async function stopProxyFromState() {
    const proxyPid = getModeState('proxy-pid');
    if (proxyPid) {
        await (0, core_1.stopRegistryProxy)(parseInt(proxyPid, 10));
    }
}
