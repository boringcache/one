import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import { proxyStopTimeoutMs, startRegistryProxy, stopRegistryProxy, } from '../core';
import { detectNodePackageManager, } from '../utils';
import { actionProxyOptions, adapterVerificationSpecs, applyAdapterSetupPlan, captureCommand, checkDirectCacheProxyTagStatus, directCachePreflightEvidence, execBoringCache, exportEnvVars, getModeState, getModeStateBoolean, parseBooleanInput, prependExistingNixConfig, proxyPlanningReadOnly, requireAdapterSetupPlan, requireSetupDirectory, requireSetupFilePath, resolveAdapterCliPlan, resolvePreferredPort, rewritePlannedProxyPort, saveModeState, saveProxyModeState, setProxyOutputs, startPortableCacheProxyWithFallback, waitForArchiveMaterialization, } from './shared';
export async function shutdownBazelServer() {
    await exec.exec('bazel', ['shutdown'], {
        ignoreReturnCode: true,
        silent: true,
    });
}
export function turboEnvForStartedProxy(plan, actualPort) {
    const envVars = {};
    for (const [key, value] of Object.entries(plan.env_vars || {})) {
        envVars[key] = rewritePlannedProxyPort(value, plan.proxy.port, actualPort);
    }
    const endpointHost = plan.proxy.endpoint_host || '127.0.0.1';
    envVars.TURBO_API = `http://${endpointHost}:${actualPort}`;
    envVars.TURBO_TOKEN = envVars.TURBO_TOKEN || 'boringcache';
    envVars.TURBO_TEAM = envVars.TURBO_TEAM || 'boringcache';
    envVars.BORINGCACHE_PROXY_PORT = String(actualPort);
    return envVars;
}
export function nxEnvForStartedProxy(plan, actualPort) {
    const envVars = {};
    for (const [key, value] of Object.entries(plan.env_vars || {})) {
        envVars[key] = rewritePlannedProxyPort(value, plan.proxy.port, actualPort);
    }
    const endpointHost = plan.proxy.endpoint_host || '127.0.0.1';
    envVars.NX_SELF_HOSTED_REMOTE_CACHE_SERVER = `http://${endpointHost}:${actualPort}`;
    envVars.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN = envVars.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN || 'boringcache';
    envVars.BORINGCACHE_PROXY_PORT = String(actualPort);
    return envVars;
}
export function plannedNodePackageManagerCacheDir(packageManager, plan) {
    if (!packageManager) {
        return null;
    }
    switch (packageManager.name) {
        case 'pnpm':
            return plan.env_vars?.PNPM_STORE_DIR || plan.env_vars?.NPM_CONFIG_STORE_DIR || packageManager.cacheDir;
        case 'yarn':
            return plan.env_vars?.YARN_CACHE_FOLDER || packageManager.cacheDir;
        case 'npm':
            return plan.env_vars?.npm_config_cache || plan.env_vars?.NPM_CONFIG_CACHE || packageManager.cacheDir;
    }
}
export async function ensureCorepackPackageManager(workingDirectory, packageManager, runtimeTools) {
    if (!packageManager || packageManager.name === 'npm' || runtimeTools.some((tool) => tool.name === packageManager.name)) {
        return;
    }
    const corepackEnabled = await exec.exec('corepack', ['enable'], { cwd: workingDirectory, ignoreReturnCode: true });
    if (corepackEnabled !== 0) {
        core.notice(`corepack enable failed for ${packageManager.name}; continuing without corepack bootstrap`);
        return;
    }
    if (packageManager.packageManagerField) {
        await exec.exec('corepack', ['install'], { cwd: workingDirectory, ignoreReturnCode: true });
        return;
    }
    if (packageManager.version) {
        await exec.exec('corepack', ['prepare', `${packageManager.name}@${packageManager.version}`, '--activate'], { cwd: workingDirectory, ignoreReturnCode: true });
    }
}
export async function runBazelRestore(plan, inputs, options) {
    const inputVersion = core.getInput('bazel-version') || '';
    const bazelrcLines = core.getInput('bazelrc-lines') || '';
    const runtimeVersion = plan.runtimeTools.find((tool) => tool.name === 'bazel')?.version || '';
    const bazelVersion = inputVersion || runtimeVersion;
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const proxyPlan = await resolveAdapterCliPlan('bazel', plan.workspace, plan.workingDirectory, '', requestedPort, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
        bazelrcLines,
    });
    const workspace = proxyPlan.workspace;
    const cacheTag = proxyPlan.tag;
    const setup = requireAdapterSetupPlan('bazel', proxyPlan.setup);
    saveModeState('proxy-pid', '');
    if (bazelVersion) {
        core.exportVariable('USE_BAZEL_VERSION', bazelVersion);
    }
    const proxy = await startRegistryProxy(actionProxyOptions({
        command: 'cache-registry',
        workspace,
        tag: cacheTag,
        host: proxyPlan.proxy.host || '127.0.0.1',
        port: proxyPlan.proxy.port,
        noGit: proxyPlan.proxy.no_git,
        noPlatform: proxyPlan.proxy.no_platform,
        verbose: inputs.verbose,
        readOnly: proxyPlan.proxy.read_only,
    }, proxyPlan.proxy));
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy);
    await waitForArchiveMaterialization(options);
    applyAdapterSetupPlan(setup);
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('workspace', workspace);
    return {
        cacheTag,
        verificationSpecs: adapterVerificationSpecs(proxyPlan),
    };
}
export function configureGoProxyEnv(gocacheprog) {
    core.exportVariable('GOCACHEPROG', gocacheprog);
}
export function goCacheProgForProxy(proxyPlan, port) {
    const endpoint = `http://${proxyPlan.proxy.endpoint_host}:${port}`;
    const planned = proxyPlan.env_vars?.GOCACHEPROG?.trim();
    if (!planned) {
        return `boringcache go-cacheprog --endpoint ${endpoint}`;
    }
    if (planned.includes('--endpoint=')) {
        return planned.replace(/--endpoint=\S+/, `--endpoint=${endpoint}`);
    }
    if (planned.includes('--endpoint')) {
        return planned.replace(/--endpoint\s+\S+/, `--endpoint ${endpoint}`);
    }
    return `${planned} --endpoint ${endpoint}`;
}
export async function runGoRestore(plan, inputs) {
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const proxyPlan = await resolveAdapterCliPlan('go', plan.workspace, plan.workingDirectory, '', requestedPort, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
    });
    const workspace = proxyPlan.workspace;
    const cacheTag = proxyPlan.tag;
    const preflight = await checkDirectCacheProxyTagStatus(workspace, cacheTag, {
        noPlatform: proxyPlan.proxy.no_platform,
        noGit: proxyPlan.proxy.no_git,
    });
    saveModeState('proxy-pid', '');
    const proxy = await startRegistryProxy(actionProxyOptions({
        command: 'cache-registry',
        workspace,
        tag: cacheTag,
        host: proxyPlan.proxy.host || '127.0.0.1',
        port: proxyPlan.proxy.port,
        noGit: proxyPlan.proxy.no_git,
        noPlatform: proxyPlan.proxy.no_platform,
        verbose: inputs.verbose,
        readOnly: proxyPlan.proxy.read_only,
    }, proxyPlan.proxy));
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy);
    configureGoProxyEnv(goCacheProgForProxy(proxyPlan, proxy.port));
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('workspace', workspace);
    return {
        cacheHit: preflight.kvHit,
        cacheTag,
        evidence: directCachePreflightEvidence(preflight),
        verificationSpecs: adapterVerificationSpecs(proxyPlan),
    };
}
export async function runGradleRestore(plan, inputs, options) {
    const gradleHome = core.getInput('gradle-home') || '';
    const enableBuildCache = parseBooleanInput(core.getInput('enable-build-cache'), 'enable-build-cache', true);
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const proxyPlan = await resolveAdapterCliPlan('gradle', plan.workspace, plan.workingDirectory, '', requestedPort, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
        gradleHome,
        enableGradleBuildCache: enableBuildCache,
    });
    const workspace = proxyPlan.workspace;
    const cacheTag = proxyPlan.tag;
    const setup = requireAdapterSetupPlan('gradle', proxyPlan.setup);
    const preflight = await checkDirectCacheProxyTagStatus(workspace, cacheTag, {
        noPlatform: proxyPlan.proxy.no_platform,
        noGit: proxyPlan.proxy.no_git,
    });
    const proxy = await startRegistryProxy(actionProxyOptions({
        command: 'cache-registry',
        workspace,
        tag: cacheTag,
        host: proxyPlan.proxy.host || '127.0.0.1',
        port: proxyPlan.proxy.port,
        noGit: proxyPlan.proxy.no_git,
        noPlatform: proxyPlan.proxy.no_platform,
        verbose: inputs.verbose,
        readOnly: proxyPlan.proxy.read_only,
    }, proxyPlan.proxy));
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy);
    await waitForArchiveMaterialization(options);
    applyAdapterSetupPlan(setup);
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('workspace', workspace);
    return {
        cacheHit: preflight.kvHit,
        cacheTag,
        evidence: directCachePreflightEvidence(preflight),
        verificationSpecs: adapterVerificationSpecs(proxyPlan),
    };
}
export async function runMavenRestore(plan, inputs, options) {
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const mavenExtensionsPath = core.getInput('maven-extensions-path') || '';
    const mavenBuildCacheConfigPath = core.getInput('maven-build-cache-config-path') || '';
    const mavenLocalRepo = core.getInput('maven-local-repo') || '';
    const mavenBuildCacheExtensionVersion = core.getInput('maven-build-cache-extension-version') || '';
    const mavenBuildCacheId = core.getInput('maven-build-cache-id') || '';
    const proxyPlan = await resolveAdapterCliPlan('maven', plan.workspace, plan.workingDirectory, '', requestedPort, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
        mavenExtensionsPath,
        mavenBuildCacheConfigPath,
        mavenLocalRepo,
        mavenBuildCacheExtensionVersion,
        mavenBuildCacheId,
    });
    const workspace = proxyPlan.workspace;
    const cacheTag = proxyPlan.tag;
    const setup = requireAdapterSetupPlan('maven', proxyPlan.setup);
    const preflight = await checkDirectCacheProxyTagStatus(workspace, cacheTag, {
        noPlatform: proxyPlan.proxy.no_platform,
        noGit: proxyPlan.proxy.no_git,
    });
    const proxy = await startRegistryProxy(actionProxyOptions({
        command: 'cache-registry',
        workspace,
        tag: cacheTag,
        host: proxyPlan.proxy.host || '127.0.0.1',
        port: proxyPlan.proxy.port,
        noGit: proxyPlan.proxy.no_git,
        noPlatform: proxyPlan.proxy.no_platform,
        verbose: inputs.verbose,
        readOnly: proxyPlan.proxy.read_only,
    }, proxyPlan.proxy));
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy);
    await waitForArchiveMaterialization(options);
    applyAdapterSetupPlan(setup);
    const extensionsPath = requireSetupFilePath(setup, 'extensions.xml', 'maven extensions.xml');
    const buildCacheConfigPath = requireSetupFilePath(setup, 'maven-build-cache-config.xml', 'maven build-cache config');
    const localRepo = requireSetupDirectory(setup, 'maven local repository directory');
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('maven-extensions-path', extensionsPath);
    core.setOutput('maven-build-cache-config-path', buildCacheConfigPath);
    core.setOutput('maven-local-repo', localRepo);
    core.setOutput('workspace', workspace);
    return {
        cacheHit: preflight.kvHit,
        cacheTag,
        evidence: directCachePreflightEvidence(preflight),
        verificationSpecs: adapterVerificationSpecs(proxyPlan),
    };
}
export async function assertNixTrustedUser() {
    if (process.platform === 'win32') {
        throw new Error('mode=nix requires a Linux or macOS runner with Nix installed.');
    }
    const version = await captureCommand('nix', ['--version']);
    if (version.exitCode !== 0) {
        throw new Error(version.stderr || '`nix` was not found on PATH. Install Nix before boringcache/one.');
    }
    try {
        fs.accessSync('/nix/store', fs.constants.W_OK);
        return;
    }
    catch {
        // Multi-user Nix stores are normally daemon-owned. Check daemon trust.
    }
    const userResult = await captureCommand('id', ['-un']);
    const groupsResult = await captureCommand('id', ['-Gn']);
    const trustedResult = await captureCommand('nix', [
        '--extra-experimental-features',
        'nix-command',
        'config',
        'show',
        'trusted-users',
    ]);
    if (userResult.exitCode !== 0 || groupsResult.exitCode !== 0 || trustedResult.exitCode !== 0) {
        throw new Error(trustedResult.stderr
            || groupsResult.stderr
            || userResult.stderr
            || 'Unable to determine whether the runner is a trusted Nix user.');
    }
    const user = userResult.stdout;
    const groups = new Set(groupsResult.stdout.split(/\s+/).filter(Boolean));
    const trustedSetting = trustedResult.stdout.includes('=')
        ? trustedResult.stdout.slice(trustedResult.stdout.indexOf('=') + 1)
        : trustedResult.stdout;
    const trusted = trustedSetting.split(/\s+/).filter(Boolean).some((entry) => (entry === '*'
        || entry === user
        || (entry.startsWith('@') && groups.has(entry.slice(1)))));
    if (!trusted) {
        throw new Error(`mode=nix requires ${user || 'the runner user'} to be listed in Nix trusted-users so the per-job substituter and post-build hook reach the Nix daemon.`);
    }
}
export async function runNixRestore(plan, inputs, options) {
    await assertNixTrustedUser();
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const proxyPlan = await resolveAdapterCliPlan('nix', plan.workspace, plan.workingDirectory, '', requestedPort, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
        failOnCacheError: inputs.failOnCacheError,
    });
    const setup = requireAdapterSetupPlan('nix', proxyPlan.setup);
    prependExistingNixConfig(setup);
    const socketPath = proxyPlan.proxy.nix_hook_socket?.trim() || '';
    if (!proxyPlan.proxy.read_only && !socketPath) {
        throw new Error('boringcache nix setup plan did not include its upload socket');
    }
    const proxy = await startRegistryProxy(actionProxyOptions({
        command: 'cache-registry',
        workspace: proxyPlan.workspace,
        tag: proxyPlan.tag,
        host: proxyPlan.proxy.host || '127.0.0.1',
        port: proxyPlan.proxy.port,
        noGit: proxyPlan.proxy.no_git,
        noPlatform: proxyPlan.proxy.no_platform,
        verbose: inputs.verbose,
        readOnly: proxyPlan.proxy.read_only,
        nixHookSocket: socketPath || undefined,
    }, proxyPlan.proxy, inputs.failOnCacheError));
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy);
    saveModeState('nix-hook-socket', socketPath);
    saveModeState('nix-runtime-directory', setup.directories?.[0] || '');
    saveModeState('nix-fail-on-cache-error', String(inputs.failOnCacheError));
    await waitForArchiveMaterialization(options);
    applyAdapterSetupPlan(setup);
    core.setOutput('cache-tag', proxyPlan.tag);
    core.setOutput('workspace', proxyPlan.workspace);
    setProxyOutputs(proxy.port);
    return {
        cacheTag: proxyPlan.tag,
        verificationSpecs: adapterVerificationSpecs(proxyPlan),
    };
}
export async function runXcodeRestore(plan, inputs, options) {
    if (process.platform !== 'darwin') {
        throw new Error('mode=xcode requires a macOS runner with Xcode installed.');
    }
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const proxyPlan = await resolveAdapterCliPlan('xcode', plan.workspace, plan.workingDirectory, '', requestedPort, proxyPlanningReadOnly(inputs.readOnly), { metadataHintsInput: inputs.metadataHints });
    const setup = requireAdapterSetupPlan('xcode', proxyPlan.setup);
    const env = setup.env_vars || {};
    const socketPath = env.BORINGCACHE_XCODE_PROXY_SOCKET?.trim() || '';
    const upstreamPlugin = env.BORINGCACHE_XCODE_UPSTREAM_PLUGIN?.trim() || '';
    const casPath = env.BORINGCACHE_XCODE_CAS_PATH?.trim() || '';
    const evidencePath = env.BORINGCACHE_XCODE_EVIDENCE_JSON?.trim() || '';
    if (!socketPath || !upstreamPlugin || !casPath) {
        throw new Error('boringcache xcode setup plan did not include its Apple CAS bridge paths');
    }
    await waitForArchiveMaterialization(options);
    applyAdapterSetupPlan(setup);
    const proxy = await startRegistryProxy(actionProxyOptions({
        command: 'cache-registry',
        workspace: proxyPlan.workspace,
        tag: proxyPlan.tag,
        host: proxyPlan.proxy.host || '127.0.0.1',
        port: proxyPlan.proxy.port,
        noGit: proxyPlan.proxy.no_git,
        noPlatform: proxyPlan.proxy.no_platform,
        verbose: inputs.verbose,
        readOnly: proxyPlan.proxy.read_only,
        xcodeSocket: socketPath,
        xcodeUpstreamPlugin: upstreamPlugin,
        xcodeCasPath: casPath,
        xcodeEvidenceJson: evidencePath,
    }, proxyPlan.proxy, inputs.failOnCacheError));
    saveModeState('proxy-pid', String(proxy.pid));
    saveModeState('xcode-evidence-json', evidencePath);
    saveProxyModeState(proxy);
    core.setOutput('cache-tag', proxyPlan.tag);
    core.setOutput('workspace', proxyPlan.workspace);
    setProxyOutputs(proxy.port);
    return {
        cacheTag: proxyPlan.tag,
        evidence: {
            xcode: {
                version: env.BORINGCACHE_XCODE_VERSION || '',
                build: env.BORINGCACHE_XCODE_BUILD || '',
                plugin_sha256: env.BORINGCACHE_XCODE_PLUGIN_SHA256 || '',
                path_cohort: env.BORINGCACHE_XCODE_PATH_COHORT || '',
                derived_data_path: env.BORINGCACHE_XCODE_DERIVED_DATA_PATH || '',
                evidence_path: evidencePath,
            },
        },
        verificationSpecs: adapterVerificationSpecs(proxyPlan),
    };
}
export async function runTurboProxyRestore(plan, inputs) {
    const preferredPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const turboPlan = await resolveAdapterCliPlan('turbo', plan.workspace, plan.workingDirectory, '', preferredPort, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
    });
    const workspace = turboPlan.workspace;
    const cacheTag = turboPlan.tag;
    const packageManager = await detectNodePackageManager(plan.workingDirectory);
    const preflight = await checkDirectCacheProxyTagStatus(workspace, cacheTag, {
        noPlatform: turboPlan.proxy.no_platform,
        noGit: turboPlan.proxy.no_git,
    });
    const proxyPromise = startPortableCacheProxyWithFallback(workspace, turboPlan.proxy.port || preferredPort, cacheTag, turboPlan.proxy.read_only, turboPlan.proxy);
    const [proxyResult, corepackResult] = await Promise.allSettled([
        proxyPromise,
        ensureCorepackPackageManager(plan.workingDirectory, packageManager, plan.runtimeTools),
    ]);
    if (corepackResult.status === 'rejected') {
        if (proxyResult.status === 'fulfilled') {
            await stopRegistryProxy(proxyResult.value.pid, proxyResult.value.port, proxyStopTimeoutMs(proxyResult.value.shutdownBudgetSecs ?? null));
        }
        throw corepackResult.reason;
    }
    if (proxyResult.status === 'rejected') {
        throw proxyResult.reason;
    }
    const proxy = proxyResult.value;
    if (packageManager) {
        core.setOutput('package-manager', packageManager.name);
        core.setOutput('package-manager-cache-dir', plannedNodePackageManagerCacheDir(packageManager, turboPlan) || packageManager.cacheDir);
    }
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy);
    exportEnvVars(turboEnvForStartedProxy(turboPlan, proxy.port));
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('workspace', workspace);
    return {
        cacheHit: preflight.kvHit,
        cacheTag,
        evidence: directCachePreflightEvidence(preflight),
        verificationSpecs: adapterVerificationSpecs(turboPlan),
    };
}
export async function runNxProxyRestore(plan, inputs) {
    const preferredPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const nxPlan = await resolveAdapterCliPlan('nx', plan.workspace, plan.workingDirectory, '', preferredPort, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
    });
    const workspace = nxPlan.workspace;
    const cacheTag = nxPlan.tag;
    const preflight = await checkDirectCacheProxyTagStatus(workspace, cacheTag, {
        noPlatform: nxPlan.proxy.no_platform,
        noGit: nxPlan.proxy.no_git,
    });
    const proxy = await startPortableCacheProxyWithFallback(workspace, nxPlan.proxy.port || preferredPort, cacheTag, nxPlan.proxy.read_only, nxPlan.proxy);
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy);
    exportEnvVars(nxEnvForStartedProxy(nxPlan, proxy.port));
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('workspace', workspace);
    return {
        cacheHit: preflight.kvHit,
        cacheTag,
        evidence: directCachePreflightEvidence(preflight),
        verificationSpecs: adapterVerificationSpecs(nxPlan),
    };
}
export async function drainNixUploads() {
    const socketPath = getModeState('nix-hook-socket');
    if (!socketPath) {
        return;
    }
    const exitCode = await execBoringCache(['nix-hook', '--socket', socketPath, '--drain'], {
        ignoreReturnCode: true,
    });
    if (exitCode === 0) {
        return;
    }
    const message = `Nix cache upload drain failed with exit code ${exitCode}`;
    if (getModeStateBoolean('nix-fail-on-cache-error')) {
        throw new Error(message);
    }
    core.warning(message);
}
export function cleanupNixRuntimeDirectory() {
    const runtimeDirectory = getModeState('nix-runtime-directory');
    if (!runtimeDirectory) {
        return;
    }
    const normalized = path.normalize(runtimeDirectory);
    if (path.dirname(normalized) !== '/tmp' || !/^boringcache-nix-[A-Za-z0-9]{1,64}$/.test(path.basename(normalized))) {
        core.warning(`Refusing to remove unexpected Nix runtime directory ${runtimeDirectory}`);
        return;
    }
    fs.rmSync(normalized, { recursive: true, force: true });
}
