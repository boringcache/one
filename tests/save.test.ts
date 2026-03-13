import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { run as saveRun } from '../lib/save';
import { resolveVerificationTags, type TagVerificationSpec } from '../lib/utils';
import { actionCoreMocks, mockGetBooleanInput, mockGetInput, mockGetState } from './setup';

describe('save action', () => {
  it('skips save cleanly when no save-capable token is configured', async () => {
    delete process.env.BORINGCACHE_SAVE_TOKEN;
    delete process.env.BORINGCACHE_API_TOKEN;

    mockGetInput({});
    mockGetBooleanInput({});
    mockGetState({
      'resolved-mode': 'archive',
      'generic-cache-entries': 'deps:node_modules',
      'generic-cache-workspace': 'my-org/my-project',
      'cli-version': 'skip',
    });

    await saveRun();

    expect(core.notice).toHaveBeenCalledWith(
      'Save skipped: A save-capable token is required. Set BORINGCACHE_SAVE_TOKEN or BORINGCACHE_API_TOKEN.',
    );
    expect(exec.exec).not.toHaveBeenCalled();
  });

  it('reuses saved state and forwards save flags', async () => {
    const chdirSpy = jest.spyOn(process, 'chdir').mockImplementation(() => undefined);
    mockGetInput({});
    mockGetBooleanInput({});
    mockGetState({
      'resolved-mode': 'archive',
      'working-directory': '/tmp/project',
      'generic-cache-entries': 'deps:node_modules',
      'generic-cache-workspace': 'my-org/my-project',
      'generic-cache-exclude': '*.log',
      'cli-version': 'v1.12.6',
      'no-platform': 'true',
      'enableCrossOsArchive': 'false',
      'force': 'true',
      'verbose': 'true',
    });

    await saveRun();

    expect(actionCoreMocks.ensureBoringCache).toHaveBeenCalledWith({ version: 'v1.12.6' });
    expect(chdirSpy).toHaveBeenNthCalledWith(1, '/tmp/project');
    expect(chdirSpy).toHaveBeenLastCalledWith(expect.any(String));
    expect(exec.exec).toHaveBeenCalledWith(
      'boringcache',
      ['save', 'my-org/my-project', 'deps:node_modules', '--force', '--no-platform', '--verbose', '--exclude', '*.log'],
      undefined,
    );
    chdirSpy.mockRestore();
  });

  it('verifies deferred save tags after saving', async () => {
    mockGetInput({});
    mockGetBooleanInput({});
    mockGetState({
      'resolved-mode': 'archive',
      'generic-cache-entries': 'deps:node_modules',
      'generic-cache-workspace': 'my-org/my-project',
      'cli-version': 'skip',
      'verify-mode': 'check',
      'verify-timeout-seconds': '60',
      'verify-require-server-signature': 'false',
      'verify-save-tags': 'deps',
    });

    await saveRun();

    expect(exec.exec).toHaveBeenNthCalledWith(
      1,
      'boringcache',
      ['save', 'my-org/my-project', 'deps:node_modules', '--fail-on-cache-error'],
      undefined,
    );
    expect(exec.exec).toHaveBeenNthCalledWith(
      2,
      'boringcache',
      ['check', 'my-org/my-project', 'deps', '--no-platform', '--no-git', '--fail-on-miss'],
      expect.objectContaining({ ignoreReturnCode: true }),
    );
  });

  it('does not verify exact generic tags for entries skipped as missing paths', async () => {
    const originalCwd = process.cwd();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'one-save-test-'));
    fs.mkdirSync(path.join(tempDir, 'node_modules'));
    const verifyTags = resolveVerificationTags([
      {
        tag: 'deps',
        noPlatform: false,
        noGit: false,
        pathHint: 'node_modules',
        saveExpected: true,
      },
      {
        tag: 'cache',
        noPlatform: false,
        noGit: false,
        pathHint: '.yarn-cache',
        saveExpected: true,
      },
    ] satisfies TagVerificationSpec[], tempDir);

    try {
      mockGetInput({});
      mockGetBooleanInput({});
      mockGetState({
        'resolved-mode': 'archive',
        'generic-cache-entries': 'deps:node_modules,cache:.yarn-cache',
        'generic-cache-workspace': 'my-org/my-project',
        'cli-version': 'skip',
        'verify-mode': 'check',
        'verify-timeout-seconds': '60',
        'verify-require-server-signature': 'false',
        'verify-save-tags': verifyTags.join(','),
      });

      process.chdir(tempDir);

      await saveRun();

      expect(verifyTags).toHaveLength(2);
      expect(exec.exec).toHaveBeenNthCalledWith(
        2,
        'boringcache',
        ['check', 'my-org/my-project', verifyTags[0], '--no-platform', '--no-git', '--fail-on-miss'],
        expect.objectContaining({ ignoreReturnCode: true }),
      );
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rebuilds the plan when state is absent', async () => {
    mockGetInput({
      workspace: 'my-org/my-project',
      entries: 'deps:node_modules',
      'cli-version': 'skip',
    });
    mockGetBooleanInput({ 'no-platform': true });
    mockGetState({});

    await saveRun();

    expect(actionCoreMocks.ensureBoringCache).not.toHaveBeenCalled();
    expect(exec.exec).toHaveBeenCalledWith(
      'boringcache',
      ['save', 'my-org/my-project', 'deps:node_modules', '--no-platform'],
      undefined,
    );
  });
});
