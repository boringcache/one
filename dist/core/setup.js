import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import * as cache from '@actions/cache';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { saveImmutableToolCache } from './action-cache';
const TOOL_NAME = 'boringcache';
const CANONICAL_RELEASES_BASE = 'https://artifacts.boringcache.com/releases/cli';
const GITHUB_RELEASES_BASE = 'https://github.com/boringcache/cli/releases/download';
/**
 * A runner image that preinstalls the CLI writes one SHA256SUMS line for the
 * release asset it installed beside the binary. A tool-cache hit verifies
 * against that instead of fetching SHA256SUMS, so the whole install is local.
 */
const CHECKSUM_SIDECAR = 'boringcache.sha256';
/** cli-version value selecting whichever CLI the runner image provides. */
const RUNNER_PROVIDED_VERSION = 'runner';
const XCODE_PLUGIN_ASSET = 'libboringcache_xcode_cas-macos-universal.dylib';
const XCODE_PLUGIN_NAME = 'libboringcache_xcode_cas.dylib';
export function findToolCachePath(toolName, version, arch) {
    const found = tc.find(toolName, version, arch);
    if (found) {
        return found;
    }
    // @actions/tool-cache only discovers semver-shaped directories. Canary and
    // commit-qualified release tags are intentionally immutable but not semver,
    // so validate the tag as one safe path component and check the directory
    // layout written by tool-cache.cacheDir directly.
    if (!/^[A-Za-z0-9._-]+$/.test(version)) {
        return '';
    }
    const toolCacheRoot = process.env.RUNNER_TOOL_CACHE || '/opt/hostedtoolcache';
    const toolRoot = path.resolve(toolCacheRoot, toolName);
    const candidate = path.resolve(toolRoot, version, arch);
    if (!candidate.startsWith(`${toolRoot}${path.sep}`)) {
        return '';
    }
    return fs.existsSync(candidate) && fs.existsSync(`${candidate}.complete`) ? candidate : '';
}
/**
 * Get tool cache information for a specific version.
 * Use this to persist the tool cache across workflow runs with actions/cache.
 */
export function getToolCacheInfo(version, platformOverride) {
    const normalizedVersion = version.replace(/^v/, '');
    const platform = getPlatformInfo(platformOverride);
    const cachePath = findToolCachePath(TOOL_NAME, normalizedVersion, platform.cacheKey);
    const toolCacheRoot = process.env.RUNNER_TOOL_CACHE || '/opt/hostedtoolcache';
    return {
        toolName: TOOL_NAME,
        version: normalizedVersion,
        cachePath: cachePath || null,
        cachePattern: `${toolCacheRoot}/${TOOL_NAME}/${normalizedVersion}*`,
        cacheKey: `${TOOL_NAME}-${normalizedVersion}-${platform.os}-${platform.cacheKey}`,
        platformKey: platform.cacheKey,
    };
}
/**
 * The versions of the CLI this runner image installed for jobs, newest first.
 * Only a directory with its completion marker counts, which is the same rule
 * `@actions/tool-cache` applies.
 */
export function findRunnerProvidedVersions(arch) {
    const toolCacheRoot = process.env.RUNNER_TOOL_CACHE || '/opt/hostedtoolcache';
    const toolRoot = path.resolve(toolCacheRoot, TOOL_NAME);
    let entries;
    try {
        entries = fs.readdirSync(toolRoot);
    }
    catch {
        return [];
    }
    return entries
        .filter((entry) => /^[A-Za-z0-9._-]+$/.test(entry))
        .filter((entry) => findToolCachePath(TOOL_NAME, entry, arch) !== '')
        .sort(compareVersionsDescending);
}
function compareVersionsDescending(left, right) {
    const parse = (value) => value.split(/[.-]/).map((part) => Number.parseInt(part, 10));
    const leftParts = parse(left);
    const rightParts = parse(right);
    for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
        const leftPart = leftParts[index];
        const rightPart = rightParts[index];
        if (Number.isNaN(leftPart) || leftPart === undefined)
            return 1;
        if (Number.isNaN(rightPart) || rightPart === undefined)
            return -1;
        if (leftPart !== rightPart)
            return rightPart - leftPart;
    }
    return right.localeCompare(left);
}
/**
 * Read the release digest the image recorded beside a tool-cache copy.
 * Returns null when the image did not write one, and the caller then verifies
 * against SHA256SUMS as it does on a GitHub-hosted runner.
 */
export function readSidecarChecksum(toolPath, assetName) {
    try {
        // codeql[js/path-injection]
        const content = fs.readFileSync(path.join(toolPath, CHECKSUM_SIDECAR), 'utf-8');
        return parseChecksums(content, assetName);
    }
    catch {
        return null;
    }
}
export function getStableCliBinDir() {
    return path.join(os.homedir(), '.boringcache', 'bin');
}
export async function ensureMacosCodeSignature(binaryPath, platform = process.platform) {
    if (platform !== 'darwin')
        return;
    const verificationArgs = ['--verify', '--strict', '--verbose=2', binaryPath];
    const verificationOptions = {
        ignoreReturnCode: true,
        silent: true,
    };
    if (await exec.exec('/usr/bin/codesign', verificationArgs, verificationOptions) === 0) {
        return;
    }
    core.info('The installed macOS CLI has an invalid code signature; applying a local ad hoc signature.');
    const signExitCode = await exec.exec('/usr/bin/codesign', ['--force', '--sign', '-', binaryPath], verificationOptions);
    if (signExitCode !== 0) {
        throw new Error(`Failed to apply a local code signature to ${binaryPath}.`);
    }
    const verifiedExitCode = await exec.exec('/usr/bin/codesign', verificationArgs, verificationOptions);
    if (verifiedExitCode !== 0) {
        throw new Error(`The local code signature for ${binaryPath} is invalid.`);
    }
}
export async function exposeBoringCacheCli(toolPath, binaryName = process.platform === 'win32' ? 'boringcache.exe' : 'boringcache', stableBinDir = getStableCliBinDir()) {
    const sourcePath = path.join(toolPath, binaryName);
    const stablePath = path.join(stableBinDir, binaryName);
    // The source is the selected CLI binary in the hosted tool cache; the destination is runner-local action state.
    // codeql[js/path-injection]
    await fs.promises.mkdir(stableBinDir, { recursive: true });
    // codeql[js/path-injection]
    await fs.promises.copyFile(sourcePath, stablePath);
    if (process.platform !== 'win32') {
        // codeql[js/path-injection]
        await fs.promises.chmod(stablePath, 0o755);
    }
    await ensureMacosCodeSignature(stablePath);
    return stableBinDir;
}
function getPlatformInfo(platformOverride) {
    if (platformOverride) {
        const normalizedPlatform = platformOverride.trim().toLowerCase();
        const match = normalizedPlatform.match(/^(linux(?:-musl)?|windows)-(amd64|arm64)$/);
        if (match) {
            const [, platformOs, arch] = match;
            const isWindows = platformOs === 'windows';
            const usesMusl = platformOs === 'linux-musl';
            return {
                os: isWindows ? 'windows' : 'linux',
                arch,
                assetName: `boringcache-${normalizedPlatform}${isWindows ? '.exe' : ''}`,
                isWindows,
                cacheKey: usesMusl ? `musl-${arch}` : arch,
            };
        }
        if (normalizedPlatform === 'macos-universal') {
            return {
                os: 'macos',
                arch: 'universal',
                assetName: 'boringcache-macos-universal',
                isWindows: false,
                cacheKey: 'universal',
            };
        }
        throw new Error(`Unsupported cli-platform "${platformOverride}". Expected linux-amd64, linux-arm64, linux-musl-amd64, linux-musl-arm64, macos-universal, windows-amd64, or windows-arm64.`);
    }
    const runnerOS = process.env.RUNNER_OS || os.platform();
    const runnerArch = process.env.RUNNER_ARCH || os.arch();
    let normalizedOS = runnerOS;
    let normalizedArch = runnerArch;
    if (runnerOS === 'darwin' || runnerOS === 'Darwin') {
        normalizedOS = 'macOS';
    }
    else if (runnerOS === 'win32' || runnerOS === 'Windows') {
        normalizedOS = 'Windows';
    }
    else if (runnerOS === 'linux' || runnerOS === 'Linux') {
        normalizedOS = 'Linux';
    }
    if (runnerArch === 'x64' || runnerArch === 'X64' || runnerArch === 'amd64') {
        normalizedArch = 'X64';
    }
    else if (runnerArch === 'arm64' || runnerArch === 'ARM64' || runnerArch === 'aarch64') {
        normalizedArch = 'ARM64';
    }
    const isWindows = normalizedOS === 'Windows';
    let assetName;
    switch (normalizedOS) {
        case 'Linux':
            assetName = normalizedArch === 'ARM64' ? 'boringcache-linux-arm64' : 'boringcache-linux-amd64';
            break;
        case 'macOS':
            assetName = 'boringcache-macos-universal';
            break;
        case 'Windows':
            assetName = normalizedArch === 'ARM64' ? 'boringcache-windows-arm64.exe' : 'boringcache-windows-amd64.exe';
            break;
        default:
            throw new Error(`Unsupported platform: OS=${runnerOS}, ARCH=${runnerArch}`);
    }
    return {
        os: normalizedOS.toLowerCase(),
        arch: normalizedArch.toLowerCase(),
        assetName,
        isWindows,
        cacheKey: normalizedOS === 'macOS'
            ? 'universal'
            : normalizedArch === 'ARM64'
                ? 'arm64'
                : 'amd64',
    };
}
function getReleaseAssetUrls(version, assetName) {
    const githubUrl = `${GITHUB_RELEASES_BASE}/${version}/${assetName}`;
    if (!/^v\d+\.\d+\.\d+$/.test(version)) {
        return [githubUrl];
    }
    return [
        `${CANONICAL_RELEASES_BASE}/${version}/${assetName}`,
        githubUrl,
    ];
}
async function downloadReleaseAsset(version, assetName) {
    const urls = getReleaseAssetUrls(version, assetName);
    const failures = [];
    for (const [index, url] of urls.entries()) {
        core.debug(`Downloading ${assetName} from: ${url}`);
        try {
            return await tc.downloadTool(url);
        }
        catch (error) {
            failures.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
            if (index + 1 < urls.length) {
                core.warning(`Canonical ${assetName} download failed; using the GitHub mirror for ${version}.`);
            }
        }
    }
    throw new Error(`Failed to download ${assetName} for ${version}: ${failures.join('; ')}`);
}
/**
 * Compute SHA256 hash of a file
 */
async function computeFileHash(filePath) {
    const fileBuffer = await fs.promises.readFile(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}
/**
 * Parse SHA256SUMS file content and extract checksum for a specific asset
 * Format: <sha256>  <filename> (two spaces between hash and filename)
 * or: <sha256> <filename> (single space)
 */
function parseChecksums(content, assetName) {
    const lines = content.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        // Match either "hash  filename" or "hash filename"
        const match = trimmed.match(/^([a-f0-9]{64})\s+(.+)$/i);
        if (match) {
            const [, hash, filename] = match;
            // Match exact filename or filename at end of path
            if (filename === assetName || filename.endsWith(`/${assetName}`)) {
                return hash.toLowerCase();
            }
        }
    }
    return null;
}
/**
 * Download SHA256SUMS and get expected checksum for the asset
 */
async function getExpectedChecksum(version, assetName) {
    try {
        const checksumsPath = await downloadReleaseAsset(version, 'SHA256SUMS');
        const content = await fs.promises.readFile(checksumsPath, 'utf-8');
        const checksum = parseChecksums(content, assetName);
        if (!checksum) {
            throw new Error(`Checksum not found for asset: ${assetName}`);
        }
        return checksum;
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to fetch checksums for ${version}: ${msg}`);
    }
}
/**
 * Verify file checksum matches expected value
 */
async function verifyChecksum(filePath, expectedChecksum, assetName) {
    const actualChecksum = await computeFileHash(filePath);
    if (actualChecksum !== expectedChecksum) {
        throw new Error(`Checksum verification failed for ${assetName}:\n` +
            `  Expected: ${expectedChecksum}\n` +
            `  Actual:   ${actualChecksum}`);
    }
    core.info(`Checksum verified for ${assetName}`);
}
async function downloadAndInstall(version, platform, verify) {
    const resolvedAssetName = platform.assetName;
    core.info(`Downloading BoringCache CLI ${version} (${resolvedAssetName})...`);
    let downloadedPath;
    try {
        downloadedPath = await downloadReleaseAsset(version, resolvedAssetName);
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('404')) {
            throw new Error(`Failed to download BoringCache CLI ${version} (${platform.assetName}): ` +
                'release asset not found. The requested cli-version may not be published yet.');
        }
        else {
            throw new Error(`Failed to download BoringCache CLI ${version} (${platform.assetName}): ${msg}`);
        }
    }
    // Verify checksum if enabled
    if (verify) {
        const expectedChecksum = await getExpectedChecksum(version, resolvedAssetName);
        await verifyChecksum(downloadedPath, expectedChecksum, resolvedAssetName);
    }
    else {
        core.warning('Checksum verification disabled - this is not recommended for production use');
    }
    const binaryName = platform.isWindows ? 'boringcache.exe' : 'boringcache';
    const installDir = path.join(os.tmpdir(), 'boringcache-install', version);
    await fs.promises.mkdir(installDir, { recursive: true });
    const binaryPath = path.join(installDir, binaryName);
    await fs.promises.copyFile(downloadedPath, binaryPath);
    if (!platform.isWindows) {
        await fs.promises.chmod(binaryPath, 0o755);
    }
    const cachedPath = await tc.cacheDir(installDir, TOOL_NAME, version.replace(/^v/, ''), platform.cacheKey);
    return cachedPath;
}
export async function isCliAvailable() {
    return (await availableCliVersion()) !== null;
}
/**
 * The version an already-installed CLI reports, or null when none is usable.
 * `cli-version: runner` resolves to whatever is installed, so the caller needs
 * the reported version rather than the literal input: companions are fetched
 * from the matching release, and "runner" is not a release tag.
 */
export async function availableCliVersion() {
    try {
        let output = '';
        const result = await exec.exec('boringcache', ['--version'], {
            ignoreReturnCode: true,
            silent: true,
            listeners: {
                stdout: (data) => { output += data.toString(); },
                stderr: (data) => { output += data.toString(); }
            }
        });
        if (result !== 0 || !output.includes('boringcache')) {
            return null;
        }
        const match = output.match(/\bboringcache\s+v?(\d+\.\d+\.\d+(?:[-+][^\s]+)?)/i);
        return match ? match[1] : '';
    }
    catch {
        return null;
    }
}
/**
 * Install the CLI and report the exact version installed. `cli-version: runner`
 * resolves to whichever version the runner image provides, and callers that
 * install companions from the same release need that resolved value rather
 * than the literal input.
 */
export async function ensureBoringCache(options) {
    const secrets = new Set([
        options.token,
        process.env.BORINGCACHE_RESTORE_TOKEN,
        process.env.BORINGCACHE_STAGE_TOKEN,
        process.env.BORINGCACHE_SAVE_TOKEN,
        process.env.BORINGCACHE_ADMIN_TOKEN,
    ].filter((value) => Boolean(value)));
    for (const secret of secrets) {
        core.setSecret(secret);
    }
    const shouldRequireServerSignature = options.requireServerSignature !== false;
    if (shouldRequireServerSignature && !process.env.BORINGCACHE_REQUIRE_SERVER_SIGNATURE) {
        core.exportVariable('BORINGCACHE_REQUIRE_SERVER_SIGNATURE', '1');
        core.info('BORINGCACHE_REQUIRE_SERVER_SIGNATURE=1 (strict server signature verification enabled)');
    }
    const runnerProvided = options.version.trim().toLowerCase() === RUNNER_PROVIDED_VERSION;
    const installedVersion = await availableCliVersion();
    if (options.version === 'skip') {
        core.debug('CLI setup skipped (version: skip)');
        if (installedVersion !== null) {
            return options.version;
        }
        throw new Error('BoringCache CLI not found and cli-version is set to "skip"');
    }
    if (installedVersion !== null) {
        core.debug('BoringCache CLI already available');
        if (!runnerProvided) {
            return options.version;
        }
        if (installedVersion === '') {
            throw new Error('cli-version: runner needs the installed BoringCache CLI to report a semantic version, '
                + 'but `boringcache --version` did not. Pin an exact cli-version instead.');
        }
        return `v${installedVersion}`;
    }
    const platform = getPlatformInfo(options.platform);
    const enableCache = options.cache !== false;
    const enableVerify = options.verify !== false; // Default: true
    let version = options.version;
    if (runnerProvided) {
        const [provided] = findRunnerProvidedVersions(platform.cacheKey);
        if (!provided) {
            throw new Error(`cli-version: ${RUNNER_PROVIDED_VERSION} needs the runner image to preinstall the BoringCache CLI at `
                + `${process.env.RUNNER_TOOL_CACHE || '/opt/hostedtoolcache'}/${TOOL_NAME}/<version>/${platform.cacheKey}, and this runner has none. `
                + 'Pin an exact cli-version to install it instead.');
        }
        version = provided;
    }
    const normalizedVersion = version.startsWith('v') ? version : `v${version}`;
    core.info(`Installing BoringCache CLI ${normalizedVersion}...`);
    const cacheInfo = getToolCacheInfo(normalizedVersion, options.platform);
    const toolCacheRoot = process.env.RUNNER_TOOL_CACHE || '/opt/hostedtoolcache';
    const cachePaths = [`${toolCacheRoot}/${TOOL_NAME}`];
    const binaryName = platform.isWindows ? 'boringcache.exe' : 'boringcache';
    let toolPath = await verifiedToolCachePath(normalizedVersion, platform, cacheInfo.platformKey, enableVerify, binaryName);
    if (toolPath) {
        core.info('Using the BoringCache CLI the runner image provides');
    }
    let restoreFailed = false;
    if (!toolPath && !runnerProvided && enableCache) {
        const outcome = await restoreCacheWithOutcome(cachePaths, cacheInfo.cacheKey);
        restoreFailed = outcome.serviceFailed;
        if (outcome.matchedKey) {
            core.info(`Restored CLI from cache (key: ${outcome.matchedKey})`);
            toolPath = await verifiedToolCachePath(normalizedVersion, platform, cacheInfo.platformKey, enableVerify, binaryName);
        }
    }
    if (!toolPath && runnerProvided) {
        throw new Error(`The BoringCache CLI ${normalizedVersion} the runner image recorded is not usable. `
            + 'Pin an exact cli-version to install a verified copy instead.');
    }
    if (!toolPath) {
        toolPath = await downloadAndInstall(normalizedVersion, platform, enableVerify);
        if (enableCache && !restoreFailed) {
            await saveImmutableToolCache(cachePaths, cacheInfo.cacheKey, 'CLI');
        }
        else if (restoreFailed) {
            core.debug('Skipping the CLI cache save because this job\'s cache restore failed');
        }
    }
    const stableToolPath = await exposeBoringCacheCli(toolPath, binaryName, options.stableBinDir || getStableCliBinDir());
    core.addPath(stableToolPath);
    core.info(`BoringCache CLI ${normalizedVersion} ready`);
    return normalizedVersion;
}
/**
 * `@actions/cache` treats caching as optional: it catches every non-validation
 * failure, including service errors and reads denied by policy, logs
 * "Failed to restore: ..." and returns undefined. A caller that only watches
 * for a thrown error cannot tell a genuine miss from a service that is
 * refusing calls, and then saves into that same service. Reading the log line
 * it emits is the only outcome the dependency exposes; if that line ever
 * changes we simply fall back to treating the result as a miss.
 */
const SUPPRESSED_RESTORE_FAILURE = /::(?:error|warning)::[^\n]*Failed to restore/;
async function restoreCacheWithOutcome(paths, key) {
    let serviceFailed = false;
    const originalWrite = process.stdout.write;
    const watch = (function (chunk, ...rest) {
        const text = typeof chunk === 'string'
            ? chunk
            : Buffer.isBuffer(chunk) ? chunk.toString('utf8') : '';
        if (text && SUPPRESSED_RESTORE_FAILURE.test(text)) {
            serviceFailed = true;
        }
        return originalWrite.call(process.stdout, chunk, ...rest);
    });
    process.stdout.write = watch;
    try {
        const matchedKey = await cache.restoreCache(paths, key);
        return { matchedKey: matchedKey ?? undefined, serviceFailed };
    }
    catch (error) {
        core.debug(`Cache restore failed: ${error instanceof Error ? error.message : error}`);
        return { matchedKey: undefined, serviceFailed: true };
    }
    finally {
        process.stdout.write = originalWrite;
    }
}
/**
 * A tool-cache copy this action is willing to use. Verification prefers the
 * digest the runner image recorded beside the binary; only a copy without that
 * sidecar costs a SHA256SUMS fetch.
 */
async function verifiedToolCachePath(normalizedVersion, platform, platformKey, verify, binaryName) {
    const toolPath = findToolCachePath(TOOL_NAME, normalizedVersion.replace(/^v/, ''), platformKey);
    if (!toolPath) {
        return '';
    }
    const binary = path.join(toolPath, binaryName);
    if (!fs.existsSync(binary)) {
        return '';
    }
    if (!verify) {
        return toolPath;
    }
    try {
        const sidecarChecksum = readSidecarChecksum(toolPath, platform.assetName);
        const expectedChecksum = sidecarChecksum ?? await getExpectedChecksum(normalizedVersion, platform.assetName);
        const actualChecksum = await computeFileHash(binary);
        if (actualChecksum !== expectedChecksum) {
            core.warning('Cached CLI binary is stale (checksum mismatch), re-downloading');
            return '';
        }
        if (sidecarChecksum) {
            core.debug('Verified the CLI against the digest the runner image recorded');
        }
        return toolPath;
    }
    catch (error) {
        core.warning(`Could not verify the cached CLI binary; ignoring it and downloading a verified copy: ${error instanceof Error ? error.message : error}`);
        return '';
    }
}
/** Install the release-owned Xcode CAS companion beside the stable CLI. */
export async function ensureXcodePlugin(version, verify = true, stableBinDir = getStableCliBinDir()) {
    if (process.platform !== 'darwin') {
        throw new Error('The BoringCache Xcode plugin can only be installed on macOS.');
    }
    const configuredPath = (process.env.BORINGCACHE_XCODE_PLUGIN_PATH || '').trim();
    if (configuredPath) {
        // The CLI validates and hashes explicit source-tree or canary overrides.
        // Avoid probing a repository-controlled path in the Action itself.
        return configuredPath;
    }
    const pluginPath = path.join(stableBinDir, XCODE_PLUGIN_NAME);
    if (fs.existsSync(pluginPath)) {
        if (version.toLowerCase() !== 'skip' && verify) {
            const normalizedVersion = version.startsWith('v') ? version : `v${version}`;
            try {
                const expectedChecksum = await getExpectedChecksum(normalizedVersion, XCODE_PLUGIN_ASSET);
                const actualChecksum = await computeFileHash(pluginPath);
                if (actualChecksum === expectedChecksum) {
                    core.exportVariable('BORINGCACHE_XCODE_PLUGIN_PATH', pluginPath);
                    return pluginPath;
                }
                core.warning('Installed Xcode adapter is stale (checksum mismatch), re-downloading');
            }
            catch (error) {
                core.warning(`Could not verify the installed Xcode adapter; downloading a verified copy: ${error instanceof Error ? error.message : error}`);
            }
        }
        else {
            core.exportVariable('BORINGCACHE_XCODE_PLUGIN_PATH', pluginPath);
            return pluginPath;
        }
    }
    if (version.toLowerCase() === 'skip') {
        throw new Error(`mode=xcode needs ${XCODE_PLUGIN_NAME} beside the BoringCache CLI, `
            + 'or BORINGCACHE_XCODE_PLUGIN_PATH when cli-version is skip.');
    }
    const normalizedVersion = version.startsWith('v') ? version : `v${version}`;
    core.info(`Installing the BoringCache Xcode adapter for ${normalizedVersion}...`);
    let downloadedPath;
    try {
        downloadedPath = await downloadReleaseAsset(normalizedVersion, XCODE_PLUGIN_ASSET);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to download ${XCODE_PLUGIN_ASSET} for ${normalizedVersion}: ${message}`);
    }
    if (verify) {
        const expectedChecksum = await getExpectedChecksum(normalizedVersion, XCODE_PLUGIN_ASSET);
        await verifyChecksum(downloadedPath, expectedChecksum, XCODE_PLUGIN_ASSET);
    }
    await fs.promises.mkdir(stableBinDir, { recursive: true });
    await fs.promises.copyFile(downloadedPath, pluginPath);
    await fs.promises.chmod(pluginPath, 0o755);
    core.exportVariable('BORINGCACHE_XCODE_PLUGIN_PATH', pluginPath);
    core.info('BoringCache Xcode adapter ready');
    return pluginPath;
}
export async function execBoringCache(args, options = {}) {
    const isWindows = os.platform() === 'win32';
    try {
        return await exec.exec('boringcache', args, options);
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (isWindows && msg.includes('Unable to locate executable file')) {
            return await exec.exec('bash', ['-lc', 'exec "$0" "$@"', 'boringcache', ...args], options);
        }
        throw error;
    }
}
