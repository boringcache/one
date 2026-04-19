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
exports.normalizeProxyTags = normalizeProxyTags;
exports.startRegistryProxy = startRegistryProxy;
exports.stopRegistryProxy = stopRegistryProxy;
exports.findAvailablePort = findAvailablePort;
const core = __importStar(require("@actions/core"));
const fs = __importStar(require("fs"));
const net = __importStar(require("net"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const auth_1 = require("./auth");
const PROXY_PID_FILE = path.join(os.tmpdir(), 'boringcache-proxy.pid');
const PROXY_READY_TIMEOUT_MS = 300000;
const PROXY_READY_POLL_INTERVAL_MS = 200;
const PROXY_READY_WARN_INTERVAL_MS = 10000;
function normalizeProxyTags(tagInput) {
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
            core.info(`Registry proxy is ready (${elapsed}s)`);
            clearProxyReadyFile(readyFile);
            return;
        }
        if (pid && pid > 0 && !isProcessAlive(pid)) {
            const logs = port ? readProxyLogs(port) : '';
            throw new Error(`Registry proxy exited before becoming ready${logs ? `:\n${logs}` : ''}`);
        }
        const elapsed = Date.now() - start;
        if (elapsed - lastLogAt >= PROXY_READY_WARN_INTERVAL_MS) {
            core.info(`Waiting for proxy readiness... (${(elapsed / 1000).toFixed(0)}s)`);
            lastLogAt = elapsed;
        }
        await new Promise((resolve) => setTimeout(resolve, PROXY_READY_POLL_INTERVAL_MS));
    }
    const logs = port ? readProxyLogs(port) : '';
    throw new Error(`Registry proxy did not become ready within ${timeoutMs}ms${logs ? `:\n${logs}` : ''}`);
}
/**
 * Start the cache-registry proxy.
 * Spawns a detached boringcache process, writes PID file, returns handle.
 */
async function startRegistryProxy(options) {
    var _a;
    (0, auth_1.warnIfUsingLegacyApiToken)();
    const { restoreToken, saveToken } = (0, auth_1.getAuthTokens)();
    let effectiveReadOnly = options.readOnly === true;
    let authToken = effectiveReadOnly ? restoreToken : saveToken;
    if (!authToken && !effectiveReadOnly && restoreToken) {
        effectiveReadOnly = true;
        authToken = restoreToken;
        core.info('No save-capable token configured; starting cache-registry in read-only mode with BORINGCACHE_RESTORE_TOKEN');
    }
    if (!authToken) {
        if (effectiveReadOnly) {
            throw new Error(`${(0, auth_1.missingRestoreTokenMessage)()} This is required for registry proxy mode.`);
        }
        throw new Error(`${(0, auth_1.missingSaveTokenMessage)()} This is required for registry proxy mode.`);
    }
    const host = options.host || '127.0.0.1';
    const cliCommand = 'cache-registry';
    const normalizedTags = normalizeProxyTags(options.tag);
    const tagList = normalizedTags.split(',');
    const primaryTag = tagList[0];
    const readyFile = proxyReadyFilePath(options.port);
    if (await isProxyRunning(host, options.port)) {
        core.info(`Registry proxy already running on port ${options.port}, reusing`);
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
    for (const ref of options.ociPrefetchRefs || []) {
        const trimmed = ref.trim();
        if (trimmed) {
            args.push('--oci-prefetch-ref', trimmed);
        }
    }
    const ociHydration = (options.ociHydration || 'metadata-only').trim();
    if (ociHydration && ociHydration !== 'metadata-only') {
        args.push('--oci-hydration', ociHydration);
    }
    for (const [key, value] of Object.entries(options.metadataHints || {})) {
        args.push('--metadata-hint', `${key}=${value}`);
    }
    if (effectiveReadOnly) {
        args.push('--read-only');
    }
    if (options.verbose) {
        args.push('--verbose');
    }
    core.info(`Starting registry proxy on ${host}:${options.port}...`);
    core.info(`Registry proxy primary tag: ${primaryTag}`);
    if (tagList.length > 1) {
        core.info(`Registry proxy alias tags: ${tagList.slice(1).join(', ')}`);
    }
    if (effectiveReadOnly) {
        core.info('Registry proxy mode: read-only');
    }
    core.info(`Registry proxy startup: ${options.onDemand ? 'on-demand' : 'warm'}`);
    if ((_a = options.ociPrefetchRefs) === null || _a === void 0 ? void 0 : _a.length) {
        core.info(`Registry proxy OCI prefetch refs: ${options.ociPrefetchRefs.join(', ')}`);
    }
    if (ociHydration !== 'metadata-only') {
        core.info(`Registry proxy OCI hydration: ${ociHydration}`);
    }
    const logFile = proxyLogPath(options.port);
    const logFd = fs.openSync(logFile, 'w');
    const child = (0, child_process_1.spawn)('boringcache', args, {
        detached: true,
        stdio: ['ignore', logFd, logFd],
        env: {
            ...process.env,
            BORINGCACHE_API_TOKEN: authToken,
        }
    });
    child.unref();
    fs.closeSync(logFd);
    if (!child.pid) {
        throw new Error('Failed to start registry proxy');
    }
    fs.writeFileSync(PROXY_PID_FILE, String(child.pid));
    core.info(`Registry proxy started (PID: ${child.pid})`);
    const handle = { pid: child.pid, port: options.port, readOnly: effectiveReadOnly };
    try {
        await waitForProxyReadyFile(readyFile, PROXY_READY_TIMEOUT_MS, options.port, child.pid);
        return handle;
    }
    catch (error) {
        try {
            await stopRegistryProxy(child.pid);
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
async function stopRegistryProxy(pid) {
    if (pid <= 0) {
        core.info('No proxy PID to stop (was reused from another invocation)');
        return;
    }
    core.info(`Stopping registry proxy (PID: ${pid})...`);
    try {
        process.kill(pid, 'SIGTERM');
    }
    catch (err) {
        const code = err.code;
        if (code === 'ESRCH') {
            core.info(`Registry proxy (PID: ${pid}) already exited`);
            return;
        }
        core.warning(`Failed to send SIGTERM to registry proxy: ${err.message}`);
        return;
    }
    const start = Date.now();
    const pollInterval = 1000;
    const logInterval = 30000;
    let lastLog = start;
    while (true) {
        if (!isProcessAlive(pid)) {
            core.info(`Registry proxy exited gracefully after ${Math.round((Date.now() - start) / 1000)}s`);
            return;
        }
        const now = Date.now();
        if (now - lastLog >= logInterval) {
            core.info(`Waiting for registry proxy to flush and exit... (${Math.round((now - start) / 1000)}s elapsed)`);
            lastLog = now;
        }
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
}
/**
 * Bind to port 0 and return the assigned port.
 */
async function findAvailablePort() {
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
