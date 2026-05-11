import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { getMiseInstallsDir } from '../lib/core';
import {
  applyMiseSetup,
  buildPlan,
  buildRuntimeCacheTag,
  buildRuntimeCacheEntry,
  getInputs,
  verifyVerificationSpecs,
  parseToolSpecs,
  resolveDiagnosticsConfig,
  resolveVerificationTags,
  type OneInputs,
} from '../lib/utils';
import { actionCoreMocks, mockGetBooleanInput, mockGetInput } from './setup';

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
    cliPlatform: '',
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
    mavenVersion: '',
    uvVersion: '0.9.21',
    composerVersion: '2.9.5',
    mavenLocalRepo: '~/.m2/repository',
    readOnly: false,
    savePolicy: 'auto',
    saveOnPullRequest: false,
    verify: 'none',
    verifyTimeoutSeconds: 60,
    verifyRequireServerSignature: false,
    trustedWorkspaceSigningKeyFingerprint: '',
    diagnostics: 'auto',
    diagnosticsLogLines: 40,
    metadataHints: '',
    proxyPort: '',
    proxyNoGit: false,
    proxyNoPlatform: false,
    ociHydration: 'metadata-only',
    cacheProfiles: '',
    entries: 'deps:node_modules',
    path: '',
    key: '',
    restoreKeys: '',
    enableCrossOsArchive: false,
    noPlatform: false,
    failOnCacheMiss: false,
    requireOciImportReady: false,
    lookupOnly: false,
    force: false,
    verbose: false,
    exclude: '',
    allowExternalSymlinks: false,
    ...overrides,
  };
}

describe('one utils', () => {
  it('keeps cli-version defaults aligned between action.yml and runtime fallback', async () => {
    const actionYamlPath = path.join(__dirname, '..', 'action.yml');
    const actionYaml = await fs.readFile(actionYamlPath, 'utf8');
    const match = actionYaml.match(
      /cli-version:[\s\S]*?default:\s*['"]([^'"]+)['"]/,
    );
    expect(match).not.toBeNull();

    mockGetInput({});
    mockGetBooleanInput({});

    const inputs = getInputs();
    expect(inputs.cliVersion).toBe(match![1]);
  });

  it('keeps oci-hydration defaults aligned between action.yml and runtime fallback', async () => {
    const actionYamlPath = path.join(__dirname, '..', 'action.yml');
    const actionYaml = await fs.readFile(actionYamlPath, 'utf8');
    const match = actionYaml.match(
      /oci-hydration:[\s\S]*?default:\s*['"]([^'"]+)['"]/,
    );
    expect(match).not.toBeNull();

    mockGetInput({});
    mockGetBooleanInput({});

    const inputs = getInputs();
    expect(inputs.ociHydration).toBe(match![1]);
  });

  it('keeps verify defaults aligned between action.yml and runtime fallback', async () => {
    const actionYamlPath = path.join(__dirname, '..', 'action.yml');
    const actionYaml = await fs.readFile(actionYamlPath, 'utf8');
    const match = actionYaml.match(
      /\n  verify:[\s\S]*?default:\s*['"]([^'"]+)['"]/,
    );
    expect(match).not.toBeNull();

    mockGetInput({});
    mockGetBooleanInput({});

    const inputs = getInputs();
    expect(inputs.verify).toBe(match![1]);
    expect(inputs.verify).toBe('none');
  });

  it('accepts verify=warn from action inputs', () => {
    mockGetInput({ verify: 'warn' });
    mockGetBooleanInput({});

    const inputs = getInputs();
    expect(inputs.verify).toBe('warn');
  });

  it('normalizes oci-hydration from action inputs', () => {
    mockGetInput({ 'oci-hydration': 'bodies-background' });
    mockGetBooleanInput({});

    const inputs = getInputs();
    expect(inputs.ociHydration).toBe('bodies-background');
  });

  it('reads metadata-hints from action inputs', () => {
    mockGetInput({ 'metadata-hints': 'phase=seed\nbenchmark=grpc-bazel' });
    mockGetBooleanInput({});

    const inputs = getInputs();
    expect(inputs.metadataHints).toBe('phase=seed\nbenchmark=grpc-bazel');
  });

  it('keeps diagnostics off by default when step debug is disabled', () => {
    expect(resolveDiagnosticsConfig('auto', 40)).toEqual({
      level: 'off',
      enabled: false,
      includeLogs: false,
      logLines: 40,
    });
  });

  it('promotes diagnostics auto mode to verbose when step debug is enabled', () => {
    (core.isDebug as jest.Mock).mockReturnValueOnce(true);

    expect(resolveDiagnosticsConfig('auto', 80)).toEqual({
      level: 'verbose',
      enabled: true,
      includeLogs: true,
      logLines: 80,
    });
  });

  it('downgrades verification timeout failures to warnings in warn mode', async () => {
    jest.useFakeTimers();
    (exec.exec as jest.Mock).mockResolvedValue(1);

    try {
      const verifyPromise = verifyVerificationSpecs(
        'my-org/my-project',
        [{ tag: 'deps', noPlatform: true, noGit: true }],
        {
          mode: 'warn',
          timeoutSeconds: 1,
          requireServerSignature: false,
          verbose: false,
        },
      );
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(2000);
      await verifyPromise;

      expect(core.info).toHaveBeenCalledWith('Waiting for tags to become visible (1): deps');
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Timed out waiting 1s for 1 tag in my-org/my-project:'),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('disables inherited strict signature checks for unsigned verification', async () => {
    process.env.BORINGCACHE_REQUIRE_SERVER_SIGNATURE = '1';
    (exec.exec as jest.Mock).mockResolvedValue(0);

    await verifyVerificationSpecs(
      'my-org/my-project',
      [{ tag: 'deps', noPlatform: true, noGit: true }],
      {
        mode: 'check',
        timeoutSeconds: 60,
        requireServerSignature: false,
        verbose: false,
      },
    );

    expect(exec.exec).toHaveBeenCalledWith(
      'boringcache',
      ['check', 'my-org/my-project', 'deps', '--no-platform', '--no-git', '--exact', '--fail-on-miss'],
      expect.objectContaining({
        env: expect.objectContaining({
          BORINGCACHE_REQUIRE_SERVER_SIGNATURE: '0',
        }),
      }),
    );
  });

  it('keeps explicit signed verification strict', async () => {
    process.env.BORINGCACHE_REQUIRE_SERVER_SIGNATURE = '1';
    (exec.exec as jest.Mock).mockResolvedValue(0);

    await verifyVerificationSpecs(
      'my-org/my-project',
      [{ tag: 'deps', noPlatform: true, noGit: true }],
      {
        mode: 'check',
        timeoutSeconds: 60,
        requireServerSignature: true,
        verbose: false,
      },
    );

    expect(exec.exec).toHaveBeenCalledWith(
      'boringcache',
      [
        '--require-server-signature',
        'check',
        'my-org/my-project',
        'deps',
        '--no-platform',
        '--no-git',
        '--exact',
        '--fail-on-miss',
      ],
      expect.not.objectContaining({
        env: expect.objectContaining({
          BORINGCACHE_REQUIRE_SERVER_SIGNATURE: '0',
        }),
      }),
    );
  });

  it('accepts pending check results only for save-expected verification tags', async () => {
    (exec.exec as jest.Mock).mockImplementation(async (
      _command: string,
      _args?: string[],
      options?: { listeners?: { stdout?: (data: Buffer) => void } },
    ) => {
      options?.listeners?.stdout?.(Buffer.from(JSON.stringify({
        schema_version: 1,
        workspace: 'my-org/my-project',
        total: 1,
        hits: 0,
        pending: 1,
        misses: 0,
        results: [{
          tag: 'deps',
          requested_tag: 'deps',
          status: 'pending',
        }],
      })));
      return 1;
    });

    await verifyVerificationSpecs(
      'my-org/my-project',
      [{ tag: 'deps', noPlatform: true, noGit: true, saveExpected: true }],
      {
        mode: 'check',
        timeoutSeconds: 60,
        requireServerSignature: false,
        verbose: false,
        acceptPendingSaveExpected: true,
      },
    );

    expect(exec.exec).toHaveBeenCalledWith(
      'boringcache',
      ['check', 'my-org/my-project', 'deps', '--no-platform', '--no-git', '--exact', '--fail-on-miss', '--json'],
      expect.objectContaining({
        ignoreReturnCode: true,
        silent: true,
      }),
    );
    expect(core.info).toHaveBeenCalledWith('Accepted pending save verification for tags: deps');
    expect(core.info).toHaveBeenCalledWith('Verified 1 tag in my-org/my-project');
  });

  it('does not accept true misses for save-expected verification tags', async () => {
    (exec.exec as jest.Mock).mockImplementation(async (
      _command: string,
      _args?: string[],
      options?: { listeners?: { stdout?: (data: Buffer) => void } },
    ) => {
      options?.listeners?.stdout?.(Buffer.from(JSON.stringify({
        schema_version: 1,
        workspace: 'my-org/my-project',
        total: 1,
        hits: 0,
        pending: 0,
        misses: 1,
        results: [{
          tag: 'deps',
          requested_tag: 'deps',
          status: 'miss',
        }],
      })));
      return 1;
    });

    await expect(verifyVerificationSpecs(
      'my-org/my-project',
      [{ tag: 'deps', noPlatform: true, noGit: true, saveExpected: true }],
      {
        mode: 'check',
        timeoutSeconds: 60,
        requireServerSignature: false,
        verbose: false,
        acceptPendingSaveExpected: true,
      },
    )).rejects.toThrow('Verification failed for tags deps');
  });

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

  it('adds default bundler archive entries for the ruby preset', async () => {
    const project = await makeTempProject({
      '.ruby-version': '3.4.1\n',
      'Gemfile.lock': 'GEM\n',
    });

    try {
      const plan = await buildPlan(buildInputs({
        preset: 'ruby',
        workingDirectory: project,
        entries: '',
        cacheTag: 'app',
      }));

      expect(plan.runtimeTools).toEqual([
        { name: 'ruby', version: '3.4.1', label: 'Ruby', source: 'project' },
      ]);
      expect(plan.archiveEntries).toBe('app-bundler-ruby-3.4.1:vendor/bundle');
    } finally {
      await removeTempProject(project);
    }
  });

  it('adds bundler and node cache defaults for the rails preset', async () => {
    const project = await makeTempProject({
      '.ruby-version': '3.3.6\n',
      '.node-version': '22.4.1\n',
      'package.json': '{"name":"demo","packageManager":"pnpm@9.15.1"}\n',
      'pnpm-lock.yaml': 'lockfileVersion: 9.0\n',
    });

    try {
      const plan = await buildPlan(buildInputs({
        preset: 'rails',
        workingDirectory: project,
        entries: '',
        cacheTag: 'web',
      }));

      expect(plan.archiveEntries).toBe(
        'web-bundler-node-22.4.1-pnpm-9.15.1-ruby-3.3.6:vendor/bundle,'
        + 'web-pnpm-store-node-22.4.1-pnpm-9.15.1-ruby-3.3.6:.pnpm-store,'
        + 'web-node-modules-node-22.4.1-pnpm-9.15.1-ruby-3.3.6:node_modules',
      );
    } finally {
      await removeTempProject(project);
    }
  });

  it('keeps bazel mode pure remote by default', async () => {
    const project = await makeTempProject({
      '.bazelversion': '8.0.1\n',
    });

    try {
      const plan = await buildPlan(buildInputs({
        mode: 'bazel',
        workingDirectory: project,
        entries: '',
        cacheTag: 'grpc-bazel',
      }));

      expect(plan.archiveEntries).toBe('');
    } finally {
      await removeTempProject(project);
    }
  });

  it('allows explicit local bazel state archive entries in bazel mode', async () => {
    const project = await makeTempProject({
      '.bazelversion': '8.0.1\n',
    });

    try {
      const plan = await buildPlan(buildInputs({
        mode: 'bazel',
        workingDirectory: project,
        entries: 'bazel-local-state:/tmp/boringcache-bazel-root',
        cacheTag: 'grpc-bazel',
      }));

      expect(plan.archiveEntries).toBe(
        'grpc-bazel-bazel-local-state-bazel-8.0.1:/tmp/boringcache-bazel-root',
      );
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

  it('keeps turbo proxy mode pure remote by default', async () => {
    const project = await makeTempProject({
      '.node-version': '22.4.1\n',
      'package.json': '{"name":"demo","packageManager":"pnpm@9.15.1"}\n',
      'pnpm-lock.yaml': 'lockfileVersion: 9.0\n',
    });

    try {
      const plan = await buildPlan(buildInputs({
        mode: 'turbo-proxy',
        workingDirectory: project,
        cacheTag: 'web',
        entries: '',
      }));

      expect(plan.runtimeTools).toEqual([
        { name: 'node', version: '22.4.1', label: 'Node.js', source: 'project' },
        { name: 'pnpm', version: '9.15.1', label: 'pnpm', source: 'project' },
      ]);
      expect(plan.archiveEntries).toBe('');
    } finally {
      await removeTempProject(project);
    }
  });

  it('keeps go mode pure remote by default', async () => {
    const project = await makeTempProject({
      '.go-version': '1.25.0\n',
      'go.mod': 'module example.com/demo\n',
    });

    try {
      const plan = await buildPlan(buildInputs({
        mode: 'go',
        workingDirectory: project,
        cacheTag: 'svc',
        entries: '',
      }));

      expect(plan.runtimeTools).toEqual([
        { name: 'go', version: '1.25.0', label: 'Go', source: 'project' },
      ]);
      expect(plan.archiveEntries).toBe('');
    } finally {
      await removeTempProject(project);
    }
  });

  it('allows explicit archive entries alongside turbo proxy mode', async () => {
    const project = await makeTempProject({
      '.node-version': '22.4.1\n',
      'package.json': '{"name":"demo","packageManager":"pnpm@9.15.1"}\n',
      'pnpm-lock.yaml': 'lockfileVersion: 9.0\n',
    });

    try {
      const plan = await buildPlan(buildInputs({
        mode: 'turbo-proxy',
        workingDirectory: project,
        cacheTag: 'web',
        entries: 'pnpm-store:.pnpm-store\nnode-modules:node_modules',
      }));

      expect(plan.archiveEntries).toBe(
        'web-pnpm-store-node-22.4.1-pnpm-9.15.1:.pnpm-store,web-node-modules-node-22.4.1-pnpm-9.15.1:node_modules',
      );
    } finally {
      await removeTempProject(project);
    }
  });

  it('detects package-manager tools and default archive entries for the node preset', async () => {
    const project = await makeTempProject({
      '.node-version': '22.5.0\n',
      'package.json': '{"name":"demo","packageManager":"yarn@1.22.22"}\n',
      'yarn.lock': '# lockfile\n',
    });

    try {
      const plan = await buildPlan(buildInputs({
        preset: 'node',
        workingDirectory: project,
        cacheTag: 'frontend',
        entries: '',
      }));

      expect(plan.runtimeTools).toEqual([
        { name: 'node', version: '22.5.0', label: 'Node.js', source: 'project' },
        { name: 'yarn', version: '1.22.22', label: 'Yarn', source: 'project' },
      ]);
      expect(plan.archiveEntries).toBe(
        'frontend-yarn-cache-node-22.5.0-yarn-1.22.22:.yarn-cache,frontend-node-modules-node-22.5.0-yarn-1.22.22:node_modules',
      );
    } finally {
      await removeTempProject(project);
    }
  });

  it('adds python and uv tools plus uv cache defaults for the python-uv preset', async () => {
    const project = await makeTempProject({
      '.python-version': '3.12.7\n',
      'pyproject.toml': '[project]\nname = "demo"\n',
      'uv.lock': 'version = 1\n',
    });

    try {
      const plan = await buildPlan(buildInputs({
        preset: 'python-uv',
        workingDirectory: project,
        cacheTag: 'api',
        entries: '',
      }));

      expect(plan.runtimeTools).toEqual([
        { name: 'python', version: '3.12.7', label: 'Python', source: 'project' },
        { name: 'uv', version: '0.9.21', label: 'uv', source: 'preset' },
      ]);
      expect(plan.archiveEntries).toBe('api-uv-cache-python-3.12.7-uv-0.9.21:.uv-cache');
    } finally {
      await removeTempProject(project);
    }
  });

  it('adds go cache defaults for the go preset', async () => {
    const project = await makeTempProject({
      '.go-version': '1.24.0\n',
      'go.mod': 'module example.com/demo\n',
    });

    try {
      const plan = await buildPlan(buildInputs({
        preset: 'go',
        workingDirectory: project,
        cacheTag: 'svc',
        entries: '',
      }));

      expect(plan.runtimeTools).toEqual([
        { name: 'go', version: '1.24.0', label: 'Go', source: 'project' },
      ]);
      expect(plan.archiveEntries).toBe(
        'svc-go-mod-cache-go-1.24.0:.go/pkg/mod,svc-go-build-cache-go-1.24.0:.go/build-cache',
      );
    } finally {
      await removeTempProject(project);
    }
  });

  it('adds php and composer tools plus composer cache defaults for the php-composer preset', async () => {
    const project = await makeTempProject({
      '.php-version': '8.4.4\n',
      'composer.json': '{"name":"demo/app"}\n',
      'composer.lock': '{}\n',
    });

    try {
      const plan = await buildPlan(buildInputs({
        preset: 'php-composer',
        workingDirectory: project,
        cacheTag: 'site',
        entries: '',
      }));

      expect(plan.runtimeTools).toEqual([
        { name: 'php', version: '8.4.4', label: 'PHP', source: 'preset' },
        { name: 'composer', version: '2.9.5', label: 'Composer', source: 'preset' },
      ]);
      expect(plan.archiveEntries).toBe(
        'site-composer-cache-composer-2.9.5-php-8.4.4:.composer-cache,site-vendor-composer-2.9.5-php-8.4.4:vendor',
      );
    } finally {
      await removeTempProject(project);
    }
  });

  it('resolves actions/cache compatibility paths relative to working-directory', async () => {
    const project = await makeTempProject({});

    try {
      const plan = await buildPlan(buildInputs({
        workingDirectory: project,
        entries: '',
        path: 'node_modules\n.npm-cache',
        key: 'deps',
        noPlatform: true,
      }));

      expect(plan.archiveEntries).toBe(
        `deps-node-modules:${path.join(project, 'node_modules')},deps-npm-cache:${path.join(project, '.npm-cache')}`,
      );
      expect(exec.exec).toHaveBeenCalledWith(
        'boringcache',
        [
          'run',
          'my-org/my-project',
          '--archive-path',
          'node_modules',
          '--archive-path',
          '.npm-cache',
          '--archive-tag-prefix',
          'deps',
          '--no-platform',
          '--dry-run',
          '--json',
        ],
        expect.objectContaining({ cwd: project }),
      );
    } finally {
      await removeTempProject(project);
    }
  });

  it('resolves exact verification tags with CI branch suffixes', async () => {
    const project = await makeTempProject({ 'package.json': '{"name":"demo"}\n' });
    const previousCi = process.env.CI;
    const previousHeadRef = process.env.GITHUB_HEAD_REF;
    const previousDefaultBranch = process.env.BORINGCACHE_DEFAULT_BRANCH;

    try {
      process.env.CI = '1';
      process.env.GITHUB_HEAD_REF = 'Feature/ABC-123';
      process.env.BORINGCACHE_DEFAULT_BRANCH = 'main';

      expect(resolveVerificationTags([{
        tag: 'deps',
        noPlatform: true,
        noGit: false,
        pathHint: project,
      }], project)).toEqual(['deps-branch-feature-abc-123']);
    } finally {
      if (previousCi === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = previousCi;
      }

      if (previousHeadRef === undefined) {
        delete process.env.GITHUB_HEAD_REF;
      } else {
        process.env.GITHUB_HEAD_REF = previousHeadRef;
      }

      if (previousDefaultBranch === undefined) {
        delete process.env.BORINGCACHE_DEFAULT_BRANCH;
      } else {
        process.env.BORINGCACHE_DEFAULT_BRANCH = previousDefaultBranch;
      }

      await removeTempProject(project);
    }
  });

  it('does not mix a detached submodule default branch with the workflow branch', async () => {
    const project = await makeTempProject({
      'upstream/.git': 'gitdir: ../.git/modules/upstream\n',
      '.git/modules/upstream/HEAD': 'a'.repeat(40),
      '.git/modules/upstream/refs/remotes/origin/HEAD': 'ref: refs/remotes/origin/master\n',
    });
    const previousCi = process.env.CI;
    const previousRefName = process.env.GITHUB_REF_NAME;
    const previousHeadRef = process.env.GITHUB_HEAD_REF;
    const previousDefaultBranch = process.env.BORINGCACHE_DEFAULT_BRANCH;

    try {
      process.env.CI = '1';
      process.env.GITHUB_REF_NAME = 'main';
      delete process.env.GITHUB_HEAD_REF;
      delete process.env.BORINGCACHE_DEFAULT_BRANCH;

      expect(resolveVerificationTags([{
        tag: 'deps',
        noPlatform: true,
        noGit: false,
        pathHint: path.join(project, 'upstream/.go/pkg/mod'),
      }], path.join(project, 'upstream'))).toEqual(['deps']);
    } finally {
      if (previousCi === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = previousCi;
      }

      if (previousRefName === undefined) {
        delete process.env.GITHUB_REF_NAME;
      } else {
        process.env.GITHUB_REF_NAME = previousRefName;
      }

      if (previousHeadRef === undefined) {
        delete process.env.GITHUB_HEAD_REF;
      } else {
        process.env.GITHUB_HEAD_REF = previousHeadRef;
      }

      if (previousDefaultBranch === undefined) {
        delete process.env.BORINGCACHE_DEFAULT_BRANCH;
      } else {
        process.env.BORINGCACHE_DEFAULT_BRANCH = previousDefaultBranch;
      }

      await removeTempProject(project);
    }
  });

  it('keeps maven mode pure remote by default', async () => {
    const plan = await buildPlan(buildInputs({
      setup: 'none',
      mode: 'maven',
      cacheTag: 'service',
      entries: '',
    }));

    expect(plan.archiveEntries).toBe('');
  });

  it('allows explicit local repository archive entries in maven mode', async () => {
    const plan = await buildPlan(buildInputs({
      setup: 'none',
      mode: 'maven',
      cacheTag: 'service',
      entries: 'maven-repo:~/.m2/repository',
    }));

    expect(plan.archiveEntries).toBe('service-maven-repo:~/.m2/repository');
  });

  it('detects Java from pom.xml for maven mode and falls back to the default Maven runtime', async () => {
    const project = await makeTempProject({
      'pom.xml': `<project><properties><maven.compiler.release>21</maven.compiler.release></properties></project>\n`,
    });

    try {
      const plan = await buildPlan(buildInputs({
        mode: 'maven',
        workingDirectory: project,
        entries: '',
      }));

      expect(plan.runtimeTools).toEqual([
        { name: 'java', version: '21', label: 'Java', source: 'project' },
        { name: 'maven', version: '3.9.9', label: 'Maven', source: 'mode' },
      ]);
    } finally {
      await removeTempProject(project);
    }
  });

  it('installs tools when they are not available on PATH or in mise', async () => {
    await applyMiseSetup([
      { name: 'node', version: '22.4.1', label: 'Node.js', source: 'preset' },
    ], false);

    expect(actionCoreMocks.installMise).toHaveBeenCalledTimes(1);
    expect(actionCoreMocks.hasToolVersionOnPath).toHaveBeenCalledWith('node', '22.4.1');
    expect(actionCoreMocks.hasMiseToolVersion).toHaveBeenCalledWith('node', '22.4.1');
    expect(actionCoreMocks.installMiseTool).toHaveBeenCalledWith(
      'node',
      '22.4.1',
      { label: 'Node.js' },
    );
    expect(actionCoreMocks.activateMiseTool).not.toHaveBeenCalled();
    expect(actionCoreMocks.reshimMise).toHaveBeenCalledTimes(1);
    expect(actionCoreMocks.exportMiseEnv).toHaveBeenCalledWith(undefined);
  });

  it('activates tools when the requested version is already installed in mise', async () => {
    actionCoreMocks.hasMiseToolVersion.mockResolvedValueOnce(true);

    await applyMiseSetup([
      { name: 'ruby', version: '3.3.6', label: 'Ruby', source: 'preset' },
    ], false);

    expect(actionCoreMocks.installMise).toHaveBeenCalledTimes(1);
    expect(actionCoreMocks.activateMiseTool).toHaveBeenCalledWith(
      'ruby',
      '3.3.6',
      { label: 'Ruby' },
    );
    expect(actionCoreMocks.installMiseTool).not.toHaveBeenCalled();
    expect(actionCoreMocks.reshimMise).toHaveBeenCalledTimes(1);
    expect(actionCoreMocks.exportMiseEnv).toHaveBeenCalledWith(undefined);
  });

  it('skips mise entirely when matching tools are already on PATH', async () => {
    actionCoreMocks.hasToolVersionOnPath.mockResolvedValueOnce(true);

    await applyMiseSetup([
      { name: 'java', version: '21', label: 'Java', source: 'mode' },
    ], false);

    expect(actionCoreMocks.installMise).not.toHaveBeenCalled();
    expect(actionCoreMocks.hasMiseToolVersion).not.toHaveBeenCalled();
    expect(actionCoreMocks.installMiseTool).not.toHaveBeenCalled();
    expect(actionCoreMocks.activateMiseTool).not.toHaveBeenCalled();
    expect(actionCoreMocks.reshimMise).not.toHaveBeenCalled();
    expect(actionCoreMocks.exportMiseEnv).not.toHaveBeenCalled();
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
    expect(exec.exec).toHaveBeenCalledWith(
      'boringcache',
      ['run', 'my-org/my-project', 'bundler:vendor/bundle', '--tool-tag-suffix', 'ruby-4.0.1', '--dry-run', '--json'],
      expect.any(Object),
    );
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

  it('resolves semantic entries through CLI dry-run JSON', async () => {
    (exec.exec as jest.Mock).mockImplementation(async (_tool: string, args: string[], options?: { listeners?: { stdout?: (data: Buffer) => void } }) => {
      if (args.includes('--json')) {
        options?.listeners?.stdout?.(Buffer.from(JSON.stringify({
          workspace: 'my-org/my-project',
          workspace_source: 'explicit',
          tag_path_pairs: ['bundler-gems:/cache/vendor/bundle'],
          archive_entries: [{
            requested: 'bundler',
            request_source: 'entry',
            resolution_source: 'repo-config',
            tag: 'bundler-gems',
            path: '/cache/vendor/bundle',
            tag_path_pair: 'bundler-gems:/cache/vendor/bundle',
          }],
          env_vars: {},
        })));
      }
      return 0;
    });

    const plan = await buildPlan(buildInputs({
      setup: 'none',
      entries: 'bundler',
      workspace: 'my-org/my-project',
    }));

    expect(plan.workspace).toBe('my-org/my-project');
    expect(plan.archiveEntries).toBe('bundler-gems:/cache/vendor/bundle');
    expect(plan.cacheTagPrefix).toBe('bundler-gems');
  });

  it('upgrades raw archive entries through CLI when a repo config file is present', async () => {
    const project = await makeTempProject({
      '.boringcache.toml': 'workspace = "config-org/config-workspace"\n',
    });

    (exec.exec as jest.Mock).mockImplementation(async (_tool: string, args: string[], options?: { listeners?: { stdout?: (data: Buffer) => void } }) => {
      if (args.includes('--json')) {
        options?.listeners?.stdout?.(Buffer.from(JSON.stringify({
          workspace: 'config-org/config-workspace',
          workspace_source: 'repo-config',
          repo_config_path: `${project}/.boringcache.toml`,
          tag_path_pairs: ['bundler-gems:/cache/vendor/bundle'],
          archive_entries: [{
            requested: 'bundler',
            request_source: 'entry',
            resolution_source: 'repo-config',
            tag: 'bundler-gems',
            path: '/cache/vendor/bundle',
            tag_path_pair: 'bundler-gems:/cache/vendor/bundle',
          }],
          env_vars: {
            BUNDLE_PATH: '/cache/vendor/bundle',
          },
        })));
      }
      return 0;
    });

    try {
      const plan = await buildPlan(buildInputs({
        setup: 'none',
        workspace: '',
        workingDirectory: project,
        entries: 'bundler:vendor/bundle',
      }));

      expect(plan.workspace).toBe('config-org/config-workspace');
      expect(plan.archiveEntries).toBe('bundler-gems:/cache/vendor/bundle');
      expect(plan.envVars).toEqual({
        BUNDLE_PATH: '/cache/vendor/bundle',
      });
    } finally {
      await removeTempProject(project);
    }
  });

  it('keeps raw archive entries local when no repo config is present', async () => {
    const project = await makeTempProject({});

    try {
      const plan = await buildPlan(buildInputs({
        setup: 'none',
        workingDirectory: project,
        entries: 'bundler:vendor/bundle',
      }));

      expect(plan.archiveEntries).toBe('bundler:vendor/bundle');
      expect(plan.cacheTagPrefix).toBe('bundler');
      expect(exec.exec).not.toHaveBeenCalled();
    } finally {
      await removeTempProject(project);
    }
  });

  it('resolves workspace through CLI dry-run for proxy-only plans', async () => {
    const project = await makeTempProject({
      '.boringcache.toml': 'workspace = "config-org/config-workspace"\n',
    });

    try {
      const plan = await buildPlan(buildInputs({
        setup: 'none',
        mode: 'turbo-proxy',
        workspace: '',
        workingDirectory: project,
        entries: '',
      }));

      expect(plan.workspace).toBe('config-org/config-workspace');
      expect(plan.archiveEntries).toBe('');
      expect(exec.exec).toHaveBeenCalledWith(
        'boringcache',
        ['run', '--dry-run', '--json'],
        expect.objectContaining({ cwd: project }),
      );
    } finally {
      await removeTempProject(project);
    }
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
    expect(plan.archiveEntries).toBe('web-bundler-ruby-4.0.1:vendor/bundle');
    expect(exec.exec).toHaveBeenCalledWith(
      'boringcache',
      ['run', 'my-org/my-project', 'bundler:vendor/bundle', '--cache-tag', 'web', '--tool-tag-suffix', 'ruby-4.0.1', '--dry-run', '--json'],
      expect.any(Object),
    );
  });

  it('prefixes archive entries with cache-tag for deterministic namespacing', async () => {
    const plan = await buildPlan(buildInputs({
      setup: 'none',
      cacheTag: 'archive-poison-123',
      entries: 'marker:marker.txt',
    }));

    expect(plan.archiveEntries).toBe('archive-poison-123-marker:marker.txt');
    expect(plan.cacheTagPrefix).toBe('archive-poison-123');
    expect(exec.exec).toHaveBeenCalledWith(
      'boringcache',
      ['run', 'my-org/my-project', 'marker:marker.txt', '--cache-tag', 'archive-poison-123', '--dry-run', '--json'],
      expect.any(Object),
    );
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
