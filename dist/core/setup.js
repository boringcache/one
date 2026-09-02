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
const GITHUB_RELEASES_BASE = 'https://github.com/boringcache/cli/releases/download';
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
export function getStableCliBinDir() {
    return path.join(os.homedir(), '.boringcache', 'bin');
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
function getDownloadUrl(version, assetName) {
    return `${GITHUB_RELEASES_BASE}/${version}/${assetName}`;
}
function getChecksumsUrl(version) {
    return `${GITHUB_RELEASES_BASE}/${version}/SHA256SUMS`;
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
    const checksumsUrl = getChecksumsUrl(version);
    core.debug(`Downloading checksums from: ${checksumsUrl}`);
    try {
        const checksumsPath = await tc.downloadTool(checksumsUrl);
        const content = await fs.promises.readFile(checksumsPath, 'utf-8');
        const checksum = parseChecksums(content, assetName);
        if (!checksum) {
            throw new Error(`Checksum not found for asset: ${assetName}`);
        }
        return checksum;
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to fetch checksums from ${checksumsUrl}: ${msg}`);
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
    const downloadUrl = getDownloadUrl(version, resolvedAssetName);
    core.info(`Downloading BoringCache CLI from: ${downloadUrl}`);
    let downloadedPath;
    try {
        downloadedPath = await tc.downloadTool(downloadUrl);
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('404')) {
            throw new Error(`Failed to download BoringCache CLI ${version} (${platform.assetName}) from ${downloadUrl}: ` +
                'release asset not found. The requested cli-version may not be published yet.');
        }
        else {
            throw new Error(`Failed to download BoringCache CLI ${version} (${platform.assetName}) from ${downloadUrl}: ${msg}`);
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
        return result === 0 && output.includes('boringcache');
    }
    catch {
        return false;
    }
}
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
    if (options.version === 'skip') {
        core.debug('CLI setup skipped (version: skip)');
        if (await isCliAvailable()) {
            return;
        }
        throw new Error('BoringCache CLI not found and cli-version is set to "skip"');
    }
    if (await isCliAvailable()) {
        core.debug('BoringCache CLI already available');
        return;
    }
    const version = options.version;
    const normalizedVersion = version.startsWith('v') ? version : `v${version}`;
    const platform = getPlatformInfo(options.platform);
    const enableCache = options.cache !== false;
    const enableVerify = options.verify !== false; // Default: true
    core.info(`Installing BoringCache CLI ${normalizedVersion}...`);
    // Get cache info for this version
    const cacheInfo = getToolCacheInfo(normalizedVersion, options.platform);
    const toolCacheRoot = process.env.RUNNER_TOOL_CACHE || '/opt/hostedtoolcache';
    const cachePaths = [`${toolCacheRoot}/${TOOL_NAME}`];
    if (enableCache) {
        try {
            const cacheKey = await cache.restoreCache(cachePaths, cacheInfo.cacheKey);
            if (cacheKey) {
                core.info(`Restored CLI from cache (key: ${cacheKey})`);
            }
        }
        catch (error) {
            core.debug(`Cache restore failed: ${error instanceof Error ? error.message : error}`);
        }
    }
    let toolPath;
    let cachedPath = findToolCachePath(TOOL_NAME, normalizedVersion.replace(/^v/, ''), cacheInfo.platformKey);
    if (cachedPath && enableVerify) {
        const binaryName = platform.isWindows ? 'boringcache.exe' : 'boringcache';
        const cachedBinary = path.join(cachedPath, binaryName);
        if (fs.existsSync(cachedBinary)) {
            try {
                const expectedChecksum = await getExpectedChecksum(normalizedVersion, platform.assetName);
                const actualChecksum = await computeFileHash(cachedBinary);
                if (actualChecksum !== expectedChecksum) {
                    core.warning(`Cached CLI binary is stale (checksum mismatch), re-downloading`);
                    cachedPath = '';
                }
            }
            catch (error) {
                core.warning(`Could not verify the cached CLI binary; ignoring it and downloading a verified copy: ${error instanceof Error ? error.message : error}`);
                cachedPath = '';
            }
        }
        else {
            cachedPath = '';
        }
    }
    if (cachedPath) {
        core.info(`Using cached BoringCache CLI`);
        toolPath = cachedPath;
    }
    else {
        toolPath = await downloadAndInstall(normalizedVersion, platform, enableVerify);
        if (enableCache) {
            await saveImmutableToolCache(cachePaths, cacheInfo.cacheKey, 'CLI');
        }
    }
    const binaryName = platform.isWindows ? 'boringcache.exe' : 'boringcache';
    const stableToolPath = await exposeBoringCacheCli(toolPath, binaryName);
    core.addPath(stableToolPath);
    core.info(`BoringCache CLI ${normalizedVersion} ready`);
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
