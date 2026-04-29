import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  execBoringCache as execBoringCacheCore,
  findAvailablePort,
  hasToolVersionOnPath,
  hasRestoreToken,
  hasSaveToken,
  missingRestoreTokenMessage,
  missingSaveTokenMessage,
  pathExists,
  startRegistryProxy,
  stopRegistryProxy,
} from './core';
import {
  DEFAULT_OCI_HYDRATION_POLICY,
  detectNodePackageManager,
  type OneInputs,
  resolveCliArchiveEntries,
  type ResolvedCliArchiveEntry,
  type ResolvedPlan,
  type TagVerificationSpec,
  type ToolSpec,
} from './utils';

const DOCKER_CACHE_DIR_FROM = path.join(os.tmpdir(), 'boringcache-one-buildkit-cache-from');
const DOCKER_CACHE_DIR_TO = path.join(os.tmpdir(), 'boringcache-one-buildkit-cache-to');
const DOCKER_METADATA_FILE = path.join(os.tmpdir(), 'boringcache-one-docker-metadata.json');
const BUILDKIT_CACHE_DIR_FROM = path.join(os.tmpdir(), 'boringcache-one-buildkit-local-from');
const BUILDKIT_CACHE_DIR_TO = path.join(os.tmpdir(), 'boringcache-one-buildkit-local-to');
const BUILDKIT_METADATA_FILE = path.join(os.tmpdir(), 'boringcache-one-buildkit-metadata.json');
const DEFAULT_REGISTRY_CACHE_REF_TAG = 'buildcache';

interface ModeRestoreResult {
  cacheHit?: boolean;
  cacheTag?: string;
  verificationSpecs?: TagVerificationSpec[];
}

interface SccacheStatsSummary {
  compileRequests: number;
  cacheHits: number;
  cacheMisses: number;
  rustHitRate: string | null;
}

interface CacheFlags {
  verbose?: boolean;
  exclude?: string;
}

type RegistryProxyOptions = Parameters<typeof startRegistryProxy>[0] & {
  ociPrefetchRefs?: string[];
  ociAliasPromotionRefs?: string[];
  ociRequiredReadableRefs?: string[];
  metadataHints?: Record<string, string>;
};

interface CliProxyDryRunPlan {
  host: string;
  endpoint_host: string;
  port: number;
  no_platform: boolean;
  no_git: boolean;
  read_only: boolean;
  startup_mode?: string;
  oci_prefetch_refs?: string[];
  oci_hydration?: string;
  metadata_hints?: Record<string, string>;
}

function actionProxyOptions<T extends RegistryProxyOptions>(
  options: T,
  proxyPlan?: CliProxyDryRunPlan,
): T {
  return {
    ...options,
    onDemand: proxyPlan?.startup_mode === 'on-demand',
    ociPrefetchRefs: proxyPlan?.oci_prefetch_refs || [],
    ociRequiredReadableRefs: options.ociRequiredReadableRefs || [],
    ociHydration: proxyPlan?.oci_hydration || options.ociHydration || DEFAULT_OCI_HYDRATION_POLICY,
    metadataHints: proxyPlan?.metadata_hints || options.metadataHints || {},
  };
}

function adapterProxyVerificationSpec(
  tag: string,
  proxyPlan: CliProxyDryRunPlan,
  pathHint: string,
): TagVerificationSpec {
  return {
    tag,
    noPlatform: proxyPlan.no_platform,
    noGit: proxyPlan.no_git,
    pathHint,
    saveExpected: !proxyPlan.read_only,
  };
}

interface CliAdapterSetupFile {
  path: string;
  mode: 'write' | 'append';
  content: string;
}

interface CliAdapterSetupPlan {
  schema_version?: number;
  env_vars?: Record<string, string>;
  files?: CliAdapterSetupFile[];
  directories?: string[];
}

interface CliAdapterDryRunPlan {
  schema_version?: number;
  workspace: string;
  tag: string;
  env_vars?: Record<string, string>;
  setup?: CliAdapterSetupPlan;
  proxy: CliProxyDryRunPlan;
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

interface CliCheckSummary {
  hits?: number;
  results?: Array<{
    status?: string;
  }>;
}

const SUPPORTED_CLI_DRY_RUN_SCHEMA_VERSION = 1;
const SUPPORTED_CLI_SETUP_SCHEMA_VERSION = 1;

function assertSupportedCliDryRunSchema(adapter: string, plan: CliAdapterDryRunPlan): void {
  if (plan.schema_version !== SUPPORTED_CLI_DRY_RUN_SCHEMA_VERSION) {
    const actual = plan.schema_version === undefined ? 'missing' : String(plan.schema_version);
    throw new Error(
      `boringcache ${adapter} dry-run JSON schema_version ${actual} is not supported by this action `
      + `(expected ${SUPPORTED_CLI_DRY_RUN_SCHEMA_VERSION}). Update boringcache/one or pin cli-version.`,
    );
  }
}

interface DockerBuildOptions {
  dockerfile: string;
  context: string;
  image: string;
  tags: string[];
  buildArgs: string[];
  secrets: string[];
  target?: string;
  platforms?: string;
  push: boolean;
  load: boolean;
  noCache: boolean;
  builder: string;
  cacheMode: string;
  cacheDirFrom?: string;
  cacheDirTo?: string;
  cacheFrom?: string[];
  cacheTo?: string;
}

interface BuildctlOptions {
  addr: string;
  tlsCa?: string;
  tlsCert?: string;
  tlsKey?: string;
  tlsSkipVerify?: boolean;
  contextPath: string;
  dockerfileDir: string;
  dockerfileName: string;
  buildArgs: string[];
  secrets: string[];
  sshSpecs: string[];
  target?: string;
  platforms?: string;
  cacheMode: string;
  cacheDirFrom?: string;
  cacheDirTo?: string;
  importCache?: string[];
  exportCache?: string;
  output?: string;
  imageTags: string[];
  push: boolean;
  noCache: boolean;
  metadataFile: string;
}

function currentHomeDir(): string {
  return process.env.HOME || os.homedir();
}

export async function runModeRestore(plan: ResolvedPlan, inputs: OneInputs): Promise<ModeRestoreResult> {
  switch (plan.mode) {
    case 'docker':
      return runDockerRestore(plan, inputs);
    case 'buildkit':
      return runBuildkitRestore(plan, inputs);
    case 'bazel':
      return runBazelRestore(plan, inputs);
    case 'go':
      return runGoRestore(plan, inputs);
    case 'gradle':
      return runGradleRestore(plan, inputs);
    case 'maven':
      return runMavenRestore(plan, inputs);
    case 'rust-sccache':
      return runRustRestore(plan, inputs);
    case 'turbo-proxy':
      return runTurboProxyRestore(plan, inputs);
    case 'nx-proxy':
      return runNxProxyRestore(plan, inputs);
    case 'archive':
      return {};
  }
}

export async function runModeSave(mode: ResolvedPlan['mode']): Promise<void> {
  switch (mode) {
    case 'docker':
      await runDockerSave();
      return;
    case 'buildkit':
      await runBuildkitSave();
      return;
    case 'bazel':
      await shutdownBazelServer();
      await stopProxyFromState();
      return;
    case 'go':
      await stopProxyFromState();
      return;
    case 'gradle':
    case 'maven':
    case 'nx-proxy':
    case 'turbo-proxy':
      await stopProxyFromState();
      return;
    case 'rust-sccache':
      await runRustSave();
      return;
    case 'archive':
      return;
  }
}

function parseBoolean(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return String(value).trim().toLowerCase() === 'true';
}

function parseList(input: string, separator = /[\n,]/): string[] {
  return input
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}

function appendMetadataHintArgs(args: string[], metadataHintsInput: string): void {
  for (const hint of parseList(metadataHintsInput)) {
    args.push('--metadata-hint', hint);
  }
}

function parseMultiline(input: string): string[] {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function slugify(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '-');
}

function sanitizeBuilderToken(value: string): string {
  return slugify(value)
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function proxyPlanningReadOnly(requestedReadOnly: boolean): boolean {
  return requestedReadOnly || (!hasSaveToken() && hasRestoreToken());
}

function requireAdapterSetupPlan(adapter: string, setup?: CliAdapterSetupPlan): CliAdapterSetupPlan {
  if (!setup || (!Object.keys(setup.env_vars || {}).length && !(setup.files || []).length && !(setup.directories || []).length)) {
    throw new Error(`boringcache ${adapter} dry-run JSON did not include adapter setup planning data`);
  }
  const setupSchemaVersion = setup.schema_version ?? SUPPORTED_CLI_SETUP_SCHEMA_VERSION;
  if (setupSchemaVersion !== SUPPORTED_CLI_SETUP_SCHEMA_VERSION) {
    throw new Error(
      `boringcache ${adapter} setup schema_version ${setupSchemaVersion} is not supported by this action `
      + `(expected ${SUPPORTED_CLI_SETUP_SCHEMA_VERSION}). Update boringcache/one or pin cli-version.`,
    );
  }
  return setup;
}

function exportEnvVars(envVars: Record<string, string>): void {
  for (const [key, value] of Object.entries(envVars)) {
    process.env[key] = value;
    core.exportVariable(key, value);
  }
}

function applyAdapterSetupPlan(setup: CliAdapterSetupPlan): void {
  exportEnvVars(setup.env_vars || {});

  for (const directory of setup.directories || []) {
    ensureDir(directory);
  }

  for (const file of setup.files || []) {
    ensureDir(path.dirname(file.path));
    if (file.mode === 'append') {
      if (fs.existsSync(file.path) && fs.readFileSync(file.path, 'utf8').includes(file.content)) {
        continue;
      }
      fs.appendFileSync(file.path, file.content);
    } else if (file.mode === 'write') {
      fs.writeFileSync(file.path, file.content);
    } else {
      throw new Error(`Unsupported adapter setup file mode for ${file.path}`);
    }
  }
}

function setupFilePath(setup: CliAdapterSetupPlan, suffix: string): string {
  return (setup.files || []).find((file) => file.path.endsWith(suffix))?.path || '';
}

function setupDirectory(setup: CliAdapterSetupPlan): string {
  return (setup.directories || [])[0] || '';
}

function requireSetupFilePath(setup: CliAdapterSetupPlan, suffix: string, label: string): string {
  const filePath = setupFilePath(setup, suffix);
  if (!filePath) {
    throw new Error(`boringcache adapter setup plan did not include ${label}`);
  }
  return filePath;
}

function requireSetupDirectory(setup: CliAdapterSetupPlan, label: string): string {
  const directory = setupDirectory(setup);
  if (!directory) {
    throw new Error(`boringcache adapter setup plan did not include ${label}`);
  }
  return directory;
}

function modeStateKey(key: string): string {
  return `mode-${key}`;
}

function saveModeState(key: string, value: string): void {
  core.saveState(modeStateKey(key), value);
}

function getModeState(key: string): string {
  return core.getState(modeStateKey(key));
}

function appendModeStateListValue(key: string, value: string): void {
  if (!value) {
    return;
  }

  const existing = getModeState(key)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (existing.includes(value)) {
    return;
  }
  existing.push(value);
  saveModeState(key, existing.join(','));
}

function markModeVerifyTagSkipped(tag: string): void {
  appendModeStateListValue('skipped-verify-tags', tag);
}

function addLocalBinPaths(): void {
  const home = currentHomeDir();
  core.addPath(path.join(home, '.local', 'bin'));
  core.addPath(path.join(home, '.boringcache', 'bin'));
}

function registryProxyLogPath(port: number): string {
  return path.join(os.tmpdir(), `boringcache-proxy-${port}.log`);
}

function setProxyOutputs(port: number): void {
  const logPath = registryProxyLogPath(port);
  core.saveState('proxy-port', String(port));
  core.saveState('proxy-log-path', logPath);
  core.setOutput('proxy-port', String(port));
  core.setOutput('proxy-log-path', logPath);
}

function saveProxyModeState(port: number): void {
  saveModeState('proxy-port', String(port));
  saveModeState('proxy-log-path', registryProxyLogPath(port));
}

async function shutdownBazelServer(): Promise<void> {
  await exec.exec('bazel', ['shutdown'], {
    ignoreReturnCode: true,
    silent: true,
  });
}

async function execBoringCache(args: string[], options?: Parameters<typeof execBoringCacheCore>[1]): Promise<number> {
  return execBoringCacheCore(args, options);
}

function emitCliPlannerWarnings(stderr: string): void {
  for (const line of stderr.split('\n').map((value) => value.trim()).filter(Boolean)) {
    if (line.startsWith('warning:')) {
      core.warning(line.replace(/^warning:\s*/, ''));
    }
  }
}

async function resolveAdapterCliPlan(
  adapter: 'bazel' | 'go' | 'gradle' | 'maven' | 'nx' | 'sccache' | 'turbo',
  workspace: string,
  workingDirectory: string,
  inputCacheTag: string,
  preferredPort: number,
  noPlatform: boolean,
  noGit: boolean,
  readOnly: boolean,
  options: {
    metadataHintsInput?: string;
    bazelrcLines?: string;
    gradleHome?: string;
    enableGradleBuildCache?: boolean;
    mavenLocalRepo?: string;
    mavenExtensionsPath?: string;
    mavenBuildCacheConfigPath?: string;
    mavenBuildCacheExtensionVersion?: string;
    mavenBuildCacheId?: string;
  } = {},
): Promise<CliAdapterDryRunPlan> {
  const args = [adapter, '--workspace', workspace];
  const trimmedCacheTag = inputCacheTag.trim();
  if (trimmedCacheTag) {
    args.push('--tag', trimmedCacheTag);
  }
  if (preferredPort > 0) {
    args.push('--port', String(preferredPort));
  }
  if (noPlatform) {
    args.push('--no-platform');
  }
  if (noGit) {
    args.push('--no-git');
  }
  if (readOnly) {
    args.push('--read-only');
  }
  appendMetadataHintArgs(args, options.metadataHintsInput || '');
  for (const line of parseMultiline(options.bazelrcLines || '')) {
    args.push('--bazelrc-line', line);
  }
  if (options.gradleHome?.trim()) {
    args.push('--gradle-home', options.gradleHome.trim());
  }
  if (options.enableGradleBuildCache === false) {
    args.push('--no-gradle-build-cache-property');
  }
  if (options.mavenLocalRepo?.trim()) {
    args.push('--maven-local-repo', options.mavenLocalRepo.trim());
  }
  if (options.mavenExtensionsPath?.trim()) {
    args.push('--maven-extensions-path', options.mavenExtensionsPath.trim());
  }
  if (options.mavenBuildCacheConfigPath?.trim()) {
    args.push('--maven-build-cache-config-path', options.mavenBuildCacheConfigPath.trim());
  }
  if (options.mavenBuildCacheExtensionVersion?.trim()) {
    args.push('--maven-build-cache-extension-version', options.mavenBuildCacheExtensionVersion.trim());
  }
  if (options.mavenBuildCacheId?.trim()) {
    args.push('--maven-build-cache-id', options.mavenBuildCacheId.trim());
  }
  args.push('--dry-run', '--json');

  let stdout = '';
  let stderr = '';
  const exitCode = await exec.exec('boringcache', args, {
    cwd: workingDirectory,
    ignoreReturnCode: true,
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString();
      },
      stderr: (data: Buffer) => {
        stderr += data.toString();
      },
    },
  });

  if (exitCode !== 0) {
    throw new Error(stderr.trim() || stdout.trim() || `boringcache ${adapter} --dry-run --json exited with code ${exitCode}`);
  }
  emitCliPlannerWarnings(stderr);

  let plan: CliAdapterDryRunPlan;
  try {
    plan = JSON.parse(stdout) as CliAdapterDryRunPlan;
  } catch (error) {
    throw new Error(
      `Failed to parse boringcache ${adapter} dry-run JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  assertSupportedCliDryRunSchema(adapter, plan);
  return plan;
}

async function resolveDockerCliPlan(
  workspace: string,
  workingDirectory: string,
  inputCacheTag: string,
  preferredPort: number,
  host: string,
  endpointHost: string,
  noPlatform: boolean,
  noGit: boolean,
  readOnly: boolean,
  cacheMode: string,
  cacheRefTag: string,
  ociHydration: string,
  metadataHintsInput = '',
): Promise<CliAdapterDryRunPlan> {
  const args = ['docker', '--workspace', workspace];
  const trimmedCacheTag = inputCacheTag.trim();
  const trimmedCacheRefTag = cacheRefTag.trim();
  if (trimmedCacheTag) {
    args.push('--tag', trimmedCacheTag);
  }
  if (preferredPort > 0) {
    args.push('--port', String(preferredPort));
  }
  if (host.trim()) {
    args.push('--host', host.trim());
  }
  if (endpointHost.trim()) {
    args.push('--endpoint-host', endpointHost.trim());
  }
  if (noPlatform) {
    args.push('--no-platform');
  }
  if (noGit) {
    args.push('--no-git');
  }
  if (readOnly) {
    args.push('--read-only');
  }
  if (cacheMode.trim()) {
    args.push('--cache-mode', cacheMode.trim());
  }
  if (trimmedCacheRefTag) {
    args.push('--cache-ref-tag', trimmedCacheRefTag);
  }
  const trimmedOciHydration = ociHydration.trim();
  if (trimmedOciHydration) {
    args.push('--oci-hydration', trimmedOciHydration);
  }
  appendMetadataHintArgs(args, metadataHintsInput);
  args.push('--dry-run', '--json', '--', 'docker', 'buildx', 'build', '.');

  let stdout = '';
  let stderr = '';
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  if (env.GITHUB_ACTIONS === 'true' && !env.BORINGCACHE_CI_RUN_STARTED_AT) {
    env.BORINGCACHE_CI_RUN_STARTED_AT = new Date().toISOString();
    process.env.BORINGCACHE_CI_RUN_STARTED_AT = env.BORINGCACHE_CI_RUN_STARTED_AT;
  }
  const exitCode = await exec.exec('boringcache', args, {
    cwd: workingDirectory,
    env,
    ignoreReturnCode: true,
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString();
      },
      stderr: (data: Buffer) => {
        stderr += data.toString();
      },
    },
  });

  if (exitCode !== 0) {
    throw new Error(stderr.trim() || stdout.trim() || `boringcache docker --dry-run --json exited with code ${exitCode}`);
  }
  emitCliPlannerWarnings(stderr);

  let plan: CliAdapterDryRunPlan;
  try {
    plan = JSON.parse(stdout) as CliAdapterDryRunPlan;
  } catch (error) {
    throw new Error(
      `Failed to parse boringcache docker dry-run JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  assertSupportedCliDryRunSchema('docker', plan);

  if (!plan.oci_cache?.registry_ref || !plan.oci_cache.cache_from) {
    throw new Error('boringcache docker dry-run JSON did not include OCI cache planning data');
  }

  return plan;
}

async function restoreSimpleCache(workspace: string, cacheKey: string, cacheDir: string, flags: CacheFlags = {}): Promise<void> {
  if (!hasRestoreToken()) {
    core.notice(`Skipping cache restore (${missingRestoreTokenMessage()})`);
    return;
  }

  const args = ['restore', workspace, `${cacheKey}:${cacheDir}`];
  if (flags.verbose) {
    args.push('--verbose');
  }

  await execBoringCache(args);
}

async function saveSimpleCache(workspace: string, cacheKey: string, cacheDir: string, flags: CacheFlags = {}): Promise<void> {
  if (!hasSaveToken()) {
    core.notice(`Skipping cache save (${missingSaveTokenMessage()})`);
    return;
  }

  if (!fs.existsSync(cacheDir) || fs.readdirSync(cacheDir).length === 0) {
    core.notice('No cache files to save');
    return;
  }

  const args = ['save', workspace, `${cacheKey}:${cacheDir}`, '--force'];
  if (flags.verbose) {
    args.push('--verbose');
  }
  if (flags.exclude) {
    args.push('--exclude', flags.exclude);
  }

  await execBoringCache(args);
}

function getEffectiveRegistryTag(cacheTag: string, registryTag: string): string {
  return registryTag || cacheTag;
}

function extractRegistryCacheRefTag(cacheFrom: string): string | null {
  const refMatch = cacheFrom.match(/(?:^|,)ref=([^,]+)/);
  const ref = refMatch?.[1]?.trim();
  if (!ref) {
    return null;
  }

  const lastSlash = ref.lastIndexOf('/');
  const lastColon = ref.lastIndexOf(':');
  if (lastColon <= lastSlash || lastColon === ref.length - 1) {
    return null;
  }

  return ref.slice(lastColon + 1);
}

function registryCacheFromRefTags(ociCache?: CliAdapterDryRunPlan['oci_cache']): string[] {
  if (!ociCache) {
    return [];
  }
  if (ociCache.cache_from_ref_tags?.length) {
    return ociCache.cache_from_ref_tags;
  }
  return (ociCache.cache_from_refs || [])
    .map(extractRegistryCacheRefTag)
    .filter((tag): tag is string => Boolean(tag));
}

function registryCacheImportSpecs(
  ociCache: NonNullable<CliAdapterDryRunPlan['oci_cache']>,
  refTags?: string[],
): string[] {
  const imports = ociCache.cache_from_refs?.length ? ociCache.cache_from_refs : [ociCache.cache_from];
  const byRefTag = new Map<string, string>();
  for (const cacheFrom of imports) {
    const refTag = extractRegistryCacheRefTag(cacheFrom);
    if (refTag && !byRefTag.has(refTag)) {
      byRefTag.set(refTag, cacheFrom.trim());
    }
  }

  const selectedImports = refTags
    ? refTags
        .map((refTag) => byRefTag.get(refTag))
        .filter((cacheFrom): cacheFrom is string => Boolean(cacheFrom))
    : imports
        .map((cacheFrom) => cacheFrom.trim())
        .filter(Boolean);

  return selectedImports;
}

function effectiveRegistryCacheImports(
  ociCache: NonNullable<CliAdapterDryRunPlan['oci_cache']>,
  proxy?: Awaited<ReturnType<typeof startRegistryProxy>>,
): {
  importSpecs: string[];
  readableRefTags: string[];
  requestedRefTags: string[];
  unreadableRefTags: string[];
  importReady: boolean;
} {
  const requestedRefTags = registryCacheFromRefTags(ociCache);
  const readableRefTags = proxy?.ociImportReadiness
    ? proxy.ociImportReadiness.readableRefs
    : requestedRefTags;
  const unreadableRefTags = proxy?.ociImportReadiness?.unreadableRefs || [];

  return {
    importSpecs: registryCacheImportSpecs(ociCache, readableRefTags),
    readableRefTags,
    requestedRefTags,
    unreadableRefTags,
    importReady: proxy?.ociImportReadiness?.ready ?? true,
  };
}

function setRegistryCacheOutputs(spec: {
  ref: string;
  from: string[];
  to?: string;
  ociCache?: CliAdapterDryRunPlan['oci_cache'];
  usedRefTags?: string[];
  unreadableRefTags?: string[];
  importReady?: boolean;
}): void {
  core.setOutput('registry-ref', spec.ref);
  core.setOutput('cache-from', spec.from.join('\n'));
  core.setOutput('cache-to', spec.to || '');
  core.setOutput('docker-cache-run-ref', spec.ociCache?.immutable_run_ref_tag || '');
  core.setOutput('docker-cache-from-refs', (spec.usedRefTags || registryCacheFromRefTags(spec.ociCache)).join('\n'));
  core.setOutput('docker-cache-requested-from-refs', registryCacheFromRefTags(spec.ociCache).join('\n'));
  core.setOutput('docker-cache-unreadable-from-refs', (spec.unreadableRefTags || []).join('\n'));
  core.setOutput('docker-cache-import-ready', String(spec.importReady ?? true));
  core.setOutput('docker-cache-promotion-refs', (spec.ociCache?.promotion_ref_tags || []).join('\n'));
  core.setOutput('docker-ci-provider', spec.ociCache?.run_metadata?.provider || '');
  core.setOutput('docker-ci-run-id', spec.ociCache?.run_metadata?.run_uid || '');
  core.setOutput('docker-ci-run-attempt', spec.ociCache?.run_metadata?.run_attempt || '');
  core.setOutput('docker-ci-ref-type', spec.ociCache?.run_metadata?.source_ref_type || '');
  core.setOutput('docker-ci-ref-name', spec.ociCache?.run_metadata?.source_ref_name || '');
  core.setOutput('docker-ci-run-started-at', spec.ociCache?.run_metadata?.run_started_at || '');
  core.setOutput('cache-dir', '');
  core.setOutput('save-cache-dir', '');
}

function setLocalCacheOutputs(cacheDirFrom: string, cacheDirTo: string, cacheMode: string): void {
  core.setOutput('registry-ref', '');
  core.setOutput('cache-from', `type=local,src=${cacheDirFrom}`);
  core.setOutput('cache-to', `type=local,dest=${cacheDirTo},mode=${cacheMode}`);
  core.setOutput('docker-cache-run-ref', '');
  core.setOutput('docker-cache-from-refs', '');
  core.setOutput('docker-cache-requested-from-refs', '');
  core.setOutput('docker-cache-unreadable-from-refs', '');
  core.setOutput('docker-cache-import-ready', 'true');
  core.setOutput('docker-cache-promotion-refs', '');
  core.setOutput('docker-ci-provider', '');
  core.setOutput('docker-ci-run-id', '');
  core.setOutput('docker-ci-run-attempt', '');
  core.setOutput('docker-ci-ref-type', '');
  core.setOutput('docker-ci-ref-name', '');
  core.setOutput('docker-ci-run-started-at', '');
  core.setOutput('cache-dir', cacheDirFrom);
  core.setOutput('save-cache-dir', cacheDirTo);
}

async function inspectDockerTemplate(containerName: string, template: string): Promise<string | null> {
  let output = '';
  const result = await exec.exec('docker', ['inspect', '-f', template, containerName], {
    ignoreReturnCode: true,
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString();
      },
    },
  });

  const value = output.trim();
  if (result !== 0 || !value || value === '<no value>') {
    return null;
  }

  return value;
}

async function getContainerGateway(containerName: string): Promise<string> {
  const directGateway = await inspectDockerTemplate(containerName, '{{.NetworkSettings.Gateway}}');
  if (directGateway) {
    return directGateway;
  }

  const networkGateways = await inspectDockerTemplate(
    containerName,
    '{{range .NetworkSettings.Networks}}{{if .Gateway}}{{.Gateway}}{{"\\n"}}{{end}}{{end}}',
  );
  if (networkGateways) {
    const firstGateway = networkGateways
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (firstGateway) {
      return firstGateway;
    }
  }

  core.warning(`Could not determine gateway for container ${containerName}, falling back to 172.17.0.1`);
  return '172.17.0.1';
}

async function getContainerNetworkMode(containerName: string): Promise<string> {
  const networkMode = await inspectDockerTemplate(containerName, '{{.HostConfig.NetworkMode}}');
  if (!networkMode) {
    core.warning(`Could not determine network mode for container ${containerName}, assuming bridge`);
    return 'bridge';
  }
  return networkMode;
}

async function setupQemuIfNeeded(platforms: string): Promise<void> {
  if (!platforms) {
    return;
  }

  const result = await exec.exec(
    'docker',
    ['run', '--privileged', '--rm', 'tonistiigi/binfmt', '--install', 'all'],
    { ignoreReturnCode: true },
  );

  if (result !== 0) {
    throw new Error(`Failed to set up QEMU for multi-platform builds (exit ${result})`);
  }
}

function buildxBuilderName(): string {
  const runId = String(process.env.GITHUB_RUN_ID || Date.now());
  const actionId = sanitizeBuilderToken(process.env.GITHUB_ACTION || 'one') || 'one';
  const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `boringcache-${runId}-${actionId}-${uniqueSuffix}`;
}

async function setupBuildxBuilder(driver: string, driverOpts: string[], buildkitdConfigInline: string, registryMode: boolean): Promise<string> {
  const builderName = buildxBuilderName();

  let driverToUse = driver || 'docker-container';
  if (driverToUse === 'docker') {
    core.warning('Buildx driver "docker" does not support cache export; falling back to "docker-container".');
    driverToUse = 'docker-container';
  }

  const effectiveDriverOpts = [...driverOpts];
  if (registryMode && driverToUse === 'docker-container' && !effectiveDriverOpts.some((opt) => opt.startsWith('network='))) {
    effectiveDriverOpts.push('network=host');
  }

  let configPath = '';
  if (buildkitdConfigInline.trim()) {
    configPath = path.join(os.tmpdir(), `buildkitd-${Date.now()}.toml`);
    fs.writeFileSync(configPath, buildkitdConfigInline);
  }

  const args = ['buildx', 'create', '--name', builderName, '--driver', driverToUse];
  for (const driverOpt of effectiveDriverOpts) {
    args.push('--driver-opt', driverOpt);
  }
  if (configPath) {
    args.push('--config', configPath);
  }
  args.push('--use');

  const createResult = await exec.exec('docker', args, { ignoreReturnCode: true });
  if (createResult !== 0) {
    throw new Error(`Failed to create buildx builder (exit ${createResult})`);
  }

  return builderName;
}

async function cleanupBuildxBuilder(builderName: string): Promise<void> {
  if (!builderName) {
    return;
  }

  const removeResult = await exec.exec('docker', ['buildx', 'rm', '--force', builderName], {
    ignoreReturnCode: true,
  });
  if (removeResult !== 0) {
    core.warning(`Failed to remove buildx builder ${builderName} (exit ${removeResult})`);
  }
}

async function getBuilderPlatforms(builderName: string): Promise<string> {
  let output = '';
  const result = await exec.exec('docker', ['buildx', 'inspect', builderName, '--bootstrap'], {
    ignoreReturnCode: true,
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString();
      },
    },
  });

  if (result !== 0) {
    return '';
  }

  const line = output.split('\n').find((value) => value.trim().startsWith('Platforms:'));
  return line ? line.replace('Platforms:', '').trim() : '';
}

async function buildDockerImage(opts: DockerBuildOptions): Promise<void> {
  const args = ['buildx', 'build', '--builder', opts.builder, '-f', opts.dockerfile];

  for (const tag of opts.tags) {
    args.push('-t', `${opts.image}:${tag}`);
  }
  for (const buildArg of opts.buildArgs) {
    args.push('--build-arg', buildArg);
  }
  for (const secret of opts.secrets) {
    args.push('--secret', secret);
  }
  if (opts.target) {
    args.push('--target', opts.target);
  }
  if (opts.platforms) {
    args.push('--platform', opts.platforms);
  }
  if (opts.push) {
    args.push('--push');
  }
  if (opts.load) {
    args.push('--load');
  }
  if (opts.noCache) {
    args.push('--no-cache');
  }

  if (opts.cacheFrom?.length) {
    for (const cacheFrom of opts.cacheFrom) {
      args.push('--cache-from', cacheFrom);
    }
  }
  if (opts.cacheTo) {
    args.push('--cache-to', opts.cacheTo);
  } else if (opts.cacheDirFrom) {
    args.push('--cache-from', `type=local,src=${opts.cacheDirFrom}`);
    args.push('--cache-to', `type=local,dest=${opts.cacheDirTo},mode=${opts.cacheMode}`);
  }

  args.push('--metadata-file', DOCKER_METADATA_FILE);
  args.push('.');

  const result = await exec.exec('docker', args, {
    cwd: opts.context,
    env: {
      ...process.env,
      DOCKER_BUILDKIT: '1',
    },
  });

  if (result !== 0) {
    throw new Error(`docker buildx build failed with exit code ${result}`);
  }
}

function readDockerMetadata(): { imageId: string; digest: string } {
  if (!fs.existsSync(DOCKER_METADATA_FILE)) {
    return { imageId: '', digest: '' };
  }

  try {
    const data = JSON.parse(fs.readFileSync(DOCKER_METADATA_FILE, 'utf8'));
    return {
      imageId: data['containerimage.config.digest'] || '',
      digest: data['containerimage.digest'] || '',
    };
  } catch (error) {
    core.warning(`Failed to parse Docker metadata file: ${(error as Error).message}`);
    return { imageId: '', digest: '' };
  }
}

function materializeMaybeFile(value: string, filename: string, rootDir: string): string {
  if (!value.trim()) {
    return '';
  }

  const candidate = path.resolve(rootDir, value);
  if (fs.existsSync(candidate)) {
    return candidate;
  }

  const target = path.join(os.tmpdir(), filename);
  fs.writeFileSync(target, value);
  return target;
}

async function installBuildctl(): Promise<void> {
  addLocalBinPaths();

  try {
    const result = await exec.exec('buildctl', ['--version'], {
      ignoreReturnCode: true,
      silent: true,
    });
    if (result === 0) {
      return;
    }
  } catch {
  }

  const version = 'v0.19.0';
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'buildctl-'));
  const archivePath = path.join(tmpDir, 'buildkit.tar.gz');
  const installDir = path.join(currentHomeDir(), '.local', 'bin');

  try {
    const url = `https://github.com/moby/buildkit/releases/download/${version}/buildkit-${version}.linux-amd64.tar.gz`;
    const curlCode = await exec.exec(
      'curl',
      ['-fsSL', '--output', archivePath, url],
      { ignoreReturnCode: true },
    );
    if (curlCode !== 0) {
      throw new Error(`Failed to download buildctl from ${url}`);
    }

    await exec.exec('tar', ['-xzf', archivePath, '-C', tmpDir]);
    await fs.promises.mkdir(installDir, { recursive: true });
    const srcPath = path.join(tmpDir, 'bin', process.platform === 'win32' ? 'buildctl.exe' : 'buildctl');
    const destPath = path.join(installDir, process.platform === 'win32' ? 'buildctl.exe' : 'buildctl');
    await fs.promises.copyFile(srcPath, destPath);
    if (process.platform !== 'win32') {
      await fs.promises.chmod(destPath, 0o755);
    }
    core.addPath(installDir);
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
}

async function buildWithBuildctl(opts: BuildctlOptions): Promise<void> {
  const args: string[] = ['--addr', opts.addr];

  if (opts.tlsCa || opts.tlsCert || opts.tlsKey) {
    if (opts.tlsCa) {
      args.push('--tlscacert', opts.tlsCa);
    }
    if (opts.tlsCert) {
      args.push('--tlscert', opts.tlsCert);
    }
    if (opts.tlsKey) {
      args.push('--tlskey', opts.tlsKey);
    }
  }
  if (opts.tlsSkipVerify) {
    args.push('--tlsskipverify');
  }

  args.push('build', '--frontend', 'dockerfile.v0');
  args.push('--local', `context=${opts.contextPath}`);
  args.push('--local', `dockerfile=${opts.dockerfileDir}`);
  args.push('--opt', `filename=${opts.dockerfileName}`);

  if (opts.noCache) {
    args.push('--no-cache');
  }
  if (opts.platforms) {
    args.push('--opt', `platform=${opts.platforms}`);
  }
  if (opts.target) {
    args.push('--opt', `target=${opts.target}`);
  }

  for (const buildArg of opts.buildArgs) {
    args.push('--opt', `build-arg:${buildArg}`);
  }
  for (const secret of opts.secrets) {
    args.push('--secret', secret);
  }
  for (const ssh of opts.sshSpecs) {
    args.push('--ssh', ssh);
  }

  if (opts.importCache?.length) {
    for (const importCache of opts.importCache) {
      args.push('--import-cache', importCache);
    }
  }
  if (opts.exportCache) {
    args.push('--export-cache', opts.exportCache);
  } else if (opts.cacheDirFrom) {
    args.push('--import-cache', `type=local,src=${opts.cacheDirFrom}`);
    args.push('--export-cache', `type=local,dest=${opts.cacheDirTo},mode=${opts.cacheMode}`);
  }

  if (opts.output?.trim()) {
    args.push('--output', opts.output.trim());
  } else {
    const nameParams = opts.imageTags.map((tag) => `name=${tag}`).join(',');
    args.push('--output', `type=image,${nameParams},push=${opts.push ? 'true' : 'false'}`);
  }

  args.push('--metadata-file', opts.metadataFile);

  const result = await exec.exec('buildctl', args);
  if (result !== 0) {
    throw new Error(`buildctl failed with exit code ${result}`);
  }
}

function readBuildkitDigest(metadataFile: string): string {
  if (!fs.existsSync(metadataFile)) {
    return '';
  }

  try {
    const data = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    return data['containerimage.digest'] || '';
  } catch (error) {
    core.warning(`Failed to parse BuildKit metadata file: ${(error as Error).message}`);
    return '';
  }
}

async function execRustBoringCache(args: string[]): Promise<number> {
  return execBoringCache(args);
}

function getCargoHome(): string {
  return process.env.CARGO_HOME || path.join(currentHomeDir(), '.cargo');
}

function configureCargoEnv(): void {
  const cargoHome = getCargoHome();
  process.env.CARGO_HOME = cargoHome;
  core.exportVariable('CARGO_HOME', cargoHome);
  core.addPath(path.join(cargoHome, 'bin'));
  core.exportVariable('CARGO_INCREMENTAL', '0');
  core.exportVariable('CARGO_TERM_COLOR', 'always');
}

async function setupRustToolchain(version: string, options: { profile?: string; targets?: string; components?: string }): Promise<void> {
  const profile = options.profile || 'minimal';
  await exec.exec('rustup', ['toolchain', 'install', version, '--profile', profile, '--no-self-update']);
  await exec.exec('rustup', ['default', version]);

  for (const target of parseList(options.targets || '', /,/)) {
    await exec.exec('rustup', ['target', 'add', target]);
  }
  for (const component of parseList(options.components || '', /,/)) {
    await exec.exec('rustup', ['component', 'add', component]);
  }
  await exec.exec('rustc', ['--version']);
}

async function detectRustVersion(workingDir: string, inputVersion: string): Promise<string> {
  if (inputVersion) {
    return inputVersion;
  }

  const toolchainToml = path.join(workingDir, 'rust-toolchain.toml');
  try {
    const content = await fs.promises.readFile(toolchainToml, 'utf-8');
    const match = content.match(/channel\s*=\s*["']([^"']+)["']/);
    if (match?.[1]) {
      return match[1];
    }
  } catch {
  }

  const toolchainFile = path.join(workingDir, 'rust-toolchain');
  try {
    return (await fs.promises.readFile(toolchainFile, 'utf-8')).trim();
  } catch {
  }

  const toolVersionsFile = path.join(workingDir, '.tool-versions');
  try {
    const content = await fs.promises.readFile(toolVersionsFile, 'utf-8');
    const rustLine = content.split('\n').find((line) => line.startsWith('rust '));
    if (rustLine) {
      return rustLine.split(/\s+/)[1].trim();
    }
  } catch {
  }

  return 'stable';
}

async function hasGitDependencies(lockPath: string): Promise<boolean> {
  try {
    const content = await fs.promises.readFile(lockPath, 'utf-8');
    return content.includes('source = "git+');
  } catch {
    return false;
  }
}

function getSccacheDir(): string {
  return process.env.SCCACHE_DIR || path.join(currentHomeDir(), '.cache', 'sccache');
}

function configureSccacheEnv(cacheSize: string): void {
  const sccacheDir = getSccacheDir();
  process.env.RUSTC_WRAPPER = 'sccache';
  core.exportVariable('RUSTC_WRAPPER', 'sccache');
  process.env.SCCACHE_DIR = sccacheDir;
  core.exportVariable('SCCACHE_DIR', sccacheDir);
  process.env.SCCACHE_CACHE_SIZE = cacheSize;
  core.exportVariable('SCCACHE_CACHE_SIZE', cacheSize);
  core.exportVariable('CC', 'sccache cc');
  core.exportVariable('CXX', 'sccache c++');
  core.exportVariable('SCCACHE_IDLE_TIMEOUT', process.env.SCCACHE_IDLE_TIMEOUT || '0');
  fs.mkdirSync(sccacheDir, { recursive: true });
}

async function startSccacheServer(): Promise<void> {
  await exec.exec('sccache', ['--start-server'], { ignoreReturnCode: true });
}

async function installSccache(versionInput = '0.14.0'): Promise<void> {
  addLocalBinPaths();

  if (await hasToolVersionOnPath('sccache', versionInput)) {
    core.info(`Using existing sccache ${versionInput} from PATH`);
    return;
  }

  const normalizedVersion = versionInput.startsWith('v') ? versionInput : `v${versionInput}`;
  let assetName: string | null = null;
  if (process.platform === 'linux') {
    if (process.arch === 'x64') {
      assetName = `sccache-${normalizedVersion}-x86_64-unknown-linux-musl`;
    } else if (process.arch === 'arm64') {
      assetName = `sccache-${normalizedVersion}-aarch64-unknown-linux-musl`;
    }
  } else if (process.platform === 'darwin' && process.arch === 'arm64') {
    assetName = `sccache-${normalizedVersion}-aarch64-apple-darwin`;
  } else if (process.platform === 'win32' && process.arch === 'x64') {
    assetName = `sccache-${normalizedVersion}-x86_64-pc-windows-msvc`;
  }

  if (!assetName) {
    await exec.exec('cargo', ['install', 'sccache', '--locked']);
    return;
  }

  const extension = process.platform === 'win32' ? '.zip' : '.tar.gz';
  const url = `https://github.com/mozilla/sccache/releases/download/${normalizedVersion}/${assetName}${extension}`;
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sccache-'));
  const archivePath = path.join(tempDir, `sccache${extension}`);

  try {
    const curlCode = await exec.exec('curl', ['-sS', '--fail', '--location', '--output', archivePath, url], {
      ignoreReturnCode: true,
    });
    if (curlCode !== 0) {
      throw new Error(`Failed to download sccache from ${url}`);
    }

    if (process.platform === 'win32') {
      await exec.exec('unzip', ['-q', archivePath, '-d', tempDir]);
    } else {
      await exec.exec('tar', ['-xzf', archivePath, '-C', tempDir]);
    }

    const installDir = path.join(currentHomeDir(), '.local', 'bin');
    await fs.promises.mkdir(installDir, { recursive: true });
    const binaryName = process.platform === 'win32' ? 'sccache.exe' : 'sccache';
    const srcPath = path.join(tempDir, assetName, binaryName);
    const destPath = path.join(installDir, binaryName);
    await fs.promises.copyFile(srcPath, destPath);
    if (process.platform !== 'win32') {
      await fs.promises.chmod(destPath, 0o755);
    }
    core.addPath(installDir);
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

async function stopSccacheServer(): Promise<SccacheStatsSummary | null> {
  let output = '';

  try {
    await exec.exec('sccache', ['--show-stats'], {
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => {
          const text = data.toString();
          output += text;
          process.stdout.write(text);
        },
        stderr: (data: Buffer) => {
          const text = data.toString();
          output += text;
          process.stderr.write(text);
        },
      },
    });
  } catch {
  } finally {
    try {
      await exec.exec('sccache', ['--stop-server'], { ignoreReturnCode: true });
    } catch {
    }
  }

  return summarizeSccacheStats(output);
}

async function startPortableCacheProxy(
  workspace: string,
  port: number,
  tag: string,
  readOnly = false,
  proxyPlan: CliProxyDryRunPlan,
): Promise<{ pid: number; port: number }> {
  const proxy = await startRegistryProxy(actionProxyOptions({
    command: 'cache-registry',
    workspace,
    tag,
    host: proxyPlan.host || '127.0.0.1',
    port,
    noPlatform: proxyPlan.no_platform,
    noGit: proxyPlan.no_git,
    readOnly,
  }, proxyPlan));
  return proxy;
}

function parseSccacheIntegerStat(output: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = output.match(new RegExp(`^${escaped}\\s+(\\d+)$`, 'm'));
  return match ? Number.parseInt(match[1], 10) : null;
}

function parseSccacheTextStat(output: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = output.match(new RegExp(`^${escaped}\\s+(.+)$`, 'm'));
  return match ? match[1].trim() : null;
}

function summarizeSccacheStats(output: string): SccacheStatsSummary | null {
  if (!output.trim()) {
    return null;
  }

  const compileRequests = parseSccacheIntegerStat(output, 'Compile requests');
  const cacheHits = parseSccacheIntegerStat(output, 'Cache hits');
  const cacheMisses = parseSccacheIntegerStat(output, 'Cache misses');

  if (compileRequests === null || cacheHits === null || cacheMisses === null) {
    return null;
  }

  return {
    compileRequests,
    cacheHits,
    cacheMisses,
    rustHitRate: parseSccacheTextStat(output, 'Cache hits rate (Rust)'),
  };
}

async function checkRustTagHit(
  workspace: string,
  tag: string,
  {
    noPlatform = false,
    noGit = false,
    requireServerSignature = false,
  }: { noPlatform?: boolean; noGit?: boolean; requireServerSignature?: boolean } = {},
): Promise<boolean> {
  const args = ['check', workspace, tag, '--json'];
  if (requireServerSignature) {
    args.unshift('--require-server-signature');
  }
  if (noPlatform) {
    args.push('--no-platform');
  }
  if (noGit) {
    args.push('--no-git');
  }

  let stdout = '';
  const exitCode = await execBoringCache(args, {
    ignoreReturnCode: true,
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString();
      },
    },
  });
  if (exitCode !== 0) {
    return false;
  }

  try {
    const summary = JSON.parse(stdout) as CliCheckSummary;
    if (typeof summary.hits === 'number') {
      return summary.hits > 0;
    }
    return (summary.results || []).some((result) => result.status === 'hit');
  } catch (error) {
    core.warning(`Failed to parse boringcache check JSON for ${tag}: ${(error as Error).message}`);
    return false;
  }
}

function configureTurboRemoteEnv(apiUrl: string, token: string, team?: string): void {
  core.exportVariable('TURBO_API', apiUrl);
  core.exportVariable('TURBO_TOKEN', token);
  core.exportVariable('TURBO_TEAM', team || 'team_boringcache');
}

function rewritePlannedProxyPort(value: string, plannedPort: number, actualPort: number): string {
  if (plannedPort === actualPort) {
    return value;
  }
  return value.replace(new RegExp(`:${plannedPort}(?=/|$)`), `:${actualPort}`);
}

function turboEnvForStartedProxy(
  plan: CliAdapterDryRunPlan,
  actualPort: number,
  tokenOverride: string,
  teamOverride: string,
): Record<string, string> {
  const envVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(plan.env_vars || {})) {
    envVars[key] = rewritePlannedProxyPort(value, plan.proxy.port, actualPort);
  }

  const endpointHost = plan.proxy.endpoint_host || '127.0.0.1';
  envVars.TURBO_API = `http://${endpointHost}:${actualPort}`;
  envVars.TURBO_TOKEN = tokenOverride.trim()
    || envVars.TURBO_TOKEN
    || 'boringcache';
  envVars.TURBO_TEAM = teamOverride.trim()
    || envVars.TURBO_TEAM
    || 'boringcache';
  envVars.BORINGCACHE_PROXY_PORT = String(actualPort);

  return envVars;
}

function nxEnvForStartedProxy(
  plan: CliAdapterDryRunPlan,
  actualPort: number,
  accessTokenOverride: string,
): Record<string, string> {
  const envVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(plan.env_vars || {})) {
    envVars[key] = rewritePlannedProxyPort(value, plan.proxy.port, actualPort);
  }

  const endpointHost = plan.proxy.endpoint_host || '127.0.0.1';
  envVars.NX_SELF_HOSTED_REMOTE_CACHE_SERVER = `http://${endpointHost}:${actualPort}`;
  envVars.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN = accessTokenOverride.trim()
    || envVars.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN
    || 'boringcache';
  envVars.BORINGCACHE_PROXY_PORT = String(actualPort);

  return envVars;
}

function resolveNodePackageManagerCacheDir(
  packageManager: Awaited<ReturnType<typeof detectNodePackageManager>>,
): string | null {
  if (!packageManager) {
    return null;
  }

  switch (packageManager.name) {
    case 'pnpm':
      return process.env.PNPM_STORE_DIR || process.env.NPM_CONFIG_STORE_DIR || packageManager.cacheDir;
    case 'yarn':
      return process.env.YARN_CACHE_FOLDER || packageManager.cacheDir;
    case 'npm':
      return process.env.npm_config_cache || process.env.NPM_CONFIG_CACHE || packageManager.cacheDir;
  }
}

function configureNodePackageManagerEnv(packageManager: Awaited<ReturnType<typeof detectNodePackageManager>>): string | null {
  if (!packageManager) {
    return null;
  }

  const cacheDir = resolveNodePackageManagerCacheDir(packageManager);
  if (!cacheDir) {
    return null;
  }

  ensureDir(cacheDir);
  switch (packageManager.name) {
    case 'pnpm':
      core.exportVariable('PNPM_STORE_DIR', cacheDir);
      core.exportVariable('NPM_CONFIG_STORE_DIR', cacheDir);
      break;
    case 'yarn':
      core.exportVariable('YARN_CACHE_FOLDER', cacheDir);
      core.exportVariable('YARN_ENABLE_GLOBAL_CACHE', 'false');
      break;
    case 'npm':
      core.exportVariable('npm_config_cache', cacheDir);
      core.exportVariable('NPM_CONFIG_CACHE', cacheDir);
      break;
  }

  return cacheDir;
}

async function ensureCorepackPackageManager(
  workingDirectory: string,
  packageManager: Awaited<ReturnType<typeof detectNodePackageManager>>,
  runtimeTools: ToolSpec[],
): Promise<void> {
  if (!packageManager || packageManager.name === 'npm' || runtimeTools.some((tool) => tool.name === packageManager.name)) {
    return;
  }

  const corepackEnabled = await exec.exec('corepack', ['enable'], { cwd: workingDirectory, ignoreReturnCode: true });
  if (corepackEnabled !== 0) {
    core.notice(`corepack enable failed for ${packageManager.name}; continuing without corepack bootstrap`);
    return;
  }

  if (packageManager.packageManagerField) {
    await exec.exec('corepack', ['install'], { cwd: workingDirectory, ignoreReturnCode: true });
    return;
  }

  if (packageManager.version) {
    await exec.exec(
      'corepack',
      ['prepare', `${packageManager.name}@${packageManager.version}`, '--activate'],
      { cwd: workingDirectory, ignoreReturnCode: true },
    );
  }
}

function sccacheEnvForStartedProxy(
  plan: CliAdapterDryRunPlan,
  actualPort: number,
): Record<string, string> {
  const envVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(plan.env_vars || {})) {
    envVars[key] = rewritePlannedProxyPort(value, plan.proxy.port, actualPort);
  }

  envVars.SCCACHE_IDLE_TIMEOUT = process.env.SCCACHE_IDLE_TIMEOUT
    || envVars.SCCACHE_IDLE_TIMEOUT
    || '0';
  return envVars;
}

function getRustArchiveEntry(
  entries: Map<string, ResolvedCliArchiveEntry>,
  requested: string,
  description: string,
): ResolvedCliArchiveEntry {
  const entry = entries.get(requested);
  if (!entry?.path?.trim()) {
    throw new Error(`CLI dry-run did not resolve a ${description} path for ${requested}.`);
  }
  return entry;
}

function saveRustArchiveEntryState(key: string, entry: ResolvedCliArchiveEntry): void {
  saveModeState(`${key}-tag`, entry.tag);
  saveModeState(`${key}-path`, entry.path);
}

function readRustArchiveEntryState(key: string): ResolvedCliArchiveEntry | null {
  const tag = getModeState(`${key}-tag`);
  const entryPath = getModeState(`${key}-path`);
  if (!tag || !entryPath) {
    return null;
  }
  return {
    requested: key,
    tag,
    path: entryPath,
    tagPathPair: `${tag}:${entryPath}`,
  };
}

function buildRustCacheArgs(
  action: 'restore' | 'save',
  workspace: string,
  entry: ResolvedCliArchiveEntry,
  verbose: boolean,
  exclude = '',
): string[] {
  const args = [action, workspace, entry.tagPathPair];
  if (verbose) {
    args.push('--verbose');
  }
  if (action === 'save' && exclude) {
    args.push('--exclude', exclude);
  }
  return args;
}

async function restoreRustArchiveEntry(
  workspace: string,
  entry: ResolvedCliArchiveEntry,
  verbose: boolean,
): Promise<boolean> {
  const preflightHit = await checkRustTagHit(workspace, entry.tag);
  const exitCode = await execRustBoringCache(buildRustCacheArgs('restore', workspace, entry, verbose));
  return preflightHit && exitCode === 0;
}

function toolEnabled(plan: ResolvedPlan, toolName: string): boolean {
  return plan.runtimeTools.some((tool: ToolSpec) => tool.name === toolName);
}

async function runDockerRestore(plan: ResolvedPlan, inputs: OneInputs): Promise<ModeRestoreResult> {
  const context = path.resolve(plan.workingDirectory, core.getInput('context') || '.');
  const dockerfile = core.getInput('dockerfile') || 'Dockerfile';
  const dockerCommand = core.getInput('docker-command') || 'build';
  const shouldBuild = dockerCommand !== 'setup';
  const imageInput = core.getInput('image') || '';
  const image = shouldBuild
    ? core.getInput('image', { required: true })
    : (imageInput || 'boringcache/docker-setup');
  const tags = parseList(core.getInput('tags') || 'latest');
  const buildArgs = parseMultiline(core.getInput('build-args') || '');
  const secrets = parseMultiline(core.getInput('secrets') || '');
  const target = core.getInput('target') || '';
  const platforms = core.getInput('platforms') || '';
  const push = parseBoolean(core.getInput('push'), false);
  const load = parseBoolean(core.getInput('load'), true) && !platforms;
  const noCache = parseBoolean(core.getInput('no-cache'), false);
  const cacheMode = core.getInput('cache-mode') || 'max';
  const driver = core.getInput('driver') || 'docker-container';
  const driverOpts = parseMultiline(core.getInput('driver-opts') || '');
  const buildkitdConfigInline = core.getInput('buildkitd-config-inline') || '';
  const cacheBackend = core.getInput('cache-backend') || 'registry';
  const registryTagInput = core.getInput('registry-tag') || '';
  const registryRefTagInput = core.getInput('registry-ref-tag') || '';
  const localCacheTag = inputs.cacheTag || slugify(image);
  const cacheFlags: CacheFlags = { verbose: inputs.verbose, exclude: inputs.exclude };
  const useRegistryProxy = cacheBackend !== 'local';
  let registryVerification: { noPlatform: boolean; noGit: boolean; saveExpected: boolean } | null = null;
  let resolvedWorkspace = plan.workspace;
  let resolvedCacheTag = localCacheTag;

  saveModeState('workspace', plan.workspace);
  saveModeState('cache-tag', localCacheTag);
  saveModeState('verbose', String(inputs.verbose));
  saveModeState('exclude', inputs.exclude);

  const builderName = await setupBuildxBuilder(driver, driverOpts, buildkitdConfigInline, useRegistryProxy);
  saveModeState('builder-name', builderName);
  core.setOutput('buildx-name', builderName);
  core.setOutput('buildx-platforms', await getBuilderPlatforms(builderName));
  await setupQemuIfNeeded(platforms);

  if (useRegistryProxy) {
    let proxyBindHost = '127.0.0.1';
    let refHost = '127.0.0.1';

    if (driver === 'docker-container') {
      const containerName = `buildx_buildkit_${builderName}0`;
      const networkMode = await getContainerNetworkMode(containerName);
      if (networkMode !== 'host') {
        proxyBindHost = '0.0.0.0';
        refHost = await getContainerGateway(containerName);
      }
    }

    const requestedPort = parseInt(inputs.proxyPort || '5000', 10);
    const dockerPlan = await resolveDockerCliPlan(
      plan.workspace,
      plan.workingDirectory,
      getEffectiveRegistryTag(localCacheTag, registryTagInput),
      requestedPort,
      proxyBindHost,
      refHost,
      inputs.proxyNoPlatform,
      inputs.proxyNoGit,
      proxyPlanningReadOnly(inputs.readOnly),
      cacheMode,
      registryRefTagInput || DEFAULT_REGISTRY_CACHE_REF_TAG,
      inputs.ociHydration,
      inputs.metadataHints,
    );
    const requestedImportRefTags = registryCacheFromRefTags(dockerPlan.oci_cache);
    const cacheTag = dockerPlan.tag;
    const proxy = await startRegistryProxy(actionProxyOptions({
      command: 'cache-registry',
      workspace: dockerPlan.workspace,
      tag: cacheTag,
      host: dockerPlan.proxy.host || proxyBindHost,
      port: dockerPlan.proxy.port,
      noGit: dockerPlan.proxy.no_git,
      noPlatform: dockerPlan.proxy.no_platform,
      verbose: inputs.verbose,
      readOnly: dockerPlan.proxy.read_only,
      ociRequiredReadableRefs: requestedImportRefTags,
      ociAliasPromotionRefs: dockerPlan.oci_cache?.promotion_ref_tags || [],
    }, dockerPlan.proxy));
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy.port);
    saveModeState('workspace', dockerPlan.workspace);
    saveModeState('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    resolvedWorkspace = dockerPlan.workspace;
    resolvedCacheTag = cacheTag;
    registryVerification = {
      noPlatform: dockerPlan.proxy.no_platform,
      noGit: dockerPlan.proxy.no_git,
      saveExpected: !dockerPlan.proxy.read_only,
    };
    const effectiveImports = effectiveRegistryCacheImports(dockerPlan.oci_cache!, proxy);

    setRegistryCacheOutputs({
      ref: dockerPlan.oci_cache!.registry_ref,
      from: effectiveImports.importSpecs,
      to: dockerPlan.oci_cache!.cache_to,
      ociCache: dockerPlan.oci_cache,
      usedRefTags: effectiveImports.readableRefTags,
      unreadableRefTags: effectiveImports.unreadableRefTags,
      importReady: effectiveImports.importReady,
    });

    if (shouldBuild) {
      await buildDockerImage({
        dockerfile,
        context,
        image,
        tags,
        buildArgs,
        secrets,
        target,
        platforms,
        push,
        load,
        noCache,
        builder: builderName,
        cacheMode,
        cacheFrom: effectiveImports.importSpecs,
        cacheTo: dockerPlan.oci_cache!.cache_to,
      });
    }
  } else {
    ensureDir(DOCKER_CACHE_DIR_FROM);
    ensureDir(DOCKER_CACHE_DIR_TO);
    saveModeState('cache-dir', DOCKER_CACHE_DIR_TO);
    await restoreSimpleCache(plan.workspace, localCacheTag, DOCKER_CACHE_DIR_FROM, cacheFlags);
    setLocalCacheOutputs(DOCKER_CACHE_DIR_FROM, DOCKER_CACHE_DIR_TO, cacheMode);

    if (shouldBuild) {
      await buildDockerImage({
        dockerfile,
        context,
        image,
        tags,
        buildArgs,
        secrets,
        target,
        platforms,
        push,
        load,
        noCache,
        builder: builderName,
        cacheMode,
        cacheDirFrom: DOCKER_CACHE_DIR_FROM,
        cacheDirTo: DOCKER_CACHE_DIR_TO,
      });
    }
  }

  if (shouldBuild) {
    const { imageId, digest } = readDockerMetadata();
    core.setOutput('image-id', imageId);
    core.setOutput('digest', digest);
  }
  core.setOutput('workspace', resolvedWorkspace);
  core.setOutput('cache-tag', resolvedCacheTag);
  return {
    cacheTag: resolvedCacheTag,
    verificationSpecs: [{
      tag: resolvedCacheTag,
      noPlatform: registryVerification?.noPlatform || false,
      noGit: registryVerification?.noGit || false,
      pathHint: plan.workingDirectory,
      // docker-command=setup defers the build to later workflow steps, so treat
      // this as save-expected in write-capable runs and verify after post-save.
      saveExpected: registryVerification?.saveExpected ?? !inputs.readOnly,
    }],
  };
}

async function runDockerSave(): Promise<void> {
  const builderName = getModeState('builder-name');

  try {
    const proxyPid = getModeState('proxy-pid');
    if (proxyPid) {
      await stopRegistryProxy(parseInt(proxyPid, 10));
      return;
    }

    const workspace = getModeState('workspace');
    const cacheDir = getModeState('cache-dir');
    const cacheTag = getModeState('cache-tag');
    if (!workspace || !cacheDir || !cacheTag) {
      return;
    }

    addLocalBinPaths();
    await saveSimpleCache(workspace, cacheTag, cacheDir, {
      verbose: getModeState('verbose') === 'true',
      exclude: getModeState('exclude'),
    });
  } finally {
    await cleanupBuildxBuilder(builderName);
  }
}

async function runBuildkitRestore(plan: ResolvedPlan, inputs: OneInputs): Promise<ModeRestoreResult> {
  const workspaceRoot = process.env.GITHUB_WORKSPACE || plan.workingDirectory;
  const contextInput = core.getInput('context') || '.';
  const contextPath = path.resolve(plan.workingDirectory, contextInput);
  const dockerfileInput = core.getInput('dockerfile') || 'Dockerfile';
  const dockerfilePath = path.resolve(plan.workingDirectory, contextInput, dockerfileInput);
  const dockerfileDir = path.dirname(dockerfilePath);
  const dockerfileName = path.basename(dockerfilePath);

  if (!fs.existsSync(contextPath)) {
    throw new Error(`Context path does not exist: ${contextPath}`);
  }
  if (!fs.existsSync(dockerfilePath)) {
    throw new Error(`Dockerfile does not exist: ${dockerfilePath}`);
  }

  const image = core.getInput('image', { required: true });
  const tags = parseList(core.getInput('tags') || 'latest');
  const imageTags = tags.length > 0 ? tags.map((tag) => `${image}:${tag}`) : [`${image}:latest`];
  const push = parseBoolean(core.getInput('push'), false);
  const output = core.getInput('output') || '';
  const buildArgs = parseMultiline(core.getInput('build-args') || '');
  const secrets = parseMultiline(core.getInput('secrets') || '');
  const sshSpecs = parseMultiline(core.getInput('ssh') || '');
  const target = core.getInput('target') || '';
  const platforms = core.getInput('platforms') || '';
  const noCache = parseBoolean(core.getInput('no-cache'), false);
  const cacheMode = core.getInput('cache-mode') || 'max';
  const buildkitHost = core.getInput('buildkit-host', { required: true });
  const tlsCaInput = core.getInput('buildkit-tls-ca') || '';
  const tlsCertInput = core.getInput('buildkit-tls-cert') || '';
  const tlsKeyInput = core.getInput('buildkit-tls-key') || '';
  const tlsSkipVerify = parseBoolean(core.getInput('buildkit-tls-skip-verify'), false);
  const cacheBackend = core.getInput('cache-backend') || 'registry';
  const registryTagInput = core.getInput('registry-tag') || '';
  const registryRefTagInput = core.getInput('registry-ref-tag') || '';
  const localCacheTag = inputs.cacheTag || slugify(image);
  const cacheFlags: CacheFlags = { verbose: inputs.verbose, exclude: inputs.exclude };
  const useRegistryProxy = cacheBackend !== 'local';
  let registryVerification: { noPlatform: boolean; noGit: boolean; saveExpected: boolean } | null = null;
  let resolvedWorkspace = plan.workspace;
  let resolvedCacheTag = localCacheTag;

  saveModeState('workspace', plan.workspace);
  saveModeState('cache-tag', localCacheTag);
  saveModeState('verbose', String(inputs.verbose));
  saveModeState('exclude', inputs.exclude);

  if (fs.existsSync(BUILDKIT_METADATA_FILE)) {
    fs.rmSync(BUILDKIT_METADATA_FILE);
  }

  await installBuildctl();
  const tlsCa = materializeMaybeFile(tlsCaInput, 'buildkit-ca.pem', workspaceRoot);
  const tlsCert = materializeMaybeFile(tlsCertInput, 'buildkit-cert.pem', workspaceRoot);
  const tlsKey = materializeMaybeFile(tlsKeyInput, 'buildkit-key.pem', workspaceRoot);

  if (useRegistryProxy) {
    let proxyBindHost = '127.0.0.1';
    let refHost = '127.0.0.1';

    if (buildkitHost.startsWith('docker-container://')) {
      const containerName = buildkitHost.replace('docker-container://', '');
      const networkMode = await getContainerNetworkMode(containerName);
      if (networkMode !== 'host') {
        proxyBindHost = '0.0.0.0';
        refHost = await getContainerGateway(containerName);
      }
    }

    const requestedPort = parseInt(inputs.proxyPort || '5000', 10);
    const dockerPlan = await resolveDockerCliPlan(
      plan.workspace,
      plan.workingDirectory,
      getEffectiveRegistryTag(localCacheTag, registryTagInput),
      requestedPort,
      proxyBindHost,
      refHost,
      inputs.proxyNoPlatform,
      inputs.proxyNoGit,
      proxyPlanningReadOnly(inputs.readOnly),
      cacheMode,
      registryRefTagInput || DEFAULT_REGISTRY_CACHE_REF_TAG,
      inputs.ociHydration,
      inputs.metadataHints,
    );
    const requestedImportRefTags = registryCacheFromRefTags(dockerPlan.oci_cache);
    const cacheTag = dockerPlan.tag;
    const proxy = await startRegistryProxy(actionProxyOptions({
      command: 'cache-registry',
      workspace: dockerPlan.workspace,
      tag: cacheTag,
      host: dockerPlan.proxy.host || proxyBindHost,
      port: dockerPlan.proxy.port,
      noGit: dockerPlan.proxy.no_git,
      noPlatform: dockerPlan.proxy.no_platform,
      verbose: inputs.verbose,
      readOnly: dockerPlan.proxy.read_only,
      ociRequiredReadableRefs: requestedImportRefTags,
      ociAliasPromotionRefs: dockerPlan.oci_cache?.promotion_ref_tags || [],
    }, dockerPlan.proxy));
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy.port);
    saveModeState('workspace', dockerPlan.workspace);
    saveModeState('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    resolvedWorkspace = dockerPlan.workspace;
    resolvedCacheTag = cacheTag;
    registryVerification = {
      noPlatform: dockerPlan.proxy.no_platform,
      noGit: dockerPlan.proxy.no_git,
      saveExpected: !dockerPlan.proxy.read_only,
    };
    const effectiveImports = effectiveRegistryCacheImports(dockerPlan.oci_cache!, proxy);
    setRegistryCacheOutputs({
      ref: dockerPlan.oci_cache!.registry_ref,
      from: effectiveImports.importSpecs,
      to: dockerPlan.oci_cache!.cache_to,
      ociCache: dockerPlan.oci_cache,
      usedRefTags: effectiveImports.readableRefTags,
      unreadableRefTags: effectiveImports.unreadableRefTags,
      importReady: effectiveImports.importReady,
    });
    await buildWithBuildctl({
      addr: buildkitHost,
      tlsCa,
      tlsCert,
      tlsKey,
      tlsSkipVerify,
      contextPath,
      dockerfileDir,
      dockerfileName,
      buildArgs,
      secrets,
      sshSpecs,
      target,
      platforms,
      cacheMode,
      importCache: effectiveImports.importSpecs,
      exportCache: dockerPlan.oci_cache!.cache_to,
      output,
      imageTags,
      push,
      noCache,
      metadataFile: BUILDKIT_METADATA_FILE,
    });
  } else {
    ensureDir(BUILDKIT_CACHE_DIR_FROM);
    ensureDir(BUILDKIT_CACHE_DIR_TO);
    saveModeState('cache-dir', BUILDKIT_CACHE_DIR_TO);
    await restoreSimpleCache(plan.workspace, localCacheTag, BUILDKIT_CACHE_DIR_FROM, cacheFlags);
    setLocalCacheOutputs(BUILDKIT_CACHE_DIR_FROM, BUILDKIT_CACHE_DIR_TO, cacheMode);

    await buildWithBuildctl({
      addr: buildkitHost,
      tlsCa,
      tlsCert,
      tlsKey,
      tlsSkipVerify,
      contextPath,
      dockerfileDir,
      dockerfileName,
      buildArgs,
      secrets,
      sshSpecs,
      target,
      platforms,
      cacheMode,
      cacheDirFrom: BUILDKIT_CACHE_DIR_FROM,
      cacheDirTo: BUILDKIT_CACHE_DIR_TO,
      output,
      imageTags,
      push,
      noCache,
      metadataFile: BUILDKIT_METADATA_FILE,
    });
  }

  core.setOutput('digest', readBuildkitDigest(BUILDKIT_METADATA_FILE));
  core.setOutput('workspace', resolvedWorkspace);
  core.setOutput('cache-tag', resolvedCacheTag);
  return {
    cacheTag: resolvedCacheTag,
    verificationSpecs: [{
      tag: resolvedCacheTag,
      noPlatform: registryVerification?.noPlatform || false,
      noGit: registryVerification?.noGit || false,
      pathHint: plan.workingDirectory,
      saveExpected: registryVerification?.saveExpected ?? !inputs.readOnly,
    }],
  };
}

async function runBuildkitSave(): Promise<void> {
  const proxyPid = getModeState('proxy-pid');
  if (proxyPid) {
    await stopRegistryProxy(parseInt(proxyPid, 10));
    return;
  }

  const workspace = getModeState('workspace');
  const cacheDir = getModeState('cache-dir');
  const cacheTag = getModeState('cache-tag');
  if (!workspace || !cacheDir || !cacheTag) {
    return;
  }

  addLocalBinPaths();
  await saveSimpleCache(workspace, cacheTag, cacheDir, {
    verbose: getModeState('verbose') === 'true',
    exclude: getModeState('exclude'),
  });
}

async function runBazelRestore(plan: ResolvedPlan, inputs: OneInputs): Promise<ModeRestoreResult> {
  const inputVersion = core.getInput('bazel-version') || '';
  const bazelrcLines = core.getInput('bazelrc-lines') || '';
  const runtimeVersion = plan.runtimeTools.find((tool) => tool.name === 'bazel')?.version || '';
  const bazelVersion = inputVersion || runtimeVersion;
  const requestedPort = parseInt(inputs.proxyPort || '0', 10) || await findAvailablePort();
  const proxyPlan = await resolveAdapterCliPlan(
    'bazel',
    plan.workspace,
    plan.workingDirectory,
    inputs.cacheTag,
    requestedPort,
    inputs.proxyNoPlatform,
    inputs.proxyNoGit,
    proxyPlanningReadOnly(inputs.readOnly),
    {
      metadataHintsInput: inputs.metadataHints,
      bazelrcLines,
    },
  );
  const workspace = proxyPlan.workspace;
  const cacheTag = proxyPlan.tag;
  const setup = requireAdapterSetupPlan('bazel', proxyPlan.setup);

  saveModeState('proxy-pid', '');
  if (bazelVersion) {
    core.exportVariable('USE_BAZEL_VERSION', bazelVersion);
  }

  const proxy = await startRegistryProxy(actionProxyOptions({
    command: 'cache-registry',
    workspace,
    tag: cacheTag,
    host: proxyPlan.proxy.host || '127.0.0.1',
    port: proxyPlan.proxy.port,
    noGit: proxyPlan.proxy.no_git,
    noPlatform: proxyPlan.proxy.no_platform,
    verbose: inputs.verbose,
    readOnly: proxyPlan.proxy.read_only,
  }, proxyPlan.proxy));
  saveModeState('proxy-pid', String(proxy.pid));
  saveProxyModeState(proxy.port);

  applyAdapterSetupPlan(setup);
  core.setOutput('cache-tag', cacheTag);
  setProxyOutputs(proxy.port);
  core.setOutput('workspace', workspace);
  return {
    cacheTag,
    verificationSpecs: [adapterProxyVerificationSpec(cacheTag, proxyPlan.proxy, plan.workingDirectory)],
  };
}

function configureGoProxyEnv(gocacheprog: string): void {
  core.exportVariable('GOCACHEPROG', gocacheprog);
}

function goCacheProgForProxy(proxyPlan: CliAdapterDryRunPlan, port: number): string {
  const endpoint = `http://${proxyPlan.proxy.endpoint_host}:${port}`;
  const planned = proxyPlan.env_vars?.GOCACHEPROG?.trim();
  if (!planned) {
    return `boringcache go-cacheprog --endpoint ${endpoint}`;
  }
  if (planned.includes('--endpoint=')) {
    return planned.replace(/--endpoint=\S+/, `--endpoint=${endpoint}`);
  }
  if (planned.includes('--endpoint')) {
    return planned.replace(/--endpoint\s+\S+/, `--endpoint ${endpoint}`);
  }
  return `${planned} --endpoint ${endpoint}`;
}

async function runGoRestore(plan: ResolvedPlan, inputs: OneInputs): Promise<ModeRestoreResult> {
  const requestedPort = parseInt(inputs.proxyPort || '0', 10) || await findAvailablePort();
  const proxyPlan = await resolveAdapterCliPlan(
    'go',
    plan.workspace,
    plan.workingDirectory,
    inputs.cacheTag,
    requestedPort,
    inputs.proxyNoPlatform,
    inputs.proxyNoGit,
    proxyPlanningReadOnly(inputs.readOnly),
    {
      metadataHintsInput: inputs.metadataHints,
    },
  );
  const workspace = proxyPlan.workspace;
  const cacheTag = proxyPlan.tag;

  saveModeState('proxy-pid', '');
  const proxy = await startRegistryProxy(actionProxyOptions({
    command: 'cache-registry',
    workspace,
    tag: cacheTag,
    host: proxyPlan.proxy.host || '127.0.0.1',
    port: proxyPlan.proxy.port,
    noGit: proxyPlan.proxy.no_git,
    noPlatform: proxyPlan.proxy.no_platform,
    verbose: inputs.verbose,
    readOnly: proxyPlan.proxy.read_only,
  }, proxyPlan.proxy));
  saveModeState('proxy-pid', String(proxy.pid));
  saveProxyModeState(proxy.port);

  configureGoProxyEnv(goCacheProgForProxy(proxyPlan, proxy.port));

  core.setOutput('cache-tag', cacheTag);
  setProxyOutputs(proxy.port);
  core.setOutput('workspace', workspace);
  return {
    cacheTag,
    verificationSpecs: [adapterProxyVerificationSpec(cacheTag, proxyPlan.proxy, plan.workingDirectory)],
  };
}

async function runGradleRestore(plan: ResolvedPlan, inputs: OneInputs): Promise<ModeRestoreResult> {
  const requestedPort = parseInt(inputs.proxyPort || '0', 10) || await findAvailablePort();
  const gradleHome = core.getInput('gradle-home') || '';
  const enableBuildCache = parseBoolean(core.getInput('enable-build-cache'), true);
  const proxyPlan = await resolveAdapterCliPlan(
    'gradle',
    plan.workspace,
    plan.workingDirectory,
    inputs.cacheTag,
    requestedPort,
    inputs.proxyNoPlatform,
    inputs.proxyNoGit,
    proxyPlanningReadOnly(inputs.readOnly),
    {
      metadataHintsInput: inputs.metadataHints,
      gradleHome,
      enableGradleBuildCache: enableBuildCache,
    },
  );
  const workspace = proxyPlan.workspace;
  const cacheTag = proxyPlan.tag;
  const setup = requireAdapterSetupPlan('gradle', proxyPlan.setup);

  const proxy = await startRegistryProxy(actionProxyOptions({
    command: 'cache-registry',
    workspace,
    tag: cacheTag,
    host: proxyPlan.proxy.host || '127.0.0.1',
    port: proxyPlan.proxy.port,
    noGit: proxyPlan.proxy.no_git,
    noPlatform: proxyPlan.proxy.no_platform,
    verbose: inputs.verbose,
    readOnly: proxyPlan.proxy.read_only,
  }, proxyPlan.proxy));
  saveModeState('proxy-pid', String(proxy.pid));
  saveProxyModeState(proxy.port);

  applyAdapterSetupPlan(setup);

  core.setOutput('cache-tag', cacheTag);
  setProxyOutputs(proxy.port);
  core.setOutput('workspace', workspace);
  return {
    cacheTag,
    verificationSpecs: [adapterProxyVerificationSpec(cacheTag, proxyPlan.proxy, plan.workingDirectory)],
  };
}

async function runMavenRestore(plan: ResolvedPlan, inputs: OneInputs): Promise<ModeRestoreResult> {
  const requestedPort = parseInt(inputs.proxyPort || '0', 10) || await findAvailablePort();
  const mavenExtensionsPath = core.getInput('maven-extensions-path') || '';
  const mavenBuildCacheConfigPath = core.getInput('maven-build-cache-config-path') || '';
  const mavenLocalRepo = core.getInput('maven-local-repo') || '';
  const mavenBuildCacheExtensionVersion = core.getInput('maven-build-cache-extension-version') || '';
  const mavenBuildCacheId = core.getInput('maven-build-cache-id') || '';
  const proxyPlan = await resolveAdapterCliPlan(
    'maven',
    plan.workspace,
    plan.workingDirectory,
    inputs.cacheTag,
    requestedPort,
    inputs.proxyNoPlatform,
    inputs.proxyNoGit,
    proxyPlanningReadOnly(inputs.readOnly),
    {
      metadataHintsInput: inputs.metadataHints,
      mavenExtensionsPath,
      mavenBuildCacheConfigPath,
      mavenLocalRepo,
      mavenBuildCacheExtensionVersion,
      mavenBuildCacheId,
    },
  );
  const workspace = proxyPlan.workspace;
  const cacheTag = proxyPlan.tag;
  const setup = requireAdapterSetupPlan('maven', proxyPlan.setup);

  const proxy = await startRegistryProxy(actionProxyOptions({
    command: 'cache-registry',
    workspace,
    tag: cacheTag,
    host: proxyPlan.proxy.host || '127.0.0.1',
    port: proxyPlan.proxy.port,
    noGit: proxyPlan.proxy.no_git,
    noPlatform: proxyPlan.proxy.no_platform,
    verbose: inputs.verbose,
    readOnly: proxyPlan.proxy.read_only,
  }, proxyPlan.proxy));
  saveModeState('proxy-pid', String(proxy.pid));
  saveProxyModeState(proxy.port);

  applyAdapterSetupPlan(setup);
  const extensionsPath = requireSetupFilePath(setup, 'extensions.xml', 'maven extensions.xml');
  const buildCacheConfigPath = requireSetupFilePath(
    setup,
    'maven-build-cache-config.xml',
    'maven build-cache config',
  );
  const localRepo = requireSetupDirectory(setup, 'maven local repository directory');
  core.setOutput('cache-tag', cacheTag);
  setProxyOutputs(proxy.port);
  core.setOutput('maven-extensions-path', extensionsPath);
  core.setOutput('maven-build-cache-config-path', buildCacheConfigPath);
  core.setOutput('maven-local-repo', localRepo);
  core.setOutput('workspace', workspace);
  return {
    cacheTag,
    verificationSpecs: [adapterProxyVerificationSpec(cacheTag, proxyPlan.proxy, plan.workingDirectory)],
  };
}

async function runTurboProxyRestore(plan: ResolvedPlan, inputs: OneInputs): Promise<ModeRestoreResult> {
  const turboApiUrl = core.getInput('turbo-api-url') || '';
  const turboToken = core.getInput('turbo-token') || 'boringcache';
  const turboTeam = core.getInput('turbo-team') || '';
  const preferredPort = parseInt(core.getInput('turbo-port') || inputs.proxyPort || '4227', 10);
  const turboPlan = await resolveAdapterCliPlan(
    'turbo',
    plan.workspace,
    plan.workingDirectory,
    inputs.cacheTag,
    preferredPort,
    inputs.proxyNoPlatform,
    inputs.proxyNoGit,
    proxyPlanningReadOnly(inputs.readOnly),
    {
      metadataHintsInput: inputs.metadataHints,
    },
  );
  const workspace = turboPlan.workspace;
  const cacheTag = turboPlan.tag;
  const packageManager = await detectNodePackageManager(plan.workingDirectory);

  const packageManagerCacheDir = configureNodePackageManagerEnv(packageManager);
  await ensureCorepackPackageManager(plan.workingDirectory, packageManager, plan.runtimeTools);
  if (packageManager) {
    core.setOutput('package-manager', packageManager.name);
    core.setOutput('package-manager-cache-dir', packageManagerCacheDir || packageManager.cacheDir);
  }

  if (turboApiUrl) {
    configureTurboRemoteEnv(turboApiUrl, turboToken, turboTeam);
    core.setOutput('workspace', workspace);
    core.setOutput('cache-tag', cacheTag);
    return { cacheTag, verificationSpecs: [] };
  }

  let proxy;
  try {
    proxy = await startPortableCacheProxy(
      workspace,
      turboPlan.proxy.port || preferredPort,
      cacheTag,
      turboPlan.proxy.read_only,
      turboPlan.proxy,
    );
  } catch {
    proxy = await startPortableCacheProxy(
      workspace,
      await findAvailablePort(),
      cacheTag,
      turboPlan.proxy.read_only,
      turboPlan.proxy,
    );
  }

  saveModeState('proxy-pid', String(proxy.pid));
  saveProxyModeState(proxy.port);
  exportEnvVars(turboEnvForStartedProxy(turboPlan, proxy.port, turboToken, turboTeam));
  core.setOutput('cache-tag', cacheTag);
  setProxyOutputs(proxy.port);
  core.setOutput('workspace', workspace);
  return {
    cacheTag,
    verificationSpecs: [adapterProxyVerificationSpec(cacheTag, turboPlan.proxy, plan.workingDirectory)],
  };
}

async function runNxProxyRestore(plan: ResolvedPlan, inputs: OneInputs): Promise<ModeRestoreResult> {
  const nxAccessToken = core.getInput('nx-access-token');
  const preferredPort = parseInt(core.getInput('nx-port') || inputs.proxyPort || '4228', 10);
  const nxPlan = await resolveAdapterCliPlan(
    'nx',
    plan.workspace,
    plan.workingDirectory,
    inputs.cacheTag,
    preferredPort,
    inputs.proxyNoPlatform,
    inputs.proxyNoGit,
    proxyPlanningReadOnly(inputs.readOnly),
    {
      metadataHintsInput: inputs.metadataHints,
    },
  );
  const workspace = nxPlan.workspace;
  const cacheTag = nxPlan.tag;

  let proxy;
  try {
    proxy = await startPortableCacheProxy(
      workspace,
      nxPlan.proxy.port || preferredPort,
      cacheTag,
      nxPlan.proxy.read_only,
      nxPlan.proxy,
    );
  } catch {
    proxy = await startPortableCacheProxy(
      workspace,
      await findAvailablePort(),
      cacheTag,
      nxPlan.proxy.read_only,
      nxPlan.proxy,
    );
  }

  saveModeState('proxy-pid', String(proxy.pid));
  saveProxyModeState(proxy.port);
  exportEnvVars(nxEnvForStartedProxy(nxPlan, proxy.port, nxAccessToken));
  core.setOutput('cache-tag', cacheTag);
  setProxyOutputs(proxy.port);
  core.setOutput('workspace', workspace);
  return {
    cacheTag,
    verificationSpecs: [adapterProxyVerificationSpec(cacheTag, nxPlan.proxy, plan.workingDirectory)],
  };
}

async function runRustRestore(plan: ResolvedPlan, inputs: OneInputs): Promise<ModeRestoreResult> {
  const cacheTagPrefix = (inputs.cacheTag || plan.cacheTagPrefix || '').trim();
  const inputVersion = core.getInput('rust-version') || core.getInput('toolchain');
  const workingDir = plan.workingDirectory;
  const cacheCargo = core.getInput('cache-cargo') !== 'false';
  const cacheCargoBin = core.getInput('cache-cargo-bin') === 'true';
  const cacheTarget = core.getInput('cache-target') !== 'false';
  const useSccache = core.getInput('sccache') === 'true';
  const sccacheVersion = core.getInput('sccache-version') || '0.14.0';
  const sccacheMode = core.getInput('sccache-mode') || 'local';
  const sccacheCacheSize = core.getInput('sccache-cache-size') || '5G';
  const targets = core.getInput('targets');
  const components = core.getInput('components');
  const profile = core.getInput('profile') || 'minimal';
  const rustVersion = await detectRustVersion(workingDir, inputVersion);

  configureCargoEnv();
  const rustMajorMinor = rustVersion.match(/^(\d+\.\d+)/)?.[1] || rustVersion;
  const rustToolTagSuffix = `rust${rustMajorMinor}`;
  const lockPath = path.join(workingDir, 'Cargo.lock');
  const hasGitDeps = cacheCargo && await hasGitDependencies(lockPath);

  if (useSccache && sccacheMode !== 'proxy') {
    configureSccacheEnv(sccacheCacheSize);
  }

  const rustEntryIds: string[] = [];
  if (cacheCargo) {
    rustEntryIds.push('cargo-registry');
    if (hasGitDeps) {
      rustEntryIds.push('cargo-git');
    }
  }
  if (cacheCargoBin) {
    rustEntryIds.push('cargo-bin');
  }
  if (cacheTarget) {
    rustEntryIds.push('target');
  }
  if (useSccache) {
    rustEntryIds.push('sccache-dir');
  }

  const rustEntriesPlan = rustEntryIds.length > 0
    ? await resolveCliArchiveEntries(workingDir, {
      workspaceInput: inputs.workspace.trim(),
      entryIds: rustEntryIds,
      cacheTag: cacheTagPrefix,
      toolTagSuffix: rustToolTagSuffix,
      fallbackWorkspace: plan.workspace,
    })
    : { workspace: plan.workspace, entries: [], envVars: {} };
  for (const [key, value] of Object.entries(rustEntriesPlan.envVars)) {
    core.exportVariable(key, value);
  }
  const rustEntries = new Map(rustEntriesPlan.entries.map((entry) => [entry.requested, entry]));
  const workspace = rustEntriesPlan.workspace || plan.workspace;
  const cargoRegistryEntry = cacheCargo
    ? getRustArchiveEntry(rustEntries, 'cargo-registry', 'cargo registry cache')
    : null;
  const cargoGitEntry = cacheCargo && hasGitDeps
    ? getRustArchiveEntry(rustEntries, 'cargo-git', 'cargo git cache')
    : null;
  const cargoBinEntry = cacheCargoBin
    ? getRustArchiveEntry(rustEntries, 'cargo-bin', 'cargo bin cache')
    : null;
  const targetEntry = cacheTarget
    ? getRustArchiveEntry(rustEntries, 'target', 'Rust target cache')
    : null;
  const sccacheEntry = useSccache
    ? getRustArchiveEntry(rustEntries, 'sccache-dir', 'sccache cache')
    : null;

  core.setOutput('workspace', workspace);
  core.setOutput('rust-version', rustVersion);
  core.setOutput('cache-tag', cacheTagPrefix);
  core.setOutput('cargo-tag', cargoRegistryEntry?.tag || '');
  core.setOutput('cargo-git-tag', cargoGitEntry?.tag || '');
  core.setOutput('cargo-bin-tag', cargoBinEntry?.tag || '');
  core.setOutput('target-tag', targetEntry?.tag || '');
  core.setOutput('sccache-tag', sccacheEntry?.tag || '');

  saveModeState('workspace', workspace);
  saveModeState('cache-tag-prefix', cacheTagPrefix);
  saveModeState('rust-version', rustVersion);
  saveModeState('working-dir', workingDir);
  saveModeState('cache-cargo', String(cacheCargo));
  saveModeState('cache-cargo-bin', String(cacheCargoBin));
  saveModeState('cache-target', String(cacheTarget));
  saveModeState('use-sccache', String(useSccache));
  saveModeState('sccache-mode', sccacheMode);
  saveModeState('verbose', String(inputs.verbose));
  saveModeState('skipped-verify-tags', '');

  let registryRestored = false;
  let cargoGitRestored = false;
  let cargoBinRestored = false;
  let targetRestored = false;
  let sccacheRestored = false;

  if (cargoRegistryEntry) {
    registryRestored = await restoreRustArchiveEntry(workspace, cargoRegistryEntry, inputs.verbose);
    saveRustArchiveEntryState('cargo-registry', cargoRegistryEntry);
  }

  if (cargoGitEntry) {
    cargoGitRestored = await restoreRustArchiveEntry(workspace, cargoGitEntry, inputs.verbose);
    saveRustArchiveEntryState('cargo-git', cargoGitEntry);
  }

  if (cargoBinEntry) {
    cargoBinRestored = await restoreRustArchiveEntry(workspace, cargoBinEntry, inputs.verbose);
    saveRustArchiveEntryState('cargo-bin', cargoBinEntry);
  }

  if (targetEntry) {
    targetRestored = await restoreRustArchiveEntry(workspace, targetEntry, inputs.verbose);
    saveRustArchiveEntryState('target', targetEntry);
  }

  if (useSccache && sccacheEntry) {
    await installSccache(sccacheVersion);

    if (sccacheMode === 'proxy') {
      const requestedPort = parseInt(inputs.proxyPort || '0', 10) || await findAvailablePort();
      const proxyPlan = await resolveAdapterCliPlan(
        'sccache',
        workspace,
        workingDir,
        sccacheEntry.tag,
        requestedPort,
        true,
        true,
        proxyPlanningReadOnly(inputs.readOnly),
        {
          metadataHintsInput: inputs.metadataHints,
        },
      );
      sccacheRestored = await checkRustTagHit(proxyPlan.workspace, proxyPlan.tag, {
        noPlatform: proxyPlan.proxy.no_platform,
        noGit: proxyPlan.proxy.no_git,
        requireServerSignature: true,
      });
      const proxy = await startRegistryProxy(actionProxyOptions({
        command: 'cache-registry',
        workspace: proxyPlan.workspace,
        tag: proxyPlan.tag,
        host: proxyPlan.proxy.host || '127.0.0.1',
        port: proxyPlan.proxy.port,
        noGit: proxyPlan.proxy.no_git,
        noPlatform: proxyPlan.proxy.no_platform,
        verbose: inputs.verbose,
        readOnly: proxyPlan.proxy.read_only,
      }, proxyPlan.proxy));
      exportEnvVars(sccacheEnvForStartedProxy(proxyPlan, proxy.port));
      await startSccacheServer();
      saveModeState('proxy-pid', String(proxy.pid));
      saveProxyModeState(proxy.port);
      saveRustArchiveEntryState('sccache', {
        ...sccacheEntry,
        tag: proxyPlan.tag,
        tagPathPair: `${proxyPlan.tag}:${sccacheEntry.path}`,
      });
      saveModeState('sccache-preflight-hit', String(sccacheRestored));
      setProxyOutputs(proxy.port);
    } else {
      sccacheRestored = await restoreRustArchiveEntry(workspace, sccacheEntry, inputs.verbose);
      await startSccacheServer();
      saveRustArchiveEntryState('sccache', sccacheEntry);
      saveModeState('sccache-preflight-hit', String(sccacheRestored));
    }
  }

  if (!(plan.setup === 'mise' && toolEnabled(plan, 'rust'))) {
    await setupRustToolchain(rustVersion, { profile, targets, components });
  }

  const cacheHit = registryRestored || cargoGitRestored || cargoBinRestored || targetRestored || sccacheRestored;
  core.setOutput('cache-hit', String(cacheHit));
  core.setOutput('sccache-hit', String(sccacheRestored));
  const verificationSpecs: TagVerificationSpec[] = [];

  if (cargoRegistryEntry) {
    verificationSpecs.push({
      tag: cargoRegistryEntry.tag,
      noPlatform: false,
      noGit: false,
      pathHint: cargoRegistryEntry.path,
      saveExpected: true,
    });
  }

  if (cargoGitEntry) {
    verificationSpecs.push({
      tag: cargoGitEntry.tag,
      noPlatform: false,
      noGit: false,
      pathHint: cargoGitEntry.path,
      saveExpected: true,
    });
  }

  if (cargoBinEntry) {
    verificationSpecs.push({
      tag: cargoBinEntry.tag,
      noPlatform: false,
      noGit: false,
      pathHint: cargoBinEntry.path,
      saveExpected: true,
    });
  }

  if (targetEntry) {
    verificationSpecs.push({
      tag: targetEntry.tag,
      noPlatform: false,
      noGit: false,
      pathHint: targetEntry.path,
      saveExpected: true,
    });
  }

  if (sccacheEntry) {
    verificationSpecs.push({
      tag: readRustArchiveEntryState('sccache')?.tag || sccacheEntry.tag,
      noPlatform: sccacheMode === 'proxy',
      noGit: sccacheMode === 'proxy',
      pathHint: sccacheMode === 'proxy' ? workingDir : sccacheEntry.path,
      saveExpected: sccacheMode !== 'proxy' || !inputs.readOnly,
    });
  }

  return { cacheHit, cacheTag: cacheTagPrefix, verificationSpecs };
}

async function runRustSave(): Promise<void> {
  const workspace = getModeState('workspace');
  const cacheCargo = getModeState('cache-cargo') === 'true';
  const cacheCargoBin = getModeState('cache-cargo-bin') === 'true';
  const cacheTarget = getModeState('cache-target') === 'true';
  const useSccache = getModeState('use-sccache') === 'true';
  const sccacheMode = getModeState('sccache-mode') || 'local';
  const verbose = getModeState('verbose') === 'true';
  const exclude = core.getInput('exclude');

  if (!workspace) {
    return;
  }

  if (!hasSaveToken()) {
    if (useSccache && sccacheMode === 'proxy') {
      await stopSccacheServer();
      await stopProxyFromState();
    }
    core.notice(`Save skipped: ${missingSaveTokenMessage()}`);
    return;
  }

  if (cacheCargo) {
    const cargoRegistryEntry = readRustArchiveEntryState('cargo-registry');
    const cargoGitEntry = readRustArchiveEntryState('cargo-git');

    if (cargoRegistryEntry) {
      await execRustBoringCache(buildRustCacheArgs('save', workspace, cargoRegistryEntry, verbose, exclude));
    }

    if (cargoGitEntry) {
      await execRustBoringCache(buildRustCacheArgs('save', workspace, cargoGitEntry, verbose, exclude));
    }
  }

  if (cacheCargoBin) {
    const cargoBinEntry = readRustArchiveEntryState('cargo-bin');
    if (cargoBinEntry) {
      await execRustBoringCache(buildRustCacheArgs('save', workspace, cargoBinEntry, verbose, exclude));
    }
  }

  if (cacheTarget) {
    const targetEntry = readRustArchiveEntryState('target');
    if (targetEntry) {
      await execRustBoringCache(buildRustCacheArgs('save', workspace, targetEntry, verbose, exclude));
    }
  }

  if (useSccache) {
    if (sccacheMode === 'proxy') {
      const sccacheTag = getModeState('sccache-tag');
      const preflightHit = getModeState('sccache-preflight-hit') === 'true';
      const sccacheStats = await stopSccacheServer();
      await stopProxyFromState();
      if (sccacheTag && (!sccacheStats || sccacheStats.compileRequests === 0)) {
        markModeVerifyTagSkipped(sccacheTag);
        if (preflightHit) {
          core.info(`Skipping sccache post-save verification for ${sccacheTag}: no compile requests were observed.`);
        } else {
          core.info(`Skipping sccache save for ${sccacheTag}: no compile requests were observed.`);
        }
        return;
      }
      if (sccacheTag && sccacheStats && sccacheStats.compileRequests > 0) {
        const postShutdownHit = await checkRustTagHit(workspace, sccacheTag, {
          noPlatform: true,
          noGit: true,
          requireServerSignature: true,
        });
        const rustHitRate = sccacheStats.rustHitRate || 'unknown';
        core.info(
          `sccache proxy stats for ${sccacheTag}: compile_requests=${sccacheStats.compileRequests}, cache_hits=${sccacheStats.cacheHits}, cache_misses=${sccacheStats.cacheMisses}, rust_hit_rate=${rustHitRate}`,
        );

        if (sccacheStats.cacheHits === 0) {
          if (preflightHit) {
            core.warning(
              `sccache proxy saw 0 cache hits across ${sccacheStats.compileRequests} compile requests for existing tag '${sccacheTag}'. Check emitted tag semantics and BORINGCACHE_SAVE_TOKEN/BORINGCACHE_RESTORE_TOKEN alignment.`,
            );
          } else if (!postShutdownHit) {
            core.warning(
              `sccache proxy saw 0 cache hits across ${sccacheStats.compileRequests} compile requests and '${sccacheTag}' was not available as a signed cache entry after shutdown. Check server-side signing, BORINGCACHE_SAVE_TOKEN scope, and proxy publish logs.`,
            );
          } else {
            core.notice(
              `sccache proxy saw 0 cache hits across ${sccacheStats.compileRequests} compile requests, but '${sccacheTag}' published successfully. This looks like a cold fill.`,
            );
          }
        }
      }
    } else {
      const sccacheEntry = readRustArchiveEntryState('sccache');
      const sccacheTag = sccacheEntry?.tag || '';
      const preflightHit = getModeState('sccache-preflight-hit') === 'true';
      if (sccacheEntry) {
        const sccacheStats = await stopSccacheServer();
        if (!sccacheStats || sccacheStats.compileRequests === 0) {
          markModeVerifyTagSkipped(sccacheTag);
          if (preflightHit) {
            core.info(`Skipping sccache post-save verification for ${sccacheTag}: no compile requests were observed.`);
          } else {
            core.info(`Skipping sccache save for ${sccacheTag}: no compile requests were observed.`);
          }
          return;
        }
        await execRustBoringCache(buildRustCacheArgs('save', workspace, sccacheEntry, verbose, exclude));
      }
    }
  }
}

async function stopProxyFromState(): Promise<void> {
  const proxyPid = getModeState('proxy-pid');
  if (proxyPid) {
    await stopRegistryProxy(parseInt(proxyPid, 10));
  }
}
