import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { run as saveRun } from '../lib/save';
import * as utils from '../lib/utils';
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

  it('skips save on pull_request when save-on-pull-request is not enabled', async () => {
    process.env.GITHUB_EVENT_NAME = 'pull_request';

    mockGetInput({});
    mockGetBooleanInput({});
    mockGetState({
      'resolved-mode': 'archive',
      'generic-cache-entries': 'deps:node_modules',
      'generic-cache-workspace': 'my-org/my-project',
      'cli-version': 'skip',
      'save-allowed': 'false',
    });

    await saveRun();

    expect(core.notice).toHaveBeenCalledWith(
      'Save skipped: pull_request jobs stay restore-only by default. Set save-on-pull-request: true to allow writes.',
    );
    expect(exec.exec).not.toHaveBeenCalled();
  });

  it('skips save cleanly when save-policy is off', async () => {
    mockGetInput({ 'save-policy': 'off' });
    mockGetBooleanInput({});
    mockGetState({
      'resolved-mode': 'archive',
      'generic-cache-entries': 'deps:node_modules',
      'generic-cache-workspace': 'my-org/my-project',
      'cli-version': 'skip',
      'save-configured': 'false',
      'save-allowed': 'false',
    });

    await saveRun();

    expect(core.info).toHaveBeenCalledWith(
      'Save skipped: save-policy is off; this step is restore-only by configuration.',
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
      'cli-version': 'v1.12.31',
      'no-platform': 'true',
      'enableCrossOsArchive': 'false',
      'force': 'true',
      'verbose': 'true',
    });

    await saveRun();

    expect(actionCoreMocks.ensureBoringCache).toHaveBeenCalledWith({ version: 'v1.12.31' });
    expect(chdirSpy).toHaveBeenNthCalledWith(1, '/tmp/project');
    expect(chdirSpy).toHaveBeenLastCalledWith(expect.any(String));
    expect(exec.exec).toHaveBeenCalledWith(
      'boringcache',
      ['save', 'my-org/my-project', 'deps:node_modules', '--force', '--no-platform', '--verbose', '--exclude', '*.log', '--fail-on-cache-error'],
      undefined,
    );
    chdirSpy.mockRestore();
  });

  it('shuts down bazel before saving hybrid bazel state', async () => {
    mockGetInput({});
    mockGetBooleanInput({});
    mockGetState({
      'resolved-mode': 'bazel',
      'generic-cache-entries': 'bazel-local-state:/tmp/bazel-cache',
      'generic-cache-workspace': 'my-org/my-project',
      'cli-version': 'skip',
    });

    await saveRun();

    expect(exec.exec).toHaveBeenNthCalledWith(
      1,
      'bazel',
      ['shutdown'],
      expect.objectContaining({ ignoreReturnCode: true, silent: true }),
    );
    expect(exec.exec).toHaveBeenNthCalledWith(
      2,
      'boringcache',
      ['save', 'my-org/my-project', 'bazel-local-state:/tmp/bazel-cache', '--fail-on-cache-error'],
      undefined,
    );
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
      ['check', 'my-org/my-project', 'deps', '--no-platform', '--no-git', '--exact', '--fail-on-miss', '--json'],
      expect.objectContaining({ ignoreReturnCode: true }),
    );
  });

  it('rehydrates PR restore scope before post-save verification', async () => {
    process.env.GITHUB_EVENT_NAME = 'pull_request';
    process.env.BORINGCACHE_SAVE_TOKEN = 'test-save-token';
    delete process.env.BORINGCACHE_RESTORE_PR_CACHE;

    mockGetInput({});
    mockGetBooleanInput({ 'save-on-pull-request': true });
    mockGetState({
      'resolved-mode': 'archive',
      'generic-cache-entries': 'deps:node_modules',
      'generic-cache-workspace': 'my-org/my-project',
      'cli-version': 'skip',
      'verify-mode': 'check',
      'verify-timeout-seconds': '60',
      'verify-require-server-signature': 'false',
      'save-allowed': 'true',
      'verify-save-specs': JSON.stringify([{
        tag: 'deps',
        noPlatform: false,
        noGit: false,
        saveExpected: true,
      }]),
    });

    await saveRun();

    expect(process.env.BORINGCACHE_SAVE_ON_PULL_REQUEST).toBe('1');
    expect(process.env.BORINGCACHE_RESTORE_PR_CACHE).toBe('1');
    expect(core.exportVariable).toHaveBeenCalledWith('BORINGCACHE_SAVE_ON_PULL_REQUEST', '1');
    expect(core.exportVariable).toHaveBeenCalledWith('BORINGCACHE_RESTORE_PR_CACHE', '1');

    const checkCall = (exec.exec as jest.Mock).mock.calls.find(
      ([command, args]) => command === 'boringcache' && Array.isArray(args) && args[0] === 'check',
    );
    expect(checkCall?.[2]).toEqual(expect.objectContaining({
      env: expect.objectContaining({
        BORINGCACHE_RESTORE_PR_CACHE: '1',
        BORINGCACHE_SAVE_ON_PULL_REQUEST: '1',
      }),
    }));
  });

  it('does not wait for deferred save tags when verify mode is check', async () => {
    let checkAttempts = 0;
    (exec.exec as jest.Mock).mockImplementation(async (command: string, args?: string[]) => {
      if (command === 'boringcache' && args?.[0] === 'check') {
        checkAttempts += 1;
        return 1;
      }
      return 0;
    });

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

    expect(checkAttempts).toBe(1);
    expect(core.info).not.toHaveBeenCalledWith(
      expect.stringContaining('Waiting for tags to become visible'),
    );
    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Verification failed for tags deps'),
    );
  });

  it('uses warn mode for deferred post-save verification without failing the save step', async () => {
    const verifySpy = jest.spyOn(utils, 'verifyVerificationSpecs').mockResolvedValue(undefined);
    mockGetInput({});
    mockGetBooleanInput({});
    mockGetState({
      'resolved-mode': 'archive',
      'generic-cache-entries': 'deps:node_modules',
      'generic-cache-workspace': 'my-org/my-project',
      'cli-version': 'skip',
      'verify-mode': 'warn',
      'verify-timeout-seconds': '30',
      'verify-require-server-signature': 'false',
      'verify-save-tags': 'deps',
    });

    try {
      await saveRun();

      expect(verifySpy).toHaveBeenCalledWith(
        'my-org/my-project',
        expect.arrayContaining([
          expect.objectContaining({ tag: 'deps', noPlatform: true, noGit: true }),
        ]),
        expect.objectContaining({
          mode: 'warn',
          timeoutSeconds: 30,
          requireServerSignature: false,
          verbose: false,
          acceptPendingSaveExpected: true,
        }),
      );
    } finally {
      verifySpy.mockRestore();
    }
  });

  it('skips local sccache save verification when the action-managed cache was unused', async () => {
    const sccacheTag = 'rust-1.94.1-bench-sccache-rust1.94';
    const states: Record<string, string> = {
      'resolved-mode': 'rust-sccache',
      'cli-version': 'skip',
      'generic-cache-workspace': 'my-org/my-project',
      'verify-mode': 'check',
      'verify-timeout-seconds': '60',
      'verify-require-server-signature': 'false',
      'verify-save-tags': sccacheTag,
      'verify-save-specs': JSON.stringify([{
        tag: sccacheTag,
        noPlatform: false,
        noGit: false,
        pathHint: '/tmp/sccache',
        saveExpected: true,
      }]),
      'mode-workspace': 'my-org/my-project',
      'mode-use-sccache': 'true',
      'mode-sccache-mode': 'local',
      'mode-sccache-tag': sccacheTag,
      'mode-sccache-path': '/tmp/sccache',
      'mode-sccache-preflight-hit': 'false',
    };
    (exec.exec as jest.Mock).mockImplementation(async (
      command: string,
      args?: string[],
      options?: { listeners?: { stdout?: (data: Buffer) => void } },
    ) => {
      if (command === 'sccache' && args?.[0] === '--show-stats') {
        options?.listeners?.stdout?.(Buffer.from(
          'Compile requests                      0\n' +
          'Compile requests executed             0\n' +
          'Cache hits                            0\n' +
          'Cache misses                          0\n',
        ));
      }
      return 0;
    });

    mockGetInput({});
    mockGetBooleanInput({});
    (core.getState as jest.Mock).mockImplementation((name: string) => states[name] || '');
    (core.saveState as jest.Mock).mockImplementation((name: string, value: string) => {
      states[name] = value;
    });

    await saveRun();

    expect(exec.exec).toHaveBeenCalledWith('sccache', ['--show-stats'], expect.objectContaining({ ignoreReturnCode: true }));
    expect(exec.exec).toHaveBeenCalledWith('sccache', ['--stop-server'], expect.objectContaining({ ignoreReturnCode: true }));
    expect(exec.exec).not.toHaveBeenCalledWith(
      'boringcache',
      expect.arrayContaining(['save', 'my-org/my-project', `${sccacheTag}:${path.join(os.homedir(), '.cache', 'sccache')}`]),
      undefined,
    );
    const checkCalls = (exec.exec as jest.Mock).mock.calls.filter(
      ([command, args]) => command === 'boringcache' && Array.isArray(args) && args[0] === 'check',
    );
    expect(checkCalls).toHaveLength(0);
    expect(core.info).toHaveBeenCalledWith(`Skipping sccache save for ${sccacheTag}: no compile requests were observed.`);
  });

  it('skips proxy sccache verification when the action-managed proxy was unused', async () => {
    const sccacheTag = 'rust-1.94.1-bench-sccache-rust1.94';
    const states: Record<string, string> = {
      'resolved-mode': 'rust-sccache',
      'cli-version': 'skip',
      'generic-cache-workspace': 'my-org/my-project',
      'verify-mode': 'check',
      'verify-timeout-seconds': '60',
      'verify-require-server-signature': 'false',
      'verify-save-tags': sccacheTag,
      'verify-save-specs': JSON.stringify([{
        tag: sccacheTag,
        noPlatform: true,
        noGit: true,
        pathHint: '/tmp/project',
        saveExpected: true,
      }]),
      'mode-workspace': 'my-org/my-project',
      'mode-use-sccache': 'true',
      'mode-sccache-mode': 'proxy',
      'mode-sccache-tag': sccacheTag,
      'mode-sccache-preflight-hit': 'false',
      'mode-proxy-pid': '4321',
    };
    (exec.exec as jest.Mock).mockImplementation(async (
      command: string,
      args?: string[],
      options?: { listeners?: { stdout?: (data: Buffer) => void } },
    ) => {
      if (command === 'sccache' && args?.[0] === '--show-stats') {
        options?.listeners?.stdout?.(Buffer.from(
          'Compile requests                      0\n' +
          'Compile requests executed             0\n' +
          'Cache hits                            0\n' +
          'Cache misses                          0\n',
        ));
      }
      return 0;
    });

    mockGetInput({});
    mockGetBooleanInput({});
    (core.getState as jest.Mock).mockImplementation((name: string) => states[name] || '');
    (core.saveState as jest.Mock).mockImplementation((name: string, value: string) => {
      states[name] = value;
    });

    await saveRun();

    expect(actionCoreMocks.stopRegistryProxy).toHaveBeenCalledWith(4321, undefined);
    const checkCalls = (exec.exec as jest.Mock).mock.calls.filter(
      ([command, args]) => command === 'boringcache' && Array.isArray(args) && args[0] === 'check',
    );
    expect(checkCalls).toHaveLength(0);
    expect(core.info).toHaveBeenCalledWith(`Skipping sccache save for ${sccacheTag}: no compile requests were observed.`);
  });

  it('uses the requested timeout for explicit post-save wait verification', async () => {
    const verifySpy = jest.spyOn(utils, 'verifyVerificationSpecs').mockResolvedValue(undefined);
    mockGetInput({});
    mockGetBooleanInput({});
    mockGetState({
      'resolved-mode': 'archive',
      'generic-cache-entries': 'deps:node_modules',
      'generic-cache-workspace': 'my-org/my-project',
      'cli-version': 'skip',
      'verify-mode': 'wait',
      'verify-timeout-seconds': '30',
      'verify-require-server-signature': 'false',
      'verify-save-tags': 'deps',
    });

    try {
      await saveRun();

      expect(verifySpy).toHaveBeenCalledWith(
        'my-org/my-project',
        expect.arrayContaining([
          expect.objectContaining({ tag: 'deps', noPlatform: true, noGit: true }),
        ]),
        expect.objectContaining({
          mode: 'wait',
          timeoutSeconds: 30,
          requireServerSignature: false,
          verbose: false,
          acceptPendingSaveExpected: true,
        }),
      );
    } finally {
      verifySpy.mockRestore();
    }
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
        ['check', 'my-org/my-project', verifyTags[0], '--no-platform', '--no-git', '--exact', '--fail-on-miss', '--json'],
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
      ['save', 'my-org/my-project', 'deps:node_modules', '--no-platform', '--fail-on-cache-error'],
      undefined,
    );
  });

  it('removes the docker buildx builder during the post step', async () => {
    mockGetInput({});
    mockGetBooleanInput({});
    mockGetState({
      'resolved-mode': 'docker',
      'cli-version': 'skip',
      'generic-cache-workspace': 'my-org/my-project',
      'mode-builder-name': 'boringcache-12345-docker-cache-abc123',
      'mode-proxy-pid': '4321',
    });

    await saveRun();

    expect(actionCoreMocks.stopRegistryProxy).toHaveBeenCalledWith(4321, undefined);
    expect(exec.exec).toHaveBeenCalledWith(
      'docker',
      ['buildx', 'rm', '--force', 'boringcache-12345-docker-cache-abc123'],
      expect.objectContaining({ ignoreReturnCode: true }),
    );
  });

  it('verifies docker OCI promotion refs through a fresh proxy after stopping the writer', async () => {
    actionCoreMocks.startRegistryProxy.mockResolvedValueOnce({
      pid: 9876,
      port: 5000,
      readOnly: true,
      ociImportReadiness: {
        requestedRefs: ['default', 'branch-main'],
        readableRefs: ['default', 'branch-main'],
        unreadableRefs: [],
        ready: true,
      },
    });
    mockGetInput({});
    mockGetBooleanInput({});
    mockGetState({
      'resolved-mode': 'docker',
      'cli-version': 'skip',
      'generic-cache-workspace': 'my-org/my-project',
      'mode-builder-name': 'boringcache-12345-docker-cache-abc123',
      'mode-proxy-pid': '4321',
      'mode-proxy-port': '5000',
      'mode-proxy-host': '127.0.0.1',
      'mode-proxy-no-git': 'true',
      'mode-proxy-no-platform': 'true',
      'mode-workspace': 'my-org/my-project',
      'mode-cache-tag': 'docker-cache',
      'mode-oci-promotion-ref-tags': 'default,branch-main',
    });

    await saveRun();

    expect(actionCoreMocks.stopRegistryProxy).toHaveBeenNthCalledWith(1, 4321, 5000);
    expect(actionCoreMocks.startRegistryProxy).toHaveBeenCalledWith(expect.objectContaining({
      workspace: 'my-org/my-project',
      tag: 'docker-cache',
      host: '127.0.0.1',
      port: 5000,
      noGit: true,
      noPlatform: true,
      readOnly: true,
      ociRequiredReadableRefs: ['default', 'branch-main'],
      requireOciImportReady: true,
      ociImportReadyTimeoutMs: 180_000,
    }));
    expect(actionCoreMocks.stopRegistryProxy).toHaveBeenNthCalledWith(2, 9876);
  });

  it('fails docker save when OCI promotion refs never become readable', async () => {
    actionCoreMocks.startRegistryProxy.mockRejectedValueOnce(new Error(
      'Some OCI cache import refs were unreadable. readable=[branch-main] unreadable=[default]',
    ));
    mockGetInput({});
    mockGetBooleanInput({});
    mockGetState({
      'resolved-mode': 'docker',
      'cli-version': 'skip',
      'generic-cache-workspace': 'my-org/my-project',
      'mode-builder-name': 'boringcache-12345-docker-cache-abc123',
      'mode-proxy-pid': '4321',
      'mode-proxy-port': '5000',
      'mode-proxy-host': '127.0.0.1',
      'mode-workspace': 'my-org/my-project',
      'mode-cache-tag': 'docker-cache',
      'mode-oci-promotion-ref-tags': 'default,branch-main',
    });

    await saveRun();

    expect(core.setFailed).toHaveBeenCalledWith(
      'boringcache/one save failed: OCI promotion refs were not readable after proxy shutdown. requested=[default, branch-main]: Some OCI cache import refs were unreadable. readable=[branch-main] unreadable=[default]',
    );
    expect(actionCoreMocks.stopRegistryProxy).toHaveBeenCalledWith(4321, 5000);
  });

  it('warns when proxy sccache sees zero hits for an existing tag', async () => {
    const chdirSpy = jest.spyOn(process, 'chdir').mockImplementation(() => undefined);
    (exec.exec as jest.Mock).mockImplementation(async (
      command: string,
      args?: string[],
      options?: { listeners?: { stdout?: (data: Buffer) => void } },
    ) => {
      if (command === 'sccache' && args?.[0] === '--show-stats') {
        options?.listeners?.stdout?.(Buffer.from(
          'Compile requests                   1352\n' +
          'Cache hits                            0\n' +
          'Cache misses                       1125\n' +
          'Cache hits rate (Rust)             0.00 %\n',
        ));
        return 0;
      }
      return 0;
    });

    mockGetInput({});
    mockGetBooleanInput({});
    mockGetState({
      'resolved-mode': 'rust-sccache',
      'cli-version': 'skip',
      'working-directory': '/tmp/project',
      'generic-cache-workspace': 'my-org/my-project',
      'mode-workspace': 'my-org/my-project',
      'mode-cache-cargo': 'false',
      'mode-cache-cargo-bin': 'false',
      'mode-cache-target': 'false',
      'mode-use-sccache': 'true',
      'mode-sccache-mode': 'proxy',
      'mode-sccache-tag': 'rust-1.94.1-ci-test-sccache-rust1.94',
      'mode-sccache-preflight-hit': 'true',
      'mode-proxy-pid': '4321',
    });

    await saveRun();

    expect(core.warning).toHaveBeenCalledWith(
      "sccache proxy saw 0 cache hits across 1352 compile requests for existing tag 'rust-1.94.1-ci-test-sccache-rust1.94'. Check emitted tag semantics and BORINGCACHE_SAVE_TOKEN/BORINGCACHE_RESTORE_TOKEN alignment.",
    );
    chdirSpy.mockRestore();
  });

  it('reports proxy sccache zero hits as a cold fill when the tag was absent before the build', async () => {
    const chdirSpy = jest.spyOn(process, 'chdir').mockImplementation(() => undefined);
    (exec.exec as jest.Mock).mockImplementation(async (
      command: string,
      args?: string[],
      options?: { listeners?: { stdout?: (data: Buffer) => void } },
    ) => {
      if (command === 'sccache' && args?.[0] === '--show-stats') {
        options?.listeners?.stdout?.(Buffer.from(
          'Compile requests                     13\n' +
          'Cache hits                            0\n' +
          'Cache misses                          5\n' +
          'Cache hits rate (Rust)             0.00 %\n',
        ));
        return 0;
      }
      if (command === 'boringcache' && args?.includes('check') && args.includes('--json')) {
        const checkIndex = args.indexOf('check');
        const tag = args[checkIndex + 2] || '';
        options?.listeners?.stdout?.(Buffer.from(JSON.stringify({
          schema_version: 1,
          workspace: args[checkIndex + 1] || 'my-org/my-project',
          total: 1,
          hits: 1,
          misses: 0,
          results: [{ tag, requested_tag: tag, status: 'hit' }],
        })));
        return 0;
      }
      return 0;
    });

    mockGetInput({});
    mockGetBooleanInput({});
    mockGetState({
      'resolved-mode': 'rust-sccache',
      'cli-version': 'skip',
      'working-directory': '/tmp/project',
      'generic-cache-workspace': 'my-org/my-project',
      'mode-workspace': 'my-org/my-project',
      'mode-cache-cargo': 'false',
      'mode-cache-cargo-bin': 'false',
      'mode-cache-target': 'false',
      'mode-use-sccache': 'true',
      'mode-sccache-mode': 'proxy',
      'mode-sccache-tag': 'rust-1.94.1-ci-test-sccache-rust1.94',
      'mode-sccache-preflight-hit': 'false',
      'mode-proxy-pid': '4321',
    });

    await saveRun();

    expect(exec.exec).toHaveBeenCalledWith(
      'boringcache',
      expect.arrayContaining([
        '--require-server-signature',
        'check',
        'my-org/my-project',
        'rust-1.94.1-ci-test-sccache-rust1.94',
        '--json',
      ]),
      expect.objectContaining({ ignoreReturnCode: true, silent: true }),
    );
    expect(core.notice).toHaveBeenCalledWith(
      "sccache proxy saw 0 cache hits across 13 compile requests, but 'rust-1.94.1-ci-test-sccache-rust1.94' published successfully. This looks like a cold fill.",
    );
    expect(core.warning).not.toHaveBeenCalled();
    chdirSpy.mockRestore();
  });

  it('tails proxy logs in grouped diagnostics when enabled', async () => {
    const chdirSpy = jest.spyOn(process, 'chdir').mockImplementation(() => undefined);
    const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'one-save-log-'));
    const logPath = path.join(logDir, 'proxy.log');
    fs.writeFileSync(logPath, 'first line\nsecond line\nthird line\n');

    try {
      mockGetInput({});
      mockGetBooleanInput({});
      mockGetState({
        'resolved-mode': 'archive',
        'working-directory': '/tmp/project',
        'generic-cache-workspace': 'my-org/my-project',
        'generic-cache-entries': '',
        'verify-mode': 'none',
        'verify-timeout-seconds': '60',
        'verify-require-server-signature': 'false',
        'verify-save-tags': '',
        'diagnostics-level': 'verbose',
        'diagnostics-log-lines': '2',
        'proxy-log-path': logPath,
      });

      await saveRun();

      expect(core.group).toHaveBeenCalledWith('BoringCache Post-Step Diagnostics', expect.any(Function));
      expect(core.info).toHaveBeenCalledWith(`proxy-log-path: ${logPath}`);
      expect(core.info).toHaveBeenCalledWith('proxy-log-tail (2 lines):');
      expect(core.info).toHaveBeenCalledWith('second line');
      expect(core.info).toHaveBeenCalledWith('third line');
    } finally {
      chdirSpy.mockRestore();
      fs.rmSync(logDir, { recursive: true, force: true });
    }
  });
});
