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
        command: 'docker-registry',
        workspace: 'boringcache/test-workspace',
      }));
      expect(exec.exec).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['buildx', 'build']),
        expect.any(Object),
      );
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
        command: 'docker-registry',
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
        command: 'docker-registry',
      }));
      const buildctlCall = (exec.exec as jest.Mock).mock.calls.find(
        ([command, args]) => command === 'buildctl' && Array.isArray(args) && args.includes('build'),
      );
      expect(buildctlCall).toBeTruthy();
      expect(buildctlCall?.[1]).toEqual(expect.arrayContaining(['--addr', 'tcp://buildkit:1234', 'build']));
      expect(core.setOutput).toHaveBeenCalledWith('resolved-mode', 'buildkit');
    } finally {
      await removeTempProject(project);
    }
  });

  it('uses mise-detected bazel tooling for bazel mode', async () => {
    const project = await makeTempProject({ '.bazelversion': '8.0.1\n' });

    try {
      mockGetInput({
        mode: 'bazel',
        'working-directory': project,
      });
      mockGetBooleanInput({});

      await restoreRun();

      expect(actionCoreMocks.installMiseTool).toHaveBeenCalledWith('bazel', '8.0.1', { label: 'Bazel' });
      expect(actionCoreMocks.startRegistryProxy).toHaveBeenCalledWith(expect.objectContaining({
        command: 'cache-registry',
      }));
      expect(core.setOutput).toHaveBeenCalledWith('resolved-mode', 'bazel');
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

  it('supports rust mode with mise-managed tooling and proxy sccache', async () => {
    const project = await makeTempProject({
      'Cargo.lock': '',
      'rust-toolchain.toml': '[toolchain]\nchannel = "1.89.0"\n',
    });

    try {
      actionCoreMocks.hasToolVersionOnPath.mockImplementation(async (toolName: string) => toolName === 'sccache');
      (exec.exec as jest.Mock).mockResolvedValue(0);

      mockGetInput({
        mode: 'rust-sccache',
        'working-directory': project,
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
      expect(core.setOutput).toHaveBeenCalledWith('resolved-mode', 'rust-sccache');
    } finally {
      await removeTempProject(project);
    }
  });

  it('supports custom rust subcache tags', async () => {
    const project = await makeTempProject({
      'Cargo.lock': '',
      'rust-toolchain.toml': '[toolchain]\nchannel = "1.89.0"\n',
    });

    try {
      actionCoreMocks.hasToolVersionOnPath.mockImplementation(async (toolName: string) => toolName === 'sccache');
      (exec.exec as jest.Mock).mockResolvedValue(0);

      mockGetInput({
        mode: 'rust-sccache',
        'working-directory': project,
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
      expect(core.setOutput).toHaveBeenCalledWith('target-tag', 'zed-target-rust1.89');
      expect(core.setOutput).toHaveBeenCalledWith('sccache-tag', 'zed-sccache-rust1.89-r123-a1');
    } finally {
      await removeTempProject(project);
    }
  });
});
