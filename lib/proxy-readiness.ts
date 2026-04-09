import * as core from '@actions/core';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { waitForProxy } from '@boringcache/action-core';

const PROXY_PREFETCH_STATE_HEADER = 'x-boringcache-prefetch-state';
const PROXY_PREFETCH_STATE_READY = 'ready';
const PROXY_PREFETCH_STATE_WARMING = 'warming';

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function proxyLogPath(port: number): string {
  return path.join(os.tmpdir(), `boringcache-proxy-${port}.log`);
}

function readProxyLogs(port: number): string {
  try {
    return fs.readFileSync(proxyLogPath(port), 'utf-8').trim();
  } catch {
    return '';
  }
}

interface ProxyReadinessProbe {
  ready: boolean;
  state: string | null;
}

async function probeProxyReadiness(port: number): Promise<ProxyReadinessProbe> {
  try {
    return await new Promise<ProxyReadinessProbe>((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/v2/`, (res) => {
        const header = res.headers[PROXY_PREFETCH_STATE_HEADER];
        const state = Array.isArray(header) ? header[0] ?? null : header ?? null;
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
  } catch {
    return { ready: false, state: null };
  }
}

export async function waitForRegistryProxyReady(
  port: number,
  timeoutMs = 300000,
  pid?: number,
): Promise<void> {
  const startedAt = Date.now();
  await waitForProxy(port, timeoutMs, pid);

  const remainingTimeoutMs = Math.max(0, timeoutMs - (Date.now() - startedAt));
  if (remainingTimeoutMs === 0) {
    return;
  }

  const interval = 500;
  const headerWaitStartedAt = Date.now();
  let lastLogAt = 0;
  let lastState: string | null = null;

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
      const suffix = lastState?.toLowerCase() === PROXY_PREFETCH_STATE_WARMING
        ? ', prefetch warming'
        : '';
      core.info(`Waiting for proxy startup prefetch... (${(elapsed / 1000).toFixed(0)}s${suffix})`);
      lastLogAt = elapsed;
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  const logs = readProxyLogs(port);
  throw new Error(
    `Registry proxy responded before startup prefetch was ready within ${remainingTimeoutMs}ms${logs ? `:\n${logs}` : ''}`,
  );
}
