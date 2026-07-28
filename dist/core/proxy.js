import * as core from '@actions/core';
import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import { getAuthTokens, missingRestoreTokenMessage, missingSaveTokenMessage, missingStageTokenMessage, } from './auth';
export const DEFAULT_PROXY_PORT = 22243;
const PROXY_PID_FILE = path.join(os.tmpdir(), 'boringcache-proxy.pid');
const PROXY_READY_TIMEOUT_MS = 300000;
const PROXY_READY_POLL_INTERVAL_MS = 200;
const PROXY_READY_WARN_INTERVAL_MS = 10000;
const OCI_IMPORT_READY_TIMEOUT_MS = 15000;
const OCI_IMPORT_READY_POLL_INTERVAL_MS = 1000;
const OCI_REF_READY_POLL_INTERVAL_MS = 1000;
const DEFAULT_OCI_HYDRATION_POLICY = 'metadata-only';
export function normalizeProxyTags(tagInput) {
    const tags = [];
    const seen = new Set();
    for (const rawTag of tagInput.split(',')) {
        const tag = rawTag.trim();
        if (!tag || seen.has(tag)) {
            continue;
        }
        seen.add(tag);
        tags.push(tag);
    }
    if (tags.length === 0) {
        throw new Error('At least one proxy tag is required');
    }
    return tags.join(',');
}
function isProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
function proxyLogPath(port) {
    return path.join(os.tmpdir(), `boringcache-proxy-${port}.log`);
}
function readProxyLogs(port) {
    try {
        return fs.readFileSync(proxyLogPath(port), 'utf-8').trim();
    }
    catch {
        return '';
    }
}
function proxyProbeHost(host) {
    return host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
}
async function isProxyRunning(host, port) {
    const probeHost = proxyProbeHost(host);
    return await new Promise((resolve) => {
        const socket = net.createConnection({ host: probeHost, port });
        let settled = false;
        const finish = (value) => {
            if (settled) {
                return;
            }
            settled = true;
            socket.destroy();
            resolve(value);
        };
        socket.setTimeout(1000);
        socket.once('connect', () => finish(true));
        socket.once('timeout', () => finish(false));
        socket.once('error', () => finish(false));
        socket.once('close', () => finish(false));
    });
}
function proxyReadyFilePath(port) {
    return path.join(os.tmpdir(), `boringcache-proxy-${port}.ready`);
}
function clearProxyReadyFile(readyFile) {
    try {
        fs.unlinkSync(readyFile);
    }
    catch {
        // Ignore missing or inaccessible ready markers; startup will recreate them.
    }
}
async function waitForProxyReadyFile(readyFile, timeoutMs = PROXY_READY_TIMEOUT_MS, port, pid) {
    const start = Date.now();
    let lastLogAt = 0;
    while (Date.now() - start < timeoutMs) {
        if (fs.existsSync(readyFile)) {
            const elapsed = ((Date.now() - start) / 1000).toFixed(1);
            core.info(`BoringCache proxy is ready (${elapsed}s)`);
            clearProxyReadyFile(readyFile);
            return;
        }
        if (pid && pid > 0 && !isProcessAlive(pid)) {
            const logs = port ? readProxyLogs(port) : '';
            throw new Error(`BoringCache proxy exited before becoming ready${logs ? `:\n${logs}` : ''}`);
        }
        const elapsed = Date.now() - start;
        if (elapsed - lastLogAt >= PROXY_READY_WARN_INTERVAL_MS) {
            core.info(`Waiting for proxy readiness... (${(elapsed / 1000).toFixed(0)}s)`);
            lastLogAt = elapsed;
        }
        await new Promise((resolve) => setTimeout(resolve, PROXY_READY_POLL_INTERVAL_MS));
    }
    const logs = port ? readProxyLogs(port) : '';
    throw new Error(`BoringCache proxy did not become ready within ${timeoutMs}ms${logs ? `:\n${logs}` : ''}`);
}
function httpRequest(options) {
    return new Promise((resolve, reject) => {
        const request = http.request(options, (response) => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
                body += chunk;
            });
            response.on('end', () => {
                resolve({
                    statusCode: response.statusCode || 0,
                    body,
                });
            });
        });
        request.on('error', reject);
        request.end();
    });
}
async function fetchProxyStatus(host, port) {
    try {
        const response = await httpRequest({
            host: proxyProbeHost(host),
            port,
            path: '/_boringcache/status',
            method: 'GET',
        });
        if (response.statusCode < 200 || response.statusCode >= 300) {
            return null;
        }
        return JSON.parse(response.body);
    }
    catch {
        return null;
    }
}
async function isManifestReadable(host, port, ref) {
    try {
        const response = await httpRequest({
            host: proxyProbeHost(host),
            port,
            path: `/v2/cache/manifests/${encodeURIComponent(ref)}`,
            method: 'HEAD',
            headers: {
                Accept: [
                    'application/vnd.oci.image.manifest.v1+json',
                    'application/vnd.oci.image.index.v1+json',
                    'application/vnd.docker.distribution.manifest.v2+json',
                    'application/vnd.docker.distribution.manifest.list.v2+json',
                ].join(', '),
            },
        });
        return response.statusCode >= 200 && response.statusCode < 300;
    }
    catch {
        return false;
    }
}
async function readOciRefReadiness(host, port, refs) {
    const readability = await Promise.all(refs.map(async (ref) => ({ ref, readable: await isManifestReadable(host, port, ref) })));
    return {
        readableRefs: readability.filter((entry) => entry.readable).map((entry) => entry.ref),
        unreadableRefs: readability.filter((entry) => !entry.readable).map((entry) => entry.ref),
    };
}
export async function waitForOciImportReadiness(host, port, requestedRefs, timeoutMs = OCI_IMPORT_READY_TIMEOUT_MS) {
    const refs = requestedRefs.map((ref) => ref.trim()).filter(Boolean);
    if (refs.length === 0) {
        return {
            requestedRefs: [],
            readableRefs: [],
            unreadableRefs: [],
            ready: true,
        };
    }
    const startedAt = Date.now();
    let lastStatus = null;
    while (Date.now() - startedAt < timeoutMs) {
        lastStatus = await fetchProxyStatus(host, port);
        const { readableRefs, unreadableRefs } = await readOciRefReadiness(host, port, refs);
        if (readableRefs.length > 0) {
            return {
                requestedRefs: refs,
                readableRefs,
                unreadableRefs,
                ready: unreadableRefs.length === 0,
                phase: lastStatus?.phase,
                publishState: lastStatus?.publish_state,
                publishSettled: lastStatus?.publish_settled,
                tagsVisible: lastStatus?.tags_visible,
            };
        }
        await new Promise((resolve) => setTimeout(resolve, OCI_IMPORT_READY_POLL_INTERVAL_MS));
    }
    const { readableRefs, unreadableRefs } = await readOciRefReadiness(host, port, refs);
    return {
        requestedRefs: refs,
        readableRefs,
        unreadableRefs,
        ready: unreadableRefs.length === 0,
        phase: lastStatus?.phase,
        publishState: lastStatus?.publish_state,
        publishSettled: lastStatus?.publish_settled,
        tagsVisible: lastStatus?.tags_visible,
    };
}
export async function waitForOciRefsReadable(host, port, requestedRefs, timeoutMs = 60_000) {
    const refs = requestedRefs.map((ref) => ref.trim()).filter(Boolean);
    if (refs.length === 0) {
        return {
            requestedRefs: [],
            readableRefs: [],
            unreadableRefs: [],
            ready: true,
        };
    }
    const startedAt = Date.now();
    let lastStatus = null;
    while (Date.now() - startedAt < timeoutMs) {
        lastStatus = await fetchProxyStatus(host, port);
        const { readableRefs, unreadableRefs } = await readOciRefReadiness(host, port, refs);
        if (unreadableRefs.length === 0) {
            return {
                requestedRefs: refs,
                readableRefs,
                unreadableRefs,
                ready: true,
                phase: lastStatus?.phase,
                publishState: lastStatus?.publish_state,
                publishSettled: lastStatus?.publish_settled,
                tagsVisible: lastStatus?.tags_visible,
            };
        }
        await new Promise((resolve) => setTimeout(resolve, OCI_REF_READY_POLL_INTERVAL_MS));
    }
    const { readableRefs, unreadableRefs } = await readOciRefReadiness(host, port, refs);
    return {
        requestedRefs: refs,
        readableRefs,
        unreadableRefs,
        ready: unreadableRefs.length === 0,
        phase: lastStatus?.phase,
        publishState: lastStatus?.publish_state,
        publishSettled: lastStatus?.publish_settled,
        tagsVisible: lastStatus?.tags_visible,
    };
}
export function logOciImportReadiness(readiness) {
    if (readiness.ready) {
        core.info(`BoringCache managed cache import refs are readable: ${readiness.readableRefs.join(', ')}`);
        return;
    }
    const statusSuffix = [
        readiness.phase ? `phase=${readiness.phase}` : '',
        readiness.publishState ? `publish=${readiness.publishState}` : '',
        typeof readiness.publishSettled === 'boolean'
            ? `publish_settled=${readiness.publishSettled}`
            : '',
        typeof readiness.tagsVisible === 'boolean'
            ? `tags_visible=${readiness.tagsVisible}`
            : '',
    ]
        .filter(Boolean)
        .join(' ');
    const message = `BoringCache managed cache became ready before planned restore refs were fully readable. readable=[${readiness.readableRefs.join(', ')}] unreadable=[${readiness.unreadableRefs.join(', ')}]${statusSuffix ? ` ${statusSuffix}` : ''}`;
    if (readiness.readableRefs.length === 0) {
        core.notice(`${message}. Continuing without cache imports; this is expected for cold seed jobs.`);
        return;
    }
    core.warning(message);
}
export function assertOciImportReady(readiness) {
    if (readiness.ready) {
        return;
    }
    if (readiness.readableRefs.length === 0) {
        throw new Error(`No managed cache import refs were readable. requested=[${readiness.requestedRefs.join(', ')}]`);
    }
    throw new Error(`Some managed cache import refs were unreadable. readable=[${readiness.readableRefs.join(', ')}] unreadable=[${readiness.unreadableRefs.join(', ')}]`);
}
/**
 * Start the BoringCache proxy.
 * Spawns a detached boringcache process, writes PID file, returns handle.
 */
export async function startRegistryProxy(options) {
    const { restoreToken, stageToken, saveToken } = getAuthTokens();
    if (options.readOnly && options.stage) {
        throw new Error('Proxy stage cannot be combined with read-only mode.');
    }
    let effectiveReadOnly = options.readOnly === true;
    const requestedStage = options.stage === true;
    let effectiveStage = requestedStage;
    let authToken = effectiveReadOnly
        ? restoreToken
        : effectiveStage
            ? stageToken
            : saveToken;
    if (!authToken && !effectiveReadOnly && restoreToken) {
        effectiveReadOnly = true;
        effectiveStage = false;
        authToken = restoreToken;
        core.info(`No ${requestedStage ? 'stage' : 'save'}-capable token configured; starting the runner-local cache in read-only mode with BORINGCACHE_RESTORE_TOKEN`);
    }
    if (!authToken) {
        if (effectiveReadOnly) {
            throw new Error(`${missingRestoreTokenMessage()} This is required for proxy mode.`);
        }
        throw new Error(`${effectiveStage ? missingStageTokenMessage() : missingSaveTokenMessage()} This is required for proxy mode.`);
    }
    const host = options.host || '127.0.0.1';
    const cliCommand = 'cache-registry';
    const normalizedTags = normalizeProxyTags(options.tag);
    const readyFile = proxyReadyFilePath(options.port);
    if (await isProxyRunning(host, options.port)) {
        core.info(`BoringCache proxy already running on port ${options.port}, reusing`);
        try {
            const pid = parseInt(fs.readFileSync(PROXY_PID_FILE, 'utf-8').trim(), 10);
            if (pid > 0)
                return { pid, port: options.port, readOnly: effectiveReadOnly };
        }
        catch { }
        return { pid: -1, port: options.port, readOnly: effectiveReadOnly };
    }
    clearProxyReadyFile(readyFile);
    const args = [cliCommand, options.workspace, normalizedTags];
    if (options.noGit) {
        args.push('--no-git');
    }
    if (options.noPlatform) {
        args.push('--no-platform');
    }
    args.push('--host', host, '--port', String(options.port));
    args.push('--ready-file', readyFile);
    if (options.onDemand) {
        args.push('--on-demand');
    }
    else if (options.startupMode?.trim()) {
        args.push('--startup-mode', options.startupMode.trim());
    }
    if (options.warmupStrategy?.trim()) {
        args.push('--warmup-strategy', options.warmupStrategy.trim());
    }
    for (const ref of options.ociPrefetchRefs || []) {
        const trimmed = ref.trim();
        if (trimmed) {
            args.push('--oci-prefetch-ref', trimmed);
        }
    }
    for (const ref of options.ociAliasPromotionRefs || []) {
        const trimmed = ref.trim();
        if (trimmed) {
            args.push('--oci-alias-promotion-ref', trimmed);
        }
    }
    for (const digest of options.candidateDigests || []) {
        const trimmed = digest.trim();
        if (trimmed) {
            args.push('--candidate-digest', trimmed);
        }
    }
    const ociHydration = (options.ociHydration || DEFAULT_OCI_HYDRATION_POLICY).trim();
    if (ociHydration) {
        args.push('--oci-hydration', ociHydration);
    }
    for (const [key, value] of Object.entries(options.metadataHints || {})) {
        args.push('--metadata-hint', `${key}=${value}`);
    }
    if (options.xcodeSocket?.trim()) {
        args.push('--xcode-socket', options.xcodeSocket.trim());
    }
    if (options.xcodeUpstreamPlugin?.trim()) {
        args.push('--xcode-upstream-plugin', options.xcodeUpstreamPlugin.trim());
    }
    if (options.xcodeCasPath?.trim()) {
        args.push('--xcode-cas-path', options.xcodeCasPath.trim());
    }
    if (options.xcodeEvidenceJson?.trim()) {
        args.push('--xcode-evidence-json', options.xcodeEvidenceJson.trim());
    }
    if (effectiveStage) {
        args.push('--stage');
    }
    else if (effectiveReadOnly) {
        args.push('--read-only');
    }
    const strictCacheErrors = options.failOnCacheError ?? !effectiveReadOnly;
    if (strictCacheErrors) {
        args.push('--fail-on-cache-error');
    }
    if (options.verbose) {
        args.push('--verbose');
    }
    core.info(`Starting BoringCache proxy on ${host}:${options.port}...`);
    const logFile = proxyLogPath(options.port);
    const logFd = fs.openSync(logFile, 'w');
    const child = spawn('boringcache', args, {
        detached: true,
        stdio: ['ignore', logFd, logFd],
        env: {
            ...process.env,
        }
    });
    child.unref();
    fs.closeSync(logFd);
    if (!child.pid) {
        throw new Error('Failed to start BoringCache proxy');
    }
    fs.writeFileSync(PROXY_PID_FILE, String(child.pid));
    core.info(`BoringCache proxy started (PID: ${child.pid})`);
    const handle = { pid: child.pid, port: options.port, readOnly: effectiveReadOnly };
    try {
        await waitForProxyReadyFile(readyFile, PROXY_READY_TIMEOUT_MS, options.port, child.pid);
        if (options.ociRequiredReadableRefs?.length) {
            const ociImportReadiness = await waitForOciImportReadiness(host, options.port, options.ociRequiredReadableRefs, options.ociImportReadyTimeoutMs);
            logOciImportReadiness(ociImportReadiness);
            if (options.requireOciImportReady) {
                assertOciImportReady(ociImportReadiness);
            }
            return {
                ...handle,
                ociImportReadiness,
            };
        }
        if (options.requireOciImportReady) {
            throw new Error('No managed cache import refs were requested while strict import readiness was enabled.');
        }
        return handle;
    }
    catch (error) {
        try {
            await stopRegistryProxy(child.pid, options.port);
        }
        catch {
            // Keep the original readiness failure as the primary error.
        }
        clearProxyReadyFile(readyFile);
        throw error;
    }
}
/**
 * Graceful stop: send SIGTERM and wait for the proxy to exit on its own.
 * The proxy handles SIGTERM by flushing all pending blobs to the backend,
 * then exits. Never send SIGKILL — the proxy owns its own shutdown timing.
 */
export async function stopRegistryProxy(pid, port) {
    if (pid <= 0) {
        core.info('No proxy PID to stop (was reused from another invocation)');
        return;
    }
    core.info(`Stopping BoringCache proxy (PID: ${pid})...`);
    try {
        process.kill(pid, 'SIGTERM');
    }
    catch (err) {
        const code = err.code;
        if (code === 'ESRCH') {
            core.info(`BoringCache proxy (PID: ${pid}) already exited`);
            return;
        }
        core.warning(`Failed to send SIGTERM to BoringCache proxy: ${err.message}`);
        return;
    }
    const start = Date.now();
    const pollInterval = 1000;
    const logInterval = 30_000;
    let lastLog = start;
    while (true) {
        if (!isProcessAlive(pid)) {
            if (port) {
                const logs = readProxyLogs(port);
                const shutdownTimeout = logs.match(/Shutdown: flush timeout reached[^\n]*/i);
                const checkpointTimeout = logs.match(/Shutdown: checkpoint promotion timeout reached[^\n]*/i);
                const shutdownError = logs.match(/Error:\s+[^\n]*(pending entries|checkpoint|cache publish)[^\n]*/i);
                const failure = shutdownTimeout || checkpointTimeout || shutdownError;
                if (failure) {
                    throw new Error(`BoringCache proxy shutdown failed: ${failure[0]}`);
                }
            }
            core.info(`BoringCache proxy exited gracefully after ${Math.round((Date.now() - start) / 1000)}s`);
            return;
        }
        const now = Date.now();
        if (now - lastLog >= logInterval) {
            core.info(`Waiting for BoringCache proxy to flush and exit... (${Math.round((now - start) / 1000)}s elapsed)`);
            lastLog = now;
        }
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
}
/**
 * Bind to port 0 and return the assigned port.
 */
export async function findAvailablePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            if (addr && typeof addr !== 'string') {
                const port = addr.port;
                server.close(() => resolve(port));
            }
            else {
                server.close(() => reject(new Error('Failed to get port')));
            }
        });
        server.on('error', reject);
    });
}
