import * as core from '@actions/core';
import * as exec from '@actions/exec';
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

    expect(actionCoreMocks.ensureBoringCache).toHaveBeenCalledWith({ version: 'v1.12.5' });
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
    expect(core.saveState).toHaveBeenCalledWith('generic-cache-entries', 'deps:node_modules,build:dist');
    expect(core.saveState).toHaveBeenCalledWith('generic-cache-workspace', 'my-org/my-project');
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

  it('passes cli-platform through to shared CLI setup', async () => {
    mockGetInput({
      workspace: 'my-org/my-project',
      entries: 'deps:node_modules',
      'cli-platform': 'alpine-amd64',
    });

    await restoreRun();

    expect(actionCoreMocks.ensureBoringCache).toHaveBeenCalledWith({
      version: 'v1.12.5',
      platform: 'alpine-amd64',
    });
  });
});
