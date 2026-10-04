export function normalizeMode(value) {
    const normalized = (value || 'archive').trim().toLowerCase();
    switch (normalized) {
        case 'archive':
        case 'artifact':
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
            throw new Error(`Unsupported mode "${value}". Expected archive, artifact, docker, buildkit, bazel, cargo, ccache, gha, go, gradle, maven, nix, nx, sccache, turbo, or xcode.`);
    }
}
export function resolveModeSpec(mode) {
    return { requested: mode, resolved: mode };
}
