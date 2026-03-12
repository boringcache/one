import * as core from '@actions/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  activateMiseTool,
  convertCacheFormatToEntries,
  ensureBoringCache,
  execBoringCache,
  getInputsWorkspace,
  getMiseDataDir,
  installMise,
  installMiseTool,
  parseEntries,
  readMiseTomlVersion,
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
  execBoringCache,
  getMiseDataDir,
  installMise,
  installMiseTool,
  parseEntries,
};

export type SetupMode = 'mise' | 'external' | 'none';
export type Preset = 'none' | 'rails' | 'node-turbo';

export interface ToolSpec {
  name: string;
  version: string;
  label: string;
  source: 'input' | 'preset' | 'mode';
}

export interface OneInputs {
  cliVersion: string;
  setup: SetupMode;
  mode: OneMode;
  preset: Preset;
  workspace: string;
  cacheTag: string;
  workingDirectory: string;
  tools: string;
  cacheRuntime: boolean;
  readOnly: boolean;
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

export interface ResolvedPlan {
  workspace: string;
  workingDirectory: string;
  setup: SetupMode;
  mode: ResolvedMode;
  modeSpec: ModeSpec;
  preset: Preset;
  runtimeTools: ToolSpec[];
  runtimeEntry: string | null;
  archiveEntries: string;
  usesCacheFormat: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  bazel: 'Bazel',
  elixir: 'Elixir',
  erlang: 'Erlang',
  go: 'Go',
  java: 'Java',
  node: 'Node.js',
  nodejs: 'Node.js',
  python: 'Python',
  ruby: 'Ruby',
  rust: 'Rust',
};

export function getInputs(): OneInputs {
  return {
    cliVersion: core.getInput('cli-version') || 'v1.12.4',
    setup: normalizeSetup(core.getInput('setup')),
    mode: normalizeMode(core.getInput('mode')),
    preset: normalizePreset(core.getInput('preset')),
    workspace: core.getInput('workspace'),
    cacheTag: core.getInput('cache-tag'),
    workingDirectory: path.resolve(core.getInput('working-directory') || '.'),
    tools: core.getInput('tools'),
    cacheRuntime: core.getBooleanInput('cache-runtime'),
    readOnly: core.getBooleanInput('read-only'),
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

export function resolveWorkspace(workspace: string): string {
  const resolved = workspace
    ? workspace.includes('/') ? workspace : `default/${workspace}`
    : (process.env.BORINGCACHE_DEFAULT_WORKSPACE || getInputsWorkspace({}));
  if (!resolved.includes('/')) {
    return `default/${resolved}`;
  }
  return resolved;
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
  const presetTools = await detectPresetTools(preset, workingDirectory);
  const modeTools = await detectModeTools(mode, workingDirectory);
  return mergeTools(explicitTools, presetTools, modeTools);
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

  return tools;
}

async function detectNodeTurboTools(workingDirectory: string): Promise<ToolSpec[]> {
  const nodeVersion = await detectNodeVersion(workingDirectory);
  if (!nodeVersion) {
    return [];
  }

  return [{ name: 'node', version: nodeVersion, label: 'Node.js', source: 'preset' }];
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

async function detectJavaVersion(workingDirectory: string): Promise<string | null> {
  const javaVersion = await readFirstLine(path.join(workingDirectory, '.java-version'));
  if (javaVersion) {
    return javaVersion;
  }

  const toolVersion = await readToolVersionsValue(workingDirectory, 'java');
  if (toolVersion) {
    return toolVersion;
  }

  return readMiseTomlVersion(workingDirectory, 'java');
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

async function readToolVersionsValue(workingDirectory: string, toolName: string): Promise<string | null> {
  try {
    const content = await fs.promises.readFile(path.join(workingDirectory, '.tool-versions'), 'utf-8');
    const line = content
      .split('\n')
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${toolName} `));
    if (!line) {
      return null;
    }
    return line.split(/\s+/)[1]?.trim() || null;
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
  return normalized === 'nodejs' ? 'node' : normalized;
}

export function buildRuntimeCacheEntry(cacheTagPrefix: string, tools: ToolSpec[]): string | null {
  if (tools.length === 0) {
    return null;
  }

  return `${cacheTagPrefix}-mise-runtime-${buildRuntimeToolTag(tools)}:${getMiseDataDir()}`;
}

function slugTagPart(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '');

  return normalized || 'unknown';
}

function buildRuntimeToolTag(tools: ToolSpec[]): string {
  return tools
    .map((tool) => `${slugTagPart(tool.name)}-${slugTagPart(tool.version)}`)
    .sort()
    .join('-');
}

function scopeTagToRuntimeTools(tag: string, tools: ToolSpec[]): string {
  const runtimeTag = buildRuntimeToolTag(tools);
  if (!runtimeTag || tag === runtimeTag || tag.endsWith(`-${runtimeTag}`)) {
    return tag;
  }
  return `${tag}-${runtimeTag}`;
}

function scopeArchiveEntries(entries: string, tools: ToolSpec[]): string {
  if (!entries.trim() || tools.length === 0) {
    return entries;
  }

  return parseEntries(entries, 'restore', { resolvePaths: false })
    .map((entry) => {
      const scopedTag = scopeTagToRuntimeTools(entry.tag, tools);
      const pathSpec = entry.restorePath === entry.savePath
        ? entry.restorePath
        : `${entry.restorePath}=>${entry.savePath}`;
      return `${scopedTag}:${pathSpec}`;
    })
    .join(',');
}

export function buildArchiveEntries(
  inputs: OneInputs,
  runtimeTools: ToolSpec[],
): { entries: string; usesCacheFormat: boolean } {
  let archiveEntries = '';
  let usesCacheFormat = false;

  if (inputs.entries) {
    archiveEntries = inputs.setup === 'mise'
      ? scopeArchiveEntries(inputs.entries, runtimeTools)
      : inputs.entries;
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
    throw new Error('No cache entries resolved. Provide entries, path+key, or enable cache-runtime with setup=mise.');
  }
}

export async function buildPlan(inputs: OneInputs): Promise<ResolvedPlan> {
  const workspace = resolveWorkspace(inputs.workspace);
  const modeSpec = resolveModeSpec(inputs.mode);
  assertImplementedMode(modeSpec);

  const runtimeTools = await resolveRuntimeTools(
    inputs.setup,
    inputs.preset,
    inputs.mode,
    inputs.tools,
    inputs.workingDirectory,
  );
  const runtimeEntry = inputs.setup === 'mise' && inputs.cacheRuntime
    ? buildRuntimeCacheEntry(getCacheTagPrefix(inputs, runtimeTools), runtimeTools)
    : null;

  const archiveEntries = buildArchiveEntries(inputs, runtimeTools);
  validateOneInputs(inputs, modeSpec, runtimeTools, runtimeEntry, archiveEntries.entries);

  return {
    workspace,
    workingDirectory: inputs.workingDirectory,
    setup: inputs.setup,
    mode: modeSpec.resolved,
    modeSpec,
    preset: inputs.preset,
    runtimeTools,
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
    const firstEntry = parseEntries(inputs.entries, 'restore', { resolvePaths: false })[0];
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

export async function applyMiseSetup(runtimeTools: ToolSpec[], runtimeCacheHit: boolean): Promise<void> {
  if (runtimeTools.length === 0) {
    return;
  }

  await installMise();
  for (const tool of runtimeTools) {
    if (runtimeCacheHit) {
      await activateMiseTool(tool.name, tool.version, { label: tool.label });
    } else {
      await installMiseTool(tool.name, tool.version, { label: tool.label });
    }
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

export function getPlatformSuffix(noPlatform: boolean, enableCrossOsArchive: boolean): string {
  if (noPlatform || enableCrossOsArchive) {
    return '';
  }
  const platform = os.platform() === 'darwin' ? 'darwin' : os.platform() === 'win32' ? 'windows' : 'linux';
  const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64';
  return `-${platform}-${arch}`;
}
