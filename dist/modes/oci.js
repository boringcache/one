import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { startRegistryProxy, } from '../core';
import { ensureAdapterTools } from '../core/managed-tools';
import { addLocalBinPaths, isPathInside } from '../core/paths';
import { actionProxyOptions, appendCliPublicationPolicy, appendMetadataHintArgs, execBoringCache, getModeState, normalizeDockerCommand, parseBooleanInput, parseList, parseMultiline, proxyPlanningReadOnly, resolveBuildkitCliPlan, resolveDockerCliPlan, resolvePreferredPort, runDockerBuildOperation, sanitizeBuilderToken, saveModeState, saveProxyModeState, saveSimpleCache, setProxyOutputs, stopProxyFromState, } from './shared';
import { buildKitCacheEvidence, buildKitCacheFromRefTags, effectiveBuildKitCacheImports, recordBuildKitCachePlanState, setBuildKitCacheOutputs, verifyOciPromotionRefsThenStopProxy, } from './oci-cache';
export const DOCKER_METADATA_FILE = path.join(os.tmpdir(), 'boringcache-one-docker-metadata.json');
export const BUILDKIT_METADATA_FILE = path.join(os.tmpdir(), 'boringcache-one-buildkit-metadata.json');
export const DEFAULT_MANAGED_BUILDKIT_IMAGE = 'ghcr.io/boringcache/buildkit@sha256:e46b92c02707107ab1e1396c7609f5a7b7949fbe72bdf4c00230436fbc62e42b';
export const DEFAULT_BINFMT_IMAGE = 'docker.io/tonistiigi/binfmt@sha256:400a4873b838d1b89194d982c45e5fb3cda4593fbfd7e08a02e76b03b21166f0';
export const EPHEMERAL_PRIVILEGED_RUNNER_ENV = 'BORINGCACHE_EPHEMERAL_PRIVILEGED_RUNNER';
export async function inspectDockerTemplate(containerName, template) {
    let output = '';
    const result = await exec.exec('docker', ['inspect', '-f', template, containerName], {
        ignoreReturnCode: true,
        silent: true,
        listeners: {
            stdout: (data) => {
                output += data.toString();
            },
        },
    });
    const value = output.trim();
    if (result !== 0 || !value || value === '<no value>') {
        return null;
    }
    return value;
}
export async function getContainerGateway(containerName) {
    const directGateway = await inspectDockerTemplate(containerName, '{{.NetworkSettings.Gateway}}');
    if (directGateway) {
        return directGateway;
    }
    const networkGateways = await inspectDockerTemplate(containerName, '{{range .NetworkSettings.Networks}}{{if .Gateway}}{{.Gateway}}{{"\\n"}}{{end}}{{end}}');
    if (networkGateways) {
        const firstGateway = networkGateways
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find(Boolean);
        if (firstGateway) {
            return firstGateway;
        }
    }
    core.warning(`Could not determine gateway for container ${containerName}, falling back to 172.17.0.1`);
    return '172.17.0.1';
}
export async function getContainerNetworkMode(containerName) {
    const networkMode = await inspectDockerTemplate(containerName, '{{.HostConfig.NetworkMode}}');
    if (!networkMode) {
        core.warning(`Could not determine network mode for container ${containerName}, assuming bridge`);
        return 'bridge';
    }
    return networkMode;
}
export function qemuInstallArchitectures(platforms) {
    const requestedPlatforms = parseList(platforms);
    if (requestedPlatforms.length === 0) {
        throw new Error('qemu=true requires at least one target in platforms.');
    }
    const nativeArchitecture = {
        x64: 'amd64',
        ia32: '386',
        mips64el: 'mips64le',
    }[process.arch] || process.arch;
    const installArchitectures = [];
    for (const platform of requestedPlatforms) {
        const [operatingSystem, architecture] = platform.split('/');
        if (operatingSystem !== 'linux' || !architecture) {
            throw new Error(`qemu=true supports explicit Linux OCI platforms such as linux/arm64; received "${platform}".`);
        }
        if (architecture !== nativeArchitecture && !installArchitectures.includes(architecture)) {
            installArchitectures.push(architecture);
        }
    }
    return installArchitectures;
}
export async function setupQemu(architectures) {
    if (architectures.length === 0) {
        core.info('QEMU setup skipped because every requested platform is native to this runner.');
        return;
    }
    const result = await exec.exec('docker', ['run', '--privileged', '--rm', DEFAULT_BINFMT_IMAGE, '--install', architectures.join(',')], { ignoreReturnCode: true });
    if (result !== 0) {
        throw new Error(`Failed to set up QEMU for multi-platform builds (exit ${result})`);
    }
}
export function assertPrivilegedRunnerPolicy(operation) {
    if (process.env.GITHUB_ACTIONS !== 'true') {
        return;
    }
    const runnerEnvironment = (process.env.RUNNER_ENVIRONMENT || '').trim();
    if (runnerEnvironment === 'github-hosted') {
        return;
    }
    if (process.env[EPHEMERAL_PRIVILEGED_RUNNER_ENV] === '1') {
        core.warning(`${operation} is using host-level privileges on a self-managed runner because `
            + `${EPHEMERAL_PRIVILEGED_RUNNER_ENV}=1. Destroy the single-tenant runner after this job.`);
        return;
    }
    const runnerDescription = runnerEnvironment === 'self-hosted'
        ? 'a self-hosted runner'
        : 'a runner whose environment could not be verified';
    throw new Error(`${operation} needs host-level privileges, so BoringCache will not run it on ${runnerDescription}. `
        + `Use a GitHub-hosted runner, or set ${EPHEMERAL_PRIVILEGED_RUNNER_ENV}=1 only when the `
        + 'self-hosted runner is single-tenant and destroyed after this job.');
}
export function buildxBuilderName() {
    const runId = String(process.env.GITHUB_RUN_ID || Date.now());
    const actionId = sanitizeBuilderToken(process.env.GITHUB_ACTION || 'one') || 'one';
    const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return `boringcache-${runId}-${actionId}-${uniqueSuffix}`;
}
export function hasDriverImageOpt(driverOpts) {
    return driverOpts.some((opt) => opt.trim().startsWith('image='));
}
export function managedBuildKitImage(input) {
    const image = input.trim() || DEFAULT_MANAGED_BUILDKIT_IMAGE;
    if (!/^[A-Za-z0-9./:@_-]+$/.test(image)) {
        throw new Error(`Unsupported managed-buildkit-image "${input}". Expected a Docker image reference.`);
    }
    if (image.includes('@') && !/@sha256:[a-f0-9]{64}$/.test(image)) {
        throw new Error(`Unsupported managed-buildkit-image "${input}". Digest references must use a 64-character lowercase sha256 digest.`);
    }
    return image;
}
export async function pullManagedBuildKitImage(image) {
    const pullResult = await exec.exec('docker', ['pull', image], { ignoreReturnCode: true });
    if (pullResult === 0) {
        return;
    }
    const inspectResult = await exec.exec('docker', ['image', 'inspect', image], {
        ignoreReturnCode: true,
        silent: true,
    });
    if (inspectResult === 0) {
        core.warning(`Could not refresh managed BuildKit image ${image}; using the local cached copy.`);
        return;
    }
    throw new Error(`Could not pull managed BuildKit image ${image}, and no local copy is available.`);
}
export async function setupBuildxBuilder(driver, driverOpts, buildkitdConfigInline, registryMode, useManagedBuildKitImage, managedImageInput) {
    const builderName = buildxBuilderName();
    let driverToUse = driver || 'docker-container';
    if (driverToUse === 'docker') {
        core.warning('Buildx driver "docker" does not support cache export; falling back to "docker-container".');
        driverToUse = 'docker-container';
    }
    const effectiveDriverOpts = [...driverOpts];
    if (useManagedBuildKitImage && driverToUse === 'docker-container' && !hasDriverImageOpt(effectiveDriverOpts)) {
        const image = managedBuildKitImage(managedImageInput);
        await pullManagedBuildKitImage(image);
        effectiveDriverOpts.push(`image=${image}`);
    }
    if (registryMode && driverToUse === 'docker-container' && !effectiveDriverOpts.some((opt) => opt.startsWith('network='))) {
        effectiveDriverOpts.push('network=host');
    }
    let configPath = '';
    if (buildkitdConfigInline.trim()) {
        configPath = path.join(os.tmpdir(), `buildkitd-${Date.now()}.toml`);
        fs.writeFileSync(configPath, buildkitdConfigInline);
    }
    const args = ['buildx', 'create', '--name', builderName, '--driver', driverToUse];
    for (const driverOpt of effectiveDriverOpts) {
        args.push('--driver-opt', driverOpt);
    }
    if (driverToUse === 'docker-container') {
        args.push('--buildkitd-flags', '--oci-worker-gc=false');
    }
    if (configPath) {
        args.push('--config', configPath);
    }
    args.push('--use');
    const createResult = await exec.exec('docker', args, { ignoreReturnCode: true });
    if (createResult !== 0) {
        throw new Error(`Failed to create buildx builder (exit ${createResult})`);
    }
    return builderName;
}
export async function cleanupBuildxBuilder(builderName) {
    if (!builderName) {
        return;
    }
    const removeResult = await exec.exec('docker', ['buildx', 'rm', '--force', builderName], {
        ignoreReturnCode: true,
    });
    if (removeResult !== 0) {
        core.warning(`Failed to remove buildx builder ${builderName} (exit ${removeResult})`);
    }
}
export async function getBuilderPlatforms(builderName) {
    let output = '';
    const result = await exec.exec('docker', ['buildx', 'inspect', builderName, '--bootstrap'], {
        ignoreReturnCode: true,
        silent: true,
        listeners: {
            stdout: (data) => {
                output += data.toString();
            },
        },
    });
    if (result !== 0) {
        return '';
    }
    const line = output.split('\n').find((value) => value.trim().startsWith('Platforms:'));
    return line ? line.replace('Platforms:', '').trim() : '';
}
export function dockerBuildxArgs(opts) {
    const args = ['buildx', 'build'];
    if (opts.builder) {
        args.push('--builder', opts.builder);
    }
    args.push('-f', opts.dockerfile);
    for (const tag of opts.tags) {
        args.push('-t', `${opts.image}:${tag}`);
    }
    for (const buildArg of opts.buildArgs) {
        args.push('--build-arg', buildArg);
    }
    for (const label of opts.labels) {
        args.push('--label', label);
    }
    for (const output of opts.outputs) {
        args.push('--output', output);
    }
    for (const secret of opts.secrets) {
        args.push('--secret', secret);
    }
    if (opts.target) {
        args.push('--target', opts.target);
    }
    if (opts.platforms) {
        args.push('--platform', opts.platforms);
    }
    if (opts.push) {
        args.push('--push');
    }
    if (opts.load) {
        args.push('--load');
    }
    if (opts.noCache) {
        args.push('--no-cache');
    }
    args.push(`--provenance=${opts.provenance}`);
    if (opts.sbom) {
        args.push('--sbom=true');
    }
    if (opts.cacheFrom?.length) {
        for (const cacheFrom of opts.cacheFrom) {
            args.push('--cache-from', cacheFrom);
        }
    }
    if (opts.cacheTo) {
        args.push('--cache-to', opts.cacheTo);
    }
    args.push('--metadata-file', DOCKER_METADATA_FILE);
    args.push('.');
    return args;
}
export function resolveDockerfilePath(workingDirectory, contextPath, dockerfileInput) {
    if (path.isAbsolute(dockerfileInput)) {
        return dockerfileInput;
    }
    const workingDirectoryCandidate = path.resolve(workingDirectory, dockerfileInput);
    if (fs.existsSync(workingDirectoryCandidate)) {
        return workingDirectoryCandidate;
    }
    return path.resolve(contextPath, dockerfileInput);
}
export async function buildDockerImage(opts) {
    const args = dockerBuildxArgs(opts);
    const result = await exec.exec('docker', args, {
        cwd: opts.context,
        env: {
            ...process.env,
            DOCKER_BUILDKIT: '1',
        },
    });
    if (result !== 0) {
        throw new Error(`docker buildx build failed with exit code ${result}`);
    }
}
export function ociAdapterCliArgsForAcceleratedBuild(adapter, workspace, cacheTag, port, proxyBindHost, refHost, inputs, command, commandArgs, mountCache) {
    const args = [adapter, '--workspace', workspace, '--tag', cacheTag];
    if (port > 0) {
        args.push('--port', String(port));
    }
    if (proxyBindHost.trim()) {
        args.push('--host', proxyBindHost.trim());
    }
    if (refHost.trim()) {
        args.push('--endpoint-host', refHost.trim());
    }
    if (inputs.stage) {
        args.push('--stage');
    }
    else {
        appendCliPublicationPolicy(args, inputs.readOnly);
    }
    for (const candidate of parseList(inputs.cacheCandidates)) {
        args.push('--candidate', candidate);
    }
    if (inputs.failOnCacheError) {
        args.push('--fail-on-cache-error');
    }
    if (adapter === 'docker') {
        for (const tool of parseList(inputs.dockerToolCache)) {
            args.push('--tool-cache', tool);
        }
        for (const target of parseList(inputs.dockerToolCacheTarget)) {
            args.push('--tool-cache-target', target);
        }
    }
    if (mountCache) {
        args.push('--mount-cache');
    }
    appendMetadataHintArgs(args, inputs.metadataHints);
    args.push('--', command, ...commandArgs);
    return args;
}
export async function buildDockerImageWithCliAdapter(workspace, cacheTag, port, proxyBindHost, refHost, inputs, opts, mountCache) {
    const dockerBuildArgs = dockerBuildxArgs({
        ...opts,
        cacheFrom: undefined,
        cacheTo: undefined,
    });
    const args = ociAdapterCliArgsForAcceleratedBuild('docker', workspace, cacheTag, port, proxyBindHost, refHost, inputs, 'docker', dockerBuildArgs, mountCache);
    const result = await execBoringCache(args, {
        cwd: opts.context,
        env: {
            ...process.env,
            DOCKER_BUILDKIT: '1',
            BORINGCACHE_MANAGED_BUILDKIT_IMAGE: managedBuildKitImage(inputs.managedBuildkitImage),
        },
    });
    if (result !== 0) {
        throw new Error(`boringcache docker failed with exit code ${result}`);
    }
}
export function readDockerMetadata() {
    if (!fs.existsSync(DOCKER_METADATA_FILE)) {
        return { imageId: '', digest: '' };
    }
    try {
        const data = JSON.parse(fs.readFileSync(DOCKER_METADATA_FILE, 'utf8'));
        return {
            imageId: data['containerimage.config.digest'] || '',
            digest: data['containerimage.digest'] || '',
        };
    }
    catch (error) {
        core.warning(`Failed to parse Docker metadata file: ${error.message}`);
        return { imageId: '', digest: '' };
    }
}
export function materializeBuildkitTlsFiles(inputs) {
    let temporaryDirectory = '';
    const workspaceRoot = path.resolve(process.cwd());
    const physicalWorkspaceRoot = fs.realpathSync(workspaceRoot);
    const cleanup = () => {
        if (!temporaryDirectory) {
            return;
        }
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
        temporaryDirectory = '';
    };
    const materialize = (value, filename) => {
        if (!value.trim()) {
            return '';
        }
        const candidate = path.resolve(workspaceRoot, value);
        // BuildKit TLS file inputs may name files only inside the checked-out workspace.
        // Absolute or parent-traversal values are treated as inline PEM content instead.
        const relativeCandidate = path.relative(workspaceRoot, candidate);
        let candidateStats;
        if (relativeCandidate === '..'
            || relativeCandidate.startsWith(`..${path.sep}`)
            || path.isAbsolute(relativeCandidate)) {
            core.warning(`Ignoring ${filename} path outside the workspace; treating input as inline content.`);
        }
        else {
            try {
                candidateStats = fs.lstatSync(candidate);
            }
            catch (error) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }
        }
        if (candidateStats) {
            if (candidateStats.isSymbolicLink() || !candidateStats.isFile()) {
                throw new Error(`BuildKit TLS ${filename} path must be a regular, non-symlink file inside the workspace.`);
            }
            const physicalCandidate = fs.realpathSync(candidate);
            if (!isPathInside(physicalWorkspaceRoot, physicalCandidate)) {
                throw new Error(`BuildKit TLS ${filename} path resolves outside the workspace.`);
            }
            return physicalCandidate;
        }
        if (!temporaryDirectory) {
            temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'boringcache-buildkit-tls-'));
            fs.chmodSync(temporaryDirectory, 0o700);
        }
        const target = path.join(temporaryDirectory, filename);
        // The unique private directory and exclusive create prevent a retained
        // runner from redirecting or recovering inline TLS material.
        // codeql[js/path-injection]
        fs.writeFileSync(target, value, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        return target;
    };
    try {
        return {
            tlsCa: materialize(inputs.ca, 'buildkit-ca.pem'),
            tlsCert: materialize(inputs.cert, 'buildkit-cert.pem'),
            tlsKey: materialize(inputs.key, 'buildkit-key.pem'),
            cleanup,
        };
    }
    catch (error) {
        cleanup();
        throw error;
    }
}
export async function buildWithMaterializedBuildkitTls(opts, inputs) {
    const tls = materializeBuildkitTlsFiles(inputs);
    try {
        await buildWithBuildctl({
            ...opts,
            tlsCa: tls.tlsCa,
            tlsCert: tls.tlsCert,
            tlsKey: tls.tlsKey,
        });
    }
    finally {
        tls.cleanup();
    }
}
export function buildctlArgs(opts) {
    const args = ['--addr', opts.addr];
    if (opts.tlsCa || opts.tlsCert || opts.tlsKey) {
        if (opts.tlsCa) {
            args.push('--tlscacert', opts.tlsCa);
        }
        if (opts.tlsCert) {
            args.push('--tlscert', opts.tlsCert);
        }
        if (opts.tlsKey) {
            args.push('--tlskey', opts.tlsKey);
        }
    }
    if (opts.tlsSkipVerify) {
        args.push('--tlsskipverify');
    }
    args.push('build', '--frontend', 'dockerfile.v0');
    args.push('--local', `context=${opts.contextPath}`);
    args.push('--local', `dockerfile=${opts.dockerfileDir}`);
    args.push('--opt', `filename=${opts.dockerfileName}`);
    if (opts.noCache) {
        args.push('--no-cache');
    }
    if (opts.platforms) {
        args.push('--opt', `platform=${opts.platforms}`);
    }
    if (opts.target) {
        args.push('--opt', `target=${opts.target}`);
    }
    for (const buildArg of opts.buildArgs) {
        args.push('--opt', `build-arg:${buildArg}`);
    }
    for (const secret of opts.secrets) {
        args.push('--secret', secret);
    }
    for (const ssh of opts.sshSpecs) {
        args.push('--ssh', ssh);
    }
    if (opts.importCache?.length) {
        for (const importCache of opts.importCache) {
            args.push('--import-cache', importCache);
        }
    }
    if (opts.exportCache) {
        args.push('--export-cache', opts.exportCache);
    }
    if (opts.output?.trim()) {
        args.push('--output', opts.output.trim());
    }
    else {
        const nameParams = opts.imageTags.map((tag) => `name=${tag}`).join(',');
        args.push('--output', `type=image,${nameParams},push=${opts.push ? 'true' : 'false'}`);
    }
    args.push('--metadata-file', opts.metadataFile);
    return args;
}
export async function buildWithBuildctl(opts) {
    const args = buildctlArgs(opts);
    const result = await exec.exec('buildctl', args);
    if (result !== 0) {
        throw new Error(`buildctl failed with exit code ${result}`);
    }
}
export function readBuildkitDigest(metadataFile) {
    if (!fs.existsSync(metadataFile)) {
        return '';
    }
    try {
        const data = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
        return data['containerimage.digest'] || '';
    }
    catch (error) {
        core.warning(`Failed to parse BuildKit metadata file: ${error.message}`);
        return '';
    }
}
export async function runDockerRestore(plan, inputs) {
    const context = path.resolve(plan.workingDirectory, core.getInput('context') || '.');
    const dockerfileInput = core.getInput('dockerfile') || 'Dockerfile';
    const dockerCommand = normalizeDockerCommand(core.getInput('docker-command'));
    const shouldBuild = dockerCommand !== 'setup';
    const dockerfile = shouldBuild
        ? resolveDockerfilePath(plan.workingDirectory, context, dockerfileInput)
        : dockerfileInput;
    const imageInput = core.getInput('image') || '';
    const image = shouldBuild
        ? core.getInput('image', { required: true })
        : (imageInput || 'boringcache/docker-setup');
    const buildArgs = parseMultiline(core.getInput('build-args') || '');
    const labels = parseMultiline(core.getInput('labels') || '');
    const outputs = parseMultiline(core.getInput('outputs') || '');
    const tags = parseList(core.getInput('tags') || (outputs.length === 0 ? 'latest' : ''));
    const secrets = parseMultiline(core.getInput('secrets') || '');
    const dockerToolCache = inputs.dockerToolCache;
    const dockerToolCaches = parseList(dockerToolCache);
    const target = core.getInput('target') || '';
    const platforms = parseList(core.getInput('platforms') || '').join(',');
    const qemu = parseBooleanInput(core.getInput('qemu'), 'qemu', false);
    const qemuArchitectures = qemu ? qemuInstallArchitectures(platforms) : [];
    const push = parseBooleanInput(core.getInput('push'), 'push', false);
    const load = parseBooleanInput(core.getInput('load'), 'load', true)
        && parseList(platforms).length <= 1
        && outputs.length === 0;
    const noCache = parseBooleanInput(core.getInput('no-cache'), 'no-cache', false);
    const provenance = parseBooleanInput(core.getInput('provenance'), 'provenance', false);
    const sbom = parseBooleanInput(core.getInput('sbom'), 'sbom', false);
    const dockerMountCache = parseBooleanInput(core.getInput('docker-mount-cache'), 'docker-mount-cache', false);
    const driver = core.getInput('driver') || 'docker-container';
    const driverOpts = parseMultiline(core.getInput('driver-opts') || '');
    const buildkitdConfigInline = core.getInput('buildkitd-config-inline') || '';
    const cliOwnsManagedBuild = shouldBuild;
    if (cliOwnsManagedBuild) {
        assertPrivilegedRunnerPolicy('Managed BoringCache BuildKit');
    }
    if (qemuArchitectures.length > 0) {
        assertPrivilegedRunnerPolicy('QEMU/binfmt registration');
    }
    if (dockerToolCaches.length > 0 && !shouldBuild) {
        throw new Error('docker-tool-cache requires docker-command=build so boringcache docker can inject the BuildKit secret.');
    }
    if (dockerMountCache && !shouldBuild) {
        throw new Error('docker-mount-cache requires mode=docker with docker-command=build so boringcache docker can install and authenticate the cache-mount worker.');
    }
    const requestedCacheTag = '';
    let modeEvidence;
    let resolvedWorkspace = plan.workspace;
    let resolvedCacheTag = '';
    saveModeState('workspace', plan.workspace);
    saveModeState('verbose', String(inputs.verbose));
    if (qemu) {
        await setupQemu(qemuArchitectures);
    }
    let builderName = '';
    if (cliOwnsManagedBuild) {
        if (driver !== 'docker-container') {
            throw new Error('BoringCache owns its managed BuildKit daemon; leave driver set to docker-container.');
        }
        if (driverOpts.length > 0 || buildkitdConfigInline.trim()) {
            throw new Error('BoringCache owns its managed BuildKit daemon for docker-command=build; '
                + 'use managed-buildkit-image instead of driver-opts and leave buildkitd-config-inline empty.');
        }
    }
    else {
        builderName = await setupBuildxBuilder(driver, driverOpts, buildkitdConfigInline, true, true, inputs.managedBuildkitImage);
    }
    saveModeState('builder-name', builderName);
    core.setOutput('buildx-name', builderName);
    core.setOutput('buildx-platforms', builderName ? await getBuilderPlatforms(builderName) : platforms);
    {
        let proxyBindHost = cliOwnsManagedBuild ? '' : '127.0.0.1';
        let refHost = cliOwnsManagedBuild ? '' : '127.0.0.1';
        if (!cliOwnsManagedBuild && driver === 'docker-container') {
            const containerName = `buildx_buildkit_${builderName}0`;
            const networkMode = await getContainerNetworkMode(containerName);
            if (networkMode !== 'host') {
                proxyBindHost = '0.0.0.0';
                refHost = await getContainerGateway(containerName);
            }
        }
        const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
        const dockerPlan = await resolveDockerCliPlan(plan.workspace, plan.workingDirectory, requestedCacheTag, requestedPort, proxyBindHost, refHost, proxyPlanningReadOnly(inputs.readOnly), inputs.failOnCacheError, inputs.metadataHints, dockerToolCache, inputs.stage, inputs.cacheCandidates, inputs.dockerToolCacheTarget, dockerMountCache);
        const requestedImportRefTags = buildKitCacheFromRefTags(dockerPlan.buildkit_cache);
        const cacheTag = dockerPlan.tag;
        const usesCliWrappedBuild = cliOwnsManagedBuild || dockerToolCaches.length > 0;
        if (usesCliWrappedBuild) {
            const planState = recordBuildKitCachePlanState(dockerPlan, cacheTag);
            resolvedWorkspace = planState.resolvedWorkspace;
            resolvedCacheTag = planState.resolvedCacheTag;
            const effectiveImports = effectiveBuildKitCacheImports(dockerPlan.buildkit_cache, undefined);
            setBuildKitCacheOutputs({
                ref: dockerPlan.buildkit_cache.cache_ref,
                from: effectiveImports.importSpecs,
                to: dockerPlan.buildkit_cache.cache_to,
                buildKitCache: dockerPlan.buildkit_cache,
                usedRefTags: effectiveImports.readableRefTags,
                unreadableRefTags: effectiveImports.unreadableRefTags,
                importReady: effectiveImports.importReady,
            });
            if (shouldBuild) {
                await runDockerBuildOperation(() => buildDockerImageWithCliAdapter(dockerPlan.workspace, dockerPlan.tag, requestedPort, proxyBindHost, refHost, inputs, {
                    dockerfile,
                    context,
                    image,
                    tags,
                    buildArgs,
                    labels,
                    outputs,
                    secrets,
                    target,
                    platforms,
                    push,
                    load,
                    noCache,
                    provenance,
                    sbom,
                    builder: cliOwnsManagedBuild ? '' : builderName,
                }, dockerMountCache));
            }
            modeEvidence = buildKitCacheEvidence('docker', dockerPlan.buildkit_cache, effectiveImports, dockerPlan.buildkit_cache.cache_to);
        }
        else {
            const proxy = await startRegistryProxy(actionProxyOptions({
                command: 'cache-registry',
                workspace: dockerPlan.workspace,
                tag: cacheTag,
                host: dockerPlan.proxy.host || proxyBindHost,
                port: dockerPlan.proxy.port,
                noGit: dockerPlan.proxy.no_git,
                noPlatform: dockerPlan.proxy.no_platform,
                verbose: inputs.verbose,
                readOnly: dockerPlan.proxy.read_only,
                stage: inputs.stage,
                candidateDigests: dockerPlan.buildkit_cache?.cache_from_candidate_digests || [],
                ociRequiredReadableRefs: requestedImportRefTags,
                ociAliasPromotionRefs: dockerPlan.buildkit_cache?.promotion_ref_tags || [],
            }, dockerPlan.proxy));
            saveModeState('proxy-pid', String(proxy.pid));
            saveProxyModeState(proxy);
            saveModeState('proxy-host', dockerPlan.proxy.host || proxyBindHost);
            saveModeState('proxy-no-git', String(dockerPlan.proxy.no_git));
            saveModeState('proxy-no-platform', String(dockerPlan.proxy.no_platform));
            saveModeState('oci-promotion-ref-tags', (dockerPlan.buildkit_cache?.promotion_ref_tags || []).join(','));
            setProxyOutputs(proxy.port);
            const planState = recordBuildKitCachePlanState(dockerPlan, cacheTag);
            resolvedWorkspace = planState.resolvedWorkspace;
            resolvedCacheTag = planState.resolvedCacheTag;
            const effectiveImports = effectiveBuildKitCacheImports(dockerPlan.buildkit_cache, proxy);
            setBuildKitCacheOutputs({
                ref: dockerPlan.buildkit_cache.cache_ref,
                from: effectiveImports.importSpecs,
                to: dockerPlan.buildkit_cache.cache_to,
                buildKitCache: dockerPlan.buildkit_cache,
                usedRefTags: effectiveImports.readableRefTags,
                unreadableRefTags: effectiveImports.unreadableRefTags,
                importReady: effectiveImports.importReady,
            });
            if (shouldBuild) {
                await runDockerBuildOperation(() => buildDockerImage({
                    dockerfile,
                    context,
                    image,
                    tags,
                    buildArgs,
                    labels,
                    outputs,
                    secrets,
                    target,
                    platforms,
                    push,
                    load,
                    noCache,
                    provenance,
                    sbom,
                    builder: builderName,
                    cacheFrom: effectiveImports.importSpecs,
                    cacheTo: dockerPlan.buildkit_cache.cache_to,
                }));
            }
            modeEvidence = buildKitCacheEvidence('docker', dockerPlan.buildkit_cache, effectiveImports, dockerPlan.buildkit_cache.cache_to);
        }
    }
    if (shouldBuild) {
        const { imageId, digest } = readDockerMetadata();
        core.setOutput('image-id', imageId);
        core.setOutput('digest', digest);
    }
    core.setOutput('workspace', resolvedWorkspace);
    core.setOutput('cache-tag', resolvedCacheTag);
    return {
        cacheTag: resolvedCacheTag,
        evidence: modeEvidence,
        // The CLI proxy owns OCI import and publication readiness. Generic
        // verification is for archive and direct-tool tags, not registry refs.
        verificationSpecs: [],
    };
}
export async function runDockerSave(options = {}) {
    const allowSaves = options.allowSaves !== false;
    const builderName = getModeState('builder-name');
    try {
        const proxyPid = getModeState('proxy-pid');
        if (proxyPid) {
            if (allowSaves) {
                await verifyOciPromotionRefsThenStopProxy(proxyPid);
            }
            else {
                await stopProxyFromState();
            }
            return;
        }
        if (!allowSaves) {
            return;
        }
        const workspace = getModeState('workspace');
        const cacheDir = getModeState('cache-dir');
        const cacheTag = getModeState('cache-tag');
        if (!workspace || !cacheDir || !cacheTag) {
            return;
        }
        addLocalBinPaths();
        await saveSimpleCache(workspace, cacheTag, cacheDir, {
            verbose: getModeState('verbose') === 'true',
        });
    }
    finally {
        await cleanupBuildxBuilder(builderName);
    }
}
export async function runBuildkitRestore(plan, inputs) {
    const contextInput = core.getInput('context') || '.';
    const contextPath = path.resolve(plan.workingDirectory, contextInput);
    const dockerfileInput = core.getInput('dockerfile') || 'Dockerfile';
    const dockerfilePath = path.resolve(plan.workingDirectory, contextInput, dockerfileInput);
    const dockerfileDir = path.dirname(dockerfilePath);
    const dockerfileName = path.basename(dockerfilePath);
    if (!fs.existsSync(contextPath)) {
        throw new Error(`Context path does not exist: ${contextPath}`);
    }
    if (!fs.existsSync(dockerfilePath)) {
        throw new Error(`Dockerfile does not exist: ${dockerfilePath}`);
    }
    const image = core.getInput('image', { required: true });
    const tags = parseList(core.getInput('tags') || 'latest');
    const imageTags = tags.length > 0 ? tags.map((tag) => `${image}:${tag}`) : [`${image}:latest`];
    const push = parseBooleanInput(core.getInput('push'), 'push', false);
    const output = core.getInput('output') || '';
    const buildArgs = parseMultiline(core.getInput('build-args') || '');
    const secrets = parseMultiline(core.getInput('secrets') || '');
    const sshSpecs = parseMultiline(core.getInput('ssh') || '');
    const target = core.getInput('target') || '';
    const platforms = parseList(core.getInput('platforms') || '').join(',');
    const noCache = parseBooleanInput(core.getInput('no-cache'), 'no-cache', false);
    const dockerMountCache = parseBooleanInput(core.getInput('docker-mount-cache'), 'docker-mount-cache', false);
    if (dockerMountCache) {
        throw new Error('docker-mount-cache requires mode=docker with docker-command=build; '
            + 'BuildKit mode connects to a workflow-owned daemon and cannot install the cache-mount worker.');
    }
    const buildkitHost = core.getInput('buildkit-host', { required: true });
    const tlsCaInput = core.getInput('buildkit-tls-ca') || '';
    const tlsCertInput = core.getInput('buildkit-tls-cert') || '';
    const tlsKeyInput = core.getInput('buildkit-tls-key') || '';
    const tlsSkipVerify = parseBooleanInput(core.getInput('buildkit-tls-skip-verify'), 'buildkit-tls-skip-verify', false);
    const requestedCacheTag = '';
    let modeEvidence;
    let resolvedWorkspace = plan.workspace;
    let resolvedCacheTag = '';
    saveModeState('workspace', plan.workspace);
    saveModeState('verbose', String(inputs.verbose));
    if (fs.existsSync(BUILDKIT_METADATA_FILE)) {
        fs.rmSync(BUILDKIT_METADATA_FILE);
    }
    await ensureAdapterTools('buildkit', {}, execBoringCache, plan.workingDirectory);
    {
        let proxyBindHost = '127.0.0.1';
        let refHost = '127.0.0.1';
        if (buildkitHost.startsWith('docker-container://')) {
            const containerName = buildkitHost.replace('docker-container://', '');
            const networkMode = await getContainerNetworkMode(containerName);
            if (networkMode !== 'host') {
                proxyBindHost = '0.0.0.0';
                refHost = await getContainerGateway(containerName);
            }
        }
        const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
        const dockerPlan = await resolveBuildkitCliPlan(plan.workspace, plan.workingDirectory, requestedCacheTag, requestedPort, proxyBindHost, refHost, proxyPlanningReadOnly(inputs.readOnly), inputs.failOnCacheError, inputs.metadataHints, inputs.stage, inputs.cacheCandidates);
        const requestedImportRefTags = buildKitCacheFromRefTags(dockerPlan.buildkit_cache);
        const cacheTag = dockerPlan.tag;
        const proxy = await startRegistryProxy(actionProxyOptions({
            command: 'cache-registry',
            workspace: dockerPlan.workspace,
            tag: cacheTag,
            host: dockerPlan.proxy.host || proxyBindHost,
            port: dockerPlan.proxy.port,
            noGit: dockerPlan.proxy.no_git,
            noPlatform: dockerPlan.proxy.no_platform,
            verbose: inputs.verbose,
            readOnly: dockerPlan.proxy.read_only,
            stage: inputs.stage,
            candidateDigests: dockerPlan.buildkit_cache?.cache_from_candidate_digests || [],
            ociRequiredReadableRefs: requestedImportRefTags,
            ociAliasPromotionRefs: dockerPlan.buildkit_cache?.promotion_ref_tags || [],
        }, dockerPlan.proxy));
        saveModeState('proxy-pid', String(proxy.pid));
        saveProxyModeState(proxy);
        saveModeState('proxy-host', dockerPlan.proxy.host || proxyBindHost);
        saveModeState('proxy-no-git', String(dockerPlan.proxy.no_git));
        saveModeState('proxy-no-platform', String(dockerPlan.proxy.no_platform));
        saveModeState('oci-promotion-ref-tags', (dockerPlan.buildkit_cache?.promotion_ref_tags || []).join(','));
        setProxyOutputs(proxy.port);
        const planState = recordBuildKitCachePlanState(dockerPlan, cacheTag);
        resolvedWorkspace = planState.resolvedWorkspace;
        resolvedCacheTag = planState.resolvedCacheTag;
        const effectiveImports = effectiveBuildKitCacheImports(dockerPlan.buildkit_cache, proxy);
        setBuildKitCacheOutputs({
            ref: dockerPlan.buildkit_cache.cache_ref,
            from: effectiveImports.importSpecs,
            to: dockerPlan.buildkit_cache.cache_to,
            buildKitCache: dockerPlan.buildkit_cache,
            usedRefTags: effectiveImports.readableRefTags,
            unreadableRefTags: effectiveImports.unreadableRefTags,
            importReady: effectiveImports.importReady,
        });
        await buildWithMaterializedBuildkitTls({
            addr: buildkitHost,
            tlsSkipVerify,
            contextPath,
            dockerfileDir,
            dockerfileName,
            buildArgs,
            secrets,
            sshSpecs,
            target,
            platforms,
            importCache: effectiveImports.importSpecs,
            exportCache: dockerPlan.buildkit_cache.cache_to,
            output,
            imageTags,
            push,
            noCache,
            metadataFile: BUILDKIT_METADATA_FILE,
        }, { ca: tlsCaInput, cert: tlsCertInput, key: tlsKeyInput });
        modeEvidence = buildKitCacheEvidence('buildkit', dockerPlan.buildkit_cache, effectiveImports, dockerPlan.buildkit_cache.cache_to);
    }
    core.setOutput('digest', readBuildkitDigest(BUILDKIT_METADATA_FILE));
    core.setOutput('workspace', resolvedWorkspace);
    core.setOutput('cache-tag', resolvedCacheTag);
    return {
        cacheTag: resolvedCacheTag,
        evidence: modeEvidence,
        // BuildKit uses the same CLI-owned OCI readiness boundary as Docker.
        verificationSpecs: [],
    };
}
export async function runBuildkitSave(options = {}) {
    const allowSaves = options.allowSaves !== false;
    const proxyPid = getModeState('proxy-pid');
    if (proxyPid) {
        if (allowSaves) {
            await verifyOciPromotionRefsThenStopProxy(proxyPid);
        }
        else {
            await stopProxyFromState();
        }
        return;
    }
    if (!allowSaves) {
        return;
    }
    const workspace = getModeState('workspace');
    const cacheDir = getModeState('cache-dir');
    const cacheTag = getModeState('cache-tag');
    if (!workspace || !cacheDir || !cacheTag) {
        return;
    }
    addLocalBinPaths();
    await saveSimpleCache(workspace, cacheTag, cacheDir, {
        verbose: getModeState('verbose') === 'true',
    });
}
