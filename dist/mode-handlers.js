import { cleanupNixRuntimeDirectory, drainNixUploads, runBazelRestore, runGoRestore, runGradleRestore, runMavenRestore, runNixRestore, runNxProxyRestore, runTurboProxyRestore, runXcodeRestore, shutdownBazelServer, } from './modes/adapters';
import { runCargoRestore } from './modes/cargo';
import { runCcacheRestore, runCcacheSave, runSccacheRestore, runSccacheSave, } from './modes/compiler-cache';
import { runGhaRestore } from './modes/gha';
import { runBuildkitRestore, runBuildkitSave, runDockerRestore, runDockerSave, } from './modes/oci';
import { stopProxyFromState, } from './modes/shared';
export async function runModeRestore(plan, inputs, options = {}) {
    switch (plan.mode) {
        case 'docker':
            return runDockerRestore(plan, inputs);
        case 'buildkit':
            return runBuildkitRestore(plan, inputs);
        case 'bazel':
            return runBazelRestore(plan, inputs, options);
        case 'cargo':
            return runCargoRestore(plan, inputs);
        case 'ccache':
            return runCcacheRestore(plan, inputs);
        case 'go':
            return runGoRestore(plan, inputs);
        case 'gradle':
            return runGradleRestore(plan, inputs, options);
        case 'gha':
            return runGhaRestore(plan, inputs);
        case 'maven':
            return runMavenRestore(plan, inputs, options);
        case 'nix':
            return runNixRestore(plan, inputs, options);
        case 'sccache':
            return runSccacheRestore(plan, inputs);
        case 'turbo':
            return runTurboProxyRestore(plan, inputs);
        case 'nx':
            return runNxProxyRestore(plan, inputs);
        case 'xcode':
            return runXcodeRestore(plan, inputs, options);
        case 'archive':
            return {};
    }
}
export async function runModeSave(mode, options = {}) {
    switch (mode) {
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
        case 'cargo':
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
