import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { getMiseDataDir } from '@boringcache/action-core';
import {
  applyMiseSetup,
  buildPlan,
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
    workingDirectory: process.cwd(),
    tools: '',
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
        { name: 'ruby', version: '3.3.6', label: 'Ruby', source: 'preset' },
        { name: 'node', version: '22.4.1', label: 'Node.js', source: 'preset' },
      ]);
      expect(plan.runtimeEntry).toBe(`bundler-mise-runtime-node-22.4.1-ruby-3.3.6:${getMiseDataDir()}`);
      expect(plan.archiveEntries).toContain('bundler-node-22.4.1-ruby-3.3.6:vendor/bundle');
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
        { name: 'java', version: '21', label: 'Java', source: 'mode' },
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
  });

  it('uses readable runtime tool versions in the cache tag', () => {
    const entry = buildRuntimeCacheEntry('rails', [
      { name: 'ruby', version: '3.3.6', label: 'Ruby', source: 'preset' },
      { name: 'node', version: '22.4.1', label: 'Node.js', source: 'preset' },
    ]);

    expect(entry).toBe(`rails-mise-runtime-node-22.4.1-ruby-3.3.6:${getMiseDataDir()}`);
  });

  it('scopes explicit archive entries to resolved mise tool versions', async () => {
    const plan = await buildPlan(buildInputs({
      tools: 'ruby@4.0.1',
      cacheRuntime: true,
      entries: 'bundler:vendor/bundle',
    }));

    expect(plan.runtimeEntry).toBe(`bundler-mise-runtime-ruby-4.0.1:${getMiseDataDir()}`);
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
