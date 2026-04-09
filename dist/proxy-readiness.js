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
exports.waitForRegistryProxyReady = waitForRegistryProxyReady;
const core = __importStar(require("@actions/core"));
const fs = __importStar(require("fs"));
const http = __importStar(require("http"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const action_core_1 = require("@boringcache/action-core");
const PROXY_PREFETCH_STATE_HEADER = 'x-boringcache-prefetch-state';
const PROXY_PREFETCH_STATE_READY = 'ready';
const PROXY_PREFETCH_STATE_WARMING = 'warming';
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
async function probeProxyReadiness(port) {
    try {
        return await new Promise((resolve) => {
            const req = http.get(`http://127.0.0.1:${port}/v2/`, (res) => {
                var _a;
                const header = res.headers[PROXY_PREFETCH_STATE_HEADER];
                const state = Array.isArray(header) ? (_a = header[0]) !== null && _a !== void 0 ? _a : null : header !== null && header !== void 0 ? header : null;
                res.resume();
                if (res.statusCode === 401) {
                    resolve({ ready: true, state: 'unauthorized' });
                    return;
                }
                if (res.statusCode === 200) {
                    if (!state) {
                        resolve({ ready: true, state: null });
                        return;
                    }
                    resolve({
                        ready: state.toLowerCase() === PROXY_PREFETCH_STATE_READY,
                        state,
                    });
                    return;
                }
                resolve({ ready: false, state });
            });
            req.on('error', () => resolve({ ready: false, state: null }));
            req.setTimeout(1000, () => {
                req.destroy();
                resolve({ ready: false, state: null });
            });
        });
    }
    catch {
        return { ready: false, state: null };
    }
}
async function waitForRegistryProxyReady(port, timeoutMs = 300000, pid) {
    const startedAt = Date.now();
    await (0, action_core_1.waitForProxy)(port, timeoutMs, pid);
    const remainingTimeoutMs = Math.max(0, timeoutMs - (Date.now() - startedAt));
    if (remainingTimeoutMs === 0) {
        return;
    }
    const interval = 500;
    const headerWaitStartedAt = Date.now();
    let lastLogAt = 0;
    let lastState = null;
    while (Date.now() - headerWaitStartedAt < remainingTimeoutMs) {
        if (pid && pid > 0 && !isProcessAlive(pid)) {
            const logs = readProxyLogs(port);
            throw new Error(`Registry proxy exited before startup prefetch completed${logs ? `:\n${logs}` : ''}`);
        }
        const probe = await probeProxyReadiness(port);
        lastState = probe.state;
        if (probe.ready) {
            return;
        }
        const elapsed = Date.now() - headerWaitStartedAt;
        if (elapsed - lastLogAt >= 10000) {
            const suffix = (lastState === null || lastState === void 0 ? void 0 : lastState.toLowerCase()) === PROXY_PREFETCH_STATE_WARMING
                ? ', prefetch warming'
                : '';
            core.info(`Waiting for proxy startup prefetch... (${(elapsed / 1000).toFixed(0)}s${suffix})`);
            lastLogAt = elapsed;
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
    }
    const logs = readProxyLogs(port);
    throw new Error(`Registry proxy responded before startup prefetch was ready within ${remainingTimeoutMs}ms${logs ? `:\n${logs}` : ''}`);
}
