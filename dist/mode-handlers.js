import { cleanupNixRuntimeDirectory, drainNixUploads, runBazelRestore, runReapiRestore, cleanupReapiSetup, execReapiShutdown, runGoRestore, runGradleRestore, runMavenRestore, runNixRestore, runNxProxyRestore, runTurboProxyRestore, runXcodeRestore, shutdownBazelServer, } from './modes/adapters';
import { runCargoRestore, runCargoSave } from './modes/cargo';
import { runCcacheRestore, runCcacheSave, runSccacheRestore, runSccacheSave, } from './modes/compiler-cache';
import { runGhaRestore } from './modes/gha';
import { runBuildkitRestore, runBuildkitSave, runDockerRestore, runDockerSave, } from './modes/oci';
import { stopProxyFromState, } from './modes/shared';
export async function runModeRestore(plan, inputs) {
    switch (plan.mode) {
        case 'artifact':
            throw new Error('Artifact transfers must run through the synchronous Artifact lifecycle.');
        case 'docker':
            return runDockerRestore(plan, inputs);
        case 'buildkit':
            return runBuildkitRestore(plan, inputs);
        case 'bazel':
            return runBazelRestore(plan, inputs);
        case 'bazel-reapi':
        case 'moon':
        case 'pants':
        case 'buck2':
        case 'sbt':
            return runReapiRestore(plan, inputs);
        case 'cargo':
            return runCargoRestore(plan, inputs);
        case 'ccache':
            return runCcacheRestore(plan, inputs);
        case 'go':
            return runGoRestore(plan, inputs);
        case 'gradle':
            return runGradleRestore(plan, inputs);
        case 'gha':
            return runGhaRestore(plan, inputs);
        case 'maven':
            return runMavenRestore(plan, inputs);
        case 'nix':
            return runNixRestore(plan, inputs);
        case 'sccache':
            return runSccacheRestore(plan, inputs);
        case 'turbo':
            return runTurboProxyRestore(plan, inputs);
        case 'nx':
            return runNxProxyRestore(plan, inputs);
        case 'xcode':
            return runXcodeRestore(plan, inputs);
        case 'archive':
            return {};
    }
}
export async function runModeSave(mode, options = {}) {
    switch (mode) {
        case 'artifact':
            return;
        case 'docker':
            await runDockerSave(options);
            return;
        case 'buildkit':
            await runBuildkitSave(options);
            return;
        case 'bazel':
            await shutdownBazelServer();
            await stopProxyFromState();
            return;
        case 'bazel-reapi':
        case 'moon':
        case 'pants':
        case 'buck2':
        case 'sbt':
            try {
                if (mode === 'bazel-reapi')
                    await execReapiShutdown('bazel', ['shutdown']);
                if (mode === 'buck2')
                    await execReapiShutdown('buck2', ['kill']);
                if (mode === 'sbt')
                    await execReapiShutdown('sbt', ['shutdown']);
            }
            finally {
                try {
                    await stopProxyFromState();
                }
                finally {
                    cleanupReapiSetup();
                }
            }
            return;
        case 'cargo':
            await runCargoSave(options);
            return;
        case 'ccache':
            await runCcacheSave(options);
            return;
        case 'go':
            await stopProxyFromState();
            return;
        case 'gradle':
        case 'gha':
        case 'maven':
        case 'nx':
        case 'turbo':
        case 'xcode':
            await stopProxyFromState();
            return;
        case 'nix':
            try {
                await drainNixUploads();
            }
            finally {
                try {
                    await stopProxyFromState();
                }
                finally {
                    cleanupNixRuntimeDirectory();
                }
            }
            return;
        case 'sccache':
            await runSccacheSave(options);
            return;
        case 'archive':
            return;
    }
}
export { DockerBuildFailure } from './modes/shared';
