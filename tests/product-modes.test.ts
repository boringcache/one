import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { run as restoreRun } from '../lib/restore';
import { actionCoreMocks, mockGetBooleanInput, mockGetInput } from './setup';

async function makeTempProject(files: Record<string, string>): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'boringcache-one-mode-'));
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

describe('product modes', () => {
  it('fails archive restore when fail-on-cache-miss is enabled', async () => {
    const project = await makeTempProject({ 'cache-dir/.keep': '' });

    try {
      mockGetInput({
        mode: 'archive',
        setup: 'none',
        workspace: 'boringcache/test-workspace',
        'working-directory': project,
        path: path.join(project, 'cache-dir'),
        key: 'archive-restore-miss',
      });
      mockGetBooleanInput({
        'fail-on-cache-miss': true,
        'no-platform': true,
      });

      (exec.exec as jest.Mock).mockImplementation(async (
        command: string,
        args?: string[],
        options?: { cwd?: string; listeners?: { stdout?: (data: Buffer) => void } },
      ) => {
        if (command === 'boringcache' && args?.[0] === 'run' && args.includes('--dry-run') && args.includes('--json')) {
          const entry = `archive-restore-miss-cache-dir:${path.join(project, 'cache-dir')}`;
          options?.listeners?.stdout?.(Buffer.from(JSON.stringify({
            workspace: 'boringcache/test-workspace',
            workspace_source: 'explicit',
            tag_path_pairs: [entry],
            archive_entries: [{
              requested: path.join(project, 'cache-dir'),
              request_source: 'archive-path',
              resolution_source: 'manual',
              resolved_tag: 'archive-restore-miss-cache-dir',
              tag: 'archive-restore-miss-cache-dir',
              path: path.join(project, 'cache-dir'),
              tag_path_pair: entry,
            }],
            archive_restore_candidates: [],
            env_vars: {},
          })));
          return 0;
        }
        if (command === 'boringcache' && args?.[0] === 'restore') {
          return 1;
        }
        return 0;
      });

      await restoreRun();

      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('boringcache/one restore failed: Cache restore failed for archive-restore-miss-cache-dir:'),
      );
    } finally {
      await removeTempProject(project);
    }
  });

  it('runs docker mode through the registry proxy adapter', async () => {
    const project = await makeTempProject({ Dockerfile: 'FROM scratch\n' });

    try {
      mockGetInput({
        mode: 'docker',
        setup: 'none',
        workspace: 'boringcache/test-workspace',
        'working-directory': project,
        image: 'ghcr.io/boringcache/demo',
      });
      mockGetBooleanInput({});

      await restoreRun();

      const cliPlanCall = (exec.exec as jest.Mock).mock.calls.find(
        ([command, args]) => command === 'boringcache' && Array.isArray(args) && args[0] === 'docker',
      );
      expect(cliPlanCall?.[1]).toEqual(expect.arrayContaining([
        '--oci-hydration',
        'metadata-only',
      ]));
      expect(actionCoreMocks.startRegistryProxy).toHaveBeenCalledWith(expect.objectContaining({
        command: 'cache-registry',
        workspace: 'boringcache/test-workspace',
        onDemand: false,
        ociPrefetchRefs: ['cache@buildcache'],
        ociRequiredReadableRefs: ['buildcache'],
        ociHydration: 'metadata-only',
      }));
      const dockerBuildCall = (exec.exec as jest.Mock).mock.calls.find(
        ([command, args]) => command === 'docker' && Array.isArray(args) && args[0] === 'buildx' && args[1] === 'build',
      );
      expect(dockerBuildCall).toBeTruthy();
      expect(dockerBuildCall?.[1]).toEqual(expect.arrayContaining([
        '--cache-from',
        expect.stringContaining('/cache:buildcache,registry.insecure=true'),
        '--cache-to',
        expect.stringContaining('/cache:buildcache,mode=max,registry.insecure=true'),
      ]));
      expect(core.setOutput).toHaveBeenCalledWith('docker-cache-run-ref', '');
      expect(core.setOutput).toHaveBeenCalledWith('docker-cache-from-refs', 'buildcache');
      expect(core.setOutput).toHaveBeenCalledWith('docker-cache-promotion-refs', '');
      const cacheTagCalls = (core.setOutput as jest.Mock).mock.calls.filter(([name]) => name === 'cache-tag');
      expect(cacheTagCalls.at(-1)).toEqual(['cache-tag', 'ghcr-io-boringcache-demo']);
      expect(core.setOutput).toHaveBeenCalledWith('resolved-mode', 'docker');
    } finally {
      await removeTempProject(project);
    }
  });

  it('surfaces provider-neutral Docker run refs from CLI dry-run planning', async () => {
    const project = await makeTempProject({ Dockerfile: 'FROM scratch\n' });

    try {
      mockGetInput({
        mode: 'docker',
        setup: 'none',
        workspace: 'boringcache/test-workspace',
        'working-directory': project,
        image: 'ghcr.io/boringcache/demo',
      });
      mockGetBooleanInput({});

      (exec.exec as jest.Mock).mockImplementation(async (
        command: string,
        args?: string[],
        options?: { listeners?: { stdout?: (data: Buffer) => void } },
      ) => {
        if (command === 'boringcache' && args?.[0] === 'run' && args.includes('--dry-run') && args.includes('--json')) {
          options?.listeners?.stdout?.(Buffer.from(JSON.stringify({
            workspace: 'boringcache/test-workspace',
            workspace_source: 'explicit',
            tag_path_pairs: [],
            archive_entries: [],
            archive_restore_candidates: [],
            env_vars: {},
          })));
          return 0;
        }
        if (command === 'boringcache' && args?.[0] === 'docker' && args.includes('--dry-run') && args.includes('--json')) {
          options?.listeners?.stdout?.(Buffer.from(JSON.stringify({
            adapter: 'docker',
            workspace: 'boringcache/test-workspace',
            workspace_source: 'explicit',
            tag: 'ghcr-io-boringcache-demo',
            command: [],
            archive_entries: [],
            env_vars: {},
            proxy: {
              host: '0.0.0.0',
              endpoint_host: '172.17.0.1',
              port: 5000,
              no_platform: false,
              no_git: false,
              read_only: false,
              startup_mode: 'warm',
              oci_prefetch_refs: ['cache@branch-main', 'cache@default', 'cache@buildcache'],
              oci_hydration: 'metadata-only',
              metadata_hints: {
                docker_cache_ref_tag: 'run-example-42-attempt-1',
                docker_immutable_run_ref: 'run-example-42-attempt-1',
                docker_cache_from_refs: 'type=registry,ref=172.17.0.1:5000/cache:branch-main,type=registry,ref=172.17.0.1:5000/cache:default',
                docker_alias_promotion_refs: 'branch-main,default',
                ci_provider: 'example-ci',
                ci_run_uid: '42',
                ci_run_attempt: '1',
                ci_ref_type: 'branch',
                ci_ref_name: 'main',
                ci_commit_sha: 'abcdef1234567890',
                ci_run_started_at: '2026-04-21T10:00:00Z',
              },
            },
            oci_cache: {
              registry_ref: '172.17.0.1:5000/cache:run-example-42-attempt-1',
              cache_from: 'type=registry,ref=172.17.0.1:5000/cache:branch-main',
              cache_from_refs: [
                'type=registry,ref=172.17.0.1:5000/cache:branch-main',
                'type=registry,ref=172.17.0.1:5000/cache:default',
                'type=registry,ref=172.17.0.1:5000/cache:buildcache',
              ],
              cache_to: 'type=registry,ref=172.17.0.1:5000/cache:run-example-42-attempt-1,mode=max',
              ref_tag: 'run-example-42-attempt-1',
              immutable_run_ref_tag: 'run-example-42-attempt-1',
              promotion_ref_tags: ['branch-main'],
              run_metadata: {
                provider: 'example-ci',
                run_uid: '42',
                run_attempt: '1',
                source_ref_type: 'branch',
                source_ref_name: 'main',
                run_started_at: '2026-04-21T10:00:00Z',
              },
            },
          })));
          return 0;
        }
        return 0;
      });

      await restoreRun();

      expect(core.setOutput).toHaveBeenCalledWith('docker-cache-run-ref', 'run-example-42-attempt-1');
      expect(core.setOutput).toHaveBeenCalledWith('docker-cache-from-refs', 'branch-main\ndefault\nbuildcache');
      expect(core.setOutput).toHaveBeenCalledWith('docker-cache-promotion-refs', 'branch-main');
      expect(core.setOutput).toHaveBeenCalledWith('docker-ci-provider', 'example-ci');
      expect(core.setOutput).toHaveBeenCalledWith('docker-ci-run-id', '42');
      expect(core.setOutput).toHaveBeenCalledWith('docker-ci-run-attempt', '1');
      expect(core.setOutput).toHaveBeenCalledWith('docker-ci-ref-type', 'branch');
      expect(core.setOutput).toHaveBeenCalledWith('docker-ci-ref-name', 'main');
      expect(core.setOutput).toHaveBeenCalledWith('docker-ci-run-started-at', '2026-04-21T10:00:00Z');
      expect(core.setOutput).toHaveBeenCalledWith(
        'cache-from',
        [
          'type=registry,ref=172.17.0.1:5000/cache:branch-main,registry.insecure=true',
          'type=registry,ref=172.17.0.1:5000/cache:default,registry.insecure=true',
          'type=registry,ref=172.17.0.1:5000/cache:buildcache,registry.insecure=true',
        ].join('\n'),
      );
      const dockerBuildCall = (exec.exec as jest.Mock).mock.calls.find(
        ([command, args]) => command === 'docker' && Array.isArray(args) && args[0] === 'buildx' && args[1] === 'build',
      );
      const dockerBuildArgs = dockerBuildCall?.[1] as string[] | undefined;
      expect(dockerBuildArgs).toBeTruthy();
      expect(dockerBuildArgs?.filter((arg) => arg === '--cache-from')).toHaveLength(3);
      expect(dockerBuildArgs).toEqual(expect.arrayContaining([
        '--cache-from',
        'type=registry,ref=172.17.0.1:5000/cache:branch-main,registry.insecure=true',
        'type=registry,ref=172.17.0.1:5000/cache:default,registry.insecure=true',
        'type=registry,ref=172.17.0.1:5000/cache:buildcache,registry.insecure=true',
        '--cache-to',
        'type=registry,ref=172.17.0.1:5000/cache:run-example-42-attempt-1,mode=max,registry.insecure=true',
      ]));
      expect(actionCoreMocks.startRegistryProxy).toHaveBeenCalledWith(expect.objectContaining({
        ociAliasPromotionRefs: ['branch-main'],
        ociRequiredReadableRefs: ['branch-main', 'default', 'buildcache'],
        metadataHints: {
          docker_immutable_run_ref: 'run-example-42-attempt-1',
          docker_alias_promotion_refs: 'branch-main/default',
          ci_provider: 'example-ci',
          ci_run_uid: '42',
          ci_run_started_at: '2026-04-21t10:00:00z',
          ci_run_attempt: '1',
          ci_ref_type: 'branch',
          docker_cache_ref_tag: 'run-example-42-attempt-1',
        },
      }));
    } finally {
      await removeTempProject(project);
    }
  });

  it('filters unreadable docker import refs but still exports cache', async () => {
    const project = await makeTempProject({ Dockerfile: 'FROM scratch\n' });

    try {
      mockGetInput({
        mode: 'docker',
        setup: 'none',
        workspace: 'boringcache/test-workspace',
        'working-directory': project,
        image: 'ghcr.io/boringcache/demo',
      });
      mockGetBooleanInput({});
      actionCoreMocks.startRegistryProxy.mockResolvedValueOnce({
        pid: 4321,
        port: 5000,
        readOnly: false,
        ociImportReadiness: {
          requestedRefs: ['pr-3208', 'default', 'buildcache'],
          readableRefs: ['default', 'buildcache'],
          unreadableRefs: ['pr-3208'],
          ready: false,
          phase: 'ready',
          publishState: 'published',
          publishSettled: true,
          tagsVisible: true,
        },
      });

      (exec.exec as jest.Mock).mockImplementation(async (
        command: string,
        args?: string[],
        options?: { listeners?: { stdout?: (data: Buffer) => void } },
      ) => {
        if (command === 'boringcache' && args?.[0] === 'run' && args.includes('--dry-run') && args.includes('--json')) {
          options?.listeners?.stdout?.(Buffer.from(JSON.stringify({
            workspace: 'boringcache/test-workspace',
            workspace_source: 'explicit',
            tag_path_pairs: [],
            archive_entries: [],
            archive_restore_candidates: [],
            env_vars: {},
          })));
          return 0;
        }
        if (command === 'boringcache' && args?.[0] === 'docker' && args.includes('--dry-run') && args.includes('--json')) {
          options?.listeners?.stdout?.(Buffer.from(JSON.stringify({
            adapter: 'docker',
            workspace: 'boringcache/test-workspace',
            workspace_source: 'explicit',
            tag: 'ghcr-io-boringcache-demo',
            command: [],
            archive_entries: [],
            env_vars: {},
            proxy: {
              host: '127.0.0.1',
              endpoint_host: '127.0.0.1',
              port: 5000,
              no_platform: false,
              no_git: false,
              read_only: false,
              startup_mode: 'warm',
              oci_prefetch_refs: ['cache@pr-3208', 'cache@default', 'cache@buildcache'],
              oci_hydration: 'metadata-only',
              metadata_hints: {},
            },
            oci_cache: {
              registry_ref: '127.0.0.1:5000/cache:run-gha-24771923434-attempt-1',
              cache_from: 'type=registry,ref=127.0.0.1:5000/cache:pr-3208',
              cache_from_refs: [
                'type=registry,ref=127.0.0.1:5000/cache:pr-3208',
                'type=registry,ref=127.0.0.1:5000/cache:default',
                'type=registry,ref=127.0.0.1:5000/cache:buildcache',
              ],
              cache_to: 'type=registry,ref=127.0.0.1:5000/cache:run-gha-24771923434-attempt-1,mode=max',
              ref_tag: 'buildcache',
              immutable_run_ref_tag: 'run-gha-24771923434-attempt-1',
              promotion_ref_tags: ['pr-3208'],
            },
          })));
          return 0;
        }
        return 0;
      });

      await restoreRun();

      expect(core.setOutput).toHaveBeenCalledWith('docker-cache-from-refs', 'default\nbuildcache');
      expect(core.setOutput).toHaveBeenCalledWith('docker-cache-requested-from-refs', 'pr-3208\ndefault\nbuildcache');
      expect(core.setOutput).toHaveBeenCalledWith('docker-cache-unreadable-from-refs', 'pr-3208');
      expect(core.setOutput).toHaveBeenCalledWith('docker-cache-import-ready', 'false');
      expect(core.setOutput).toHaveBeenCalledWith(
        'cache-from',
        [
          'type=registry,ref=127.0.0.1:5000/cache:default,registry.insecure=true',
          'type=registry,ref=127.0.0.1:5000/cache:buildcache,registry.insecure=true',
        ].join('\n'),
      );

      const dockerBuildCall = (exec.exec as jest.Mock).mock.calls.find(
        ([command, args]) => command === 'docker' && Array.isArray(args) && args[0] === 'buildx' && args[1] === 'build',
      );
      const dockerBuildArgs = dockerBuildCall?.[1] as string[] | undefined;
      expect(dockerBuildArgs).toBeTruthy();
      expect(dockerBuildArgs?.filter((arg) => arg === '--cache-from')).toHaveLength(2);
      expect(dockerBuildArgs).toEqual(expect.arrayContaining([
        '--cache-from',
        'type=registry,ref=127.0.0.1:5000/cache:default,registry.insecure=true',
        'type=registry,ref=127.0.0.1:5000/cache:buildcache,registry.insecure=true',
        '--cache-to',
        'type=registry,ref=127.0.0.1:5000/cache:run-gha-24771923434-attempt-1,mode=max,registry.insecure=true',
      ]));
      expect(dockerBuildArgs).not.toEqual(expect.arrayContaining([
        'type=registry,ref=127.0.0.1:5000/cache:pr-3208,registry.insecure=true',
      ]));
    } finally {
      await removeTempProject(project);
    }
  });

  it('passes one GitHub run start timestamp through the CLI plan and proxy process', async () => {
    const project = await makeTempProject({ Dockerfile: 'FROM scratch\n' });
    let dryRunEnv: Record<string, string> | undefined;

    try {
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_RUN_ID = '42';
      mockGetInput({
        mode: 'docker',
        setup: 'none',
        workspace: 'boringcache/test-workspace',
        'working-directory': project,
        image: 'ghcr.io/boringcache/demo',
      });
      mockGetBooleanInput({});

      (exec.exec as jest.Mock).mockImplementation(async (
        command: string,
        args?: string[],
        options?: { env?: Record<string, string>; listeners?: { stdout?: (data: Buffer) => void } },
      ) => {
        if (command === 'boringcache' && args?.[0] === 'docker' && args.includes('--dry-run') && args.includes('--json')) {
          dryRunEnv = options?.env;
          const runStartedAt = dryRunEnv?.BORINGCACHE_CI_RUN_STARTED_AT || '';
          options?.listeners?.stdout?.(Buffer.from(JSON.stringify({
            adapter: 'docker',
            workspace: 'boringcache/test-workspace',
            workspace_source: 'explicit',
            tag: 'ghcr-io-boringcache-demo',
            command: [],
            archive_entries: [],
            env_vars: {},
            proxy: {
              host: '0.0.0.0',
              endpoint_host: '172.17.0.1',
              port: 5000,
              no_platform: false,
              no_git: false,
              read_only: false,
              startup_mode: 'warm',
              oci_prefetch_refs: ['cache@run-42'],
              oci_hydration: 'metadata-only',
              metadata_hints: {
                docker_immutable_run_ref: 'run-42',
                docker_alias_promotion_refs: 'branch-main',
                ci_provider: 'github-actions',
                ci_run_uid: '42',
                ci_run_started_at: runStartedAt,
              },
            },
            oci_cache: {
              registry_ref: '172.17.0.1:5000/cache:run-42',
              cache_from: 'type=registry,ref=172.17.0.1:5000/cache:branch-main',
              cache_from_refs: ['type=registry,ref=172.17.0.1:5000/cache:branch-main'],
              cache_to: 'type=registry,ref=172.17.0.1:5000/cache:run-42,mode=max',
              ref_tag: 'run-42',
              immutable_run_ref_tag: 'run-42',
              promotion_ref_tags: ['branch-main'],
              run_metadata: {
                provider: 'github-actions',
                run_uid: '42',
                run_started_at: runStartedAt,
              },
            },
          })));
          return 0;
        }
        return 0;
      });

      await restoreRun();

      expect(dryRunEnv?.BORINGCACHE_CI_RUN_STARTED_AT).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(process.env.BORINGCACHE_CI_RUN_STARTED_AT).toBe(dryRunEnv?.BORINGCACHE_CI_RUN_STARTED_AT);
      expect(actionCoreMocks.startRegistryProxy).toHaveBeenCalledWith(expect.objectContaining({
        ociAliasPromotionRefs: ['branch-main'],
        metadataHints: expect.objectContaining({
          ci_run_started_at: dryRunEnv?.BORINGCACHE_CI_RUN_STARTED_AT.toLowerCase(),
        }),
      }));
    } finally {
      await removeTempProject(project);
    }
  });

  it('merges explicit metadata-hints into proxy metadata hints', async () => {
    const project = await makeTempProject({ Dockerfile: 'FROM scratch\n' });

    try {
      mockGetInput({
        mode: 'docker',
        setup: 'none',
        workspace: 'boringcache/test-workspace',
        'working-directory': project,
        image: 'ghcr.io/boringcache/demo',
        'metadata-hints': 'benchmark=grpc-bazel\nphase=seed\ntool=bazel',
      });
      mockGetBooleanInput({});

      (exec.exec as jest.Mock).mockImplementation(async (
        command: string,
        args?: string[],
        options?: { listeners?: { stdout?: (data: Buffer) => void } },
      ) => {
        if (command === 'boringcache' && args?.[0] === 'run' && args.includes('--dry-run') && args.includes('--json')) {
          options?.listeners?.stdout?.(Buffer.from(JSON.stringify({
            workspace: 'boringcache/test-workspace',
            workspace_source: 'explicit',
            tag_path_pairs: [],
            archive_entries: [],
            archive_restore_candidates: [],
            env_vars: {},
          })));
          return 0;
        }
        if (command === 'boringcache' && args?.[0] === 'docker' && args.includes('--dry-run') && args.includes('--json')) {
          options?.listeners?.stdout?.(Buffer.from(JSON.stringify({
            adapter: 'docker',
            workspace: 'boringcache/test-workspace',
            workspace_source: 'explicit',
            tag: 'ghcr-io-boringcache-demo',
            command: [],
            archive_entries: [],
            env_vars: {},
            proxy: {
              host: '0.0.0.0',
              endpoint_host: '172.17.0.1',
              port: 5000,
              no_platform: false,
              no_git: false,
              read_only: false,
              startup_mode: 'warm',
              oci_prefetch_refs: ['cache@buildcache'],
              oci_hydration: 'metadata-only',
              metadata_hints: {
                project: 'demo',
                ci_provider: 'github-actions',
                ci_run_uid: '42',
              },
            },
            oci_cache: {
              registry_ref: '172.17.0.1:5000/cache:buildcache',
              cache_from: 'type=registry,ref=172.17.0.1:5000/cache:buildcache',
              cache_from_refs: ['type=registry,ref=172.17.0.1:5000/cache:buildcache'],
              cache_to: 'type=registry,ref=172.17.0.1:5000/cache:buildcache,mode=max',
              ref_tag: 'buildcache',
            },
          })));
          return 0;
        }
        return 0;
      });

      await restoreRun();

      expect(actionCoreMocks.startRegistryProxy).toHaveBeenCalledWith(expect.objectContaining({
        metadataHints: expect.objectContaining({
          benchmark: 'grpc-bazel',
          phase: 'seed',
          tool: 'bazel',
          project: 'demo',
        }),
      }));
    } finally {
      await removeTempProject(project);
    }
  });

  it('passes docker OCI hydration policy to the registry proxy', async () => {
    const project = await makeTempProject({ Dockerfile: 'FROM scratch\n' });

    try {
      mockGetInput({
        mode: 'docker',
        setup: 'none',
        workspace: 'boringcache/test-workspace',
        'working-directory': project,
        image: 'ghcr.io/boringcache/demo',
        'oci-hydration': 'bodies-before-ready',
      });
      mockGetBooleanInput({});

      await restoreRun();

      expect(actionCoreMocks.startRegistryProxy).toHaveBeenCalledWith(expect.objectContaining({
        command: 'cache-registry',
        workspace: 'boringcache/test-workspace',
        ociPrefetchRefs: ['cache@buildcache'],
        ociHydration: 'bodies-before-ready',
      }));
    } finally {
      await removeTempProject(project);
    }
  });

  it('passes explicit background OCI hydration to the registry proxy', async () => {
    const project = await makeTempProject({ Dockerfile: 'FROM scratch\n' });

    try {
      mockGetInput({
        mode: 'docker',
        setup: 'none',
        workspace: 'boringcache/test-workspace',
        'working-directory': project,
        image: 'ghcr.io/boringcache/demo',
        'oci-hydration': 'bodies-background',
      });
      mockGetBooleanInput({});

      await restoreRun();

      expect(actionCoreMocks.startRegistryProxy).toHaveBeenCalledWith(expect.objectContaining({
        command: 'cache-registry',
        workspace: 'boringcache/test-workspace',
        ociPrefetchRefs: ['cache@buildcache'],
        ociHydration: 'bodies-background',
      }));
    } finally {
      await removeTempProject(project);
    }
  });

  it('supports docker setup-only mode for external build scripts', async () => {
    const project = await makeTempProject({ Dockerfile: 'FROM scratch\n' });

    try {
      mockGetInput({
        mode: 'docker',
        setup: 'none',
        'working-directory': project,
        workspace: 'boringcache/test-workspace',
        'docker-command': 'setup',
        'cache-tag': 'bench-scope',
        'registry-tag': 'bench-registry',
      });
      mockGetBooleanInput({});

      await restoreRun();

      expect(actionCoreMocks.startRegistryProxy).toHaveBeenCalledWith(expect.objectContaining({
        command: 'cache-registry',
        workspace: 'boringcache/test-workspace',
        tag: 'bench-registry',
        onDemand: false,
        ociPrefetchRefs: ['cache@buildcache'],
      }));
      expect(exec.exec).not.toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['buildx', 'build']),
        expect.any(Object),
      );
      expect(core.setOutput).toHaveBeenCalledWith('buildx-name', expect.any(String));
      expect(core.setOutput).toHaveBeenCalledWith('proxy-port', '5000');
      expect(core.setOutput).toHaveBeenCalledWith('registry-ref', expect.stringContaining('/cache:buildcache'));
      expect(core.setOutput).toHaveBeenCalledWith(
        'cache-from',
        expect.stringContaining('/cache:buildcache,registry.insecure=true'),
      );
      expect(core.setOutput).toHaveBeenCalledWith(
        'cache-to',
        expect.stringContaining('/cache:buildcache,mode=max,registry.insecure=true'),
      );
      const checkCalls = (exec.exec as jest.Mock).mock.calls.filter(
        ([command, args]) => command === 'boringcache' && Array.isArray(args) && args[0] === 'check',
      );
      expect(checkCalls).toHaveLength(0);
      expect(core.saveState).toHaveBeenCalledWith(
        'verify-save-specs',
        expect.stringContaining('"tag":"bench-registry"'),
      );
    } finally {
      await removeTempProject(project);
    }
  });

  it('uses registry-tag for direct docker cache refs', async () => {
    const project = await makeTempProject({ Dockerfile: 'FROM scratch\n' });

    try {
      mockGetInput({
        mode: 'docker',
        setup: 'none',
        workspace: 'boringcache/test-workspace',
        'working-directory': project,
        image: 'ghcr.io/boringcache/demo',
        'registry-tag': 'bench-registry',
      });
      mockGetBooleanInput({});

      await restoreRun();

      const dockerBuildCall = (exec.exec as jest.Mock).mock.calls.find(
        ([command, args]) => command === 'docker' && Array.isArray(args) && args[0] === 'buildx' && args[1] === 'build',
      );
      expect(dockerBuildCall).toBeTruthy();
      expect(dockerBuildCall?.[1]).toEqual(expect.arrayContaining([
        '--cache-from',
        expect.stringContaining('/cache:buildcache,registry.insecure=true'),
        '--cache-to',
        expect.stringContaining('/cache:buildcache,mode=max,registry.insecure=true'),
      ]));
    } finally {
      await removeTempProject(project);
    }
  });

  it('supports an explicit registry-ref-tag for direct docker cache refs', async () => {
    const project = await makeTempProject({ Dockerfile: 'FROM scratch\n' });

    try {
      mockGetInput({
        mode: 'docker',
        setup: 'none',
        workspace: 'boringcache/test-workspace',
        'working-directory': project,
        image: 'ghcr.io/boringcache/demo',
        'registry-tag': 'bench-registry',
        'registry-ref-tag': 'cache-main',
      });
      mockGetBooleanInput({});

      await restoreRun();

      const dockerBuildCall = (exec.exec as jest.Mock).mock.calls.find(
        ([command, args]) => command === 'docker' && Array.isArray(args) && args[0] === 'buildx' && args[1] === 'build',
      );
      expect(dockerBuildCall).toBeTruthy();
      expect(dockerBuildCall?.[1]).toEqual(expect.arrayContaining([
        '--cache-from',
        expect.stringContaining('/cache:cache-main,registry.insecure=true'),
        '--cache-to',
        expect.stringContaining('/cache:cache-main,mode=max,registry.insecure=true'),
      ]));
    } finally {
      await removeTempProject(project);
    }
  });

  it('accepts a registry-tag with an embedded OCI tag suffix for compatibility', async () => {
    const project = await makeTempProject({ Dockerfile: 'FROM scratch\n' });

    try {
      mockGetInput({
        mode: 'docker',
        setup: 'none',
        workspace: 'boringcache/test-workspace',
        'working-directory': project,
        image: 'ghcr.io/boringcache/demo',
        'registry-tag': 'bench-registry:cache-main',
      });
      mockGetBooleanInput({});

      await restoreRun();

      const dockerBuildCall = (exec.exec as jest.Mock).mock.calls.find(
        ([command, args]) => command === 'docker' && Array.isArray(args) && args[0] === 'buildx' && args[1] === 'build',
      );
      expect(dockerBuildCall).toBeTruthy();
      expect(dockerBuildCall?.[1]).toEqual(expect.arrayContaining([
        '--cache-from',
        expect.stringContaining('/cache:cache-main,registry.insecure=true'),
        '--cache-to',
        expect.stringContaining('/cache:cache-main,mode=max,registry.insecure=true'),
      ]));
      expect(core.warning).toHaveBeenCalledWith(
        '--tag included a ref-tag suffix; prefer --cache-ref-tag for the OCI cache tag.',
      );
    } finally {
      await removeTempProject(project);
    }
  });

  it('keeps embedded registry-tag compatibility when registry-ref-tag uses the default', async () => {
    const project = await makeTempProject({ Dockerfile: 'FROM scratch\n' });

    try {
      mockGetInput({
        mode: 'docker',
        setup: 'none',
        workspace: 'boringcache/test-workspace',
        'working-directory': project,
        image: 'ghcr.io/boringcache/demo',
        'registry-tag': 'bench-registry:cache-main',
        'registry-ref-tag': 'buildcache',
      });
      mockGetBooleanInput({});

      await restoreRun();

      const dockerBuildCall = (exec.exec as jest.Mock).mock.calls.find(
        ([command, args]) => command === 'docker' && Array.isArray(args) && args[0] === 'buildx' && args[1] === 'build',
      );
      expect(dockerBuildCall).toBeTruthy();
      expect(dockerBuildCall?.[1]).toEqual(expect.arrayContaining([
        '--cache-from',
        expect.stringContaining('/cache:cache-main,registry.insecure=true'),
        '--cache-to',
        expect.stringContaining('/cache:cache-main,mode=max,registry.insecure=true'),
      ]));
      expect(core.warning).toHaveBeenCalledWith(
        '--tag included a ref-tag suffix; prefer --cache-ref-tag for the OCI cache tag.',
      );
    } finally {
      await removeTempProject(project);
    }
  });

  it('uses a distinct buildx builder name for each docker invocation in the same job', async () => {
    const project = await makeTempProject({ Dockerfile: 'FROM scratch\n' });

    try {
      process.env.GITHUB_RUN_ID = '12345';
      mockGetInput({
        mode: 'docker',
        setup: 'none',
        'working-directory': project,
        workspace: 'boringcache/test-workspace',
        'docker-command': 'setup',
        'cache-tag': 'bench-scope',
      });
      mockGetBooleanInput({});

      process.env.GITHUB_ACTION = 'docker-cache';
      await restoreRun();

      process.env.GITHUB_ACTION = 'docker-cache-2';
      await restoreRun();

      const buildxCreateCalls = (exec.exec as jest.Mock).mock.calls.filter(
        ([command, args]) => command === 'docker' && Array.isArray(args) && args[0] === 'buildx' && args[1] === 'create',
      );

      expect(buildxCreateCalls).toHaveLength(2);
      const firstBuilder = buildxCreateCalls[0]?.[1]?.[3];
      const secondBuilder = buildxCreateCalls[1]?.[1]?.[3];
      expect(firstBuilder).toEqual(expect.stringContaining('boringcache-12345-docker-cache-'));
      expect(secondBuilder).toEqual(expect.stringContaining('boringcache-12345-docker-cache-2-'));
      expect(firstBuilder).not.toBe(secondBuilder);
      expect(core.saveState).toHaveBeenCalledWith('mode-builder-name', firstBuilder);
      expect(core.saveState).toHaveBeenCalledWith('mode-builder-name', secondBuilder);
    } finally {
      await removeTempProject(project);
    }
  });

  it('runs buildkit mode through buildctl', async () => {
    const project = await makeTempProject({ Dockerfile: 'FROM scratch\n' });

    try {
      mockGetInput({
        mode: 'buildkit',
        setup: 'none',
        'working-directory': project,
        image: 'ghcr.io/boringcache/demo',
        'buildkit-host': 'tcp://buildkit:1234',
      });
      mockGetBooleanInput({});

      await restoreRun();

      expect(actionCoreMocks.startRegistryProxy).toHaveBeenCalledWith(expect.objectContaining({
        command: 'cache-registry',
        onDemand: false,
        ociPrefetchRefs: ['cache@buildcache'],
        ociRequiredReadableRefs: ['buildcache'],
      }));
      const buildctlCall = (exec.exec as jest.Mock).mock.calls.find(
        ([command, args]) => command === 'buildctl' && Array.isArray(args) && args.includes('build'),
      );
      expect(buildctlCall).toBeTruthy();
      expect(buildctlCall?.[1]).toEqual(expect.arrayContaining([
        '--addr',
        'tcp://buildkit:1234',
        'build',
        '--import-cache',
        expect.stringContaining('/cache:buildcache,registry.insecure=true'),
        '--export-cache',
        expect.stringContaining('/cache:buildcache,mode=max,registry.insecure=true'),
      ]));
      expect(core.setOutput).toHaveBeenCalledWith('resolved-mode', 'buildkit');
    } finally {
      await removeTempProject(project);
    }
  });

  it('passes all CLI-planned BuildKit import caches to buildctl', async () => {
    const project = await makeTempProject({ Dockerfile: 'FROM scratch\n' });

    try {
      mockGetInput({
        mode: 'buildkit',
        setup: 'none',
        'working-directory': project,
        image: 'ghcr.io/boringcache/demo',
        'buildkit-host': 'tcp://buildkit:1234',
      });
      mockGetBooleanInput({});

      (exec.exec as jest.Mock).mockImplementation(async (
        command: string,
        args?: string[],
        options?: { listeners?: { stdout?: (data: Buffer) => void } },
      ) => {
        if (command === 'boringcache' && args?.[0] === 'run' && args.includes('--dry-run') && args.includes('--json')) {
          options?.listeners?.stdout?.(Buffer.from(JSON.stringify({
            workspace: 'boringcache/test-workspace',
            workspace_source: 'explicit',
            tag_path_pairs: [],
            archive_entries: [],
            archive_restore_candidates: [],
            env_vars: {},
          })));
          return 0;
        }
        if (command === 'boringcache' && args?.[0] === 'docker' && args.includes('--dry-run') && args.includes('--json')) {
          options?.listeners?.stdout?.(Buffer.from(JSON.stringify({
            adapter: 'docker',
            workspace: 'boringcache/test-workspace',
            workspace_source: 'explicit',
            tag: 'ghcr-io-boringcache-demo',
            command: [],
            archive_entries: [],
            env_vars: {},
            proxy: {
              host: '127.0.0.1',
              endpoint_host: '127.0.0.1',
              port: 5000,
              no_platform: false,
              no_git: false,
              read_only: false,
              startup_mode: 'warm',
              oci_prefetch_refs: ['cache@pr-3208', 'cache@default', 'cache@buildcache'],
              oci_hydration: 'metadata-only',
              metadata_hints: {},
            },
            oci_cache: {
              registry_ref: '127.0.0.1:5000/cache:run-gha-24771923434-attempt-1',
              cache_from: 'type=registry,ref=127.0.0.1:5000/cache:pr-3208',
              cache_from_refs: [
                'type=registry,ref=127.0.0.1:5000/cache:pr-3208',
                'type=registry,ref=127.0.0.1:5000/cache:default',
                'type=registry,ref=127.0.0.1:5000/cache:buildcache',
              ],
              cache_to: 'type=registry,ref=127.0.0.1:5000/cache:run-gha-24771923434-attempt-1,mode=max',
              ref_tag: 'buildcache',
              immutable_run_ref_tag: 'run-gha-24771923434-attempt-1',
              promotion_ref_tags: ['pr-3208'],
            },
          })));
          return 0;
        }
        return 0;
      });

      await restoreRun();

      const buildctlCall = (exec.exec as jest.Mock).mock.calls.find(
        ([command, args]) => command === 'buildctl' && Array.isArray(args) && args.includes('build'),
      );
      const buildctlArgs = buildctlCall?.[1] as string[] | undefined;
      expect(buildctlArgs).toBeTruthy();
      expect(buildctlArgs?.filter((arg) => arg === '--import-cache')).toHaveLength(3);
      expect(buildctlArgs).toEqual(expect.arrayContaining([
        '--import-cache',
        'type=registry,ref=127.0.0.1:5000/cache:pr-3208,registry.insecure=true',
        'type=registry,ref=127.0.0.1:5000/cache:default,registry.insecure=true',
        'type=registry,ref=127.0.0.1:5000/cache:buildcache,registry.insecure=true',
        '--export-cache',
        'type=registry,ref=127.0.0.1:5000/cache:run-gha-24771923434-attempt-1,mode=max,registry.insecure=true',
      ]));
      expect(actionCoreMocks.startRegistryProxy).toHaveBeenCalledWith(expect.objectContaining({
        ociAliasPromotionRefs: ['pr-3208'],
        ociRequiredReadableRefs: ['pr-3208', 'default', 'buildcache'],
      }));
    } finally {
      await removeTempProject(project);
    }
  });

  it('keeps buildkit export enabled when no planned import ref is readable', async () => {
    const project = await makeTempProject({ Dockerfile: 'FROM scratch\n' });

    try {
      mockGetInput({
        mode: 'buildkit',
        setup: 'none',
        'working-directory': project,
        image: 'ghcr.io/boringcache/demo',
        'buildkit-host': 'tcp://buildkit:1234',
      });
      mockGetBooleanInput({});
      actionCoreMocks.startRegistryProxy.mockResolvedValueOnce({
        pid: 4321,
        port: 5000,
        readOnly: false,
        ociImportReadiness: {
          requestedRefs: ['branch-main', 'default', 'buildcache'],
          readableRefs: [],
          unreadableRefs: ['branch-main', 'default', 'buildcache'],
          ready: false,
          phase: 'ready',
          publishState: 'published',
          publishSettled: true,
          tagsVisible: true,
        },
      });

      (exec.exec as jest.Mock).mockImplementation(async (
        command: string,
        args?: string[],
        options?: { listeners?: { stdout?: (data: Buffer) => void } },
      ) => {
        if (command === 'boringcache' && args?.[0] === 'run' && args.includes('--dry-run') && args.includes('--json')) {
          options?.listeners?.stdout?.(Buffer.from(JSON.stringify({
            workspace: 'boringcache/test-workspace',
            workspace_source: 'explicit',
            tag_path_pairs: [],
            archive_entries: [],
            archive_restore_candidates: [],
            env_vars: {},
          })));
          return 0;
        }
        if (command === 'boringcache' && args?.[0] === 'docker' && args.includes('--dry-run') && args.includes('--json')) {
          options?.listeners?.stdout?.(Buffer.from(JSON.stringify({
            adapter: 'docker',
            workspace: 'boringcache/test-workspace',
            workspace_source: 'explicit',
            tag: 'ghcr-io-boringcache-demo',
            command: [],
            archive_entries: [],
            env_vars: {},
            proxy: {
              host: '127.0.0.1',
              endpoint_host: '127.0.0.1',
              port: 5000,
              no_platform: false,
              no_git: false,
              read_only: false,
              startup_mode: 'warm',
              oci_prefetch_refs: ['cache@branch-main', 'cache@default', 'cache@buildcache'],
              oci_hydration: 'metadata-only',
              metadata_hints: {},
            },
            oci_cache: {
              registry_ref: '127.0.0.1:5000/cache:run-gha-24771923434-attempt-1',
              cache_from: 'type=registry,ref=127.0.0.1:5000/cache:branch-main',
              cache_from_refs: [
                'type=registry,ref=127.0.0.1:5000/cache:branch-main',
                'type=registry,ref=127.0.0.1:5000/cache:default',
                'type=registry,ref=127.0.0.1:5000/cache:buildcache',
              ],
              cache_to: 'type=registry,ref=127.0.0.1:5000/cache:run-gha-24771923434-attempt-1,mode=max',
              ref_tag: 'buildcache',
              immutable_run_ref_tag: 'run-gha-24771923434-attempt-1',
              promotion_ref_tags: ['branch-main'],
            },
          })));
          return 0;
        }
        return 0;
      });

      await restoreRun();

      expect(core.setOutput).toHaveBeenCalledWith('docker-cache-from-refs', '');
      expect(core.setOutput).toHaveBeenCalledWith('docker-cache-requested-from-refs', 'branch-main\ndefault\nbuildcache');
      expect(core.setOutput).toHaveBeenCalledWith('docker-cache-unreadable-from-refs', 'branch-main\ndefault\nbuildcache');
      expect(core.setOutput).toHaveBeenCalledWith('docker-cache-import-ready', 'false');
      expect(core.setOutput).toHaveBeenCalledWith('cache-from', '');

      const buildctlCall = (exec.exec as jest.Mock).mock.calls.find(
        ([command, args]) => command === 'buildctl' && Array.isArray(args) && args.includes('build'),
      );
      const buildctlArgs = buildctlCall?.[1] as string[] | undefined;
      expect(buildctlArgs).toBeTruthy();
      expect(buildctlArgs?.filter((arg) => arg === '--import-cache')).toHaveLength(0);
      expect(buildctlArgs).toEqual(expect.arrayContaining([
        '--export-cache',
        'type=registry,ref=127.0.0.1:5000/cache:run-gha-24771923434-attempt-1,mode=max,registry.insecure=true',
      ]));
    } finally {
      await removeTempProject(project);
    }
  });

  it('uses mise-detected bazel tooling for bazel mode', async () => {
    const project = await makeTempProject({ '.bazelversion': '8.0.1\n' });
    const home = await fs.mkdtemp(path.join(os.tmpdir(), 'boringcache-one-bazel-home-'));

    try {
      process.env.HOME = home;
      mockGetInput({
        mode: 'bazel',
        'working-directory': project,
        'bazelrc-lines': 'build --remote_cache_async=false\nbuild --experimental_remote_cache_eviction_retries=5',
      });
      mockGetBooleanInput({});

      await restoreRun();

      expect(actionCoreMocks.installMiseTool).toHaveBeenCalledWith('bazel', '8.0.1', { label: 'Bazel' });
      expect(actionCoreMocks.startRegistryProxy).toHaveBeenCalledWith(expect.objectContaining({
        command: 'cache-registry',
        onDemand: false,
      }));
      const bazelrc = await fs.readFile(path.join(home, '.bazelrc'), 'utf8');
      expect(bazelrc).toContain('build --remote_cache=http://127.0.0.1:5000');
      expect(bazelrc).toContain('build --remote_cache_async=false');
      expect(bazelrc).toContain('build --remote_download_minimal');
      expect(bazelrc).toContain('build --remote_max_connections=64');
      expect(bazelrc).toContain('build --experimental_remote_cache_eviction_retries=5');
      expect(core.setOutput).toHaveBeenCalledWith('resolved-mode', 'bazel');
    } finally {
      await removeTempProject(home);
      await removeTempProject(project);
    }
  });

  it('uses mise-detected go tooling for go mode and exports GOCACHEPROG', async () => {
    const project = await makeTempProject({
      '.go-version': '1.25.0\n',
      'go.mod': 'module example.com/demo\n',
    });

    try {
      mockGetInput({
        mode: 'go',
        'working-directory': project,
      });
      mockGetBooleanInput({});

      await restoreRun();

      expect(actionCoreMocks.installMiseTool).toHaveBeenCalledWith('go', '1.25.0', { label: 'Go' });
      expect(actionCoreMocks.startRegistryProxy).toHaveBeenCalledWith(expect.objectContaining({
        command: 'cache-registry',
        onDemand: false,
      }));
      expect(core.exportVariable).toHaveBeenCalledWith(
        'GOCACHEPROG',
        'boringcache go-cacheprog --endpoint http://127.0.0.1:5000',
      );
      expect(core.setOutput).toHaveBeenCalledWith('resolved-mode', 'go');
    } finally {
      await removeTempProject(project);
    }
  });

  it('uses mise-detected java tooling for gradle mode', async () => {
    const project = await makeTempProject({ '.java-version': '21\n' });

    try {
      mockGetInput({
        mode: 'gradle',
        'working-directory': project,
      });
      mockGetBooleanInput({});

      await restoreRun();

      expect(actionCoreMocks.installMiseTool).toHaveBeenCalledWith('java', '21', { label: 'Java' });
      expect(actionCoreMocks.startRegistryProxy).toHaveBeenCalledWith(expect.objectContaining({
        command: 'cache-registry',
        onDemand: false,
      }));
      expect(core.setOutput).toHaveBeenCalledWith('resolved-mode', 'gradle');
    } finally {
      await removeTempProject(project);
    }
  });

  it('writes Maven build-cache config and detects Java/Maven tooling', async () => {
    const project = await makeTempProject({
      '.java-version': '21\n',
      '.mvn/wrapper/maven-wrapper.properties': 'distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip\n',
    });

    try {
      mockGetInput({
        mode: 'maven',
        'working-directory': project,
      });
      mockGetBooleanInput({});

      await restoreRun();

      expect(actionCoreMocks.installMiseTool).toHaveBeenCalledWith('java', '21', { label: 'Java' });
      expect(actionCoreMocks.installMiseTool).toHaveBeenCalledWith('maven', '3.9.9', { label: 'Maven' });
      expect(actionCoreMocks.startRegistryProxy).toHaveBeenCalledWith(expect.objectContaining({
        command: 'cache-registry',
        onDemand: false,
      }));
      expect(core.setOutput).toHaveBeenCalledWith('resolved-mode', 'maven');
      expect(core.setOutput).toHaveBeenCalledWith(
        'maven-build-cache-config-path',
        path.join(project, '.mvn', 'maven-build-cache-config.xml'),
      );
    } finally {
      await removeTempProject(project);
    }
  });

  it('uses the CLI bazel planner workspace and proxy settings from repo config', async () => {
    const project = await makeTempProject({
      '.boringcache.toml': [
        'workspace = "config-org/config-workspace"',
        '',
        '[adapters.bazel]',
        'tag = "bazel-main"',
        'no-platform = true',
        'no-git = true',
        'read-only = true',
        '',
      ].join('\n'),
    });
    const home = await fs.mkdtemp(path.join(os.tmpdir(), 'boringcache-one-bazel-home-'));

    try {
      process.env.HOME = home;
      actionCoreMocks.startRegistryProxy.mockResolvedValueOnce({ pid: 4321, port: 5000 });
      mockGetInput({
        mode: 'bazel',
        'working-directory': project,
      });
      mockGetBooleanInput({});

      await restoreRun();

      expect(actionCoreMocks.startRegistryProxy).toHaveBeenCalledWith(expect.objectContaining({
        command: 'cache-registry',
        workspace: 'config-org/config-workspace',
        tag: 'bazel-main',
        noPlatform: true,
        noGit: true,
        readOnly: true,
        onDemand: false,
      }));
      const bazelrc = await fs.readFile(path.join(home, '.bazelrc'), 'utf8');
      expect(bazelrc).toContain('build --remote_upload_local_results=false');
      expect(core.setOutput).toHaveBeenCalledWith('cache-tag', 'bazel-main');
      expect(core.setOutput).toHaveBeenCalledWith('workspace', 'config-org/config-workspace');
    } finally {
      await removeTempProject(home);
      await removeTempProject(project);
    }
  });

  it('fails gradle mode when the CLI planner cannot resolve the plan', async () => {
    const project = await makeTempProject({ '.java-version': '21\n' });

    try {
      (exec.exec as jest.Mock).mockImplementation(async (
        command: string,
        args?: string[],
        options?: { listeners?: { stdout?: (data: Buffer) => void } },
      ) => {
        void options;
        if (command === 'boringcache' && args?.[0] === 'gradle' && args.includes('--dry-run') && args.includes('--json')) {
          return 1;
        }
        return 0;
      });

      mockGetInput({
        mode: 'gradle',
        'working-directory': project,
        workspace: 'my-org/my-project',
      });
      mockGetBooleanInput({});

      await restoreRun();

      expect(core.setFailed).toHaveBeenCalledWith(
        'boringcache/one restore failed: boringcache gradle --dry-run --json exited with code 1',
      );
      expect(actionCoreMocks.startRegistryProxy).not.toHaveBeenCalled();
    } finally {
      await removeTempProject(project);
    }
  });

  it('configures turbo proxy mode and exports turbo env', async () => {
    const project = await makeTempProject({
      '.node-version': '22.4.1\n',
      'package.json': '{"name":"demo","packageManager":"pnpm@9.15.1"}\n',
      'pnpm-lock.yaml': 'lockfileVersion: 9.0\n',
    });

    try {
      mockGetInput({
        mode: 'turbo-proxy',
        'working-directory': project,
      });
      mockGetBooleanInput({});

      await restoreRun();

      expect(actionCoreMocks.installMiseTool).toHaveBeenCalledWith('node', '22.4.1', { label: 'Node.js' });
      expect(actionCoreMocks.installMiseTool).toHaveBeenCalledWith('pnpm', '9.15.1', { label: 'pnpm' });
      expect(actionCoreMocks.startRegistryProxy).toHaveBeenCalled();
      expect(core.exportVariable).toHaveBeenCalledWith('TURBO_API', 'http://127.0.0.1:5000');
      expect(core.exportVariable).toHaveBeenCalledWith('PNPM_STORE_DIR', path.join(project, '.pnpm-store'));
      expect(core.setOutput).toHaveBeenCalledWith('package-manager', 'pnpm');
      expect(core.setOutput).toHaveBeenCalledWith('resolved-mode', 'turbo-proxy');
    } finally {
      await removeTempProject(project);
    }
  });

  it('respects an existing package-manager cache dir in turbo proxy mode', async () => {
    const project = await makeTempProject({
      '.node-version': '22.4.1\n',
      'package.json': '{"name":"demo","packageManager":"pnpm@9.15.1"}\n',
      'pnpm-lock.yaml': 'lockfileVersion: 9.0\n',
    });

    try {
      process.env.PNPM_STORE_DIR = path.join(project, '.bench-pnpm-store');

      mockGetInput({
        mode: 'turbo-proxy',
        'working-directory': project,
      });
      mockGetBooleanInput({});

      await restoreRun();

      expect(core.exportVariable).toHaveBeenCalledWith('PNPM_STORE_DIR', process.env.PNPM_STORE_DIR);
      expect(core.setOutput).toHaveBeenCalledWith('package-manager-cache-dir', process.env.PNPM_STORE_DIR);
    } finally {
      await removeTempProject(project);
    }
  });

  it('uses the CLI turbo planner tag from repo config', async () => {
    const project = await makeTempProject({
      '.boringcache.toml': 'workspace = "config-org/config-workspace"\n\n[adapters.turbo]\ntag = "turbo-main"\n',
      '.node-version': '22.4.1\n',
      'package.json': '{"name":"demo","packageManager":"pnpm@9.15.1"}\n',
      'pnpm-lock.yaml': 'lockfileVersion: 9.0\n',
    });

    try {
      mockGetInput({
        mode: 'turbo-proxy',
        'working-directory': project,
      });
      mockGetBooleanInput({});

      await restoreRun();

      expect(actionCoreMocks.startRegistryProxy).toHaveBeenCalledWith(expect.objectContaining({
        workspace: 'config-org/config-workspace',
        tag: 'turbo-main',
        onDemand: false,
      }));
      expect(core.setOutput).toHaveBeenCalledWith('cache-tag', 'turbo-main');
      expect(core.setOutput).toHaveBeenCalledWith('workspace', 'config-org/config-workspace');
    } finally {
      await removeTempProject(project);
    }
  });

  it('fails turbo proxy mode when the CLI planner cannot resolve the plan', async () => {
    const project = await makeTempProject({
      '.node-version': '22.4.1\n',
      'package.json': '{"name":"demo","packageManager":"pnpm@9.15.1"}\n',
      'pnpm-lock.yaml': 'lockfileVersion: 9.0\n',
    });

    try {
      (exec.exec as jest.Mock).mockImplementation(async (
        command: string,
        args?: string[],
        options?: { listeners?: { stdout?: (data: Buffer) => void } },
      ) => {
        void options;
        if (command === 'boringcache' && args?.[0] === 'turbo' && args.includes('--dry-run') && args.includes('--json')) {
          return 1;
        }
        return 0;
      });

      mockGetInput({
        mode: 'turbo-proxy',
        'working-directory': project,
        workspace: 'my-org/my-project',
      });
      mockGetBooleanInput({});

      await restoreRun();

      expect(core.setFailed).toHaveBeenCalledWith(
        'boringcache/one restore failed: boringcache turbo --dry-run --json exited with code 1',
      );
      expect(actionCoreMocks.startRegistryProxy).not.toHaveBeenCalled();
    } finally {
      await removeTempProject(project);
    }
  });

  it('supports rust mode with mise-managed tooling and proxy sccache', async () => {
    const project = await makeTempProject({
      'Cargo.lock': '',
      'rust-toolchain.toml': '[toolchain]\nchannel = "1.89.0"\n',
    });

    try {
      actionCoreMocks.hasToolVersionOnPath.mockImplementation(async (toolName: string) => toolName === 'sccache');

      mockGetInput({
        mode: 'rust-sccache',
        'working-directory': project,
        workspace: 'my-org/my-project',
        sccache: 'true',
        'sccache-mode': 'proxy',
      });
      mockGetBooleanInput({});

      await restoreRun();

      expect(actionCoreMocks.installMiseTool).toHaveBeenCalledWith('rust', '1.89.0', { label: 'Rust' });
      expect(actionCoreMocks.hasToolVersionOnPath).toHaveBeenCalledWith('sccache', '0.14.0');
      expect(exec.exec).not.toHaveBeenCalledWith('rustup', expect.anything(), expect.anything());
      expect(core.exportVariable).toHaveBeenCalledWith('CC', 'sccache cc');
      expect(core.exportVariable).toHaveBeenCalledWith('CXX', 'sccache c++');
      expect(exec.exec).toHaveBeenCalledWith(
        'boringcache',
        expect.arrayContaining([
          'run',
          'my-org/my-project',
          '--entry',
          'cargo-registry',
          '--entry',
          'target',
          '--entry',
          'sccache-dir',
          '--cache-tag',
          'rust',
          '--tool-tag-suffix',
          'rust1.89',
          '--dry-run',
          '--json',
        ]),
        expect.objectContaining({ cwd: project }),
      );
      const sccacheCheckCall = (exec.exec as jest.Mock).mock.calls.find(
        ([command, args]) => command === 'boringcache' && Array.isArray(args) && args.includes('check'),
      );
      expect(sccacheCheckCall?.[1]).toEqual(expect.arrayContaining([
        '--require-server-signature',
        '--fail-on-miss',
      ]));
      expect(core.setOutput).toHaveBeenCalledWith('sccache-hit', 'true');
      expect(core.setOutput).toHaveBeenCalledWith('resolved-mode', 'rust-sccache');
    } finally {
      await removeTempProject(project);
    }
  });

  it('treats a proxy sccache preflight miss as a miss', async () => {
    const project = await makeTempProject({
      'Cargo.lock': '',
      'rust-toolchain.toml': '[toolchain]\nchannel = "1.89.0"\n',
    });

    try {
      actionCoreMocks.hasToolVersionOnPath.mockImplementation(async (toolName: string) => toolName === 'sccache');
      actionCoreMocks.execBoringCache.mockImplementation(async (
        args: string[],
        options?: Parameters<typeof exec.exec>[2],
      ) => {
        if (args.includes('check')) {
          return 1;
        }
        return exec.exec('boringcache', args, options);
      });

      mockGetInput({
        mode: 'rust-sccache',
        'working-directory': project,
        workspace: 'my-org/my-project',
        sccache: 'true',
        'sccache-mode': 'proxy',
      });
      mockGetBooleanInput({});

      await restoreRun();

      const sccacheCheckCall = actionCoreMocks.execBoringCache.mock.calls.find(
        ([args]) => Array.isArray(args) && args.includes('check'),
      );
      expect(sccacheCheckCall?.[0]).toEqual(expect.arrayContaining([
        '--require-server-signature',
        '--fail-on-miss',
      ]));
      expect(core.setOutput).toHaveBeenCalledWith('sccache-hit', 'false');
    } finally {
      await removeTempProject(project);
    }
  });

  it('supports custom rust subcache tags', async () => {
    const project = await makeTempProject({
      'Cargo.lock': '[[package]]\nname = "git-dep"\nversion = "0.1.0"\nsource = "git+https://github.com/example/repo?rev=123456#123456"\n',
      'rust-toolchain.toml': '[toolchain]\nchannel = "1.89.0"\n',
    });

    try {
      actionCoreMocks.hasToolVersionOnPath.mockImplementation(async (toolName: string) => toolName === 'sccache');

      mockGetInput({
        mode: 'rust-sccache',
        'working-directory': project,
        workspace: 'my-org/my-project',
        sccache: 'true',
        'sccache-mode': 'proxy',
        'cargo-tag': 'zed-cargo-registry',
        'cargo-git-tag': 'zed-cargo-git',
        'target-tag': 'zed-target-rust1.89',
        'sccache-tag': 'zed-sccache-rust1.89-r123-a1',
      });
      mockGetBooleanInput({});

      await restoreRun();

      expect(actionCoreMocks.startRegistryProxy).toHaveBeenCalledWith(expect.objectContaining({
        command: 'cache-registry',
        tag: 'zed-sccache-rust1.89-r123-a1',
        onDemand: false,
      }));
      expect(core.setOutput).toHaveBeenCalledWith('cargo-tag', 'zed-cargo-registry');
      expect(core.setOutput).toHaveBeenCalledWith('cargo-git-tag', 'zed-cargo-git');
      expect(core.setOutput).toHaveBeenCalledWith('target-tag', 'zed-target-rust1.89');
      expect(core.setOutput).toHaveBeenCalledWith('sccache-tag', 'zed-sccache-rust1.89-r123-a1');
    } finally {
      await removeTempProject(project);
    }
  });

  it('treats a cargo-git restore hit as a mode cache hit', async () => {
    const project = await makeTempProject({
      'Cargo.lock': '[[package]]\nname = "git-dep"\nversion = "0.1.0"\nsource = "git+https://github.com/example/repo?rev=123456#123456"\n',
      'rust-toolchain.toml': '[toolchain]\nchannel = "1.89.0"\n',
    });

    try {
      const defaultExecImpl = (exec.exec as jest.Mock).getMockImplementation();
      (exec.exec as jest.Mock).mockImplementation(async (
        command: string,
        args?: string[],
        options?: { listeners?: { stdout?: (data: Buffer) => void; stderr?: (data: Buffer) => void } },
      ) => {
        if (command === 'boringcache' && args?.[0] === 'restore') {
          const entry = args[2] || '';
          if (entry.startsWith('rust-cargo-registry-rust1.89:')) {
            return 1;
          }
          if (entry.startsWith('rust-cargo-git-rust1.89:')) {
            return 0;
          }
          if (entry.startsWith('rust-target-rust1.89:')) {
            return 1;
          }
        }
        if (defaultExecImpl) {
          return defaultExecImpl(command, args, options);
        }
        return 0;
      });

      mockGetInput({
        mode: 'rust-sccache',
        'working-directory': project,
        workspace: 'my-org/my-project',
      });
      mockGetBooleanInput({});

      await restoreRun();

      expect(core.setOutput).toHaveBeenCalledWith('cargo-git-tag', 'rust-cargo-git-rust1.89');
      expect(core.setOutput).toHaveBeenCalledWith('cache-hit', 'true');
    } finally {
      await removeTempProject(project);
    }
  });
});
