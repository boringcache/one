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
exports.parseEntries = exports.installMiseTool = exports.installMise = exports.hasToolVersionOnPath = exports.hasMiseToolVersion = exports.getMiseInstallsDir = exports.execBoringCache = exports.exportMiseEnv = exports.ensureBoringCache = exports.convertCacheFormatToEntries = exports.activateMiseTool = void 0;
exports.getInputs = getInputs;
exports.normalizeVerifyMode = normalizeVerifyMode;
exports.normalizeVerifyTimeoutSeconds = normalizeVerifyTimeoutSeconds;
exports.normalizeSetup = normalizeSetup;
exports.normalizePreset = normalizePreset;
exports.normalizeToolVersionScope = normalizeToolVersionScope;
exports.resolveWorkspace = resolveWorkspace;
exports.resolveVerificationTags = resolveVerificationTags;
exports.buildGenericVerificationSpecs = buildGenericVerificationSpecs;
exports.verifyResolvedTags = verifyResolvedTags;
exports.parseToolSpecs = parseToolSpecs;
exports.resolveRuntimeTools = resolveRuntimeTools;
exports.detectNodePackageManager = detectNodePackageManager;
exports.buildRuntimeCacheTag = buildRuntimeCacheTag;
exports.buildRuntimeCacheEntry = buildRuntimeCacheEntry;
exports.buildArchiveEntries = buildArchiveEntries;
exports.validateOneInputs = validateOneInputs;
exports.buildPlan = buildPlan;
exports.getCacheTagPrefix = getCacheTagPrefix;
exports.buildFlagArgs = buildFlagArgs;
exports.applyMiseSetup = applyMiseSetup;
exports.applyPresetCacheEnv = applyPresetCacheEnv;
exports.serializeTools = serializeTools;
exports.getRestoreKeyCandidates = getRestoreKeyCandidates;
exports.getPlatformSuffix = getPlatformSuffix;
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const action_core_1 = require("@boringcache/action-core");
Object.defineProperty(exports, "activateMiseTool", { enumerable: true, get: function () { return action_core_1.activateMiseTool; } });
Object.defineProperty(exports, "convertCacheFormatToEntries", { enumerable: true, get: function () { return action_core_1.convertCacheFormatToEntries; } });
Object.defineProperty(exports, "ensureBoringCache", { enumerable: true, get: function () { return action_core_1.ensureBoringCache; } });
Object.defineProperty(exports, "exportMiseEnv", { enumerable: true, get: function () { return action_core_1.exportMiseEnv; } });
Object.defineProperty(exports, "execBoringCache", { enumerable: true, get: function () { return action_core_1.execBoringCache; } });
Object.defineProperty(exports, "getMiseInstallsDir", { enumerable: true, get: function () { return action_core_1.getMiseInstallsDir; } });
Object.defineProperty(exports, "hasMiseToolVersion", { enumerable: true, get: function () { return action_core_1.hasMiseToolVersion; } });
Object.defineProperty(exports, "hasToolVersionOnPath", { enumerable: true, get: function () { return action_core_1.hasToolVersionOnPath; } });
Object.defineProperty(exports, "installMise", { enumerable: true, get: function () { return action_core_1.installMise; } });
Object.defineProperty(exports, "installMiseTool", { enumerable: true, get: function () { return action_core_1.installMiseTool; } });
Object.defineProperty(exports, "parseEntries", { enumerable: true, get: function () { return action_core_1.parseEntries; } });
const modes_1 = require("./modes");
const TOOL_LABELS = {
    bazel: 'Bazel',
    bun: 'Bun',
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
    python: 'Python',
    ruby: 'Ruby',
    rust: 'Rust',
    turbo: 'Turbo',
    uv: 'uv',
    yarn: 'Yarn',
};
function getInputs() {
    return {
        cliVersion: core.getInput('cli-version') || 'v1.12.6',
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
        mavenLocalRepo: core.getInput('maven-local-repo') || '~/.m2/repository',
        readOnly: core.getBooleanInput('read-only'),
        verify: normalizeVerifyMode(core.getInput('verify')),
        verifyTimeoutSeconds: normalizeVerifyTimeoutSeconds(core.getInput('verify-timeout-seconds')),
        verifyRequireServerSignature: core.getBooleanInput('verify-require-server-signature'),
        proxyPort: core.getInput('proxy-port'),
        proxyNoGit: core.getBooleanInput('proxy-no-git'),
        proxyNoPlatform: core.getBooleanInput('proxy-no-platform'),
        entries: core.getInput('entries'),
        path: core.getInput('path'),
        key: core.getInput('key'),
        restoreKeys: core.getInput('restore-keys'),
        enableCrossOsArchive: core.getBooleanInput('enableCrossOsArchive'),
        noPlatform: core.getBooleanInput('no-platform'),
        failOnCacheMiss: core.getBooleanInput('fail-on-cache-miss'),
        lookupOnly: core.getBooleanInput('lookup-only'),
        force: core.getBooleanInput('force'),
        verbose: core.getBooleanInput('verbose'),
        exclude: core.getInput('exclude'),
    };
}
function normalizeVerifyMode(value) {
    switch ((value || 'none').trim().toLowerCase()) {
        case 'none':
        case 'check':
        case 'wait':
            return (value || 'none').trim().toLowerCase();
        default:
            throw new Error(`Unsupported verify mode "${value}". Expected none, check, or wait.`);
    }
}
function normalizeVerifyTimeoutSeconds(value) {
    if (!value || !value.trim()) {
        return 60;
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
            return (value || 'none').trim().toLowerCase();
        default:
            throw new Error(`Unsupported preset "${value}". Expected none, rails, ruby, node, node-turbo, or python-uv.`);
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
        : (process.env.BORINGCACHE_DEFAULT_WORKSPACE || (0, action_core_1.getInputsWorkspace)({}));
    if (!resolved.includes('/')) {
        return `default/${resolved}`;
    }
    return resolved;
}
function expandUserPath(value) {
    if (value.startsWith('~/')) {
        return path.join(os.homedir(), value.slice(2));
    }
    return value;
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
    const candidate = pathHint ? expandUserPath(pathHint) : workingDirectory;
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
        if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
            return candidate;
        }
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
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
    if (!fs.existsSync(headPath)) {
        return undefined;
    }
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
    if (!fs.existsSync(originHead)) {
        return undefined;
    }
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
        context.branch = detectBranchFromHead(gitDir);
        context.defaultBranch = detectDefaultBranch(gitDir);
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
    for (const entry of (0, action_core_1.parseEntries)(entries, 'restore')) {
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
async function runExactTagCheck(workspace, exactTags, options) {
    const args = [];
    if (options.verbose) {
        args.push('--verbose');
    }
    if (options.requireServerSignature) {
        args.push('--require-server-signature');
    }
    args.push('check', workspace, exactTags.join(','), '--no-platform', '--no-git', '--fail-on-miss');
    let stdout = '';
    let stderr = '';
    const exitCode = await exec.exec('boringcache', args, {
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
    return { exitCode, stdout: stdout.trim(), stderr: stderr.trim() };
}
function formatCheckFailure(result) {
    const details = [result.stderr, result.stdout].filter(Boolean).join('\n');
    return details || `boringcache check exited with code ${result.exitCode}`;
}
async function verifyResolvedTags(workspace, exactTags, options) {
    if (options.mode === 'none' || exactTags.length === 0) {
        return;
    }
    if (options.mode === 'check') {
        const result = await runExactTagCheck(workspace, exactTags, options);
        if (result.exitCode !== 0) {
            throw new Error(`Verification failed for tags ${exactTags.join(', ')}: ${formatCheckFailure(result)}`);
        }
        core.info(`Verified ${exactTags.length} tag${exactTags.length === 1 ? '' : 's'} in ${workspace}`);
        return;
    }
    const deadline = Date.now() + options.timeoutSeconds * 1000;
    let attempt = 0;
    let lastFailure = '';
    while (Date.now() < deadline) {
        attempt += 1;
        const result = await runExactTagCheck(workspace, exactTags, options);
        if (result.exitCode === 0) {
            core.info(`Verified ${exactTags.length} tag${exactTags.length === 1 ? '' : 's'} in ${workspace} after ${attempt} attempt${attempt === 1 ? '' : 's'}`);
            return;
        }
        lastFailure = formatCheckFailure(result);
        core.info(`Waiting for tags to become visible (${attempt}): ${exactTags.join(', ')}`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error(`Timed out waiting ${options.timeoutSeconds}s for tags ${exactTags.join(', ')} in ${workspace}: ${lastFailure}`);
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
async function resolveRuntimeTools(setup, preset, mode, toolsInput, workingDirectory, uvVersion) {
    if (setup !== 'mise') {
        return [];
    }
    const explicitTools = parseToolSpecs(toolsInput);
    const projectTools = await detectProjectTools(workingDirectory);
    const presetTools = await detectPresetTools(preset, workingDirectory, uvVersion);
    const modeTools = await detectModeTools(mode, workingDirectory);
    return mergeTools(explicitTools, projectTools, presetTools, modeTools);
}
async function detectProjectTools(workingDirectory) {
    const tools = new Map();
    for (const tool of await (0, action_core_1.readProjectMiseTools)(workingDirectory)) {
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
async function detectPresetTools(preset, workingDirectory, uvVersion) {
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
        default:
            return [];
    }
}
async function detectModeTools(mode, workingDirectory) {
    switch (mode) {
        case 'turbo-proxy':
            return detectNodeTurboTools(workingDirectory);
        case 'bazel':
            return detectBazelTools(workingDirectory);
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
    const toolVersion = await (0, action_core_1.readToolVersionsValue)(workingDirectory, 'ruby');
    if (toolVersion) {
        return toolVersion;
    }
    return (0, action_core_1.readMiseTomlVersion)(workingDirectory, 'ruby');
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
    const toolVersion = (await (0, action_core_1.readToolVersionsValue)(workingDirectory, 'nodejs'))
        || (await (0, action_core_1.readToolVersionsValue)(workingDirectory, 'node'));
    if (toolVersion) {
        return toolVersion;
    }
    return (await (0, action_core_1.readMiseTomlVersion)(workingDirectory, 'node'))
        || (await (0, action_core_1.readMiseTomlVersion)(workingDirectory, 'nodejs'));
}
async function detectBazelVersion(workingDirectory) {
    const bazelVersion = await readFirstLine(path.join(workingDirectory, '.bazelversion'));
    if (bazelVersion) {
        return bazelVersion;
    }
    const toolVersion = await (0, action_core_1.readToolVersionsValue)(workingDirectory, 'bazel');
    if (toolVersion) {
        return toolVersion;
    }
    return (0, action_core_1.readMiseTomlVersion)(workingDirectory, 'bazel');
}
async function detectPythonVersion(workingDirectory) {
    const pythonVersion = await readFirstLine(path.join(workingDirectory, '.python-version'));
    if (pythonVersion) {
        return pythonVersion;
    }
    const toolVersion = await (0, action_core_1.readToolVersionsValue)(workingDirectory, 'python');
    if (toolVersion) {
        return toolVersion;
    }
    return (0, action_core_1.readMiseTomlVersion)(workingDirectory, 'python');
}
async function detectGoVersion(workingDirectory) {
    const goVersion = await readFirstLine(path.join(workingDirectory, '.go-version'));
    if (goVersion) {
        return goVersion;
    }
    const toolVersion = (await (0, action_core_1.readToolVersionsValue)(workingDirectory, 'go'))
        || (await (0, action_core_1.readToolVersionsValue)(workingDirectory, 'golang'));
    if (toolVersion) {
        return toolVersion;
    }
    return (await (0, action_core_1.readMiseTomlVersion)(workingDirectory, 'go'))
        || (await (0, action_core_1.readMiseTomlVersion)(workingDirectory, 'golang'));
}
async function detectUvVersion(workingDirectory) {
    const toolVersion = await (0, action_core_1.readToolVersionsValue)(workingDirectory, 'uv');
    if (toolVersion) {
        return toolVersion;
    }
    return (0, action_core_1.readMiseTomlVersion)(workingDirectory, 'uv');
}
async function detectJavaVersion(workingDirectory) {
    const javaVersion = await readFirstLine(path.join(workingDirectory, '.java-version'));
    if (javaVersion) {
        return javaVersion;
    }
    const toolVersion = await (0, action_core_1.readToolVersionsValue)(workingDirectory, 'java');
    if (toolVersion) {
        return toolVersion;
    }
    const miseVersion = await (0, action_core_1.readMiseTomlVersion)(workingDirectory, 'java');
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
    const toolVersion = await (0, action_core_1.readToolVersionsValue)(workingDirectory, 'maven');
    if (toolVersion) {
        return toolVersion;
    }
    return (0, action_core_1.readMiseTomlVersion)(workingDirectory, 'maven');
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
    const toolVersion = await (0, action_core_1.readToolVersionsValue)(workingDirectory, 'rust');
    if (toolVersion) {
        return toolVersion;
    }
    return (0, action_core_1.readMiseTomlVersion)(workingDirectory, 'rust');
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
    return (0, action_core_1.buildMiseRuntimeTag)(cacheTagPrefix, tools, versionScope);
}
function buildRuntimeCacheEntry(cacheTagPrefix, runtimeCacheTag, tools, versionScope) {
    const runtimeTag = buildRuntimeCacheTag(cacheTagPrefix, runtimeCacheTag, tools, versionScope);
    if (!runtimeTag) {
        return null;
    }
    return `${runtimeTag}:${(0, action_core_1.getMiseInstallsDir)()}`;
}
function scopeTagToRuntimeTools(tag, tools, versionScope) {
    const runtimeTag = (0, action_core_1.buildMiseToolTag)(tools, versionScope);
    if (!runtimeTag || tag === runtimeTag || tag.endsWith(`-${runtimeTag}`)) {
        return tag;
    }
    return `${tag}-${runtimeTag}`;
}
function prefixArchiveTag(tag, cacheTag) {
    const prefix = cacheTag.trim();
    if (!prefix) {
        return tag;
    }
    if (tag === prefix || tag.startsWith(`${prefix}-`)) {
        return tag;
    }
    return `${prefix}-${tag}`;
}
function normalizeEntriesInput(entries) {
    return entries
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .join(',');
}
function scopeArchiveEntries(entries, cacheTag, tools, versionScope) {
    const normalizedEntries = normalizeEntriesInput(entries);
    if (!entries.trim() || tools.length === 0) {
        return (0, action_core_1.parseEntries)(normalizedEntries, 'restore', { resolvePaths: false })
            .map((entry) => {
            const prefixedTag = prefixArchiveTag(entry.tag, cacheTag);
            const pathSpec = entry.restorePath === entry.savePath
                ? entry.restorePath
                : `${entry.restorePath}=>${entry.savePath}`;
            return `${prefixedTag}:${pathSpec}`;
        })
            .join(',');
    }
    return (0, action_core_1.parseEntries)(normalizedEntries, 'restore', { resolvePaths: false })
        .map((entry) => {
        const prefixedTag = prefixArchiveTag(entry.tag, cacheTag);
        const scopedTag = scopeTagToRuntimeTools(prefixedTag, tools, versionScope);
        const pathSpec = entry.restorePath === entry.savePath
            ? entry.restorePath
            : `${entry.restorePath}=>${entry.savePath}`;
        return `${scopedTag}:${pathSpec}`;
    })
        .join(',');
}
async function detectDefaultArchiveEntries(inputs) {
    if (inputs.mode === 'maven') {
        return `maven-repo:${inputs.mavenLocalRepo}`;
    }
    if (inputs.preset === 'ruby') {
        return `bundler:${defaultBundlerPath(inputs.workingDirectory)}`;
    }
    if (inputs.preset === 'rails') {
        return joinDefaultEntries(`bundler:${defaultBundlerPath(inputs.workingDirectory)}`, await detectNodeDefaultArchiveEntries(inputs.workingDirectory));
    }
    if (inputs.mode === 'turbo-proxy' || inputs.preset === 'node' || inputs.preset === 'node-turbo') {
        return await detectNodeDefaultArchiveEntries(inputs.workingDirectory);
    }
    if (inputs.preset === 'python-uv') {
        return `uv-cache:${defaultUvCacheDir(inputs.workingDirectory)}`;
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
function defaultBundlerPath(workingDirectory) {
    var _a;
    const configured = (_a = process.env.BUNDLE_PATH) === null || _a === void 0 ? void 0 : _a.trim();
    if (!configured) {
        return 'vendor/bundle';
    }
    return path.isAbsolute(configured)
        ? configured
        : path.relative(workingDirectory, path.resolve(workingDirectory, configured)) || '.';
}
function defaultUvCacheDir(workingDirectory) {
    var _a;
    const configured = (_a = process.env.UV_CACHE_DIR) === null || _a === void 0 ? void 0 : _a.trim();
    if (!configured) {
        return '.uv-cache';
    }
    return path.isAbsolute(configured)
        ? configured
        : path.relative(workingDirectory, path.resolve(workingDirectory, configured)) || '.';
}
async function detectNodeDefaultArchiveEntries(workingDirectory) {
    const packageManager = await detectNodePackageManager(workingDirectory);
    if (!packageManager) {
        return '';
    }
    switch (packageManager.name) {
        case 'pnpm':
            return 'pnpm-store:.pnpm-store\nnode-modules:node_modules';
        case 'yarn':
            return 'yarn-cache:.yarn-cache\nnode-modules:node_modules';
        case 'npm':
            return 'npm-cache:.npm-cache\nnode-modules:node_modules';
    }
}
async function buildArchiveEntries(inputs, runtimeTools) {
    let archiveEntries = '';
    let usesCacheFormat = false;
    let sourceEntries = inputs.entries;
    if (sourceEntries) {
        archiveEntries = inputs.setup === 'mise'
            ? scopeArchiveEntries(sourceEntries, inputs.cacheTag, runtimeTools, inputs.toolVersionScope)
            : scopeArchiveEntries(sourceEntries, inputs.cacheTag, [], inputs.toolVersionScope);
    }
    else if (inputs.path || inputs.key) {
        if (!inputs.path || !inputs.key) {
            throw new Error('actions/cache compatibility mode requires both path and key');
        }
        archiveEntries = (0, action_core_1.convertCacheFormatToEntries)({
            path: inputs.path,
            key: inputs.key,
            noPlatform: inputs.noPlatform,
            enableCrossOsArchive: inputs.enableCrossOsArchive,
            workingDirectory: inputs.workingDirectory,
        }, 'restore');
        usesCacheFormat = true;
    }
    else {
        sourceEntries = await detectDefaultArchiveEntries(inputs);
        if (sourceEntries) {
            archiveEntries = inputs.setup === 'mise'
                ? scopeArchiveEntries(sourceEntries, inputs.cacheTag, runtimeTools, inputs.toolVersionScope)
                : scopeArchiveEntries(sourceEntries, inputs.cacheTag, [], inputs.toolVersionScope);
        }
    }
    return {
        entries: archiveEntries,
        usesCacheFormat,
    };
}
function validateOneInputs(inputs, modeSpec, runtimeTools, runtimeEntry, archiveEntries) {
    if (inputs.entries && (inputs.path || inputs.key)) {
        core.warning('Both explicit entries and actions/cache compatibility inputs were provided. Using entries.');
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
    const workspace = resolveWorkspace(inputs.workspace);
    const modeSpec = (0, modes_1.resolveModeSpec)(inputs.mode);
    (0, modes_1.assertImplementedMode)(modeSpec);
    const resolvedMavenVersion = inputs.mavenVersion || '3.9.9';
    const runtimeTools = await resolveRuntimeTools(inputs.setup, inputs.preset, inputs.mode, inputs.tools, inputs.workingDirectory, inputs.uvVersion);
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
    const cacheTagPrefix = getCacheTagPrefix(inputs, runtimeTools);
    const runtimeTag = inputs.setup === 'mise' && inputs.cacheRuntime
        ? buildRuntimeCacheTag(cacheTagPrefix, inputs.runtimeCacheTag, runtimeTools, inputs.toolVersionScope)
        : null;
    const runtimeEntry = inputs.setup === 'mise' && inputs.cacheRuntime
        ? buildRuntimeCacheEntry(cacheTagPrefix, inputs.runtimeCacheTag, runtimeTools, inputs.toolVersionScope)
        : null;
    const archiveEntries = await buildArchiveEntries(inputs, runtimeTools);
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
        archiveEntries: archiveEntries.entries,
        usesCacheFormat: archiveEntries.usesCacheFormat,
    };
}
function getCacheTagPrefix(inputs, runtimeTools) {
    if (inputs.cacheTag) {
        return inputs.cacheTag;
    }
    if (inputs.entries) {
        const firstEntry = (0, action_core_1.parseEntries)(normalizeEntriesInput(inputs.entries), 'restore', { resolvePaths: false })[0];
        if (firstEntry) {
            return firstEntry.tag;
        }
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
    return flagArgs;
}
async function applyMiseSetup(runtimeTools, _runtimeCacheHit, cwd) {
    void _runtimeCacheHit;
    if (runtimeTools.length === 0) {
        return false;
    }
    const pathAvailable = new Map();
    for (const tool of runtimeTools) {
        const available = await (0, action_core_1.hasToolVersionOnPath)(tool.name, tool.version);
        pathAvailable.set(`${tool.name}@${tool.version}`, available);
        if (available) {
            core.info(`Using existing ${tool.label} ${tool.version} from PATH`);
        }
    }
    const unresolvedTools = runtimeTools.filter((tool) => !pathAvailable.get(`${tool.name}@${tool.version}`));
    if (unresolvedTools.length === 0) {
        return false;
    }
    await (0, action_core_1.installMise)();
    for (const tool of unresolvedTools) {
        if (await (0, action_core_1.hasMiseToolVersion)(tool.name, tool.version)) {
            await (0, action_core_1.activateMiseTool)(tool.name, tool.version, { label: tool.label });
        }
        else {
            await (0, action_core_1.installMiseTool)(tool.name, tool.version, { label: tool.label });
        }
    }
    await (0, action_core_1.reshimMise)();
    await (0, action_core_1.exportMiseEnv)(cwd);
    return true;
}
function resolveCacheEnvPath(workingDirectory, configuredPath) {
    return path.isAbsolute(configuredPath)
        ? configuredPath
        : path.resolve(workingDirectory, configuredPath);
}
async function configureNodePresetEnv(workingDirectory) {
    const packageManager = await detectNodePackageManager(workingDirectory);
    if (!packageManager) {
        return;
    }
    const configuredCacheDir = packageManager.name === 'pnpm'
        ? process.env.PNPM_STORE_DIR || process.env.NPM_CONFIG_STORE_DIR || packageManager.cacheDir
        : packageManager.name === 'yarn'
            ? process.env.YARN_CACHE_FOLDER || packageManager.cacheDir
            : process.env.npm_config_cache || process.env.NPM_CONFIG_CACHE || packageManager.cacheDir;
    const cacheDir = resolveCacheEnvPath(workingDirectory, configuredCacheDir);
    await fs.promises.mkdir(cacheDir, { recursive: true });
    switch (packageManager.name) {
        case 'pnpm':
            core.exportVariable('PNPM_STORE_DIR', cacheDir);
            core.exportVariable('NPM_CONFIG_STORE_DIR', cacheDir);
            break;
        case 'yarn':
            core.exportVariable('YARN_CACHE_FOLDER', cacheDir);
            core.exportVariable('YARN_ENABLE_GLOBAL_CACHE', 'false');
            break;
        case 'npm':
            core.exportVariable('npm_config_cache', cacheDir);
            core.exportVariable('NPM_CONFIG_CACHE', cacheDir);
            break;
    }
}
async function configureRubyPresetEnv(workingDirectory) {
    var _a;
    const bundlePath = resolveCacheEnvPath(workingDirectory, ((_a = process.env.BUNDLE_PATH) === null || _a === void 0 ? void 0 : _a.trim()) || 'vendor/bundle');
    await fs.promises.mkdir(bundlePath, { recursive: true });
    core.exportVariable('BUNDLE_PATH', bundlePath);
}
async function configurePythonUvPresetEnv(workingDirectory) {
    var _a;
    const uvCacheDir = resolveCacheEnvPath(workingDirectory, ((_a = process.env.UV_CACHE_DIR) === null || _a === void 0 ? void 0 : _a.trim()) || '.uv-cache');
    await fs.promises.mkdir(uvCacheDir, { recursive: true });
    core.exportVariable('UV_CACHE_DIR', uvCacheDir);
}
async function applyPresetCacheEnv(plan) {
    switch (plan.preset) {
        case 'rails':
            await configureRubyPresetEnv(plan.workingDirectory);
            await configureNodePresetEnv(plan.workingDirectory);
            break;
        case 'ruby':
            await configureRubyPresetEnv(plan.workingDirectory);
            break;
        case 'node':
        case 'node-turbo':
            await configureNodePresetEnv(plan.workingDirectory);
            break;
        case 'python-uv':
            await configurePythonUvPresetEnv(plan.workingDirectory);
            break;
        default:
            break;
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
function getPlatformSuffix(noPlatform, enableCrossOsArchive) {
    if (noPlatform || enableCrossOsArchive) {
        return '';
    }
    const platform = os.platform() === 'darwin' ? 'darwin' : os.platform() === 'win32' ? 'windows' : 'linux';
    const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64';
    return `-${platform}-${arch}`;
}
