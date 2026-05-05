import * as core from '@actions/core';
import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import {
  getAuthTokens,
  missingRestoreTokenMessage,
  missingSaveTokenMessage,
  warnIfUsingLegacyApiToken,
} from './auth';

export interface ProxyOptions {
  command: 'cache-registry';
  workspace: string;
  tag: string;
  host?: string;
  port: number;
  noGit?: boolean;
  noPlatform?: boolean;
  verbose?: boolean;
  readOnly?: boolean;
  onDemand?: boolean;
  ociPrefetchRefs?: string[];
  ociAliasPromotionRefs?: string[];
  ociRequiredReadableRefs?: string[];
  requireOciImportReady?: boolean;
  ociHydration?: string;
  metadataHints?: Record<string, string>;
}

export interface OciImportReadiness {
  requestedRefs: string[];
  readableRefs: string[];
  unreadableRefs: string[];
  ready: boolean;
  phase?: string;
  publishState?: string;
  publishSettled?: boolean;
  tagsVisible?: boolean;
}

export interface ProxyHandle {
  pid: number;
  port: number;
  readOnly: boolean;
  ociImportReadiness?: OciImportReadiness;
}

const PROXY_PID_FILE = path.join(os.tmpdir(), 'boringcache-proxy.pid');
const PROXY_READY_TIMEOUT_MS = 300000;
const PROXY_READY_POLL_INTERVAL_MS = 200;
const PROXY_READY_WARN_INTERVAL_MS = 10000;
const OCI_IMPORT_READY_TIMEOUT_MS = 15000;
const OCI_IMPORT_READY_POLL_INTERVAL_MS = 1000;
const OCI_REF_READY_POLL_INTERVAL_MS = 1000;
const DEFAULT_OCI_HYDRATION_POLICY = 'metadata-only';

export function normalizeProxyTags(tagInput: string): string {
  const tags: string[] = [];
  const seen = new Set<string>();

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

function proxyProbeHost(host: string): string {
  return host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
}

async function isProxyRunning(host: string, port: number): Promise<boolean> {
  const probeHost = proxyProbeHost(host);
  return await new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host: probeHost, port });
    let settled = false;

    const finish = (value: boolean): void => {
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

function proxyReadyFilePath(port: number): string {
  return path.join(os.tmpdir(), `boringcache-proxy-${port}.ready`);
}

function clearProxyReadyFile(readyFile: string): void {
  try {
    fs.unlinkSync(readyFile);
  } catch {
    // Ignore missing or inaccessible ready markers; startup will recreate them.
  }
}

async function waitForProxyReadyFile(
  readyFile: string,
  timeoutMs = PROXY_READY_TIMEOUT_MS,
  port?: number,
  pid?: number,
): Promise<void> {
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

interface ProxyStatusResponse {
  phase?: string;
  publish_state?: string;
  publish_settled?: boolean;
  tags_visible?: boolean;
}

function httpRequest(
  options: http.RequestOptions,
): Promise<{ statusCode: number; body: string }> {
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

async function fetchProxyStatus(host: string, port: number): Promise<ProxyStatusResponse | null> {
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
    return JSON.parse(response.body) as ProxyStatusResponse;
  } catch {
    return null;
  }
}

async function isManifestReadable(host: string, port: number, ref: string): Promise<boolean> {
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
  } catch {
    return false;
  }
}

async function readOciRefReadiness(
  host: string,
  port: number,
  refs: string[],
): Promise<Pick<OciImportReadiness, 'readableRefs' | 'unreadableRefs'>> {
  const readability = await Promise.all(
    refs.map(async (ref) => ({ ref, readable: await isManifestReadable(host, port, ref) })),
  );

  return {
    readableRefs: readability.filter((entry) => entry.readable).map((entry) => entry.ref),
    unreadableRefs: readability.filter((entry) => !entry.readable).map((entry) => entry.ref),
  };
}

export async function waitForOciImportReadiness(
  host: string,
  port: number,
  requestedRefs: string[],
  timeoutMs = OCI_IMPORT_READY_TIMEOUT_MS,
): Promise<OciImportReadiness> {
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
  let lastStatus: ProxyStatusResponse | null = null;

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

export async function waitForOciRefsReadable(
  host: string,
  port: number,
  requestedRefs: string[],
  timeoutMs = 60_000,
): Promise<OciImportReadiness> {
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
  let lastStatus: ProxyStatusResponse | null = null;

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

export function logOciImportReadiness(readiness: OciImportReadiness): void {
  if (readiness.ready) {
    core.info(
      `BoringCache proxy OCI import refs are readable: ${readiness.readableRefs.join(', ')}`,
    );
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
  const message = `BoringCache proxy became ready before OCI import refs were fully readable. readable=[${readiness.readableRefs.join(', ')}] unreadable=[${readiness.unreadableRefs.join(', ')}]${statusSuffix ? ` ${statusSuffix}` : ''}`;

  if (readiness.readableRefs.length === 0) {
    core.notice(`${message}. Continuing without registry imports; this is expected for cold seed jobs.`);
    return;
  }

  core.warning(message);
}

export function assertOciImportReady(readiness: OciImportReadiness): void {
  if (readiness.ready) {
    return;
  }

  if (readiness.readableRefs.length === 0) {
    throw new Error(
      `No OCI cache import refs were readable. requested=[${readiness.requestedRefs.join(', ')}]`,
    );
  }

  throw new Error(
    `Some OCI cache import refs were unreadable. readable=[${readiness.readableRefs.join(', ')}] unreadable=[${readiness.unreadableRefs.join(', ')}]`,
  );
}

/**
 * Start the BoringCache proxy.
 * Spawns a detached boringcache process, writes PID file, returns handle.
 */
export async function startRegistryProxy(options: ProxyOptions): Promise<ProxyHandle> {
  warnIfUsingLegacyApiToken();
  const { restoreToken, saveToken } = getAuthTokens();

  let effectiveReadOnly = options.readOnly === true;
  let authToken = effectiveReadOnly ? restoreToken : saveToken;

  if (!authToken && !effectiveReadOnly && restoreToken) {
    effectiveReadOnly = true;
    authToken = restoreToken;
    core.info(
      'No save-capable token configured; starting cache-registry in read-only mode with BORINGCACHE_RESTORE_TOKEN'
    );
  }

  if (!authToken) {
    if (effectiveReadOnly) {
      throw new Error(`${missingRestoreTokenMessage()} This is required for proxy mode.`);
    }
    throw new Error(`${missingSaveTokenMessage()} This is required for proxy mode.`);
  }

  const host = options.host || '127.0.0.1';
  const cliCommand = 'cache-registry';
  const normalizedTags = normalizeProxyTags(options.tag);
  const readyFile = proxyReadyFilePath(options.port);

  if (await isProxyRunning(host, options.port)) {
    core.info(`BoringCache proxy already running on port ${options.port}, reusing`);
    try {
      const pid = parseInt(fs.readFileSync(PROXY_PID_FILE, 'utf-8').trim(), 10);
      if (pid > 0) return { pid, port: options.port, readOnly: effectiveReadOnly };
    } catch {}
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
  for (const ref of options.ociAliasPromotionRefs || []) {
    const trimmed = ref.trim();
    if (trimmed) {
      args.push('--oci-alias-promotion-ref', trimmed);
    }
  }
  const ociHydration = (options.ociHydration || DEFAULT_OCI_HYDRATION_POLICY).trim();
  if (ociHydration) {
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

  core.info(`Starting BoringCache proxy on ${host}:${options.port}...`);
  const logFile = proxyLogPath(options.port);
  const logFd = fs.openSync(logFile, 'w');
  const child: ChildProcess = spawn('boringcache', args, {
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
    throw new Error('Failed to start BoringCache proxy');
  }

  fs.writeFileSync(PROXY_PID_FILE, String(child.pid));
  core.info(`BoringCache proxy started (PID: ${child.pid})`);
  const handle = { pid: child.pid, port: options.port, readOnly: effectiveReadOnly };

  try {
    await waitForProxyReadyFile(readyFile, PROXY_READY_TIMEOUT_MS, options.port, child.pid);
    if (options.ociRequiredReadableRefs?.length) {
      const ociImportReadiness = await waitForOciImportReadiness(
        host,
        options.port,
        options.ociRequiredReadableRefs,
      );

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
      throw new Error('No OCI cache import refs were requested while require-oci-import-ready was enabled.');
    }

    return handle;
  } catch (error) {
    try {
      await stopRegistryProxy(child.pid);
    } catch {
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
export async function stopRegistryProxy(pid: number): Promise<void> {
  if (pid <= 0) {
    core.info('No proxy PID to stop (was reused from another invocation)');
    return;
  }

  core.info(`Stopping BoringCache proxy (PID: ${pid})...`);

  try {
    process.kill(pid, 'SIGTERM');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ESRCH') {
      core.info(`BoringCache proxy (PID: ${pid}) already exited`);
      return;
    }
    core.warning(`Failed to send SIGTERM to BoringCache proxy: ${(err as Error).message}`);
    return;
  }

  const start = Date.now();
  const pollInterval = 1000;
  const logInterval = 30_000;
  let lastLog = start;
  while (true) {
    if (!isProcessAlive(pid)) {
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
export async function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr !== 'string') {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error('Failed to get port')));
      }
    });
    server.on('error', reject);
  });
}
