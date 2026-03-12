"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeMode = normalizeMode;
exports.resolveModeSpec = resolveModeSpec;
exports.assertImplementedMode = assertImplementedMode;
const MODE_SPECS = {
    archive: {
        resolved: 'archive',
        implemented: true,
        compatibilityWrappers: ['boringcache/action'],
        description: 'Portable archive caching and actions/cache compatibility.',
    },
    docker: {
        resolved: 'docker',
        implemented: true,
        compatibilityWrappers: ['boringcache/docker-action'],
        description: 'Docker layer and registry-backed cache integration.',
    },
    buildkit: {
        resolved: 'buildkit',
        implemented: true,
        compatibilityWrappers: ['boringcache/buildkit-action'],
        description: 'BuildKit remote cache integration.',
    },
    bazel: {
        resolved: 'bazel',
        implemented: true,
        compatibilityWrappers: ['boringcache/bazel-action'],
        description: 'Bazel remote cache proxy and archive integration.',
    },
    gradle: {
        resolved: 'gradle',
        implemented: true,
        compatibilityWrappers: ['boringcache/gradle-action'],
        description: 'Gradle build cache proxy integration.',
    },
    'rust-sccache': {
        resolved: 'rust-sccache',
        implemented: true,
        compatibilityWrappers: ['boringcache/rust-action'],
        description: 'Rust sccache proxy integration.',
    },
    'turbo-proxy': {
        resolved: 'turbo-proxy',
        implemented: true,
        compatibilityWrappers: ['boringcache/nodejs-action'],
        description: 'Turbo remote cache proxy integration.',
    },
};
function normalizeMode(value) {
    const normalized = (value || 'auto').trim().toLowerCase();
    switch (normalized) {
        case 'auto':
        case 'archive':
        case 'docker':
        case 'buildkit':
        case 'bazel':
        case 'gradle':
        case 'rust-sccache':
        case 'turbo-proxy':
            return normalized;
        default:
            throw new Error(`Unsupported mode "${value}". Expected auto, archive, docker, buildkit, bazel, gradle, rust-sccache, or turbo-proxy.`);
    }
}
function resolveModeSpec(mode) {
    const resolved = mode === 'auto' ? 'archive' : mode;
    const spec = MODE_SPECS[resolved];
    return {
        requested: mode,
        ...spec,
    };
}
function assertImplementedMode(modeSpec) {
    if (modeSpec.implemented) {
        return;
    }
    throw new Error(`mode=${modeSpec.resolved} is planned for boringcache/one but not implemented yet. ` +
        `Use ${modeSpec.compatibilityWrappers.join(' or ')} until this adapter lands.`);
}
