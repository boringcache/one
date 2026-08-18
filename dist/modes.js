const MODE_SPECS = {
    archive: {
        resolved: 'archive',
        implemented: true,
        description: 'Opaque tar archive caching from a CLI-owned repo profile.',
    },
    docker: {
        resolved: 'docker',
        implemented: true,
        description: 'Docker layer and registry-backed cache integration.',
    },
    buildkit: {
        resolved: 'buildkit',
        implemented: true,
        description: 'BuildKit remote cache integration.',
    },
    bazel: {
        resolved: 'bazel',
        implemented: true,
        description: 'Bazel remote cache proxy integration.',
    },
    cargo: {
        resolved: 'cargo',
        implemented: true,
        description: 'Cargo target, dependency, and compiler cache lifecycle.',
    },
    ccache: {
        resolved: 'ccache',
        implemented: true,
        description: 'C and C++ ccache proxy integration.',
    },
    go: {
        resolved: 'go',
        implemented: true,
        description: 'Go GOCACHEPROG proxy integration.',
    },
    gradle: {
        resolved: 'gradle',
        implemented: true,
        description: 'Gradle build cache proxy integration.',
    },
    gha: {
        resolved: 'gha',
        implemented: true,
        description: 'GitHub Actions cache and artifact compatibility through a runner-local adapter.',
    },
    maven: {
        resolved: 'maven',
        implemented: true,
        description: 'Maven build cache proxy integration.',
    },
    nix: {
        resolved: 'nix',
        implemented: true,
        description: 'Nix HTTP binary-cache integration.',
    },
    nx: {
        resolved: 'nx',
        implemented: true,
        description: 'Nx self-hosted remote cache proxy integration.',
    },
    sccache: {
        resolved: 'sccache',
        implemented: true,
        description: 'Rust sccache proxy integration.',
    },
    turbo: {
        resolved: 'turbo',
        implemented: true,
        description: 'Turbo remote cache proxy integration.',
    },
    xcode: {
        resolved: 'xcode',
        implemented: true,
        description: 'Xcode and Swift/Clang compilation cache integration on macOS.',
    },
};
export function normalizeMode(value) {
    const normalized = (value || 'archive').trim().toLowerCase();
    switch (normalized) {
        case 'archive':
        case 'docker':
        case 'buildkit':
        case 'bazel':
        case 'cargo':
        case 'ccache':
        case 'go':
        case 'gradle':
        case 'gha':
        case 'maven':
        case 'nix':
        case 'nx':
        case 'sccache':
        case 'turbo':
        case 'xcode':
            return normalized;
        default:
            throw new Error(`Unsupported mode "${value}". Expected archive, docker, buildkit, bazel, cargo, ccache, gha, go, gradle, maven, nix, nx, sccache, turbo, or xcode.`);
    }
}
export function resolveModeSpec(mode) {
    const spec = MODE_SPECS[mode];
    return {
        requested: mode,
        ...spec,
    };
}
export function assertImplementedMode(modeSpec) {
    if (modeSpec.implemented) {
        return;
    }
    throw new Error(`mode=${modeSpec.resolved} is planned for boringcache/one but not implemented yet. ` +
        `Use the BoringCache CLI directly until this adapter lands.`);
}
