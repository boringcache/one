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
    maven: {
        resolved: 'maven',
        implemented: true,
        description: 'Maven build cache proxy integration.',
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
};
export function normalizeMode(value) {
    const normalized = (value || 'archive').trim().toLowerCase();
    switch (normalized) {
        case 'archive':
        case 'docker':
        case 'buildkit':
        case 'bazel':
        case 'go':
        case 'gradle':
        case 'maven':
        case 'nx':
        case 'sccache':
        case 'turbo':
            return normalized;
        default:
            throw new Error(`Unsupported mode "${value}". Expected archive, docker, buildkit, bazel, go, gradle, maven, nx, sccache, or turbo.`);
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
