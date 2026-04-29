import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';

const mockEnsureBoringCache = jest.fn();
const mockExecBoringCache = jest.fn();
const mockInstallMise = jest.fn();
const mockInstallMiseTool = jest.fn();
const mockActivateMiseTool = jest.fn();
const mockHasMiseToolVersion = jest.fn();
const mockHasToolVersionOnPath = jest.fn();
const mockExportMiseEnv = jest.fn();
const mockReshimMise = jest.fn();
const mockReadProjectMiseTools = jest.fn();
const mockReadMiseTomlVersion = jest.fn();
const mockReadToolVersionsValue = jest.fn();
const mockStartRegistryProxy = jest.fn();
const mockStopRegistryProxy = jest.fn();
const mockFindAvailablePort = jest.fn();

jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  getBooleanInput: jest.fn(),
  getState: jest.fn(),
  isDebug: jest.fn().mockReturnValue(false),
  group: jest.fn(async (_title: string, fn: () => Promise<void>) => fn()),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  setSecret: jest.fn(),
  info: jest.fn(),
  notice: jest.fn(),
  warning: jest.fn(),
  debug: jest.fn(),
  addPath: jest.fn(),
  exportVariable: jest.fn(),
  saveState: jest.fn(),
}));

jest.mock('@actions/exec', () => ({
  exec: jest.fn(),
}));

jest.mock('@actions/cache', () => ({
  restoreCache: jest.fn().mockResolvedValue(null),
  saveCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@actions/tool-cache', () => ({
  find: jest.fn().mockReturnValue('/mock/tool-cache'),
  cacheDir: jest.fn().mockResolvedValue('/mock/tool-cache'),
  downloadTool: jest.fn().mockResolvedValue('/tmp/mock-download'),
  extractTar: jest.fn().mockResolvedValue('/tmp/mock-extract'),
  extractZip: jest.fn().mockResolvedValue('/tmp/mock-extract'),
}));

jest.mock('../lib/core', () => {
  const actual = jest.requireActual('../lib/core');
  return {
    ...actual,
    ensureBoringCache: mockEnsureBoringCache,
    execBoringCache: mockExecBoringCache,
    installMise: mockInstallMise,
    installMiseTool: mockInstallMiseTool,
    activateMiseTool: mockActivateMiseTool,
    hasMiseToolVersion: mockHasMiseToolVersion,
    hasToolVersionOnPath: mockHasToolVersionOnPath,
    exportMiseEnv: mockExportMiseEnv,
    reshimMise: mockReshimMise,
    readProjectMiseTools: mockReadProjectMiseTools,
    readMiseTomlVersion: mockReadMiseTomlVersion,
    readToolVersionsValue: mockReadToolVersionsValue,
    startRegistryProxy: mockStartRegistryProxy,
    stopRegistryProxy: mockStopRegistryProxy,
    findAvailablePort: mockFindAvailablePort,
  };
});

const originalEnv = process.env;

interface CliDryRunArchiveEntry {
  requested: string;
  request_source: 'profile' | 'entry' | 'command-inferred' | 'archive-path' | 'manual';
  profile?: string;
  resolution_source: 'repo-config' | 'built-in' | 'manual';
  resolved_tag?: string;
  tag: string;
  path?: string;
  tag_path_pair: string;
}

interface CliDryRunArchiveRestoreCandidate {
  tag_prefix: string;
  tag_path_pairs: string[];
}

interface CliDryRunPlan {
  workspace: string;
  workspace_source: 'explicit' | 'repo-config' | 'configured-default';
  repo_config_path?: string;
  tag_path_pairs: string[];
  archive_entries: CliDryRunArchiveEntry[];
  archive_restore_candidates?: CliDryRunArchiveRestoreCandidate[];
  env_vars: Record<string, string>;
}

interface BuiltInCliEntry {
  tag: string;
  path: string;
  envVars: Record<string, string>;
}

interface CliAdapterDryRunPlan {
  schema_version: number;
  adapter: string;
  workspace: string;
  workspace_source: 'explicit' | 'repo-config' | 'configured-default';
  repo_config_path?: string;
  tag: string;
  command: string[];
  archive_entries: CliDryRunArchiveEntry[];
  env_vars: Record<string, string>;
  setup?: {
    schema_version?: number;
    env_vars?: Record<string, string>;
    files?: Array<{
      path: string;
      mode: 'write' | 'append';
      content: string;
    }>;
    directories?: string[];
  };
  proxy: {
    host: string;
    endpoint_host: string;
    port: number;
    no_platform: boolean;
    no_git: boolean;
    read_only: boolean;
    startup_mode?: string;
    oci_prefetch_refs?: string[];
    oci_hydration?: string;
    metadata_hints: Record<string, string>;
  };
  oci_cache?: {
    registry_ref: string;
    cache_from: string;
    cache_from_refs?: string[];
    cache_to?: string;
    ref_tag: string;
    immutable_run_ref_tag?: string;
    cache_from_ref_tags?: string[];
    promotion_ref_tags?: string[];
    run_metadata?: {
      provider: string;
      run_uid: string;
      run_attempt?: string;
      source_ref_type?: string;
      source_ref_name?: string;
      run_started_at?: string;
    };
  };
}

interface RepoAdapterSettings {
  tag?: string;
  host?: string;
  endpointHost?: string;
  port?: number;
  noPlatform?: boolean;
  noGit?: boolean;
  readOnly?: boolean;
  cacheMode?: string;
  cacheRefTag?: string;
  sccacheKeyPrefix?: string;
}

function findRepoConfigPath(workingDirectory: string): string | null {
  let current = path.resolve(workingDirectory);

  while (true) {
    for (const fileName of ['.boringcache.toml', 'boringcache.toml']) {
      const candidate = path.join(current, fileName);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function readRepoConfigWorkspace(workingDirectory: string): { workspace: string | null; repoConfigPath: string | null } {
  const repoConfigPath = findRepoConfigPath(workingDirectory);
  if (!repoConfigPath) {
    return { workspace: null, repoConfigPath: null };
  }

  try {
    const contents = fs.readFileSync(repoConfigPath, 'utf8');
    const match = contents.match(/^\s*workspace\s*=\s*["']([^"']+)["']/m);
    return {
      workspace: match?.[1]?.trim() || null,
      repoConfigPath,
    };
  } catch {
    return { workspace: null, repoConfigPath };
  }
}

function readRepoAdapterSettings(workingDirectory: string, adapterName: string): RepoAdapterSettings {
  const repoConfigPath = findRepoConfigPath(workingDirectory);
  if (!repoConfigPath) {
    return {};
  }

  try {
    const contents = fs.readFileSync(repoConfigPath, 'utf8');
    const lines = contents.split(/\r?\n/);
    let inSection = false;
    const settings: RepoAdapterSettings = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^\[.+\]$/.test(trimmed)) {
        inSection = trimmed === `[adapters.${adapterName}]`;
        continue;
      }
      if (!inSection) {
        continue;
      }

      const tagMatch = trimmed.match(/^tag\s*=\s*["']([^"']+)["']$/);
      if (tagMatch?.[1]?.trim()) {
        settings.tag = tagMatch[1].trim();
        continue;
      }

      const stringSettingMatch = trimmed.match(/^(host|endpoint-host|endpoint_host|sccache-key-prefix|sccache_key_prefix)\s*=\s*["']([^"']+)["']$/);
      if (stringSettingMatch?.[2]?.trim()) {
        switch (stringSettingMatch[1]) {
          case 'host':
            settings.host = stringSettingMatch[2].trim();
            break;
          case 'endpoint-host':
          case 'endpoint_host':
            settings.endpointHost = stringSettingMatch[2].trim();
            break;
          case 'sccache-key-prefix':
          case 'sccache_key_prefix':
            settings.sccacheKeyPrefix = stringSettingMatch[2].trim();
            break;
          default:
            break;
        }
        continue;
      }

      const portMatch = trimmed.match(/^port\s*=\s*(\d+)$/);
      if (portMatch?.[1]) {
        settings.port = Number.parseInt(portMatch[1], 10);
        continue;
      }

      const boolMatch = trimmed.match(/^(no-platform|no_platform|no-git|no_git|read-only|read_only)\s*=\s*(true|false)$/);
      if (!boolMatch) {
        const stringMatch = trimmed.match(/^(cache-mode|cache_mode|cache-ref-tag|cache_ref_tag)\s*=\s*["']([^"']+)["']$/);
        if (!stringMatch?.[2]?.trim()) {
          continue;
        }
        switch (stringMatch[1]) {
          case 'cache-mode':
          case 'cache_mode':
            settings.cacheMode = stringMatch[2].trim();
            break;
          case 'cache-ref-tag':
          case 'cache_ref_tag':
            settings.cacheRefTag = stringMatch[2].trim();
            break;
          default:
            break;
        }
        continue;
      }
      const enabled = boolMatch[2] === 'true';
      switch (boolMatch[1]) {
        case 'no-platform':
        case 'no_platform':
          settings.noPlatform = enabled;
          break;
        case 'no-git':
        case 'no_git':
          settings.noGit = enabled;
          break;
        case 'read-only':
        case 'read_only':
          settings.readOnly = enabled;
          break;
        default:
          break;
      }
    }
    return settings;
  } catch {
    return {};
  }
}

function readComposerConfigValue(workingDirectory: string, key: 'cache-dir' | 'vendor-dir'): string | null {
  const composerJsonPath = path.join(workingDirectory, 'composer.json');
  if (!fs.existsSync(composerJsonPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(composerJsonPath, 'utf8')) as {
      config?: Record<string, unknown>;
    };
    const value = parsed.config?.[key];
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

function cliBuiltInEntry(workingDirectory: string, requested: string): BuiltInCliEntry {
  const canonical = requested === 'node-modules' ? 'node_modules' : requested;
  switch (canonical) {
    case 'bundler': {
      const bundlePath = resolveMockArchivePath(process.env.BUNDLE_PATH || 'vendor/bundle', workingDirectory);
      return {
        tag: 'bundler',
        path: bundlePath,
        envVars: { BUNDLE_PATH: bundlePath },
      };
    }
    case 'pnpm-store': {
      const storePath = resolveMockArchivePath(
        process.env.PNPM_STORE_DIR || process.env.NPM_CONFIG_STORE_DIR || '.pnpm-store',
        workingDirectory,
      );
      return {
        tag: 'pnpm-store',
        path: storePath,
        envVars: { PNPM_STORE_DIR: storePath, NPM_CONFIG_STORE_DIR: storePath },
      };
    }
    case 'yarn-cache': {
      const cachePath = resolveMockArchivePath(process.env.YARN_CACHE_FOLDER || '.yarn-cache', workingDirectory);
      return {
        tag: 'yarn-cache',
        path: cachePath,
        envVars: { YARN_CACHE_FOLDER: cachePath, YARN_ENABLE_GLOBAL_CACHE: 'false' },
      };
    }
    case 'npm-cache': {
      const cachePath = resolveMockArchivePath(
        process.env.npm_config_cache || process.env.NPM_CONFIG_CACHE || '.npm-cache',
        workingDirectory,
      );
      return {
        tag: 'npm-cache',
        path: cachePath,
        envVars: { npm_config_cache: cachePath, NPM_CONFIG_CACHE: cachePath },
      };
    }
    case 'node_modules':
      return {
        tag: 'node_modules',
        path: path.join(workingDirectory, 'node_modules'),
        envVars: {},
      };
    case 'uv-cache': {
      const cachePath = path.join(workingDirectory, process.env.UV_CACHE_DIR || '.uv-cache');
      return {
        tag: 'uv-cache',
        path: cachePath,
        envVars: { UV_CACHE_DIR: cachePath },
      };
    }
    case 'go-mod-cache': {
      const cachePath = path.join(workingDirectory, process.env.GOMODCACHE || '.go/pkg/mod');
      return {
        tag: 'go-mod-cache',
        path: cachePath,
        envVars: { GOMODCACHE: cachePath },
      };
    }
    case 'go-build-cache': {
      const cachePath = path.join(workingDirectory, process.env.GOCACHE || '.go/build-cache');
      return {
        tag: 'go-build-cache',
        path: cachePath,
        envVars: { GOCACHE: cachePath },
      };
    }
    case 'composer-cache': {
      const configured = process.env.COMPOSER_CACHE_DIR || readComposerConfigValue(workingDirectory, 'cache-dir') || '.composer-cache';
      const cachePath = path.isAbsolute(configured) ? configured : path.join(workingDirectory, configured);
      return {
        tag: 'composer-cache',
        path: cachePath,
        envVars: { COMPOSER_CACHE_DIR: cachePath },
      };
    }
    case 'vendor': {
      const configured = process.env.COMPOSER_VENDOR_DIR || readComposerConfigValue(workingDirectory, 'vendor-dir') || 'vendor';
      const vendorPath = path.isAbsolute(configured) ? configured : path.join(workingDirectory, configured);
      return {
        tag: 'vendor',
        path: vendorPath,
        envVars: { COMPOSER_VENDOR_DIR: vendorPath },
      };
    }
    case 'cargo-registry': {
      const cargoHome = process.env.CARGO_HOME || path.join(process.env.HOME || '/home/test', '.cargo');
      return {
        tag: 'cargo-registry',
        path: path.join(cargoHome, 'registry'),
        envVars: {},
      };
    }
    case 'cargo-git': {
      const cargoHome = process.env.CARGO_HOME || path.join(process.env.HOME || '/home/test', '.cargo');
      return {
        tag: 'cargo-git',
        path: path.join(cargoHome, 'git'),
        envVars: {},
      };
    }
    case 'cargo-bin': {
      const cargoHome = process.env.CARGO_HOME || path.join(process.env.HOME || '/home/test', '.cargo');
      return {
        tag: 'cargo-bin',
        path: path.join(cargoHome, 'bin'),
        envVars: {},
      };
    }
    case 'target':
      return {
        tag: 'target',
        path: path.join(workingDirectory, 'target'),
        envVars: { CARGO_INCREMENTAL: '0' },
      };
    case 'sccache':
    case 'sccache-dir': {
      const cachePath = process.env.SCCACHE_DIR || path.join(process.env.HOME || '/home/test', '.cache', 'sccache');
      return {
        tag: 'sccache',
        path: cachePath,
        envVars: { SCCACHE_DIR: cachePath },
      };
    }
    default:
      throw new Error(`Unexpected CLI dry-run entry request in test: ${requested}`);
  }
}

function mockNodePackageManagerCacheEntry(workingDirectory: string): string | null {
  const packageJsonPath = path.join(workingDirectory, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { packageManager?: unknown };
      if (typeof parsed.packageManager === 'string') {
        const packageManagerField = parsed.packageManager.trim();
        const atIndex = packageManagerField.lastIndexOf('@');
        if (atIndex > 0) {
          const name = packageManagerField.slice(0, atIndex).trim().toLowerCase();
          if (name === 'pnpm') {
            return 'pnpm-store';
          }
          if (name === 'yarn') {
            return 'yarn-cache';
          }
          if (name === 'npm') {
            return 'npm-cache';
          }
        }
      }
    } catch {
      // Fall through to lockfile detection.
    }
  }

  if (fs.existsSync(path.join(workingDirectory, 'pnpm-lock.yaml'))) {
    return 'pnpm-store';
  }
  if (fs.existsSync(path.join(workingDirectory, 'yarn.lock'))) {
    return 'yarn-cache';
  }
  if (
    fs.existsSync(path.join(workingDirectory, 'package-lock.json'))
    || fs.existsSync(path.join(workingDirectory, 'npm-shrinkwrap.json'))
    || fs.existsSync(packageJsonPath)
  ) {
    return 'npm-cache';
  }

  return null;
}

function mockNodePackageManagerEnvVars(workingDirectory: string): Record<string, string> {
  const entry = mockNodePackageManagerCacheEntry(workingDirectory);
  return entry ? cliBuiltInEntry(workingDirectory, entry).envVars : {};
}

function cliDryRunEntry(workingDirectory: string, requested: string): CliDryRunArchiveEntry {
  const canonical = requested === 'node-modules' ? 'node_modules' : requested;
  const entry = cliBuiltInEntry(workingDirectory, requested);

  return {
    requested: canonical,
    request_source: 'entry',
    resolution_source: 'built-in',
    resolved_tag: entry.tag,
    tag: entry.tag,
    path: entry.path,
    tag_path_pair: `${entry.tag}:${entry.path}`,
  };
}

function prefixMockArchiveTag(tag: string, prefix: string): string {
  const trimmedPrefix = prefix.trim();
  if (!trimmedPrefix || tag === trimmedPrefix || tag.startsWith(`${trimmedPrefix}-`)) {
    return tag;
  }
  return `${trimmedPrefix}-${tag}`;
}

function suffixMockArchiveTag(tag: string, suffix: string): string {
  const trimmedSuffix = suffix.trim();
  if (!trimmedSuffix || tag === trimmedSuffix || tag.endsWith(`-${trimmedSuffix}`)) {
    return tag;
  }
  return `${tag}-${trimmedSuffix}`;
}

function decorateMockGeneratedTag(tag: string, cacheTag: string, toolTagSuffix: string): string {
  if (!cacheTag.trim() && !toolTagSuffix.trim()) {
    return tag;
  }
  const normalizedTag = tag === 'node_modules' ? 'node-modules' : tag;
  return suffixMockArchiveTag(prefixMockArchiveTag(normalizedTag, cacheTag), toolTagSuffix);
}

function decorateMockManualTag(tag: string, cacheTag: string, toolTagSuffix: string): string {
  return suffixMockArchiveTag(prefixMockArchiveTag(tag, cacheTag), toolTagSuffix);
}

function decorateMockGeneratedEntry(
  entry: CliDryRunArchiveEntry,
  cacheTag: string,
  toolTagSuffix: string,
  workingDirectory: string,
): CliDryRunArchiveEntry {
  const tag = decorateMockGeneratedTag(entry.tag, cacheTag, toolTagSuffix);
  const pathSpec = entry.path && (cacheTag.trim() || toolTagSuffix.trim()) && path.isAbsolute(entry.path)
    ? path.relative(workingDirectory, entry.path) || '.'
    : entry.path;
  return {
    ...entry,
    resolved_tag: entry.tag,
    tag,
    tag_path_pair: pathSpec ? `${tag}:${pathSpec}` : tag,
  };
}

function mockArchivePlatformSuffix(noPlatform: boolean): string {
  if (noPlatform) {
    return '';
  }

  const platform = process.platform === 'darwin'
    ? 'darwin'
    : process.platform === 'win32'
      ? 'windows'
      : 'linux';
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  return `-${platform}-${arch}`;
}

function applyMockArchivePlatformSuffix(prefix: string, noPlatform: boolean): string {
  const trimmedPrefix = prefix.trim();
  if (!trimmedPrefix) {
    return '';
  }

  const suffix = mockArchivePlatformSuffix(noPlatform);
  if (!suffix || trimmedPrefix.endsWith(suffix)) {
    return trimmedPrefix;
  }
  return `${trimmedPrefix}${suffix}`;
}

function normalizeMockArchivePathSegment(segment: string): string {
  if (segment === '~') {
    return '';
  }

  const normalized = segment
    .trim()
    .replace(/^\.+/, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return normalized || 'path';
}

function buildMockArchivePathTag(pathInput: string): string {
  const segments = pathInput
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== '.')
    .map(normalizeMockArchivePathSegment)
    .filter(Boolean);

  if (segments.length === 0) {
    return 'path';
  }

  return segments.slice(-3).join('-');
}

function resolveMockArchivePath(pathInput: string, workingDirectory: string): string {
  const trimmed = pathInput.trim();
  const expanded = trimmed.startsWith('~/')
    ? path.join(process.env.HOME || '/home/test', trimmed.slice(2))
    : trimmed === '~'
      ? (process.env.HOME || '/home/test')
      : trimmed;

  return path.isAbsolute(expanded)
    ? expanded
    : path.join(workingDirectory, expanded);
}

function buildMockArchivePathEntries(
  workingDirectory: string,
  archivePaths: string[],
  tagPrefix: string,
): CliDryRunArchiveEntry[] {
  const seenTags = new Map<string, number>();

  return archivePaths.map((archivePath) => {
    const trimmedPath = archivePath.trim();
    const tagBase = `${tagPrefix}-${buildMockArchivePathTag(trimmedPath)}`;
    const seenCount = seenTags.get(tagBase) || 0;
    seenTags.set(tagBase, seenCount + 1);
    const tag = seenCount === 0 ? tagBase : `${tagBase}-${seenCount + 1}`;
    const resolvedPath = resolveMockArchivePath(trimmedPath, workingDirectory);

    return {
      requested: trimmedPath,
      request_source: 'archive-path',
      resolution_source: 'manual',
      tag,
      path: resolvedPath,
      tag_path_pair: `${tag}:${resolvedPath}`,
    };
  });
}

function parseMockManualTagPathPair(pair: string): { tag: string; path?: string } {
  const separator = pair.indexOf(':');
  if (separator < 0) {
    return { tag: pair.trim() };
  }

  const tag = pair.slice(0, separator).trim();
  const path = pair.slice(separator + 1).trim();
  return {
    tag,
    path: path || undefined,
  };
}

function cliDryRunPlan(args: string[], workingDirectory: string): CliDryRunPlan {
  let workspace = '';
  let workspaceSource: CliDryRunPlan['workspace_source'] = 'configured-default';
  const entries: string[] = [];
  const manualTagPathPairs: string[] = [];
  const archivePaths: string[] = [];
  let archiveTagPrefix = '';
  const archiveRestorePrefixes: string[] = [];
  let cacheTag = '';
  let toolTagSuffix = '';
  let noPlatform = false;
  const { workspace: repoWorkspace, repoConfigPath } = readRepoConfigWorkspace(workingDirectory);

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--entry') {
      entries.push(args[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--profile') {
      index += 1;
      continue;
    }
    if (arg === '--archive-path') {
      archivePaths.push(args[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg === '--archive-tag-prefix') {
      archiveTagPrefix = args[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--archive-restore-prefix') {
      archiveRestorePrefixes.push(...(args[index + 1] || '').split(',').map((value) => value.trim()).filter(Boolean));
      index += 1;
      continue;
    }
    if (arg === '--cache-tag') {
      cacheTag = args[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--tool-tag-suffix') {
      toolTagSuffix = args[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--no-platform') {
      noPlatform = true;
      continue;
    }
    if (!arg.startsWith('--') && !workspace && !arg.includes(':')) {
      workspace = arg;
      workspaceSource = 'explicit';
      continue;
    }
    if (!arg.startsWith('--') && manualTagPathPairs.length === 0 && arg.includes(':')) {
      manualTagPathPairs.push(...arg.split(',').map((entry) => entry.trim()).filter(Boolean));
    }
  }

  if (!workspace && repoWorkspace) {
    workspace = repoWorkspace;
    workspaceSource = 'repo-config';
  }

  const archiveEntries = archivePaths.length > 0
    ? buildMockArchivePathEntries(
      workingDirectory,
      archivePaths,
      applyMockArchivePlatformSuffix(archiveTagPrefix, noPlatform),
    )
    : manualTagPathPairs.length > 0
    ? manualTagPathPairs.map((pair) => {
      const parsed = parseMockManualTagPathPair(pair);
      const tag = decorateMockManualTag(parsed.tag, cacheTag, toolTagSuffix);
      return {
        requested: parsed.tag,
        request_source: 'manual' as const,
        resolution_source: 'manual' as const,
        resolved_tag: parsed.tag,
        tag,
        path: parsed.path,
        tag_path_pair: parsed.path ? `${tag}:${parsed.path}` : tag,
      };
    })
    : entries.map((entry) => decorateMockGeneratedEntry(
      cliDryRunEntry(workingDirectory, entry),
      cacheTag,
      toolTagSuffix,
      workingDirectory,
    ));
  const mergedEnvVars: Record<string, string> = {};
  for (const entry of entries) {
    Object.assign(mergedEnvVars, cliBuiltInEntry(workingDirectory, entry).envVars);
  }
  const archiveRestoreCandidates = archivePaths.length > 0
    ? archiveRestorePrefixes.map((prefix) => {
      const resolvedPrefix = applyMockArchivePlatformSuffix(prefix, noPlatform);
      return {
        tag_prefix: resolvedPrefix,
        tag_path_pairs: buildMockArchivePathEntries(
          workingDirectory,
          archivePaths,
          resolvedPrefix,
        ).map((entry) => entry.tag_path_pair),
      };
    })
    : undefined;

  return {
    workspace: workspace || process.env.BORINGCACHE_DEFAULT_WORKSPACE || 'default/default',
    workspace_source: workspaceSource,
    repo_config_path: repoConfigPath || undefined,
    tag_path_pairs: archiveEntries.map((entry) => entry.tag_path_pair),
    archive_entries: archiveEntries,
    archive_restore_candidates: archiveRestoreCandidates,
    env_vars: mergedEnvVars,
  };
}

function defaultAdapterTag(adapterName: string): string {
  const repo = (process.env.GITHUB_REPOSITORY || '').trim();
  if (repo) {
    const parts = repo.split('/');
    return (parts[1] || repo).trim();
  }
  return adapterName;
}

function resolveMockDockerTarget(rawTag: string, explicitCacheRefTag: string): {
  tag: string;
  refTag: string;
} {
  const trimmedTag = rawTag.trim();
  const trimmedExplicitRefTag = explicitCacheRefTag.trim();

  if (trimmedTag.includes(':')) {
    const separator = trimmedTag.lastIndexOf(':');
    const tag = trimmedTag.slice(0, separator).trim();
    const embeddedRefTag = trimmedTag.slice(separator + 1).trim();
    if (tag && embeddedRefTag && (!trimmedExplicitRefTag || trimmedExplicitRefTag === 'buildcache')) {
      return { tag, refTag: embeddedRefTag };
    }
  }

  return {
    tag: trimmedTag,
    refTag: trimmedExplicitRefTag || 'buildcache',
  };
}

function normalizeMockMetadataHintKey(rawKey: string): string {
  return rawKey.trim().toLowerCase().replace(/-/g, '_');
}

function normalizeMockMetadataHintValue(rawValue: string): string {
  return rawValue.trim().toLowerCase().replace(/\s+/g, '-');
}

function addMockMetadataHint(hints: Record<string, string>, input: string): void {
  const [rawKey, ...rawValueParts] = input.split('=');
  if (!rawKey || rawValueParts.length === 0) {
    return;
  }
  hints[normalizeMockMetadataHintKey(rawKey)] = normalizeMockMetadataHintValue(rawValueParts.join('='));
}

function mockGradleInitScript(): string {
  return `import org.gradle.caching.http.HttpBuildCache

gradle.settingsEvaluated { settings ->
    def cacheUrl = System.getenv("BORINGCACHE_GRADLE_CACHE_URL")
    if (cacheUrl) {
        settings.buildCache {
            remote(HttpBuildCache) {
                enabled = true
                url = uri(cacheUrl)
                push = System.getenv("BORINGCACHE_GRADLE_CACHE_PUSH") == "true"
                allowInsecureProtocol = true
            }
        }
    }
}
`;
}

function mockMavenExtensionsContent(version: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<extensions xmlns="http://maven.apache.org/EXTENSIONS/1.0.0"
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xsi:schemaLocation="http://maven.apache.org/EXTENSIONS/1.0.0 https://maven.apache.org/xsd/core-extensions-1.0.0.xsd">
  <extension>
    <groupId>org.apache.maven.extensions</groupId>
    <artifactId>maven-build-cache-extension</artifactId>
    <version>${version}</version>
  </extension>
</extensions>
`;
}

function mockMavenBuildCacheConfig(endpoint: string, readOnly: boolean, cacheId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cache xmlns="http://maven.apache.org/BUILD-CACHE-CONFIG/1.2.0"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://maven.apache.org/BUILD-CACHE-CONFIG/1.2.0 https://maven.apache.org/xsd/build-cache-config-1.2.0.xsd">
  <configuration>
    <remote enabled="true" saveToRemote="${!readOnly}" transport="resolver" id="${cacheId}">
      <url>${endpoint}</url>
    </remote>
  </configuration>
</cache>
`;
}

function cliAdapterDryRunPlan(adapterName: string, args: string[], workingDirectory: string): CliAdapterDryRunPlan {
  let workspace = '';
  let workspaceSource: CliAdapterDryRunPlan['workspace_source'] = 'configured-default';
  let tag = '';
  let port = 0;
  let host = '';
  let endpointHost = '';
  let noPlatform = false;
  let noGit = false;
  let readOnly = false;
  let cacheMode = '';
  let cacheRefTag = '';
  let ociHydration = 'metadata-only';
  const metadataHints: Record<string, string> = {};
  const bazelrcLines: string[] = [];
  let gradleHome = '';
  let gradleBuildCacheProperty = true;
  let mavenLocalRepo = '';
  let mavenExtensionsPath = '';
  let mavenBuildCacheConfigPath = '';
  let mavenBuildCacheExtensionVersion = '';
  let mavenBuildCacheId = '';
  const { workspace: repoWorkspace, repoConfigPath } = readRepoConfigWorkspace(workingDirectory);
  const repoSettings = readRepoAdapterSettings(workingDirectory, adapterName);

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') {
      break;
    }
    if (arg === '--workspace') {
      workspace = args[index + 1] || '';
      workspaceSource = 'explicit';
      index += 1;
      continue;
    }
    if (arg === '--tag') {
      tag = args[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--port') {
      const parsed = Number.parseInt(args[index + 1] || '', 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        port = parsed;
      }
      index += 1;
      continue;
    }
    if (arg === '--host') {
      host = args[index + 1] || host;
      index += 1;
      continue;
    }
    if (arg === '--endpoint-host') {
      endpointHost = args[index + 1] || endpointHost;
      index += 1;
      continue;
    }
    if (arg === '--cache-mode') {
      cacheMode = args[index + 1] || cacheMode;
      index += 1;
      continue;
    }
    if (arg === '--cache-ref-tag') {
      cacheRefTag = args[index + 1] || cacheRefTag;
      index += 1;
      continue;
    }
    if (arg === '--oci-hydration') {
      ociHydration = args[index + 1] || ociHydration;
      index += 1;
      continue;
    }
    if (arg === '--metadata-hint') {
      addMockMetadataHint(metadataHints, args[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg === '--bazelrc-line') {
      if (args[index + 1]) {
        bazelrcLines.push(args[index + 1]);
      }
      index += 1;
      continue;
    }
    if (arg === '--gradle-home') {
      gradleHome = args[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--no-gradle-build-cache-property') {
      gradleBuildCacheProperty = false;
      continue;
    }
    if (arg === '--maven-local-repo') {
      mavenLocalRepo = args[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--maven-extensions-path') {
      mavenExtensionsPath = args[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--maven-build-cache-config-path') {
      mavenBuildCacheConfigPath = args[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--maven-build-cache-extension-version') {
      mavenBuildCacheExtensionVersion = args[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--maven-build-cache-id') {
      mavenBuildCacheId = args[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--no-platform') {
      noPlatform = true;
      continue;
    }
    if (arg === '--no-git') {
      noGit = true;
      continue;
    }
    if (arg === '--read-only') {
      readOnly = true;
    }
  }

  if (!workspace && repoWorkspace) {
    workspace = repoWorkspace;
    workspaceSource = 'repo-config';
  }

  const resolvedTag = tag || repoSettings.tag || defaultAdapterTag(adapterName);
  const resolvedPort = port > 0 ? port : repoSettings.port || 5000;
  const resolvedHost = host.trim() || repoSettings.host || '127.0.0.1';
  const resolvedEndpointHost = (endpointHost.trim() || '')
    || repoSettings.endpointHost
    || (resolvedHost === '0.0.0.0' ? '127.0.0.1' : resolvedHost);
  const resolvedNoPlatform = noPlatform || repoSettings.noPlatform || false;
  const resolvedNoGit = noGit || repoSettings.noGit || false;
  const resolvedReadOnly = readOnly || repoSettings.readOnly || false;
  const resolvedCacheMode = cacheMode || repoSettings.cacheMode || 'max';
  const resolvedCacheRefTag = cacheRefTag || repoSettings.cacheRefTag || 'buildcache';
  let ociCache: CliAdapterDryRunPlan['oci_cache'];
  let ociPrefetchRefs: string[] = [];
  let envVars: Record<string, string> = {};
  let setup: CliAdapterDryRunPlan['setup'];

  if (adapterName === 'turbo') {
    envVars = {
        BORINGCACHE_PROXY_PORT: String(resolvedPort),
        BORINGCACHE_CACHE_REF: '{CACHE_REF}',
        TURBO_API: `http://127.0.0.1:${resolvedPort}`,
        TURBO_TOKEN: 'boringcache',
        TURBO_TEAM: 'boringcache',
        ...mockNodePackageManagerEnvVars(workingDirectory),
      };
  } else if (adapterName === 'nx') {
    envVars = {
      BORINGCACHE_PROXY_PORT: String(resolvedPort),
      BORINGCACHE_CACHE_REF: '{CACHE_REF}',
      NX_SELF_HOSTED_REMOTE_CACHE_SERVER: `http://127.0.0.1:${resolvedPort}`,
      NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN: 'boringcache',
      ...mockNodePackageManagerEnvVars(workingDirectory),
    };
  } else if (adapterName === 'sccache') {
    envVars = {
      BORINGCACHE_PROXY_PORT: String(resolvedPort),
      BORINGCACHE_CACHE_REF: '{CACHE_REF}',
      RUSTC_WRAPPER: 'sccache',
      CARGO_INCREMENTAL: '0',
      CC: 'sccache cc',
      CXX: 'sccache c++',
      SCCACHE_WEBDAV_ENDPOINT: `http://${resolvedEndpointHost}:${resolvedPort}/`,
      SCCACHE_WEBDAV_KEY_PREFIX: repoSettings.sccacheKeyPrefix || '',
    };
  } else if (adapterName === 'go') {
    envVars = {
      BORINGCACHE_PROXY_PORT: String(resolvedPort),
      BORINGCACHE_CACHE_REF: '{CACHE_REF}',
      GOCACHEPROG: `boringcache go-cacheprog --endpoint http://${resolvedEndpointHost}:${resolvedPort}`,
    };
  }

  let finalTag = resolvedTag;
  if (adapterName === 'docker' || adapterName === 'buildkit') {
    const dockerTarget = resolveMockDockerTarget(resolvedTag, resolvedCacheRefTag);
    finalTag = dockerTarget.tag;
    const registryRef = `${resolvedEndpointHost}:${resolvedPort}/cache:${dockerTarget.refTag}`;
    ociCache = {
      registry_ref: registryRef,
      cache_from: `type=registry,ref=${registryRef},registry.insecure=true`,
      cache_from_refs: [`type=registry,ref=${registryRef},registry.insecure=true`],
      cache_to: resolvedReadOnly ? undefined : `type=registry,ref=${registryRef},mode=${resolvedCacheMode},registry.insecure=true`,
      ref_tag: dockerTarget.refTag,
    };
    ociPrefetchRefs = [`cache@${dockerTarget.refTag}`];
    envVars = {
      BORINGCACHE_PROXY_PORT: String(resolvedPort),
      BORINGCACHE_CACHE_REF: registryRef,
    };
  }

  const endpoint = `http://${resolvedEndpointHost}:${resolvedPort}`;
  const cacheRef = adapterName === 'docker' || adapterName === 'buildkit'
    ? ociCache?.registry_ref || `${resolvedEndpointHost}:${resolvedPort}/cache:${resolvedCacheRefTag}`
    : `${resolvedEndpointHost}:${resolvedPort}/cache:${finalTag}`;
  if (adapterName === 'bazel') {
    const remoteMaxConnections = Number.parseInt(process.env.BORINGCACHE_BAZEL_REMOTE_MAX_CONNECTIONS || '', 10);
    const maxConnections = Number.isFinite(remoteMaxConnections) && remoteMaxConnections > 0
      ? remoteMaxConnections
      : 64;
    setup = {
      schema_version: 1,
      files: [{
        path: path.join(process.env.HOME || '/home/test', '.bazelrc'),
        mode: 'append',
        content: [
          '',
          '# BoringCache remote cache',
          `build --remote_cache=${endpoint}`,
          `build --remote_upload_local_results=${!resolvedReadOnly}`,
          'build --remote_cache_async=false',
          'build --remote_download_minimal',
          `build --remote_max_connections=${maxConnections}`,
          ...bazelrcLines.map((line) => line.trim()).filter(Boolean),
          '',
        ].join('\n'),
      }],
    };
  } else if (adapterName === 'gradle') {
    const resolvedGradleHome = resolveMockArchivePath(gradleHome || '~/.gradle', workingDirectory);
    setup = {
      schema_version: 1,
      env_vars: {
        BORINGCACHE_PROXY_PORT: String(resolvedPort),
        BORINGCACHE_CACHE_REF: cacheRef,
        BORINGCACHE_GRADLE_CACHE_URL: `${endpoint}/cache/`,
        BORINGCACHE_GRADLE_CACHE_PUSH: String(!resolvedReadOnly),
      },
      files: [{
        path: path.join(resolvedGradleHome, 'init.d', 'boringcache-gradle-build-cache.init.gradle'),
        mode: 'write',
        content: mockGradleInitScript(),
      }],
    };
    if (gradleBuildCacheProperty) {
      setup.files!.push({
        path: path.join(resolvedGradleHome, 'gradle.properties'),
        mode: 'append',
        content: '\norg.gradle.caching=true\n',
      });
    }
  } else if (adapterName === 'maven') {
    const resolvedExtensionsPath = resolveMockArchivePath(mavenExtensionsPath || '.mvn/extensions.xml', workingDirectory);
    const resolvedBuildCacheConfigPath = resolveMockArchivePath(
      mavenBuildCacheConfigPath || '.mvn/maven-build-cache-config.xml',
      workingDirectory,
    );
    const resolvedLocalRepo = resolveMockArchivePath(mavenLocalRepo || '~/.m2/repository', workingDirectory);
    setup = {
      schema_version: 1,
      files: [
        {
          path: resolvedExtensionsPath,
          mode: 'write',
          content: mockMavenExtensionsContent(mavenBuildCacheExtensionVersion || '1.2.2'),
        },
        {
          path: resolvedBuildCacheConfigPath,
          mode: 'write',
          content: mockMavenBuildCacheConfig(endpoint, resolvedReadOnly, mavenBuildCacheId || 'boringcache'),
        },
      ],
      directories: [resolvedLocalRepo],
    };
  }

  return {
    schema_version: 1,
    adapter: adapterName,
    workspace: workspace || process.env.BORINGCACHE_DEFAULT_WORKSPACE || 'default/default',
    workspace_source: workspaceSource,
    repo_config_path: repoConfigPath || undefined,
    tag: finalTag,
    command: [],
    archive_entries: [],
    env_vars: envVars,
    setup,
    proxy: {
      host: resolvedHost,
      endpoint_host: resolvedEndpointHost,
      port: resolvedPort,
      no_platform: resolvedNoPlatform,
      no_git: resolvedNoGit,
      read_only: resolvedReadOnly,
      startup_mode: 'warm',
      oci_prefetch_refs: ociPrefetchRefs,
      oci_hydration: ociHydration,
      metadata_hints: metadataHints,
    },
    oci_cache: ociCache,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  process.env = { ...originalEnv };
  delete process.env.BORINGCACHE_DEFAULT_WORKSPACE;
  delete process.env.BORINGCACHE_DEFAULT_BRANCH;
  delete process.env.BORINGCACHE_CI_RUN_STARTED_AT;
  delete process.env.BORINGCACHE_GIT_BRANCH;
  delete process.env.BORINGCACHE_GIT_SHA;
  delete process.env.CI;
  delete process.env.GITHUB_ACTIONS;
  delete process.env.GITHUB_EVENT_NAME;
  delete process.env.GITHUB_HEAD_REF;
  delete process.env.GITHUB_REF;
  delete process.env.GITHUB_REF_NAME;
  delete process.env.GITHUB_REPOSITORY;
  delete process.env.GITHUB_RUN_ID;
  delete process.env.GITHUB_SHA;
  process.env.BORINGCACHE_SAVE_TOKEN = 'test-save-token';
  (core.isDebug as jest.Mock).mockReturnValue(false);
  (core.group as jest.Mock).mockImplementation(async (_title: string, fn: () => Promise<void>) => fn());

  mockEnsureBoringCache.mockImplementation(async (options: { version: string; token?: string }) => {
    const token = options?.token || process.env.BORINGCACHE_API_TOKEN;
    if (token) {
      core.setSecret(token);
    }
  });

  mockExecBoringCache.mockImplementation(async (args: string[], options?: Parameters<typeof exec.exec>[2]) => {
    return exec.exec('boringcache', args, options);
  });

  mockInstallMise.mockResolvedValue(undefined);
  mockInstallMiseTool.mockResolvedValue(undefined);
  mockActivateMiseTool.mockResolvedValue(undefined);
  mockHasMiseToolVersion.mockResolvedValue(false);
  mockHasToolVersionOnPath.mockResolvedValue(false);
  mockExportMiseEnv.mockResolvedValue(undefined);
  mockReshimMise.mockResolvedValue(undefined);
  mockReadProjectMiseTools.mockResolvedValue([]);
  mockReadMiseTomlVersion.mockResolvedValue(null);
  mockReadToolVersionsValue.mockResolvedValue(null);
  mockStartRegistryProxy.mockResolvedValue({ pid: 4321, port: 5000, readOnly: false });
  mockStopRegistryProxy.mockResolvedValue(undefined);
  mockFindAvailablePort.mockResolvedValue(5000);

  (exec.exec as jest.Mock).mockImplementation(async (
    command: string,
    args?: string[],
    options?: {
      cwd?: string;
      env?: NodeJS.ProcessEnv;
      listeners?: { stdout?: (data: Buffer) => void; stderr?: (data: Buffer) => void };
    },
  ) => {
    if (command === 'boringcache' && args?.[0] === 'run' && args.includes('--dry-run') && args.includes('--json')) {
      const plan = cliDryRunPlan(args, options?.cwd || process.cwd());
      options?.listeners?.stdout?.(Buffer.from(JSON.stringify(plan)));
      return 0;
    }
    if (
      command === 'boringcache'
      && args
      && ['bazel', 'buildkit', 'docker', 'go', 'gradle', 'maven', 'nx', 'sccache', 'turbo'].includes(args[0])
      && args.includes('--dry-run')
      && args.includes('--json')
    ) {
      const plan = cliAdapterDryRunPlan(args[0], args, options?.cwd || process.cwd());
      if (args[0] === 'docker') {
        const tagIndex = args.indexOf('--tag');
        const cacheRefTagIndex = args.indexOf('--cache-ref-tag');
        const tagValue = tagIndex >= 0 ? (args[tagIndex + 1] || '') : '';
        const cacheRefTagValue = cacheRefTagIndex >= 0 ? (args[cacheRefTagIndex + 1] || '') : '';
        if (tagValue.includes(':') && (!cacheRefTagValue || cacheRefTagValue === 'buildcache')) {
          options?.listeners?.stderr?.(Buffer.from(
            'warning: --tag included a ref-tag suffix; prefer --cache-ref-tag for the OCI cache tag.\n',
          ));
        }
      }
      options?.listeners?.stdout?.(Buffer.from(JSON.stringify(plan)));
      return 0;
    }
    if (command === 'boringcache' && args?.includes('check') && args.includes('--json')) {
      const checkIndex = args.indexOf('check');
      const requestedTag = args[checkIndex + 2] || '';
      options?.listeners?.stdout?.(Buffer.from(JSON.stringify({
        schema_version: 1,
        workspace: args[checkIndex + 1] || 'default/default',
        total: 1,
        hits: 1,
        misses: 0,
        results: [{
          tag: requestedTag,
          requested_tag: requestedTag,
          status: 'hit',
        }],
      })));
      return 0;
    }
    return 0;
  });
});

afterEach(() => {
  process.env = originalEnv;
});

export function mockGetInput(inputs: Record<string, string>): void {
  (core.getInput as jest.Mock).mockImplementation((name: string) => inputs[name] || '');
}

export function mockGetBooleanInput(inputs: Record<string, boolean>): void {
  (core.getBooleanInput as jest.Mock).mockImplementation((name: string) => inputs[name] || false);
}

export function mockGetState(states: Record<string, string>): void {
  (core.getState as jest.Mock).mockImplementation((name: string) => states[name] || '');
}

export const actionCoreMocks = {
  activateMiseTool: mockActivateMiseTool,
  ensureBoringCache: mockEnsureBoringCache,
  execBoringCache: mockExecBoringCache,
  exportMiseEnv: mockExportMiseEnv,
  hasMiseToolVersion: mockHasMiseToolVersion,
  hasToolVersionOnPath: mockHasToolVersionOnPath,
  installMise: mockInstallMise,
  installMiseTool: mockInstallMiseTool,
  reshimMise: mockReshimMise,
  findAvailablePort: mockFindAvailablePort,
  readMiseTomlVersion: mockReadMiseTomlVersion,
  readProjectMiseTools: mockReadProjectMiseTools,
  readToolVersionsValue: mockReadToolVersionsValue,
  startRegistryProxy: mockStartRegistryProxy,
  stopRegistryProxy: mockStopRegistryProxy,
};
