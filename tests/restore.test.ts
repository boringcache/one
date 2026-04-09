import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { run as restoreRun } from '../lib/restore';
import { resolveVerificationTags, type TagVerificationSpec } from '../lib/utils';
import { actionCoreMocks, mockGetBooleanInput, mockGetInput } from './setup';

describe('restore action', () => {
  it('restores archive entries and records state', async () => {
    const resolvedTags = resolveVerificationTags([
      {
        tag: 'deps',
        noPlatform: true,
        noGit: false,
        pathHint: 'node_modules',
        saveExpected: true,
      },
      {
        tag: 'build',
        noPlatform: true,
        noGit: false,
        pathHint: 'dist',
        saveExpected: true,
      },
    ] satisfies TagVerificationSpec[], process.cwd());

    mockGetInput({
      workspace: 'my-org/my-project',
      entries: 'deps:node_modules,build:dist',
    });
    mockGetBooleanInput({ 'no-platform': true });

    await restoreRun();

    expect(actionCoreMocks.ensureBoringCache).toHaveBeenCalledWith({ version: 'v1.12.21' });
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
    expect(core.setOutput).toHaveBeenCalledWith('resolved-tags', resolvedTags.join(','));
    expect(core.saveState).toHaveBeenCalledWith('working-directory', process.cwd());
    expect(core.saveState).toHaveBeenCalledWith('generic-cache-entries', 'deps:node_modules,build:dist');
    expect(core.saveState).toHaveBeenCalledWith('generic-cache-workspace', 'my-org/my-project');
    expect(core.saveState).toHaveBeenCalledWith('resolved-tags', resolvedTags.join(','));
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
    expect(restoreCalls[0][1][2]).toMatch(/deps-primary-npm:.*\.npm/);
    expect(restoreCalls[1][1][2]).toMatch(/deps-fallback-npm:.*\.npm/);
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
      ['restore', 'default/default', 'deps-node-modules:/tmp/project/node_modules,deps-npm-cache:/tmp/project/.npm-cache', '--no-platform'],
      expect.objectContaining({ ignoreReturnCode: true }),
    );
    expect(core.saveState).toHaveBeenCalledWith(
      'generic-cache-entries',
      'deps-node-modules:/tmp/project/node_modules,deps-npm-cache:/tmp/project/.npm-cache',
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
      version: 'v1.12.21',
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
      version: 'v1.12.21',
      platform: 'linux-amd64',
    });
    expect(exec.exec).not.toHaveBeenCalledWith(
      'boringcache',
      expect.arrayContaining(['restore']),
      expect.anything(),
    );
    expect(core.notice).toHaveBeenCalledWith('No cache entries resolved; boringcache/one will install the CLI only.');
  });

  it('emits grouped diagnostics when requested', async () => {
    mockGetInput({
      workspace: 'my-org/my-project',
      entries: 'deps:node_modules',
      diagnostics: 'summary',
    });
    mockGetBooleanInput({ 'no-platform': true });

    await restoreRun();

    expect(core.setOutput).toHaveBeenCalledWith('diagnostics-level', 'summary');
    expect(core.group).toHaveBeenCalledWith('BoringCache Diagnostics', expect.any(Function));
    expect(core.info).toHaveBeenCalledWith('workspace: my-org/my-project');
    expect((core.info as jest.Mock).mock.calls.some(
      ([line]) => typeof line === 'string' && line.startsWith('token-capabilities: restore='),
    )).toBe(true);
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

  it('applies no-platform to the mise runtime restore path', async () => {
    const runtimeEntry = `ruby-mise-ruby-3.3.6:${path.join(os.homedir(), '.local', 'share', 'mise', 'installs')}`;

    mockGetInput({
      workspace: 'my-org/my-project',
      tools: 'ruby@3.3.6',
    });
    mockGetBooleanInput({
      'cache-runtime': true,
      'no-platform': true,
    });

    await restoreRun();

    expect(actionCoreMocks.execBoringCache).toHaveBeenCalledWith(
      ['restore', 'my-org/my-project', runtimeEntry, '--no-platform'],
      expect.objectContaining({ ignoreReturnCode: true }),
    );
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

  it('skips save-expected verification in restore step when no save-capable token is present', async () => {
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

    const checkCalls = (exec.exec as jest.Mock).mock.calls.filter(
      ([command, args]) => command === 'boringcache' && Array.isArray(args) && args[0] === 'check',
    );
    expect(checkCalls).toHaveLength(0);
    expect(core.info).toHaveBeenCalledWith(
      'Skipping save-expected tag verification in restore step: no save-capable token is available.',
    );
  });

  it('keeps the post step restore-only when save-policy is off', async () => {
    mockGetInput({
      workspace: 'my-org/my-project',
      entries: 'deps:node_modules',
      'save-policy': 'off',
    });
    mockGetBooleanInput({ 'no-platform': true });

    await restoreRun();

    expect(core.saveState).toHaveBeenCalledWith('save-configured', 'false');
    expect(core.saveState).toHaveBeenCalledWith('save-allowed', 'false');
    expect(core.info).toHaveBeenCalledWith('Post step save is disabled by save-policy: off.');
  });

  it('treats pull_request save tokens as restore-only by default', async () => {
    process.env.GITHUB_EVENT_NAME = 'pull_request';
    process.env.BORINGCACHE_SAVE_TOKEN = 'test-save-token';
    delete process.env.BORINGCACHE_RESTORE_TOKEN;
    delete process.env.BORINGCACHE_API_TOKEN;

    mockGetInput({
      workspace: 'my-org/my-project',
      entries: 'deps:node_modules',
      verify: 'check',
    });
    mockGetBooleanInput({ 'no-platform': true });

    await restoreRun();

    expect(core.notice).toHaveBeenCalledWith(
      'pull_request detected: treating save-capable BoringCache tokens as restore-only. Set save-on-pull-request: true to allow writes.',
    );
    expect(core.saveState).toHaveBeenCalledWith('save-allowed', 'false');
    const checkCalls = (exec.exec as jest.Mock).mock.calls.filter(
      ([command, args]) => command === 'boringcache' && Array.isArray(args) && args[0] === 'check',
    );
    expect(checkCalls).toHaveLength(0);
    expect(core.info).toHaveBeenCalledWith(
      'Skipping save-expected tag verification in restore step: no save-capable token is available.',
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

  it('exports GOMODCACHE and GOCACHE for the go preset', async () => {
    const project = await fs.mkdtemp(path.join(os.tmpdir(), 'one-restore-go-'));
    await fs.writeFile(path.join(project, '.go-version'), '1.24.0\n');
    await fs.writeFile(path.join(project, 'go.mod'), 'module example.com/demo\n');

    try {
      mockGetInput({
        workspace: 'my-org/my-project',
        preset: 'go',
        'working-directory': project,
      });

      await restoreRun();

      expect(core.exportVariable).toHaveBeenCalledWith('GOMODCACHE', path.join(project, '.go/pkg/mod'));
      expect(core.exportVariable).toHaveBeenCalledWith('GOCACHE', path.join(project, '.go/build-cache'));
    } finally {
      await fs.rm(project, { recursive: true, force: true });
    }
  });

  it('exports Composer cache env for the php-composer preset', async () => {
    const project = await fs.mkdtemp(path.join(os.tmpdir(), 'one-restore-php-'));
    await fs.writeFile(path.join(project, '.php-version'), '8.4.4\n');
    await fs.writeFile(path.join(project, 'composer.json'), '{"name":"demo/app"}\n');
    await fs.writeFile(path.join(project, 'composer.lock'), '{}\n');

    try {
      mockGetInput({
        workspace: 'my-org/my-project',
        preset: 'php-composer',
        'working-directory': project,
      });

      await restoreRun();

      expect(core.exportVariable).toHaveBeenCalledWith('COMPOSER_CACHE_DIR', path.join(project, '.composer-cache'));
      expect(core.exportVariable).toHaveBeenCalledWith('COMPOSER_VENDOR_DIR', path.join(project, 'vendor'));
    } finally {
      await fs.rm(project, { recursive: true, force: true });
    }
  });
});
