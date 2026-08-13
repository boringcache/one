import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execBoringCache as execBoringCacheCore, DEFAULT_PROXY_PORT, findAvailablePort, hasToolVersionOnPath, hasRestoreToken, hasSaveToken, missingSaveTokenMessage, resolveGitHubCacheIdentity, startGhaAdapter, startRegistryProxy, stopRegistryProxy, proxyStopTimeoutMs, PROXY_VERIFICATION_STOP_TIMEOUT_MS, } from './core';
import { DEFAULT_OCI_HYDRATION_POLICY, detectNodePackageManager, normalizeVerifyTimeoutSeconds, } from './utils';
import { readSha256File, verifySha256 } from './core/integrity';
const DOCKER_METADATA_FILE = path.join(os.tmpdir(), 'boringcache-one-docker-metadata.json');
const BUILDKIT_METADATA_FILE = path.join(os.tmpdir(), 'boringcache-one-buildkit-metadata.json');
const DEFAULT_MANAGED_BUILDKIT_IMAGE = 'ghcr.io/boringcache/buildkit@sha256:57bdd820fc830c8adb8f5de4e9b651a52b8dbf63695b028634dc27347a385b67';
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
const SCCACHE_DEFAULT_VERSION = 'v0.17.0';
// Immutable digests published with the default sccache release. Explicit
// version overrides must provide the publisher's adjacent .sha256 asset.
const SCCACHE_DEFAULT_SHA256 = {
    'sccache-v0.17.0-aarch64-apple-darwin.tar.gz': '0c560bfba31aef5bdfb4fb3d2677f6e61d71c5c00952f2a83344f47aa31f00f1',
    'sccache-v0.17.0-aarch64-pc-windows-msvc.zip': '82994d1bc92ccc0556f7e6e0ad6cbd08a41a1e84b461fcae628ac2afc8c372bf',
    'sccache-v0.17.0-aarch64-unknown-linux-musl.tar.gz': '821a86343191aa1cbab74bd42f9e93c9a63bf85e4742945f40d3ae84193c1c77',
    'sccache-v0.17.0-x86_64-apple-darwin.tar.gz': 'c2144cafbfe3d22e34ae637f9974ce53613543ac19477fdb287df22ea3668261',
    'sccache-v0.17.0-x86_64-pc-windows-msvc.zip': 'e94cfc5b58cbe439302f586c1d1bd7980c2cd371d47bdf385ade657411e6f3ac',
    'sccache-v0.17.0-x86_64-unknown-linux-musl.tar.gz': '67c4a96dd237c1f518f6b36083f270f9976d516f1e57fce891755ea782e50006',
};
const CCACHE_DEFAULT_VERSION = '4.13.6';
const CCACHE_STORAGE_HTTP_DEFAULT_VERSION = '0.8';
const CCACHE_DEFAULT_RELEASES = {
    'darwin-arm64': {
        repository: 'ccache/ccache',
        tag: 'v4.13.6',
        archiveName: 'ccache-4.13.6-darwin.tar.gz',
        archiveRoot: 'ccache-4.13.6-darwin',
        sha256: '0274210ec9c9936ed5711d59b0de3167a51216a588ddde35f6bc828f366fe6d9',
    },
    'darwin-x64': {
        repository: 'ccache/ccache',
        tag: 'v4.13.6',
        archiveName: 'ccache-4.13.6-darwin.tar.gz',
        archiveRoot: 'ccache-4.13.6-darwin',
        sha256: '0274210ec9c9936ed5711d59b0de3167a51216a588ddde35f6bc828f366fe6d9',
    },
    'linux-arm64': {
        repository: 'ccache/ccache',
        tag: 'v4.13.6',
        archiveName: 'ccache-4.13.6-linux-aarch64-glibc.tar.gz',
        archiveRoot: 'ccache-4.13.6-linux-aarch64-glibc',
        sha256: 'fae67fb810e1f0d390409af6603355483572229e19183e68574cd0f851a6fb98',
    },
    'linux-x64': {
        repository: 'ccache/ccache',
        tag: 'v4.13.6',
        archiveName: 'ccache-4.13.6-linux-x86_64-glibc.tar.gz',
        archiveRoot: 'ccache-4.13.6-linux-x86_64-glibc',
        sha256: '567b1b648411819590f918f045218c92da14418bdec3b30db94a3b4f5d77cf13',
    },
    'win32-arm64': {
        repository: 'ccache/ccache',
        tag: 'v4.13.6',
        archiveName: 'ccache-4.13.6-windows-aarch64.zip',
        archiveRoot: 'ccache-4.13.6-windows-aarch64',
        sha256: 'bec01846b06d6d87bf35eda50544d7c8bf9b9a4859f218417a7081aa45d7fd47',
    },
    'win32-x64': {
        repository: 'ccache/ccache',
        tag: 'v4.13.6',
        archiveName: 'ccache-4.13.6-windows-x86_64.zip',
        archiveRoot: 'ccache-4.13.6-windows-x86_64',
        sha256: '3d7cebb05850ad704e197b3f1d3f0f924ab6c9fdfc561578e146184fe9d89380',
    },
};
const CCACHE_STORAGE_HTTP_DEFAULT_RELEASES = {
    'darwin-arm64': ccacheStorageHttpRelease('darwin-arm64', '8da910d967ebabfb9bc489d59a5f8b35374300b67cc28a3fa17f4396249e6f68'),
    'darwin-x64': ccacheStorageHttpRelease('darwin-amd64', '943c65bca642c9f7e3bebe09a01693ec29a06eda6733553e8b95625720952f1b'),
    'linux-arm64': ccacheStorageHttpRelease('linux-arm64', '49587fb0534f5c6265fd1008267af795885f8297c6c51213708da74e4de9d475'),
    'linux-x64': ccacheStorageHttpRelease('linux-amd64', '2c2cfafa39f5a4628201ccc11c81829197519159aa128fe00ea251f1f4f2461c'),
    'win32-arm64': ccacheStorageHttpRelease('windows-arm64', 'f5807537fffacfc7c062fa8ca55fb33c0ce7227a4dd1ad4eb6c27cd268e439fe'),
    'win32-x64': ccacheStorageHttpRelease('windows-amd64', '0889a03bd1fdc0c639574ed435b68c29c82b03d571ea37a7153373c4c398eee0'),
};
function ccacheStorageHttpRelease(platform, sha256) {
    const archiveRoot = `ccache-storage-http-go-${CCACHE_STORAGE_HTTP_DEFAULT_VERSION}-${platform}`;
    return {
        repository: 'ccache/ccache-storage-http-go',
        tag: `v${CCACHE_STORAGE_HTTP_DEFAULT_VERSION}`,
        archiveName: `${archiveRoot}${platform.startsWith('windows-') ? '.zip' : '.tar.gz'}`,
        archiveRoot,
        sha256,
    };
}
async function waitForArchiveMaterialization(options) {
    await options.archiveMaterialized;
}
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
function adapterProxyVerificationSpec(tag, proxyPlan, pathHint) {
    return {
        tag,
        noPlatform: proxyPlan.no_platform,
        noGit: proxyPlan.no_git,
        pathHint,
        saveExpected: !proxyPlan.read_only,
    };
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
function verifiedReleaseComponent(label, value) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) {
        throw new Error(`Invalid verified release ${label}: ${value}`);
    }
    return value;
}
export function verifiedReleasePaths(extractionDirectory, installDirectory, archiveRoot, executableName) {
    const safeArchiveRoot = verifiedReleaseComponent('archive root', archiveRoot);
    const safeExecutableName = verifiedReleaseComponent('executable name', executableName);
    const sourcePath = path.resolve(extractionDirectory, safeArchiveRoot, safeExecutableName);
    const destinationPath = path.resolve(installDirectory, safeExecutableName);
    if (!isPathInside(extractionDirectory, sourcePath)) {
        throw new Error(`Verified release source escapes its extraction directory: ${sourcePath}`);
    }
    if (!isPathInside(installDirectory, destinationPath)) {
        throw new Error(`Verified release destination escapes its install directory: ${destinationPath}`);
    }
    return { sourcePath, destinationPath };
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
export async function runModeRestore(plan, inputs, options = {}) {
    switch (plan.mode) {
        case 'docker':
            return runDockerRestore(plan, inputs);
        case 'buildkit':
            return runBuildkitRestore(plan, inputs);
        case 'bazel':
            return runBazelRestore(plan, inputs, options);
        case 'cargo':
            return runCargoRestore(plan, inputs);
        case 'ccache':
            return runCcacheRestore(plan, inputs);
        case 'go':
            return runGoRestore(plan, inputs);
        case 'gradle':
            return runGradleRestore(plan, inputs, options);
        case 'gha':
            return runGhaRestore(plan, inputs);
        case 'maven':
            return runMavenRestore(plan, inputs, options);
        case 'nix':
            return runNixRestore(plan, inputs, options);
        case 'sccache':
            return runSccacheRestore(plan, inputs);
        case 'turbo':
            return runTurboProxyRestore(plan, inputs);
        case 'nx':
            return runNxProxyRestore(plan, inputs);
        case 'xcode':
            return runXcodeRestore(plan, inputs, options);
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
        case 'cargo':
            return;
        case 'ccache':
            await runCcacheSave(options);
            return;
        case 'go':
            await stopProxyFromState();
            return;
        case 'gradle':
        case 'gha':
        case 'maven':
        case 'nx':
        case 'turbo':
        case 'xcode':
            await stopProxyFromState();
            return;
        case 'nix':
            try {
                await drainNixUploads();
            }
            finally {
                try {
                    await stopProxyFromState();
                }
                finally {
                    cleanupNixRuntimeDirectory();
                }
            }
            return;
        case 'sccache':
            await runSccacheSave(options);
            return;
        case 'archive':
            return;
    }
}
async function runGhaRestore(plan, inputs) {
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const identity = resolveGitHubCacheIdentity();
    const adapter = await startGhaAdapter({
        workspace: plan.workspace,
        repositoryId: identity.repositoryId,
        scope: identity.scope,
        readScopes: identity.readScopes,
        port: requestedPort,
        readOnly: inputs.readOnly,
        verbose: inputs.verbose,
    });
    saveModeState('proxy-pid', String(adapter.pid));
    saveModeState('proxy-port', String(adapter.port));
    saveModeState('proxy-log-path', adapter.logPath);
    saveModeState('workspace', plan.workspace);
    setProxyOutputs(adapter.port);
    return {
        cacheHit: false,
        resolvedEntries: '',
        evidence: {
            adapter: 'gha',
            repository_id: identity.repositoryId,
            readable_scope_count: identity.readScopes.length + 1,
            fallback_scope_count: identity.readScopes.length,
            results_url: adapter.resultsUrl,
            read_only: adapter.readOnly,
        },
    };
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
async function resolvePreferredPort(value, inputName, defaultPort = DEFAULT_PROXY_PORT) {
    if (value.trim()) {
        return parsePortInput(value, inputName);
    }
    return defaultPort;
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
        if (file.executable) {
            fs.chmodSync(file.path, 0o700);
        }
    }
}
function prependExistingNixConfig(setup) {
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
function saveProxyModeState(proxy) {
    saveModeState('proxy-port', String(proxy.port));
    saveModeState('proxy-log-path', registryProxyLogPath(proxy.port));
    if (proxy.shutdownBudgetSecs !== undefined) {
        saveModeState('proxy-shutdown-budget-secs', String(proxy.shutdownBudgetSecs));
    }
}
function reportedProxyStopTimeoutMs() {
    const reported = Number.parseInt(getModeState('proxy-shutdown-budget-secs'), 10);
    return proxyStopTimeoutMs(Number.isFinite(reported) ? reported : null);
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
            try {
                await stopRegistryProxy(verificationProxyPid, port, PROXY_VERIFICATION_STOP_TIMEOUT_MS);
            }
            catch (stopError) {
                core.warning(`Failed to stop the managed cache verification proxy: ${errorMessage(stopError)}`);
            }
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
        await stopRegistryProxy(parseInt(proxyPid, 10), Number.isFinite(proxyPort) ? proxyPort : undefined, reportedProxyStopTimeoutMs());
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
async function resolveAdapterCliPlan(adapter, workspace, workingDirectory, inputCacheTag, preferredPort, readOnly, options = {}) {
    const args = [adapter, '--workspace', workspace];
    const trimmedCacheTag = inputCacheTag.trim();
    if (trimmedCacheTag) {
        args.push('--tag', trimmedCacheTag);
    }
    if (preferredPort > 0) {
        args.push('--port', String(preferredPort));
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
    return plan;
}
async function resolveOciCliPlan(adapter, adapterCommand, workspace, workingDirectory, inputCacheTag, preferredPort, host, endpointHost, readOnly, failOnCacheError, metadataHintsInput = '', dockerToolCacheInput = '', stage = false, cacheCandidatesInput = '', dockerToolCacheTargetInput = '', mountCache = false) {
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
    if (stage) {
        args.push('--stage');
    }
    else {
        appendCliPublicationPolicy(args, readOnly);
    }
    for (const candidate of parseList(cacheCandidatesInput)) {
        args.push('--candidate', candidate);
    }
    if (failOnCacheError) {
        args.push('--fail-on-cache-error');
    }
    if (adapter === 'docker') {
        for (const tool of parseList(dockerToolCacheInput)) {
            args.push('--tool-cache', tool);
        }
        for (const target of parseList(dockerToolCacheTargetInput)) {
            args.push('--tool-cache-target', target);
        }
    }
    if (mountCache) {
        args.push('--mount-cache');
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
async function resolveDockerCliPlan(workspace, workingDirectory, inputCacheTag, preferredPort, host, endpointHost, readOnly, failOnCacheError, metadataHintsInput = '', dockerToolCacheInput = '', stage = false, cacheCandidatesInput = '', dockerToolCacheTargetInput = '', mountCache = false) {
    return resolveOciCliPlan('docker', ['docker', 'buildx', 'build', '.'], workspace, workingDirectory, inputCacheTag, preferredPort, host, endpointHost, readOnly, failOnCacheError, metadataHintsInput, dockerToolCacheInput, stage, cacheCandidatesInput, dockerToolCacheTargetInput, mountCache);
}
async function resolveBuildkitCliPlan(workspace, workingDirectory, inputCacheTag, preferredPort, host, endpointHost, readOnly, failOnCacheError, metadataHintsInput = '', stage = false, cacheCandidatesInput = '') {
    return resolveOciCliPlan('buildkit', ['buildctl', 'build', '--frontend', 'dockerfile.v0'], workspace, workingDirectory, inputCacheTag, preferredPort, host, endpointHost, readOnly, failOnCacheError, metadataHintsInput, '', stage, cacheCandidatesInput, '');
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
function qemuInstallArchitectures(platforms) {
    const requestedPlatforms = parseList(platforms);
    if (requestedPlatforms.length === 0) {
        throw new Error('qemu=true requires at least one target in platforms.');
    }
    const nativeArchitecture = {
        x64: 'amd64',
        ia32: '386',
        mips64el: 'mips64le',
    }[process.arch] || process.arch;
    const installArchitectures = [];
    for (const platform of requestedPlatforms) {
        const [operatingSystem, architecture] = platform.split('/');
        if (operatingSystem !== 'linux' || !architecture) {
            throw new Error(`qemu=true supports explicit Linux OCI platforms such as linux/arm64; received "${platform}".`);
        }
        if (architecture !== nativeArchitecture && !installArchitectures.includes(architecture)) {
            installArchitectures.push(architecture);
        }
    }
    return installArchitectures;
}
async function setupQemu(architectures) {
    if (architectures.length === 0) {
        core.info('QEMU setup skipped because every requested platform is native to this runner.');
        return;
    }
    const result = await exec.exec('docker', ['run', '--privileged', '--rm', DEFAULT_BINFMT_IMAGE, '--install', architectures.join(',')], { ignoreReturnCode: true });
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
    for (const label of opts.labels) {
        args.push('--label', label);
    }
    for (const output of opts.outputs) {
        args.push('--output', output);
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
    args.push(`--provenance=${opts.provenance}`);
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
function ociAdapterCliArgsForAcceleratedBuild(adapter, workspace, cacheTag, port, proxyBindHost, refHost, inputs, command, commandArgs, mountCache) {
    const args = [
        adapter,
        '--workspace',
        workspace,
        '--tag',
        cacheTag,
        '--port',
        String(port),
    ];
    if (proxyBindHost.trim()) {
        args.push('--host', proxyBindHost.trim());
    }
    if (refHost.trim()) {
        args.push('--endpoint-host', refHost.trim());
    }
    if (inputs.stage) {
        args.push('--stage');
    }
    else {
        appendCliPublicationPolicy(args, inputs.readOnly);
    }
    for (const candidate of parseList(inputs.cacheCandidates)) {
        args.push('--candidate', candidate);
    }
    if (inputs.failOnCacheError) {
        args.push('--fail-on-cache-error');
    }
    if (adapter === 'docker') {
        for (const tool of parseList(inputs.dockerToolCache)) {
            args.push('--tool-cache', tool);
        }
        for (const target of parseList(inputs.dockerToolCacheTarget)) {
            args.push('--tool-cache-target', target);
        }
    }
    if (mountCache) {
        args.push('--mount-cache');
    }
    appendMetadataHintArgs(args, inputs.metadataHints);
    args.push('--', command, ...commandArgs);
    return args;
}
async function buildDockerImageWithCliAdapter(workspace, cacheTag, port, proxyBindHost, refHost, inputs, opts, mountCache) {
    const dockerBuildArgs = dockerBuildxArgs({
        ...opts,
        cacheFrom: undefined,
        cacheTo: undefined,
    });
    const args = ociAdapterCliArgsForAcceleratedBuild('docker', workspace, cacheTag, port, proxyBindHost, refHost, inputs, 'docker', dockerBuildArgs, mountCache);
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
async function installVerifiedReleaseBinary(release, binaryName) {
    const safeBinaryName = verifiedReleaseComponent('binary name', binaryName);
    const archiveName = verifiedReleaseComponent('archive name', release.archiveName);
    const archiveRoot = verifiedReleaseComponent('archive root', release.archiveRoot);
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'boringcache-release-'));
    const archivePath = path.resolve(tempDir, archiveName);
    const url = `https://github.com/${release.repository}/releases/download/${release.tag}/${archiveName}`;
    let installDir = null;
    let installed = false;
    try {
        const curlCode = await exec.exec('curl', secureCurlArgs(archivePath, url), {
            ignoreReturnCode: true,
        });
        if (curlCode !== 0) {
            throw new Error(`Failed to download ${binaryName} from ${url}`);
        }
        await verifySha256(archivePath, release.sha256, archiveName);
        if (archiveName.endsWith('.zip')) {
            await exec.exec('unzip', ['-q', archivePath, '-d', tempDir]);
        }
        else {
            await exec.exec('tar', ['-xzf', archivePath, '-C', tempDir]);
        }
        installDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'boringcache-tool-'));
        const executableName = process.platform === 'win32' ? `${safeBinaryName}.exe` : safeBinaryName;
        const { sourcePath, destinationPath } = verifiedReleasePaths(tempDir, installDir, archiveRoot, executableName);
        const physicalSourcePath = await fs.promises.realpath(sourcePath);
        if (!isPathInside(tempDir, physicalSourcePath)) {
            throw new Error(`Verified release source resolves outside its extraction directory: ${sourcePath}`);
        }
        const sourceStat = await fs.promises.stat(physicalSourcePath);
        if (!sourceStat.isFile()) {
            throw new Error(`Verified release executable is not a regular file: ${sourcePath}`);
        }
        // The source archive is SHA-256 verified and both physical source and
        // unique destination are bounded to Action-owned temporary directories.
        // codeql[js/path-injection]
        await fs.promises.copyFile(physicalSourcePath, destinationPath, fs.constants.COPYFILE_EXCL);
        if (process.platform !== 'win32') {
            // codeql[js/path-injection]
            await fs.promises.chmod(destinationPath, 0o755);
        }
        core.addPath(installDir);
        installed = true;
    }
    finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        if (installDir && !installed) {
            await fs.promises.rm(installDir, { recursive: true, force: true });
        }
    }
}
export async function installCcache(versionInput = CCACHE_DEFAULT_VERSION) {
    addLocalBinPaths();
    const version = versionInput.trim().replace(/^v/, '');
    if (!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(version)) {
        throw new Error(`Invalid ccache version: ${versionInput}`);
    }
    if (await hasToolVersionOnPath('ccache', version)) {
        core.info(`Using existing ccache ${version} from PATH`);
    }
    else {
        if (version !== CCACHE_DEFAULT_VERSION) {
            throw new Error(`Automatic ccache installation supports the audited ${CCACHE_DEFAULT_VERSION} release. `
                + `Install ccache ${version} on PATH before running boringcache/one.`);
        }
        const release = CCACHE_DEFAULT_RELEASES[`${process.platform}-${process.arch}`];
        if (!release) {
            throw new Error(`Unsupported ccache runner: ${process.platform}-${process.arch}`);
        }
        core.info(`Installing ccache ${version}...`);
        await installVerifiedReleaseBinary(release, 'ccache');
    }
    if (await hasToolVersionOnPath('ccache-storage-http', CCACHE_STORAGE_HTTP_DEFAULT_VERSION)) {
        core.info(`Using existing ccache-storage-http ${CCACHE_STORAGE_HTTP_DEFAULT_VERSION} from PATH`);
        return;
    }
    const helperRelease = CCACHE_STORAGE_HTTP_DEFAULT_RELEASES[`${process.platform}-${process.arch}`];
    if (!helperRelease) {
        throw new Error(`Unsupported ccache-storage-http runner: ${process.platform}-${process.arch}`);
    }
    core.info(`Installing ccache-storage-http ${CCACHE_STORAGE_HTTP_DEFAULT_VERSION}...`);
    await installVerifiedReleaseBinary(helperRelease, 'ccache-storage-http');
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
async function startPortableCacheProxyWithFallback(workspace, preferredPort, tag, readOnly, proxyPlan) {
    try {
        return await startPortableCacheProxy(workspace, preferredPort, tag, readOnly, proxyPlan);
    }
    catch {
        return startPortableCacheProxy(workspace, await findAvailablePort(), tag, readOnly, proxyPlan);
    }
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
const CCACHE_NON_CACHEABLE_COUNTERS = [
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
function summarizeCcacheStats(output) {
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
async function stopCcacheStorageHelpers(statsLog, statsDirectory) {
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
function emptyDirectCacheTagCheckStatus() {
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
async function checkDirectCacheTagStatus(workspace, tag, { noPlatform = false, noGit = false, requireServerSignature = false, } = {}) {
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
async function checkDirectCacheProxyTagStatus(workspace, tag, options = {}) {
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
function directCachePreflightEvidence(preflight) {
    return {
        cache_preflight: {
            cache_entry_hit: preflight.cacheEntryHit,
            kv_hit: preflight.kvHit,
            kv_checked: preflight.kvChecked,
        },
    };
}
function rewritePlannedProxyPort(value, plannedPort, actualPort) {
    if (plannedPort === actualPort) {
        return value;
    }
    return value.replace(new RegExp(`:${plannedPort}(?=/|$)`), `:${actualPort}`);
}
function turboEnvForStartedProxy(plan, actualPort) {
    const envVars = {};
    for (const [key, value] of Object.entries(plan.env_vars || {})) {
        envVars[key] = rewritePlannedProxyPort(value, plan.proxy.port, actualPort);
    }
    const endpointHost = plan.proxy.endpoint_host || '127.0.0.1';
    envVars.TURBO_API = `http://${endpointHost}:${actualPort}`;
    envVars.TURBO_TOKEN = envVars.TURBO_TOKEN || 'boringcache';
    envVars.TURBO_TEAM = envVars.TURBO_TEAM || 'boringcache';
    envVars.BORINGCACHE_PROXY_PORT = String(actualPort);
    return envVars;
}
function nxEnvForStartedProxy(plan, actualPort) {
    const envVars = {};
    for (const [key, value] of Object.entries(plan.env_vars || {})) {
        envVars[key] = rewritePlannedProxyPort(value, plan.proxy.port, actualPort);
    }
    const endpointHost = plan.proxy.endpoint_host || '127.0.0.1';
    envVars.NX_SELF_HOSTED_REMOTE_CACHE_SERVER = `http://${endpointHost}:${actualPort}`;
    envVars.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN = envVars.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN || 'boringcache';
    envVars.BORINGCACHE_PROXY_PORT = String(actualPort);
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
function compilerCacheEnvForStartedProxy(plan, actualPort) {
    const envVars = {};
    for (const [key, value] of Object.entries(plan.env_vars || {})) {
        envVars[key] = rewritePlannedProxyPort(value, plan.proxy.port, actualPort);
    }
    envVars.BORINGCACHE_PROXY_PORT = String(actualPort);
    return envVars;
}
function sccacheEnvForStartedProxy(plan, actualPort) {
    const envVars = compilerCacheEnvForStartedProxy(plan, actualPort);
    envVars.SCCACHE_IDLE_TIMEOUT = process.env.SCCACHE_IDLE_TIMEOUT
        || envVars.SCCACHE_IDLE_TIMEOUT
        || '0';
    return envVars;
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
    const buildArgs = parseMultiline(core.getInput('build-args') || '');
    const labels = parseMultiline(core.getInput('labels') || '');
    const outputs = parseMultiline(core.getInput('outputs') || '');
    const tags = parseList(core.getInput('tags') || (outputs.length === 0 ? 'latest' : ''));
    const secrets = parseMultiline(core.getInput('secrets') || '');
    const dockerToolCache = inputs.dockerToolCache;
    const dockerToolCaches = parseList(dockerToolCache);
    const target = core.getInput('target') || '';
    const platforms = parseList(core.getInput('platforms') || '').join(',');
    const qemu = parseBooleanInput(core.getInput('qemu'), 'qemu', false);
    const qemuArchitectures = qemu ? qemuInstallArchitectures(platforms) : [];
    const push = parseBooleanInput(core.getInput('push'), 'push', false);
    const load = parseBooleanInput(core.getInput('load'), 'load', true)
        && parseList(platforms).length <= 1
        && outputs.length === 0;
    const noCache = parseBooleanInput(core.getInput('no-cache'), 'no-cache', false);
    const provenance = parseBooleanInput(core.getInput('provenance'), 'provenance', false);
    const sbom = parseBooleanInput(core.getInput('sbom'), 'sbom', false);
    const dockerMountCache = parseBooleanInput(core.getInput('docker-mount-cache'), 'docker-mount-cache', false);
    const driver = core.getInput('driver') || 'docker-container';
    const driverOpts = parseMultiline(core.getInput('driver-opts') || '');
    const buildkitdConfigInline = core.getInput('buildkitd-config-inline') || '';
    const cliOwnsManagedBuild = shouldBuild;
    if (cliOwnsManagedBuild) {
        assertPrivilegedRunnerPolicy('Managed BoringCache BuildKit');
    }
    if (qemuArchitectures.length > 0) {
        assertPrivilegedRunnerPolicy('QEMU/binfmt registration');
    }
    if (dockerToolCaches.length > 0 && !shouldBuild) {
        throw new Error('docker-tool-cache requires docker-command=build so boringcache docker can inject the BuildKit secret.');
    }
    if (dockerMountCache && !shouldBuild) {
        throw new Error('docker-mount-cache requires mode=docker with docker-command=build so boringcache docker can install and authenticate the cache-mount worker.');
    }
    const requestedCacheTag = '';
    let modeEvidence;
    let resolvedWorkspace = plan.workspace;
    let resolvedCacheTag = '';
    saveModeState('workspace', plan.workspace);
    saveModeState('verbose', String(inputs.verbose));
    if (qemu) {
        await setupQemu(qemuArchitectures);
    }
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
        // Every surface starts from the same port. An explicit proxy-port remains
        // available when a workflow coordinates another process or has a conflict.
        const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port', DEFAULT_PROXY_PORT);
        const dockerPlan = await resolveDockerCliPlan(plan.workspace, plan.workingDirectory, requestedCacheTag, requestedPort, proxyBindHost, refHost, proxyPlanningReadOnly(inputs.readOnly), inputs.failOnCacheError, inputs.metadataHints, dockerToolCache, inputs.stage, inputs.cacheCandidates, inputs.dockerToolCacheTarget, dockerMountCache);
        const requestedImportRefTags = buildKitCacheFromRefTags(dockerPlan.buildkit_cache);
        const cacheTag = dockerPlan.tag;
        const usesCliWrappedBuild = cliOwnsManagedBuild || dockerToolCaches.length > 0;
        if (usesCliWrappedBuild) {
            const planState = recordBuildKitCachePlanState(dockerPlan, cacheTag);
            resolvedWorkspace = planState.resolvedWorkspace;
            resolvedCacheTag = planState.resolvedCacheTag;
            const effectiveImports = effectiveBuildKitCacheImports(dockerPlan.buildkit_cache, undefined);
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
                await runDockerBuildOperation(() => buildDockerImageWithCliAdapter(dockerPlan.workspace, dockerPlan.tag, requestedPort, proxyBindHost, refHost, inputs, {
                    dockerfile,
                    context,
                    image,
                    tags,
                    buildArgs,
                    labels,
                    outputs,
                    secrets,
                    target,
                    platforms,
                    push,
                    load,
                    noCache,
                    provenance,
                    sbom,
                    builder: cliOwnsManagedBuild ? '' : builderName,
                }, dockerMountCache));
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
                stage: inputs.stage,
                candidateDigests: dockerPlan.buildkit_cache?.cache_from_candidate_digests || [],
                ociRequiredReadableRefs: requestedImportRefTags,
                ociAliasPromotionRefs: dockerPlan.buildkit_cache?.promotion_ref_tags || [],
            }, dockerPlan.proxy));
            saveModeState('proxy-pid', String(proxy.pid));
            saveProxyModeState(proxy);
            saveModeState('proxy-host', dockerPlan.proxy.host || proxyBindHost);
            saveModeState('proxy-no-git', String(dockerPlan.proxy.no_git));
            saveModeState('proxy-no-platform', String(dockerPlan.proxy.no_platform));
            saveModeState('oci-promotion-ref-tags', (dockerPlan.buildkit_cache?.promotion_ref_tags || []).join(','));
            setProxyOutputs(proxy.port);
            const planState = recordBuildKitCachePlanState(dockerPlan, cacheTag);
            resolvedWorkspace = planState.resolvedWorkspace;
            resolvedCacheTag = planState.resolvedCacheTag;
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
                    labels,
                    outputs,
                    secrets,
                    target,
                    platforms,
                    push,
                    load,
                    noCache,
                    provenance,
                    sbom,
                    builder: builderName,
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
    return {
        cacheTag: resolvedCacheTag,
        evidence: modeEvidence,
        // The CLI proxy owns OCI import and publication readiness. Generic
        // verification is for archive and direct-tool tags, not registry refs.
        verificationSpecs: [],
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
    const platforms = parseList(core.getInput('platforms') || '').join(',');
    const noCache = parseBooleanInput(core.getInput('no-cache'), 'no-cache', false);
    const dockerMountCache = parseBooleanInput(core.getInput('docker-mount-cache'), 'docker-mount-cache', false);
    if (dockerMountCache) {
        throw new Error('docker-mount-cache requires mode=docker with docker-command=build; '
            + 'BuildKit mode connects to a workflow-owned daemon and cannot install the cache-mount worker.');
    }
    const buildkitHost = core.getInput('buildkit-host', { required: true });
    const tlsCaInput = core.getInput('buildkit-tls-ca') || '';
    const tlsCertInput = core.getInput('buildkit-tls-cert') || '';
    const tlsKeyInput = core.getInput('buildkit-tls-key') || '';
    const tlsSkipVerify = parseBooleanInput(core.getInput('buildkit-tls-skip-verify'), 'buildkit-tls-skip-verify', false);
    const requestedCacheTag = '';
    let modeEvidence;
    let resolvedWorkspace = plan.workspace;
    let resolvedCacheTag = '';
    saveModeState('workspace', plan.workspace);
    saveModeState('verbose', String(inputs.verbose));
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
        const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
        const dockerPlan = await resolveBuildkitCliPlan(plan.workspace, plan.workingDirectory, requestedCacheTag, requestedPort, proxyBindHost, refHost, proxyPlanningReadOnly(inputs.readOnly), inputs.failOnCacheError, inputs.metadataHints, inputs.stage, inputs.cacheCandidates);
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
            stage: inputs.stage,
            candidateDigests: dockerPlan.buildkit_cache?.cache_from_candidate_digests || [],
            ociRequiredReadableRefs: requestedImportRefTags,
            ociAliasPromotionRefs: dockerPlan.buildkit_cache?.promotion_ref_tags || [],
        }, dockerPlan.proxy));
        saveModeState('proxy-pid', String(proxy.pid));
        saveProxyModeState(proxy);
        saveModeState('proxy-host', dockerPlan.proxy.host || proxyBindHost);
        saveModeState('proxy-no-git', String(dockerPlan.proxy.no_git));
        saveModeState('proxy-no-platform', String(dockerPlan.proxy.no_platform));
        saveModeState('oci-promotion-ref-tags', (dockerPlan.buildkit_cache?.promotion_ref_tags || []).join(','));
        setProxyOutputs(proxy.port);
        const planState = recordBuildKitCachePlanState(dockerPlan, cacheTag);
        resolvedWorkspace = planState.resolvedWorkspace;
        resolvedCacheTag = planState.resolvedCacheTag;
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
    return {
        cacheTag: resolvedCacheTag,
        evidence: modeEvidence,
        // BuildKit uses the same CLI-owned OCI readiness boundary as Docker.
        verificationSpecs: [],
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
    });
}
function readBoundedJsonObject(filePath) {
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
function cargoArchiveVerificationSpecs(cargoPlan, workingDirectory) {
    const specs = (cargoPlan.archive_entries || []).map((entry) => ({
        tag: entry.tag,
        noPlatform: cargoPlan.proxy.no_platform,
        noGit: cargoPlan.proxy.no_git,
        pathHint: entry.path
            ? (path.isAbsolute(entry.path) ? entry.path : path.resolve(workingDirectory, entry.path))
            : undefined,
        saveExpected: !cargoPlan.proxy.read_only,
    }));
    if (cargoCompilerCacheEnabled(cargoPlan)) {
        specs.push(adapterProxyVerificationSpec(cargoCompilerCacheTag(cargoPlan), cargoPlan.proxy, workingDirectory));
    }
    const unique = new Map();
    for (const spec of specs) {
        const key = `${spec.tag}\0${String(spec.noPlatform)}\0${String(spec.noGit)}`;
        if (!unique.has(key)) {
            unique.set(key, spec);
        }
    }
    return [...unique.values()];
}
function cargoCompilerCacheEnabled(cargoPlan) {
    // Compatible older CLIs predate the explicit layer field and always compose
    // sccache, so a missing value preserves their released behavior.
    return cargoPlan.cargo_cache?.compiler_cache !== 'none';
}
function cargoCompilerCacheTag(cargoPlan) {
    // Older CLIs exposed only the adapter-level tag. Prefer the explicit layer
    // identity while preserving their released dry-run contract.
    return cargoPlan.cargo_cache?.compiler_cache_tag || cargoPlan.tag;
}
async function runCargoRestore(plan, inputs) {
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const cargoPlan = await resolveAdapterCliPlan('cargo', plan.workspace, plan.workingDirectory, '', requestedPort, proxyPlanningReadOnly(inputs.readOnly), { metadataHintsInput: inputs.metadataHints });
    const command = cargoPlan.command || [];
    const targetEntry = (cargoPlan.archive_entries || []).find((entry) => entry.kind === 'cargo-target' || entry.requested === 'cargo-target');
    const compilerCacheEnabled = cargoCompilerCacheEnabled(cargoPlan);
    const compilerCacheTag = cargoCompilerCacheTag(cargoPlan);
    const [targetPreflight, compilerPreflight] = await Promise.all([
        targetEntry
            ? checkDirectCacheTagStatus(cargoPlan.workspace, targetEntry.tag, {
                noPlatform: cargoPlan.proxy.no_platform,
                noGit: cargoPlan.proxy.no_git,
                requireServerSignature: true,
            })
            : emptyDirectCacheTagCheckStatus(),
        compilerCacheEnabled
            ? checkDirectCacheTagStatus(cargoPlan.workspace, compilerCacheTag, {
                noPlatform: cargoPlan.proxy.no_platform,
                noGit: cargoPlan.proxy.no_git,
                requireServerSignature: true,
            })
            : emptyDirectCacheTagCheckStatus(),
    ]);
    const cacheHit = targetEntry ? targetPreflight.cacheEntryHit : compilerPreflight.kvHit;
    const cacheTag = targetEntry?.tag || (compilerCacheEnabled ? compilerCacheTag : '');
    core.setOutput('sccache-tag', compilerCacheEnabled ? compilerCacheTag : '');
    core.setOutput('sccache-hit', String(compilerCacheEnabled && compilerPreflight.kvHit));
    if (inputs.failOnCacheMiss && !inputs.lookupOnly) {
        throw new Error('mode=cargo does not support fail-on-cache-miss while executing yet; '
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
            cacheHit,
            cacheTag,
            resolvedEntries,
            verificationSpecs,
            evidence: {
                command,
                command_executed: false,
                lookup_only: true,
                target_cache_hit: targetPreflight.cacheEntryHit,
                compiler_cache_hit: compilerPreflight.kvHit,
                cargo_cache: cargoPlan.cargo_cache,
                archive_entries: cargoPlan.archive_entries || [],
            },
        };
    }
    if (compilerCacheEnabled) {
        const sccacheVersion = core.getInput('sccache-version') || SCCACHE_DEFAULT_VERSION.slice(1);
        await installSccache(sccacheVersion);
    }
    const nativeEvidencePath = compilerCacheEnabled
        ? path.join(os.tmpdir(), `boringcache-one-cargo-native-${process.pid}-${Date.now()}.json`)
        : '';
    const args = ['cargo', '--workspace', cargoPlan.workspace, '--port', String(cargoPlan.proxy.port)];
    appendCliPublicationPolicy(args, cargoPlan.proxy.read_only);
    appendMetadataHintArgs(args, inputs.metadataHints);
    if (inputs.failOnCacheError) {
        args.push('--fail-on-cache-error');
    }
    if (nativeEvidencePath) {
        args.push('--native-tool-evidence-json', nativeEvidencePath);
    }
    const startedAt = Date.now();
    let nativeToolEvidence = null;
    try {
        const exitCode = await execBoringCache(args, {
            cwd: plan.workingDirectory,
            ignoreReturnCode: true,
        });
        if (exitCode !== 0) {
            throw new Error(`boringcache cargo exited with code ${exitCode}`);
        }
        nativeToolEvidence = nativeEvidencePath ? readBoundedJsonObject(nativeEvidencePath) : null;
    }
    finally {
        if (nativeEvidencePath) {
            fs.rmSync(nativeEvidencePath, { force: true });
        }
    }
    const commandEvidence = {
        command,
        elapsed_seconds: Math.round((Date.now() - startedAt) / 100) / 10,
        native_tool: nativeToolEvidence,
    };
    core.setOutput('cache-tag', cacheTag);
    core.setOutput('workspace', cargoPlan.workspace);
    return {
        cacheHit,
        cacheTag,
        resolvedEntries,
        verificationSpecs,
        evidence: {
            ...commandEvidence,
            command_executed: true,
            target_cache_hit: targetPreflight.cacheEntryHit,
            compiler_cache_hit: compilerPreflight.kvHit,
            cargo_cache: cargoPlan.cargo_cache,
            archive_entries: cargoPlan.archive_entries || [],
        },
    };
}
async function runBazelRestore(plan, inputs, options) {
    const inputVersion = core.getInput('bazel-version') || '';
    const bazelrcLines = core.getInput('bazelrc-lines') || '';
    const runtimeVersion = plan.runtimeTools.find((tool) => tool.name === 'bazel')?.version || '';
    const bazelVersion = inputVersion || runtimeVersion;
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const proxyPlan = await resolveAdapterCliPlan('bazel', plan.workspace, plan.workingDirectory, '', requestedPort, proxyPlanningReadOnly(inputs.readOnly), {
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
    saveProxyModeState(proxy);
    await waitForArchiveMaterialization(options);
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
    const proxyPlan = await resolveAdapterCliPlan('go', plan.workspace, plan.workingDirectory, '', requestedPort, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
    });
    const workspace = proxyPlan.workspace;
    const cacheTag = proxyPlan.tag;
    const preflight = await checkDirectCacheProxyTagStatus(workspace, cacheTag, {
        noPlatform: proxyPlan.proxy.no_platform,
        noGit: proxyPlan.proxy.no_git,
    });
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
    saveProxyModeState(proxy);
    configureGoProxyEnv(goCacheProgForProxy(proxyPlan, proxy.port));
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('workspace', workspace);
    return {
        cacheHit: preflight.kvHit,
        cacheTag,
        evidence: directCachePreflightEvidence(preflight),
        verificationSpecs: [adapterProxyVerificationSpec(cacheTag, proxyPlan.proxy, plan.workingDirectory)],
    };
}
async function runGradleRestore(plan, inputs, options) {
    const gradleHome = core.getInput('gradle-home') || '';
    const enableBuildCache = parseBooleanInput(core.getInput('enable-build-cache'), 'enable-build-cache', true);
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const proxyPlan = await resolveAdapterCliPlan('gradle', plan.workspace, plan.workingDirectory, '', requestedPort, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
        gradleHome,
        enableGradleBuildCache: enableBuildCache,
    });
    const workspace = proxyPlan.workspace;
    const cacheTag = proxyPlan.tag;
    const setup = requireAdapterSetupPlan('gradle', proxyPlan.setup);
    const preflight = await checkDirectCacheProxyTagStatus(workspace, cacheTag, {
        noPlatform: proxyPlan.proxy.no_platform,
        noGit: proxyPlan.proxy.no_git,
    });
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
    saveProxyModeState(proxy);
    await waitForArchiveMaterialization(options);
    applyAdapterSetupPlan(setup);
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('workspace', workspace);
    return {
        cacheHit: preflight.kvHit,
        cacheTag,
        evidence: directCachePreflightEvidence(preflight),
        verificationSpecs: [adapterProxyVerificationSpec(cacheTag, proxyPlan.proxy, plan.workingDirectory)],
    };
}
async function runMavenRestore(plan, inputs, options) {
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const mavenExtensionsPath = core.getInput('maven-extensions-path') || '';
    const mavenBuildCacheConfigPath = core.getInput('maven-build-cache-config-path') || '';
    const mavenLocalRepo = core.getInput('maven-local-repo') || '';
    const mavenBuildCacheExtensionVersion = core.getInput('maven-build-cache-extension-version') || '';
    const mavenBuildCacheId = core.getInput('maven-build-cache-id') || '';
    const proxyPlan = await resolveAdapterCliPlan('maven', plan.workspace, plan.workingDirectory, '', requestedPort, proxyPlanningReadOnly(inputs.readOnly), {
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
    const preflight = await checkDirectCacheProxyTagStatus(workspace, cacheTag, {
        noPlatform: proxyPlan.proxy.no_platform,
        noGit: proxyPlan.proxy.no_git,
    });
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
    saveProxyModeState(proxy);
    await waitForArchiveMaterialization(options);
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
        cacheHit: preflight.kvHit,
        cacheTag,
        evidence: directCachePreflightEvidence(preflight),
        verificationSpecs: [adapterProxyVerificationSpec(cacheTag, proxyPlan.proxy, plan.workingDirectory)],
    };
}
async function captureCommand(command, args) {
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
async function assertNixTrustedUser() {
    if (process.platform === 'win32') {
        throw new Error('mode=nix requires a Linux or macOS runner with Nix installed.');
    }
    const version = await captureCommand('nix', ['--version']);
    if (version.exitCode !== 0) {
        throw new Error(version.stderr || '`nix` was not found on PATH. Install Nix before boringcache/one.');
    }
    try {
        fs.accessSync('/nix/store', fs.constants.W_OK);
        return;
    }
    catch {
        // Multi-user Nix stores are normally daemon-owned. Check daemon trust.
    }
    const userResult = await captureCommand('id', ['-un']);
    const groupsResult = await captureCommand('id', ['-Gn']);
    const trustedResult = await captureCommand('nix', [
        '--extra-experimental-features',
        'nix-command',
        'config',
        'show',
        'trusted-users',
    ]);
    if (userResult.exitCode !== 0 || groupsResult.exitCode !== 0 || trustedResult.exitCode !== 0) {
        throw new Error(trustedResult.stderr
            || groupsResult.stderr
            || userResult.stderr
            || 'Unable to determine whether the runner is a trusted Nix user.');
    }
    const user = userResult.stdout;
    const groups = new Set(groupsResult.stdout.split(/\s+/).filter(Boolean));
    const trustedSetting = trustedResult.stdout.includes('=')
        ? trustedResult.stdout.slice(trustedResult.stdout.indexOf('=') + 1)
        : trustedResult.stdout;
    const trusted = trustedSetting.split(/\s+/).filter(Boolean).some((entry) => (entry === '*'
        || entry === user
        || (entry.startsWith('@') && groups.has(entry.slice(1)))));
    if (!trusted) {
        throw new Error(`mode=nix requires ${user || 'the runner user'} to be listed in Nix trusted-users so the per-job substituter and post-build hook reach the Nix daemon.`);
    }
}
async function runNixRestore(plan, inputs, options) {
    await assertNixTrustedUser();
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const proxyPlan = await resolveAdapterCliPlan('nix', plan.workspace, plan.workingDirectory, '', requestedPort, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
        failOnCacheError: inputs.failOnCacheError,
    });
    const setup = requireAdapterSetupPlan('nix', proxyPlan.setup);
    prependExistingNixConfig(setup);
    const socketPath = proxyPlan.proxy.nix_hook_socket?.trim() || '';
    if (!proxyPlan.proxy.read_only && !socketPath) {
        throw new Error('boringcache nix setup plan did not include its upload socket');
    }
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
        nixHookSocket: socketPath || undefined,
    }, proxyPlan.proxy, inputs.failOnCacheError));
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy);
    saveModeState('nix-hook-socket', socketPath);
    saveModeState('nix-runtime-directory', setup.directories?.[0] || '');
    saveModeState('nix-fail-on-cache-error', String(inputs.failOnCacheError));
    await waitForArchiveMaterialization(options);
    applyAdapterSetupPlan(setup);
    core.setOutput('cache-tag', proxyPlan.tag);
    core.setOutput('workspace', proxyPlan.workspace);
    setProxyOutputs(proxy.port);
    return {
        cacheTag: proxyPlan.tag,
        verificationSpecs: [adapterProxyVerificationSpec(proxyPlan.tag, proxyPlan.proxy, plan.workingDirectory)],
    };
}
async function runXcodeRestore(plan, inputs, options) {
    if (process.platform !== 'darwin') {
        throw new Error('mode=xcode requires a macOS runner with Xcode installed.');
    }
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const proxyPlan = await resolveAdapterCliPlan('xcode', plan.workspace, plan.workingDirectory, '', requestedPort, proxyPlanningReadOnly(inputs.readOnly), { metadataHintsInput: inputs.metadataHints });
    const setup = requireAdapterSetupPlan('xcode', proxyPlan.setup);
    const env = setup.env_vars || {};
    const socketPath = env.BORINGCACHE_XCODE_PROXY_SOCKET?.trim() || '';
    const upstreamPlugin = env.BORINGCACHE_XCODE_UPSTREAM_PLUGIN?.trim() || '';
    const casPath = env.BORINGCACHE_XCODE_CAS_PATH?.trim() || '';
    const evidencePath = env.BORINGCACHE_XCODE_EVIDENCE_JSON?.trim() || '';
    if (!socketPath || !upstreamPlugin || !casPath) {
        throw new Error('boringcache xcode setup plan did not include its Apple CAS bridge paths');
    }
    await waitForArchiveMaterialization(options);
    applyAdapterSetupPlan(setup);
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
        xcodeSocket: socketPath,
        xcodeUpstreamPlugin: upstreamPlugin,
        xcodeCasPath: casPath,
        xcodeEvidenceJson: evidencePath,
    }, proxyPlan.proxy, inputs.failOnCacheError));
    saveModeState('proxy-pid', String(proxy.pid));
    saveModeState('xcode-evidence-json', evidencePath);
    saveProxyModeState(proxy);
    core.setOutput('cache-tag', proxyPlan.tag);
    core.setOutput('workspace', proxyPlan.workspace);
    setProxyOutputs(proxy.port);
    return {
        cacheTag: proxyPlan.tag,
        evidence: {
            xcode: {
                version: env.BORINGCACHE_XCODE_VERSION || '',
                build: env.BORINGCACHE_XCODE_BUILD || '',
                plugin_sha256: env.BORINGCACHE_XCODE_PLUGIN_SHA256 || '',
                path_cohort: env.BORINGCACHE_XCODE_PATH_COHORT || '',
                derived_data_path: env.BORINGCACHE_XCODE_DERIVED_DATA_PATH || '',
                evidence_path: evidencePath,
            },
        },
        verificationSpecs: [adapterProxyVerificationSpec(proxyPlan.tag, proxyPlan.proxy, plan.workingDirectory)],
    };
}
async function runTurboProxyRestore(plan, inputs) {
    const preferredPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const turboPlan = await resolveAdapterCliPlan('turbo', plan.workspace, plan.workingDirectory, '', preferredPort, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
    });
    const workspace = turboPlan.workspace;
    const cacheTag = turboPlan.tag;
    const packageManager = await detectNodePackageManager(plan.workingDirectory);
    const preflight = await checkDirectCacheProxyTagStatus(workspace, cacheTag, {
        noPlatform: turboPlan.proxy.no_platform,
        noGit: turboPlan.proxy.no_git,
    });
    const proxyPromise = startPortableCacheProxyWithFallback(workspace, turboPlan.proxy.port || preferredPort, cacheTag, turboPlan.proxy.read_only, turboPlan.proxy);
    const [proxyResult, corepackResult] = await Promise.allSettled([
        proxyPromise,
        ensureCorepackPackageManager(plan.workingDirectory, packageManager, plan.runtimeTools),
    ]);
    if (corepackResult.status === 'rejected') {
        if (proxyResult.status === 'fulfilled') {
            await stopRegistryProxy(proxyResult.value.pid, proxyResult.value.port, proxyStopTimeoutMs(proxyResult.value.shutdownBudgetSecs ?? null));
        }
        throw corepackResult.reason;
    }
    if (proxyResult.status === 'rejected') {
        throw proxyResult.reason;
    }
    const proxy = proxyResult.value;
    if (packageManager) {
        core.setOutput('package-manager', packageManager.name);
        core.setOutput('package-manager-cache-dir', plannedNodePackageManagerCacheDir(packageManager, turboPlan) || packageManager.cacheDir);
    }
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy);
    exportEnvVars(turboEnvForStartedProxy(turboPlan, proxy.port));
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('workspace', workspace);
    return {
        cacheHit: preflight.kvHit,
        cacheTag,
        evidence: directCachePreflightEvidence(preflight),
        verificationSpecs: [adapterProxyVerificationSpec(cacheTag, turboPlan.proxy, plan.workingDirectory)],
    };
}
async function runNxProxyRestore(plan, inputs) {
    const preferredPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const nxPlan = await resolveAdapterCliPlan('nx', plan.workspace, plan.workingDirectory, '', preferredPort, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
    });
    const workspace = nxPlan.workspace;
    const cacheTag = nxPlan.tag;
    const preflight = await checkDirectCacheProxyTagStatus(workspace, cacheTag, {
        noPlatform: nxPlan.proxy.no_platform,
        noGit: nxPlan.proxy.no_git,
    });
    const proxy = await startPortableCacheProxyWithFallback(workspace, nxPlan.proxy.port || preferredPort, cacheTag, nxPlan.proxy.read_only, nxPlan.proxy);
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy);
    exportEnvVars(nxEnvForStartedProxy(nxPlan, proxy.port));
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('workspace', workspace);
    return {
        cacheHit: preflight.kvHit,
        cacheTag,
        evidence: directCachePreflightEvidence(preflight),
        verificationSpecs: [adapterProxyVerificationSpec(cacheTag, nxPlan.proxy, plan.workingDirectory)],
    };
}
async function startCompilerCacheProxy(adapter, plan, inputs) {
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const proxyPlan = await resolveAdapterCliPlan(adapter, plan.workspace, plan.workingDirectory, '', requestedPort, proxyPlanningReadOnly(inputs.readOnly), { metadataHintsInput: inputs.metadataHints });
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
    core.setOutput('workspace', proxyPlan.workspace);
    core.setOutput('cache-tag', proxyPlan.tag);
    core.setOutput('cache-hit', String(preflight.kvHit));
    setProxyOutputs(proxy.port);
    return { proxyPlan, proxy, preflight };
}
function compilerCacheModeState(tool) {
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
async function finishCompilerCacheSave(tool, state, stats, statsDetail, options) {
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
async function runCcacheRestore(plan, inputs) {
    const ccacheVersion = core.getInput('ccache-version') || CCACHE_DEFAULT_VERSION;
    await installCcache(ccacheVersion);
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
            cacheHit: preflight.kvHit,
            cacheTag: proxyPlan.tag,
            evidence: directCachePreflightEvidence(preflight),
            verificationSpecs: [adapterProxyVerificationSpec(proxyPlan.tag, proxyPlan.proxy, plan.workingDirectory)],
        };
    }
    catch (error) {
        await fs.promises.rm(statsDirectory, { recursive: true, force: true });
        throw error;
    }
}
async function runCcacheSave(options = {}) {
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
async function runSccacheRestore(plan, inputs) {
    const sccacheVersion = core.getInput('sccache-version') || SCCACHE_DEFAULT_VERSION.slice(1);
    await installSccache(sccacheVersion);
    const { proxyPlan, proxy, preflight } = await startCompilerCacheProxy('sccache', plan, inputs);
    exportEnvVars(sccacheEnvForStartedProxy(proxyPlan, proxy.port));
    await startSccacheServer();
    core.setOutput('sccache-tag', proxyPlan.tag);
    core.setOutput('sccache-hit', String(preflight.kvHit));
    return {
        cacheHit: preflight.kvHit,
        cacheTag: proxyPlan.tag,
        evidence: directCachePreflightEvidence(preflight),
        verificationSpecs: [adapterProxyVerificationSpec(proxyPlan.tag, proxyPlan.proxy, plan.workingDirectory)],
    };
}
async function runSccacheSave(options = {}) {
    const state = compilerCacheModeState('sccache');
    const sccacheStats = await stopSccacheServer();
    await stopProxyFromState();
    const rustHitRate = sccacheStats?.rustHitRate || 'unknown';
    const statsDetail = sccacheStats
        ? `compile_requests=${sccacheStats.compileRequests}, cache_hits=${sccacheStats.cacheHits}, cache_misses=${sccacheStats.cacheMisses}, rust_hit_rate=${rustHitRate}`
        : '';
    await finishCompilerCacheSave('sccache', state, sccacheStats, statsDetail, options);
}
async function stopProxyFromState() {
    const proxyPid = getModeState('proxy-pid');
    if (proxyPid) {
        const proxyPort = Number.parseInt(getModeState('proxy-port'), 10);
        await stopRegistryProxy(parseInt(proxyPid, 10), Number.isFinite(proxyPort) ? proxyPort : undefined, reportedProxyStopTimeoutMs());
    }
}
async function drainNixUploads() {
    const socketPath = getModeState('nix-hook-socket');
    if (!socketPath) {
        return;
    }
    const exitCode = await execBoringCache(['nix-hook', '--socket', socketPath, '--drain'], {
        ignoreReturnCode: true,
    });
    if (exitCode === 0) {
        return;
    }
    const message = `Nix cache upload drain failed with exit code ${exitCode}`;
    if (getModeStateBoolean('nix-fail-on-cache-error')) {
        throw new Error(message);
    }
    core.warning(message);
}
function cleanupNixRuntimeDirectory() {
    const runtimeDirectory = getModeState('nix-runtime-directory');
    if (!runtimeDirectory) {
        return;
    }
    const normalized = path.normalize(runtimeDirectory);
    if (path.dirname(normalized) !== '/tmp' || !/^boringcache-nix-[A-Za-z0-9]{1,64}$/.test(path.basename(normalized))) {
        core.warning(`Refusing to remove unexpected Nix runtime directory ${runtimeDirectory}`);
        return;
    }
    fs.rmSync(normalized, { recursive: true, force: true });
}
