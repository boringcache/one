import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  activateMiseTool,
  buildMiseRuntimeTag,
  buildMiseToolTag,
  convertCacheFormatToEntries,
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
  readProjectMiseTools,
  readMiseTomlVersion,
  readToolVersionsValue,
  reshimMise,
  type MiseVersionScope,
} from '@boringcache/action-core';
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
  convertCacheFormatToEntries,
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
export type Preset = 'none' | 'rails' | 'node-turbo';
export type VerifyMode = 'none' | 'check' | 'wait';

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
  mavenLocalRepo: string;
  readOnly: boolean;
  verify: VerifyMode;
  verifyTimeoutSeconds: number;
  verifyRequireServerSignature: boolean;
  proxyPort: string;
  proxyNoGit: boolean;
  proxyNoPlatform: boolean;
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
  archiveEntries: string;
  usesCacheFormat: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  bazel: 'Bazel',
  bun: 'Bun',
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
  python: 'Python',
  ruby: 'Ruby',
  rust: 'Rust',
  turbo: 'Turbo',
  yarn: 'Yarn',
};

export function getInputs(): OneInputs {
  return {
    cliVersion: core.getInput('cli-version') || 'v1.12.5',
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
    mavenLocalRepo: core.getInput('maven-local-repo') || '~/.m2/repository',
    readOnly: core.getBooleanInput('read-only'),
    verify: normalizeVerifyMode(core.getInput('verify')),
    verifyTimeoutSeconds: normalizeVerifyTimeoutSeconds(core.getInput('verify-timeout-seconds')),
    verifyRequireServerSignature: core.getBooleanInput('verify-require-server-signature'),
    proxyPort: core.getInput('proxy-port'),
    proxyNoGit: core.getBooleanInput('proxy-no-git'),
    proxyNoPlatform: core.getBooleanInput('proxy-no-platform'),
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

export function normalizeVerifyMode(value: string): VerifyMode {
  switch ((value || 'none').trim().toLowerCase()) {
    case 'none':
    case 'check':
    case 'wait':
      return (value || 'none').trim().toLowerCase() as VerifyMode;
    default:
      throw new Error(`Unsupported verify mode "${value}". Expected none, check, or wait.`);
  }
}

export function normalizeVerifyTimeoutSeconds(value: string): number {
  if (!value || !value.trim()) {
    return 60;
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
    case 'node-turbo':
      return (value || 'none').trim().toLowerCase() as Preset;
    default:
      throw new Error(`Unsupported preset "${value}". Expected none, rails, or node-turbo.`);
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
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
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
  const candidate = pathHint ? expandUserPath(pathHint) : workingDirectory;
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

async function runExactTagCheck(
  workspace: string,
  exactTags: string[],
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
    exactTags.join(','),
    '--no-platform',
    '--no-git',
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
  if (options.mode === 'none' || exactTags.length === 0) {
    return;
  }

  if (options.mode === 'check') {
    const result = await runExactTagCheck(workspace, exactTags, options);
    if (result.exitCode !== 0) {
      throw new Error(`Verification failed for tags ${exactTags.join(', ')}: ${formatCheckFailure(result)}`);
    }
    core.info(`Verified ${exactTags.length} tag${exactTags.length === 1 ? '' : 's'} in ${workspace}`);
    return;
  }

  const deadline = Date.now() + options.timeoutSeconds * 1000;
  let attempt = 0;
  let lastFailure = '';

  while (Date.now() < deadline) {
    attempt += 1;
    const result = await runExactTagCheck(workspace, exactTags, options);
    if (result.exitCode === 0) {
      core.info(`Verified ${exactTags.length} tag${exactTags.length === 1 ? '' : 's'} in ${workspace} after ${attempt} attempt${attempt === 1 ? '' : 's'}`);
      return;
    }

    lastFailure = formatCheckFailure(result);
    core.info(`Waiting for tags to become visible (${attempt}): ${exactTags.join(', ')}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(
    `Timed out waiting ${options.timeoutSeconds}s for tags ${exactTags.join(', ')} in ${workspace}: ${lastFailure}`,
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
): Promise<ToolSpec[]> {
  if (setup !== 'mise') {
    return [];
  }

  const explicitTools = parseToolSpecs(toolsInput);
  const projectTools = await detectProjectTools(workingDirectory);
  const presetTools = await detectPresetTools(preset, workingDirectory);
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

async function detectPresetTools(preset: Preset, workingDirectory: string): Promise<ToolSpec[]> {
  switch (preset) {
    case 'rails':
      return detectRailsTools(workingDirectory);
    case 'node-turbo':
      return detectNodeTurboTools(workingDirectory);
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

async function detectRailsTools(workingDirectory: string): Promise<ToolSpec[]> {
  const tools: ToolSpec[] = [];

  const rubyVersion = await detectRubyVersion(workingDirectory);
  if (rubyVersion) {
    tools.push({ name: 'ruby', version: rubyVersion, label: 'Ruby', source: 'preset' });
  }

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

async function detectNodeTurboTools(workingDirectory: string): Promise<ToolSpec[]> {
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

function scopeTagToRuntimeTools(tag: string, tools: ToolSpec[], versionScope: MiseVersionScope): string {
  const runtimeTag = buildMiseToolTag(tools, versionScope);
  if (!runtimeTag || tag === runtimeTag || tag.endsWith(`-${runtimeTag}`)) {
    return tag;
  }
  return `${tag}-${runtimeTag}`;
}

function prefixArchiveTag(tag: string, cacheTag: string): string {
  const prefix = cacheTag.trim();
  if (!prefix) {
    return tag;
  }
  if (tag === prefix || tag.startsWith(`${prefix}-`)) {
    return tag;
  }
  return `${prefix}-${tag}`;
}

function normalizeEntriesInput(entries: string): string {
  return entries
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join(',');
}

function scopeArchiveEntries(
  entries: string,
  cacheTag: string,
  tools: ToolSpec[],
  versionScope: MiseVersionScope,
): string {
  const normalizedEntries = normalizeEntriesInput(entries);
  if (!entries.trim() || tools.length === 0) {
    return parseEntries(normalizedEntries, 'restore', { resolvePaths: false })
      .map((entry) => {
        const prefixedTag = prefixArchiveTag(entry.tag, cacheTag);
        const pathSpec = entry.restorePath === entry.savePath
          ? entry.restorePath
          : `${entry.restorePath}=>${entry.savePath}`;
        return `${prefixedTag}:${pathSpec}`;
      })
      .join(',');
  }

  return parseEntries(normalizedEntries, 'restore', { resolvePaths: false })
    .map((entry) => {
      const prefixedTag = prefixArchiveTag(entry.tag, cacheTag);
      const scopedTag = scopeTagToRuntimeTools(prefixedTag, tools, versionScope);
      const pathSpec = entry.restorePath === entry.savePath
        ? entry.restorePath
        : `${entry.restorePath}=>${entry.savePath}`;
      return `${scopedTag}:${pathSpec}`;
    })
    .join(',');
}

async function detectDefaultArchiveEntries(inputs: OneInputs): Promise<string> {
  if (inputs.mode === 'maven') {
    return `maven-repo:${inputs.mavenLocalRepo}`;
  }

  if (inputs.mode === 'turbo-proxy' || inputs.preset === 'node-turbo') {
    const packageManager = await detectNodePackageManager(inputs.workingDirectory);
    if (!packageManager) {
      return '';
    }

    switch (packageManager.name) {
      case 'pnpm':
        return 'pnpm-store:.pnpm-store\nnode-modules:node_modules';
      case 'yarn':
        return 'yarn-cache:.yarn-cache\nnode-modules:node_modules';
      case 'npm':
        return 'npm-cache:.npm-cache\nnode-modules:node_modules';
    }
  }

  return '';
}

export async function buildArchiveEntries(
  inputs: OneInputs,
  runtimeTools: ToolSpec[],
): Promise<{ entries: string; usesCacheFormat: boolean }> {
  let archiveEntries = '';
  let usesCacheFormat = false;
  let sourceEntries = inputs.entries;

  if (sourceEntries) {
    archiveEntries = inputs.setup === 'mise'
      ? scopeArchiveEntries(sourceEntries, inputs.cacheTag, runtimeTools, inputs.toolVersionScope)
      : scopeArchiveEntries(sourceEntries, inputs.cacheTag, [], inputs.toolVersionScope);
  } else if (inputs.path || inputs.key) {
    if (!inputs.path || !inputs.key) {
      throw new Error('actions/cache compatibility mode requires both path and key');
    }
    archiveEntries = convertCacheFormatToEntries({
      path: inputs.path,
      key: inputs.key,
      noPlatform: inputs.noPlatform,
      enableCrossOsArchive: inputs.enableCrossOsArchive,
    }, 'restore');
    usesCacheFormat = true;
  } else {
    sourceEntries = await detectDefaultArchiveEntries(inputs);
    if (sourceEntries) {
      archiveEntries = inputs.setup === 'mise'
        ? scopeArchiveEntries(sourceEntries, inputs.cacheTag, runtimeTools, inputs.toolVersionScope)
        : scopeArchiveEntries(sourceEntries, inputs.cacheTag, [], inputs.toolVersionScope);
    }
  }

  return {
    entries: archiveEntries,
    usesCacheFormat,
  };
}

export function validateOneInputs(
  inputs: OneInputs,
  modeSpec: ModeSpec,
  runtimeTools: ToolSpec[],
  runtimeEntry: string | null,
  archiveEntries: string,
): void {
  if (inputs.entries && (inputs.path || inputs.key)) {
    core.warning('Both explicit entries and actions/cache compatibility inputs were provided. Using entries.');
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
  const workspace = resolveWorkspace(inputs.workspace);
  const modeSpec = resolveModeSpec(inputs.mode);
  assertImplementedMode(modeSpec);
  const resolvedMavenVersion = inputs.mavenVersion || '3.9.9';

  const runtimeTools = await resolveRuntimeTools(
    inputs.setup,
    inputs.preset,
    inputs.mode,
    inputs.tools,
    inputs.workingDirectory,
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
  const cacheTagPrefix = getCacheTagPrefix(inputs, runtimeTools);
  const runtimeTag = inputs.setup === 'mise' && inputs.cacheRuntime
    ? buildRuntimeCacheTag(cacheTagPrefix, inputs.runtimeCacheTag, runtimeTools, inputs.toolVersionScope)
    : null;
  const runtimeEntry = inputs.setup === 'mise' && inputs.cacheRuntime
    ? buildRuntimeCacheEntry(cacheTagPrefix, inputs.runtimeCacheTag, runtimeTools, inputs.toolVersionScope)
    : null;

  const archiveEntries = await buildArchiveEntries(inputs, runtimeTools);
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
    archiveEntries: archiveEntries.entries,
    usesCacheFormat: archiveEntries.usesCacheFormat,
  };
}

export function getCacheTagPrefix(inputs: OneInputs, runtimeTools: ToolSpec[]): string {
  if (inputs.cacheTag) {
    return inputs.cacheTag;
  }

  if (inputs.entries) {
    const firstEntry = parseEntries(normalizeEntriesInput(inputs.entries), 'restore', { resolvePaths: false })[0];
    if (firstEntry) {
      return firstEntry.tag;
    }
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

export function serializeTools(runtimeTools: ToolSpec[]): string {
  return runtimeTools.map((tool) => `${tool.name}@${tool.version}`).join('\n');
}

export function getRestoreKeyCandidates(inputs: OneInputs): string[] {
  return inputs.restoreKeys
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getPlatformSuffix(noPlatform: boolean, enableCrossOsArchive: boolean): string {
  if (noPlatform || enableCrossOsArchive) {
    return '';
  }
  const platform = os.platform() === 'darwin' ? 'darwin' : os.platform() === 'win32' ? 'windows' : 'linux';
  const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64';
  return `-${platform}-${arch}`;
}
