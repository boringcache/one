"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_OCI_HYDRATION_POLICY = exports.parseEntries = exports.installMiseTool = exports.installMise = exports.hasToolVersionOnPath = exports.hasMiseToolVersion = exports.getMiseInstallsDir = exports.execBoringCache = exports.exportMiseEnv = exports.ensureBoringCache = exports.activateMiseTool = void 0;
exports.getInputs = getInputs;
exports.isPullRequestEvent = isPullRequestEvent;
exports.saveConfigured = saveConfigured;
exports.saveAllowedForEvent = saveAllowedForEvent;
exports.saveSkippedByConfigurationMessage = saveSkippedByConfigurationMessage;
exports.saveSkippedByPolicyMessage = saveSkippedByPolicyMessage;
exports.applyPullRequestSaveScopeEnv = applyPullRequestSaveScopeEnv;
exports.applySaveTokenPolicy = applySaveTokenPolicy;
exports.readSavedSaveAllowance = readSavedSaveAllowance;
exports.readSavedSaveConfiguration = readSavedSaveConfiguration;
exports.normalizeSavePolicy = normalizeSavePolicy;
exports.normalizeDiagnosticsMode = normalizeDiagnosticsMode;
exports.normalizeDiagnosticsLogLines = normalizeDiagnosticsLogLines;
exports.normalizeOciHydrationPolicy = normalizeOciHydrationPolicy;
exports.resolveDiagnosticsConfig = resolveDiagnosticsConfig;
exports.loadDiagnosticsConfig = loadDiagnosticsConfig;
exports.runDiagnosticsGroup = runDiagnosticsGroup;
exports.readLogTail = readLogTail;
exports.normalizeVerifyMode = normalizeVerifyMode;
exports.normalizeVerifyTimeoutSeconds = normalizeVerifyTimeoutSeconds;
exports.normalizeSetup = normalizeSetup;
exports.normalizePreset = normalizePreset;
exports.normalizeToolVersionScope = normalizeToolVersionScope;
exports.resolveWorkspace = resolveWorkspace;
exports.resolveVerificationTags = resolveVerificationTags;
exports.buildGenericVerificationSpecs = buildGenericVerificationSpecs;
exports.verifyResolvedTags = verifyResolvedTags;
exports.verifyVerificationSpecs = verifyVerificationSpecs;
exports.parseToolSpecs = parseToolSpecs;
exports.resolveRuntimeTools = resolveRuntimeTools;
exports.detectNodePackageManager = detectNodePackageManager;
exports.buildRuntimeCacheTag = buildRuntimeCacheTag;
exports.buildRuntimeCacheEntry = buildRuntimeCacheEntry;
exports.resolveCliArchiveEntries = resolveCliArchiveEntries;
exports.buildArchiveEntries = buildArchiveEntries;
exports.validateOneInputs = validateOneInputs;
exports.buildPlan = buildPlan;
exports.getCacheTagPrefix = getCacheTagPrefix;
exports.buildFlagArgs = buildFlagArgs;
exports.applyMiseSetup = applyMiseSetup;
exports.applyPresetCacheEnv = applyPresetCacheEnv;
exports.serializeTools = serializeTools;
exports.getRestoreKeyCandidates = getRestoreKeyCandidates;
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const core_1 = require("./core");
Object.defineProperty(exports, "activateMiseTool", { enumerable: true, get: function () { return core_1.activateMiseTool; } });
Object.defineProperty(exports, "ensureBoringCache", { enumerable: true, get: function () { return core_1.ensureBoringCache; } });
Object.defineProperty(exports, "exportMiseEnv", { enumerable: true, get: function () { return core_1.exportMiseEnv; } });
Object.defineProperty(exports, "execBoringCache", { enumerable: true, get: function () { return core_1.execBoringCache; } });
Object.defineProperty(exports, "getMiseInstallsDir", { enumerable: true, get: function () { return core_1.getMiseInstallsDir; } });
Object.defineProperty(exports, "hasMiseToolVersion", { enumerable: true, get: function () { return core_1.hasMiseToolVersion; } });
Object.defineProperty(exports, "hasToolVersionOnPath", { enumerable: true, get: function () { return core_1.hasToolVersionOnPath; } });
Object.defineProperty(exports, "installMise", { enumerable: true, get: function () { return core_1.installMise; } });
Object.defineProperty(exports, "installMiseTool", { enumerable: true, get: function () { return core_1.installMiseTool; } });
Object.defineProperty(exports, "parseEntries", { enumerable: true, get: function () { return core_1.parseEntries; } });
const modes_1 = require("./modes");
exports.DEFAULT_OCI_HYDRATION_POLICY = 'metadata-only';
const TOOL_LABELS = {
    bazel: 'Bazel',
    bun: 'Bun',
    composer: 'Composer',
    elixir: 'Elixir',
    erlang: 'Erlang',
    go: 'Go',
    gradle: 'Gradle',
    java: 'Java',
    maven: 'Maven',
    node: 'Node.js',
    nodejs: 'Node.js',
    npm: 'npm',
    pnpm: 'pnpm',
    php: 'PHP',
    python: 'Python',
    ruby: 'Ruby',
    rust: 'Rust',
    turbo: 'Turbo',
    uv: 'uv',
    yarn: 'Yarn',
};
function getInputs() {
    return {
        cliVersion: core.getInput('cli-version') || 'v1.13.28',
        cliPlatform: core.getInput('cli-platform'),
        setup: normalizeSetup(core.getInput('setup')),
        mode: (0, modes_1.normalizeMode)(core.getInput('mode')),
        preset: normalizePreset(core.getInput('preset')),
        workspace: core.getInput('workspace'),
        cacheTag: core.getInput('cache-tag'),
        runtimeCacheTag: core.getInput('runtime-cache-tag'),
        workingDirectory: path.resolve(core.getInput('working-directory') || '.'),
        tools: core.getInput('tools'),
        toolVersionScope: normalizeToolVersionScope(core.getInput('tool-version-scope')),
        cacheRuntime: core.getBooleanInput('cache-runtime'),
        mavenVersion: core.getInput('maven-version') || '3.9.9',
        uvVersion: core.getInput('uv-version') || '0.9.21',
        composerVersion: core.getInput('composer-version') || '2.9.5',
        mavenLocalRepo: core.getInput('maven-local-repo') || '~/.m2/repository',
        readOnly: core.getBooleanInput('read-only'),
        savePolicy: normalizeSavePolicy(core.getInput('save-policy') || 'auto'),
        saveOnPullRequest: core.getBooleanInput('save-on-pull-request'),
        verify: normalizeVerifyMode(core.getInput('verify')),
        verifyTimeoutSeconds: normalizeVerifyTimeoutSeconds(core.getInput('verify-timeout-seconds')),
        verifyRequireServerSignature: core.getBooleanInput('verify-require-server-signature'),
        trustedWorkspaceSigningKeyFingerprint: core.getInput('trusted-workspace-signing-key-fingerprint'),
        diagnostics: normalizeDiagnosticsMode(core.getInput('diagnostics')),
        diagnosticsLogLines: normalizeDiagnosticsLogLines(core.getInput('diagnostics-log-lines')),
        metadataHints: core.getInput('metadata-hints'),
        proxyPort: core.getInput('proxy-port'),
        proxyNoGit: core.getBooleanInput('proxy-no-git'),
        proxyNoPlatform: core.getBooleanInput('proxy-no-platform'),
        ociHydration: normalizeOciHydrationPolicy(core.getInput('oci-hydration')),
        cacheProfiles: core.getInput('cache-profiles'),
        entries: core.getInput('entries'),
        path: core.getInput('path'),
        key: core.getInput('key'),
        restoreKeys: core.getInput('restore-keys'),
        enableCrossOsArchive: core.getBooleanInput('enableCrossOsArchive'),
        noPlatform: core.getBooleanInput('no-platform'),
        failOnCacheMiss: core.getBooleanInput('fail-on-cache-miss'),
        requireOciImportReady: core.getBooleanInput('require-oci-import-ready'),
        lookupOnly: core.getBooleanInput('lookup-only'),
        force: core.getBooleanInput('force'),
        verbose: core.getBooleanInput('verbose'),
        exclude: core.getInput('exclude'),
        allowExternalSymlinks: core.getBooleanInput('allow-external-symlinks'),
    };
}
function isPullRequestEvent() {
    return (process.env.GITHUB_EVENT_NAME || '').trim().toLowerCase() === 'pull_request';
}
function saveConfigured(inputs) {
    return inputs.savePolicy !== 'off';
}
function saveAllowedForEvent(inputs) {
    return !isPullRequestEvent() || inputs.saveOnPullRequest;
}
function saveSkippedByConfigurationMessage() {
    return 'Save skipped: save-policy is off; this step is restore-only by configuration.';
}
function saveSkippedByPolicyMessage() {
    return 'Save skipped: pull_request jobs stay restore-only by default. Set save-on-pull-request: true to allow writes.';
}
function applyPullRequestSaveScopeEnv() {
    process.env.BORINGCACHE_SAVE_ON_PULL_REQUEST = '1';
    process.env.BORINGCACHE_RESTORE_PR_CACHE = '1';
    core.exportVariable('BORINGCACHE_SAVE_ON_PULL_REQUEST', '1');
    core.exportVariable('BORINGCACHE_RESTORE_PR_CACHE', '1');
}
function applySaveTokenPolicy(inputs) {
    delete process.env.BORINGCACHE_SAVE_ON_PULL_REQUEST;
    if (isPullRequestEvent() && inputs.saveOnPullRequest) {
        applyPullRequestSaveScopeEnv();
    }
    const saveAllowed = saveAllowedForEvent(inputs);
    if (saveAllowed) {
        return true;
    }
    const restoreFallback = process.env.BORINGCACHE_RESTORE_TOKEN ||
        process.env.BORINGCACHE_SAVE_TOKEN ||
        process.env.BORINGCACHE_API_TOKEN;
    const hadSaveCapableToken = Boolean(process.env.BORINGCACHE_SAVE_TOKEN || process.env.BORINGCACHE_API_TOKEN);
    if (restoreFallback) {
        process.env.BORINGCACHE_RESTORE_TOKEN = restoreFallback;
    }
    delete process.env.BORINGCACHE_SAVE_TOKEN;
    delete process.env.BORINGCACHE_API_TOKEN;
    if (hadSaveCapableToken) {
        core.notice('pull_request detected: treating save-capable BoringCache tokens as restore-only. Set save-on-pull-request: true to allow writes.');
    }
    return false;
}
function readSavedSaveAllowance(inputs, savedValue) {
    if (!saveConfigured(inputs)) {
        return false;
    }
    if (savedValue === 'true') {
        return true;
    }
    if (savedValue === 'false') {
        return false;
    }
    return saveAllowedForEvent(inputs);
}
function readSavedSaveConfiguration(inputs, savedValue) {
    if (savedValue === 'true') {
        return true;
    }
    if (savedValue === 'false') {
        return false;
    }
    return saveConfigured(inputs);
}
function normalizeSavePolicy(value) {
    switch ((value || 'auto').trim().toLowerCase()) {
        case 'auto':
        case 'off':
            return (value || 'auto').trim().toLowerCase();
        default:
            throw new Error(`Unsupported save-policy "${value}". Expected auto or off.`);
    }
}
function normalizeDiagnosticsMode(value) {
    switch ((value || 'auto').trim().toLowerCase()) {
        case 'auto':
        case 'off':
        case 'summary':
        case 'verbose':
            return (value || 'auto').trim().toLowerCase();
        default:
            throw new Error(`Unsupported diagnostics mode "${value}". Expected auto, off, summary, or verbose.`);
    }
}
function normalizeDiagnosticsLogLines(value) {
    if (!value || !value.trim()) {
        return 40;
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error(`Unsupported diagnostics-log-lines "${value}". Expected a positive integer.`);
    }
    return parsed;
}
function normalizeOciHydrationPolicy(value) {
    switch ((value || exports.DEFAULT_OCI_HYDRATION_POLICY).trim().toLowerCase()) {
        case 'metadata-only':
        case 'bodies-before-ready':
        case 'bodies-background':
            return (value || exports.DEFAULT_OCI_HYDRATION_POLICY).trim().toLowerCase();
        default:
            throw new Error(`Unsupported oci-hydration "${value}". Expected metadata-only, bodies-before-ready, or bodies-background.`);
    }
}
function resolveDiagnosticsConfig(mode, logLines) {
    let level;
    switch (mode) {
        case 'auto':
            level = core.isDebug() ? 'verbose' : 'off';
            break;
        case 'off':
        case 'summary':
        case 'verbose':
            level = mode;
            break;
    }
    return {
        level,
        enabled: level !== 'off',
        includeLogs: level === 'verbose',
        logLines,
    };
}
function loadDiagnosticsConfig(inputs) {
    const savedLevel = (core.getState('diagnostics-level') || '').trim().toLowerCase();
    if (savedLevel === 'off' || savedLevel === 'summary' || savedLevel === 'verbose') {
        const savedLogLines = normalizeDiagnosticsLogLines((core.getState('diagnostics-log-lines') || '').trim() || String(inputs.diagnosticsLogLines));
        return {
            level: savedLevel,
            enabled: savedLevel !== 'off',
            includeLogs: savedLevel === 'verbose',
            logLines: savedLogLines,
        };
    }
    return resolveDiagnosticsConfig(inputs.diagnostics, inputs.diagnosticsLogLines);
}
async function runDiagnosticsGroup(diagnostics, title, fn) {
    if (!diagnostics.enabled) {
        return;
    }
    await core.group(title, fn);
}
function readLogTail(filePath, maxLines) {
    if (!filePath || maxLines < 1) {
        return [];
    }
    try {
        return fs.readFileSync(filePath, 'utf8')
            .split(/\r?\n/)
            .filter((line) => line.trim().length > 0)
            .slice(-maxLines);
    }
    catch {
        return [];
    }
}
function normalizeVerifyMode(value) {
    const normalized = (value || 'none').trim().toLowerCase();
    switch (normalized) {
        case 'none':
        case 'check':
        case 'wait':
        case 'warn':
            return normalized;
        default:
            throw new Error(`Unsupported verify mode "${value}". Expected none, check, wait, or warn.`);
    }
}
function normalizeVerifyTimeoutSeconds(value) {
    if (!value || !value.trim()) {
        return 180;
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error(`Unsupported verify-timeout-seconds "${value}". Expected a positive integer.`);
    }
    return parsed;
}
function normalizeSetup(value) {
    switch ((value || 'mise').trim().toLowerCase()) {
        case 'mise':
        case 'external':
        case 'none':
            return (value || 'mise').trim().toLowerCase();
        default:
            throw new Error(`Unsupported setup "${value}". Expected mise, external, or none.`);
    }
}
function normalizePreset(value) {
    switch ((value || 'none').trim().toLowerCase()) {
        case 'none':
        case 'rails':
        case 'ruby':
        case 'node':
        case 'node-turbo':
        case 'python-uv':
        case 'go':
        case 'php-composer':
            return (value || 'none').trim().toLowerCase();
        default:
            throw new Error(`Unsupported preset "${value}". Expected none, rails, ruby, node, node-turbo, python-uv, go, or php-composer.`);
    }
}
function normalizeToolVersionScope(value) {
    switch ((value || 'patch').trim().toLowerCase()) {
        case 'major':
        case 'minor':
        case 'patch':
            return (value || 'patch').trim().toLowerCase();
        default:
            throw new Error(`Unsupported tool-version-scope "${value}". Expected major, minor, or patch.`);
    }
}
function resolveWorkspace(workspace) {
    const resolved = workspace
        ? workspace.includes('/') ? workspace : `default/${workspace}`
        : (process.env.BORINGCACHE_DEFAULT_WORKSPACE || (0, core_1.getInputsWorkspace)({}));
    if (!resolved.includes('/')) {
        return `default/${resolved}`;
    }
    return resolved;
}
function expandUserPath(value) {
    if (value.startsWith('~/')) {
        return path.join(process.env.HOME || os.homedir(), value.slice(2));
    }
    return value;
}
function resolveWorkingPath(value, workingDirectory) {
    const expanded = expandUserPath(value);
    return path.isAbsolute(expanded) ? expanded : path.resolve(workingDirectory, expanded);
}
function normalizeRef(value) {
    let normalized = '';
    let lastWasDash = false;
    for (const rawChar of value.trim()) {
        const char = /[A-Za-z0-9]/.test(rawChar)
            ? rawChar.toLowerCase()
            : rawChar === '-' || rawChar === '_' || rawChar === '.'
                ? rawChar
                : '-';
        if (char === '-') {
            if (lastWasDash) {
                continue;
            }
            lastWasDash = true;
        }
        else {
            lastWasDash = false;
        }
        normalized += char;
        if (normalized.length >= 64) {
            break;
        }
    }
    const trimmed = normalized.replace(/^[-.]+|[-.]+$/g, '');
    return trimmed || 'unknown';
}
function isGitDisabledByEnv() {
    var _a;
    const value = (_a = process.env.BORINGCACHE_NO_GIT) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase();
    return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}
function shortenSha(sha) {
    return sha.trim().slice(0, 12);
}
function isCiEnv() {
    return Boolean(process.env.CI
        || process.env.GITHUB_ACTIONS
        || process.env.GITLAB_CI
        || process.env.CIRCLECI
        || process.env.BITBUCKET_BUILD_NUMBER);
}
function detectCiBranch() {
    var _a;
    for (const key of [
        'BORINGCACHE_GIT_BRANCH',
        'GITHUB_HEAD_REF',
        'GITHUB_REF_NAME',
        'CI_COMMIT_REF_NAME',
        'CI_COMMIT_BRANCH',
        'CIRCLE_BRANCH',
        'BITBUCKET_BRANCH',
    ]) {
        const value = (_a = process.env[key]) === null || _a === void 0 ? void 0 : _a.trim();
        if (value) {
            return normalizeRef(value);
        }
    }
    return undefined;
}
function detectCiSha() {
    var _a;
    for (const key of [
        'BORINGCACHE_GIT_SHA',
        'GITHUB_SHA',
        'CI_COMMIT_SHA',
        'CIRCLE_SHA1',
        'BITBUCKET_COMMIT',
    ]) {
        const value = (_a = process.env[key]) === null || _a === void 0 ? void 0 : _a.trim();
        if (value) {
            return value;
        }
    }
    return undefined;
}
function envDefaultBranch() {
    var _a;
    const value = (_a = process.env.BORINGCACHE_DEFAULT_BRANCH) === null || _a === void 0 ? void 0 : _a.trim();
    return value ? normalizeRef(value) : undefined;
}
function resolveGitStartPath(pathHint, workingDirectory) {
    const candidate = pathHint ? resolveWorkingPath(pathHint, workingDirectory) : workingDirectory;
    if (fs.existsSync(candidate)) {
        return fs.statSync(candidate).isDirectory() ? candidate : path.dirname(candidate);
    }
    const parent = path.dirname(candidate);
    if (parent && parent !== candidate) {
        return parent;
    }
    return workingDirectory;
}
function findGitDir(startPath) {
    let current = path.resolve(startPath);
    while (true) {
        const candidate = path.join(current, '.git');
        // Git discovery walks local parent directories from the checked-out workspace.
        // codeql[js/path-injection]
        if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
            return candidate;
        }
        // codeql[js/path-injection]
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            // codeql[js/path-injection]
            const contents = fs.readFileSync(candidate, 'utf-8');
            const rest = contents.startsWith('gitdir:') ? contents.slice('gitdir:'.length).trim() : '';
            if (rest) {
                return path.isAbsolute(rest) ? rest : path.join(current, rest);
            }
        }
        const parent = path.dirname(current);
        if (parent === current) {
            return null;
        }
        current = parent;
    }
}
function detectBranchFromHead(gitDir) {
    const headPath = path.join(gitDir, 'HEAD');
    // gitDir is discovered under the local checkout; HEAD is fixed Git metadata.
    // codeql[js/path-injection]
    if (!fs.existsSync(headPath)) {
        return undefined;
    }
    // codeql[js/path-injection]
    const contents = fs.readFileSync(headPath, 'utf-8').trim();
    if (!contents.startsWith('ref:')) {
        return undefined;
    }
    const reference = contents.slice('ref:'.length).trim();
    const branchRef = reference.startsWith('refs/heads/') ? reference.slice('refs/heads/'.length) : reference;
    return normalizeRef(branchRef);
}
function detectDefaultBranch(gitDir) {
    const originHead = path.join(gitDir, 'refs', 'remotes', 'origin', 'HEAD');
    // gitDir is discovered under the local checkout; origin/HEAD is fixed Git metadata.
    // codeql[js/path-injection]
    if (!fs.existsSync(originHead)) {
        return undefined;
    }
    // codeql[js/path-injection]
    const contents = fs.readFileSync(originHead, 'utf-8').trim();
    if (!contents.startsWith('ref:')) {
        return undefined;
    }
    const reference = contents.slice('ref:'.length).trim();
    const branchName = reference.split('/').at(-1);
    return branchName ? normalizeRef(branchName) : undefined;
}
function detectGitContext(pathHint, workingDirectory) {
    if (isGitDisabledByEnv()) {
        return {};
    }
    const startPath = resolveGitStartPath(pathHint, workingDirectory);
    const gitDir = findGitDir(startPath);
    const context = {};
    if (gitDir) {
        const gitBranch = detectBranchFromHead(gitDir);
        if (gitBranch) {
            context.branch = gitBranch;
            context.defaultBranch = detectDefaultBranch(gitDir);
        }
    }
    if (!context.branch) {
        context.branch = detectCiBranch();
    }
    const overriddenDefault = envDefaultBranch();
    if (overriddenDefault) {
        context.defaultBranch = overriddenDefault;
    }
    if (!context.commitSha && isCiEnv()) {
        context.commitSha = detectCiSha();
    }
    return context;
}
function tagHasExplicitChannel(tag) {
    return tag.includes('-branch-')
        || tag.includes('-sha-')
        || tag.endsWith('-main')
        || tag.endsWith('-master');
}
function isDefaultBranch(branch, defaultBranch) {
    return defaultBranch ? branch === defaultBranch : branch === 'main' || branch === 'master';
}
function hasPlatformSuffix(tag) {
    const lastPart = tag.split('-').at(-1);
    if (lastPart && ['x86_64', 'arm64', 'arm32', 'x86'].includes(lastPart)) {
        return true;
    }
    return [
        '-ubuntu-',
        '-debian-',
        '-alpine-',
        '-arch-',
        '-macos-',
        '-windows-',
        '-linux-',
    ].some((pattern) => tag.includes(pattern));
}
function detectPlatformSuffix() {
    const arch = process.arch === 'x64'
        ? 'x86_64'
        : process.arch === 'arm64'
            ? 'arm64'
            : process.arch === 'arm'
                ? 'arm32'
                : process.arch === 'ia32'
                    ? 'x86'
                    : process.arch;
    if (process.platform === 'linux') {
        for (const releasePath of ['/etc/os-release', '/usr/lib/os-release']) {
            if (!fs.existsSync(releasePath)) {
                continue;
            }
            const contents = fs.readFileSync(releasePath, 'utf-8');
            let distro = '';
            let version = '';
            for (const line of contents.split('\n')) {
                const [rawKey, rawValue] = line.split('=');
                if (!rawKey || rawValue === undefined) {
                    continue;
                }
                const value = rawValue.trim().replace(/^["']|["']$/g, '');
                if (rawKey === 'ID') {
                    distro = value.toLowerCase();
                }
                else if (rawKey === 'VERSION_ID') {
                    version = value;
                }
            }
            if (distro) {
                const major = version.split('.').at(0) || '';
                switch (distro) {
                    case 'ubuntu':
                        return `ubuntu-${major || '22'}-${arch}`;
                    case 'debian':
                        return `debian-${major || '11'}-${arch}`;
                    case 'alpine':
                        return `alpine-${major || '3'}-${arch}`;
                    case 'arch':
                        return `arch-rolling-${arch}`;
                    default:
                        return `${distro}-${major || '0'}-${arch}`;
                }
            }
        }
        return `linux-unknown-${arch}`;
    }
    if (process.platform === 'darwin') {
        return `macos-unknown-${arch}`;
    }
    if (process.platform === 'win32') {
        return `windows-11-${arch}`;
    }
    return `${process.platform}-unknown-${arch}`;
}
function resolveExactTag(spec, workingDirectory) {
    let resolved = spec.tag;
    if (!spec.noGit && !isGitDisabledByEnv() && !tagHasExplicitChannel(spec.tag)) {
        const gitContext = detectGitContext(spec.pathHint, workingDirectory);
        const branch = gitContext.branch ? normalizeRef(gitContext.branch) : undefined;
        const defaultBranch = gitContext.defaultBranch ? normalizeRef(gitContext.defaultBranch) : undefined;
        if (branch && !isDefaultBranch(branch, defaultBranch)) {
            resolved = `${resolved}-branch-${branch}`;
        }
        else if (!branch && gitContext.commitSha) {
            resolved = `${resolved}-sha-${shortenSha(gitContext.commitSha)}`;
        }
    }
    if (!spec.noPlatform && !hasPlatformSuffix(resolved)) {
        resolved = `${resolved}-${detectPlatformSuffix()}`;
    }
    return resolved;
}
function resolveVerificationTags(specs, workingDirectory) {
    const resolved = [];
    const seen = new Set();
    for (const spec of specs) {
        const exactTag = resolveExactTag(spec, workingDirectory);
        if (!seen.has(exactTag)) {
            seen.add(exactTag);
            resolved.push(exactTag);
        }
    }
    return resolved;
}
function appendVerificationSpecsFromEntries(specs, entries, noPlatform, noGit) {
    if (!entries.trim()) {
        return;
    }
    for (const entry of (0, core_1.parseEntries)(entries, 'restore')) {
        specs.push({
            tag: entry.tag,
            noPlatform,
            noGit,
            pathHint: entry.savePath,
            saveExpected: true,
        });
    }
}
function buildGenericVerificationSpecs(plan, inputs, includeRuntime) {
    const specs = [];
    const noPlatform = inputs.noPlatform || inputs.enableCrossOsArchive;
    if (includeRuntime && plan.runtimeEntry) {
        appendVerificationSpecsFromEntries(specs, plan.runtimeEntry, noPlatform, false);
    }
    appendVerificationSpecsFromEntries(specs, plan.archiveEntries, noPlatform, false);
    return specs;
}
function envWithOverrides(overrides) {
    const env = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
            env[key] = value;
        }
    }
    return { ...env, ...overrides };
}
function groupVerificationSpecs(specs) {
    const grouped = new Map();
    for (const spec of specs) {
        const key = `${spec.noPlatform ? '1' : '0'}:${spec.noGit ? '1' : '0'}`;
        const batch = grouped.get(key) || {
            tags: [],
            noPlatform: spec.noPlatform,
            noGit: spec.noGit,
            saveExpectedTags: new Set(),
        };
        if (!batch.tags.includes(spec.tag)) {
            batch.tags.push(spec.tag);
        }
        if (spec.saveExpected) {
            batch.saveExpectedTags.add(spec.tag);
        }
        grouped.set(key, batch);
    }
    return Array.from(grouped.values());
}
async function runTagCheck(workspace, batch, options) {
    const acceptedPendingTags = options.acceptPendingSaveExpected ? batch.saveExpectedTags : new Set();
    const shouldParseCheckJson = acceptedPendingTags.size > 0;
    const args = [];
    if (options.verbose) {
        args.push('--verbose');
    }
    if (options.requireServerSignature) {
        args.push('--require-server-signature');
    }
    args.push('check', workspace, batch.tags.join(','));
    if (batch.noPlatform) {
        args.push('--no-platform');
    }
    if (batch.noGit) {
        args.push('--no-git');
    }
    args.push('--exact', '--fail-on-miss');
    if (shouldParseCheckJson) {
        args.push('--json');
    }
    let stdout = '';
    let stderr = '';
    const execOptions = {
        ignoreReturnCode: true,
        silent: true,
        listeners: {
            stdout: (data) => {
                stdout += data.toString();
            },
            stderr: (data) => {
                stderr += data.toString();
            },
        },
    };
    if (!options.requireServerSignature) {
        execOptions.env = envWithOverrides({ BORINGCACHE_REQUIRE_SERVER_SIGNATURE: '0' });
    }
    const exitCode = await exec.exec('boringcache', args, execOptions);
    const result = { exitCode, stdout: stdout.trim(), stderr: stderr.trim() };
    if (result.exitCode !== 0 && shouldParseCheckJson) {
        const acceptedTags = pendingOnlyForAcceptedSaveTags(result.stdout, acceptedPendingTags);
        if (acceptedTags.length > 0) {
            core.info(`Accepted pending save verification for tags: ${acceptedTags.join(', ')}`);
            return { ...result, exitCode: 0 };
        }
    }
    return result;
}
function formatCheckFailure(result) {
    const details = [result.stderr, result.stdout].filter(Boolean).join('\n');
    return details || `boringcache check exited with code ${result.exitCode}`;
}
function pendingOnlyForAcceptedSaveTags(stdout, acceptedPendingTags) {
    if (!stdout.trim()) {
        return [];
    }
    let parsed;
    try {
        parsed = JSON.parse(stdout);
    }
    catch {
        return [];
    }
    if (!Array.isArray(parsed.results)) {
        return [];
    }
    const accepted = [];
    for (const result of parsed.results) {
        const status = (result.status || '').toLowerCase();
        if (status === 'hit') {
            continue;
        }
        const candidateTags = [result.requested_tag, result.tag].filter((tag) => Boolean(tag));
        const acceptedTag = candidateTags.find((tag) => acceptedPendingTags.has(tag));
        if ((status === 'pending' || status === 'uploading') && acceptedTag) {
            accepted.push(acceptedTag);
            continue;
        }
        return [];
    }
    return accepted;
}
async function verifyResolvedTags(workspace, exactTags, options) {
    const specs = exactTags.map((tag) => ({
        tag,
        noPlatform: true,
        noGit: true,
    }));
    return verifyVerificationSpecs(workspace, specs, options);
}
async function verifyVerificationSpecs(workspace, specs, options) {
    const batches = groupVerificationSpecs(specs);
    if (options.mode === 'none' || batches.length === 0) {
        return;
    }
    if (options.mode === 'check') {
        for (const batch of batches) {
            const result = await runTagCheck(workspace, batch, options);
            if (result.exitCode !== 0) {
                throw new Error(`Verification failed for tags ${batch.tags.join(', ')}: ${formatCheckFailure(result)}`);
            }
        }
        const total = batches.reduce((sum, batch) => sum + batch.tags.length, 0);
        core.info(`Verified ${total} tag${total === 1 ? '' : 's'} in ${workspace}`);
        return;
    }
    const warnOnly = options.mode === 'warn';
    const deadline = Date.now() + options.timeoutSeconds * 1000;
    let attempt = 0;
    let lastFailure = '';
    const total = batches.reduce((sum, batch) => sum + batch.tags.length, 0);
    while (Date.now() < deadline) {
        attempt += 1;
        let pendingBatch = null;
        for (const batch of batches) {
            const result = await runTagCheck(workspace, batch, options);
            if (result.exitCode !== 0) {
                pendingBatch = batch;
                lastFailure = formatCheckFailure(result);
                break;
            }
        }
        if (!pendingBatch) {
            core.info(`Verified ${total} tag${total === 1 ? '' : 's'} in ${workspace} after ${attempt} attempt${attempt === 1 ? '' : 's'}`);
            return;
        }
        core.info(`Waiting for tags to become visible (${attempt}): ${pendingBatch.tags.join(', ')}`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    const failureMessage = `Timed out waiting ${options.timeoutSeconds}s for ${total} tag${total === 1 ? '' : 's'} in ${workspace}: ${lastFailure}`;
    if (warnOnly) {
        core.warning(failureMessage);
        return;
    }
    throw new Error(failureMessage);
}
function parseToolSpecs(input) {
    return input
        .split(/\r?\n|,/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
        const atIndex = entry.lastIndexOf('@');
        if (atIndex <= 0 || atIndex === entry.length - 1) {
            throw new Error(`Invalid tool spec "${entry}". Expected format tool@version.`);
        }
        const name = normalizeToolName(entry.slice(0, atIndex));
        const version = entry.slice(atIndex + 1).trim();
        return {
            name,
            version,
            label: TOOL_LABELS[name] || name,
            source: 'input',
        };
    });
}
async function resolveRuntimeTools(setup, preset, mode, toolsInput, workingDirectory, uvVersion, composerVersion) {
    if (setup !== 'mise') {
        return [];
    }
    const explicitTools = parseToolSpecs(toolsInput);
    const projectTools = await detectProjectTools(workingDirectory);
    const presetTools = await detectPresetTools(preset, workingDirectory, uvVersion, composerVersion);
    const modeTools = await detectModeTools(mode, workingDirectory);
    return mergeTools(explicitTools, projectTools, presetTools, modeTools);
}
async function detectProjectTools(workingDirectory) {
    const tools = new Map();
    for (const tool of await (0, core_1.readProjectMiseTools)(workingDirectory)) {
        const normalizedName = normalizeToolName(tool.name);
        tools.set(normalizedName, {
            name: normalizedName,
            version: tool.version,
            label: TOOL_LABELS[normalizedName] || tool.name,
            source: 'project',
        });
    }
    const detectedTools = await Promise.all([
        detectToolFromProjectFiles(workingDirectory, 'ruby', detectRubyVersion),
        detectToolFromProjectFiles(workingDirectory, 'node', detectNodeVersion),
        detectToolFromProjectFiles(workingDirectory, 'python', detectPythonVersion),
        detectToolFromProjectFiles(workingDirectory, 'go', detectGoVersion),
        detectToolFromProjectFiles(workingDirectory, 'java', detectJavaVersion),
        detectToolFromProjectFiles(workingDirectory, 'maven', detectMavenVersion),
        detectToolFromProjectFiles(workingDirectory, 'bazel', detectBazelVersion),
        detectToolFromProjectFiles(workingDirectory, 'rust', detectRustVersion),
    ]);
    for (const tool of detectedTools) {
        if (tool && !tools.has(tool.name)) {
            tools.set(tool.name, tool);
        }
    }
    const packageManagerTool = await detectNodePackageManagerTool(workingDirectory);
    if (packageManagerTool && !tools.has(packageManagerTool.name)) {
        tools.set(packageManagerTool.name, packageManagerTool);
    }
    return Array.from(tools.values());
}
async function detectPresetTools(preset, workingDirectory, uvVersion, composerVersion) {
    switch (preset) {
        case 'rails':
            return detectRailsTools(workingDirectory);
        case 'ruby':
            return detectRubyTools(workingDirectory);
        case 'node':
            return detectNodeTools(workingDirectory);
        case 'node-turbo':
            return detectNodeTurboTools(workingDirectory);
        case 'python-uv':
            return detectPythonUvTools(workingDirectory, uvVersion);
        case 'go':
            return detectGoTools(workingDirectory);
        case 'php-composer':
            return detectPhpComposerTools(workingDirectory, composerVersion);
        default:
            return [];
    }
}
async function detectModeTools(mode, workingDirectory) {
    switch (mode) {
        case 'turbo-proxy':
        case 'nx-proxy':
            return detectNodeTurboTools(workingDirectory);
        case 'bazel':
            return detectBazelTools(workingDirectory);
        case 'go':
            return detectGoTools(workingDirectory);
        case 'gradle':
            return detectGradleTools(workingDirectory);
        case 'maven':
            return detectMavenTools(workingDirectory);
        case 'rust-sccache':
            return detectRustTools(workingDirectory);
        default:
            return [];
    }
}
async function detectRubyTools(workingDirectory) {
    const rubyVersion = await detectRubyVersion(workingDirectory);
    if (!rubyVersion) {
        return [];
    }
    return [{ name: 'ruby', version: rubyVersion, label: 'Ruby', source: 'preset' }];
}
async function detectRailsTools(workingDirectory) {
    const tools = await detectRubyTools(workingDirectory);
    if (await needsNodeRuntime(workingDirectory)) {
        const nodeVersion = await detectNodeVersion(workingDirectory);
        if (nodeVersion) {
            tools.push({ name: 'node', version: nodeVersion, label: 'Node.js', source: 'preset' });
        }
    }
    const packageManagerTool = await detectNodePackageManagerTool(workingDirectory, 'preset');
    if (packageManagerTool) {
        tools.push(packageManagerTool);
    }
    return tools;
}
async function detectNodeTools(workingDirectory) {
    const tools = [];
    const nodeVersion = await detectNodeVersion(workingDirectory);
    if (nodeVersion) {
        tools.push({ name: 'node', version: nodeVersion, label: 'Node.js', source: 'preset' });
    }
    const packageManagerTool = await detectNodePackageManagerTool(workingDirectory, 'preset');
    if (packageManagerTool) {
        tools.push(packageManagerTool);
    }
    return tools;
}
async function detectNodeTurboTools(workingDirectory) {
    return detectNodeTools(workingDirectory);
}
async function detectPythonUvTools(workingDirectory, defaultUvVersion) {
    const tools = [];
    const pythonVersion = await detectPythonVersion(workingDirectory);
    if (pythonVersion) {
        tools.push({ name: 'python', version: pythonVersion, label: 'Python', source: 'preset' });
    }
    tools.push({
        name: 'uv',
        version: (await detectUvVersion(workingDirectory)) || defaultUvVersion,
        label: 'uv',
        source: 'preset',
    });
    return tools;
}
async function detectGoTools(workingDirectory) {
    const goVersion = await detectGoVersion(workingDirectory);
    if (!goVersion) {
        return [];
    }
    return [{ name: 'go', version: goVersion, label: 'Go', source: 'preset' }];
}
async function detectPhpComposerTools(workingDirectory, defaultComposerVersion) {
    const tools = [];
    const phpVersion = await detectPhpVersion(workingDirectory);
    if (phpVersion) {
        tools.push({ name: 'php', version: phpVersion, label: 'PHP', source: 'preset' });
    }
    tools.push({
        name: 'composer',
        version: (await detectComposerVersion(workingDirectory)) || defaultComposerVersion,
        label: 'Composer',
        source: 'preset',
    });
    return tools;
}
async function detectBazelTools(workingDirectory) {
    const bazelVersion = await detectBazelVersion(workingDirectory);
    if (!bazelVersion) {
        return [];
    }
    return [{ name: 'bazel', version: bazelVersion, label: 'Bazel', source: 'mode' }];
}
async function detectGradleTools(workingDirectory) {
    const javaVersion = await detectJavaVersion(workingDirectory);
    if (!javaVersion) {
        return [];
    }
    return [{ name: 'java', version: javaVersion, label: 'Java', source: 'mode' }];
}
async function detectMavenTools(workingDirectory) {
    const tools = [];
    const javaVersion = await detectJavaVersion(workingDirectory);
    if (javaVersion) {
        tools.push({ name: 'java', version: javaVersion, label: 'Java', source: 'mode' });
    }
    const mavenVersion = await detectMavenVersion(workingDirectory);
    if (mavenVersion) {
        tools.push({ name: 'maven', version: mavenVersion, label: 'Maven', source: 'mode' });
    }
    return tools;
}
async function detectRustTools(workingDirectory) {
    const rustVersion = await detectRustVersion(workingDirectory);
    if (!rustVersion) {
        return [];
    }
    return [{ name: 'rust', version: rustVersion, label: 'Rust', source: 'mode' }];
}
async function detectRubyVersion(workingDirectory) {
    const rubyVersion = await readFirstLine(path.join(workingDirectory, '.ruby-version'));
    if (rubyVersion) {
        return rubyVersion;
    }
    const toolVersion = await (0, core_1.readToolVersionsValue)(workingDirectory, 'ruby');
    if (toolVersion) {
        return toolVersion;
    }
    return (0, core_1.readMiseTomlVersion)(workingDirectory, 'ruby');
}
async function detectNodeVersion(workingDirectory) {
    const nodeVersion = await readFirstLine(path.join(workingDirectory, '.node-version'));
    if (nodeVersion) {
        return nodeVersion.replace(/^v/, '');
    }
    const nvmVersion = await readFirstLine(path.join(workingDirectory, '.nvmrc'));
    if (nvmVersion) {
        return nvmVersion.replace(/^v/, '');
    }
    const toolVersion = (await (0, core_1.readToolVersionsValue)(workingDirectory, 'nodejs'))
        || (await (0, core_1.readToolVersionsValue)(workingDirectory, 'node'));
    if (toolVersion) {
        return toolVersion;
    }
    return (await (0, core_1.readMiseTomlVersion)(workingDirectory, 'node'))
        || (await (0, core_1.readMiseTomlVersion)(workingDirectory, 'nodejs'));
}
async function detectBazelVersion(workingDirectory) {
    const bazelVersion = await readFirstLine(path.join(workingDirectory, '.bazelversion'));
    if (bazelVersion) {
        return bazelVersion;
    }
    const toolVersion = await (0, core_1.readToolVersionsValue)(workingDirectory, 'bazel');
    if (toolVersion) {
        return toolVersion;
    }
    return (0, core_1.readMiseTomlVersion)(workingDirectory, 'bazel');
}
async function detectPythonVersion(workingDirectory) {
    const pythonVersion = await readFirstLine(path.join(workingDirectory, '.python-version'));
    if (pythonVersion) {
        return pythonVersion;
    }
    const toolVersion = await (0, core_1.readToolVersionsValue)(workingDirectory, 'python');
    if (toolVersion) {
        return toolVersion;
    }
    return (0, core_1.readMiseTomlVersion)(workingDirectory, 'python');
}
async function detectGoVersion(workingDirectory) {
    const goVersion = await readFirstLine(path.join(workingDirectory, '.go-version'));
    if (goVersion) {
        return goVersion;
    }
    const toolVersion = (await (0, core_1.readToolVersionsValue)(workingDirectory, 'go'))
        || (await (0, core_1.readToolVersionsValue)(workingDirectory, 'golang'));
    if (toolVersion) {
        return toolVersion;
    }
    return (await (0, core_1.readMiseTomlVersion)(workingDirectory, 'go'))
        || (await (0, core_1.readMiseTomlVersion)(workingDirectory, 'golang'));
}
async function detectUvVersion(workingDirectory) {
    const toolVersion = await (0, core_1.readToolVersionsValue)(workingDirectory, 'uv');
    if (toolVersion) {
        return toolVersion;
    }
    return (0, core_1.readMiseTomlVersion)(workingDirectory, 'uv');
}
async function detectPhpVersion(workingDirectory) {
    const phpVersion = await readFirstLine(path.join(workingDirectory, '.php-version'));
    if (phpVersion) {
        return phpVersion;
    }
    const toolVersion = await (0, core_1.readToolVersionsValue)(workingDirectory, 'php');
    if (toolVersion) {
        return toolVersion;
    }
    return (0, core_1.readMiseTomlVersion)(workingDirectory, 'php');
}
async function detectComposerVersion(workingDirectory) {
    const toolVersion = await (0, core_1.readToolVersionsValue)(workingDirectory, 'composer');
    if (toolVersion) {
        return toolVersion;
    }
    return (0, core_1.readMiseTomlVersion)(workingDirectory, 'composer');
}
async function detectJavaVersion(workingDirectory) {
    const javaVersion = await readFirstLine(path.join(workingDirectory, '.java-version'));
    if (javaVersion) {
        return javaVersion;
    }
    const toolVersion = await (0, core_1.readToolVersionsValue)(workingDirectory, 'java');
    if (toolVersion) {
        return toolVersion;
    }
    const miseVersion = await (0, core_1.readMiseTomlVersion)(workingDirectory, 'java');
    if (miseVersion) {
        return miseVersion;
    }
    const pomXml = await readFile(path.join(workingDirectory, 'pom.xml'));
    if (pomXml) {
        const pomMatch = pomXml.match(/<maven\.compiler\.(?:release|source|target)>\s*([^<\s]+)\s*<\/maven\.compiler\.(?:release|source|target)>/)
            || pomXml.match(/<java\.version>\s*([^<\s]+)\s*<\/java\.version>/);
        if (pomMatch === null || pomMatch === void 0 ? void 0 : pomMatch[1]) {
            return pomMatch[1].trim();
        }
    }
    return null;
}
async function detectMavenVersion(workingDirectory) {
    const wrapperProps = await readFile(path.join(workingDirectory, '.mvn', 'wrapper', 'maven-wrapper.properties'));
    if (wrapperProps) {
        const match = wrapperProps.match(/apache-maven-([0-9]+(?:\.[0-9]+)*)-bin/i);
        if (match === null || match === void 0 ? void 0 : match[1]) {
            return match[1];
        }
    }
    const toolVersion = await (0, core_1.readToolVersionsValue)(workingDirectory, 'maven');
    if (toolVersion) {
        return toolVersion;
    }
    return (0, core_1.readMiseTomlVersion)(workingDirectory, 'maven');
}
async function detectRustVersion(workingDirectory) {
    const rustToolchainToml = await readFile(path.join(workingDirectory, 'rust-toolchain.toml'));
    if (rustToolchainToml) {
        const match = rustToolchainToml.match(/channel\s*=\s*["']([^"']+)["']/);
        if (match === null || match === void 0 ? void 0 : match[1]) {
            return match[1];
        }
    }
    const rustToolchain = await readFirstLine(path.join(workingDirectory, 'rust-toolchain'));
    if (rustToolchain) {
        return rustToolchain;
    }
    const toolVersion = await (0, core_1.readToolVersionsValue)(workingDirectory, 'rust');
    if (toolVersion) {
        return toolVersion;
    }
    return (0, core_1.readMiseTomlVersion)(workingDirectory, 'rust');
}
async function detectToolFromProjectFiles(workingDirectory, toolName, detector) {
    const version = await detector(workingDirectory);
    if (!version) {
        return null;
    }
    return {
        name: normalizeToolName(toolName),
        version,
        label: TOOL_LABELS[normalizeToolName(toolName)] || toolName,
        source: 'project',
    };
}
async function readFirstLine(filePath) {
    try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const line = content.split('\n').map((value) => value.trim()).find(Boolean);
        return line || null;
    }
    catch {
        return null;
    }
}
async function readFile(filePath) {
    try {
        return await fs.promises.readFile(filePath, 'utf-8');
    }
    catch {
        return null;
    }
}
async function needsNodeRuntime(workingDirectory) {
    const markers = ['package.json', 'yarn.lock', 'pnpm-lock.yaml', 'package-lock.json', 'turbo.json'];
    for (const marker of markers) {
        if (await pathExists(path.join(workingDirectory, marker))) {
            return true;
        }
    }
    return false;
}
async function readPackageJson(workingDirectory) {
    const packageJson = await readFile(path.join(workingDirectory, 'package.json'));
    if (!packageJson) {
        return null;
    }
    try {
        return JSON.parse(packageJson);
    }
    catch {
        return null;
    }
}
function normalizePackageManagerName(name) {
    const normalized = name.trim().toLowerCase();
    if (normalized === 'npm' || normalized === 'pnpm' || normalized === 'yarn') {
        return normalized;
    }
    return null;
}
function packageManagerCacheDir(workingDirectory, name) {
    switch (name) {
        case 'pnpm':
            return path.join(workingDirectory, '.pnpm-store');
        case 'yarn':
            return path.join(workingDirectory, '.yarn-cache');
        case 'npm':
            return path.join(workingDirectory, '.npm-cache');
    }
}
async function detectNodePackageManager(workingDirectory) {
    const packageJson = await readPackageJson(workingDirectory);
    const packageManagerField = typeof (packageJson === null || packageJson === void 0 ? void 0 : packageJson.packageManager) === 'string'
        ? packageJson.packageManager.trim()
        : '';
    let name = null;
    let version = null;
    if (packageManagerField) {
        const atIndex = packageManagerField.lastIndexOf('@');
        if (atIndex > 0) {
            name = normalizePackageManagerName(packageManagerField.slice(0, atIndex));
            version = packageManagerField.slice(atIndex + 1).trim().split('+')[0] || null;
        }
    }
    if (!name) {
        if (await pathExists(path.join(workingDirectory, 'pnpm-lock.yaml'))) {
            name = 'pnpm';
        }
        else if (await pathExists(path.join(workingDirectory, 'yarn.lock'))) {
            name = 'yarn';
        }
        else if (await pathExists(path.join(workingDirectory, 'package-lock.json'))
            || await pathExists(path.join(workingDirectory, 'npm-shrinkwrap.json'))) {
            name = 'npm';
        }
        else if (packageJson) {
            name = 'npm';
        }
    }
    if (!name) {
        return null;
    }
    return {
        name,
        version,
        packageManagerField: packageManagerField || null,
        cacheDir: packageManagerCacheDir(workingDirectory, name),
        nodeModulesDir: path.join(workingDirectory, 'node_modules'),
    };
}
async function detectNodePackageManagerTool(workingDirectory, source = 'project') {
    const packageManager = await detectNodePackageManager(workingDirectory);
    if (!(packageManager === null || packageManager === void 0 ? void 0 : packageManager.version)) {
        return null;
    }
    return {
        name: packageManager.name,
        version: packageManager.version,
        label: TOOL_LABELS[packageManager.name] || packageManager.name,
        source,
    };
}
async function pathExists(filePath) {
    try {
        await fs.promises.access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
function mergeTools(...toolSets) {
    const merged = new Map();
    for (const toolSet of toolSets) {
        for (const tool of toolSet) {
            if (tool.source === 'input' || !merged.has(tool.name)) {
                merged.set(tool.name, tool);
            }
        }
    }
    return Array.from(merged.values());
}
function normalizeToolName(name) {
    const normalized = name.trim().toLowerCase();
    if (normalized === 'nodejs') {
        return 'node';
    }
    if (normalized === 'golang') {
        return 'go';
    }
    return normalized;
}
function buildRuntimeCacheTag(cacheTagPrefix, runtimeCacheTag, tools, versionScope) {
    if (tools.length === 0) {
        return null;
    }
    if (runtimeCacheTag.trim()) {
        return runtimeCacheTag.trim();
    }
    return (0, core_1.buildMiseRuntimeTag)(cacheTagPrefix, tools, versionScope);
}
function buildRuntimeCacheEntry(cacheTagPrefix, runtimeCacheTag, tools, versionScope) {
    const runtimeTag = buildRuntimeCacheTag(cacheTagPrefix, runtimeCacheTag, tools, versionScope);
    if (!runtimeTag) {
        return null;
    }
    return `${runtimeTag}:${(0, core_1.getMiseInstallsDir)()}`;
}
function normalizeEntriesInput(entries) {
    return entries
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .join(',');
}
function splitEntriesInput(entries) {
    return entries
        .split(/[\r\n,]/)
        .map((entry) => entry.trim())
        .filter(Boolean);
}
const PROJECT_CONFIG_FILE_NAMES = ['.boringcache.toml', 'boringcache.toml'];
function findNearestRepoConfigPath(workingDirectory) {
    let current = path.resolve(workingDirectory);
    while (true) {
        for (const fileName of PROJECT_CONFIG_FILE_NAMES) {
            const candidate = path.join(current, fileName);
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }
        const parent = path.dirname(current);
        if (parent === current) {
            return null;
        }
        current = parent;
    }
}
async function runDryRunPlan(workingDirectory, options) {
    const { workspaceInput, entryIds = [], profileNames = [], manualTagPathPairs = [], archivePaths = [], archiveTagPrefix = '', archiveRestorePrefixes = [], cacheTag = '', toolTagSuffix = '', noPlatform = false, fallbackWorkspace, } = options;
    const executePlan = async (candidateWorkspace) => {
        const args = ['run'];
        const trimmedWorkspace = candidateWorkspace.trim();
        if (trimmedWorkspace) {
            args.push(trimmedWorkspace);
        }
        if (manualTagPathPairs.length > 0) {
            args.push(manualTagPathPairs.join(','));
        }
        for (const profileName of profileNames) {
            args.push('--profile', profileName);
        }
        for (const entryId of entryIds) {
            args.push('--entry', entryId);
        }
        for (const archivePath of archivePaths) {
            args.push('--archive-path', archivePath);
        }
        if (archiveTagPrefix.trim()) {
            args.push('--archive-tag-prefix', archiveTagPrefix.trim());
        }
        for (const archiveRestorePrefix of archiveRestorePrefixes) {
            args.push('--archive-restore-prefix', archiveRestorePrefix);
        }
        if (cacheTag.trim()) {
            args.push('--cache-tag', cacheTag.trim());
        }
        if (toolTagSuffix === null || toolTagSuffix === void 0 ? void 0 : toolTagSuffix.trim()) {
            args.push('--tool-tag-suffix', toolTagSuffix.trim());
        }
        if (noPlatform) {
            args.push('--no-platform');
        }
        args.push('--dry-run', '--json');
        let stdout = '';
        let stderr = '';
        const exitCode = await exec.exec('boringcache', args, {
            cwd: workingDirectory,
            ignoreReturnCode: true,
            silent: true,
            listeners: {
                stdout: (data) => {
                    stdout += data.toString();
                },
                stderr: (data) => {
                    stderr += data.toString();
                },
            },
        });
        if (exitCode !== 0) {
            throw new Error(stderr.trim() || stdout.trim() || `boringcache run --dry-run --json exited with code ${exitCode}`);
        }
        try {
            return JSON.parse(stdout);
        }
        catch (error) {
            throw new Error(`Failed to parse boringcache dry-run JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
    };
    try {
        return await executePlan(workspaceInput);
    }
    catch (error) {
        if (!workspaceInput.trim()
            && fallbackWorkspace
            && error instanceof Error
            && /No workspace specified/i.test(error.message)) {
            return executePlan(fallbackWorkspace);
        }
        throw error;
    }
}
async function resolveCliArchiveEntries(workingDirectory, options) {
    var _a, _b;
    const plan = await runDryRunPlan(workingDirectory, {
        workspaceInput: options.workspaceInput,
        entryIds: options.entryIds,
        cacheTag: options.cacheTag,
        toolTagSuffix: options.toolTagSuffix,
        fallbackWorkspace: options.fallbackWorkspace,
    });
    const workspace = ((_a = plan.workspace) === null || _a === void 0 ? void 0 : _a.trim())
        || ((_b = options.fallbackWorkspace) === null || _b === void 0 ? void 0 : _b.trim())
        || resolveWorkspace(options.workspaceInput);
    return {
        workspace,
        envVars: plan.env_vars,
        entries: (plan.archive_entries || [])
            .filter((entry) => Boolean(entry.path))
            .map((entry) => ({
            requested: entry.requested,
            tag: entry.tag,
            path: entry.path,
            tagPathPair: entry.tag_path_pair,
        })),
    };
}
function isUnknownEntryResolutionError(error) {
    return error instanceof Error && /Unknown cache entry/i.test(error.message);
}
async function maybeResolveRawEntryViaCli(workingDirectory, workspaceInput, rawTag, cacheTag, toolTagSuffix, fallbackWorkspace) {
    try {
        return await runDryRunPlan(workingDirectory, {
            workspaceInput,
            entryIds: [rawTag],
            cacheTag,
            toolTagSuffix,
            fallbackWorkspace,
        });
    }
    catch (error) {
        if (isUnknownEntryResolutionError(error)) {
            return null;
        }
        throw error;
    }
}
async function maybeResolveWorkspaceViaCli(workingDirectory, workspaceInput, fallbackWorkspace) {
    var _a;
    const plan = await runDryRunPlan(workingDirectory, {
        workspaceInput,
        fallbackWorkspace,
    });
    return ((_a = plan.workspace) === null || _a === void 0 ? void 0 : _a.trim()) || null;
}
function cliPlanHasProvenance(plan) {
    return Boolean(plan.workspace_source || plan.repo_config_path || plan.archive_entries);
}
function cliPlanUsesRepoConfigResolution(plan) {
    var _a;
    const firstEntry = (_a = plan.archive_entries) === null || _a === void 0 ? void 0 : _a[0];
    if (firstEntry) {
        return firstEntry.resolution_source === 'repo-config';
    }
    return Boolean(plan.repo_config_path);
}
async function detectDefaultArchiveEntries(inputs) {
    if (inputs.preset === 'ruby') {
        return 'bundler';
    }
    if (inputs.preset === 'rails') {
        return joinDefaultEntries('bundler', await detectNodeDefaultArchiveEntries(inputs.workingDirectory));
    }
    if (inputs.preset === 'node' || inputs.preset === 'node-turbo') {
        return await detectNodeDefaultArchiveEntries(inputs.workingDirectory);
    }
    if (inputs.preset === 'python-uv') {
        return 'uv-cache';
    }
    if (inputs.preset === 'go') {
        return joinDefaultEntries('go-mod-cache', 'go-build-cache');
    }
    if (inputs.preset === 'php-composer') {
        return joinDefaultEntries('composer-cache', 'vendor');
    }
    return '';
}
function joinDefaultEntries(...groups) {
    return groups
        .flatMap((group) => group.split(/\r?\n/))
        .map((entry) => entry.trim())
        .filter(Boolean)
        .join('\n');
}
async function detectNodeDefaultArchiveEntries(workingDirectory) {
    const packageManager = await detectNodePackageManager(workingDirectory);
    if (!packageManager) {
        return '';
    }
    switch (packageManager.name) {
        case 'pnpm':
            return 'pnpm-store\nnode-modules';
        case 'yarn':
            return 'yarn-cache\nnode-modules';
        case 'npm':
            return 'npm-cache\nnode-modules';
    }
}
async function buildArchiveEntries(inputs, runtimeTools) {
    let archiveEntries = [];
    let restoreCandidates = [];
    let usesCacheFormat = false;
    const envVars = {};
    let cacheTagPrefix;
    let resolvedWorkspace;
    let sourceEntries = inputs.entries;
    const cacheProfiles = splitEntriesInput(inputs.cacheProfiles);
    const repoConfigPath = findNearestRepoConfigPath(inputs.workingDirectory);
    const fallbackWorkspace = resolveWorkspace(inputs.workspace);
    const cliWorkspaceInput = inputs.workspace.trim();
    const cliToolTagSuffix = inputs.setup === 'mise'
        ? (0, core_1.buildMiseToolTag)(runtimeTools, inputs.toolVersionScope)
        : null;
    const mergeCliPlan = (plan) => {
        var _a, _b;
        archiveEntries.push(...plan.tag_path_pairs);
        if (!cacheTagPrefix) {
            const firstEntry = (_a = plan.archive_entries) === null || _a === void 0 ? void 0 : _a[0];
            const firstPair = plan.tag_path_pairs[0];
            cacheTagPrefix = (firstEntry === null || firstEntry === void 0 ? void 0 : firstEntry.resolved_tag) || (firstEntry === null || firstEntry === void 0 ? void 0 : firstEntry.tag)
                || (firstPair ? (_b = (0, core_1.parseEntries)(firstPair, 'restore', { resolvePaths: false })[0]) === null || _b === void 0 ? void 0 : _b.tag : undefined);
        }
        Object.assign(envVars, plan.env_vars);
        if (!resolvedWorkspace && plan.workspace) {
            resolvedWorkspace = plan.workspace;
        }
    };
    if (cacheProfiles.length > 0 || sourceEntries.trim()) {
        const semanticEntries = [];
        const rawEntries = [];
        for (const entry of splitEntriesInput(sourceEntries)) {
            if (entry.includes(':')) {
                rawEntries.push(entry);
            }
            else {
                semanticEntries.push(entry);
            }
        }
        if (cacheProfiles.length > 0 || semanticEntries.length > 0) {
            mergeCliPlan(await runDryRunPlan(inputs.workingDirectory, {
                workspaceInput: cliWorkspaceInput,
                entryIds: semanticEntries,
                profileNames: cacheProfiles,
                cacheTag: inputs.cacheTag,
                toolTagSuffix: cliToolTagSuffix,
                fallbackWorkspace,
            }));
        }
        for (const entryToken of rawEntries) {
            const parsedEntry = (0, core_1.parseEntries)(entryToken, 'restore', { resolvePaths: false })[0];
            if (!parsedEntry) {
                continue;
            }
            if (repoConfigPath && parsedEntry.restorePath === parsedEntry.savePath) {
                const resolved = await maybeResolveRawEntryViaCli(inputs.workingDirectory, cliWorkspaceInput, parsedEntry.tag, inputs.cacheTag, cliToolTagSuffix, fallbackWorkspace);
                const shouldUpgrade = resolved
                    && resolved.tag_path_pairs.length > 0
                    && (cliPlanUsesRepoConfigResolution(resolved)
                        || (!cliPlanHasProvenance(resolved) && Boolean(repoConfigPath)));
                if (shouldUpgrade) {
                    mergeCliPlan(resolved);
                    continue;
                }
            }
            if (!inputs.cacheTag.trim() && !(cliToolTagSuffix === null || cliToolTagSuffix === void 0 ? void 0 : cliToolTagSuffix.trim())) {
                if (!cacheTagPrefix) {
                    cacheTagPrefix = parsedEntry.tag;
                }
                archiveEntries.push(entryToken);
                continue;
            }
            mergeCliPlan(await runDryRunPlan(inputs.workingDirectory, {
                workspaceInput: cliWorkspaceInput,
                manualTagPathPairs: [entryToken],
                cacheTag: inputs.cacheTag,
                toolTagSuffix: cliToolTagSuffix,
                fallbackWorkspace,
            }));
        }
    }
    else if (inputs.path || inputs.key) {
        if (!inputs.path || !inputs.key) {
            throw new Error('actions/cache compatibility mode requires both path and key');
        }
        const archivePathPlan = await runDryRunPlan(inputs.workingDirectory, {
            workspaceInput: cliWorkspaceInput,
            archivePaths: inputs.path
                .split(/\r?\n/)
                .map((entry) => entry.trim())
                .filter(Boolean),
            archiveTagPrefix: inputs.key,
            archiveRestorePrefixes: getRestoreKeyCandidates(inputs),
            noPlatform: inputs.noPlatform || inputs.enableCrossOsArchive,
            fallbackWorkspace,
        });
        archiveEntries = archivePathPlan.tag_path_pairs;
        restoreCandidates = (archivePathPlan.archive_restore_candidates || []).map((candidate) => ({
            tagPrefix: candidate.tag_prefix,
            entries: candidate.tag_path_pairs.join(','),
        }));
        usesCacheFormat = true;
        cacheTagPrefix = inputs.key.trim() || undefined;
    }
    else {
        sourceEntries = await detectDefaultArchiveEntries(inputs);
        const defaultEntryIds = splitEntriesInput(sourceEntries);
        if (defaultEntryIds.length > 0) {
            mergeCliPlan(await runDryRunPlan(inputs.workingDirectory, {
                workspaceInput: cliWorkspaceInput,
                entryIds: defaultEntryIds,
                cacheTag: inputs.cacheTag,
                toolTagSuffix: cliToolTagSuffix,
                fallbackWorkspace,
            }));
        }
    }
    return {
        entries: archiveEntries.join(','),
        restoreCandidates,
        usesCacheFormat,
        envVars,
        cacheTagPrefix,
        workspace: resolvedWorkspace,
    };
}
function validateOneInputs(inputs, modeSpec, runtimeTools, runtimeEntry, archiveEntries) {
    if ((inputs.entries || inputs.cacheProfiles.trim()) && (inputs.path || inputs.key)) {
        core.warning('Both explicit entries/cache-profiles and actions/cache compatibility inputs were provided. Using entries/cache-profiles.');
    }
    if ((inputs.path && !inputs.key) || (!inputs.path && inputs.key)) {
        throw new Error('actions/cache compatibility mode requires both path and key');
    }
    if (inputs.setup !== 'mise' && inputs.tools.trim()) {
        core.warning(`Ignoring tools because setup=${inputs.setup}`);
    }
    if (inputs.setup !== 'mise' && inputs.cacheRuntime) {
        core.warning(`Ignoring cache-runtime because setup=${inputs.setup}`);
    }
    if (inputs.setup === 'mise' && inputs.cacheRuntime && runtimeTools.length === 0) {
        core.warning('cache-runtime requested but no mise tools were resolved');
    }
    const hasArchiveInputs = Boolean(archiveEntries || runtimeEntry);
    if (modeSpec.resolved === 'archive' && !hasArchiveInputs) {
        if (inputs.cliVersion.trim().toLowerCase() !== 'skip') {
            core.notice('No cache entries resolved; boringcache/one will install the CLI only.');
            return;
        }
        throw new Error('No cache entries resolved. Provide entries, path+key, or enable cache-runtime with setup=mise.');
    }
}
async function buildPlan(inputs) {
    const modeSpec = (0, modes_1.resolveModeSpec)(inputs.mode);
    (0, modes_1.assertImplementedMode)(modeSpec);
    const resolvedMavenVersion = inputs.mavenVersion || '3.9.9';
    const fallbackWorkspace = resolveWorkspace(inputs.workspace);
    const explicitWorkspace = inputs.workspace.trim();
    const runtimeTools = await resolveRuntimeTools(inputs.setup, inputs.preset, inputs.mode, inputs.tools, inputs.workingDirectory, inputs.uvVersion, inputs.composerVersion);
    if (inputs.setup === 'mise'
        && modeSpec.resolved === 'maven'
        && resolvedMavenVersion
        && !runtimeTools.some((tool) => tool.name === 'maven')) {
        runtimeTools.push({
            name: 'maven',
            version: resolvedMavenVersion,
            label: 'Maven',
            source: 'mode',
        });
    }
    const archiveEntries = await buildArchiveEntries(inputs, runtimeTools);
    const workspace = explicitWorkspace
        ? fallbackWorkspace
        : archiveEntries.workspace
            || (!archiveEntries.usesCacheFormat
                ? await maybeResolveWorkspaceViaCli(inputs.workingDirectory, explicitWorkspace, fallbackWorkspace)
                : null)
            || fallbackWorkspace;
    const cacheTagPrefix = getCacheTagPrefix(inputs, runtimeTools, archiveEntries.cacheTagPrefix);
    const runtimeTag = inputs.setup === 'mise' && inputs.cacheRuntime
        ? buildRuntimeCacheTag(cacheTagPrefix, inputs.runtimeCacheTag, runtimeTools, inputs.toolVersionScope)
        : null;
    const runtimeEntry = inputs.setup === 'mise' && inputs.cacheRuntime
        ? buildRuntimeCacheEntry(cacheTagPrefix, inputs.runtimeCacheTag, runtimeTools, inputs.toolVersionScope)
        : null;
    validateOneInputs(inputs, modeSpec, runtimeTools, runtimeEntry, archiveEntries.entries);
    return {
        workspace,
        workingDirectory: inputs.workingDirectory,
        setup: inputs.setup,
        mode: modeSpec.resolved,
        modeSpec,
        preset: inputs.preset,
        cacheTagPrefix,
        runtimeTools,
        runtimeTag,
        runtimeEntry,
        envVars: archiveEntries.envVars,
        archiveEntries: archiveEntries.entries,
        archiveRestoreCandidates: archiveEntries.restoreCandidates,
        usesCacheFormat: archiveEntries.usesCacheFormat,
    };
}
function getCacheTagPrefix(inputs, runtimeTools, resolvedArchivePrefix) {
    if (inputs.cacheTag) {
        return inputs.cacheTag;
    }
    if (resolvedArchivePrefix === null || resolvedArchivePrefix === void 0 ? void 0 : resolvedArchivePrefix.trim()) {
        return resolvedArchivePrefix.trim();
    }
    if (inputs.key) {
        return inputs.key;
    }
    if (runtimeTools.length > 0) {
        return runtimeTools.map((tool) => tool.name).join('-');
    }
    return 'one';
}
function buildFlagArgs(inputs) {
    const flagArgs = [];
    if (inputs.enableCrossOsArchive || inputs.noPlatform) {
        flagArgs.push('--no-platform');
    }
    if (inputs.failOnCacheMiss) {
        flagArgs.push('--fail-on-cache-miss');
    }
    if (inputs.lookupOnly) {
        flagArgs.push('--lookup-only');
    }
    if (inputs.verbose) {
        flagArgs.push('--verbose');
    }
    if (inputs.exclude) {
        flagArgs.push('--exclude', inputs.exclude);
    }
    if (inputs.allowExternalSymlinks) {
        flagArgs.push('--allow-external-symlinks');
    }
    return flagArgs;
}
async function applyMiseSetup(runtimeTools, _runtimeCacheHit, cwd) {
    void _runtimeCacheHit;
    if (runtimeTools.length === 0) {
        return false;
    }
    const pathAvailable = new Map();
    for (const tool of runtimeTools) {
        const available = await (0, core_1.hasToolVersionOnPath)(tool.name, tool.version);
        pathAvailable.set(`${tool.name}@${tool.version}`, available);
        if (available) {
            core.info(`Using existing ${tool.label} ${tool.version} from PATH`);
        }
    }
    const unresolvedTools = runtimeTools.filter((tool) => !pathAvailable.get(`${tool.name}@${tool.version}`));
    if (unresolvedTools.length === 0) {
        return false;
    }
    await (0, core_1.installMise)();
    for (const tool of unresolvedTools) {
        if (await (0, core_1.hasMiseToolVersion)(tool.name, tool.version)) {
            await (0, core_1.activateMiseTool)(tool.name, tool.version, { label: tool.label });
        }
        else {
            await (0, core_1.installMiseTool)(tool.name, tool.version, { label: tool.label });
        }
    }
    await (0, core_1.reshimMise)();
    await (0, core_1.exportMiseEnv)(cwd);
    return true;
}
async function applyPresetCacheEnv(plan) {
    for (const [key, value] of Object.entries(plan.envVars)) {
        core.exportVariable(key, value);
    }
}
function serializeTools(runtimeTools) {
    return runtimeTools.map((tool) => `${tool.name}@${tool.version}`).join('\n');
}
function getRestoreKeyCandidates(inputs) {
    return inputs.restoreKeys
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean);
}
