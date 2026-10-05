import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runNativeProcess } from '../core/native-process';
import { adapterVerificationSpecs, applyAdapterSetupPlan, checkDirectCacheTagStatus, execBoringCache, getModeState, planningReadOnly, readBoundedJsonObject, requireAdapterSetupPlan, resolveAdapterCliPlan, resolvePreferredPort, saveModeState, saveProxyModeState, setProxyOutputs, startPortableCacheProxy, stopProxyFromState, } from './shared';
export async function runReapiRestore(plan, inputs) {
    const mode = plan.mode;
    if (!['bazel-reapi', 'moon', 'pants', 'buck2', 'sbt'].includes(mode))
        throw new Error(`Expected a REAPI adapter, got ${mode}.`);
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const cliPlan = await resolveAdapterCliPlan(mode, plan.workspace, plan.workingDirectory, '', requestedPort, planningReadOnly(inputs), { failOnCacheError: inputs.failOnCacheError });
    if (cliPlan.proxy.protocol !== 'reapi')
        throw new Error(`boringcache ${mode} did not plan a REAPI proxy. Update the CLI and Action together.`);
    const setup = requireAdapterSetupPlan(mode, cliPlan.setup);
    const preflight = inputs.lookupOnly || inputs.failOnCacheMiss
        ? await checkDirectCacheTagStatus(cliPlan.workspace, cliPlan.tag, {
            noPlatform: cliPlan.proxy.no_platform, noGit: cliPlan.proxy.no_git, requireServerSignature: true,
        }) : null;
    if (inputs.failOnCacheMiss && !preflight?.kvHit)
        throw new Error(`No remote cache entries were found for ${mode}.`);
    saveModeState('proxy-pid', '');
    let nativeEvidence = null;
    if ((cliPlan.command || []).length > 0 && !inputs.lookupOnly) {
        const evidenceDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'boringcache-reapi-evidence-'));
        const evidenceFile = path.join(evidenceDirectory, 'cache.json');
        const args = [mode, '--workspace', cliPlan.workspace, '--port', String(cliPlan.proxy.port), cliPlan.proxy.read_only ? '--read-only' : '--write', '--native-tool-evidence-json', evidenceFile];
        if (inputs.failOnCacheError)
            args.push('--fail-on-cache-error');
        try {
            const exitCode = await execBoringCache(args, { cwd: plan.workingDirectory, ignoreReturnCode: true });
            nativeEvidence = readBoundedJsonObject(evidenceFile);
            if (exitCode !== 0)
                throw new Error(`boringcache ${mode} command exited with code ${exitCode}.`);
        }
        finally {
            fs.rmSync(evidenceDirectory, { recursive: true, force: true });
        }
        saveModeState('reapi-wrapped-command', 'true');
    }
    else if (!inputs.lookupOnly) {
        const cleanupFiles = (setup.cleanup_files || []).filter((file) => !fs.existsSync(file.path)
            || (file.mode === 'append' && !fs.readFileSync(file.path, 'utf8').includes(file.content)));
        saveModeState('reapi-setup', JSON.stringify({ ...setup, cleanup_files: cleanupFiles }));
        try {
            const proxy = await startPortableCacheProxy(cliPlan.workspace, cliPlan.proxy.port, cliPlan.tag, cliPlan.proxy.read_only, cliPlan.proxy, inputs.failOnCacheError);
            saveModeState('proxy-pid', String(proxy.pid));
            saveProxyModeState(proxy);
            applyAdapterSetupPlan(setup);
            if (mode === 'buck2')
                await execReapiShutdown('buck2', ['kill']);
            setProxyOutputs(proxy.port);
        }
        catch (error) {
            try {
                await stopProxyFromState();
            }
            finally {
                cleanupReapiSetup();
            }
            throw error;
        }
    }
    return { workspace: cliPlan.workspace, cacheTag: cliPlan.tag, cacheHit: inputs.lookupOnly ? preflight?.kvHit : undefined, verificationSpecs: adapterVerificationSpecs(cliPlan), evidence: { adapter_command: mode, protocol: 'reapi', preflight, native: nativeEvidence, setup: inputs.lookupOnly ? 'not-applied' : 'completed' } };
}
export async function execReapiShutdown(command, args) {
    if (getModeState('reapi-wrapped-command') === 'true' || !getModeState('proxy-pid'))
        return;
    if (command === 'buck2') {
        const setup = JSON.parse(getModeState('reapi-setup'));
        const isolationDir = setup.env_vars?.BUCK_ISOLATION_DIR;
        if (!isolationDir)
            throw new Error('The Buck2 setup plan did not specify its managed daemon directory.');
        args = ['--isolation-dir', isolationDir, ...args];
    }
    const result = await runNativeProcess(command, args, 30_000);
    if (result.exitCode !== 0)
        throw new Error(`${command} shutdown failed with ${result.signal || result.exitCode}.`);
}
export function cleanupReapiSetup() {
    const state = getModeState('reapi-setup');
    if (!state)
        return;
    const setup = JSON.parse(state);
    for (const file of setup.cleanup_files || []) {
        if (!fs.existsSync(file.path))
            continue;
        const current = fs.readFileSync(file.path, 'utf8');
        if (file.mode === 'append') {
            const cleaned = current.replace(file.content, '');
            if (cleaned !== current)
                fs.writeFileSync(file.path, cleaned);
        }
        else if (current === file.content) {
            fs.unlinkSync(file.path);
        }
    }
    for (const directory of setup.cleanup_directories || [])
        fs.rmSync(directory, { recursive: true, force: true });
}
