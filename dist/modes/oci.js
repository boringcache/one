import { adapterVerificationSpecs, appendCliPublicationPolicy, execBoringCache, proxyPlanningReadOnly, resolveAdapterCliPlan, resolvePreferredPort, runDockerBuildOperation, } from './shared';
/**
 * Docker and BuildKit are synchronous CLI lifecycles. The Action deliberately
 * does not model Buildx, buildctl, builders, image output, or cache refs. The
 * command comes from the same committed adapter plan used by a direct CLI run.
 */
async function runOciCliLifecycle(mode, plan, inputs) {
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const cliPlan = await resolveAdapterCliPlan(mode, plan.workspace, plan.workingDirectory, '', requestedPort, proxyPlanningReadOnly(inputs.readOnly), {
        failOnCacheError: inputs.failOnCacheError,
        stage: inputs.stage,
    });
    const args = [mode, '--workspace', cliPlan.workspace];
    if (cliPlan.proxy.port > 0) {
        args.push('--port', String(cliPlan.proxy.port));
    }
    if (inputs.stage) {
        args.push('--stage');
    }
    else {
        appendCliPublicationPolicy(args, cliPlan.proxy.read_only);
    }
    if (inputs.failOnCacheError) {
        args.push('--fail-on-cache-error');
    }
    const startedAt = Date.now();
    await runDockerBuildOperation(async () => {
        const exitCode = await execBoringCache(args, {
            cwd: plan.workingDirectory,
            ignoreReturnCode: true,
        });
        if (exitCode !== 0) {
            throw new Error(`boringcache ${mode} exited with code ${exitCode}`);
        }
    });
    return {
        workspace: cliPlan.workspace,
        cacheTag: cliPlan.tag,
        resolvedEntries: (cliPlan.archive_entries || [])
            .map((entry) => entry.tag_path_pair)
            .join('\n'),
        verificationSpecs: adapterVerificationSpecs(cliPlan),
        evidence: {
            command: cliPlan.command || [],
            command_executed: true,
            elapsed_seconds: Math.round((Date.now() - startedAt) / 100) / 10,
            buildkit_cache: cliPlan.buildkit_cache || {},
        },
    };
}
export async function runDockerRestore(plan, inputs) {
    return runOciCliLifecycle('docker', plan, inputs);
}
export async function runBuildkitRestore(plan, inputs) {
    return runOciCliLifecycle('buildkit', plan, inputs);
}
// Synchronous CLI modes complete restore, command, publication, and cleanup in
// the main entrypoint. Their post hooks intentionally have nothing to do.
export async function runDockerSave(_options = {}) { }
export async function runBuildkitSave(_options = {}) { }
