import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { getMiseInstallsDir } from '@boringcache/action-core';
import {
  applyMiseSetup,
  buildPlan,
  buildRuntimeCacheTag,
  buildRuntimeCacheEntry,
  parseToolSpecs,
  type OneInputs,
} from '../lib/utils';
import { actionCoreMocks } from './setup';

async function makeTempProject(files: Record<string, string>): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'boringcache-one-'));
  await Promise.all(
    Object.entries(files).map(async ([relativePath, content]) => {
      const filePath = path.join(directory, relativePath);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content);
    }),
  );
  return directory;
}

async function removeTempProject(directory: string): Promise<void> {
  await fs.rm(directory, { recursive: true, force: true });
}

function buildInputs(overrides: Partial<OneInputs>): OneInputs {
  return {
    cliVersion: 'skip',
    setup: 'mise',
    mode: 'archive',
    preset: 'none',
    workspace: 'my-org/my-project',
    cacheTag: '',
    runtimeCacheTag: '',
    workingDirectory: process.cwd(),
    tools: '',
    toolVersionScope: 'patch',
    cacheRuntime: false,
    readOnly: false,
    proxyPort: '',
    proxyNoGit: false,
    proxyNoPlatform: false,
    entries: 'deps:node_modules',
    path: '',
    key: '',
    restoreKeys: '',
    enableCrossOsArchive: false,
    noPlatform: false,
    failOnCacheMiss: false,
    lookupOnly: false,
    force: false,
    verbose: false,
    exclude: '',
    ...overrides,
  };
}

describe('one utils', () => {
  it('parses explicit tool specs and normalizes nodejs to node', () => {
    expect(parseToolSpecs('nodejs@22.4.1\nruby@3.3.6')).toEqual([
      { name: 'node', version: '22.4.1', label: 'Node.js', source: 'input' },
      { name: 'ruby', version: '3.3.6', label: 'Ruby', source: 'input' },
    ]);
  });

  it('builds a runtime plan for rails preset detection', async () => {
    const project = await makeTempProject({
      '.ruby-version': '3.3.6\n',
      '.node-version': 'v22.4.1\n',
      'package.json': '{"name":"demo"}\n',
    });

    try {
      const plan = await buildPlan(buildInputs({
        preset: 'rails',
        workingDirectory: project,
        cacheRuntime: true,
        entries: 'bundler:vendor/bundle',
      }));

      expect(plan.mode).toBe('archive');
      expect(plan.runtimeTools).toEqual([
        { name: 'ruby', version: '3.3.6', label: 'Ruby', source: 'project' },
        { name: 'node', version: '22.4.1', label: 'Node.js', source: 'project' },
      ]);
      expect(plan.runtimeTag).toBe('bundler-mise-node-22.4.1-ruby-3.3.6');
      expect(plan.runtimeEntry).toBe(`bundler-mise-node-22.4.1-ruby-3.3.6:${getMiseInstallsDir()}`);
      expect(plan.archiveEntries).toContain('bundler-node-22.4.1-ruby-3.3.6:vendor/bundle');
    } finally {
      await removeTempProject(project);
    }
  });

  it('auto-detects project tools for archive mode from mise config', async () => {
    actionCoreMocks.readProjectMiseTools.mockResolvedValue([
      { name: 'ruby', version: '4.0.1' },
      { name: 'pnpm', version: '9.15.1' },
    ]);

    const plan = await buildPlan(buildInputs({
      preset: 'none',
      mode: 'auto',
      cacheRuntime: true,
      entries: 'bundler:vendor/bundle',
    }));

    expect(plan.mode).toBe('archive');
    expect(plan.runtimeTools).toEqual([
      { name: 'ruby', version: '4.0.1', label: 'Ruby', source: 'project' },
      { name: 'pnpm', version: '9.15.1', label: 'pnpm', source: 'project' },
    ]);
    expect(plan.runtimeEntry).toBe(`bundler-mise-pnpm-9.15.1-ruby-4.0.1:${getMiseInstallsDir()}`);
  });

  it('prefers project-defined versions over preset detection', async () => {
    const project = await makeTempProject({
      '.ruby-version': '3.3.6\n',
      'package.json': '{"name":"demo"}\n',
    });

    actionCoreMocks.readProjectMiseTools.mockResolvedValue([
      { name: 'ruby', version: '4.0.1' },
      { name: 'node', version: '22.4.1' },
    ]);

    try {
      const plan = await buildPlan(buildInputs({
        preset: 'rails',
        workingDirectory: project,
        cacheRuntime: true,
        entries: 'bundler:vendor/bundle',
      }));

      expect(plan.runtimeTools).toEqual([
        { name: 'ruby', version: '4.0.1', label: 'Ruby', source: 'project' },
        { name: 'node', version: '22.4.1', label: 'Node.js', source: 'project' },
      ]);
    } finally {
      await removeTempProject(project);
    }
  });

  it('falls back to idiomatic version files when project config tools are absent', async () => {
    const project = await makeTempProject({
      '.python-version': '3.12.2\n',
      '.go-version': '1.24.0\n',
    });

    try {
      const plan = await buildPlan(buildInputs({
        workingDirectory: project,
        cacheRuntime: true,
        entries: 'pip:.venv',
      }));

      expect(plan.runtimeTools).toEqual([
        { name: 'python', version: '3.12.2', label: 'Python', source: 'project' },
        { name: 'go', version: '1.24.0', label: 'Go', source: 'project' },
      ]);
    } finally {
      await removeTempProject(project);
    }
  });

  it('detects mode-specific tools for gradle when setup=mise', async () => {
    const project = await makeTempProject({
      '.java-version': '21\n',
    });

    try {
      const plan = await buildPlan(buildInputs({
        mode: 'gradle',
        workingDirectory: project,
        entries: '',
      }));

      expect(plan.mode).toBe('gradle');
      expect(plan.runtimeTools).toEqual([
        { name: 'java', version: '21', label: 'Java', source: 'project' },
      ]);
    } finally {
      await removeTempProject(project);
    }
  });

  it('installs tools when the runtime cache misses', async () => {
    await applyMiseSetup([
      { name: 'node', version: '22.4.1', label: 'Node.js', source: 'preset' },
    ], false);

    expect(actionCoreMocks.installMise).toHaveBeenCalledTimes(1);
    expect(actionCoreMocks.installMiseTool).toHaveBeenCalledWith(
      'node',
      '22.4.1',
      { label: 'Node.js' },
    );
    expect(actionCoreMocks.activateMiseTool).not.toHaveBeenCalled();
    expect(actionCoreMocks.reshimMise).toHaveBeenCalledTimes(1);
  });

  it('activates tools when the runtime cache hits', async () => {
    await applyMiseSetup([
      { name: 'ruby', version: '3.3.6', label: 'Ruby', source: 'preset' },
    ], true);

    expect(actionCoreMocks.installMise).toHaveBeenCalledTimes(1);
    expect(actionCoreMocks.activateMiseTool).toHaveBeenCalledWith(
      'ruby',
      '3.3.6',
      { label: 'Ruby' },
    );
    expect(actionCoreMocks.installMiseTool).not.toHaveBeenCalled();
    expect(actionCoreMocks.reshimMise).toHaveBeenCalledTimes(1);
  });

  it('uses readable runtime tool versions in the cache tag', () => {
    const entry = buildRuntimeCacheEntry('rails', '', [
      { name: 'ruby', version: '3.3.6', label: 'Ruby', source: 'preset' },
      { name: 'node', version: '22.4.1', label: 'Node.js', source: 'preset' },
    ], 'patch');

    expect(entry).toBe(`rails-mise-node-22.4.1-ruby-3.3.6:${getMiseInstallsDir()}`);
  });

  it('scopes explicit archive entries to resolved mise tool versions', async () => {
    const plan = await buildPlan(buildInputs({
      tools: 'ruby@4.0.1',
      cacheRuntime: true,
      entries: 'bundler:vendor/bundle',
    }));

    expect(plan.runtimeEntry).toBe(`bundler-mise-ruby-4.0.1:${getMiseInstallsDir()}`);
    expect(plan.archiveEntries).toBe('bundler-ruby-4.0.1:vendor/bundle');
  });

  it('supports deterministic version scoping for runtime and archive tags', async () => {
    const plan = await buildPlan(buildInputs({
      tools: 'ruby@4.0.1,node@22.4.1',
      toolVersionScope: 'minor',
      cacheRuntime: true,
      entries: 'bundler:vendor/bundle',
    }));

    expect(plan.runtimeTag).toBe('bundler-mise-node-22.4-ruby-4.0');
    expect(plan.archiveEntries).toBe('bundler-node-22.4-ruby-4.0:vendor/bundle');
  });

  it('allows explicit runtime cache tags for local and CI reuse', async () => {
    const plan = await buildPlan(buildInputs({
      tools: 'ruby@4.0.1',
      cacheRuntime: true,
      cacheTag: 'web',
      runtimeCacheTag: 'web-mise-ruby',
      entries: 'bundler:vendor/bundle',
    }));

    expect(buildRuntimeCacheTag('web', 'web-mise-ruby', plan.runtimeTools, 'patch')).toBe('web-mise-ruby');
    expect(plan.runtimeEntry).toBe(`web-mise-ruby:${getMiseInstallsDir()}`);
    expect(plan.archiveEntries).toBe('bundler-ruby-4.0.1:vendor/bundle');
  });

  it('prefers BORINGCACHE_DEFAULT_WORKSPACE over the repository name', async () => {
    process.env.BORINGCACHE_DEFAULT_WORKSPACE = 'boringcache/web';
    process.env.GITHUB_REPOSITORY = 'owner/repo';

    const plan = await buildPlan(buildInputs({
      workspace: '',
      tools: 'ruby@4.0.1',
      entries: 'bundler:vendor/bundle',
    }));

    expect(plan.workspace).toBe('boringcache/web');
  });
});
