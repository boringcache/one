import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { run as restoreRun } from '../lib/restore';
import { actionCoreMocks, mockGetBooleanInput, mockGetInput } from './setup';

describe('restore action', () => {
  it('restores archive entries and records state', async () => {
    mockGetInput({
      workspace: 'my-org/my-project',
      entries: 'deps:node_modules,build:dist',
    });
    mockGetBooleanInput({ 'no-platform': true });

    await restoreRun();

    expect(actionCoreMocks.ensureBoringCache).toHaveBeenCalledWith({ version: 'v1.12.6' });
    expect(exec.exec).toHaveBeenCalledWith(
      'boringcache',
      ['restore', 'my-org/my-project', 'deps:node_modules,build:dist', '--no-platform'],
      expect.any(Object),
    );
    expect(core.setOutput).toHaveBeenCalledWith('cache-hit', 'true');
    expect(core.setOutput).toHaveBeenCalledWith('resolved-mode', 'archive');
    expect(core.setOutput).toHaveBeenCalledWith('cache-tag', 'deps');
    expect(core.setOutput).toHaveBeenCalledWith('runtime-cache-tag', '');
    expect(core.setOutput).toHaveBeenCalledWith('resolved-entries', 'deps:node_modules,build:dist');
    expect(core.setOutput).toHaveBeenCalledWith('resolved-tags', 'deps,build');
    expect(core.saveState).toHaveBeenCalledWith('working-directory', process.cwd());
    expect(core.saveState).toHaveBeenCalledWith('generic-cache-entries', 'deps:node_modules,build:dist');
    expect(core.saveState).toHaveBeenCalledWith('generic-cache-workspace', 'my-org/my-project');
    expect(core.saveState).toHaveBeenCalledWith('resolved-tags', 'deps,build');
  });

  it('falls back through restore keys in actions/cache compatibility mode', async () => {
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    (exec.exec as jest.Mock)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);

    mockGetInput({
      path: '~/.npm',
      key: 'deps-primary',
      'restore-keys': 'deps-fallback\n',
    });
    mockGetBooleanInput({ 'no-platform': true });

    await restoreRun();

    const restoreCalls = (exec.exec as jest.Mock).mock.calls.filter(
      ([command, args]) => command === 'boringcache' && Array.isArray(args) && args[0] === 'restore',
    );

    expect(restoreCalls).toHaveLength(2);
    expect(restoreCalls[0][1][1]).toBe('owner/repo');
    expect(restoreCalls[0][1][2]).toMatch(/deps-primary:.*\.npm/);
    expect(restoreCalls[1][1][2]).toMatch(/deps-fallback:.*\.npm/);
    expect(core.setOutput).toHaveBeenCalledWith('cache-hit', 'true');
  });

  it('resolves actions/cache compatibility paths relative to working-directory', async () => {
    const chdirSpy = jest.spyOn(process, 'chdir').mockImplementation(() => undefined);
    mockGetInput({
      path: 'node_modules\n.npm-cache',
      key: 'deps',
      'working-directory': '/tmp/project',
    });
    mockGetBooleanInput({ 'no-platform': true });

    await restoreRun();

    expect(actionCoreMocks.execBoringCache).toHaveBeenCalledWith(
      ['restore', 'default/default', 'deps:/tmp/project/node_modules,deps:/tmp/project/.npm-cache', '--no-platform'],
      expect.objectContaining({ ignoreReturnCode: true }),
    );
    expect(core.saveState).toHaveBeenCalledWith(
      'generic-cache-entries',
      'deps:/tmp/project/node_modules,deps:/tmp/project/.npm-cache',
    );
    chdirSpy.mockRestore();
  });

  it('passes cli-platform through to shared CLI setup', async () => {
    mockGetInput({
      workspace: 'my-org/my-project',
      entries: 'deps:node_modules',
      'cli-platform': 'alpine-amd64',
    });

    await restoreRun();

    expect(actionCoreMocks.ensureBoringCache).toHaveBeenCalledWith({
      version: 'v1.12.6',
      platform: 'alpine-amd64',
    });
  });

  it('allows CLI-only setup when no cache entries resolve', async () => {
    mockGetInput({
      workspace: 'my-org/my-project',
      'cli-platform': 'linux-amd64',
    });

    await restoreRun();

    expect(actionCoreMocks.ensureBoringCache).toHaveBeenCalledWith({
      version: 'v1.12.6',
      platform: 'linux-amd64',
    });
    expect(exec.exec).not.toHaveBeenCalledWith(
      'boringcache',
      expect.arrayContaining(['restore']),
      expect.anything(),
    );
    expect(core.notice).toHaveBeenCalledWith('No cache entries resolved; boringcache/one will install the CLI only.');
  });

  it('does not persist a mise runtime cache entry when matching tools come from PATH', async () => {
    actionCoreMocks.hasToolVersionOnPath.mockResolvedValueOnce(true);

    mockGetInput({
      workspace: 'my-org/my-project',
      tools: 'ruby@3.3.6',
    });
    mockGetBooleanInput({ 'cache-runtime': true });

    await restoreRun();

    expect(actionCoreMocks.installMise).not.toHaveBeenCalled();
    expect(core.saveState).toHaveBeenCalledWith('generic-cache-entries', '');
  });

  it('exports mise environment after installing runtime tools', async () => {
    mockGetInput({
      workspace: 'my-org/my-project',
      tools: 'java@21',
    });
    mockGetBooleanInput({ 'cache-runtime': true });

    await restoreRun();

    expect(actionCoreMocks.installMise).toHaveBeenCalled();
    expect(actionCoreMocks.exportMiseEnv).toHaveBeenCalledWith(process.cwd());
  });

  it('verifies exact tags immediately when no save-capable token is present', async () => {
    delete process.env.BORINGCACHE_SAVE_TOKEN;
    delete process.env.BORINGCACHE_API_TOKEN;
    process.env.BORINGCACHE_RESTORE_TOKEN = 'test-restore-token';

    mockGetInput({
      workspace: 'my-org/my-project',
      entries: 'deps:node_modules',
      verify: 'check',
    });
    mockGetBooleanInput({ 'no-platform': true });

    await restoreRun();

    expect(exec.exec).toHaveBeenCalledWith(
      'boringcache',
      ['check', 'my-org/my-project', 'deps', '--no-platform', '--no-git', '--fail-on-miss'],
      expect.objectContaining({ ignoreReturnCode: true }),
    );
  });

  it('exports bundler and package-manager cache env for the rails preset', async () => {
    const project = await fs.mkdtemp(path.join(os.tmpdir(), 'one-restore-rails-'));
    await fs.writeFile(path.join(project, '.ruby-version'), '3.3.6\n');
    await fs.writeFile(path.join(project, '.node-version'), '22.4.1\n');
    await fs.writeFile(path.join(project, 'package.json'), '{"name":"demo","packageManager":"pnpm@9.15.1"}\n');
    await fs.writeFile(path.join(project, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');

    try {
      mockGetInput({
        workspace: 'my-org/my-project',
        preset: 'rails',
        'working-directory': project,
      });

      await restoreRun();

      expect(core.exportVariable).toHaveBeenCalledWith('BUNDLE_PATH', path.join(project, 'vendor/bundle'));
      expect(core.exportVariable).toHaveBeenCalledWith('PNPM_STORE_DIR', path.join(project, '.pnpm-store'));
      expect(core.exportVariable).toHaveBeenCalledWith('NPM_CONFIG_STORE_DIR', path.join(project, '.pnpm-store'));
    } finally {
      await fs.rm(project, { recursive: true, force: true });
    }
  });

  it('exports UV_CACHE_DIR for the python-uv preset', async () => {
    const project = await fs.mkdtemp(path.join(os.tmpdir(), 'one-restore-python-'));
    await fs.writeFile(path.join(project, '.python-version'), '3.12.7\n');
    await fs.writeFile(path.join(project, 'pyproject.toml'), '[project]\nname = "demo"\n');
    await fs.writeFile(path.join(project, 'uv.lock'), 'version = 1\n');

    try {
      mockGetInput({
        workspace: 'my-org/my-project',
        preset: 'python-uv',
        'working-directory': project,
      });

      await restoreRun();

      expect(core.exportVariable).toHaveBeenCalledWith('UV_CACHE_DIR', path.join(project, '.uv-cache'));
    } finally {
      await fs.rm(project, { recursive: true, force: true });
    }
  });
});
