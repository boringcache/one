import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  activateMiseTool,
  buildMiseRuntimeTag,
  buildMiseToolTag,
  ensureBoringCache,
  exportMiseEnv,
  execBoringCache,
  getInputsWorkspace,
  getMiseInstallsDir,
  hasMiseToolVersion,
  hasToolVersionOnPath,
  installMise,
  installMiseTool,
  parseEntries,
  resolvePath,
  readProjectMiseTools,
  readMiseTomlVersion,
  readToolVersionsValue,
  reshimMise,
  type MiseVersionScope,
} from './core';
import {
  assertImplementedMode,
  type ModeSpec,
  normalizeMode,
  type OneMode,
  type ResolvedMode,
  resolveModeSpec,
} from './modes';

export {
  activateMiseTool,
  ensureBoringCache,
  exportMiseEnv,
  execBoringCache,
  getMiseInstallsDir,
  hasMiseToolVersion,
  hasToolVersionOnPath,
  installMise,
  installMiseTool,
  parseEntries,
};

export type SetupMode = 'mise' | 'external' | 'none';
export type Preset = 'none' | 'rails' | 'ruby' | 'node' | 'node-turbo' | 'python-uv' | 'go' | 'php-composer';
export type SavePolicy = 'auto' | 'off';
export type VerifyMode = 'none' | 'check' | 'wait' | 'warn';
export type DiagnosticsInputMode = 'auto' | 'off' | 'summary' | 'verbose';
export type DiagnosticsLevel = 'off' | 'summary' | 'verbose';
export type OciHydrationPolicy = 'metadata-only' | 'bodies-before-ready' | 'bodies-background';
export const DEFAULT_OCI_HYDRATION_POLICY: OciHydrationPolicy = 'metadata-only';

export interface ToolSpec {
  name: string;
  version: string;
  label: string;
  source: 'input' | 'project' | 'preset' | 'mode';
}

export interface NodePackageManagerInfo {
  name: 'npm' | 'pnpm' | 'yarn';
  version: string | null;
  packageManagerField: string | null;
  cacheDir: string;
  nodeModulesDir: string;
}

export interface OneInputs {
  cliVersion: string;
  cliPlatform: string;
  setup: SetupMode;
  mode: OneMode;
  preset: Preset;
  workspace: string;
  cacheTag: string;
  runtimeCacheTag: string;
  workingDirectory: string;
  tools: string;
  toolVersionScope: MiseVersionScope;
  cacheRuntime: boolean;
  mavenVersion: string;
  uvVersion: string;
  composerVersion: string;
  mavenLocalRepo: string;
  readOnly: boolean;
  savePolicy: SavePolicy;
  saveOnPullRequest: boolean;
  verify: VerifyMode;
  verifyTimeoutSeconds: number;
  verifyRequireServerSignature: boolean;
  diagnostics: DiagnosticsInputMode;
  diagnosticsLogLines: number;
  proxyPort: string;
  proxyNoGit: boolean;
  proxyNoPlatform: boolean;
  ociHydration: OciHydrationPolicy;
  cacheProfiles: string;
  entries: string;
  path: string;
  key: string;
  restoreKeys: string;
  enableCrossOsArchive: boolean;
  noPlatform: boolean;
  failOnCacheMiss: boolean;
  lookupOnly: boolean;
  force: boolean;
  verbose: boolean;
  exclude: string;
}

export interface TagVerificationSpec {
  tag: string;
  noPlatform: boolean;
  noGit: boolean;
  pathHint?: string;
  saveExpected?: boolean;
}

export interface VerifyResolvedTagsOptions {
  mode: VerifyMode;
  timeoutSeconds: number;
  requireServerSignature: boolean;
  verbose: boolean;
}

export interface DiagnosticsConfig {
  level: DiagnosticsLevel;
  enabled: boolean;
  includeLogs: boolean;
  logLines: number;
}

export interface ResolvedPlan {
  workspace: string;
  workingDirectory: string;
  setup: SetupMode;
  mode: ResolvedMode;
  modeSpec: ModeSpec;
  preset: Preset;
  cacheTagPrefix: string;
  runtimeTools: ToolSpec[];
  runtimeTag: string | null;
  runtimeEntry: string | null;
  envVars: Record<string, string>;
  archiveEntries: string;
  archiveRestoreCandidates: ArchiveRestoreCandidate[];
  usesCacheFormat: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  bazel: 'Bazel',
  bun: 'Bun',
  composer: 'Composer',
  elixir: 'Elixir',
  erlang: 'Erlang',
  go: 'Go',
  gradle: 'Gradle',
  java: 'Java',
  maven: 'Maven',
  node: 'Node.js',
  nodejs: 'Node.js',
  npm: 'npm',
  pnpm: 'pnpm',
  php: 'PHP',
  python: 'Python',
  ruby: 'Ruby',
  rust: 'Rust',
  turbo: 'Turbo',
  uv: 'uv',
  yarn: 'Yarn',
};

export function getInputs(): OneInputs {
  return {
    cliVersion: core.getInput('cli-version') || 'v1.12.46',
    cliPlatform: core.getInput('cli-platform'),
    setup: normalizeSetup(core.getInput('setup')),
    mode: normalizeMode(core.getInput('mode')),
    preset: normalizePreset(core.getInput('preset')),
    workspace: core.getInput('workspace'),
    cacheTag: core.getInput('cache-tag'),
    runtimeCacheTag: core.getInput('runtime-cache-tag'),
    workingDirectory: path.resolve(core.getInput('working-directory') || '.'),
    tools: core.getInput('tools'),
    toolVersionScope: normalizeToolVersionScope(core.getInput('tool-version-scope')),
    cacheRuntime: core.getBooleanInput('cache-runtime'),
    mavenVersion: core.getInput('maven-version') || '3.9.9',
    uvVersion: core.getInput('uv-version') || '0.9.21',
    composerVersion: core.getInput('composer-version') || '2.9.5',
    mavenLocalRepo: core.getInput('maven-local-repo') || '~/.m2/repository',
    readOnly: core.getBooleanInput('read-only'),
    savePolicy: normalizeSavePolicy(core.getInput('save-policy') || 'auto'),
    saveOnPullRequest: core.getBooleanInput('save-on-pull-request'),
    verify: normalizeVerifyMode(core.getInput('verify')),
    verifyTimeoutSeconds: normalizeVerifyTimeoutSeconds(core.getInput('verify-timeout-seconds')),
    verifyRequireServerSignature: core.getBooleanInput('verify-require-server-signature'),
    diagnostics: normalizeDiagnosticsMode(core.getInput('diagnostics')),
    diagnosticsLogLines: normalizeDiagnosticsLogLines(core.getInput('diagnostics-log-lines')),
    proxyPort: core.getInput('proxy-port'),
    proxyNoGit: core.getBooleanInput('proxy-no-git'),
    proxyNoPlatform: core.getBooleanInput('proxy-no-platform'),
    ociHydration: normalizeOciHydrationPolicy(core.getInput('oci-hydration')),
    cacheProfiles: core.getInput('cache-profiles'),
    entries: core.getInput('entries'),
    path: core.getInput('path'),
    key: core.getInput('key'),
    restoreKeys: core.getInput('restore-keys'),
    enableCrossOsArchive: core.getBooleanInput('enableCrossOsArchive'),
    noPlatform: core.getBooleanInput('no-platform'),
    failOnCacheMiss: core.getBooleanInput('fail-on-cache-miss'),
    lookupOnly: core.getBooleanInput('lookup-only'),
    force: core.getBooleanInput('force'),
    verbose: core.getBooleanInput('verbose'),
    exclude: core.getInput('exclude'),
  };
}

export function isPullRequestEvent(): boolean {
  return (process.env.GITHUB_EVENT_NAME || '').trim().toLowerCase() === 'pull_request';
}

export function saveConfigured(inputs: Pick<OneInputs, 'savePolicy'>): boolean {
  return inputs.savePolicy !== 'off';
}

export function saveAllowedForEvent(inputs: Pick<OneInputs, 'saveOnPullRequest'>): boolean {
  return !isPullRequestEvent() || inputs.saveOnPullRequest;
}

export function saveSkippedByConfigurationMessage(): string {
  return 'Save skipped: save-policy is off; this step is restore-only by configuration.';
}

export function saveSkippedByPolicyMessage(): string {
  return 'Save skipped: pull_request jobs stay restore-only by default. Set save-on-pull-request: true to allow writes.';
}

export function applySaveTokenPolicy(inputs: Pick<OneInputs, 'saveOnPullRequest'>): boolean {
  const saveAllowed = saveAllowedForEvent(inputs);
  if (saveAllowed) {
    return true;
  }

  const restoreFallback =
    process.env.BORINGCACHE_RESTORE_TOKEN ||
    process.env.BORINGCACHE_SAVE_TOKEN ||
    process.env.BORINGCACHE_API_TOKEN;
  const hadSaveCapableToken = Boolean(
    process.env.BORINGCACHE_SAVE_TOKEN || process.env.BORINGCACHE_API_TOKEN,
  );

  if (restoreFallback) {
    process.env.BORINGCACHE_RESTORE_TOKEN = restoreFallback;
  }

  delete process.env.BORINGCACHE_SAVE_TOKEN;
  delete process.env.BORINGCACHE_API_TOKEN;

  if (hadSaveCapableToken) {
    core.notice(
      'pull_request detected: treating save-capable BoringCache tokens as restore-only. Set save-on-pull-request: true to allow writes.',
    );
  }

  return false;
}

export function readSavedSaveAllowance(
  inputs: Pick<OneInputs, 'saveOnPullRequest' | 'savePolicy'>,
  savedValue: string,
): boolean {
  if (!saveConfigured(inputs)) {
    return false;
  }
  if (savedValue === 'true') {
    return true;
  }
  if (savedValue === 'false') {
    return false;
  }
  return saveAllowedForEvent(inputs);
}

export function readSavedSaveConfiguration(
  inputs: Pick<OneInputs, 'savePolicy'>,
  savedValue: string,
): boolean {
  if (savedValue === 'true') {
    return true;
  }
  if (savedValue === 'false') {
    return false;
  }
  return saveConfigured(inputs);
}

export function normalizeSavePolicy(value: string): SavePolicy {
  switch ((value || 'auto').trim().toLowerCase()) {
    case 'auto':
    case 'off':
      return (value || 'auto').trim().toLowerCase() as SavePolicy;
    default:
      throw new Error(`Unsupported save-policy "${value}". Expected auto or off.`);
  }
}

export function normalizeDiagnosticsMode(value: string): DiagnosticsInputMode {
  switch ((value || 'auto').trim().toLowerCase()) {
    case 'auto':
    case 'off':
    case 'summary':
    case 'verbose':
      return (value || 'auto').trim().toLowerCase() as DiagnosticsInputMode;
    default:
      throw new Error(`Unsupported diagnostics mode "${value}". Expected auto, off, summary, or verbose.`);
  }
}

export function normalizeDiagnosticsLogLines(value: string): number {
  if (!value || !value.trim()) {
    return 40;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`Unsupported diagnostics-log-lines "${value}". Expected a positive integer.`);
  }
  return parsed;
}

export function normalizeOciHydrationPolicy(value: string): OciHydrationPolicy {
  switch ((value || DEFAULT_OCI_HYDRATION_POLICY).trim().toLowerCase()) {
    case 'metadata-only':
    case 'bodies-before-ready':
    case 'bodies-background':
      return (value || DEFAULT_OCI_HYDRATION_POLICY).trim().toLowerCase() as OciHydrationPolicy;
    default:
      throw new Error(
        `Unsupported oci-hydration "${value}". Expected metadata-only, bodies-before-ready, or bodies-background.`,
      );
  }
}

export function resolveDiagnosticsConfig(mode: DiagnosticsInputMode, logLines: number): DiagnosticsConfig {
  let level: DiagnosticsLevel;

  switch (mode) {
    case 'auto':
      level = core.isDebug() ? 'verbose' : 'off';
      break;
    case 'off':
    case 'summary':
    case 'verbose':
      level = mode;
      break;
  }

  return {
    level,
    enabled: level !== 'off',
    includeLogs: level === 'verbose',
    logLines,
  };
}

export function loadDiagnosticsConfig(inputs: OneInputs): DiagnosticsConfig {
  const savedLevel = (core.getState('diagnostics-level') || '').trim().toLowerCase();
  if (savedLevel === 'off' || savedLevel === 'summary' || savedLevel === 'verbose') {
    const savedLogLines = normalizeDiagnosticsLogLines(
      (core.getState('diagnostics-log-lines') || '').trim() || String(inputs.diagnosticsLogLines),
    );
    return {
      level: savedLevel as DiagnosticsLevel,
      enabled: savedLevel !== 'off',
      includeLogs: savedLevel === 'verbose',
      logLines: savedLogLines,
    };
  }

  return resolveDiagnosticsConfig(inputs.diagnostics, inputs.diagnosticsLogLines);
}

export async function runDiagnosticsGroup(
  diagnostics: DiagnosticsConfig,
  title: string,
  fn: () => Promise<void>,
): Promise<void> {
  if (!diagnostics.enabled) {
    return;
  }

  await core.group(title, fn);
}

export function readLogTail(filePath: string, maxLines: number): string[] {
  if (!filePath || maxLines < 1) {
    return [];
  }

  try {
    return fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .slice(-maxLines);
  } catch {
    return [];
  }
}

export function normalizeVerifyMode(value: string): VerifyMode {
  const normalized = (value || 'none').trim().toLowerCase();
  switch (normalized) {
    case 'none':
    case 'check':
    case 'wait':
    case 'warn':
      return normalized as VerifyMode;
    default:
      throw new Error(`Unsupported verify mode "${value}". Expected none, check, wait, or warn.`);
  }
}

export function normalizeVerifyTimeoutSeconds(value: string): number {
  if (!value || !value.trim()) {
    return 180;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`Unsupported verify-timeout-seconds "${value}". Expected a positive integer.`);
  }
  return parsed;
}

export function normalizeSetup(value: string): SetupMode {
  switch ((value || 'mise').trim().toLowerCase()) {
    case 'mise':
    case 'external':
    case 'none':
      return (value || 'mise').trim().toLowerCase() as SetupMode;
    default:
      throw new Error(`Unsupported setup "${value}". Expected mise, external, or none.`);
  }
}

export function normalizePreset(value: string): Preset {
  switch ((value || 'none').trim().toLowerCase()) {
    case 'none':
    case 'rails':
    case 'ruby':
    case 'node':
    case 'node-turbo':
    case 'python-uv':
    case 'go':
    case 'php-composer':
      return (value || 'none').trim().toLowerCase() as Preset;
    default:
      throw new Error(`Unsupported preset "${value}". Expected none, rails, ruby, node, node-turbo, python-uv, go, or php-composer.`);
  }
}

export function normalizeToolVersionScope(value: string): MiseVersionScope {
  switch ((value || 'patch').trim().toLowerCase()) {
    case 'major':
    case 'minor':
    case 'patch':
      return (value || 'patch').trim().toLowerCase() as MiseVersionScope;
    default:
      throw new Error(`Unsupported tool-version-scope "${value}". Expected major, minor, or patch.`);
  }
}

export function resolveWorkspace(workspace: string): string {
  const resolved = workspace
    ? workspace.includes('/') ? workspace : `default/${workspace}`
    : (process.env.BORINGCACHE_DEFAULT_WORKSPACE || getInputsWorkspace({}));
  if (!resolved.includes('/')) {
    return `default/${resolved}`;
  }
  return resolved;
}

function expandUserPath(value: string): string {
  if (value.startsWith('~/')) {
    return path.join(process.env.HOME || os.homedir(), value.slice(2));
  }
  return value;
}

function resolveWorkingPath(value: string, workingDirectory: string): string {
  const expanded = expandUserPath(value);
  return path.isAbsolute(expanded) ? expanded : path.resolve(workingDirectory, expanded);
}

function normalizeRef(value: string): string {
  let normalized = '';
  let lastWasDash = false;

  for (const rawChar of value.trim()) {
    const char = /[A-Za-z0-9]/.test(rawChar)
      ? rawChar.toLowerCase()
      : rawChar === '-' || rawChar === '_' || rawChar === '.'
        ? rawChar
        : '-';

    if (char === '-') {
      if (lastWasDash) {
        continue;
      }
      lastWasDash = true;
    } else {
      lastWasDash = false;
    }

    normalized += char;
    if (normalized.length >= 64) {
      break;
    }
  }

  const trimmed = normalized.replace(/^[-.]+|[-.]+$/g, '');
  return trimmed || 'unknown';
}

interface GitContext {
  branch?: string;
  defaultBranch?: string;
  commitSha?: string;
}

function isGitDisabledByEnv(): boolean {
  const value = process.env.BORINGCACHE_NO_GIT?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function shortenSha(sha: string): string {
  return sha.trim().slice(0, 12);
}

function isCiEnv(): boolean {
  return Boolean(
    process.env.CI
    || process.env.GITHUB_ACTIONS
    || process.env.GITLAB_CI
    || process.env.CIRCLECI
    || process.env.BITBUCKET_BUILD_NUMBER,
  );
}

function detectCiBranch(): string | undefined {
  for (const key of [
    'BORINGCACHE_GIT_BRANCH',
    'GITHUB_HEAD_REF',
    'GITHUB_REF_NAME',
    'CI_COMMIT_REF_NAME',
    'CI_COMMIT_BRANCH',
    'CIRCLE_BRANCH',
    'BITBUCKET_BRANCH',
  ]) {
    const value = process.env[key]?.trim();
    if (value) {
      return normalizeRef(value);
    }
  }
  return undefined;
}

function detectCiSha(): string | undefined {
  for (const key of [
    'BORINGCACHE_GIT_SHA',
    'GITHUB_SHA',
    'CI_COMMIT_SHA',
    'CIRCLE_SHA1',
    'BITBUCKET_COMMIT',
  ]) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function envDefaultBranch(): string | undefined {
  const value = process.env.BORINGCACHE_DEFAULT_BRANCH?.trim();
  return value ? normalizeRef(value) : undefined;
}

function resolveGitStartPath(pathHint: string | undefined, workingDirectory: string): string {
  const candidate = pathHint ? resolveWorkingPath(pathHint, workingDirectory) : workingDirectory;
  if (fs.existsSync(candidate)) {
    return fs.statSync(candidate).isDirectory() ? candidate : path.dirname(candidate);
  }

  const parent = path.dirname(candidate);
  if (parent && parent !== candidate) {
    return parent;
  }
  return workingDirectory;
}

function findGitDir(startPath: string): string | null {
  let current = path.resolve(startPath);

  while (true) {
    const candidate = path.join(current, '.git');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      const contents = fs.readFileSync(candidate, 'utf-8');
      const rest = contents.startsWith('gitdir:') ? contents.slice('gitdir:'.length).trim() : '';
      if (rest) {
        return path.isAbsolute(rest) ? rest : path.join(current, rest);
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function detectBranchFromHead(gitDir: string): string | undefined {
  const headPath = path.join(gitDir, 'HEAD');
  if (!fs.existsSync(headPath)) {
    return undefined;
  }
  const contents = fs.readFileSync(headPath, 'utf-8').trim();
  if (!contents.startsWith('ref:')) {
    return undefined;
  }
  const reference = contents.slice('ref:'.length).trim();
  const branchRef = reference.startsWith('refs/heads/') ? reference.slice('refs/heads/'.length) : reference;
  return normalizeRef(branchRef);
}

function detectDefaultBranch(gitDir: string): string | undefined {
  const originHead = path.join(gitDir, 'refs', 'remotes', 'origin', 'HEAD');
  if (!fs.existsSync(originHead)) {
    return undefined;
  }
  const contents = fs.readFileSync(originHead, 'utf-8').trim();
  if (!contents.startsWith('ref:')) {
    return undefined;
  }
  const reference = contents.slice('ref:'.length).trim();
  const branchName = reference.split('/').at(-1);
  return branchName ? normalizeRef(branchName) : undefined;
}

function detectGitContext(pathHint: string | undefined, workingDirectory: string): GitContext {
  if (isGitDisabledByEnv()) {
    return {};
  }

  const startPath = resolveGitStartPath(pathHint, workingDirectory);
  const gitDir = findGitDir(startPath);
  const context: GitContext = {};

  if (gitDir) {
    context.branch = detectBranchFromHead(gitDir);
    context.defaultBranch = detectDefaultBranch(gitDir);
  }

  if (!context.branch) {
    context.branch = detectCiBranch();
  }

  const overriddenDefault = envDefaultBranch();
  if (overriddenDefault) {
    context.defaultBranch = overriddenDefault;
  }

  if (!context.commitSha && isCiEnv()) {
    context.commitSha = detectCiSha();
  }

  return context;
}

function tagHasExplicitChannel(tag: string): boolean {
  return tag.includes('-branch-')
    || tag.includes('-sha-')
    || tag.endsWith('-main')
    || tag.endsWith('-master');
}

function isDefaultBranch(branch: string, defaultBranch?: string): boolean {
  return defaultBranch ? branch === defaultBranch : branch === 'main' || branch === 'master';
}

function hasPlatformSuffix(tag: string): boolean {
  const lastPart = tag.split('-').at(-1);
  if (lastPart && ['x86_64', 'arm64', 'arm32', 'x86'].includes(lastPart)) {
    return true;
  }

  return [
    '-ubuntu-',
    '-debian-',
    '-alpine-',
    '-arch-',
    '-macos-',
    '-windows-',
    '-linux-',
  ].some((pattern) => tag.includes(pattern));
}

function detectPlatformSuffix(): string {
  const arch = process.arch === 'x64'
    ? 'x86_64'
    : process.arch === 'arm64'
      ? 'arm64'
      : process.arch === 'arm'
        ? 'arm32'
        : process.arch === 'ia32'
          ? 'x86'
          : process.arch;

  if (process.platform === 'linux') {
    for (const releasePath of ['/etc/os-release', '/usr/lib/os-release']) {
      if (!fs.existsSync(releasePath)) {
        continue;
      }

      const contents = fs.readFileSync(releasePath, 'utf-8');
      let distro = '';
      let version = '';
      for (const line of contents.split('\n')) {
        const [rawKey, rawValue] = line.split('=');
        if (!rawKey || rawValue === undefined) {
          continue;
        }
        const value = rawValue.trim().replace(/^["']|["']$/g, '');
        if (rawKey === 'ID') {
          distro = value.toLowerCase();
        } else if (rawKey === 'VERSION_ID') {
          version = value;
        }
      }

      if (distro) {
        const major = version.split('.').at(0) || '';
        switch (distro) {
          case 'ubuntu':
            return `ubuntu-${major || '22'}-${arch}`;
          case 'debian':
            return `debian-${major || '11'}-${arch}`;
          case 'alpine':
            return `alpine-${major || '3'}-${arch}`;
          case 'arch':
            return `arch-rolling-${arch}`;
          default:
            return `${distro}-${major || '0'}-${arch}`;
        }
      }
    }

    return `linux-unknown-${arch}`;
  }

  if (process.platform === 'darwin') {
    return `macos-unknown-${arch}`;
  }

  if (process.platform === 'win32') {
    return `windows-11-${arch}`;
  }

  return `${process.platform}-unknown-${arch}`;
}

function resolveExactTag(spec: TagVerificationSpec, workingDirectory: string): string {
  let resolved = spec.tag;

  if (!spec.noGit && !isGitDisabledByEnv() && !tagHasExplicitChannel(spec.tag)) {
    const gitContext = detectGitContext(spec.pathHint, workingDirectory);
    const branch = gitContext.branch ? normalizeRef(gitContext.branch) : undefined;
    const defaultBranch = gitContext.defaultBranch ? normalizeRef(gitContext.defaultBranch) : undefined;

    if (branch && !isDefaultBranch(branch, defaultBranch)) {
      resolved = `${resolved}-branch-${branch}`;
    } else if (!branch && gitContext.commitSha) {
      resolved = `${resolved}-sha-${shortenSha(gitContext.commitSha)}`;
    }
  }

  if (!spec.noPlatform && !hasPlatformSuffix(resolved)) {
    resolved = `${resolved}-${detectPlatformSuffix()}`;
  }

  return resolved;
}

export function resolveVerificationTags(specs: TagVerificationSpec[], workingDirectory: string): string[] {
  const resolved: string[] = [];
  const seen = new Set<string>();

  for (const spec of specs) {
    const exactTag = resolveExactTag(spec, workingDirectory);
    if (!seen.has(exactTag)) {
      seen.add(exactTag);
      resolved.push(exactTag);
    }
  }

  return resolved;
}

function appendVerificationSpecsFromEntries(
  specs: TagVerificationSpec[],
  entries: string,
  noPlatform: boolean,
  noGit: boolean,
): void {
  if (!entries.trim()) {
    return;
  }

  for (const entry of parseEntries(entries, 'restore')) {
    specs.push({
      tag: entry.tag,
      noPlatform,
      noGit,
      pathHint: entry.savePath,
      saveExpected: true,
    });
  }
}

export function buildGenericVerificationSpecs(
  plan: ResolvedPlan,
  inputs: Pick<OneInputs, 'noPlatform' | 'enableCrossOsArchive'>,
  includeRuntime: boolean,
): TagVerificationSpec[] {
  const specs: TagVerificationSpec[] = [];
  const noPlatform = inputs.noPlatform || inputs.enableCrossOsArchive;

  if (includeRuntime && plan.runtimeEntry) {
    appendVerificationSpecsFromEntries(specs, plan.runtimeEntry, noPlatform, false);
  }

  appendVerificationSpecsFromEntries(specs, plan.archiveEntries, noPlatform, false);
  return specs;
}

interface CheckExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface TagCheckBatch {
  tags: string[];
  noPlatform: boolean;
  noGit: boolean;
}

function groupVerificationSpecs(specs: TagVerificationSpec[]): TagCheckBatch[] {
  const grouped = new Map<string, TagCheckBatch>();

  for (const spec of specs) {
    const key = `${spec.noPlatform ? '1' : '0'}:${spec.noGit ? '1' : '0'}`;
    const batch = grouped.get(key) || {
      tags: [],
      noPlatform: spec.noPlatform,
      noGit: spec.noGit,
    };
    if (!batch.tags.includes(spec.tag)) {
      batch.tags.push(spec.tag);
    }
    grouped.set(key, batch);
  }

  return Array.from(grouped.values());
}

async function runTagCheck(
  workspace: string,
  batch: TagCheckBatch,
  options: Pick<VerifyResolvedTagsOptions, 'requireServerSignature' | 'verbose'>,
): Promise<CheckExecutionResult> {
  const args: string[] = [];
  if (options.verbose) {
    args.push('--verbose');
  }
  if (options.requireServerSignature) {
    args.push('--require-server-signature');
  }
  args.push(
    'check',
    workspace,
    batch.tags.join(','),
  );
  if (batch.noPlatform) {
    args.push('--no-platform');
  }
  if (batch.noGit) {
    args.push('--no-git');
  }
  args.push(
    '--exact',
    '--fail-on-miss',
  );

  let stdout = '';
  let stderr = '';
  const exitCode = await exec.exec('boringcache', args, {
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

  return { exitCode, stdout: stdout.trim(), stderr: stderr.trim() };
}

function formatCheckFailure(result: CheckExecutionResult): string {
  const details = [result.stderr, result.stdout].filter(Boolean).join('\n');
  return details || `boringcache check exited with code ${result.exitCode}`;
}

export async function verifyResolvedTags(
  workspace: string,
  exactTags: string[],
  options: VerifyResolvedTagsOptions,
): Promise<void> {
  const specs: TagVerificationSpec[] = exactTags.map((tag) => ({
    tag,
    noPlatform: true,
    noGit: true,
  }));
  return verifyVerificationSpecs(workspace, specs, options);
}

export async function verifyVerificationSpecs(
  workspace: string,
  specs: TagVerificationSpec[],
  options: VerifyResolvedTagsOptions,
): Promise<void> {
  const batches = groupVerificationSpecs(specs);
  if (options.mode === 'none' || batches.length === 0) {
    return;
  }

  if (options.mode === 'check') {
    for (const batch of batches) {
      const result = await runTagCheck(workspace, batch, options);
      if (result.exitCode !== 0) {
        throw new Error(`Verification failed for tags ${batch.tags.join(', ')}: ${formatCheckFailure(result)}`);
      }
    }
    const total = batches.reduce((sum, batch) => sum + batch.tags.length, 0);
    core.info(`Verified ${total} tag${total === 1 ? '' : 's'} in ${workspace}`);
    return;
  }

  const warnOnly = options.mode === 'warn';
  const deadline = Date.now() + options.timeoutSeconds * 1000;
  let attempt = 0;
  let lastFailure = '';
  const total = batches.reduce((sum, batch) => sum + batch.tags.length, 0);

  while (Date.now() < deadline) {
    attempt += 1;
    let pendingBatch: TagCheckBatch | null = null;

    for (const batch of batches) {
      const result = await runTagCheck(workspace, batch, options);
      if (result.exitCode !== 0) {
        pendingBatch = batch;
        lastFailure = formatCheckFailure(result);
        break;
      }
    }

    if (!pendingBatch) {
      core.info(`Verified ${total} tag${total === 1 ? '' : 's'} in ${workspace} after ${attempt} attempt${attempt === 1 ? '' : 's'}`);
      return;
    }

    core.info(`Waiting for tags to become visible (${attempt}): ${pendingBatch.tags.join(', ')}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  const failureMessage =
    `Timed out waiting ${options.timeoutSeconds}s for ${total} tag${total === 1 ? '' : 's'} in ${workspace}: ${lastFailure}`;

  if (warnOnly) {
    core.warning(failureMessage);
    return;
  }

  throw new Error(
    failureMessage,
  );
}

export function parseToolSpecs(input: string): ToolSpec[] {
  return input
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const atIndex = entry.lastIndexOf('@');
      if (atIndex <= 0 || atIndex === entry.length - 1) {
        throw new Error(`Invalid tool spec "${entry}". Expected format tool@version.`);
      }
      const name = normalizeToolName(entry.slice(0, atIndex));
      const version = entry.slice(atIndex + 1).trim();
      return {
        name,
        version,
        label: TOOL_LABELS[name] || name,
        source: 'input' as const,
      };
    });
}

export async function resolveRuntimeTools(
  setup: SetupMode,
  preset: Preset,
  mode: OneMode,
  toolsInput: string,
  workingDirectory: string,
  uvVersion: string,
  composerVersion: string,
): Promise<ToolSpec[]> {
  if (setup !== 'mise') {
    return [];
  }

  const explicitTools = parseToolSpecs(toolsInput);
  const projectTools = await detectProjectTools(workingDirectory);
  const presetTools = await detectPresetTools(preset, workingDirectory, uvVersion, composerVersion);
  const modeTools = await detectModeTools(mode, workingDirectory);
  return mergeTools(explicitTools, projectTools, presetTools, modeTools);
}

async function detectProjectTools(workingDirectory: string): Promise<ToolSpec[]> {
  const tools = new Map<string, ToolSpec>();

  for (const tool of await readProjectMiseTools(workingDirectory)) {
    const normalizedName = normalizeToolName(tool.name);
    tools.set(normalizedName, {
      name: normalizedName,
      version: tool.version,
      label: TOOL_LABELS[normalizedName] || tool.name,
      source: 'project',
    });
  }

  const detectedTools = await Promise.all([
    detectToolFromProjectFiles(workingDirectory, 'ruby', detectRubyVersion),
    detectToolFromProjectFiles(workingDirectory, 'node', detectNodeVersion),
    detectToolFromProjectFiles(workingDirectory, 'python', detectPythonVersion),
    detectToolFromProjectFiles(workingDirectory, 'go', detectGoVersion),
    detectToolFromProjectFiles(workingDirectory, 'java', detectJavaVersion),
    detectToolFromProjectFiles(workingDirectory, 'maven', detectMavenVersion),
    detectToolFromProjectFiles(workingDirectory, 'bazel', detectBazelVersion),
    detectToolFromProjectFiles(workingDirectory, 'rust', detectRustVersion),
  ]);

  for (const tool of detectedTools) {
    if (tool && !tools.has(tool.name)) {
      tools.set(tool.name, tool);
    }
  }

  const packageManagerTool = await detectNodePackageManagerTool(workingDirectory);
  if (packageManagerTool && !tools.has(packageManagerTool.name)) {
    tools.set(packageManagerTool.name, packageManagerTool);
  }

  return Array.from(tools.values());
}

async function detectPresetTools(
  preset: Preset,
  workingDirectory: string,
  uvVersion: string,
  composerVersion: string,
): Promise<ToolSpec[]> {
  switch (preset) {
    case 'rails':
      return detectRailsTools(workingDirectory);
    case 'ruby':
      return detectRubyTools(workingDirectory);
    case 'node':
      return detectNodeTools(workingDirectory);
    case 'node-turbo':
      return detectNodeTurboTools(workingDirectory);
    case 'python-uv':
      return detectPythonUvTools(workingDirectory, uvVersion);
    case 'go':
      return detectGoTools(workingDirectory);
    case 'php-composer':
      return detectPhpComposerTools(workingDirectory, composerVersion);
    default:
      return [];
  }
}

async function detectModeTools(mode: OneMode, workingDirectory: string): Promise<ToolSpec[]> {
  switch (mode) {
    case 'turbo-proxy':
      return detectNodeTurboTools(workingDirectory);
    case 'bazel':
      return detectBazelTools(workingDirectory);
    case 'gradle':
      return detectGradleTools(workingDirectory);
    case 'maven':
      return detectMavenTools(workingDirectory);
    case 'rust-sccache':
      return detectRustTools(workingDirectory);
    default:
      return [];
  }
}

async function detectRubyTools(workingDirectory: string): Promise<ToolSpec[]> {
  const rubyVersion = await detectRubyVersion(workingDirectory);
  if (!rubyVersion) {
    return [];
  }

  return [{ name: 'ruby', version: rubyVersion, label: 'Ruby', source: 'preset' }];
}

async function detectRailsTools(workingDirectory: string): Promise<ToolSpec[]> {
  const tools = await detectRubyTools(workingDirectory);

  if (await needsNodeRuntime(workingDirectory)) {
    const nodeVersion = await detectNodeVersion(workingDirectory);
    if (nodeVersion) {
      tools.push({ name: 'node', version: nodeVersion, label: 'Node.js', source: 'preset' });
    }
  }

  const packageManagerTool = await detectNodePackageManagerTool(workingDirectory, 'preset');
  if (packageManagerTool) {
    tools.push(packageManagerTool);
  }

  return tools;
}

async function detectNodeTools(workingDirectory: string): Promise<ToolSpec[]> {
  const tools: ToolSpec[] = [];
  const nodeVersion = await detectNodeVersion(workingDirectory);
  if (nodeVersion) {
    tools.push({ name: 'node', version: nodeVersion, label: 'Node.js', source: 'preset' });
  }

  const packageManagerTool = await detectNodePackageManagerTool(workingDirectory, 'preset');
  if (packageManagerTool) {
    tools.push(packageManagerTool);
  }

  return tools;
}

async function detectNodeTurboTools(workingDirectory: string): Promise<ToolSpec[]> {
  return detectNodeTools(workingDirectory);
}

async function detectPythonUvTools(workingDirectory: string, defaultUvVersion: string): Promise<ToolSpec[]> {
  const tools: ToolSpec[] = [];
  const pythonVersion = await detectPythonVersion(workingDirectory);
  if (pythonVersion) {
    tools.push({ name: 'python', version: pythonVersion, label: 'Python', source: 'preset' });
  }

  tools.push({
    name: 'uv',
    version: (await detectUvVersion(workingDirectory)) || defaultUvVersion,
    label: 'uv',
    source: 'preset',
  });

  return tools;
}

async function detectGoTools(workingDirectory: string): Promise<ToolSpec[]> {
  const goVersion = await detectGoVersion(workingDirectory);
  if (!goVersion) {
    return [];
  }

  return [{ name: 'go', version: goVersion, label: 'Go', source: 'preset' }];
}

async function detectPhpComposerTools(workingDirectory: string, defaultComposerVersion: string): Promise<ToolSpec[]> {
  const tools: ToolSpec[] = [];
  const phpVersion = await detectPhpVersion(workingDirectory);
  if (phpVersion) {
    tools.push({ name: 'php', version: phpVersion, label: 'PHP', source: 'preset' });
  }

  tools.push({
    name: 'composer',
    version: (await detectComposerVersion(workingDirectory)) || defaultComposerVersion,
    label: 'Composer',
    source: 'preset',
  });

  return tools;
}

async function detectBazelTools(workingDirectory: string): Promise<ToolSpec[]> {
  const bazelVersion = await detectBazelVersion(workingDirectory);
  if (!bazelVersion) {
    return [];
  }

  return [{ name: 'bazel', version: bazelVersion, label: 'Bazel', source: 'mode' }];
}

async function detectGradleTools(workingDirectory: string): Promise<ToolSpec[]> {
  const javaVersion = await detectJavaVersion(workingDirectory);
  if (!javaVersion) {
    return [];
  }

  return [{ name: 'java', version: javaVersion, label: 'Java', source: 'mode' }];
}

async function detectMavenTools(workingDirectory: string): Promise<ToolSpec[]> {
  const tools: ToolSpec[] = [];
  const javaVersion = await detectJavaVersion(workingDirectory);
  if (javaVersion) {
    tools.push({ name: 'java', version: javaVersion, label: 'Java', source: 'mode' });
  }

  const mavenVersion = await detectMavenVersion(workingDirectory);
  if (mavenVersion) {
    tools.push({ name: 'maven', version: mavenVersion, label: 'Maven', source: 'mode' });
  }

  return tools;
}

async function detectRustTools(workingDirectory: string): Promise<ToolSpec[]> {
  const rustVersion = await detectRustVersion(workingDirectory);
  if (!rustVersion) {
    return [];
  }

  return [{ name: 'rust', version: rustVersion, label: 'Rust', source: 'mode' }];
}

async function detectRubyVersion(workingDirectory: string): Promise<string | null> {
  const rubyVersion = await readFirstLine(path.join(workingDirectory, '.ruby-version'));
  if (rubyVersion) {
    return rubyVersion;
  }

  const toolVersion = await readToolVersionsValue(workingDirectory, 'ruby');
  if (toolVersion) {
    return toolVersion;
  }

  return readMiseTomlVersion(workingDirectory, 'ruby');
}

async function detectNodeVersion(workingDirectory: string): Promise<string | null> {
  const nodeVersion = await readFirstLine(path.join(workingDirectory, '.node-version'));
  if (nodeVersion) {
    return nodeVersion.replace(/^v/, '');
  }

  const nvmVersion = await readFirstLine(path.join(workingDirectory, '.nvmrc'));
  if (nvmVersion) {
    return nvmVersion.replace(/^v/, '');
  }

  const toolVersion = (await readToolVersionsValue(workingDirectory, 'nodejs'))
    || (await readToolVersionsValue(workingDirectory, 'node'));
  if (toolVersion) {
    return toolVersion;
  }

  return (await readMiseTomlVersion(workingDirectory, 'node'))
    || (await readMiseTomlVersion(workingDirectory, 'nodejs'));
}

async function detectBazelVersion(workingDirectory: string): Promise<string | null> {
  const bazelVersion = await readFirstLine(path.join(workingDirectory, '.bazelversion'));
  if (bazelVersion) {
    return bazelVersion;
  }

  const toolVersion = await readToolVersionsValue(workingDirectory, 'bazel');
  if (toolVersion) {
    return toolVersion;
  }

  return readMiseTomlVersion(workingDirectory, 'bazel');
}

async function detectPythonVersion(workingDirectory: string): Promise<string | null> {
  const pythonVersion = await readFirstLine(path.join(workingDirectory, '.python-version'));
  if (pythonVersion) {
    return pythonVersion;
  }

  const toolVersion = await readToolVersionsValue(workingDirectory, 'python');
  if (toolVersion) {
    return toolVersion;
  }

  return readMiseTomlVersion(workingDirectory, 'python');
}

async function detectGoVersion(workingDirectory: string): Promise<string | null> {
  const goVersion = await readFirstLine(path.join(workingDirectory, '.go-version'));
  if (goVersion) {
    return goVersion;
  }

  const toolVersion = (await readToolVersionsValue(workingDirectory, 'go'))
    || (await readToolVersionsValue(workingDirectory, 'golang'));
  if (toolVersion) {
    return toolVersion;
  }

  return (await readMiseTomlVersion(workingDirectory, 'go'))
    || (await readMiseTomlVersion(workingDirectory, 'golang'));
}

async function detectUvVersion(workingDirectory: string): Promise<string | null> {
  const toolVersion = await readToolVersionsValue(workingDirectory, 'uv');
  if (toolVersion) {
    return toolVersion;
  }

  return readMiseTomlVersion(workingDirectory, 'uv');
}

async function detectPhpVersion(workingDirectory: string): Promise<string | null> {
  const phpVersion = await readFirstLine(path.join(workingDirectory, '.php-version'));
  if (phpVersion) {
    return phpVersion;
  }

  const toolVersion = await readToolVersionsValue(workingDirectory, 'php');
  if (toolVersion) {
    return toolVersion;
  }

  return readMiseTomlVersion(workingDirectory, 'php');
}

async function detectComposerVersion(workingDirectory: string): Promise<string | null> {
  const toolVersion = await readToolVersionsValue(workingDirectory, 'composer');
  if (toolVersion) {
    return toolVersion;
  }

  return readMiseTomlVersion(workingDirectory, 'composer');
}

async function detectJavaVersion(workingDirectory: string): Promise<string | null> {
  const javaVersion = await readFirstLine(path.join(workingDirectory, '.java-version'));
  if (javaVersion) {
    return javaVersion;
  }

  const toolVersion = await readToolVersionsValue(workingDirectory, 'java');
  if (toolVersion) {
    return toolVersion;
  }

  const miseVersion = await readMiseTomlVersion(workingDirectory, 'java');
  if (miseVersion) {
    return miseVersion;
  }

  const pomXml = await readFile(path.join(workingDirectory, 'pom.xml'));
  if (pomXml) {
    const pomMatch = pomXml.match(/<maven\.compiler\.(?:release|source|target)>\s*([^<\s]+)\s*<\/maven\.compiler\.(?:release|source|target)>/)
      || pomXml.match(/<java\.version>\s*([^<\s]+)\s*<\/java\.version>/);
    if (pomMatch?.[1]) {
      return pomMatch[1].trim();
    }
  }

  return null;
}

async function detectMavenVersion(workingDirectory: string): Promise<string | null> {
  const wrapperProps = await readFile(path.join(workingDirectory, '.mvn', 'wrapper', 'maven-wrapper.properties'));
  if (wrapperProps) {
    const match = wrapperProps.match(/apache-maven-([0-9]+(?:\.[0-9]+)*)-bin/i);
    if (match?.[1]) {
      return match[1];
    }
  }

  const toolVersion = await readToolVersionsValue(workingDirectory, 'maven');
  if (toolVersion) {
    return toolVersion;
  }

  return readMiseTomlVersion(workingDirectory, 'maven');
}

async function detectRustVersion(workingDirectory: string): Promise<string | null> {
  const rustToolchainToml = await readFile(path.join(workingDirectory, 'rust-toolchain.toml'));
  if (rustToolchainToml) {
    const match = rustToolchainToml.match(/channel\s*=\s*["']([^"']+)["']/);
    if (match?.[1]) {
      return match[1];
    }
  }

  const rustToolchain = await readFirstLine(path.join(workingDirectory, 'rust-toolchain'));
  if (rustToolchain) {
    return rustToolchain;
  }

  const toolVersion = await readToolVersionsValue(workingDirectory, 'rust');
  if (toolVersion) {
    return toolVersion;
  }

  return readMiseTomlVersion(workingDirectory, 'rust');
}

async function detectToolFromProjectFiles(
  workingDirectory: string,
  toolName: string,
  detector: (projectDirectory: string) => Promise<string | null>,
): Promise<ToolSpec | null> {
  const version = await detector(workingDirectory);
  if (!version) {
    return null;
  }

  return {
    name: normalizeToolName(toolName),
    version,
    label: TOOL_LABELS[normalizeToolName(toolName)] || toolName,
    source: 'project',
  };
}

async function readFirstLine(filePath: string): Promise<string | null> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const line = content.split('\n').map((value) => value.trim()).find(Boolean);
    return line || null;
  } catch {
    return null;
  }
}

async function readFile(filePath: string): Promise<string | null> {
  try {
    return await fs.promises.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

async function needsNodeRuntime(workingDirectory: string): Promise<boolean> {
  const markers = ['package.json', 'yarn.lock', 'pnpm-lock.yaml', 'package-lock.json', 'turbo.json'];
  for (const marker of markers) {
    if (await pathExists(path.join(workingDirectory, marker))) {
      return true;
    }
  }
  return false;
}

async function readPackageJson(workingDirectory: string): Promise<Record<string, unknown> | null> {
  const packageJson = await readFile(path.join(workingDirectory, 'package.json'));
  if (!packageJson) {
    return null;
  }

  try {
    return JSON.parse(packageJson) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizePackageManagerName(name: string): NodePackageManagerInfo['name'] | null {
  const normalized = name.trim().toLowerCase();
  if (normalized === 'npm' || normalized === 'pnpm' || normalized === 'yarn') {
    return normalized;
  }
  return null;
}

function packageManagerCacheDir(workingDirectory: string, name: NodePackageManagerInfo['name']): string {
  switch (name) {
    case 'pnpm':
      return path.join(workingDirectory, '.pnpm-store');
    case 'yarn':
      return path.join(workingDirectory, '.yarn-cache');
    case 'npm':
      return path.join(workingDirectory, '.npm-cache');
  }
}

export async function detectNodePackageManager(workingDirectory: string): Promise<NodePackageManagerInfo | null> {
  const packageJson = await readPackageJson(workingDirectory);
  const packageManagerField = typeof packageJson?.packageManager === 'string'
    ? packageJson.packageManager.trim()
    : '';

  let name: NodePackageManagerInfo['name'] | null = null;
  let version: string | null = null;

  if (packageManagerField) {
    const atIndex = packageManagerField.lastIndexOf('@');
    if (atIndex > 0) {
      name = normalizePackageManagerName(packageManagerField.slice(0, atIndex));
      version = packageManagerField.slice(atIndex + 1).trim().split('+')[0] || null;
    }
  }

  if (!name) {
    if (await pathExists(path.join(workingDirectory, 'pnpm-lock.yaml'))) {
      name = 'pnpm';
    } else if (await pathExists(path.join(workingDirectory, 'yarn.lock'))) {
      name = 'yarn';
    } else if (
      await pathExists(path.join(workingDirectory, 'package-lock.json'))
      || await pathExists(path.join(workingDirectory, 'npm-shrinkwrap.json'))
    ) {
      name = 'npm';
    } else if (packageJson) {
      name = 'npm';
    }
  }

  if (!name) {
    return null;
  }

  return {
    name,
    version,
    packageManagerField: packageManagerField || null,
    cacheDir: packageManagerCacheDir(workingDirectory, name),
    nodeModulesDir: path.join(workingDirectory, 'node_modules'),
  };
}

async function detectNodePackageManagerTool(
  workingDirectory: string,
  source: ToolSpec['source'] = 'project',
): Promise<ToolSpec | null> {
  const packageManager = await detectNodePackageManager(workingDirectory);
  if (!packageManager?.version) {
    return null;
  }

  return {
    name: packageManager.name,
    version: packageManager.version,
    label: TOOL_LABELS[packageManager.name] || packageManager.name,
    source,
  };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function mergeTools(...toolSets: ToolSpec[][]): ToolSpec[] {
  const merged = new Map<string, ToolSpec>();

  for (const toolSet of toolSets) {
    for (const tool of toolSet) {
      if (tool.source === 'input' || !merged.has(tool.name)) {
        merged.set(tool.name, tool);
      }
    }
  }

  return Array.from(merged.values());
}

function normalizeToolName(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (normalized === 'nodejs') {
    return 'node';
  }
  if (normalized === 'golang') {
    return 'go';
  }
  return normalized;
}

export function buildRuntimeCacheTag(
  cacheTagPrefix: string,
  runtimeCacheTag: string,
  tools: ToolSpec[],
  versionScope: MiseVersionScope,
): string | null {
  if (tools.length === 0) {
    return null;
  }

  if (runtimeCacheTag.trim()) {
    return runtimeCacheTag.trim();
  }

  return buildMiseRuntimeTag(cacheTagPrefix, tools, versionScope);
}

export function buildRuntimeCacheEntry(
  cacheTagPrefix: string,
  runtimeCacheTag: string,
  tools: ToolSpec[],
  versionScope: MiseVersionScope,
): string | null {
  const runtimeTag = buildRuntimeCacheTag(cacheTagPrefix, runtimeCacheTag, tools, versionScope);
  if (!runtimeTag) {
    return null;
  }
  return `${runtimeTag}:${getMiseInstallsDir()}`;
}

function normalizeEntriesInput(entries: string): string {
  return entries
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join(',');
}

function splitEntriesInput(entries: string): string[] {
  return entries
    .split(/[\r\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

interface CliDryRunPlan {
  workspace: string;
  workspace_source?: 'explicit' | 'repo-config' | 'configured-default';
  repo_config_path?: string;
  tag_path_pairs: string[];
  archive_entries?: CliDryRunArchiveEntry[];
  archive_restore_candidates?: CliDryRunArchiveRestoreCandidate[];
  env_vars: Record<string, string>;
}

interface CliDryRunArchiveEntry {
  requested: string;
  request_source: 'profile' | 'entry' | 'command-inferred' | 'archive-path' | 'manual';
  profile?: string;
  resolution_source: 'repo-config' | 'built-in' | 'manual';
  resolved_tag?: string;
  tag: string;
  path?: string | null;
  tag_path_pair: string;
}

interface CliDryRunArchiveRestoreCandidate {
  tag_prefix: string;
  tag_path_pairs: string[];
}

export interface ResolvedCliArchiveEntry {
  requested: string;
  tag: string;
  path: string;
  tagPathPair: string;
}

export interface ResolvedCliArchiveEntriesPlan {
  workspace: string;
  entries: ResolvedCliArchiveEntry[];
  envVars: Record<string, string>;
}

interface ResolvedArchiveEntries {
  entries: string;
  restoreCandidates: ArchiveRestoreCandidate[];
  usesCacheFormat: boolean;
  envVars: Record<string, string>;
  cacheTagPrefix?: string;
  workspace?: string;
}

export interface ArchiveRestoreCandidate {
  tagPrefix: string;
  entries: string;
}

const PROJECT_CONFIG_FILE_NAMES = ['.boringcache.toml', 'boringcache.toml'];

function findNearestRepoConfigPath(workingDirectory: string): string | null {
  let current = path.resolve(workingDirectory);

  while (true) {
    for (const fileName of PROJECT_CONFIG_FILE_NAMES) {
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

async function runDryRunPlan(
  workingDirectory: string,
  options: {
    workspaceInput: string;
    entryIds?: string[];
    profileNames?: string[];
    manualTagPathPairs?: string[];
    archivePaths?: string[];
    archiveTagPrefix?: string;
    archiveRestorePrefixes?: string[];
    cacheTag?: string;
    toolTagSuffix?: string | null;
    noPlatform?: boolean;
    fallbackWorkspace?: string;
  },
): Promise<CliDryRunPlan> {
  const {
    workspaceInput,
    entryIds = [],
    profileNames = [],
    manualTagPathPairs = [],
    archivePaths = [],
    archiveTagPrefix = '',
    archiveRestorePrefixes = [],
    cacheTag = '',
    toolTagSuffix = '',
    noPlatform = false,
    fallbackWorkspace,
  } = options;
  const executePlan = async (candidateWorkspace: string): Promise<CliDryRunPlan> => {
    const args = ['run'];
    const trimmedWorkspace = candidateWorkspace.trim();
    if (trimmedWorkspace) {
      args.push(trimmedWorkspace);
    }
    if (manualTagPathPairs.length > 0) {
      args.push(manualTagPathPairs.join(','));
    }
    for (const profileName of profileNames) {
      args.push('--profile', profileName);
    }
    for (const entryId of entryIds) {
      args.push('--entry', entryId);
    }
    for (const archivePath of archivePaths) {
      args.push('--archive-path', archivePath);
    }
    if (archiveTagPrefix.trim()) {
      args.push('--archive-tag-prefix', archiveTagPrefix.trim());
    }
    for (const archiveRestorePrefix of archiveRestorePrefixes) {
      args.push('--archive-restore-prefix', archiveRestorePrefix);
    }
    if (cacheTag.trim()) {
      args.push('--cache-tag', cacheTag.trim());
    }
    if (toolTagSuffix?.trim()) {
      args.push('--tool-tag-suffix', toolTagSuffix.trim());
    }
    if (noPlatform) {
      args.push('--no-platform');
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
      throw new Error(stderr.trim() || stdout.trim() || `boringcache run --dry-run --json exited with code ${exitCode}`);
    }

    try {
      return JSON.parse(stdout) as CliDryRunPlan;
    } catch (error) {
      throw new Error(
        `Failed to parse boringcache dry-run JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  try {
    return await executePlan(workspaceInput);
  } catch (error) {
    if (
      !workspaceInput.trim()
      && fallbackWorkspace
      && error instanceof Error
      && /No workspace specified/i.test(error.message)
    ) {
      return executePlan(fallbackWorkspace);
    }
    throw error;
  }
}

export async function resolveCliArchiveEntries(
  workingDirectory: string,
  options: {
    workspaceInput: string;
    entryIds: string[];
    cacheTag?: string;
    toolTagSuffix?: string | null;
    fallbackWorkspace?: string;
  },
): Promise<ResolvedCliArchiveEntriesPlan> {
  const plan = await runDryRunPlan(workingDirectory, {
    workspaceInput: options.workspaceInput,
    entryIds: options.entryIds,
    cacheTag: options.cacheTag,
    toolTagSuffix: options.toolTagSuffix,
    fallbackWorkspace: options.fallbackWorkspace,
  });

  const workspace = plan.workspace?.trim()
    || options.fallbackWorkspace?.trim()
    || resolveWorkspace(options.workspaceInput);

  return {
    workspace,
    envVars: plan.env_vars,
    entries: (plan.archive_entries || [])
      .filter((entry): entry is CliDryRunArchiveEntry & { path: string } => Boolean(entry.path))
      .map((entry) => ({
        requested: entry.requested,
        tag: entry.tag,
        path: entry.path,
        tagPathPair: entry.tag_path_pair,
      })),
  };
}

function isUnknownEntryResolutionError(error: unknown): boolean {
  return error instanceof Error && /Unknown cache entry/i.test(error.message);
}

async function maybeResolveRawEntryViaCli(
  workingDirectory: string,
  workspaceInput: string,
  rawTag: string,
  cacheTag: string,
  toolTagSuffix: string | null,
  fallbackWorkspace?: string,
): Promise<CliDryRunPlan | null> {
  try {
    return await runDryRunPlan(workingDirectory, {
      workspaceInput,
      entryIds: [rawTag],
      cacheTag,
      toolTagSuffix,
      fallbackWorkspace,
    });
  } catch (error) {
    if (isUnknownEntryResolutionError(error)) {
      return null;
    }
    throw error;
  }
}

async function maybeResolveWorkspaceViaCli(
  workingDirectory: string,
  workspaceInput: string,
  fallbackWorkspace: string,
): Promise<string | null> {
  const plan = await runDryRunPlan(workingDirectory, {
    workspaceInput,
    fallbackWorkspace,
  });
  return plan.workspace?.trim() || null;
}

function cliPlanHasProvenance(plan: CliDryRunPlan): boolean {
  return Boolean(plan.workspace_source || plan.repo_config_path || plan.archive_entries);
}

function cliPlanUsesRepoConfigResolution(plan: CliDryRunPlan): boolean {
  const firstEntry = plan.archive_entries?.[0];
  if (firstEntry) {
    return firstEntry.resolution_source === 'repo-config';
  }
  return Boolean(plan.repo_config_path);
}

async function detectDefaultArchiveEntries(inputs: OneInputs): Promise<string> {
  if (inputs.preset === 'ruby') {
    return 'bundler';
  }

  if (inputs.preset === 'rails') {
    return joinDefaultEntries(
      'bundler',
      await detectNodeDefaultArchiveEntries(inputs.workingDirectory),
    );
  }

  if (inputs.preset === 'node' || inputs.preset === 'node-turbo') {
    return await detectNodeDefaultArchiveEntries(inputs.workingDirectory);
  }

  if (inputs.preset === 'python-uv') {
    return 'uv-cache';
  }

  if (inputs.preset === 'go') {
    return joinDefaultEntries(
      'go-mod-cache',
      'go-build-cache',
    );
  }

  if (inputs.preset === 'php-composer') {
    return joinDefaultEntries(
      'composer-cache',
      'vendor',
    );
  }

  return '';
}

function joinDefaultEntries(...groups: string[]): string {
  return groups
    .flatMap((group) => group.split(/\r?\n/))
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join('\n');
}

function defaultGoModCacheDir(workingDirectory: string): string {
  const configured = process.env.GOMODCACHE?.trim();
  if (!configured) {
    return '.go/pkg/mod';
  }

  return path.isAbsolute(configured)
    ? configured
    : path.relative(workingDirectory, path.resolve(workingDirectory, configured)) || '.';
}

function defaultGoBuildCacheDir(workingDirectory: string): string {
  const configured = process.env.GOCACHE?.trim();
  if (!configured) {
    return '.go/build-cache';
  }

  return path.isAbsolute(configured)
    ? configured
    : path.relative(workingDirectory, path.resolve(workingDirectory, configured)) || '.';
}

interface ComposerConfig {
  cacheDir?: string;
  vendorDir?: string;
}

async function readComposerConfig(workingDirectory: string): Promise<ComposerConfig> {
  const composerJson = await readFile(path.join(workingDirectory, 'composer.json'));
  if (!composerJson) {
    return {};
  }

  try {
    const parsed = JSON.parse(composerJson) as {
      config?: { [key: string]: unknown };
    };
    const config = parsed.config || {};
    return {
      cacheDir: typeof config['cache-dir'] === 'string' ? config['cache-dir'] : undefined,
      vendorDir: typeof config['vendor-dir'] === 'string' ? config['vendor-dir'] : undefined,
    };
  } catch {
    return {};
  }
}

async function defaultComposerCacheDir(workingDirectory: string): Promise<string> {
  const configured = process.env.COMPOSER_CACHE_DIR?.trim() || (await readComposerConfig(workingDirectory)).cacheDir;
  if (!configured) {
    return '.composer-cache';
  }

  return path.isAbsolute(configured)
    ? configured
    : path.relative(workingDirectory, path.resolve(workingDirectory, configured)) || '.';
}

async function defaultComposerVendorDir(workingDirectory: string): Promise<string> {
  const configured = process.env.COMPOSER_VENDOR_DIR?.trim() || (await readComposerConfig(workingDirectory)).vendorDir;
  if (!configured) {
    return 'vendor';
  }

  return path.isAbsolute(configured)
    ? configured
    : path.relative(workingDirectory, path.resolve(workingDirectory, configured)) || '.';
}

async function detectNodeDefaultArchiveEntries(workingDirectory: string): Promise<string> {
  const packageManager = await detectNodePackageManager(workingDirectory);
  if (!packageManager) {
    return '';
  }

  switch (packageManager.name) {
    case 'pnpm':
      return 'pnpm-store\nnode-modules';
    case 'yarn':
      return 'yarn-cache\nnode-modules';
    case 'npm':
      return 'npm-cache\nnode-modules';
  }
}

export async function buildArchiveEntries(
  inputs: OneInputs,
  runtimeTools: ToolSpec[],
): Promise<ResolvedArchiveEntries> {
  let archiveEntries: string[] = [];
  let restoreCandidates: ArchiveRestoreCandidate[] = [];
  let usesCacheFormat = false;
  const envVars: Record<string, string> = {};
  let cacheTagPrefix: string | undefined;
  let resolvedWorkspace: string | undefined;
  let sourceEntries = inputs.entries;
  const cacheProfiles = splitEntriesInput(inputs.cacheProfiles);
  const repoConfigPath = findNearestRepoConfigPath(inputs.workingDirectory);
  const fallbackWorkspace = resolveWorkspace(inputs.workspace);
  const cliWorkspaceInput = inputs.workspace.trim();
  const cliToolTagSuffix = inputs.setup === 'mise'
    ? buildMiseToolTag(runtimeTools, inputs.toolVersionScope)
    : null;

  const mergeCliPlan = (plan: CliDryRunPlan): void => {
    archiveEntries.push(...plan.tag_path_pairs);
    if (!cacheTagPrefix) {
      const firstEntry = plan.archive_entries?.[0];
      const firstPair = plan.tag_path_pairs[0];
      cacheTagPrefix = firstEntry?.resolved_tag || firstEntry?.tag
        || (firstPair ? parseEntries(firstPair, 'restore', { resolvePaths: false })[0]?.tag : undefined);
    }
    Object.assign(envVars, plan.env_vars);
    if (!resolvedWorkspace && plan.workspace) {
      resolvedWorkspace = plan.workspace;
    }
  };

  if (cacheProfiles.length > 0 || sourceEntries.trim()) {
    const semanticEntries: string[] = [];
    const rawEntries: string[] = [];

    for (const entry of splitEntriesInput(sourceEntries)) {
      if (entry.includes(':')) {
        rawEntries.push(entry);
      } else {
        semanticEntries.push(entry);
      }
    }

    if (cacheProfiles.length > 0 || semanticEntries.length > 0) {
      mergeCliPlan(await runDryRunPlan(inputs.workingDirectory, {
        workspaceInput: cliWorkspaceInput,
        entryIds: semanticEntries,
        profileNames: cacheProfiles,
        cacheTag: inputs.cacheTag,
        toolTagSuffix: cliToolTagSuffix,
        fallbackWorkspace,
      }));
    }

    for (const entryToken of rawEntries) {
      const parsedEntry = parseEntries(entryToken, 'restore', { resolvePaths: false })[0];
      if (!parsedEntry) {
        continue;
      }

      if (repoConfigPath && parsedEntry.restorePath === parsedEntry.savePath) {
        const resolved = await maybeResolveRawEntryViaCli(
          inputs.workingDirectory,
          cliWorkspaceInput,
          parsedEntry.tag,
          inputs.cacheTag,
          cliToolTagSuffix,
          fallbackWorkspace,
        );
        const shouldUpgrade = resolved
          && resolved.tag_path_pairs.length > 0
          && (
            cliPlanUsesRepoConfigResolution(resolved)
            || (!cliPlanHasProvenance(resolved) && Boolean(repoConfigPath))
          );
        if (shouldUpgrade) {
          mergeCliPlan(resolved);
          continue;
        }
      }

      if (!inputs.cacheTag.trim() && !cliToolTagSuffix?.trim()) {
        if (!cacheTagPrefix) {
          cacheTagPrefix = parsedEntry.tag;
        }
        archiveEntries.push(entryToken);
        continue;
      }

      mergeCliPlan(await runDryRunPlan(inputs.workingDirectory, {
        workspaceInput: cliWorkspaceInput,
        manualTagPathPairs: [entryToken],
        cacheTag: inputs.cacheTag,
        toolTagSuffix: cliToolTagSuffix,
        fallbackWorkspace,
      }));
    }
  } else if (inputs.path || inputs.key) {
    if (!inputs.path || !inputs.key) {
      throw new Error('actions/cache compatibility mode requires both path and key');
    }
    const archivePathPlan = await runDryRunPlan(inputs.workingDirectory, {
      workspaceInput: cliWorkspaceInput,
      archivePaths: inputs.path
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean),
      archiveTagPrefix: inputs.key,
      archiveRestorePrefixes: getRestoreKeyCandidates(inputs),
      noPlatform: inputs.noPlatform || inputs.enableCrossOsArchive,
      fallbackWorkspace,
    });
    archiveEntries = archivePathPlan.tag_path_pairs;
    restoreCandidates = (archivePathPlan.archive_restore_candidates || []).map((candidate) => ({
      tagPrefix: candidate.tag_prefix,
      entries: candidate.tag_path_pairs.join(','),
    }));
    usesCacheFormat = true;
    cacheTagPrefix = inputs.key.trim() || undefined;
  } else {
    sourceEntries = await detectDefaultArchiveEntries(inputs);
    const defaultEntryIds = splitEntriesInput(sourceEntries);
    if (defaultEntryIds.length > 0) {
      mergeCliPlan(await runDryRunPlan(inputs.workingDirectory, {
        workspaceInput: cliWorkspaceInput,
        entryIds: defaultEntryIds,
        cacheTag: inputs.cacheTag,
        toolTagSuffix: cliToolTagSuffix,
        fallbackWorkspace,
      }));
    }
  }

  return {
    entries: archiveEntries.join(','),
    restoreCandidates,
    usesCacheFormat,
    envVars,
    cacheTagPrefix,
    workspace: resolvedWorkspace,
  };
}

export function validateOneInputs(
  inputs: OneInputs,
  modeSpec: ModeSpec,
  runtimeTools: ToolSpec[],
  runtimeEntry: string | null,
  archiveEntries: string,
): void {
  if ((inputs.entries || inputs.cacheProfiles.trim()) && (inputs.path || inputs.key)) {
    core.warning('Both explicit entries/cache-profiles and actions/cache compatibility inputs were provided. Using entries/cache-profiles.');
  }

  if ((inputs.path && !inputs.key) || (!inputs.path && inputs.key)) {
    throw new Error('actions/cache compatibility mode requires both path and key');
  }

  if (inputs.setup !== 'mise' && inputs.tools.trim()) {
    core.warning(`Ignoring tools because setup=${inputs.setup}`);
  }

  if (inputs.setup !== 'mise' && inputs.cacheRuntime) {
    core.warning(`Ignoring cache-runtime because setup=${inputs.setup}`);
  }

  if (inputs.setup === 'mise' && inputs.cacheRuntime && runtimeTools.length === 0) {
    core.warning('cache-runtime requested but no mise tools were resolved');
  }

  const hasArchiveInputs = Boolean(archiveEntries || runtimeEntry);
  if (modeSpec.resolved === 'archive' && !hasArchiveInputs) {
    if (inputs.cliVersion.trim().toLowerCase() !== 'skip') {
      core.notice('No cache entries resolved; boringcache/one will install the CLI only.');
      return;
    }
    throw new Error('No cache entries resolved. Provide entries, path+key, or enable cache-runtime with setup=mise.');
  }
}

export async function buildPlan(inputs: OneInputs): Promise<ResolvedPlan> {
  const modeSpec = resolveModeSpec(inputs.mode);
  assertImplementedMode(modeSpec);
  const resolvedMavenVersion = inputs.mavenVersion || '3.9.9';
  const fallbackWorkspace = resolveWorkspace(inputs.workspace);
  const explicitWorkspace = inputs.workspace.trim();

  const runtimeTools = await resolveRuntimeTools(
    inputs.setup,
    inputs.preset,
    inputs.mode,
    inputs.tools,
    inputs.workingDirectory,
    inputs.uvVersion,
    inputs.composerVersion,
  );
  if (
    inputs.setup === 'mise'
    && modeSpec.resolved === 'maven'
    && resolvedMavenVersion
    && !runtimeTools.some((tool) => tool.name === 'maven')
  ) {
    runtimeTools.push({
      name: 'maven',
      version: resolvedMavenVersion,
      label: 'Maven',
      source: 'mode',
    });
  }
  const archiveEntries = await buildArchiveEntries(inputs, runtimeTools);
  const workspace = explicitWorkspace
    ? fallbackWorkspace
    : archiveEntries.workspace
      || (!archiveEntries.usesCacheFormat
        ? await maybeResolveWorkspaceViaCli(inputs.workingDirectory, explicitWorkspace, fallbackWorkspace)
        : null)
      || fallbackWorkspace;
  const cacheTagPrefix = getCacheTagPrefix(inputs, runtimeTools, archiveEntries.cacheTagPrefix);
  const runtimeTag = inputs.setup === 'mise' && inputs.cacheRuntime
    ? buildRuntimeCacheTag(cacheTagPrefix, inputs.runtimeCacheTag, runtimeTools, inputs.toolVersionScope)
    : null;
  const runtimeEntry = inputs.setup === 'mise' && inputs.cacheRuntime
    ? buildRuntimeCacheEntry(cacheTagPrefix, inputs.runtimeCacheTag, runtimeTools, inputs.toolVersionScope)
    : null;
  validateOneInputs(inputs, modeSpec, runtimeTools, runtimeEntry, archiveEntries.entries);

  return {
    workspace,
    workingDirectory: inputs.workingDirectory,
    setup: inputs.setup,
    mode: modeSpec.resolved,
    modeSpec,
    preset: inputs.preset,
    cacheTagPrefix,
    runtimeTools,
    runtimeTag,
    runtimeEntry,
    envVars: archiveEntries.envVars,
    archiveEntries: archiveEntries.entries,
    archiveRestoreCandidates: archiveEntries.restoreCandidates,
    usesCacheFormat: archiveEntries.usesCacheFormat,
  };
}

export function getCacheTagPrefix(
  inputs: OneInputs,
  runtimeTools: ToolSpec[],
  resolvedArchivePrefix?: string,
): string {
  if (inputs.cacheTag) {
    return inputs.cacheTag;
  }

  if (resolvedArchivePrefix?.trim()) {
    return resolvedArchivePrefix.trim();
  }

  if (inputs.key) {
    return inputs.key;
  }

  if (runtimeTools.length > 0) {
    return runtimeTools.map((tool) => tool.name).join('-');
  }

  return 'one';
}

export function buildFlagArgs(inputs: OneInputs): string[] {
  const flagArgs: string[] = [];
  if (inputs.enableCrossOsArchive || inputs.noPlatform) {
    flagArgs.push('--no-platform');
  }
  if (inputs.failOnCacheMiss) {
    flagArgs.push('--fail-on-cache-miss');
  }
  if (inputs.lookupOnly) {
    flagArgs.push('--lookup-only');
  }
  if (inputs.verbose) {
    flagArgs.push('--verbose');
  }
  if (inputs.exclude) {
    flagArgs.push('--exclude', inputs.exclude);
  }
  return flagArgs;
}

export async function applyMiseSetup(runtimeTools: ToolSpec[], _runtimeCacheHit: boolean, cwd?: string): Promise<boolean> {
  void _runtimeCacheHit;

  if (runtimeTools.length === 0) {
    return false;
  }

  const pathAvailable = new Map<string, boolean>();

  for (const tool of runtimeTools) {
    const available = await hasToolVersionOnPath(tool.name, tool.version);
    pathAvailable.set(`${tool.name}@${tool.version}`, available);
    if (available) {
      core.info(`Using existing ${tool.label} ${tool.version} from PATH`);
    }
  }

  const unresolvedTools = runtimeTools.filter(
    (tool) => !pathAvailable.get(`${tool.name}@${tool.version}`),
  );

  if (unresolvedTools.length === 0) {
    return false;
  }

  await installMise();

  for (const tool of unresolvedTools) {
    if (await hasMiseToolVersion(tool.name, tool.version)) {
      await activateMiseTool(tool.name, tool.version, { label: tool.label });
    } else {
      await installMiseTool(tool.name, tool.version, { label: tool.label });
    }
  }

  await reshimMise();
  await exportMiseEnv(cwd);
  return true;
}

function resolveCacheEnvPath(workingDirectory: string, configuredPath: string): string {
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(workingDirectory, configuredPath);
}

async function configureNodePresetEnv(workingDirectory: string): Promise<void> {
  const packageManager = await detectNodePackageManager(workingDirectory);
  if (!packageManager) {
    return;
  }

  const configuredCacheDir = packageManager.name === 'pnpm'
    ? process.env.PNPM_STORE_DIR || process.env.NPM_CONFIG_STORE_DIR || packageManager.cacheDir
    : packageManager.name === 'yarn'
      ? process.env.YARN_CACHE_FOLDER || packageManager.cacheDir
      : process.env.npm_config_cache || process.env.NPM_CONFIG_CACHE || packageManager.cacheDir;
  const cacheDir = resolveCacheEnvPath(workingDirectory, configuredCacheDir);
  await fs.promises.mkdir(cacheDir, { recursive: true });

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
}

async function configureRubyPresetEnv(workingDirectory: string): Promise<void> {
  const bundlePath = resolveCacheEnvPath(workingDirectory, process.env.BUNDLE_PATH?.trim() || 'vendor/bundle');
  await fs.promises.mkdir(bundlePath, { recursive: true });
  core.exportVariable('BUNDLE_PATH', bundlePath);
}

async function configurePythonUvPresetEnv(workingDirectory: string): Promise<void> {
  const uvCacheDir = resolveCacheEnvPath(workingDirectory, process.env.UV_CACHE_DIR?.trim() || '.uv-cache');
  await fs.promises.mkdir(uvCacheDir, { recursive: true });
  core.exportVariable('UV_CACHE_DIR', uvCacheDir);
}

async function configureGoPresetEnv(workingDirectory: string): Promise<void> {
  const goModCache = resolveCacheEnvPath(workingDirectory, defaultGoModCacheDir(workingDirectory));
  const goBuildCache = resolveCacheEnvPath(workingDirectory, defaultGoBuildCacheDir(workingDirectory));
  await fs.promises.mkdir(goModCache, { recursive: true });
  await fs.promises.mkdir(goBuildCache, { recursive: true });
  core.exportVariable('GOMODCACHE', goModCache);
  core.exportVariable('GOCACHE', goBuildCache);
}

async function configurePhpComposerPresetEnv(workingDirectory: string): Promise<void> {
  const composerCacheDir = resolveCacheEnvPath(workingDirectory, await defaultComposerCacheDir(workingDirectory));
  const composerVendorDir = resolveCacheEnvPath(workingDirectory, await defaultComposerVendorDir(workingDirectory));
  await fs.promises.mkdir(composerCacheDir, { recursive: true });
  await fs.promises.mkdir(composerVendorDir, { recursive: true });
  core.exportVariable('COMPOSER_CACHE_DIR', composerCacheDir);
  core.exportVariable('COMPOSER_VENDOR_DIR', composerVendorDir);
}

export async function applyPresetCacheEnv(plan: Pick<ResolvedPlan, 'preset' | 'workingDirectory' | 'envVars'>): Promise<void> {
  switch (plan.preset) {
    case 'rails':
      await configureRubyPresetEnv(plan.workingDirectory);
      await configureNodePresetEnv(plan.workingDirectory);
      break;
    case 'ruby':
      await configureRubyPresetEnv(plan.workingDirectory);
      break;
    case 'node':
    case 'node-turbo':
      await configureNodePresetEnv(plan.workingDirectory);
      break;
    case 'python-uv':
      await configurePythonUvPresetEnv(plan.workingDirectory);
      break;
    case 'go':
      await configureGoPresetEnv(plan.workingDirectory);
      break;
    case 'php-composer':
      await configurePhpComposerPresetEnv(plan.workingDirectory);
      break;
    default:
      break;
  }

  for (const [key, value] of Object.entries(plan.envVars)) {
    core.exportVariable(key, value);
  }
}

export function serializeTools(runtimeTools: ToolSpec[]): string {
  return runtimeTools.map((tool) => `${tool.name}@${tool.version}`).join('\n');
}

export function getRestoreKeyCandidates(inputs: OneInputs): string[] {
  return inputs.restoreKeys
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean);
}
