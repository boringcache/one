import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readSha256File, verifySha256 } from './integrity';
import { addLocalBinPaths, isPathInside, safePathComponent } from './paths';
const ADAPTER_BINARIES = {
    buildkit: ['buildctl'],
    cargo: ['sccache'],
    ccache: ['ccache', 'ccache-storage-http'],
    sccache: ['sccache'],
};
export async function ensureAdapterTools(adapter, versions, runCli, workingDirectory) {
    const requirements = await resolveRequiredTools(adapter, versions, runCli, workingDirectory);
    if (requirements) {
        await installRequiredTools(requirements);
        return;
    }
    await requireAdapterBinariesOnPath(adapter);
}
export async function resolveRequiredTools(adapter, versions, runCli, workingDirectory) {
    const args = ['system', 'requirements', adapter];
    for (const [tool, version] of Object.entries(versions)) {
        if (version.trim()) {
            args.push('--tool-version', `${tool}=${version.trim()}`);
        }
    }
    args.push('--json');
    let stdout = '';
    let stderr = '';
    let exitCode;
    try {
        exitCode = await runCli(args, {
            ignoreReturnCode: true,
            silent: true,
            cwd: workingDirectory,
            listeners: {
                stdout: (data) => {
                    stdout += data.toString();
                },
                stderr: (data) => {
                    stderr += data.toString();
                },
            },
        });
    }
    catch (error) {
        throw new Error(`Unable to ask the BoringCache CLI for ${adapter} tool requirements: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (unsupportedRequirementsCommand(exitCode, stderr)) {
        return null;
    }
    if (exitCode !== 0) {
        throw new Error(`The BoringCache CLI could not resolve ${adapter} tool requirements (exit ${exitCode})`
            + `${stderr.trim() ? `: ${stderr.trim()}` : '.'}`);
    }
    if (!stdout.trim()) {
        throw new Error(`The BoringCache CLI returned no ${adapter} tool requirements.`);
    }
    try {
        const response = JSON.parse(stdout);
        if (response.schema_version !== 1 || !Array.isArray(response.adapters)) {
            throw new Error('expected schema_version 1 and an adapters array');
        }
        const selected = response.adapters.filter((entry) => entry.adapter === adapter);
        if (selected.length !== 1 || !Array.isArray(selected[0].required_tools)) {
            throw new Error(`expected exactly one ${adapter} requirement entry`);
        }
        selected[0].required_tools.forEach((requirement) => validateResolvedRequirement(requirement, adapter));
        return selected[0].required_tools;
    }
    catch (error) {
        throw new Error(`The BoringCache CLI returned invalid ${adapter} tool requirements: ${error instanceof Error ? error.message : String(error)}`);
    }
}
function unsupportedRequirementsCommand(exitCode, stderr) {
    return exitCode === 2
        && /unrecognized subcommand\s+['"`](?:system|requirements)['"`]/i.test(stderr);
}
function validateResolvedRequirement(requirement, adapter) {
    if (!requirement || typeof requirement !== 'object') {
        throw new Error('required_tools entries must be objects');
    }
    for (const field of ['name', 'binary', 'version', 'required_by']) {
        if (typeof requirement[field] !== 'string' || !requirement[field].trim()) {
            throw new Error(`required tool ${field} must be a non-empty string`);
        }
    }
    if (requirement.schema_version !== 1) {
        throw new Error(`required tool ${requirement.name} has unsupported schema_version`);
    }
    if (requirement.installed_check !== 'presence' && requirement.installed_check !== 'version') {
        throw new Error(`required tool ${requirement.name} has an unsupported installed_check`);
    }
    if (requirement.required_by !== adapter) {
        throw new Error(`required tool ${requirement.name} belongs to ${requirement.required_by}, not ${adapter}`);
    }
    const resolution = requirement.resolution;
    if (!resolution || typeof resolution !== 'object' || typeof resolution.installed !== 'boolean') {
        throw new Error(`required tool ${requirement.name} has an invalid resolution`);
    }
    if (typeof resolution.host !== 'string' || !resolution.host.trim()) {
        throw new Error(`required tool ${requirement.name} has no host resolution`);
    }
    if (resolution.installed && (typeof resolution.path !== 'string' || !resolution.path.trim())) {
        throw new Error(`installed tool ${requirement.name} has no executable path`);
    }
    if (resolution.unsupported_reason !== undefined
        && (typeof resolution.unsupported_reason !== 'string' || !resolution.unsupported_reason.trim())) {
        throw new Error(`required tool ${requirement.name} has an invalid unsupported reason`);
    }
    if (resolution.install) {
        const install = resolution.install;
        if (install.source !== 'github-release'
            || !install.repository
            || !install.tag
            || !install.asset
            || !Array.isArray(install.binary_path)
            || install.binary_path.length === 0
            || install.binary_path.some((component) => typeof component !== 'string' || !component.trim())
            || (install.archive !== 'tar-gz' && install.archive !== 'zip')
            || (!install.sha256 && !install.checksum_asset)
            || (install.sha256 !== undefined && !/^[a-f0-9]{64}$/i.test(install.sha256))
            || (install.checksum_asset !== undefined
                && (typeof install.checksum_asset !== 'string' || !install.checksum_asset.trim()))) {
            throw new Error(`required tool ${requirement.name} has an invalid verified release descriptor`);
        }
    }
    if (!resolution.installed && !resolution.install && !resolution.unsupported_reason) {
        throw new Error(`required tool ${requirement.name} has no installation or unsupported result`);
    }
}
export async function installRequiredTools(requirements) {
    if (requirements.length === 0) {
        return;
    }
    addLocalBinPaths();
    for (const requirement of requirements) {
        await installRequiredTool(requirement);
    }
}
export async function installRequiredTool(requirement) {
    if (requirement.resolution.installed) {
        core.info(`Using existing ${requirement.name} from ${requirement.resolution.path || 'PATH'}`);
        return;
    }
    const { install, unsupported_reason: unsupportedReason } = requirement.resolution;
    if (!install) {
        throw new Error(unsupportedReason
            || `${requirement.name} ${requirement.version} is required by ${requirement.required_by} but has no installable release for this runner.`);
    }
    core.info(`Installing ${requirement.name} ${requirement.version} for ${requirement.required_by}...`);
    await installGithubRelease(install, requirement.binary);
}
async function requireAdapterBinariesOnPath(adapter) {
    addLocalBinPaths();
    const binaries = ADAPTER_BINARIES[adapter] || [];
    const missing = [];
    for (const binary of binaries) {
        if (!(await isOnPath(binary))) {
            missing.push(binary);
        }
    }
    if (missing.length > 0) {
        throw new Error(`This BoringCache CLI cannot report the managed tools that ${adapter} needs. `
            + `Install ${missing.join(' and ')} on PATH, or use a CLI that supports "boringcache system requirements".`);
    }
}
async function isOnPath(binary) {
    try {
        return (await exec.exec(binary, ['--version'], { ignoreReturnCode: true, silent: true })) === 0;
    }
    catch {
        return false;
    }
}
export function releasePaths(extractionDirectory, installDirectory, binaryPath, executableName) {
    const safeSegments = binaryPath.map((segment) => safePathComponent('binary path segment', segment));
    const safeExecutableName = safePathComponent('executable name', executableName);
    const sourcePath = path.resolve(extractionDirectory, ...safeSegments.slice(0, -1), safeExecutableName);
    const destinationPath = path.resolve(installDirectory, safeExecutableName);
    if (!isPathInside(extractionDirectory, sourcePath)) {
        throw new Error(`Verified release source escapes its extraction directory: ${sourcePath}`);
    }
    if (!isPathInside(installDirectory, destinationPath)) {
        throw new Error(`Verified release destination escapes its install directory: ${destinationPath}`);
    }
    return { sourcePath, destinationPath };
}
export async function resolveVerifiedReleaseSource(extractionDirectory, sourcePath) {
    const [physicalExtractionDirectory, physicalSourcePath] = await Promise.all([
        fs.promises.realpath(extractionDirectory),
        fs.promises.realpath(sourcePath),
    ]);
    if (!isPathInside(physicalExtractionDirectory, physicalSourcePath)) {
        throw new Error(`Verified release source resolves outside its extraction directory: ${sourcePath}`);
    }
    return physicalSourcePath;
}
export function secureCurlArgs(output, url) {
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
export async function download(url, destination, label) {
    const exitCode = await exec.exec('curl', secureCurlArgs(destination, url), {
        ignoreReturnCode: true,
    });
    if (exitCode !== 0) {
        throw new Error(`Failed to download ${label} from ${url}`);
    }
}
async function installGithubRelease(install, binaryName) {
    const asset = safePathComponent('asset name', install.asset);
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'boringcache-release-'));
    const archivePath = path.resolve(tempDir, asset);
    const baseUrl = `https://github.com/${install.repository}/releases/download/${install.tag}`;
    let installDir = null;
    let installed = false;
    try {
        await download(`${baseUrl}/${asset}`, archivePath, binaryName);
        await verifySha256(archivePath, await expectedDigest(install, tempDir, baseUrl, asset), asset);
        await extract(install.archive, archivePath, tempDir);
        installDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'boringcache-tool-'));
        const executableName = process.platform === 'win32' ? `${binaryName}.exe` : binaryName;
        const { sourcePath, destinationPath } = releasePaths(tempDir, installDir, install.binary_path, executableName);
        const physicalSourcePath = await resolveVerifiedReleaseSource(tempDir, sourcePath);
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
async function expectedDigest(install, tempDir, baseUrl, asset) {
    if (install.sha256) {
        return install.sha256;
    }
    const checksumAsset = safePathComponent('checksum asset name', install.checksum_asset || `${asset}.sha256`);
    const checksumPath = path.resolve(tempDir, checksumAsset);
    await download(`${baseUrl}/${checksumAsset}`, checksumPath, `${asset} checksum`);
    return readSha256File(checksumPath, asset);
}
async function extract(archive, archivePath, destination) {
    if (archive === 'zip') {
        await exec.exec('unzip', ['-q', archivePath, '-d', destination]);
        return;
    }
    await exec.exec('tar', ['-xzf', archivePath, '-C', destination]);
}
