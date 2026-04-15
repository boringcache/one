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

      expect(actionCoreMocks.startRegistryProxy).toHaveBeenCalledWith(expect.objectContaining({
        command: 'cache-registry',
        workspace: 'boringcache/test-workspace',
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
      const cacheTagCalls = (core.setOutput as jest.Mock).mock.calls.filter(([name]) => name === 'cache-tag');
      expect(cacheTagCalls.at(-1)).toEqual(['cache-tag', 'ghcr-io-boringcache-demo']);
      expect(core.setOutput).toHaveBeenCalledWith('resolved-mode', 'docker');
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
      expect(core.setOutput).toHaveBeenCalledWith('sccache-hit', 'true');
      expect(core.setOutput).toHaveBeenCalledWith('resolved-mode', 'rust-sccache');
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
