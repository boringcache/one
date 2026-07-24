import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execBoringCache as execBoringCacheCore, findAvailablePort, hasToolVersionOnPath, hasRestoreToken, hasSaveToken, missingSaveTokenMessage, startRegistryProxy, stopRegistryProxy, } from './core';
import { DEFAULT_OCI_HYDRATION_POLICY, detectNodePackageManager, normalizeVerifyTimeoutSeconds, resolveCliArchiveEntries, } from './utils';
import { readSha256File, verifySha256 } from './core/integrity';
const DOCKER_METADATA_FILE = path.join(os.tmpdir(), 'boringcache-one-docker-metadata.json');
const BUILDKIT_METADATA_FILE = path.join(os.tmpdir(), 'boringcache-one-buildkit-metadata.json');
const DEFAULT_MANAGED_BUILDKIT_IMAGE = 'ghcr.io/boringcache/buildkit@sha256:edb388a8cfd12c51a3169d27a2bf361312d18ea1bf8c955c2ffc31b68eb5928e';
const DEFAULT_BINFMT_IMAGE = 'docker.io/tonistiigi/binfmt@sha256:400a4873b838d1b89194d982c45e5fb3cda4593fbfd7e08a02e76b03b21166f0';
const EPHEMERAL_PRIVILEGED_RUNNER_ENV = 'BORINGCACHE_EPHEMERAL_PRIVILEGED_RUNNER';
const BUILDCTL_VERSION = 'v0.31.2';
// Immutable subjects from the provenance files published with BuildKit v0.31.2.
const BUILDCTL_RELEASES = {
    'darwin-arm64': {
        platform: 'darwin-arm64',
        sha256: 'c386267eab33e79f4a0cb6a59230b71cddbacb5bf9e93fdf2d2682f2b4fa1a18',
    },
    'darwin-x64': {
        platform: 'darwin-amd64',
        sha256: 'c99fd17d2f37a0bf025b26601fea6fdcf7831ec9858a1fa63bcacb2e06441a2d',
    },
    'linux-arm64': {
        platform: 'linux-arm64',
        sha256: '41fba1eed480376934fa4c8177ddd7021036b5168a0eb8e7ab5eccdf75d47a05',
    },
    'linux-x64': {
        platform: 'linux-amd64',
        sha256: 'fbabdb72433a35f5bb646e4cd424bf8567e5d055710cf55840f7af2020640791',
    },
    'win32-arm64': {
        platform: 'windows-arm64',
        sha256: 'dc370dce464c3d27c87367c381586c65f46ca7e165586afed5b42617f3ab42b7',
    },
    'win32-x64': {
        platform: 'windows-amd64',
        sha256: '02542a36873fe095b5606981a86301e249d2734931925cb2f287ea015de3f555',
    },
};
const SCCACHE_DEFAULT_VERSION = 'v0.16.0';
// Immutable digests published with the default sccache release. Explicit
// version overrides must provide the publisher's adjacent .sha256 asset.
const SCCACHE_DEFAULT_SHA256 = {
    'sccache-v0.16.0-aarch64-apple-darwin.tar.gz': 'ded590cae2c72042c61178632906bef62d635fa20d45f8b22110a2241f430960',
    'sccache-v0.16.0-aarch64-pc-windows-msvc.zip': '6a715fe44d9b7a2cac15c256411ef232d3b6276e2421bd3be16ab32af71fbf88',
    'sccache-v0.16.0-aarch64-unknown-linux-musl.tar.gz': 'f73a5c39f96bb6ebb89cc7915cf182260d4cbf30765322c5e793d0fe8bd80784',
    'sccache-v0.16.0-x86_64-apple-darwin.tar.gz': 'f7dbd055db75a938ab1539f5316c5d08e73a1b94c40ab170ddcc617f5bf18343',
    'sccache-v0.16.0-x86_64-pc-windows-msvc.zip': 'b8514ed7552e148b0a032114f745118dcb801791adafafeaf9935e4bfb0edf1b',
    'sccache-v0.16.0-x86_64-unknown-linux-musl.tar.gz': 'aec995a83ad3dff3d14b6314e08858b7b73d35ca85a5bcf3d3a9ec07dee35588',
};
export class DockerBuildFailure extends Error {
    constructor(message) {
        super(message);
        this.name = 'DockerBuildFailure';
    }
}
async function runDockerBuildOperation(operation) {
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
function actionProxyOptions(options, proxyPlan, failOnCacheError = false) {
    return {
        ...options,
        failOnCacheError,
        onDemand: proxyPlan?.startup_mode === 'on-demand',
        ociPrefetchRefs: proxyPlan?.oci_prefetch_refs || [],
        ociRequiredReadableRefs: options.ociRequiredReadableRefs || [],
        ociHydration: proxyPlan?.oci_hydration || options.ociHydration || DEFAULT_OCI_HYDRATION_POLICY,
        metadataHints: proxyPlan?.metadata_hints || options.metadataHints || {},
    };
}
function adapterProxyVerificationSpec(tag, proxyPlan, pathHint) {
    return {
        tag,
        noPlatform: proxyPlan.no_platform,
        noGit: proxyPlan.no_git,
        pathHint,
        saveExpected: !proxyPlan.read_only,
    };
}
function buildKitCacheVerificationSpecs(cacheTag, buildKitCache, noPlatform, noGit, saveExpected, pathHint) {
    void buildKitCache;
    const uniqueTags = Array.from(new Set([cacheTag].map((tag) => tag.trim()).filter(Boolean)));
    return uniqueTags.map((tag) => ({
        tag,
        noPlatform,
        noGit,
        pathHint,
        saveExpected,
    }));
}
const SUPPORTED_CLI_DRY_RUN_SCHEMA_VERSION = 1;
const SUPPORTED_CLI_SETUP_SCHEMA_VERSION = 1;
function assertSupportedCliDryRunSchema(adapter, plan) {
    if (plan.schema_version !== SUPPORTED_CLI_DRY_RUN_SCHEMA_VERSION) {
        const actual = plan.schema_version === undefined ? 'missing' : String(plan.schema_version);
        throw new Error(`boringcache ${adapter} dry-run JSON schema_version ${actual} is not supported by this action `
            + `(expected ${SUPPORTED_CLI_DRY_RUN_SCHEMA_VERSION}). Update boringcache/one or pin cli-version.`);
    }
}
function currentHomeDir() {
    return process.env.HOME || os.homedir();
}
function isPathInside(parent, candidate) {
    const relative = path.relative(path.resolve(parent), path.resolve(candidate));
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
function secureCurlArgs(output, url) {
    return [
        '--fail',
        '--silent',
        '--show-error',
        '--location',
        '--proto',
        '=https',
        '--proto-redir',
        '=https',
        '--retry',
        '3',
        '--output',
        output,
        url,
    ];
}
export async function runModeRestore(plan, inputs) {
    switch (plan.mode) {
        case 'docker':
            return runDockerRestore(plan, inputs);
        case 'buildkit':
            return runBuildkitRestore(plan, inputs);
        case 'bazel':
            return runBazelRestore(plan, inputs);
        case 'go':
            return runGoRestore(plan, inputs);
        case 'gradle':
            return runGradleRestore(plan, inputs);
        case 'maven':
            return runMavenRestore(plan, inputs);
        case 'rust-sccache':
            return runRustRestore(plan, inputs);
        case 'turbo-proxy':
            return runTurboProxyRestore(plan, inputs);
        case 'nx-proxy':
            return runNxProxyRestore(plan, inputs);
        case 'archive':
            return {};
    }
}
export async function runModeSave(mode, options = {}) {
    switch (mode) {
        case 'docker':
            await runDockerSave(options);
            return;
        case 'buildkit':
            await runBuildkitSave(options);
            return;
        case 'bazel':
            await shutdownBazelServer();
            await stopProxyFromState();
            return;
        case 'go':
            await stopProxyFromState();
            return;
        case 'gradle':
        case 'maven':
        case 'nx-proxy':
        case 'turbo-proxy':
            await stopProxyFromState();
            return;
        case 'rust-sccache':
            await runRustSave(options);
            return;
        case 'archive':
            return;
    }
}
function parseBooleanInput(value, inputName, defaultValue = false) {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }
    const normalized = String(value).trim();
    if (['true', 'True', 'TRUE'].includes(normalized)) {
        return true;
    }
    if (['false', 'False', 'FALSE'].includes(normalized)) {
        return false;
    }
    throw new Error(`Unsupported ${inputName} "${value}". Expected true, True, TRUE, false, False, or FALSE.`);
}
function parsePortInput(value, inputName) {
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
async function resolvePreferredPort(value, inputName, defaultPort) {
    if (value.trim()) {
        return parsePortInput(value, inputName);
    }
    return defaultPort ?? await findAvailablePort();
}
function parseList(input, separator = /[\n,]/) {
    return input
        .split(separator)
        .map((item) => item.trim())
        .filter(Boolean);
}
function appendMetadataHintArgs(args, metadataHintsInput) {
    for (const hint of parseList(metadataHintsInput)) {
        args.push('--metadata-hint', hint);
    }
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
function proxyPlanningReadOnly(requestedReadOnly) {
    return requestedReadOnly || (!hasSaveToken() && hasRestoreToken());
}
function appendCliPublicationPolicy(args, readOnly) {
    args.push(readOnly ? '--read-only' : '--write');
}
function requireAdapterSetupPlan(adapter, setup) {
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
function exportEnvVars(envVars) {
    for (const [key, value] of Object.entries(envVars)) {
        process.env[key] = value;
        core.exportVariable(key, value);
    }
}
function applyAdapterSetupPlan(setup) {
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
    }
}
function setupFilePath(setup, suffix) {
    return (setup.files || []).find((file) => file.path.endsWith(suffix))?.path || '';
}
function setupDirectory(setup) {
    return (setup.directories || [])[0] || '';
}
function requireSetupFilePath(setup, suffix, label) {
    const filePath = setupFilePath(setup, suffix);
    if (!filePath) {
        throw new Error(`boringcache adapter setup plan did not include ${label}`);
    }
    return filePath;
}
function requireSetupDirectory(setup, label) {
    const directory = setupDirectory(setup);
    if (!directory) {
        throw new Error(`boringcache adapter setup plan did not include ${label}`);
    }
    return directory;
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
function getModeStateList(key) {
    return getModeState(key)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
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
function getModeStateBoolean(key) {
    return getModeState(key) === 'true';
}
async function verifyOciPromotionRefsAfterStop() {
    const refs = getModeStateList('oci-promotion-ref-tags');
    if (refs.length === 0) {
        return;
    }
    const workspace = getModeState('workspace');
    const cacheTag = getModeState('cache-tag');
    const port = Number.parseInt(getModeState('proxy-port'), 10);
    if (!workspace || !cacheTag) {
        throw new Error(`Cannot verify managed cache promotion refs without workspace and cache tag. requested=[${refs.join(', ')}]`);
    }
    if (!Number.isFinite(port) || port <= 0) {
        throw new Error(`Cannot verify managed cache promotion refs without a proxy port. requested=[${refs.join(', ')}]`);
    }
    const host = getModeState('proxy-host') || '127.0.0.1';
    let verificationProxyPid = null;
    try {
        const verificationProxy = await startRegistryProxy({
            command: 'cache-registry',
            workspace,
            tag: cacheTag,
            host,
            port,
            noGit: getModeStateBoolean('proxy-no-git'),
            noPlatform: getModeStateBoolean('proxy-no-platform'),
            verbose: getModeStateBoolean('verbose'),
            readOnly: true,
            ociRequiredReadableRefs: refs,
            requireOciImportReady: true,
            ociImportReadyTimeoutMs: ociPromotionVerificationTimeoutMs(),
            ociHydration: DEFAULT_OCI_HYDRATION_POLICY,
        });
        verificationProxyPid = verificationProxy.pid > 0 ? verificationProxy.pid : null;
        const readiness = verificationProxy.ociImportReadiness;
        if (!readiness?.ready) {
            throw new Error(`Managed cache promotion refs were not readable after proxy shutdown. readable=[${readiness?.readableRefs.join(', ') || ''}] unreadable=[${readiness?.unreadableRefs.join(', ') || refs.join(', ')}]`);
        }
        core.info(`Verified managed cache promotion refs after proxy shutdown: ${readiness.readableRefs.join(', ')}`);
    }
    catch (error) {
        throw new Error(`Managed cache promotion refs were not readable after proxy shutdown. requested=[${refs.join(', ')}]: ${errorMessage(error)}`);
    }
    finally {
        if (verificationProxyPid !== null) {
            await stopRegistryProxy(verificationProxyPid);
        }
    }
}
function ociPromotionVerificationTimeoutMs() {
    const raw = core.getState('verify-timeout-seconds') || core.getInput('verify-timeout-seconds') || '180';
    return normalizeVerifyTimeoutSeconds(raw) * 1000;
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
async function verifyOciPromotionRefsThenStopProxy(proxyPid) {
    try {
        const proxyPort = Number.parseInt(getModeState('proxy-port'), 10);
        await stopRegistryProxy(parseInt(proxyPid, 10), Number.isFinite(proxyPort) ? proxyPort : undefined);
    }
    catch (stopError) {
        throw new Error(`Failed to stop BoringCache proxy cleanly before managed cache promotion verification: ${errorMessage(stopError)}`);
    }
    await verifyOciPromotionRefsAfterStop();
}
async function shutdownBazelServer() {
    await exec.exec('bazel', ['shutdown'], {
        ignoreReturnCode: true,
        silent: true,
    });
}
async function execBoringCache(args, options) {
    return execBoringCacheCore(args, options);
}
function emitCliPlannerWarnings(stderr) {
    for (const line of stderr.split('\n').map((value) => value.trim()).filter(Boolean)) {
        if (line.startsWith('warning:')) {
            core.warning(line.replace(/^warning:\s*/, ''));
        }
    }
}
function normalizeDockerCommand(value) {
    const command = (value.trim() || 'build');
    if (command === 'build' || command === 'setup') {
        return command;
    }
    throw new Error(`Unsupported docker-command "${value}". Expected build or setup.`);
}
function normalizeDockerCacheMode(value) {
    const mode = (value.trim() || 'max');
    if (mode === 'min' || mode === 'max') {
        return mode;
    }
    throw new Error(`Unsupported cache-mode "${value}". Expected min or max.`);
}
function normalizeSccacheMode(value) {
    const mode = (value.trim() || 'local');
    if (mode === 'local' || mode === 'proxy') {
        return mode;
    }
    throw new Error(`Unsupported sccache-mode "${value}". Expected local or proxy.`);
}
function normalizeRustupProfile(value) {
    const profile = (value.trim() || 'minimal');
    if (profile === 'minimal' || profile === 'default' || profile === 'complete') {
        return profile;
    }
    throw new Error(`Unsupported profile "${value}". Expected minimal, default, or complete.`);
}
async function resolveAdapterCliPlan(adapter, workspace, workingDirectory, inputCacheTag, preferredPort, noPlatform, noGit, readOnly, options = {}) {
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
    appendCliPublicationPolicy(args, readOnly);
    appendMetadataHintArgs(args, options.metadataHintsInput || '');
    for (const line of parseMultiline(options.bazelrcLines || '')) {
        args.push('--bazelrc-line', line);
    }
    if (options.gradleHome?.trim()) {
        args.push('--gradle-home', options.gradleHome.trim());
    }
    if (options.enableGradleBuildCache === false) {
        args.push('--no-gradle-build-cache-property');
    }
    if (options.mavenLocalRepo?.trim()) {
        args.push('--maven-local-repo', options.mavenLocalRepo.trim());
    }
    if (options.mavenExtensionsPath?.trim()) {
        args.push('--maven-extensions-path', options.mavenExtensionsPath.trim());
    }
    if (options.mavenBuildCacheConfigPath?.trim()) {
        args.push('--maven-build-cache-config-path', options.mavenBuildCacheConfigPath.trim());
    }
    if (options.mavenBuildCacheExtensionVersion?.trim()) {
        args.push('--maven-build-cache-extension-version', options.mavenBuildCacheExtensionVersion.trim());
    }
    if (options.mavenBuildCacheId?.trim()) {
        args.push('--maven-build-cache-id', options.mavenBuildCacheId.trim());
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
    return plan;
}
async function resolveOciCliPlan(adapter, adapterCommand, workspace, workingDirectory, inputCacheTag, preferredPort, host, endpointHost, noPlatform, noGit, readOnly, failOnCacheError, cacheMode, metadataHintsInput = '', dockerToolCacheInput = '') {
    const args = [adapter, '--workspace', workspace];
    const trimmedCacheTag = inputCacheTag.trim();
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
    appendCliPublicationPolicy(args, readOnly);
    if (failOnCacheError) {
        args.push('--fail-on-cache-error');
    }
    if (cacheMode.trim()) {
        args.push('--cache-mode', cacheMode.trim());
    }
    if (adapter === 'docker') {
        for (const tool of parseList(dockerToolCacheInput)) {
            args.push('--tool-cache', tool);
        }
    }
    appendMetadataHintArgs(args, metadataHintsInput);
    args.push('--dry-run', '--json', '--', ...adapterCommand);
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
    if (!plan.buildkit_cache?.cache_ref || !plan.buildkit_cache.cache_from) {
        throw new Error(`boringcache ${adapter} dry-run JSON did not include managed BuildKit cache planning data`);
    }
    return plan;
}
async function resolveDockerCliPlan(workspace, workingDirectory, inputCacheTag, preferredPort, host, endpointHost, noPlatform, noGit, readOnly, failOnCacheError, cacheMode, metadataHintsInput = '', dockerToolCacheInput = '') {
    return resolveOciCliPlan('docker', ['docker', 'buildx', 'build', '.'], workspace, workingDirectory, inputCacheTag, preferredPort, host, endpointHost, noPlatform, noGit, readOnly, failOnCacheError, cacheMode, metadataHintsInput, dockerToolCacheInput);
}
async function resolveBuildkitCliPlan(workspace, workingDirectory, inputCacheTag, preferredPort, host, endpointHost, noPlatform, noGit, readOnly, failOnCacheError, cacheMode, metadataHintsInput = '') {
    return resolveOciCliPlan('buildkit', ['buildctl', 'build', '--frontend', 'dockerfile.v0'], workspace, workingDirectory, inputCacheTag, preferredPort, host, endpointHost, noPlatform, noGit, readOnly, failOnCacheError, cacheMode, metadataHintsInput);
}
async function saveSimpleCache(workspace, cacheKey, cacheDir, flags = {}) {
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
    if (flags.exclude) {
        args.push('--exclude', flags.exclude);
    }
    await execBoringCache(args);
}
function extractCacheRefTag(cacheFrom) {
    const refMatch = cacheFrom.match(/(?:^|,)ref=([^,]+)/);
    const ref = refMatch?.[1]?.trim();
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
function buildKitCacheFromRefTags(buildKitCache) {
    if (!buildKitCache) {
        return [];
    }
    if (buildKitCache.cache_from_ref_tags?.length) {
        return buildKitCache.cache_from_ref_tags;
    }
    return (buildKitCache.cache_from_refs || [])
        .map(extractCacheRefTag)
        .filter((tag) => Boolean(tag));
}
function buildKitCacheImportSpecs(buildKitCache, refTags) {
    const imports = buildKitCache.cache_from_refs?.length ? buildKitCache.cache_from_refs : [buildKitCache.cache_from];
    const byRefTag = new Map();
    for (const cacheFrom of imports) {
        const refTag = extractCacheRefTag(cacheFrom);
        if (refTag && !byRefTag.has(refTag)) {
            byRefTag.set(refTag, cacheFrom.trim());
        }
    }
    const selectedImports = refTags
        ? refTags
            .map((refTag) => byRefTag.get(refTag))
            .filter((cacheFrom) => Boolean(cacheFrom))
        : imports
            .map((cacheFrom) => cacheFrom.trim())
            .filter(Boolean);
    return selectedImports;
}
function effectiveBuildKitCacheImports(buildKitCache, proxy) {
    const requestedRefTags = buildKitCacheFromRefTags(buildKitCache);
    const readableRefTags = proxy?.ociImportReadiness
        ? proxy.ociImportReadiness.readableRefs
        : requestedRefTags;
    const unreadableRefTags = proxy?.ociImportReadiness?.unreadableRefs || [];
    return {
        importSpecs: buildKitCacheImportSpecs(buildKitCache, readableRefTags),
        readableRefTags,
        requestedRefTags,
        unreadableRefTags,
        importReady: proxy?.ociImportReadiness?.ready ?? true,
    };
}
function buildKitCacheEvidence(adapter, buildKitCache, imports, cacheTo) {
    const runMetadata = buildKitCache.run_metadata;
    return {
        adapter,
        cache_backend: 'boringcache',
        buildkit_cache_backend: 'boringcache',
        cache_ref: buildKitCache.cache_ref,
        cache_from: imports.importSpecs,
        cache_to: cacheTo || '',
        requested_ref_tags: imports.requestedRefTags,
        readable_ref_tags: imports.readableRefTags,
        unreadable_ref_tags: imports.unreadableRefTags,
        import_ready: imports.importReady,
        immutable_run_ref_tag: buildKitCache.immutable_run_ref_tag || '',
        promotion_ref_tags: buildKitCache.promotion_ref_tags || [],
        ci: {
            provider: runMetadata?.provider || '',
            run_uid: runMetadata?.run_uid || '',
            run_attempt: runMetadata?.run_attempt || '',
            source_ref_type: runMetadata?.source_ref_type || '',
            source_ref_name: runMetadata?.source_ref_name || '',
            run_started_at: runMetadata?.run_started_at || '',
        },
    };
}
function recordBuildKitCachePlanState(buildKitPlan, cacheTag) {
    saveModeState('workspace', buildKitPlan.workspace);
    saveModeState('cache-tag', cacheTag);
    return {
        resolvedWorkspace: buildKitPlan.workspace,
        resolvedCacheTag: cacheTag,
        buildKitVerification: {
            noPlatform: buildKitPlan.proxy.no_platform,
            noGit: buildKitPlan.proxy.no_git,
            saveExpected: !buildKitPlan.proxy.read_only,
        },
        buildKitCacheState: buildKitPlan.buildkit_cache,
    };
}
function setBuildKitCacheOutputs(spec) {
    core.setOutput('cache-ref', spec.ref);
    core.setOutput('cache-from', spec.from.join('\n'));
    core.setOutput('cache-to', spec.to || '');
    core.setOutput('docker-cache-run-ref', spec.buildKitCache?.immutable_run_ref_tag || '');
    core.setOutput('docker-cache-from-refs', (spec.usedRefTags || buildKitCacheFromRefTags(spec.buildKitCache)).join('\n'));
    core.setOutput('docker-cache-requested-from-refs', buildKitCacheFromRefTags(spec.buildKitCache).join('\n'));
    core.setOutput('docker-cache-unreadable-from-refs', (spec.unreadableRefTags || []).join('\n'));
    core.setOutput('docker-cache-import-ready', String(spec.importReady ?? true));
    core.setOutput('docker-cache-promotion-refs', (spec.buildKitCache?.promotion_ref_tags || []).join('\n'));
    core.setOutput('docker-ci-provider', spec.buildKitCache?.run_metadata?.provider || '');
    core.setOutput('docker-ci-run-id', spec.buildKitCache?.run_metadata?.run_uid || '');
    core.setOutput('docker-ci-run-attempt', spec.buildKitCache?.run_metadata?.run_attempt || '');
    core.setOutput('docker-ci-ref-type', spec.buildKitCache?.run_metadata?.source_ref_type || '');
    core.setOutput('docker-ci-ref-name', spec.buildKitCache?.run_metadata?.source_ref_name || '');
    core.setOutput('docker-ci-run-started-at', spec.buildKitCache?.run_metadata?.run_started_at || '');
    core.setOutput('cache-dir', '');
    core.setOutput('save-cache-dir', '');
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
    const result = await exec.exec('docker', ['run', '--privileged', '--rm', DEFAULT_BINFMT_IMAGE, '--install', 'all'], { ignoreReturnCode: true });
    if (result !== 0) {
        throw new Error(`Failed to set up QEMU for multi-platform builds (exit ${result})`);
    }
}
function assertPrivilegedRunnerPolicy(operation) {
    if (process.env.GITHUB_ACTIONS !== 'true') {
        return;
    }
    const runnerEnvironment = (process.env.RUNNER_ENVIRONMENT || '').trim();
    if (runnerEnvironment === 'github-hosted') {
        return;
    }
    if (process.env[EPHEMERAL_PRIVILEGED_RUNNER_ENV] === '1') {
        core.warning(`${operation} is using host-level privileges on a self-managed runner because `
            + `${EPHEMERAL_PRIVILEGED_RUNNER_ENV}=1. Destroy the single-tenant runner after this job.`);
        return;
    }
    const runnerDescription = runnerEnvironment === 'self-hosted'
        ? 'a self-hosted runner'
        : 'a runner whose environment could not be verified';
    throw new Error(`${operation} needs host-level privileges, so BoringCache will not run it on ${runnerDescription}. `
        + `Use a GitHub-hosted runner, or set ${EPHEMERAL_PRIVILEGED_RUNNER_ENV}=1 only when the `
        + 'self-hosted runner is single-tenant and destroyed after this job.');
}
function buildxBuilderName() {
    const runId = String(process.env.GITHUB_RUN_ID || Date.now());
    const actionId = sanitizeBuilderToken(process.env.GITHUB_ACTION || 'one') || 'one';
    const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return `boringcache-${runId}-${actionId}-${uniqueSuffix}`;
}
function hasDriverImageOpt(driverOpts) {
    return driverOpts.some((opt) => opt.trim().startsWith('image='));
}
function managedBuildKitImage(input) {
    const image = input.trim() || DEFAULT_MANAGED_BUILDKIT_IMAGE;
    if (!/^[A-Za-z0-9./:@_-]+$/.test(image)) {
        throw new Error(`Unsupported managed-buildkit-image "${input}". Expected a Docker image reference.`);
    }
    if (image.includes('@') && !/@sha256:[a-f0-9]{64}$/.test(image)) {
        throw new Error(`Unsupported managed-buildkit-image "${input}". Digest references must use a 64-character lowercase sha256 digest.`);
    }
    return image;
}
async function pullManagedBuildKitImage(image) {
    const pullResult = await exec.exec('docker', ['pull', image], { ignoreReturnCode: true });
    if (pullResult === 0) {
        return;
    }
    const inspectResult = await exec.exec('docker', ['image', 'inspect', image], {
        ignoreReturnCode: true,
        silent: true,
    });
    if (inspectResult === 0) {
        core.warning(`Could not refresh managed BuildKit image ${image}; using the local cached copy.`);
        return;
    }
    throw new Error(`Could not pull managed BuildKit image ${image}, and no local copy is available.`);
}
async function setupBuildxBuilder(driver, driverOpts, buildkitdConfigInline, registryMode, useManagedBuildKitImage, managedImageInput) {
    const builderName = buildxBuilderName();
    let driverToUse = driver || 'docker-container';
    if (driverToUse === 'docker') {
        core.warning('Buildx driver "docker" does not support cache export; falling back to "docker-container".');
        driverToUse = 'docker-container';
    }
    const effectiveDriverOpts = [...driverOpts];
    if (useManagedBuildKitImage && driverToUse === 'docker-container' && !hasDriverImageOpt(effectiveDriverOpts)) {
        const image = managedBuildKitImage(managedImageInput);
        await pullManagedBuildKitImage(image);
        effectiveDriverOpts.push(`image=${image}`);
    }
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
    if (driverToUse === 'docker-container') {
        args.push('--buildkitd-flags', '--oci-worker-gc=false');
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
function dockerBuildxArgs(opts) {
    const args = ['buildx', 'build'];
    if (opts.builder) {
        args.push('--builder', opts.builder);
    }
    args.push('-f', opts.dockerfile);
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
    if (opts.provenance) {
        args.push('--provenance=true');
    }
    if (opts.sbom) {
        args.push('--sbom=true');
    }
    if (opts.cacheFrom?.length) {
        for (const cacheFrom of opts.cacheFrom) {
            args.push('--cache-from', cacheFrom);
        }
    }
    if (opts.cacheTo) {
        args.push('--cache-to', opts.cacheTo);
    }
    args.push('--metadata-file', DOCKER_METADATA_FILE);
    args.push('.');
    return args;
}
function resolveDockerfilePath(workingDirectory, contextPath, dockerfileInput) {
    if (path.isAbsolute(dockerfileInput)) {
        return dockerfileInput;
    }
    const workingDirectoryCandidate = path.resolve(workingDirectory, dockerfileInput);
    if (fs.existsSync(workingDirectoryCandidate)) {
        return workingDirectoryCandidate;
    }
    return path.resolve(contextPath, dockerfileInput);
}
async function buildDockerImage(opts) {
    const args = dockerBuildxArgs(opts);
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
function ociAdapterCliArgsForAcceleratedBuild(adapter, workspace, cacheTag, port, proxyBindHost, refHost, inputs, cacheMode, command, commandArgs) {
    const args = [
        adapter,
        '--workspace',
        workspace,
        '--tag',
        cacheTag,
        '--port',
        String(port),
        '--cache-mode',
        cacheMode,
    ];
    if (proxyBindHost.trim()) {
        args.push('--host', proxyBindHost.trim());
    }
    if (refHost.trim()) {
        args.push('--endpoint-host', refHost.trim());
    }
    if (inputs.proxyNoPlatform) {
        args.push('--no-platform');
    }
    if (inputs.proxyNoGit) {
        args.push('--no-git');
    }
    appendCliPublicationPolicy(args, inputs.readOnly);
    if (inputs.failOnCacheError) {
        args.push('--fail-on-cache-error');
    }
    if (adapter === 'docker') {
        for (const tool of parseList(inputs.dockerToolCache)) {
            args.push('--tool-cache', tool);
        }
    }
    appendMetadataHintArgs(args, inputs.metadataHints);
    args.push('--', command, ...commandArgs);
    return args;
}
async function buildDockerImageWithCliAdapter(workspace, cacheTag, port, proxyBindHost, refHost, inputs, cacheMode, opts) {
    const dockerBuildArgs = dockerBuildxArgs({
        ...opts,
        cacheFrom: undefined,
        cacheTo: undefined,
    });
    const args = ociAdapterCliArgsForAcceleratedBuild('docker', workspace, cacheTag, port, proxyBindHost, refHost, inputs, cacheMode, 'docker', dockerBuildArgs);
    const result = await execBoringCache(args, {
        cwd: opts.context,
        env: {
            ...process.env,
            DOCKER_BUILDKIT: '1',
            BORINGCACHE_MANAGED_BUILDKIT_IMAGE: managedBuildKitImage(inputs.managedBuildkitImage),
        },
    });
    if (result !== 0) {
        throw new Error(`boringcache docker failed with exit code ${result}`);
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
function materializeBuildkitTlsFiles(inputs) {
    let temporaryDirectory = '';
    const workspaceRoot = path.resolve(process.cwd());
    const physicalWorkspaceRoot = fs.realpathSync(workspaceRoot);
    const cleanup = () => {
        if (!temporaryDirectory) {
            return;
        }
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
        temporaryDirectory = '';
    };
    const materialize = (value, filename) => {
        if (!value.trim()) {
            return '';
        }
        const candidate = path.resolve(workspaceRoot, value);
        // BuildKit TLS file inputs may name files only inside the checked-out workspace.
        // Absolute or parent-traversal values are treated as inline PEM content instead.
        const relativeCandidate = path.relative(workspaceRoot, candidate);
        let candidateStats;
        if (relativeCandidate === '..'
            || relativeCandidate.startsWith(`..${path.sep}`)
            || path.isAbsolute(relativeCandidate)) {
            core.warning(`Ignoring ${filename} path outside the workspace; treating input as inline content.`);
        }
        else {
            try {
                candidateStats = fs.lstatSync(candidate);
            }
            catch (error) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }
        }
        if (candidateStats) {
            if (candidateStats.isSymbolicLink() || !candidateStats.isFile()) {
                throw new Error(`BuildKit TLS ${filename} path must be a regular, non-symlink file inside the workspace.`);
            }
            const physicalCandidate = fs.realpathSync(candidate);
            if (!isPathInside(physicalWorkspaceRoot, physicalCandidate)) {
                throw new Error(`BuildKit TLS ${filename} path resolves outside the workspace.`);
            }
            return physicalCandidate;
        }
        if (!temporaryDirectory) {
            temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'boringcache-buildkit-tls-'));
            fs.chmodSync(temporaryDirectory, 0o700);
        }
        const target = path.join(temporaryDirectory, filename);
        // The unique private directory and exclusive create prevent a retained
        // runner from redirecting or recovering inline TLS material.
        // codeql[js/path-injection]
        fs.writeFileSync(target, value, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        return target;
    };
    try {
        return {
            tlsCa: materialize(inputs.ca, 'buildkit-ca.pem'),
            tlsCert: materialize(inputs.cert, 'buildkit-cert.pem'),
            tlsKey: materialize(inputs.key, 'buildkit-key.pem'),
            cleanup,
        };
    }
    catch (error) {
        cleanup();
        throw error;
    }
}
async function buildWithMaterializedBuildkitTls(opts, inputs) {
    const tls = materializeBuildkitTlsFiles(inputs);
    try {
        await buildWithBuildctl({
            ...opts,
            tlsCa: tls.tlsCa,
            tlsCert: tls.tlsCert,
            tlsKey: tls.tlsKey,
        });
    }
    finally {
        tls.cleanup();
    }
}
export async function installBuildctl() {
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
    const release = BUILDCTL_RELEASES[`${process.platform}-${process.arch}`];
    if (!release) {
        throw new Error(`Unsupported buildctl runner: ${process.platform}-${process.arch}`);
    }
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'buildctl-'));
    const archivePath = path.join(tmpDir, 'buildkit.tar.gz');
    const installDir = path.join(currentHomeDir(), '.local', 'bin');
    try {
        const assetName = `buildkit-${BUILDCTL_VERSION}.${release.platform}.tar.gz`;
        const url = `https://github.com/moby/buildkit/releases/download/${BUILDCTL_VERSION}/${assetName}`;
        const curlCode = await exec.exec('curl', secureCurlArgs(archivePath, url), { ignoreReturnCode: true });
        if (curlCode !== 0) {
            throw new Error(`Failed to download buildctl from ${url}`);
        }
        await verifySha256(archivePath, release.sha256, assetName);
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
function buildctlArgs(opts) {
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
    if (opts.importCache?.length) {
        for (const importCache of opts.importCache) {
            args.push('--import-cache', importCache);
        }
    }
    if (opts.exportCache) {
        args.push('--export-cache', opts.exportCache);
    }
    if (opts.output?.trim()) {
        args.push('--output', opts.output.trim());
    }
    else {
        const nameParams = opts.imageTags.map((tag) => `name=${tag}`).join(',');
        args.push('--output', `type=image,${nameParams},push=${opts.push ? 'true' : 'false'}`);
    }
    args.push('--metadata-file', opts.metadataFile);
    return args;
}
async function buildWithBuildctl(opts) {
    const args = buildctlArgs(opts);
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
async function execRustBoringCache(args) {
    return execBoringCache(args);
}
function getCargoHome() {
    return process.env.CARGO_HOME || path.join(currentHomeDir(), '.cargo');
}
function configureCargoEnv() {
    const cargoHome = getCargoHome();
    process.env.CARGO_HOME = cargoHome;
    core.exportVariable('CARGO_HOME', cargoHome);
    core.addPath(path.join(cargoHome, 'bin'));
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
        if (match?.[1]) {
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
function configureSccacheEnv(cacheSize, sccacheDir) {
    process.env.RUSTC_WRAPPER = 'sccache';
    core.exportVariable('RUSTC_WRAPPER', 'sccache');
    process.env.SCCACHE_DIR = sccacheDir;
    core.exportVariable('SCCACHE_DIR', sccacheDir);
    process.env.SCCACHE_CACHE_SIZE = cacheSize;
    core.exportVariable('SCCACHE_CACHE_SIZE', cacheSize);
    core.exportVariable('CC', 'sccache cc');
    core.exportVariable('CXX', 'sccache c++');
    core.exportVariable('SCCACHE_IDLE_TIMEOUT', process.env.SCCACHE_IDLE_TIMEOUT || '0');
    // SCCACHE_DIR is action-owned cache state selected by the action plan.
    // codeql[js/path-injection]
    fs.mkdirSync(sccacheDir, { recursive: true });
}
async function startSccacheServer() {
    await exec.exec('sccache', ['--start-server'], { ignoreReturnCode: true });
}
export async function installSccache(versionInput = SCCACHE_DEFAULT_VERSION.slice(1)) {
    addLocalBinPaths();
    if (await hasToolVersionOnPath('sccache', versionInput)) {
        core.info(`Using existing sccache ${versionInput} from PATH`);
        return;
    }
    const version = versionInput.trim();
    if (!/^v?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(version)) {
        throw new Error(`Invalid sccache version: ${versionInput}`);
    }
    const normalizedVersion = version.startsWith('v') ? version : `v${version}`;
    let assetName = null;
    if (process.platform === 'linux') {
        if (process.arch === 'x64') {
            assetName = `sccache-${normalizedVersion}-x86_64-unknown-linux-musl`;
        }
        else if (process.arch === 'arm64') {
            assetName = `sccache-${normalizedVersion}-aarch64-unknown-linux-musl`;
        }
    }
    else if (process.platform === 'darwin') {
        if (process.arch === 'arm64') {
            assetName = `sccache-${normalizedVersion}-aarch64-apple-darwin`;
        }
        else if (process.arch === 'x64') {
            assetName = `sccache-${normalizedVersion}-x86_64-apple-darwin`;
        }
    }
    else if (process.platform === 'win32') {
        if (process.arch === 'arm64') {
            assetName = `sccache-${normalizedVersion}-aarch64-pc-windows-msvc`;
        }
        else if (process.arch === 'x64') {
            assetName = `sccache-${normalizedVersion}-x86_64-pc-windows-msvc`;
        }
    }
    if (!assetName) {
        await exec.exec('cargo', ['install', 'sccache', '--version', normalizedVersion.slice(1), '--locked']);
        return;
    }
    const extension = process.platform === 'win32' ? '.zip' : '.tar.gz';
    const archiveName = `${assetName}${extension}`;
    const url = `https://github.com/mozilla/sccache/releases/download/${normalizedVersion}/${archiveName}`;
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sccache-'));
    const archivePath = path.join(tempDir, `sccache${extension}`);
    const checksumPath = path.join(tempDir, 'sccache.sha256');
    try {
        const curlCode = await exec.exec('curl', secureCurlArgs(archivePath, url), {
            ignoreReturnCode: true,
        });
        if (curlCode !== 0) {
            throw new Error(`Failed to download sccache from ${url}`);
        }
        let expectedDigest = normalizedVersion === SCCACHE_DEFAULT_VERSION
            ? SCCACHE_DEFAULT_SHA256[archiveName]
            : undefined;
        if (!expectedDigest) {
            const checksumUrl = `${url}.sha256`;
            const checksumCode = await exec.exec('curl', secureCurlArgs(checksumPath, checksumUrl), { ignoreReturnCode: true });
            if (checksumCode !== 0) {
                throw new Error(`Failed to download sccache checksum from ${checksumUrl}`);
            }
            expectedDigest = await readSha256File(checksumPath, archiveName);
        }
        await verifySha256(archivePath, expectedDigest, archiveName);
        if (process.platform === 'win32') {
            await exec.exec('unzip', ['-q', archivePath, '-d', tempDir]);
        }
        else {
            await exec.exec('tar', ['-xzf', archivePath, '-C', tempDir]);
        }
        const installDir = path.join(currentHomeDir(), '.local', 'bin');
        // The install directory is runner-local tool state under the home directory.
        // codeql[js/path-injection]
        await fs.promises.mkdir(installDir, { recursive: true });
        const binaryName = process.platform === 'win32' ? 'sccache.exe' : 'sccache';
        const srcPath = path.join(tempDir, assetName, binaryName);
        const destPath = path.join(installDir, binaryName);
        // The source is from a SHA-256-verified release archive and destination is runner-local tool state.
        // codeql[js/path-injection]
        await fs.promises.copyFile(srcPath, destPath);
        if (process.platform !== 'win32') {
            // codeql[js/path-injection]
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
function emptyRustTagCheckStatus() {
    return {
        hit: false,
        cacheEntryHit: false,
        kvHit: false,
        kvChecked: false,
    };
}
function checkResultHasKvProbe(result) {
    return typeof result.kv_entry_count === 'number'
        || typeof result.kv_total_size === 'number'
        || (result.status === 'hit' && result.cache_type === 'kv');
}
function checkResultHasKvRows(result) {
    if (typeof result.kv_entry_count === 'number') {
        return result.kv_entry_count > 0;
    }
    return result.status === 'hit' && result.cache_type === 'kv';
}
function checkResultHasCacheEntryHit(result) {
    if (result.status !== 'hit') {
        return false;
    }
    return result.cache_type !== 'kv';
}
async function checkRustTagStatus(workspace, tag, { noPlatform = false, noGit = false, requireServerSignature = false, } = {}) {
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
        return emptyRustTagCheckStatus();
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
        return emptyRustTagCheckStatus();
    }
}
async function checkRustTagHit(workspace, tag, options = {}) {
    return (await checkRustTagStatus(workspace, tag, options)).hit;
}
async function checkRustProxyTagStatus(workspace, tag, options = {}) {
    const strictStatus = await checkRustTagStatus(workspace, tag, {
        ...options,
        requireServerSignature: true,
    });
    if (strictStatus.kvChecked || strictStatus.kvHit) {
        return strictStatus;
    }
    const kvStatus = await checkRustTagStatus(workspace, tag, {
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
function configureTurboRemoteEnv(apiUrl, token, team) {
    core.exportVariable('TURBO_API', apiUrl);
    core.exportVariable('TURBO_TOKEN', token);
    core.exportVariable('TURBO_TEAM', team || 'team_boringcache');
}
function rewritePlannedProxyPort(value, plannedPort, actualPort) {
    if (plannedPort === actualPort) {
        return value;
    }
    return value.replace(new RegExp(`:${plannedPort}(?=/|$)`), `:${actualPort}`);
}
function turboEnvForStartedProxy(plan, actualPort, tokenOverride, teamOverride) {
    const envVars = {};
    for (const [key, value] of Object.entries(plan.env_vars || {})) {
        envVars[key] = rewritePlannedProxyPort(value, plan.proxy.port, actualPort);
    }
    const endpointHost = plan.proxy.endpoint_host || '127.0.0.1';
    envVars.TURBO_API = `http://${endpointHost}:${actualPort}`;
    envVars.TURBO_TOKEN = tokenOverride.trim()
        || envVars.TURBO_TOKEN
        || 'boringcache';
    envVars.TURBO_TEAM = teamOverride.trim()
        || envVars.TURBO_TEAM
        || 'boringcache';
    envVars.BORINGCACHE_PROXY_PORT = String(actualPort);
    return envVars;
}
function nxEnvForStartedProxy(plan, actualPort, accessTokenOverride) {
    const envVars = {};
    for (const [key, value] of Object.entries(plan.env_vars || {})) {
        envVars[key] = rewritePlannedProxyPort(value, plan.proxy.port, actualPort);
    }
    const endpointHost = plan.proxy.endpoint_host || '127.0.0.1';
    envVars.NX_SELF_HOSTED_REMOTE_CACHE_SERVER = `http://${endpointHost}:${actualPort}`;
    envVars.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN = accessTokenOverride.trim()
        || envVars.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN
        || 'boringcache';
    envVars.BORINGCACHE_PROXY_PORT = String(actualPort);
    return envVars;
}
function plannedNodePackageManagerEnv(packageManager, plan) {
    const plannedEnv = plan.env_vars || {};
    if (!packageManager) {
        return {};
    }
    const envVars = {};
    switch (packageManager.name) {
        case 'pnpm':
            for (const key of ['PNPM_STORE_DIR', 'NPM_CONFIG_STORE_DIR']) {
                if (plannedEnv[key]) {
                    envVars[key] = plannedEnv[key];
                }
            }
            break;
        case 'yarn':
            for (const key of ['YARN_CACHE_FOLDER', 'YARN_ENABLE_GLOBAL_CACHE']) {
                if (plannedEnv[key]) {
                    envVars[key] = plannedEnv[key];
                }
            }
            break;
        case 'npm':
            for (const key of ['npm_config_cache', 'NPM_CONFIG_CACHE']) {
                if (plannedEnv[key]) {
                    envVars[key] = plannedEnv[key];
                }
            }
            break;
    }
    return envVars;
}
function plannedNodePackageManagerCacheDir(packageManager, plan) {
    if (!packageManager) {
        return null;
    }
    switch (packageManager.name) {
        case 'pnpm':
            return plan.env_vars?.PNPM_STORE_DIR || plan.env_vars?.NPM_CONFIG_STORE_DIR || packageManager.cacheDir;
        case 'yarn':
            return plan.env_vars?.YARN_CACHE_FOLDER || packageManager.cacheDir;
        case 'npm':
            return plan.env_vars?.npm_config_cache || plan.env_vars?.NPM_CONFIG_CACHE || packageManager.cacheDir;
    }
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
function sccacheEnvForStartedProxy(plan, actualPort) {
    const envVars = {};
    for (const [key, value] of Object.entries(plan.env_vars || {})) {
        envVars[key] = rewritePlannedProxyPort(value, plan.proxy.port, actualPort);
    }
    envVars.SCCACHE_IDLE_TIMEOUT = process.env.SCCACHE_IDLE_TIMEOUT
        || envVars.SCCACHE_IDLE_TIMEOUT
        || '0';
    return envVars;
}
function getRustArchiveEntry(entries, requested, description) {
    const entry = entries.get(requested);
    if (!entry?.path?.trim()) {
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
async function restoreRustArchiveEntry(workspace, entry, verbose, failOnCacheError) {
    const preflightHit = await checkRustTagHit(workspace, entry.tag);
    const exitCode = await execBoringCache(buildRustCacheArgs('restore', workspace, entry, verbose), { ignoreReturnCode: !failOnCacheError });
    return preflightHit && exitCode === 0;
}
function toolEnabled(plan, toolName) {
    return plan.runtimeTools.some((tool) => tool.name === toolName);
}
async function runDockerRestore(plan, inputs) {
    const context = path.resolve(plan.workingDirectory, core.getInput('context') || '.');
    const dockerfileInput = core.getInput('dockerfile') || 'Dockerfile';
    const dockerCommand = normalizeDockerCommand(core.getInput('docker-command'));
    const shouldBuild = dockerCommand !== 'setup';
    const dockerfile = shouldBuild
        ? resolveDockerfilePath(plan.workingDirectory, context, dockerfileInput)
        : dockerfileInput;
    const imageInput = core.getInput('image') || '';
    const image = shouldBuild
        ? core.getInput('image', { required: true })
        : (imageInput || 'boringcache/docker-setup');
    const tags = parseList(core.getInput('tags') || 'latest');
    const buildArgs = parseMultiline(core.getInput('build-args') || '');
    const secrets = parseMultiline(core.getInput('secrets') || '');
    const dockerToolCache = inputs.dockerToolCache;
    const dockerToolCaches = parseList(dockerToolCache);
    const target = core.getInput('target') || '';
    const platforms = core.getInput('platforms') || '';
    const push = parseBooleanInput(core.getInput('push'), 'push', false);
    const load = parseBooleanInput(core.getInput('load'), 'load', true) && !platforms;
    const noCache = parseBooleanInput(core.getInput('no-cache'), 'no-cache', false);
    const provenance = parseBooleanInput(core.getInput('provenance'), 'provenance', false);
    const sbom = parseBooleanInput(core.getInput('sbom'), 'sbom', false);
    const cacheMode = normalizeDockerCacheMode(core.getInput('cache-mode'));
    const driver = core.getInput('driver') || 'docker-container';
    const driverOpts = parseMultiline(core.getInput('driver-opts') || '');
    const buildkitdConfigInline = core.getInput('buildkitd-config-inline') || '';
    const cliOwnsManagedBuild = shouldBuild;
    if (cliOwnsManagedBuild) {
        assertPrivilegedRunnerPolicy('Managed BoringCache BuildKit');
    }
    if (platforms) {
        assertPrivilegedRunnerPolicy('QEMU/binfmt registration');
    }
    if (dockerToolCaches.length > 0 && !shouldBuild) {
        throw new Error('docker-tool-cache requires docker-command=build so boringcache docker can inject the BuildKit secret.');
    }
    const localCacheTag = inputs.cacheTag || slugify(image);
    let buildKitVerification = null;
    let buildKitCacheState;
    let modeEvidence;
    let resolvedWorkspace = plan.workspace;
    let resolvedCacheTag = localCacheTag;
    saveModeState('workspace', plan.workspace);
    saveModeState('cache-tag', localCacheTag);
    saveModeState('verbose', String(inputs.verbose));
    saveModeState('exclude', inputs.exclude);
    let builderName = '';
    if (cliOwnsManagedBuild) {
        if (driver !== 'docker-container') {
            throw new Error('BoringCache owns its managed BuildKit daemon; leave driver set to docker-container.');
        }
        if (driverOpts.length > 0 || buildkitdConfigInline.trim()) {
            throw new Error('BoringCache owns its managed BuildKit daemon for docker-command=build; '
                + 'use managed-buildkit-image instead of driver-opts and leave buildkitd-config-inline empty.');
        }
    }
    else {
        builderName = await setupBuildxBuilder(driver, driverOpts, buildkitdConfigInline, true, true, inputs.managedBuildkitImage);
    }
    saveModeState('builder-name', builderName);
    core.setOutput('buildx-name', builderName);
    core.setOutput('buildx-platforms', builderName ? await getBuilderPlatforms(builderName) : platforms);
    await setupQemuIfNeeded(platforms);
    {
        let proxyBindHost = cliOwnsManagedBuild ? '' : '127.0.0.1';
        let refHost = cliOwnsManagedBuild ? '' : '127.0.0.1';
        if (!cliOwnsManagedBuild && driver === 'docker-container') {
            const containerName = `buildx_buildkit_${builderName}0`;
            const networkMode = await getContainerNetworkMode(containerName);
            if (networkMode !== 'host') {
                proxyBindHost = '0.0.0.0';
                refHost = await getContainerGateway(containerName);
            }
        }
        // A full managed build owns the proxy for only this invocation, so choose
        // a free runner port instead of assuming the conventional setup-only
        // port is unused. Setup-only keeps 5000 for its externally consumed refs.
        const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port', cliOwnsManagedBuild ? undefined : 5000);
        const dockerPlan = await resolveDockerCliPlan(plan.workspace, plan.workingDirectory, localCacheTag, requestedPort, proxyBindHost, refHost, inputs.proxyNoPlatform, inputs.proxyNoGit, proxyPlanningReadOnly(inputs.readOnly), inputs.failOnCacheError, cacheMode, inputs.metadataHints, dockerToolCache);
        const requestedImportRefTags = buildKitCacheFromRefTags(dockerPlan.buildkit_cache);
        const cacheTag = dockerPlan.tag;
        const usesCliWrappedBuild = cliOwnsManagedBuild || dockerToolCaches.length > 0;
        if (usesCliWrappedBuild) {
            const planState = recordBuildKitCachePlanState(dockerPlan, cacheTag);
            resolvedWorkspace = planState.resolvedWorkspace;
            resolvedCacheTag = planState.resolvedCacheTag;
            buildKitVerification = planState.buildKitVerification;
            buildKitCacheState = planState.buildKitCacheState;
            let readinessProxy;
            if (cliOwnsManagedBuild && inputs.requireOciImportReady) {
                readinessProxy = await startRegistryProxy(actionProxyOptions({
                    command: 'cache-registry',
                    workspace: dockerPlan.workspace,
                    tag: cacheTag,
                    host: dockerPlan.proxy.host || '127.0.0.1',
                    port: dockerPlan.proxy.port,
                    noGit: dockerPlan.proxy.no_git,
                    noPlatform: dockerPlan.proxy.no_platform,
                    verbose: inputs.verbose,
                    readOnly: true,
                    ociRequiredReadableRefs: requestedImportRefTags,
                    requireOciImportReady: true,
                }, dockerPlan.proxy, true));
                await stopRegistryProxy(readinessProxy.pid, readinessProxy.port);
            }
            const effectiveImports = effectiveBuildKitCacheImports(dockerPlan.buildkit_cache, readinessProxy);
            setBuildKitCacheOutputs({
                ref: dockerPlan.buildkit_cache.cache_ref,
                from: effectiveImports.importSpecs,
                to: dockerPlan.buildkit_cache.cache_to,
                buildKitCache: dockerPlan.buildkit_cache,
                usedRefTags: effectiveImports.readableRefTags,
                unreadableRefTags: effectiveImports.unreadableRefTags,
                importReady: effectiveImports.importReady,
            });
            if (shouldBuild) {
                await runDockerBuildOperation(() => buildDockerImageWithCliAdapter(dockerPlan.workspace, localCacheTag, requestedPort, proxyBindHost, refHost, inputs, cacheMode, {
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
                    provenance,
                    sbom,
                    builder: cliOwnsManagedBuild ? '' : builderName,
                    cacheMode,
                }));
            }
            modeEvidence = buildKitCacheEvidence('docker', dockerPlan.buildkit_cache, effectiveImports, dockerPlan.buildkit_cache.cache_to);
        }
        else {
            const proxy = await startRegistryProxy(actionProxyOptions({
                command: 'cache-registry',
                workspace: dockerPlan.workspace,
                tag: cacheTag,
                host: dockerPlan.proxy.host || proxyBindHost,
                port: dockerPlan.proxy.port,
                noGit: dockerPlan.proxy.no_git,
                noPlatform: dockerPlan.proxy.no_platform,
                verbose: inputs.verbose,
                readOnly: dockerPlan.proxy.read_only,
                ociRequiredReadableRefs: requestedImportRefTags,
                requireOciImportReady: inputs.requireOciImportReady,
                ociAliasPromotionRefs: dockerPlan.buildkit_cache?.promotion_ref_tags || [],
            }, dockerPlan.proxy));
            saveModeState('proxy-pid', String(proxy.pid));
            saveProxyModeState(proxy.port);
            saveModeState('proxy-host', dockerPlan.proxy.host || proxyBindHost);
            saveModeState('proxy-no-git', String(dockerPlan.proxy.no_git));
            saveModeState('proxy-no-platform', String(dockerPlan.proxy.no_platform));
            saveModeState('oci-promotion-ref-tags', (dockerPlan.buildkit_cache?.promotion_ref_tags || []).join(','));
            setProxyOutputs(proxy.port);
            const planState = recordBuildKitCachePlanState(dockerPlan, cacheTag);
            resolvedWorkspace = planState.resolvedWorkspace;
            resolvedCacheTag = planState.resolvedCacheTag;
            buildKitVerification = planState.buildKitVerification;
            buildKitCacheState = planState.buildKitCacheState;
            const effectiveImports = effectiveBuildKitCacheImports(dockerPlan.buildkit_cache, proxy);
            setBuildKitCacheOutputs({
                ref: dockerPlan.buildkit_cache.cache_ref,
                from: effectiveImports.importSpecs,
                to: dockerPlan.buildkit_cache.cache_to,
                buildKitCache: dockerPlan.buildkit_cache,
                usedRefTags: effectiveImports.readableRefTags,
                unreadableRefTags: effectiveImports.unreadableRefTags,
                importReady: effectiveImports.importReady,
            });
            if (shouldBuild) {
                await runDockerBuildOperation(() => buildDockerImage({
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
                    provenance,
                    sbom,
                    builder: builderName,
                    cacheMode,
                    cacheFrom: effectiveImports.importSpecs,
                    cacheTo: dockerPlan.buildkit_cache.cache_to,
                }));
            }
            modeEvidence = buildKitCacheEvidence('docker', dockerPlan.buildkit_cache, effectiveImports, dockerPlan.buildkit_cache.cache_to);
        }
    }
    if (shouldBuild) {
        const { imageId, digest } = readDockerMetadata();
        core.setOutput('image-id', imageId);
        core.setOutput('digest', digest);
    }
    core.setOutput('workspace', resolvedWorkspace);
    core.setOutput('cache-tag', resolvedCacheTag);
    const saveExpected = buildKitVerification?.saveExpected ?? !inputs.readOnly;
    return {
        cacheTag: resolvedCacheTag,
        evidence: modeEvidence,
        // docker-command=setup defers the build to later workflow steps, so treat
        // write-capable registry refs as save-expected and verify after post-save.
        verificationSpecs: buildKitCacheVerificationSpecs(resolvedCacheTag, buildKitCacheState, buildKitVerification?.noPlatform || false, buildKitVerification?.noGit || false, saveExpected, plan.workingDirectory),
    };
}
async function runDockerSave(options = {}) {
    const allowSaves = options.allowSaves !== false;
    const builderName = getModeState('builder-name');
    try {
        const proxyPid = getModeState('proxy-pid');
        if (proxyPid) {
            if (allowSaves) {
                await verifyOciPromotionRefsThenStopProxy(proxyPid);
            }
            else {
                await stopProxyFromState();
            }
            return;
        }
        if (!allowSaves) {
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
    const push = parseBooleanInput(core.getInput('push'), 'push', false);
    const output = core.getInput('output') || '';
    const buildArgs = parseMultiline(core.getInput('build-args') || '');
    const secrets = parseMultiline(core.getInput('secrets') || '');
    const sshSpecs = parseMultiline(core.getInput('ssh') || '');
    const target = core.getInput('target') || '';
    const platforms = core.getInput('platforms') || '';
    const noCache = parseBooleanInput(core.getInput('no-cache'), 'no-cache', false);
    const cacheMode = normalizeDockerCacheMode(core.getInput('cache-mode'));
    const buildkitHost = core.getInput('buildkit-host', { required: true });
    const tlsCaInput = core.getInput('buildkit-tls-ca') || '';
    const tlsCertInput = core.getInput('buildkit-tls-cert') || '';
    const tlsKeyInput = core.getInput('buildkit-tls-key') || '';
    const tlsSkipVerify = parseBooleanInput(core.getInput('buildkit-tls-skip-verify'), 'buildkit-tls-skip-verify', false);
    const localCacheTag = inputs.cacheTag || slugify(image);
    let buildKitVerification = null;
    let buildKitCacheState;
    let modeEvidence;
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
    {
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
        const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port', 5000);
        const dockerPlan = await resolveBuildkitCliPlan(plan.workspace, plan.workingDirectory, localCacheTag, requestedPort, proxyBindHost, refHost, inputs.proxyNoPlatform, inputs.proxyNoGit, proxyPlanningReadOnly(inputs.readOnly), inputs.failOnCacheError, cacheMode, inputs.metadataHints);
        const requestedImportRefTags = buildKitCacheFromRefTags(dockerPlan.buildkit_cache);
        const cacheTag = dockerPlan.tag;
        const proxy = await startRegistryProxy(actionProxyOptions({
            command: 'cache-registry',
            workspace: dockerPlan.workspace,
            tag: cacheTag,
            host: dockerPlan.proxy.host || proxyBindHost,
            port: dockerPlan.proxy.port,
            noGit: dockerPlan.proxy.no_git,
            noPlatform: dockerPlan.proxy.no_platform,
            verbose: inputs.verbose,
            readOnly: dockerPlan.proxy.read_only,
            ociRequiredReadableRefs: requestedImportRefTags,
            requireOciImportReady: inputs.requireOciImportReady,
            ociAliasPromotionRefs: dockerPlan.buildkit_cache?.promotion_ref_tags || [],
        }, dockerPlan.proxy));
        saveModeState('proxy-pid', String(proxy.pid));
        saveProxyModeState(proxy.port);
        saveModeState('proxy-host', dockerPlan.proxy.host || proxyBindHost);
        saveModeState('proxy-no-git', String(dockerPlan.proxy.no_git));
        saveModeState('proxy-no-platform', String(dockerPlan.proxy.no_platform));
        saveModeState('oci-promotion-ref-tags', (dockerPlan.buildkit_cache?.promotion_ref_tags || []).join(','));
        setProxyOutputs(proxy.port);
        const planState = recordBuildKitCachePlanState(dockerPlan, cacheTag);
        resolvedWorkspace = planState.resolvedWorkspace;
        resolvedCacheTag = planState.resolvedCacheTag;
        buildKitVerification = planState.buildKitVerification;
        buildKitCacheState = planState.buildKitCacheState;
        const effectiveImports = effectiveBuildKitCacheImports(dockerPlan.buildkit_cache, proxy);
        setBuildKitCacheOutputs({
            ref: dockerPlan.buildkit_cache.cache_ref,
            from: effectiveImports.importSpecs,
            to: dockerPlan.buildkit_cache.cache_to,
            buildKitCache: dockerPlan.buildkit_cache,
            usedRefTags: effectiveImports.readableRefTags,
            unreadableRefTags: effectiveImports.unreadableRefTags,
            importReady: effectiveImports.importReady,
        });
        await buildWithMaterializedBuildkitTls({
            addr: buildkitHost,
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
            importCache: effectiveImports.importSpecs,
            exportCache: dockerPlan.buildkit_cache.cache_to,
            output,
            imageTags,
            push,
            noCache,
            metadataFile: BUILDKIT_METADATA_FILE,
        }, { ca: tlsCaInput, cert: tlsCertInput, key: tlsKeyInput });
        modeEvidence = buildKitCacheEvidence('buildkit', dockerPlan.buildkit_cache, effectiveImports, dockerPlan.buildkit_cache.cache_to);
    }
    core.setOutput('digest', readBuildkitDigest(BUILDKIT_METADATA_FILE));
    core.setOutput('workspace', resolvedWorkspace);
    core.setOutput('cache-tag', resolvedCacheTag);
    const saveExpected = buildKitVerification?.saveExpected ?? !inputs.readOnly;
    return {
        cacheTag: resolvedCacheTag,
        evidence: modeEvidence,
        verificationSpecs: buildKitCacheVerificationSpecs(resolvedCacheTag, buildKitCacheState, buildKitVerification?.noPlatform || false, buildKitVerification?.noGit || false, saveExpected, plan.workingDirectory),
    };
}
async function runBuildkitSave(options = {}) {
    const allowSaves = options.allowSaves !== false;
    const proxyPid = getModeState('proxy-pid');
    if (proxyPid) {
        if (allowSaves) {
            await verifyOciPromotionRefsThenStopProxy(proxyPid);
        }
        else {
            await stopProxyFromState();
        }
        return;
    }
    if (!allowSaves) {
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
    const inputVersion = core.getInput('bazel-version') || '';
    const bazelrcLines = core.getInput('bazelrc-lines') || '';
    const runtimeVersion = plan.runtimeTools.find((tool) => tool.name === 'bazel')?.version || '';
    const bazelVersion = inputVersion || runtimeVersion;
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const proxyPlan = await resolveAdapterCliPlan('bazel', plan.workspace, plan.workingDirectory, inputs.cacheTag, requestedPort, inputs.proxyNoPlatform, inputs.proxyNoGit, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
        bazelrcLines,
    });
    const workspace = proxyPlan.workspace;
    const cacheTag = proxyPlan.tag;
    const setup = requireAdapterSetupPlan('bazel', proxyPlan.setup);
    saveModeState('proxy-pid', '');
    if (bazelVersion) {
        core.exportVariable('USE_BAZEL_VERSION', bazelVersion);
    }
    const proxy = await startRegistryProxy(actionProxyOptions({
        command: 'cache-registry',
        workspace,
        tag: cacheTag,
        host: proxyPlan.proxy.host || '127.0.0.1',
        port: proxyPlan.proxy.port,
        noGit: proxyPlan.proxy.no_git,
        noPlatform: proxyPlan.proxy.no_platform,
        verbose: inputs.verbose,
        readOnly: proxyPlan.proxy.read_only,
    }, proxyPlan.proxy));
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy.port);
    applyAdapterSetupPlan(setup);
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('workspace', workspace);
    return {
        cacheTag,
        verificationSpecs: [adapterProxyVerificationSpec(cacheTag, proxyPlan.proxy, plan.workingDirectory)],
    };
}
function configureGoProxyEnv(gocacheprog) {
    core.exportVariable('GOCACHEPROG', gocacheprog);
}
function goCacheProgForProxy(proxyPlan, port) {
    const endpoint = `http://${proxyPlan.proxy.endpoint_host}:${port}`;
    const planned = proxyPlan.env_vars?.GOCACHEPROG?.trim();
    if (!planned) {
        return `boringcache go-cacheprog --endpoint ${endpoint}`;
    }
    if (planned.includes('--endpoint=')) {
        return planned.replace(/--endpoint=\S+/, `--endpoint=${endpoint}`);
    }
    if (planned.includes('--endpoint')) {
        return planned.replace(/--endpoint\s+\S+/, `--endpoint ${endpoint}`);
    }
    return `${planned} --endpoint ${endpoint}`;
}
async function runGoRestore(plan, inputs) {
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const proxyPlan = await resolveAdapterCliPlan('go', plan.workspace, plan.workingDirectory, inputs.cacheTag, requestedPort, inputs.proxyNoPlatform, inputs.proxyNoGit, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
    });
    const workspace = proxyPlan.workspace;
    const cacheTag = proxyPlan.tag;
    saveModeState('proxy-pid', '');
    const proxy = await startRegistryProxy(actionProxyOptions({
        command: 'cache-registry',
        workspace,
        tag: cacheTag,
        host: proxyPlan.proxy.host || '127.0.0.1',
        port: proxyPlan.proxy.port,
        noGit: proxyPlan.proxy.no_git,
        noPlatform: proxyPlan.proxy.no_platform,
        verbose: inputs.verbose,
        readOnly: proxyPlan.proxy.read_only,
    }, proxyPlan.proxy));
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy.port);
    configureGoProxyEnv(goCacheProgForProxy(proxyPlan, proxy.port));
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('workspace', workspace);
    return {
        cacheTag,
        verificationSpecs: [adapterProxyVerificationSpec(cacheTag, proxyPlan.proxy, plan.workingDirectory)],
    };
}
async function runGradleRestore(plan, inputs) {
    const gradleHome = core.getInput('gradle-home') || '';
    const enableBuildCache = parseBooleanInput(core.getInput('enable-build-cache'), 'enable-build-cache', true);
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const proxyPlan = await resolveAdapterCliPlan('gradle', plan.workspace, plan.workingDirectory, inputs.cacheTag, requestedPort, inputs.proxyNoPlatform, inputs.proxyNoGit, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
        gradleHome,
        enableGradleBuildCache: enableBuildCache,
    });
    const workspace = proxyPlan.workspace;
    const cacheTag = proxyPlan.tag;
    const setup = requireAdapterSetupPlan('gradle', proxyPlan.setup);
    const proxy = await startRegistryProxy(actionProxyOptions({
        command: 'cache-registry',
        workspace,
        tag: cacheTag,
        host: proxyPlan.proxy.host || '127.0.0.1',
        port: proxyPlan.proxy.port,
        noGit: proxyPlan.proxy.no_git,
        noPlatform: proxyPlan.proxy.no_platform,
        verbose: inputs.verbose,
        readOnly: proxyPlan.proxy.read_only,
    }, proxyPlan.proxy));
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy.port);
    applyAdapterSetupPlan(setup);
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('workspace', workspace);
    return {
        cacheTag,
        verificationSpecs: [adapterProxyVerificationSpec(cacheTag, proxyPlan.proxy, plan.workingDirectory)],
    };
}
async function runMavenRestore(plan, inputs) {
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const mavenExtensionsPath = core.getInput('maven-extensions-path') || '';
    const mavenBuildCacheConfigPath = core.getInput('maven-build-cache-config-path') || '';
    const mavenLocalRepo = core.getInput('maven-local-repo') || '';
    const mavenBuildCacheExtensionVersion = core.getInput('maven-build-cache-extension-version') || '';
    const mavenBuildCacheId = core.getInput('maven-build-cache-id') || '';
    const proxyPlan = await resolveAdapterCliPlan('maven', plan.workspace, plan.workingDirectory, inputs.cacheTag, requestedPort, inputs.proxyNoPlatform, inputs.proxyNoGit, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
        mavenExtensionsPath,
        mavenBuildCacheConfigPath,
        mavenLocalRepo,
        mavenBuildCacheExtensionVersion,
        mavenBuildCacheId,
    });
    const workspace = proxyPlan.workspace;
    const cacheTag = proxyPlan.tag;
    const setup = requireAdapterSetupPlan('maven', proxyPlan.setup);
    const proxy = await startRegistryProxy(actionProxyOptions({
        command: 'cache-registry',
        workspace,
        tag: cacheTag,
        host: proxyPlan.proxy.host || '127.0.0.1',
        port: proxyPlan.proxy.port,
        noGit: proxyPlan.proxy.no_git,
        noPlatform: proxyPlan.proxy.no_platform,
        verbose: inputs.verbose,
        readOnly: proxyPlan.proxy.read_only,
    }, proxyPlan.proxy));
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy.port);
    applyAdapterSetupPlan(setup);
    const extensionsPath = requireSetupFilePath(setup, 'extensions.xml', 'maven extensions.xml');
    const buildCacheConfigPath = requireSetupFilePath(setup, 'maven-build-cache-config.xml', 'maven build-cache config');
    const localRepo = requireSetupDirectory(setup, 'maven local repository directory');
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('maven-extensions-path', extensionsPath);
    core.setOutput('maven-build-cache-config-path', buildCacheConfigPath);
    core.setOutput('maven-local-repo', localRepo);
    core.setOutput('workspace', workspace);
    return {
        cacheTag,
        verificationSpecs: [adapterProxyVerificationSpec(cacheTag, proxyPlan.proxy, plan.workingDirectory)],
    };
}
async function runTurboProxyRestore(plan, inputs) {
    const turboApiUrl = core.getInput('turbo-api-url') || '';
    const turboToken = core.getInput('turbo-token') || 'boringcache';
    const turboTeam = core.getInput('turbo-team') || '';
    const turboPortInput = core.getInput('turbo-port');
    const preferredPort = await resolvePreferredPort(turboPortInput || inputs.proxyPort, turboPortInput ? 'turbo-port' : 'proxy-port', 4227);
    const turboPlan = await resolveAdapterCliPlan('turbo', plan.workspace, plan.workingDirectory, inputs.cacheTag, preferredPort, inputs.proxyNoPlatform, inputs.proxyNoGit, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
    });
    const workspace = turboPlan.workspace;
    const cacheTag = turboPlan.tag;
    const packageManager = await detectNodePackageManager(plan.workingDirectory);
    await ensureCorepackPackageManager(plan.workingDirectory, packageManager, plan.runtimeTools);
    if (packageManager) {
        core.setOutput('package-manager', packageManager.name);
        core.setOutput('package-manager-cache-dir', plannedNodePackageManagerCacheDir(packageManager, turboPlan) || packageManager.cacheDir);
    }
    if (turboApiUrl) {
        exportEnvVars(plannedNodePackageManagerEnv(packageManager, turboPlan));
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
        proxy = await startPortableCacheProxy(workspace, await findAvailablePort(), cacheTag, turboPlan.proxy.read_only, turboPlan.proxy);
    }
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy.port);
    exportEnvVars(turboEnvForStartedProxy(turboPlan, proxy.port, turboToken, turboTeam));
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('workspace', workspace);
    return {
        cacheTag,
        verificationSpecs: [adapterProxyVerificationSpec(cacheTag, turboPlan.proxy, plan.workingDirectory)],
    };
}
async function runNxProxyRestore(plan, inputs) {
    const nxAccessToken = core.getInput('nx-access-token');
    const nxPortInput = core.getInput('nx-port');
    const preferredPort = await resolvePreferredPort(nxPortInput || inputs.proxyPort, nxPortInput ? 'nx-port' : 'proxy-port', 4228);
    const nxPlan = await resolveAdapterCliPlan('nx', plan.workspace, plan.workingDirectory, inputs.cacheTag, preferredPort, inputs.proxyNoPlatform, inputs.proxyNoGit, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
    });
    const workspace = nxPlan.workspace;
    const cacheTag = nxPlan.tag;
    let proxy;
    try {
        proxy = await startPortableCacheProxy(workspace, nxPlan.proxy.port || preferredPort, cacheTag, nxPlan.proxy.read_only, nxPlan.proxy);
    }
    catch {
        proxy = await startPortableCacheProxy(workspace, await findAvailablePort(), cacheTag, nxPlan.proxy.read_only, nxPlan.proxy);
    }
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy.port);
    exportEnvVars(nxEnvForStartedProxy(nxPlan, proxy.port, nxAccessToken));
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('workspace', workspace);
    return {
        cacheTag,
        verificationSpecs: [adapterProxyVerificationSpec(cacheTag, nxPlan.proxy, plan.workingDirectory)],
    };
}
async function runRustRestore(plan, inputs) {
    const cacheTagPrefix = (inputs.cacheTag || plan.cacheTagPrefix || '').trim();
    const inputVersion = core.getInput('rust-version') || core.getInput('toolchain');
    const workingDir = plan.workingDirectory;
    const cacheCargo = parseBooleanInput(core.getInput('cache-cargo'), 'cache-cargo', true);
    const cacheCargoBin = parseBooleanInput(core.getInput('cache-cargo-bin'), 'cache-cargo-bin', false);
    const cacheTarget = parseBooleanInput(core.getInput('cache-target'), 'cache-target', true);
    const useSccache = parseBooleanInput(core.getInput('sccache'), 'sccache', false);
    const sccacheVersion = core.getInput('sccache-version') || SCCACHE_DEFAULT_VERSION.slice(1);
    const sccacheMode = normalizeSccacheMode(core.getInput('sccache-mode'));
    const sccacheCacheSize = core.getInput('sccache-cache-size') || '5G';
    const targets = core.getInput('targets');
    const components = core.getInput('components');
    const profile = normalizeRustupProfile(core.getInput('profile'));
    const rustVersion = await detectRustVersion(workingDir, inputVersion);
    configureCargoEnv();
    const rustMajorMinor = rustVersion.match(/^(\d+\.\d+)/)?.[1] || rustVersion;
    const rustToolTagSuffix = `rust${rustMajorMinor}`;
    const lockPath = path.join(workingDir, 'Cargo.lock');
    const hasGitDeps = cacheCargo && await hasGitDependencies(lockPath);
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
        ? await resolveCliArchiveEntries(workingDir, {
            workspaceInput: inputs.workspace.trim(),
            entryIds: rustEntryIds,
            cacheTag: cacheTagPrefix,
            toolTagSuffix: rustToolTagSuffix,
            readOnly: inputs.readOnly,
            fallbackWorkspace: plan.workspace,
        })
        : { workspace: plan.workspace, entries: [], envVars: {} };
    exportEnvVars(rustEntriesPlan.envVars);
    const rustEntries = new Map(rustEntriesPlan.entries.map((entry) => [entry.requested, entry]));
    const workspace = rustEntriesPlan.workspace || plan.workspace;
    const cargoRegistryEntry = cacheCargo
        ? getRustArchiveEntry(rustEntries, 'cargo-registry', 'cargo registry cache')
        : null;
    const cargoGitEntry = cacheCargo && hasGitDeps
        ? getRustArchiveEntry(rustEntries, 'cargo-git', 'cargo git cache')
        : null;
    const cargoBinEntry = cacheCargoBin
        ? getRustArchiveEntry(rustEntries, 'cargo-bin', 'cargo bin cache')
        : null;
    const targetEntry = cacheTarget
        ? getRustArchiveEntry(rustEntries, 'target', 'Rust target cache')
        : null;
    const sccacheEntry = useSccache
        ? getRustArchiveEntry(rustEntries, 'sccache-dir', 'sccache cache')
        : null;
    if (useSccache && sccacheMode !== 'proxy') {
        configureSccacheEnv(sccacheCacheSize, sccacheEntry?.path || getSccacheDir());
    }
    core.setOutput('workspace', workspace);
    core.setOutput('rust-version', rustVersion);
    core.setOutput('cache-tag', cacheTagPrefix);
    core.setOutput('cargo-tag', cargoRegistryEntry?.tag || '');
    core.setOutput('cargo-git-tag', cargoGitEntry?.tag || '');
    core.setOutput('cargo-bin-tag', cargoBinEntry?.tag || '');
    core.setOutput('target-tag', targetEntry?.tag || '');
    core.setOutput('sccache-tag', sccacheEntry?.tag || '');
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
        registryRestored = await restoreRustArchiveEntry(workspace, cargoRegistryEntry, inputs.verbose, inputs.failOnCacheError);
        saveRustArchiveEntryState('cargo-registry', cargoRegistryEntry);
    }
    if (cargoGitEntry) {
        cargoGitRestored = await restoreRustArchiveEntry(workspace, cargoGitEntry, inputs.verbose, inputs.failOnCacheError);
        saveRustArchiveEntryState('cargo-git', cargoGitEntry);
    }
    if (cargoBinEntry) {
        cargoBinRestored = await restoreRustArchiveEntry(workspace, cargoBinEntry, inputs.verbose, inputs.failOnCacheError);
        saveRustArchiveEntryState('cargo-bin', cargoBinEntry);
    }
    if (targetEntry) {
        targetRestored = await restoreRustArchiveEntry(workspace, targetEntry, inputs.verbose, inputs.failOnCacheError);
        saveRustArchiveEntryState('target', targetEntry);
    }
    if (useSccache && sccacheEntry) {
        await installSccache(sccacheVersion);
        if (sccacheMode === 'proxy') {
            const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
            const proxyPlan = await resolveAdapterCliPlan('sccache', workspace, workingDir, sccacheEntry.tag, requestedPort, true, true, proxyPlanningReadOnly(inputs.readOnly), {
                metadataHintsInput: inputs.metadataHints,
            });
            const sccachePreflightStatus = await checkRustProxyTagStatus(proxyPlan.workspace, proxyPlan.tag, {
                noPlatform: proxyPlan.proxy.no_platform,
                noGit: proxyPlan.proxy.no_git,
            });
            sccacheRestored = sccachePreflightStatus.kvHit;
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
            }, proxyPlan.proxy));
            exportEnvVars(sccacheEnvForStartedProxy(proxyPlan, proxy.port));
            await startSccacheServer();
            saveModeState('proxy-pid', String(proxy.pid));
            saveProxyModeState(proxy.port);
            saveRustArchiveEntryState('sccache', {
                ...sccacheEntry,
                tag: proxyPlan.tag,
                tagPathPair: `${proxyPlan.tag}:${sccacheEntry.path}`,
            });
            saveModeState('sccache-preflight-hit', String(sccachePreflightStatus.hit));
            saveModeState('sccache-preflight-cache-entry-hit', String(sccachePreflightStatus.cacheEntryHit));
            saveModeState('sccache-preflight-kv-hit', String(sccachePreflightStatus.kvHit));
            saveModeState('sccache-preflight-kv-checked', String(sccachePreflightStatus.kvChecked));
            setProxyOutputs(proxy.port);
        }
        else {
            sccacheRestored = await restoreRustArchiveEntry(workspace, sccacheEntry, inputs.verbose, inputs.failOnCacheError);
            await startSccacheServer();
            saveRustArchiveEntryState('sccache', sccacheEntry);
            saveModeState('sccache-preflight-hit', String(sccacheRestored));
            saveModeState('sccache-preflight-cache-entry-hit', String(sccacheRestored));
            saveModeState('sccache-preflight-kv-hit', 'false');
            saveModeState('sccache-preflight-kv-checked', 'false');
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
            tag: readRustArchiveEntryState('sccache')?.tag || sccacheEntry.tag,
            noPlatform: sccacheMode === 'proxy',
            noGit: sccacheMode === 'proxy',
            pathHint: sccacheMode === 'proxy' ? workingDir : sccacheEntry.path,
            saveExpected: sccacheMode !== 'proxy' || !inputs.readOnly,
        });
    }
    return { cacheHit, cacheTag: cacheTagPrefix, verificationSpecs };
}
async function runRustSave(options = {}) {
    const workspace = getModeState('workspace');
    const cacheCargo = getModeState('cache-cargo') === 'true';
    const cacheCargoBin = getModeState('cache-cargo-bin') === 'true';
    const cacheTarget = getModeState('cache-target') === 'true';
    const useSccache = getModeState('use-sccache') === 'true';
    const sccacheMode = getModeState('sccache-mode') || 'local';
    const verbose = getModeState('verbose') === 'true';
    const exclude = core.getInput('exclude');
    const allowSaves = options.allowSaves !== false;
    if (!workspace) {
        return;
    }
    if (!allowSaves) {
        if (useSccache) {
            await stopSccacheServer();
            if (sccacheMode === 'proxy') {
                await stopProxyFromState();
            }
        }
        return;
    }
    if (!hasSaveToken()) {
        if (useSccache && sccacheMode === 'proxy') {
            await stopSccacheServer();
            await stopProxyFromState();
        }
        core.notice(`Save skipped: ${missingSaveTokenMessage()}`);
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
            const preflightCacheEntryHit = getModeState('sccache-preflight-cache-entry-hit') === 'true';
            const preflightKvHit = getModeState('sccache-preflight-kv-hit') === 'true';
            const preflightKvChecked = getModeState('sccache-preflight-kv-checked') === 'true';
            const sccacheStats = await stopSccacheServer();
            await stopProxyFromState();
            if (sccacheTag && (!sccacheStats || sccacheStats.compileRequests === 0)) {
                markModeVerifyTagSkipped(sccacheTag);
                if (preflightKvHit) {
                    core.info(`Skipping sccache post-save verification for ${sccacheTag}: no compile requests were observed.`);
                }
                else if (preflightCacheEntryHit) {
                    core.info(`Skipping sccache post-save verification for ${sccacheTag}: signed cache entry existed, but no compile requests were observed.`);
                }
                else {
                    core.info(`Skipping sccache save for ${sccacheTag}: no compile requests were observed.`);
                }
                return;
            }
            if (sccacheTag && sccacheStats && sccacheStats.compileRequests > 0) {
                const postShutdownStatus = await checkRustProxyTagStatus(workspace, sccacheTag, {
                    noPlatform: true,
                    noGit: true,
                });
                const rustHitRate = sccacheStats.rustHitRate || 'unknown';
                core.info(`sccache proxy stats for ${sccacheTag}: compile_requests=${sccacheStats.compileRequests}, cache_hits=${sccacheStats.cacheHits}, cache_misses=${sccacheStats.cacheMisses}, rust_hit_rate=${rustHitRate}`);
                if (sccacheStats.cacheHits === 0) {
                    if (preflightKvHit) {
                        core.warning(`sccache proxy saw 0 cache hits across ${sccacheStats.compileRequests} compile requests even though direct KV rows existed for '${sccacheTag}' before startup. Check sccache key churn, emitted tag semantics, and proxy read logs.`);
                    }
                    else if (preflightCacheEntryHit && postShutdownStatus.kvHit) {
                        core.notice(`sccache proxy saw 0 cache hits across ${sccacheStats.compileRequests} compile requests for '${sccacheTag}'. A signed cache entry existed before startup, but direct KV rows were absent; the run populated the proxy KV cache for future runs.`);
                    }
                    else if (preflightCacheEntryHit && preflightKvChecked && postShutdownStatus.kvChecked) {
                        core.warning(`sccache proxy saw 0 cache hits across ${sccacheStats.compileRequests} compile requests for '${sccacheTag}'. A signed cache entry existed before startup, but direct KV rows were absent and still were not visible after shutdown. Check proxy KV publish logs and save token scope.`);
                    }
                    else if (preflightCacheEntryHit) {
                        core.warning(`sccache proxy saw 0 cache hits across ${sccacheStats.compileRequests} compile requests for '${sccacheTag}'. A signed cache entry existed before startup, but this CLI/API did not report direct KV row visibility. Check boringcache/one cli-version alignment and proxy read/write logs.`);
                    }
                    else if (postShutdownStatus.kvHit) {
                        core.notice(`sccache proxy saw 0 cache hits across ${sccacheStats.compileRequests} compile requests, but '${sccacheTag}' published successfully. This looks like a cold fill.`);
                    }
                    else if (postShutdownStatus.cacheEntryHit) {
                        core.warning(`sccache proxy saw 0 cache hits across ${sccacheStats.compileRequests} compile requests and '${sccacheTag}' had a signed cache entry after shutdown, but direct KV rows were not visible. Check boringcache/one cli-version alignment and proxy KV publish logs.`);
                    }
                    else {
                        core.notice(`sccache proxy saw 0 cache hits across ${sccacheStats.compileRequests} compile requests and '${sccacheTag}' was not reported as direct KV rows during post-shutdown verification. This usually means a cold fill; check proxy publish logs if the next run also misses.`);
                    }
                }
            }
        }
        else {
            const sccacheEntry = readRustArchiveEntryState('sccache');
            const sccacheTag = sccacheEntry?.tag || '';
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
        const proxyPort = Number.parseInt(getModeState('proxy-port'), 10);
        await stopRegistryProxy(parseInt(proxyPid, 10), Number.isFinite(proxyPort) ? proxyPort : undefined);
    }
}
