import * as core from '@actions/core';
import { context as githubContext } from '@actions/github';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import { getAuthTokens, missingRestoreTokenMessage, missingSaveTokenMessage, } from './auth';
const GHA_READY_TIMEOUT_MS = 300_000;
const GHA_READY_POLL_MS = 200;
function createServiceDirectory() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boringcache-gha-'));
    fs.chmodSync(directory, 0o700);
    return directory;
}
function removeFile(filePath) {
    try {
        fs.unlinkSync(filePath);
    }
    catch {
        // Missing and already-cleaned files are harmless.
    }
}
function processAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
function logTail(logPath) {
    try {
        return fs.readFileSync(logPath, 'utf8').trim().split('\n').slice(-40).join('\n');
    }
    catch {
        return '';
    }
}
function parseRepositoryId(value) {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized) || normalized === '0') {
        throw new Error('GitHub Actions cache mode requires the positive GITHUB_REPOSITORY_ID value.');
    }
    return normalized;
}
function normalizeScope(value, label) {
    const normalized = value.trim();
    if (!normalized || Buffer.byteLength(normalized) > 1024) {
        throw new Error(`${label} must contain 1-1024 bytes.`);
    }
    return normalized;
}
function normalizeArtifactBackendId(value, label) {
    const normalized = value.trim();
    if (!normalized || Buffer.byteLength(normalized) > 128 || normalized.includes(':')) {
        throw new Error(`${label} must contain 1-128 bytes and must not contain colons.`);
    }
    return normalized;
}
function readDefaultBranch() {
    const branch = githubContext.payload.repository?.default_branch;
    return typeof branch === 'string' ? branch.trim() : '';
}
export function resolveGitHubCacheIdentity() {
    const repositoryId = parseRepositoryId(process.env.GITHUB_REPOSITORY_ID || '');
    const workflowRunBackendId = normalizeArtifactBackendId(process.env.GITHUB_RUN_ID || '', 'GITHUB_RUN_ID');
    const workflowJobRunBackendId = normalizeArtifactBackendId(process.env.GITHUB_JOB || '', 'GITHUB_JOB');
    const scope = normalizeScope(process.env.GITHUB_REF || '', 'GITHUB_REF');
    const fallbacks = [
        (process.env.GITHUB_BASE_REF || '').trim(),
        readDefaultBranch(),
    ]
        .filter(Boolean)
        .map((branch) => branch.startsWith('refs/') ? branch : `refs/heads/${branch}`);
    const readScopes = [];
    for (const fallback of fallbacks) {
        const normalized = normalizeScope(fallback, 'GitHub cache fallback scope');
        if (normalized !== scope && !readScopes.includes(normalized)) {
            readScopes.push(normalized);
        }
    }
    return { repositoryId, workflowRunBackendId, workflowJobRunBackendId, scope, readScopes };
}
function parseReadyEnvironment(contents, host, port) {
    const parsed = JSON.parse(contents);
    if (parsed.ACTIONS_CACHE_SERVICE_V2 !== 'true'
        || typeof parsed.ACTIONS_RESULTS_URL !== 'string'
        || typeof parsed.ACTIONS_RUNTIME_TOKEN !== 'string'
        || !parsed.ACTIONS_RUNTIME_TOKEN) {
        throw new Error('BoringCache GHA adapter wrote an invalid ready environment.');
    }
    const endpoint = new URL(parsed.ACTIONS_RESULTS_URL);
    if (endpoint.protocol !== 'http:'
        || endpoint.hostname !== host
        || Number.parseInt(endpoint.port, 10) !== port
        || endpoint.pathname !== '/') {
        throw new Error('BoringCache GHA adapter advertised an unexpected non-loopback endpoint.');
    }
    return parsed;
}
async function waitForReady(readyPath, child, host, port, logPath) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < GHA_READY_TIMEOUT_MS) {
        if (fs.existsSync(readyPath)) {
            const ready = parseReadyEnvironment(fs.readFileSync(readyPath, 'utf8'), host, port);
            removeFile(readyPath);
            return ready;
        }
        if (!child.pid || !processAlive(child.pid)) {
            const logs = logTail(logPath);
            throw new Error(`BoringCache GHA adapter exited before becoming ready${logs ? `:\n${logs}` : ''}`);
        }
        await new Promise((resolve) => setTimeout(resolve, GHA_READY_POLL_MS));
    }
    throw new Error(`Timed out waiting for BoringCache GHA adapter${logTail(logPath) ? `:\n${logTail(logPath)}` : ''}`);
}
export async function startGhaAdapter(options) {
    const { restoreToken, saveToken } = getAuthTokens();
    let readOnly = options.readOnly === true;
    if (!readOnly && !saveToken && restoreToken) {
        readOnly = true;
        core.info('No save-capable token configured; starting the GitHub Actions cache adapter in restore-only mode.');
    }
    if (readOnly && !restoreToken) {
        throw new Error(`${missingRestoreTokenMessage()} This is required for GitHub Actions cache mode.`);
    }
    if (!readOnly && !saveToken) {
        throw new Error(`${missingSaveTokenMessage()} This is required for GitHub Actions cache mode.`);
    }
    const host = options.host || '127.0.0.1';
    if (host !== '127.0.0.1' && host !== '::1') {
        throw new Error(`GitHub Actions cache mode only binds loopback; got ${host}.`);
    }
    const repositoryId = parseRepositoryId(options.repositoryId);
    const scope = normalizeScope(options.scope, 'GitHub cache scope');
    const readScopes = options.readScopes
        .map((value) => normalizeScope(value, 'GitHub cache fallback scope'))
        .filter((value, index, values) => value !== scope && values.indexOf(value) === index);
    if (readScopes.length > 15) {
        throw new Error('GitHub Actions cache mode supports at most 16 ordered scopes.');
    }
    const serviceDirectory = createServiceDirectory();
    const readyPath = path.join(serviceDirectory, 'environment.json');
    const logPath = path.join(serviceDirectory, 'service.log');
    const args = [
        'gha',
        '--workspace', options.workspace,
        '--host', host,
        '--port', String(options.port),
        '--repository-id', repositoryId,
        '--workflow-run-backend-id', normalizeArtifactBackendId(options.workflowRunBackendId, 'workflow run backend id'),
        '--workflow-job-run-backend-id', normalizeArtifactBackendId(options.workflowJobRunBackendId, 'workflow job run backend id'),
        '--scope', scope,
        '--ready-file', readyPath,
    ];
    for (const readScope of readScopes) {
        args.push('--read-scope', readScope);
    }
    if (readOnly) {
        args.push('--read-only');
    }
    if (options.verbose) {
        args.push('--verbose');
    }
    const logFd = fs.openSync(logPath, 'wx', 0o600);
    const child = spawn('boringcache', args, {
        detached: true,
        stdio: ['ignore', logFd, logFd],
        env: { ...process.env },
    });
    child.unref();
    fs.closeSync(logFd);
    if (!child.pid) {
        throw new Error('Failed to start BoringCache GHA adapter.');
    }
    try {
        const ready = await waitForReady(readyPath, child, host, options.port, logPath);
        core.setSecret(ready.ACTIONS_RUNTIME_TOKEN);
        core.exportVariable('ACTIONS_CACHE_SERVICE_V2', ready.ACTIONS_CACHE_SERVICE_V2);
        core.exportVariable('ACTIONS_RESULTS_URL', ready.ACTIONS_RESULTS_URL);
        core.exportVariable('ACTIONS_RUNTIME_TOKEN', ready.ACTIONS_RUNTIME_TOKEN);
        core.info(`BoringCache GitHub Actions compatibility service is ready at ${ready.ACTIONS_RESULTS_URL}`);
        return {
            pid: child.pid,
            port: options.port,
            readOnly,
            logPath,
            resultsUrl: ready.ACTIONS_RESULTS_URL,
        };
    }
    catch (error) {
        try {
            process.kill(child.pid, 'SIGTERM');
        }
        catch {
            // Preserve the startup error.
        }
        removeFile(readyPath);
        fs.rmSync(serviceDirectory, { recursive: true, force: true });
        throw error;
    }
}
