/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 840:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getAuthTokens = getAuthTokens;
exports.hasRestoreToken = hasRestoreToken;
exports.hasSaveToken = hasSaveToken;
exports.isUsingLegacyApiTokenOnly = isUsingLegacyApiTokenOnly;
exports.warnIfUsingLegacyApiToken = warnIfUsingLegacyApiToken;
exports.missingRestoreTokenMessage = missingRestoreTokenMessage;
exports.missingSaveTokenMessage = missingSaveTokenMessage;
const core = __importStar(__nccwpck_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module '@actions/core'"); e.code = 'MODULE_NOT_FOUND'; throw e; }())));
let warnedAboutLegacyApiToken = false;
function getAuthTokens() {
    const apiToken = process.env.BORINGCACHE_API_TOKEN || undefined;
    const saveToken = process.env.BORINGCACHE_SAVE_TOKEN || apiToken;
    const restoreToken = process.env.BORINGCACHE_RESTORE_TOKEN || saveToken;
    return {
        restoreToken,
        saveToken,
        apiToken,
    };
}
function hasRestoreToken() {
    return Boolean(getAuthTokens().restoreToken);
}
function hasSaveToken() {
    return Boolean(getAuthTokens().saveToken);
}
function isUsingLegacyApiTokenOnly() {
    return Boolean(process.env.BORINGCACHE_API_TOKEN &&
        !process.env.BORINGCACHE_RESTORE_TOKEN &&
        !process.env.BORINGCACHE_SAVE_TOKEN);
}
function warnIfUsingLegacyApiToken() {
    if (warnedAboutLegacyApiToken || !isUsingLegacyApiTokenOnly()) {
        return;
    }
    warnedAboutLegacyApiToken = true;
    core.notice('Using BORINGCACHE_API_TOKEN as a legacy compatibility fallback. Prefer BORINGCACHE_RESTORE_TOKEN and BORINGCACHE_SAVE_TOKEN for new workflows.');
}
function missingRestoreTokenMessage() {
    return 'A restore-capable token is required. Set BORINGCACHE_RESTORE_TOKEN, BORINGCACHE_SAVE_TOKEN, or BORINGCACHE_API_TOKEN.';
}
function missingSaveTokenMessage() {
    return 'A save-capable token is required. Set BORINGCACHE_SAVE_TOKEN or BORINGCACHE_API_TOKEN.';
}


/***/ }),

/***/ 796:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.hasToolVersionOnPath = exports.hasMiseToolVersion = exports.readProjectMiseTools = exports.readMiseTomlVersion = exports.readMiseTomlTools = exports.readToolVersionsValue = exports.readToolVersions = exports.exportMiseEnv = exports.reshimMise = exports.activateMiseTool = exports.installMiseTool = exports.installMise = exports.buildMiseRuntimeTag = exports.buildMiseToolTag = exports.scopeMiseToolVersion = exports.slugMiseTagPart = exports.getMiseShimsDir = exports.getMiseInstallsDir = exports.getMiseDataDir = exports.getMiseBinPath = exports.findAvailablePort = exports.waitForOciRefsReadable = exports.stopRegistryProxy = exports.startRegistryProxy = exports.convertCacheFormatToEntries = exports.getInputsWorkspace = exports.getPlatformSuffix = exports.parseEntries = exports.resolvePaths = exports.resolvePath = exports.validateInputs = exports.getCacheConfig = exports.pathExists = exports.getCacheTagPrefix = exports.getWorkspace = exports.missingSaveTokenMessage = exports.missingRestoreTokenMessage = exports.warnIfUsingLegacyApiToken = exports.isUsingLegacyApiTokenOnly = exports.hasSaveToken = exports.hasRestoreToken = exports.getAuthTokens = exports.getToolCacheInfo = exports.isCliAvailable = exports.execBoringCache = exports.ensureBoringCache = void 0;
var setup_1 = __nccwpck_require__(529);
Object.defineProperty(exports, "ensureBoringCache", ({ enumerable: true, get: function () { return setup_1.ensureBoringCache; } }));
Object.defineProperty(exports, "execBoringCache", ({ enumerable: true, get: function () { return setup_1.execBoringCache; } }));
Object.defineProperty(exports, "isCliAvailable", ({ enumerable: true, get: function () { return setup_1.isCliAvailable; } }));
Object.defineProperty(exports, "getToolCacheInfo", ({ enumerable: true, get: function () { return setup_1.getToolCacheInfo; } }));
var auth_1 = __nccwpck_require__(840);
Object.defineProperty(exports, "getAuthTokens", ({ enumerable: true, get: function () { return auth_1.getAuthTokens; } }));
Object.defineProperty(exports, "hasRestoreToken", ({ enumerable: true, get: function () { return auth_1.hasRestoreToken; } }));
Object.defineProperty(exports, "hasSaveToken", ({ enumerable: true, get: function () { return auth_1.hasSaveToken; } }));
Object.defineProperty(exports, "isUsingLegacyApiTokenOnly", ({ enumerable: true, get: function () { return auth_1.isUsingLegacyApiTokenOnly; } }));
Object.defineProperty(exports, "warnIfUsingLegacyApiToken", ({ enumerable: true, get: function () { return auth_1.warnIfUsingLegacyApiToken; } }));
Object.defineProperty(exports, "missingRestoreTokenMessage", ({ enumerable: true, get: function () { return auth_1.missingRestoreTokenMessage; } }));
Object.defineProperty(exports, "missingSaveTokenMessage", ({ enumerable: true, get: function () { return auth_1.missingSaveTokenMessage; } }));
var workspace_1 = __nccwpck_require__(245);
Object.defineProperty(exports, "getWorkspace", ({ enumerable: true, get: function () { return workspace_1.getWorkspace; } }));
Object.defineProperty(exports, "getCacheTagPrefix", ({ enumerable: true, get: function () { return workspace_1.getCacheTagPrefix; } }));
Object.defineProperty(exports, "pathExists", ({ enumerable: true, get: function () { return workspace_1.pathExists; } }));
var inputs_1 = __nccwpck_require__(579);
Object.defineProperty(exports, "getCacheConfig", ({ enumerable: true, get: function () { return inputs_1.getCacheConfig; } }));
Object.defineProperty(exports, "validateInputs", ({ enumerable: true, get: function () { return inputs_1.validateInputs; } }));
Object.defineProperty(exports, "resolvePath", ({ enumerable: true, get: function () { return inputs_1.resolvePath; } }));
Object.defineProperty(exports, "resolvePaths", ({ enumerable: true, get: function () { return inputs_1.resolvePaths; } }));
Object.defineProperty(exports, "parseEntries", ({ enumerable: true, get: function () { return inputs_1.parseEntries; } }));
Object.defineProperty(exports, "getPlatformSuffix", ({ enumerable: true, get: function () { return inputs_1.getPlatformSuffix; } }));
Object.defineProperty(exports, "getInputsWorkspace", ({ enumerable: true, get: function () { return inputs_1.getInputsWorkspace; } }));
Object.defineProperty(exports, "convertCacheFormatToEntries", ({ enumerable: true, get: function () { return inputs_1.convertCacheFormatToEntries; } }));
var proxy_1 = __nccwpck_require__(328);
Object.defineProperty(exports, "startRegistryProxy", ({ enumerable: true, get: function () { return proxy_1.startRegistryProxy; } }));
Object.defineProperty(exports, "stopRegistryProxy", ({ enumerable: true, get: function () { return proxy_1.stopRegistryProxy; } }));
Object.defineProperty(exports, "waitForOciRefsReadable", ({ enumerable: true, get: function () { return proxy_1.waitForOciRefsReadable; } }));
Object.defineProperty(exports, "findAvailablePort", ({ enumerable: true, get: function () { return proxy_1.findAvailablePort; } }));
var mise_1 = __nccwpck_require__(476);
Object.defineProperty(exports, "getMiseBinPath", ({ enumerable: true, get: function () { return mise_1.getMiseBinPath; } }));
Object.defineProperty(exports, "getMiseDataDir", ({ enumerable: true, get: function () { return mise_1.getMiseDataDir; } }));
Object.defineProperty(exports, "getMiseInstallsDir", ({ enumerable: true, get: function () { return mise_1.getMiseInstallsDir; } }));
Object.defineProperty(exports, "getMiseShimsDir", ({ enumerable: true, get: function () { return mise_1.getMiseShimsDir; } }));
Object.defineProperty(exports, "slugMiseTagPart", ({ enumerable: true, get: function () { return mise_1.slugMiseTagPart; } }));
Object.defineProperty(exports, "scopeMiseToolVersion", ({ enumerable: true, get: function () { return mise_1.scopeMiseToolVersion; } }));
Object.defineProperty(exports, "buildMiseToolTag", ({ enumerable: true, get: function () { return mise_1.buildMiseToolTag; } }));
Object.defineProperty(exports, "buildMiseRuntimeTag", ({ enumerable: true, get: function () { return mise_1.buildMiseRuntimeTag; } }));
Object.defineProperty(exports, "installMise", ({ enumerable: true, get: function () { return mise_1.installMise; } }));
Object.defineProperty(exports, "installMiseTool", ({ enumerable: true, get: function () { return mise_1.installMiseTool; } }));
Object.defineProperty(exports, "activateMiseTool", ({ enumerable: true, get: function () { return mise_1.activateMiseTool; } }));
Object.defineProperty(exports, "reshimMise", ({ enumerable: true, get: function () { return mise_1.reshimMise; } }));
Object.defineProperty(exports, "exportMiseEnv", ({ enumerable: true, get: function () { return mise_1.exportMiseEnv; } }));
Object.defineProperty(exports, "readToolVersions", ({ enumerable: true, get: function () { return mise_1.readToolVersions; } }));
Object.defineProperty(exports, "readToolVersionsValue", ({ enumerable: true, get: function () { return mise_1.readToolVersionsValue; } }));
Object.defineProperty(exports, "readMiseTomlTools", ({ enumerable: true, get: function () { return mise_1.readMiseTomlTools; } }));
Object.defineProperty(exports, "readMiseTomlVersion", ({ enumerable: true, get: function () { return mise_1.readMiseTomlVersion; } }));
Object.defineProperty(exports, "readProjectMiseTools", ({ enumerable: true, get: function () { return mise_1.readProjectMiseTools; } }));
Object.defineProperty(exports, "hasMiseToolVersion", ({ enumerable: true, get: function () { return mise_1.hasMiseToolVersion; } }));
Object.defineProperty(exports, "hasToolVersionOnPath", ({ enumerable: true, get: function () { return mise_1.hasToolVersionOnPath; } }));


/***/ }),

/***/ 579:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getCacheConfig = getCacheConfig;
exports.validateInputs = validateInputs;
exports.resolvePath = resolvePath;
exports.resolvePaths = resolvePaths;
exports.parseEntries = parseEntries;
exports.getPlatformSuffix = getPlatformSuffix;
exports.getInputsWorkspace = getInputsWorkspace;
exports.convertCacheFormatToEntries = convertCacheFormatToEntries;
const core = __importStar(__nccwpck_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module '@actions/core'"); e.code = 'MODULE_NOT_FOUND'; throw e; }())));
const os = __importStar(__nccwpck_require__(857));
const path = __importStar(__nccwpck_require__(928));
async function getCacheConfig(key, enableCrossOsArchive, noPlatform = false) {
    let workspace = process.env.BORINGCACHE_DEFAULT_WORKSPACE ||
        'default/default';
    if (!workspace.includes('/')) {
        workspace = `default/${workspace}`;
    }
    let platformSuffix = '';
    if (!noPlatform && !enableCrossOsArchive) {
        const platform = os.platform() === 'darwin' ? 'darwin' : os.platform() === 'win32' ? 'windows' : 'linux';
        const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64';
        platformSuffix = `-${platform}-${arch}`;
    }
    const fullKey = key + platformSuffix;
    return { workspace, fullKey, platformSuffix };
}
function validateInputs(inputs) {
    const hasCliFormat = inputs.workspace || inputs.entries;
    const hasCacheFormat = inputs.path || inputs.key;
    if (!hasCliFormat && !hasCacheFormat) {
        throw new Error('Either (workspace + entries) or (path + key) inputs are required');
    }
    if (hasCliFormat && hasCacheFormat) {
        core.warning('Both CLI format (workspace/entries) and actions/cache format (path/key) provided. Using CLI format.');
    }
    if (hasCliFormat && !inputs.entries) {
        throw new Error('Input "entries" is required when using CLI format');
    }
    if (hasCacheFormat && !hasCliFormat) {
        if (!inputs.path) {
            throw new Error('Input "path" is required when using actions/cache format');
        }
        if (!inputs.key) {
            throw new Error('Input "key" is required when using actions/cache format');
        }
    }
    if (inputs.workspace && typeof inputs.workspace === 'string' && !inputs.workspace.includes('/')) {
        throw new Error('Workspace must be in format "namespace/workspace" (e.g., "my-org/my-project")');
    }
}
function resolvePath(pathInput, baseDir) {
    const trimmedPath = pathInput.trim();
    if (path.isAbsolute(trimmedPath)) {
        return trimmedPath;
    }
    if (trimmedPath.startsWith('~/')) {
        return path.join(os.homedir(), trimmedPath.slice(2));
    }
    return path.resolve(baseDir || process.cwd(), trimmedPath);
}
function resolvePaths(pathInput, baseDir) {
    return pathInput
        .split('\n')
        .map(p => p.trim())
        .filter(p => p)
        .map(p => resolvePath(p, baseDir))
        .join('\n');
}
function parseEntries(entriesInput, _action, options = {}) {
    const shouldResolve = options.resolvePaths ?? true;
    const baseDir = options.baseDir;
    return entriesInput
        .split(/\r?\n|,/)
        .map(entry => entry.trim())
        .filter(entry => entry)
        .map(entry => {
        const colonIndex = entry.indexOf(':');
        if (colonIndex === -1) {
            throw new Error(`Invalid entry format: ${entry}. Expected format: tag:path or tag:restore_path=>save_path`);
        }
        const tag = entry.substring(0, colonIndex).trim();
        const pathSpec = entry.substring(colonIndex + 1).trim();
        if (!tag) {
            throw new Error(`Invalid entry format: ${entry}. Tag cannot be empty`);
        }
        let restorePathInput = pathSpec;
        let savePathInput = pathSpec;
        const redirectIndex = pathSpec.indexOf('=>');
        if (redirectIndex !== -1) {
            restorePathInput = pathSpec.substring(0, redirectIndex).trim();
            savePathInput = pathSpec.substring(redirectIndex + 2).trim();
            if (!restorePathInput || !savePathInput) {
                throw new Error(`Invalid entry format: ${entry}. Expected restore and save paths when using => syntax`);
            }
        }
        const restorePath = shouldResolve ? resolvePath(restorePathInput, baseDir) : restorePathInput;
        const savePath = shouldResolve ? resolvePath(savePathInput, baseDir) : savePathInput;
        return { tag, restorePath, savePath };
    });
}
function getPlatformSuffix(noPlatform, enableCrossOsArchive) {
    if (noPlatform || enableCrossOsArchive) {
        return '';
    }
    const platform = os.platform() === 'darwin' ? 'darwin' : os.platform() === 'win32' ? 'windows' : 'linux';
    const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64';
    return `-${platform}-${arch}`;
}
/**
 * Get workspace from action inputs (Record-based).
 * Used by the generic action/save/restore actions.
 * NOTE: This is different from workspace.ts getWorkspace which takes a string.
 */
function getInputsWorkspace(inputs) {
    if (inputs.workspace && typeof inputs.workspace === 'string') {
        return inputs.workspace;
    }
    const defaultWorkspace = process.env.BORINGCACHE_DEFAULT_WORKSPACE;
    if (defaultWorkspace) {
        return defaultWorkspace.includes('/') ? defaultWorkspace : `default/${defaultWorkspace}`;
    }
    return 'default/default';
}
function convertCacheFormatToEntries(inputs, _action) {
    if (!inputs.path || !inputs.key) {
        throw new Error('actions/cache format requires both path and key inputs');
    }
    const pathInput = inputs.path;
    const keyInput = inputs.key;
    const noPlatformInput = inputs.noPlatform;
    const enableCrossOsArchiveInput = inputs.enableCrossOsArchive;
    const workingDirectoryInput = inputs.workingDirectory;
    const baseDir = workingDirectoryInput?.trim() || undefined;
    const paths = pathInput
        .split('\n')
        .map(p => p.trim())
        .filter(p => p);
    const shouldDisablePlatform = noPlatformInput || enableCrossOsArchiveInput || false;
    const platformSuffix = getPlatformSuffix(shouldDisablePlatform, enableCrossOsArchiveInput || false);
    const fullKey = keyInput + platformSuffix;
    return paths.map(p => `${fullKey}:${resolvePath(p, baseDir)}`).join(',');
}


/***/ }),

/***/ 476:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getMiseBinPath = getMiseBinPath;
exports.getMiseDataDir = getMiseDataDir;
exports.getMiseInstallsDir = getMiseInstallsDir;
exports.getMiseShimsDir = getMiseShimsDir;
exports.slugMiseTagPart = slugMiseTagPart;
exports.scopeMiseToolVersion = scopeMiseToolVersion;
exports.buildMiseToolTag = buildMiseToolTag;
exports.buildMiseRuntimeTag = buildMiseRuntimeTag;
exports.hasMiseToolVersion = hasMiseToolVersion;
exports.hasToolVersionOnPath = hasToolVersionOnPath;
exports.installMise = installMise;
exports.installMiseTool = installMiseTool;
exports.activateMiseTool = activateMiseTool;
exports.reshimMise = reshimMise;
exports.exportMiseEnv = exportMiseEnv;
exports.readToolVersions = readToolVersions;
exports.readToolVersionsValue = readToolVersionsValue;
exports.readMiseTomlTools = readMiseTomlTools;
exports.readMiseTomlVersion = readMiseTomlVersion;
exports.readProjectMiseTools = readProjectMiseTools;
const core = __importStar(__nccwpck_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module '@actions/core'"); e.code = 'MODULE_NOT_FOUND'; throw e; }())));
const exec = __importStar(__nccwpck_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module '@actions/exec'"); e.code = 'MODULE_NOT_FOUND'; throw e; }())));
const cache = __importStar(__nccwpck_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module '@actions/cache'"); e.code = 'MODULE_NOT_FOUND'; throw e; }())));
const crypto = __importStar(__nccwpck_require__(982));
const fs = __importStar(__nccwpck_require__(896));
const os = __importStar(__nccwpck_require__(857));
const path = __importStar(__nccwpck_require__(928));
const tc = __importStar(__nccwpck_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module '@actions/tool-cache'"); e.code = 'MODULE_NOT_FOUND'; throw e; }())));
const isWindows = process.platform === 'win32';
const MISE_TOOL_NAME = 'mise';
const MISE_RELEASES_BASE = 'https://github.com/jdx/mise/releases/download';
const DEFAULT_MISE_VERSION = 'v2026.3.8';
function runnerHomeDir() {
    return process.env.HOME || process.env.USERPROFILE || os.homedir();
}
function getMiseBinPath() {
    const homedir = runnerHomeDir();
    return isWindows
        ? path.join(homedir, '.local', 'bin', 'mise.exe')
        : path.join(homedir, '.local', 'bin', 'mise');
}
function getMiseDataDir() {
    if (isWindows) {
        return path.join(process.env.LOCALAPPDATA || path.join(runnerHomeDir(), 'AppData', 'Local'), 'mise');
    }
    return path.join(runnerHomeDir(), '.local', 'share', 'mise');
}
function getMiseInstallsDir() {
    return process.env.MISE_INSTALLS_DIR || path.join(getMiseDataDir(), 'installs');
}
function getMiseShimsDir() {
    return path.join(getMiseDataDir(), 'shims');
}
function slugMiseTagPart(value) {
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/^v(?=\d)/, '')
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[.-]+|[.-]+$/g, '');
    return normalized || 'unknown';
}
function scopeMiseToolVersion(version, scope = 'patch') {
    const normalized = version.trim().replace(/^v(?=\d)/, '');
    const match = normalized.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
    if (!match) {
        return slugMiseTagPart(normalized);
    }
    const [, major, minor, patch] = match;
    if (scope === 'major' || !minor) {
        return major;
    }
    if (scope === 'minor' || !patch) {
        return `${major}.${minor}`;
    }
    return `${major}.${minor}.${patch}`;
}
function buildMiseToolTag(tools, scope = 'patch') {
    return tools
        .map((tool) => `${slugMiseTagPart(tool.name)}-${slugMiseTagPart(scopeMiseToolVersion(tool.version, scope))}`)
        .sort()
        .join('-');
}
function buildMiseRuntimeTag(prefix, tools, scope = 'patch') {
    const toolTag = buildMiseToolTag(tools, scope);
    if (!toolTag) {
        return slugMiseTagPart(prefix);
    }
    return `${slugMiseTagPart(prefix)}-mise-${toolTag}`;
}
async function hasMiseToolVersion(toolName, version) {
    const normalizedTool = normalizeToolName(toolName);
    let output = '';
    const exitCode = await exec.exec(getMiseBinPath(), ['ls', normalizedTool, '--installed', '--json'], {
        ignoreReturnCode: true,
        silent: true,
        listeners: {
            stdout: (data) => {
                output += data.toString();
            },
        },
    });
    if (exitCode !== 0 || !output.trim()) {
        return false;
    }
    let entries;
    try {
        const parsed = JSON.parse(output);
        if (Array.isArray(parsed)) {
            entries = parsed;
        }
        else if (Array.isArray(parsed?.versions)) {
            entries = parsed.versions;
        }
        else {
            return false;
        }
    }
    catch {
        return false;
    }
    return entries.some((entry) => entry.installed !== false && isMatchingToolVersion(version, entry.version || ''));
}
async function hasToolVersionOnPath(toolName, version) {
    const normalizedTool = normalizeToolName(toolName);
    const probes = getToolVersionProbes(normalizedTool);
    for (const probe of probes) {
        const detectedVersion = await detectToolVersion(probe);
        if (detectedVersion && isMatchingToolVersion(version, detectedVersion)) {
            return true;
        }
    }
    return false;
}
async function installMise() {
    const version = getMiseVersion();
    const normalizedVersion = version.replace(/^v/, '');
    const platform = getMisePlatformInfo();
    const cacheInfo = getMiseToolCacheInfo(version, platform);
    const toolCacheRoot = process.env.RUNNER_TOOL_CACHE || '/opt/hostedtoolcache';
    const cachePaths = [`${toolCacheRoot}/${MISE_TOOL_NAME}`];
    let restoredFromCache = false;
    try {
        const cacheKey = await cache.restoreCache(cachePaths, cacheInfo.cacheKey);
        if (cacheKey) {
            core.info(`Restored mise from cache (key: ${cacheKey})`);
            restoredFromCache = true;
        }
    }
    catch (error) {
        core.debug(`mise cache restore failed: ${error instanceof Error ? error.message : error}`);
    }
    let toolPath = tc.find(MISE_TOOL_NAME, normalizedVersion);
    if (toolPath) {
        core.info(`Using cached mise ${version}`);
    }
    else {
        core.info(`Installing mise ${version}...`);
        toolPath = await downloadAndInstallMise(version, platform);
        try {
            await cache.saveCache(cachePaths, cacheInfo.cacheKey);
            core.info(`Saved mise to cache (key: ${cacheInfo.cacheKey})`);
        }
        catch (error) {
            core.debug(`mise cache save failed: ${error instanceof Error ? error.message : error}`);
        }
    }
    if (!toolPath) {
        throw new Error(`Failed to install mise ${version}`);
    }
    if (restoredFromCache && !tc.find(MISE_TOOL_NAME, normalizedVersion)) {
        core.debug(`mise cache restored but tool cache lookup for ${version} remained empty`);
    }
    await materializeMiseBinary(toolPath, platform);
    core.addPath(path.dirname(getMiseBinPath()));
    core.addPath(getMiseShimsDir());
    core.info(`mise ${version} ready`);
}
function getMiseVersion() {
    const value = process.env.MISE_VERSION || DEFAULT_MISE_VERSION;
    return value.startsWith('v') ? value : `v${value}`;
}
function getMisePlatformInfo() {
    const runnerOS = process.env.RUNNER_OS || os.platform();
    const runnerArch = process.env.RUNNER_ARCH || os.arch();
    const osName = normalizeRunnerOs(runnerOS);
    const arch = normalizeRunnerArch(runnerArch);
    const version = getMiseVersion();
    if (osName === 'windows') {
        return {
            os: osName,
            arch,
            assetName: `mise-${version}-windows-${arch}.zip`,
            binaryName: 'mise.exe',
            isWindows: true,
        };
    }
    return {
        os: osName,
        arch,
        assetName: `mise-${version}-${osName}-${arch}`,
        binaryName: 'mise',
        isWindows: false,
    };
}
function normalizeRunnerOs(value) {
    const normalized = value.toLowerCase();
    if (normalized === 'darwin' || normalized === 'macos') {
        return 'macos';
    }
    if (normalized === 'win32' || normalized === 'windows') {
        return 'windows';
    }
    if (normalized === 'linux') {
        return 'linux';
    }
    throw new Error(`Unsupported platform for mise: OS=${value}`);
}
function normalizeRunnerArch(value) {
    const normalized = value.toLowerCase();
    if (normalized === 'x64' || normalized === 'amd64') {
        return 'x64';
    }
    if (normalized === 'arm64' || normalized === 'aarch64') {
        return 'arm64';
    }
    throw new Error(`Unsupported architecture for mise: ARCH=${value}`);
}
function getMiseToolCacheInfo(version, platform) {
    const normalizedVersion = version.replace(/^v/, '');
    const toolCacheRoot = process.env.RUNNER_TOOL_CACHE || '/opt/hostedtoolcache';
    return {
        cacheKey: `${MISE_TOOL_NAME}-${normalizedVersion}-${platform.os}-${platform.arch}`,
        cachePattern: `${toolCacheRoot}/${MISE_TOOL_NAME}/${normalizedVersion}*`,
    };
}
function getMiseDownloadUrl(version, assetName) {
    return `${MISE_RELEASES_BASE}/${version}/${assetName}`;
}
function getMiseChecksumsUrl(version) {
    return `${MISE_RELEASES_BASE}/${version}/SHASUMS256.txt`;
}
async function computeFileHash(filePath) {
    const fileBuffer = await fs.promises.readFile(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}
function parseChecksums(content, assetName) {
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }
        const match = trimmed.match(/^([a-f0-9]{64})\s+(.+)$/i);
        if (!match) {
            continue;
        }
        const [, hash, filename] = match;
        if (filename === assetName || filename.endsWith(`/${assetName}`)) {
            return hash.toLowerCase();
        }
    }
    return null;
}
async function getExpectedChecksum(version, assetName) {
    const checksumsPath = await tc.downloadTool(getMiseChecksumsUrl(version));
    const content = await fs.promises.readFile(checksumsPath, 'utf-8');
    const checksum = parseChecksums(content, assetName);
    if (!checksum) {
        throw new Error(`Checksum not found for mise asset: ${assetName}`);
    }
    return checksum;
}
async function verifyChecksum(filePath, expectedChecksum, assetName) {
    const actualChecksum = await computeFileHash(filePath);
    if (actualChecksum !== expectedChecksum) {
        throw new Error(`Checksum verification failed for ${assetName}:\n` +
            `  Expected: ${expectedChecksum}\n` +
            `  Actual:   ${actualChecksum}`);
    }
}
async function downloadAndInstallMise(version, platform) {
    const downloadUrl = getMiseDownloadUrl(version, platform.assetName);
    core.info(`Downloading mise from: ${downloadUrl}`);
    const downloadedPath = await tc.downloadTool(downloadUrl);
    const expectedChecksum = await getExpectedChecksum(version, platform.assetName);
    await verifyChecksum(downloadedPath, expectedChecksum, platform.assetName);
    const versionDir = version.replace(/^v/, '').replace(/[^A-Za-z0-9._-]/g, '_') || 'unknown';
    const installDir = path.join(os.tmpdir(), 'mise-install', versionDir);
    // mise install paths are rooted under the runner temp directory with a sanitized version segment.
    // codeql[js/path-injection]
    await fs.promises.mkdir(installDir, { recursive: true });
    const binaryPath = path.join(installDir, platform.binaryName);
    if (platform.isWindows) {
        const extractedPath = await tc.extractZip(downloadedPath);
        const extractedBinary = await findMiseBinary(extractedPath, platform.binaryName);
        // The source is the verified mise archive and the destination is the sanitized temp install dir.
        // codeql[js/path-injection]
        await fs.promises.copyFile(extractedBinary, binaryPath);
    }
    else {
        // The source is the verified mise download and the destination is the sanitized temp install dir.
        // codeql[js/path-injection]
        await fs.promises.copyFile(downloadedPath, binaryPath);
        // codeql[js/path-injection]
        await fs.promises.chmod(binaryPath, 0o755);
    }
    return tc.cacheDir(installDir, MISE_TOOL_NAME, version.replace(/^v/, ''));
}
async function materializeMiseBinary(toolPath, platform) {
    const sourceBinary = path.join(toolPath, platform.binaryName);
    const targetBinary = getMiseBinPath();
    // The mise bin directory is action-owned runner state.
    // codeql[js/path-injection]
    await fs.promises.mkdir(path.dirname(targetBinary), { recursive: true });
    // The source comes from the Actions tool cache and target is action-owned runner state.
    // codeql[js/path-injection]
    await fs.promises.copyFile(sourceBinary, targetBinary);
    if (!platform.isWindows) {
        await fs.promises.chmod(targetBinary, 0o755);
    }
}
async function findMiseBinary(extractedPath, binaryName) {
    const candidates = [
        path.join(extractedPath, 'mise', 'bin', binaryName),
        path.join(extractedPath, 'bin', binaryName),
        path.join(extractedPath, binaryName),
    ];
    for (const candidate of candidates) {
        try {
            await fs.promises.access(candidate);
            return candidate;
        }
        catch {
            continue;
        }
    }
    throw new Error(`Unable to locate ${binaryName} in extracted mise archive`);
}
async function installMiseTool(toolName, version, options = {}) {
    const spec = `${toolName}@${version}`;
    const label = options.label || toolName;
    const global = options.global ?? true;
    core.info(`Installing ${label} ${version} via mise...`);
    await exec.exec(getMiseBinPath(), ['install', spec], { env: options.env });
    await exec.exec(getMiseBinPath(), buildUseArgs(spec, global), { env: options.env });
}
function normalizeToolVersion(value) {
    return value.trim().replace(/^v(?=\d)/, '');
}
function isMatchingToolVersion(requested, candidate) {
    const normalizedRequested = normalizeToolVersion(requested);
    const normalizedCandidate = normalizeToolVersion(candidate);
    if (!normalizedRequested || !normalizedCandidate) {
        return false;
    }
    const requestedParts = extractNumericVersionParts(normalizedRequested);
    const candidateParts = extractNumericVersionParts(normalizedCandidate);
    if (requestedParts.length > 0 || candidateParts.length > 0) {
        if (requestedParts.length === 0 || requestedParts.length > candidateParts.length) {
            return false;
        }
        return requestedParts.every((part, index) => part === candidateParts[index]);
    }
    return slugMiseTagPart(normalizedRequested) === slugMiseTagPart(normalizedCandidate);
}
function extractNumericVersionParts(value) {
    const baseVersion = normalizeToolVersion(value).split('+')[0].trim();
    const numericPrefix = baseVersion.match(/^\d+(?:\.\d+)*/)?.[0];
    if (!numericPrefix) {
        return [];
    }
    return numericPrefix
        .split('.')
        .map(normalizeVersionSegment)
        .filter(Boolean);
}
function normalizeVersionSegment(value) {
    const trimmed = value.trim();
    if (!trimmed) {
        return '';
    }
    const numericMatch = trimmed.match(/^\d+/);
    return numericMatch ? numericMatch[0] : trimmed;
}
async function detectToolVersion(probe) {
    let stdout = '';
    let stderr = '';
    let exitCode;
    try {
        exitCode = await exec.exec(probe.command, probe.args, {
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
    }
    catch (error) {
        core.debug(`Skipping PATH probe for ${probe.command}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
    if (exitCode !== 0) {
        return null;
    }
    const output = probe.stream === 'stderr'
        ? stderr
        : probe.stream === 'combined'
            ? `${stdout}\n${stderr}`
            : stdout;
    return extractVersionFromOutput(output, probe.versionPattern);
}
function extractVersionFromOutput(output, versionPattern) {
    const pattern = versionPattern || /\bv?(\d+(?:\.\d+)*(?:[-+][0-9A-Za-z.-]+)?)\b/;
    const match = output.match(pattern);
    if (!match) {
        return null;
    }
    return match[1] || match[0] || null;
}
function getToolVersionProbes(toolName) {
    switch (toolName) {
        case 'bazel':
            return [
                { command: 'bazel', args: ['--version'], versionPattern: /bazel\s+([0-9A-Za-z.+-]+)/i },
                { command: 'bazelisk', args: ['version'], versionPattern: /Build label:\s*([0-9A-Za-z.+-]+)/i, stream: 'combined' },
            ];
        case 'bun':
            return [{ command: 'bun', args: ['--version'] }];
        case 'elixir':
            return [{ command: 'elixir', args: ['--version'], versionPattern: /Elixir\s+([0-9A-Za-z.+-]+)/i, stream: 'combined' }];
        case 'erlang':
            return [{
                    command: 'erl',
                    args: ['-noshell', '-eval', 'io:format("~s", [erlang:system_info(otp_release)]), halt().'],
                }];
        case 'go':
            return [{ command: 'go', args: ['version'], versionPattern: /go version go([0-9A-Za-z.+-]+)/i }];
        case 'gradle':
            return [{ command: 'gradle', args: ['--version'], versionPattern: /Gradle\s+([0-9A-Za-z.+-]+)/i }];
        case 'java':
            return [{ command: 'java', args: ['-version'], versionPattern: /version\s+"([0-9A-Za-z.+-]+)"/i, stream: 'stderr' }];
        case 'maven':
            return [{ command: 'mvn', args: ['--version'], versionPattern: /Apache Maven\s+([0-9A-Za-z.+-]+)/i }];
        case 'node':
            return [{ command: 'node', args: ['--version'] }];
        case 'npm':
            return [{ command: 'npm', args: ['--version'] }];
        case 'pnpm':
            return [{ command: 'pnpm', args: ['--version'] }];
        case 'composer':
            return [{ command: 'composer', args: ['--version'], versionPattern: /Composer version\s+([0-9A-Za-z.+-]+)/i, stream: 'combined' }];
        case 'php':
            return [{ command: 'php', args: ['--version'], versionPattern: /PHP\s+([0-9A-Za-z.+-]+)/i, stream: 'combined' }];
        case 'python':
            return [
                { command: 'python3', args: ['--version'], versionPattern: /Python\s+([0-9A-Za-z.+-]+)/i, stream: 'combined' },
                { command: 'python', args: ['--version'], versionPattern: /Python\s+([0-9A-Za-z.+-]+)/i, stream: 'combined' },
            ];
        case 'ruby':
            return [{ command: 'ruby', args: ['--version'], versionPattern: /ruby\s+([0-9A-Za-z.+-]+)/i }];
        case 'rust':
            return [{ command: 'rustc', args: ['--version'], versionPattern: /rustc\s+([0-9A-Za-z.+-]+)/i }];
        case 'sccache':
            return [{ command: 'sccache', args: ['--version'], versionPattern: /sccache\s+([0-9A-Za-z.+-]+)/i }];
        case 'turbo':
            return [{ command: 'turbo', args: ['--version'] }];
        case 'uv':
            return [{ command: 'uv', args: ['--version'] }];
        case 'yarn':
            return [{ command: 'yarn', args: ['--version'] }];
        default:
            return [];
    }
}
async function activateMiseTool(toolName, version, options = {}) {
    const spec = `${toolName}@${version}`;
    const label = options.label || toolName;
    const global = options.global ?? true;
    core.info(`Activating ${label} ${version}...`);
    await exec.exec(getMiseBinPath(), buildUseArgs(spec, global), { env: options.env });
}
async function reshimMise(force = true) {
    const args = force ? ['reshim', '-f'] : ['reshim'];
    core.info('Refreshing mise shims...');
    await exec.exec(getMiseBinPath(), args);
}
async function exportMiseEnv(cwd) {
    core.info('Exporting mise environment...');
    const envVars = await readMiseEnvJson(cwd);
    if (envVars) {
        for (const [key, value] of Object.entries(envVars)) {
            if (typeof value === 'string') {
                core.exportVariable(key, value);
            }
        }
        return;
    }
    const dotenv = await readMiseEnvDotenv(cwd);
    for (const [key, value] of parseDotenvLines(dotenv)) {
        core.exportVariable(key, value);
    }
}
function buildUseArgs(spec, global) {
    return global ? ['use', '-g', spec] : ['use', spec];
}
async function readMiseEnvJson(cwd) {
    let output = '';
    const exitCode = await exec.exec(getMiseBinPath(), ['env', '--json'], {
        cwd,
        ignoreReturnCode: true,
        silent: true,
        listeners: {
            stdout: (data) => {
                output += data.toString();
            },
        },
    });
    if (exitCode !== 0 || !output.trim()) {
        return null;
    }
    try {
        const parsed = JSON.parse(output);
        return Object.fromEntries(Object.entries(parsed).filter((entry) => typeof entry[1] === 'string'));
    }
    catch {
        return null;
    }
}
async function readMiseEnvDotenv(cwd) {
    let output = '';
    const exitCode = await exec.exec(getMiseBinPath(), ['env', '--dotenv'], {
        cwd,
        ignoreReturnCode: true,
        silent: true,
        listeners: {
            stdout: (data) => {
                output += data.toString();
            },
        },
    });
    if (exitCode !== 0) {
        throw new Error('Failed to export mise environment');
    }
    return output;
}
function parseDotenvLines(content) {
    const entries = [];
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }
        const separatorIndex = line.indexOf('=');
        if (separatorIndex <= 0) {
            continue;
        }
        const key = line.slice(0, separatorIndex).trim();
        const rawValue = line.slice(separatorIndex + 1).trim();
        const value = rawValue.replace(/^['"]|['"]$/g, '');
        if (key) {
            entries.push([key, value]);
        }
    }
    return entries;
}
async function readToolVersions(workingDir) {
    const toolVersionsPath = path.join(workingDir, '.tool-versions');
    try {
        const content = await fs.promises.readFile(toolVersionsPath, 'utf-8');
        const tools = new Map();
        for (const rawLine of content.split(/\r?\n/)) {
            const line = stripTomlComment(rawLine).trim();
            if (!line) {
                continue;
            }
            const [toolName, version] = line.split(/\s+/, 3);
            if (!toolName || !version) {
                continue;
            }
            tools.set(normalizeToolName(toolName), version.trim());
        }
        return Array.from(tools, ([name, version]) => ({ name, version }));
    }
    catch {
        return [];
    }
}
async function readToolVersionsValue(workingDir, toolName) {
    const normalizedToolName = normalizeToolName(toolName);
    const tools = await readToolVersions(workingDir);
    return tools.find((tool) => tool.name === normalizedToolName)?.version || null;
}
async function readMiseTomlTools(workingDir) {
    const miseToml = path.join(workingDir, 'mise.toml');
    try {
        const content = await fs.promises.readFile(miseToml, 'utf-8');
        const toolsBlock = extractToolsBlock(content);
        if (!toolsBlock) {
            return [];
        }
        const tools = new Map();
        const lines = toolsBlock.split(/\r?\n/);
        for (let index = 0; index < lines.length; index += 1) {
            const parsedLine = stripTomlComment(lines[index]).trim();
            if (!parsedLine) {
                continue;
            }
            const assignmentMatch = parsedLine.match(/^([A-Za-z0-9._-]+)\s*=\s*(.+)$/);
            if (!assignmentMatch) {
                continue;
            }
            const [, rawToolName, rawValue] = assignmentMatch;
            const toolName = normalizeToolName(rawToolName);
            const value = rawValue.trim();
            const stringVersion = value.match(/^["']([^"']+)["']$/);
            if (stringVersion?.[1]) {
                tools.set(toolName, stringVersion[1]);
                continue;
            }
            const inlineVersion = extractInlineTableVersion(value);
            if (inlineVersion) {
                tools.set(toolName, inlineVersion);
                continue;
            }
            if (value.startsWith('{')) {
                let blockValue = value;
                let braceDepth = countBraceDelta(value);
                while (braceDepth > 0 && index + 1 < lines.length) {
                    index += 1;
                    const nextLine = stripTomlComment(lines[index]).trim();
                    blockValue = `${blockValue}\n${nextLine}`;
                    braceDepth += countBraceDelta(nextLine);
                }
                const blockVersion = extractInlineTableVersion(blockValue);
                if (blockVersion) {
                    tools.set(toolName, blockVersion);
                }
            }
        }
        return Array.from(tools, ([name, version]) => ({ name, version }));
    }
    catch {
        return [];
    }
}
async function readMiseTomlVersion(workingDir, toolName) {
    const normalizedToolName = normalizeToolName(toolName);
    const tools = await readMiseTomlTools(workingDir);
    return tools.find((tool) => tool.name === normalizedToolName)?.version || null;
}
async function readProjectMiseTools(workingDir) {
    const toolVersions = await readToolVersions(workingDir);
    const miseTomlTools = await readMiseTomlTools(workingDir);
    const merged = new Map();
    for (const tool of toolVersions) {
        merged.set(tool.name, tool.version);
    }
    for (const tool of miseTomlTools) {
        merged.set(tool.name, tool.version);
    }
    return Array.from(merged, ([name, version]) => ({ name, version }));
}
function extractToolsBlock(content) {
    const lines = content.split(/\r?\n/);
    const block = [];
    let inToolsBlock = false;
    for (const rawLine of lines) {
        const line = stripTomlComment(rawLine).trim();
        if (!inToolsBlock) {
            if (line === '[tools]') {
                inToolsBlock = true;
            }
            continue;
        }
        if (line.startsWith('[') && line.endsWith(']')) {
            break;
        }
        block.push(rawLine);
    }
    return inToolsBlock ? block.join('\n') : null;
}
function extractInlineTableVersion(value) {
    const versionMatch = value.match(/\bversion\s*=\s*["']([^"']+)["']/);
    return versionMatch?.[1] || null;
}
function countBraceDelta(value) {
    let delta = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let isEscaped = false;
    for (const character of value) {
        if (isEscaped) {
            isEscaped = false;
            continue;
        }
        if (character === '\\' && inDoubleQuote) {
            isEscaped = true;
            continue;
        }
        if (!inDoubleQuote && character === '\'') {
            inSingleQuote = !inSingleQuote;
            continue;
        }
        if (!inSingleQuote && character === '"') {
            inDoubleQuote = !inDoubleQuote;
            continue;
        }
        if (inSingleQuote || inDoubleQuote) {
            continue;
        }
        if (character === '{') {
            delta += 1;
        }
        else if (character === '}') {
            delta -= 1;
        }
    }
    return delta;
}
function stripTomlComment(value) {
    let result = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let isEscaped = false;
    for (const character of value) {
        if (isEscaped) {
            result += character;
            isEscaped = false;
            continue;
        }
        if (character === '\\' && inDoubleQuote) {
            result += character;
            isEscaped = true;
            continue;
        }
        if (!inDoubleQuote && character === '\'') {
            inSingleQuote = !inSingleQuote;
            result += character;
            continue;
        }
        if (!inSingleQuote && character === '"') {
            inDoubleQuote = !inDoubleQuote;
            result += character;
            continue;
        }
        if (!inSingleQuote && !inDoubleQuote && character === '#') {
            break;
        }
        result += character;
    }
    return result;
}
function normalizeToolName(value) {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'nodejs') {
        return 'node';
    }
    if (normalized === 'golang') {
        return 'go';
    }
    return normalized;
}


/***/ }),

/***/ 328:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.normalizeProxyTags = normalizeProxyTags;
exports.waitForOciImportReadiness = waitForOciImportReadiness;
exports.waitForOciRefsReadable = waitForOciRefsReadable;
exports.logOciImportReadiness = logOciImportReadiness;
exports.assertOciImportReady = assertOciImportReady;
exports.startRegistryProxy = startRegistryProxy;
exports.stopRegistryProxy = stopRegistryProxy;
exports.findAvailablePort = findAvailablePort;
const core = __importStar(__nccwpck_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module '@actions/core'"); e.code = 'MODULE_NOT_FOUND'; throw e; }())));
const fs = __importStar(__nccwpck_require__(896));
const http = __importStar(__nccwpck_require__(611));
const net = __importStar(__nccwpck_require__(278));
const os = __importStar(__nccwpck_require__(857));
const path = __importStar(__nccwpck_require__(928));
const child_process_1 = __nccwpck_require__(317);
const auth_1 = __nccwpck_require__(840);
const PROXY_PID_FILE = path.join(os.tmpdir(), 'boringcache-proxy.pid');
const PROXY_READY_TIMEOUT_MS = 300000;
const PROXY_READY_POLL_INTERVAL_MS = 200;
const PROXY_READY_WARN_INTERVAL_MS = 10000;
const OCI_IMPORT_READY_TIMEOUT_MS = 15000;
const OCI_IMPORT_READY_POLL_INTERVAL_MS = 1000;
const OCI_REF_READY_POLL_INTERVAL_MS = 1000;
const DEFAULT_OCI_HYDRATION_POLICY = 'metadata-only';
function normalizeProxyTags(tagInput) {
    const tags = [];
    const seen = new Set();
    for (const rawTag of tagInput.split(',')) {
        const tag = rawTag.trim();
        if (!tag || seen.has(tag)) {
            continue;
        }
        seen.add(tag);
        tags.push(tag);
    }
    if (tags.length === 0) {
        throw new Error('At least one proxy tag is required');
    }
    return tags.join(',');
}
function isProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
function proxyLogPath(port) {
    return path.join(os.tmpdir(), `boringcache-proxy-${port}.log`);
}
function readProxyLogs(port) {
    try {
        return fs.readFileSync(proxyLogPath(port), 'utf-8').trim();
    }
    catch {
        return '';
    }
}
function proxyProbeHost(host) {
    return host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
}
async function isProxyRunning(host, port) {
    const probeHost = proxyProbeHost(host);
    return await new Promise((resolve) => {
        const socket = net.createConnection({ host: probeHost, port });
        let settled = false;
        const finish = (value) => {
            if (settled) {
                return;
            }
            settled = true;
            socket.destroy();
            resolve(value);
        };
        socket.setTimeout(1000);
        socket.once('connect', () => finish(true));
        socket.once('timeout', () => finish(false));
        socket.once('error', () => finish(false));
        socket.once('close', () => finish(false));
    });
}
function proxyReadyFilePath(port) {
    return path.join(os.tmpdir(), `boringcache-proxy-${port}.ready`);
}
function clearProxyReadyFile(readyFile) {
    try {
        fs.unlinkSync(readyFile);
    }
    catch {
        // Ignore missing or inaccessible ready markers; startup will recreate them.
    }
}
async function waitForProxyReadyFile(readyFile, timeoutMs = PROXY_READY_TIMEOUT_MS, port, pid) {
    const start = Date.now();
    let lastLogAt = 0;
    while (Date.now() - start < timeoutMs) {
        if (fs.existsSync(readyFile)) {
            const elapsed = ((Date.now() - start) / 1000).toFixed(1);
            core.info(`BoringCache proxy is ready (${elapsed}s)`);
            clearProxyReadyFile(readyFile);
            return;
        }
        if (pid && pid > 0 && !isProcessAlive(pid)) {
            const logs = port ? readProxyLogs(port) : '';
            throw new Error(`BoringCache proxy exited before becoming ready${logs ? `:\n${logs}` : ''}`);
        }
        const elapsed = Date.now() - start;
        if (elapsed - lastLogAt >= PROXY_READY_WARN_INTERVAL_MS) {
            core.info(`Waiting for proxy readiness... (${(elapsed / 1000).toFixed(0)}s)`);
            lastLogAt = elapsed;
        }
        await new Promise((resolve) => setTimeout(resolve, PROXY_READY_POLL_INTERVAL_MS));
    }
    const logs = port ? readProxyLogs(port) : '';
    throw new Error(`BoringCache proxy did not become ready within ${timeoutMs}ms${logs ? `:\n${logs}` : ''}`);
}
function httpRequest(options) {
    return new Promise((resolve, reject) => {
        const request = http.request(options, (response) => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
                body += chunk;
            });
            response.on('end', () => {
                resolve({
                    statusCode: response.statusCode || 0,
                    body,
                });
            });
        });
        request.on('error', reject);
        request.end();
    });
}
async function fetchProxyStatus(host, port) {
    try {
        const response = await httpRequest({
            host: proxyProbeHost(host),
            port,
            path: '/_boringcache/status',
            method: 'GET',
        });
        if (response.statusCode < 200 || response.statusCode >= 300) {
            return null;
        }
        return JSON.parse(response.body);
    }
    catch {
        return null;
    }
}
async function isManifestReadable(host, port, ref) {
    try {
        const response = await httpRequest({
            host: proxyProbeHost(host),
            port,
            path: `/v2/cache/manifests/${encodeURIComponent(ref)}`,
            method: 'HEAD',
            headers: {
                Accept: [
                    'application/vnd.oci.image.manifest.v1+json',
                    'application/vnd.oci.image.index.v1+json',
                    'application/vnd.docker.distribution.manifest.v2+json',
                    'application/vnd.docker.distribution.manifest.list.v2+json',
                ].join(', '),
            },
        });
        return response.statusCode >= 200 && response.statusCode < 300;
    }
    catch {
        return false;
    }
}
async function readOciRefReadiness(host, port, refs) {
    const readability = await Promise.all(refs.map(async (ref) => ({ ref, readable: await isManifestReadable(host, port, ref) })));
    return {
        readableRefs: readability.filter((entry) => entry.readable).map((entry) => entry.ref),
        unreadableRefs: readability.filter((entry) => !entry.readable).map((entry) => entry.ref),
    };
}
async function waitForOciImportReadiness(host, port, requestedRefs, timeoutMs = OCI_IMPORT_READY_TIMEOUT_MS) {
    const refs = requestedRefs.map((ref) => ref.trim()).filter(Boolean);
    if (refs.length === 0) {
        return {
            requestedRefs: [],
            readableRefs: [],
            unreadableRefs: [],
            ready: true,
        };
    }
    const startedAt = Date.now();
    let lastStatus = null;
    while (Date.now() - startedAt < timeoutMs) {
        lastStatus = await fetchProxyStatus(host, port);
        const { readableRefs, unreadableRefs } = await readOciRefReadiness(host, port, refs);
        if (readableRefs.length > 0) {
            return {
                requestedRefs: refs,
                readableRefs,
                unreadableRefs,
                ready: unreadableRefs.length === 0,
                phase: lastStatus?.phase,
                publishState: lastStatus?.publish_state,
                publishSettled: lastStatus?.publish_settled,
                tagsVisible: lastStatus?.tags_visible,
            };
        }
        await new Promise((resolve) => setTimeout(resolve, OCI_IMPORT_READY_POLL_INTERVAL_MS));
    }
    const { readableRefs, unreadableRefs } = await readOciRefReadiness(host, port, refs);
    return {
        requestedRefs: refs,
        readableRefs,
        unreadableRefs,
        ready: unreadableRefs.length === 0,
        phase: lastStatus?.phase,
        publishState: lastStatus?.publish_state,
        publishSettled: lastStatus?.publish_settled,
        tagsVisible: lastStatus?.tags_visible,
    };
}
async function waitForOciRefsReadable(host, port, requestedRefs, timeoutMs = 60_000) {
    const refs = requestedRefs.map((ref) => ref.trim()).filter(Boolean);
    if (refs.length === 0) {
        return {
            requestedRefs: [],
            readableRefs: [],
            unreadableRefs: [],
            ready: true,
        };
    }
    const startedAt = Date.now();
    let lastStatus = null;
    while (Date.now() - startedAt < timeoutMs) {
        lastStatus = await fetchProxyStatus(host, port);
        const { readableRefs, unreadableRefs } = await readOciRefReadiness(host, port, refs);
        if (unreadableRefs.length === 0) {
            return {
                requestedRefs: refs,
                readableRefs,
                unreadableRefs,
                ready: true,
                phase: lastStatus?.phase,
                publishState: lastStatus?.publish_state,
                publishSettled: lastStatus?.publish_settled,
                tagsVisible: lastStatus?.tags_visible,
            };
        }
        await new Promise((resolve) => setTimeout(resolve, OCI_REF_READY_POLL_INTERVAL_MS));
    }
    const { readableRefs, unreadableRefs } = await readOciRefReadiness(host, port, refs);
    return {
        requestedRefs: refs,
        readableRefs,
        unreadableRefs,
        ready: unreadableRefs.length === 0,
        phase: lastStatus?.phase,
        publishState: lastStatus?.publish_state,
        publishSettled: lastStatus?.publish_settled,
        tagsVisible: lastStatus?.tags_visible,
    };
}
function logOciImportReadiness(readiness) {
    if (readiness.ready) {
        core.info(`BoringCache proxy OCI import refs are readable: ${readiness.readableRefs.join(', ')}`);
        return;
    }
    const statusSuffix = [
        readiness.phase ? `phase=${readiness.phase}` : '',
        readiness.publishState ? `publish=${readiness.publishState}` : '',
        typeof readiness.publishSettled === 'boolean'
            ? `publish_settled=${readiness.publishSettled}`
            : '',
        typeof readiness.tagsVisible === 'boolean'
            ? `tags_visible=${readiness.tagsVisible}`
            : '',
    ]
        .filter(Boolean)
        .join(' ');
    const message = `BoringCache proxy became ready before OCI import refs were fully readable. readable=[${readiness.readableRefs.join(', ')}] unreadable=[${readiness.unreadableRefs.join(', ')}]${statusSuffix ? ` ${statusSuffix}` : ''}`;
    if (readiness.readableRefs.length === 0) {
        core.notice(`${message}. Continuing without registry imports; this is expected for cold seed jobs.`);
        return;
    }
    core.warning(message);
}
function assertOciImportReady(readiness) {
    if (readiness.ready) {
        return;
    }
    if (readiness.readableRefs.length === 0) {
        throw new Error(`No OCI cache import refs were readable. requested=[${readiness.requestedRefs.join(', ')}]`);
    }
    throw new Error(`Some OCI cache import refs were unreadable. readable=[${readiness.readableRefs.join(', ')}] unreadable=[${readiness.unreadableRefs.join(', ')}]`);
}
/**
 * Start the BoringCache proxy.
 * Spawns a detached boringcache process, writes PID file, returns handle.
 */
async function startRegistryProxy(options) {
    (0, auth_1.warnIfUsingLegacyApiToken)();
    const { restoreToken, saveToken } = (0, auth_1.getAuthTokens)();
    let effectiveReadOnly = options.readOnly === true;
    let authToken = effectiveReadOnly ? restoreToken : saveToken;
    if (!authToken && !effectiveReadOnly && restoreToken) {
        effectiveReadOnly = true;
        authToken = restoreToken;
        core.info('No save-capable token configured; starting cache-registry in read-only mode with BORINGCACHE_RESTORE_TOKEN');
    }
    if (!authToken) {
        if (effectiveReadOnly) {
            throw new Error(`${(0, auth_1.missingRestoreTokenMessage)()} This is required for proxy mode.`);
        }
        throw new Error(`${(0, auth_1.missingSaveTokenMessage)()} This is required for proxy mode.`);
    }
    const host = options.host || '127.0.0.1';
    const cliCommand = 'cache-registry';
    const normalizedTags = normalizeProxyTags(options.tag);
    const readyFile = proxyReadyFilePath(options.port);
    if (await isProxyRunning(host, options.port)) {
        core.info(`BoringCache proxy already running on port ${options.port}, reusing`);
        try {
            const pid = parseInt(fs.readFileSync(PROXY_PID_FILE, 'utf-8').trim(), 10);
            if (pid > 0)
                return { pid, port: options.port, readOnly: effectiveReadOnly };
        }
        catch { }
        return { pid: -1, port: options.port, readOnly: effectiveReadOnly };
    }
    clearProxyReadyFile(readyFile);
    const args = [cliCommand, options.workspace, normalizedTags];
    if (options.noGit) {
        args.push('--no-git');
    }
    if (options.noPlatform) {
        args.push('--no-platform');
    }
    args.push('--host', host, '--port', String(options.port));
    args.push('--ready-file', readyFile);
    if (options.onDemand) {
        args.push('--on-demand');
    }
    for (const ref of options.ociPrefetchRefs || []) {
        const trimmed = ref.trim();
        if (trimmed) {
            args.push('--oci-prefetch-ref', trimmed);
        }
    }
    for (const ref of options.ociAliasPromotionRefs || []) {
        const trimmed = ref.trim();
        if (trimmed) {
            args.push('--oci-alias-promotion-ref', trimmed);
        }
    }
    const ociHydration = (options.ociHydration || DEFAULT_OCI_HYDRATION_POLICY).trim();
    if (ociHydration) {
        args.push('--oci-hydration', ociHydration);
    }
    for (const [key, value] of Object.entries(options.metadataHints || {})) {
        args.push('--metadata-hint', `${key}=${value}`);
    }
    if (effectiveReadOnly) {
        args.push('--read-only');
    }
    const strictCacheErrors = options.failOnCacheError ?? !effectiveReadOnly;
    if (strictCacheErrors) {
        args.push('--fail-on-cache-error');
    }
    if (options.verbose) {
        args.push('--verbose');
    }
    core.info(`Starting BoringCache proxy on ${host}:${options.port}...`);
    const logFile = proxyLogPath(options.port);
    const logFd = fs.openSync(logFile, 'w');
    const child = (0, child_process_1.spawn)('boringcache', args, {
        detached: true,
        stdio: ['ignore', logFd, logFd],
        env: {
            ...process.env,
            BORINGCACHE_API_TOKEN: authToken,
        }
    });
    child.unref();
    fs.closeSync(logFd);
    if (!child.pid) {
        throw new Error('Failed to start BoringCache proxy');
    }
    fs.writeFileSync(PROXY_PID_FILE, String(child.pid));
    core.info(`BoringCache proxy started (PID: ${child.pid})`);
    const handle = { pid: child.pid, port: options.port, readOnly: effectiveReadOnly };
    try {
        await waitForProxyReadyFile(readyFile, PROXY_READY_TIMEOUT_MS, options.port, child.pid);
        if (options.ociRequiredReadableRefs?.length) {
            const ociImportReadiness = await waitForOciImportReadiness(host, options.port, options.ociRequiredReadableRefs, options.ociImportReadyTimeoutMs);
            logOciImportReadiness(ociImportReadiness);
            if (options.requireOciImportReady) {
                assertOciImportReady(ociImportReadiness);
            }
            return {
                ...handle,
                ociImportReadiness,
            };
        }
        if (options.requireOciImportReady) {
            throw new Error('No OCI cache import refs were requested while require-oci-import-ready was enabled.');
        }
        return handle;
    }
    catch (error) {
        try {
            await stopRegistryProxy(child.pid, options.port);
        }
        catch {
            // Keep the original readiness failure as the primary error.
        }
        clearProxyReadyFile(readyFile);
        throw error;
    }
}
/**
 * Graceful stop: send SIGTERM and wait for the proxy to exit on its own.
 * The proxy handles SIGTERM by flushing all pending blobs to the backend,
 * then exits. Never send SIGKILL — the proxy owns its own shutdown timing.
 */
async function stopRegistryProxy(pid, port) {
    if (pid <= 0) {
        core.info('No proxy PID to stop (was reused from another invocation)');
        return;
    }
    core.info(`Stopping BoringCache proxy (PID: ${pid})...`);
    try {
        process.kill(pid, 'SIGTERM');
    }
    catch (err) {
        const code = err.code;
        if (code === 'ESRCH') {
            core.info(`BoringCache proxy (PID: ${pid}) already exited`);
            return;
        }
        core.warning(`Failed to send SIGTERM to BoringCache proxy: ${err.message}`);
        return;
    }
    const start = Date.now();
    const pollInterval = 1000;
    const logInterval = 30_000;
    let lastLog = start;
    while (true) {
        if (!isProcessAlive(pid)) {
            if (port) {
                const logs = readProxyLogs(port);
                const shutdownTimeout = logs.match(/Shutdown: flush timeout reached[^\n]*/i);
                const checkpointTimeout = logs.match(/Shutdown: checkpoint promotion timeout reached[^\n]*/i);
                const shutdownError = logs.match(/Error:\s+[^\n]*(pending entries|checkpoint|cache publish)[^\n]*/i);
                const failure = shutdownTimeout || checkpointTimeout || shutdownError;
                if (failure) {
                    throw new Error(`BoringCache proxy shutdown failed: ${failure[0]}`);
                }
            }
            core.info(`BoringCache proxy exited gracefully after ${Math.round((Date.now() - start) / 1000)}s`);
            return;
        }
        const now = Date.now();
        if (now - lastLog >= logInterval) {
            core.info(`Waiting for BoringCache proxy to flush and exit... (${Math.round((now - start) / 1000)}s elapsed)`);
            lastLog = now;
        }
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
}
/**
 * Bind to port 0 and return the assigned port.
 */
async function findAvailablePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            if (addr && typeof addr !== 'string') {
                const port = addr.port;
                server.close(() => resolve(port));
            }
            else {
                server.close(() => reject(new Error('Failed to get port')));
            }
        });
        server.on('error', reject);
    });
}


/***/ }),

/***/ 529:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getToolCacheInfo = getToolCacheInfo;
exports.getStableCliBinDir = getStableCliBinDir;
exports.exposeBoringCacheCli = exposeBoringCacheCli;
exports.isCliAvailable = isCliAvailable;
exports.ensureBoringCache = ensureBoringCache;
exports.execBoringCache = execBoringCache;
const core = __importStar(__nccwpck_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module '@actions/core'"); e.code = 'MODULE_NOT_FOUND'; throw e; }())));
const exec = __importStar(__nccwpck_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module '@actions/exec'"); e.code = 'MODULE_NOT_FOUND'; throw e; }())));
const tc = __importStar(__nccwpck_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module '@actions/tool-cache'"); e.code = 'MODULE_NOT_FOUND'; throw e; }())));
const cache = __importStar(__nccwpck_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module '@actions/cache'"); e.code = 'MODULE_NOT_FOUND'; throw e; }())));
const crypto = __importStar(__nccwpck_require__(982));
const fs = __importStar(__nccwpck_require__(896));
const os = __importStar(__nccwpck_require__(857));
const path = __importStar(__nccwpck_require__(928));
const auth_1 = __nccwpck_require__(840);
const TOOL_NAME = 'boringcache';
const GITHUB_RELEASES_BASE = 'https://github.com/boringcache/cli/releases/download';
/**
 * Get tool cache information for a specific version.
 * Use this to persist the tool cache across workflow runs with actions/cache.
 */
function getToolCacheInfo(version, platformOverride) {
    const normalizedVersion = version.replace(/^v/, '');
    const platform = getPlatformInfo(platformOverride);
    const cachePath = tc.find(TOOL_NAME, normalizedVersion, platform.cacheKey);
    const toolCacheRoot = process.env.RUNNER_TOOL_CACHE || '/opt/hostedtoolcache';
    return {
        toolName: TOOL_NAME,
        version: normalizedVersion,
        cachePath: cachePath || null,
        cachePattern: `${toolCacheRoot}/${TOOL_NAME}/${normalizedVersion}*`,
        cacheKey: `${TOOL_NAME}-${normalizedVersion}-${platform.os}-${platform.cacheKey}`,
        platformKey: platform.cacheKey,
    };
}
function getStableCliBinDir() {
    return path.join(os.homedir(), '.boringcache', 'bin');
}
async function exposeBoringCacheCli(toolPath, binaryName = process.platform === 'win32' ? 'boringcache.exe' : 'boringcache', stableBinDir = getStableCliBinDir()) {
    const sourcePath = path.join(toolPath, binaryName);
    const stablePath = path.join(stableBinDir, binaryName);
    // The source is the selected CLI binary in the hosted tool cache; the destination is runner-local action state.
    // codeql[js/path-injection]
    await fs.promises.mkdir(stableBinDir, { recursive: true });
    // codeql[js/path-injection]
    await fs.promises.copyFile(sourcePath, stablePath);
    if (process.platform !== 'win32') {
        // codeql[js/path-injection]
        await fs.promises.chmod(stablePath, 0o755);
    }
    return stableBinDir;
}
function getPlatformInfo(platformOverride) {
    if (platformOverride) {
        const normalizedPlatform = platformOverride.trim().toLowerCase();
        const isWindows = normalizedPlatform.includes('windows');
        const arch = normalizedPlatform.includes('arm64') ? 'arm64' : 'amd64';
        const legacyAssetName = `boringcache-${normalizedPlatform}${isWindows && !normalizedPlatform.endsWith('.exe') ? '.exe' : ''}`;
        if (isWindows) {
            const assetName = `boringcache-windows-${arch}.exe`;
            return {
                os: 'windows',
                arch,
                assetName,
                fallbackAssetName: legacyAssetName === assetName ? undefined : legacyAssetName,
                isWindows: true,
                cacheKey: arch,
            };
        }
        if (normalizedPlatform.includes('macos') || normalizedPlatform.includes('darwin')) {
            const assetName = 'boringcache-macos-universal';
            return {
                os: 'macos',
                arch,
                assetName,
                fallbackAssetName: legacyAssetName === assetName ? undefined : legacyAssetName,
                isWindows: false,
                cacheKey: 'universal',
            };
        }
        const usesMusl = normalizedPlatform.includes('alpine') || normalizedPlatform.includes('musl');
        const genericPlatform = `linux${usesMusl ? '-musl' : ''}-${arch}`;
        const assetName = `boringcache-${genericPlatform}`;
        return {
            os: 'linux',
            arch,
            assetName,
            fallbackAssetName: legacyAssetName === assetName ? undefined : legacyAssetName,
            isWindows: false,
            cacheKey: usesMusl ? `musl-${arch}` : arch,
        };
    }
    const runnerOS = process.env.RUNNER_OS || os.platform();
    const runnerArch = process.env.RUNNER_ARCH || os.arch();
    let normalizedOS = runnerOS;
    let normalizedArch = runnerArch;
    if (runnerOS === 'darwin' || runnerOS === 'Darwin') {
        normalizedOS = 'macOS';
    }
    else if (runnerOS === 'win32' || runnerOS === 'Windows') {
        normalizedOS = 'Windows';
    }
    else if (runnerOS === 'linux' || runnerOS === 'Linux') {
        normalizedOS = 'Linux';
    }
    if (runnerArch === 'x64' || runnerArch === 'X64' || runnerArch === 'amd64') {
        normalizedArch = 'X64';
    }
    else if (runnerArch === 'arm64' || runnerArch === 'ARM64' || runnerArch === 'aarch64') {
        normalizedArch = 'ARM64';
    }
    const isWindows = normalizedOS === 'Windows';
    let assetName;
    switch (normalizedOS) {
        case 'Linux':
            assetName = normalizedArch === 'ARM64' ? 'boringcache-linux-arm64' : 'boringcache-linux-amd64';
            break;
        case 'macOS':
            assetName = 'boringcache-macos-universal';
            break;
        case 'Windows':
            assetName = normalizedArch === 'ARM64' ? 'boringcache-windows-arm64.exe' : 'boringcache-windows-amd64.exe';
            break;
        default:
            throw new Error(`Unsupported platform: OS=${runnerOS}, ARCH=${runnerArch}`);
    }
    return {
        os: normalizedOS.toLowerCase(),
        arch: normalizedArch.toLowerCase(),
        assetName,
        isWindows,
        cacheKey: normalizedOS === 'macOS'
            ? 'universal'
            : normalizedArch === 'ARM64'
                ? 'arm64'
                : 'amd64',
    };
}
function getDownloadUrl(version, assetName) {
    return `${GITHUB_RELEASES_BASE}/${version}/${assetName}`;
}
function getChecksumsUrl(version) {
    return `${GITHUB_RELEASES_BASE}/${version}/SHA256SUMS`;
}
/**
 * Compute SHA256 hash of a file
 */
async function computeFileHash(filePath) {
    const fileBuffer = await fs.promises.readFile(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}
/**
 * Parse SHA256SUMS file content and extract checksum for a specific asset
 * Format: <sha256>  <filename> (two spaces between hash and filename)
 * or: <sha256> <filename> (single space)
 */
function parseChecksums(content, assetName) {
    const lines = content.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        // Match either "hash  filename" or "hash filename"
        const match = trimmed.match(/^([a-f0-9]{64})\s+(.+)$/i);
        if (match) {
            const [, hash, filename] = match;
            // Match exact filename or filename at end of path
            if (filename === assetName || filename.endsWith(`/${assetName}`)) {
                return hash.toLowerCase();
            }
        }
    }
    return null;
}
/**
 * Download SHA256SUMS and get expected checksum for the asset
 */
async function getExpectedChecksum(version, assetName) {
    const checksumsUrl = getChecksumsUrl(version);
    core.debug(`Downloading checksums from: ${checksumsUrl}`);
    try {
        const checksumsPath = await tc.downloadTool(checksumsUrl);
        const content = await fs.promises.readFile(checksumsPath, 'utf-8');
        const checksum = parseChecksums(content, assetName);
        if (!checksum) {
            throw new Error(`Checksum not found for asset: ${assetName}`);
        }
        return checksum;
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to fetch checksums from ${checksumsUrl}: ${msg}`);
    }
}
/**
 * Verify file checksum matches expected value
 */
async function verifyChecksum(filePath, expectedChecksum, assetName) {
    const actualChecksum = await computeFileHash(filePath);
    if (actualChecksum !== expectedChecksum) {
        throw new Error(`Checksum verification failed for ${assetName}:\n` +
            `  Expected: ${expectedChecksum}\n` +
            `  Actual:   ${actualChecksum}`);
    }
    core.info(`Checksum verified for ${assetName}`);
}
async function downloadAndInstall(version, platform, verify) {
    let resolvedAssetName = platform.assetName;
    let downloadUrl = getDownloadUrl(version, resolvedAssetName);
    core.info(`Downloading BoringCache CLI from: ${downloadUrl}`);
    let downloadedPath;
    try {
        downloadedPath = await tc.downloadTool(downloadUrl);
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (platform.fallbackAssetName) {
            resolvedAssetName = platform.fallbackAssetName;
            downloadUrl = getDownloadUrl(version, resolvedAssetName);
            core.info(`Primary CLI asset ${platform.assetName} unavailable (${msg}); trying legacy fallback: ${resolvedAssetName}`);
            try {
                downloadedPath = await tc.downloadTool(downloadUrl);
            }
            catch (fallbackError) {
                const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
                if (fallbackMsg.includes('404')) {
                    throw new Error(`Failed to download BoringCache CLI ${version} (${platform.assetName}, fallback ${resolvedAssetName}): ` +
                        'release asset not found. The requested cli-version may not be published yet.');
                }
                throw new Error(`Failed to download BoringCache CLI ${version} (${platform.assetName}, fallback ${resolvedAssetName}): ${fallbackMsg}`);
            }
        }
        else if (msg.includes('404')) {
            throw new Error(`Failed to download BoringCache CLI ${version} (${platform.assetName}) from ${downloadUrl}: ` +
                'release asset not found. The requested cli-version may not be published yet.');
        }
        else {
            throw new Error(`Failed to download BoringCache CLI ${version} (${platform.assetName}) from ${downloadUrl}: ${msg}`);
        }
    }
    // Verify checksum if enabled
    if (verify) {
        const expectedChecksum = await getExpectedChecksum(version, resolvedAssetName);
        await verifyChecksum(downloadedPath, expectedChecksum, resolvedAssetName);
    }
    else {
        core.warning('Checksum verification disabled - this is not recommended for production use');
    }
    const binaryName = platform.isWindows ? 'boringcache.exe' : 'boringcache';
    const installDir = path.join(os.tmpdir(), 'boringcache-install', version);
    await fs.promises.mkdir(installDir, { recursive: true });
    const binaryPath = path.join(installDir, binaryName);
    await fs.promises.copyFile(downloadedPath, binaryPath);
    if (!platform.isWindows) {
        await fs.promises.chmod(binaryPath, 0o755);
    }
    const cachedPath = await tc.cacheDir(installDir, TOOL_NAME, version.replace(/^v/, ''), platform.cacheKey);
    return cachedPath;
}
async function isCliAvailable() {
    try {
        let output = '';
        const result = await exec.exec('boringcache', ['--version'], {
            ignoreReturnCode: true,
            silent: true,
            listeners: {
                stdout: (data) => { output += data.toString(); },
                stderr: (data) => { output += data.toString(); }
            }
        });
        return result === 0 && output.includes('boringcache');
    }
    catch {
        return false;
    }
}
async function ensureBoringCache(options) {
    (0, auth_1.warnIfUsingLegacyApiToken)();
    const secrets = new Set([
        options.token,
        process.env.BORINGCACHE_RESTORE_TOKEN,
        process.env.BORINGCACHE_SAVE_TOKEN,
        process.env.BORINGCACHE_API_TOKEN,
    ].filter((value) => Boolean(value)));
    for (const secret of secrets) {
        core.setSecret(secret);
    }
    const shouldRequireServerSignature = options.requireServerSignature !== false;
    if (shouldRequireServerSignature && !process.env.BORINGCACHE_REQUIRE_SERVER_SIGNATURE) {
        core.exportVariable('BORINGCACHE_REQUIRE_SERVER_SIGNATURE', '1');
        core.info('BORINGCACHE_REQUIRE_SERVER_SIGNATURE=1 (strict server signature verification enabled)');
    }
    const trustedFingerprint = options.trustedWorkspaceSigningKeyFingerprint?.trim();
    if (trustedFingerprint) {
        core.exportVariable('BORINGCACHE_TRUSTED_WORKSPACE_KEY_FINGERPRINT', trustedFingerprint);
        core.info('BORINGCACHE_TRUSTED_WORKSPACE_KEY_FINGERPRINT configured');
    }
    if (options.version === 'skip') {
        core.debug('CLI setup skipped (version: skip)');
        if (await isCliAvailable()) {
            return;
        }
        throw new Error('BoringCache CLI not found and cli-version is set to "skip"');
    }
    if (await isCliAvailable()) {
        core.debug('BoringCache CLI already available');
        return;
    }
    const version = options.version;
    const normalizedVersion = version.startsWith('v') ? version : `v${version}`;
    const platform = getPlatformInfo(options.platform);
    const enableCache = options.cache !== false;
    const enableVerify = options.verify !== false; // Default: true
    core.info(`Installing BoringCache CLI ${normalizedVersion}...`);
    // Get cache info for this version
    const cacheInfo = getToolCacheInfo(normalizedVersion, options.platform);
    const toolCacheRoot = process.env.RUNNER_TOOL_CACHE || '/opt/hostedtoolcache';
    const cachePaths = [`${toolCacheRoot}/${TOOL_NAME}`];
    // Try to restore from actions/cache first
    let restoredFromCache = false;
    if (enableCache) {
        try {
            const cacheKey = await cache.restoreCache(cachePaths, cacheInfo.cacheKey);
            if (cacheKey) {
                core.info(`Restored CLI from cache (key: ${cacheKey})`);
                restoredFromCache = true;
            }
        }
        catch (error) {
            core.debug(`Cache restore failed: ${error instanceof Error ? error.message : error}`);
        }
    }
    let toolPath;
    let cachedPath = tc.find(TOOL_NAME, normalizedVersion.replace(/^v/, ''), cacheInfo.platformKey);
    if (cachedPath && enableVerify) {
        const binaryName = platform.isWindows ? 'boringcache.exe' : 'boringcache';
        const cachedBinary = path.join(cachedPath, binaryName);
        if (fs.existsSync(cachedBinary)) {
            try {
                const expectedChecksum = await getExpectedChecksum(normalizedVersion, platform.assetName);
                const actualChecksum = await computeFileHash(cachedBinary);
                if (actualChecksum !== expectedChecksum) {
                    core.warning(`Cached CLI binary is stale (checksum mismatch), re-downloading`);
                    cachedPath = '';
                }
            }
            catch (error) {
                core.debug(`Cache validation failed: ${error instanceof Error ? error.message : error}`);
            }
        }
    }
    if (cachedPath) {
        core.info(`Using cached BoringCache CLI`);
        toolPath = cachedPath;
    }
    else {
        toolPath = await downloadAndInstall(normalizedVersion, platform, enableVerify);
        if (enableCache) {
            try {
                await cache.saveCache(cachePaths, cacheInfo.cacheKey);
                core.info(`Saved CLI to cache (key: ${cacheInfo.cacheKey})`);
            }
            catch (error) {
                core.debug(`Cache save failed: ${error instanceof Error ? error.message : error}`);
            }
        }
    }
    const binaryName = platform.isWindows ? 'boringcache.exe' : 'boringcache';
    const stableToolPath = await exposeBoringCacheCli(toolPath, binaryName);
    core.addPath(stableToolPath);
    core.info(`BoringCache CLI ${normalizedVersion} ready`);
}
async function execBoringCache(args, options = {}) {
    const isWindows = os.platform() === 'win32';
    try {
        return await exec.exec('boringcache', args, options);
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (isWindows && msg.includes('Unable to locate executable file')) {
            return await exec.exec('bash', ['-lc', 'exec "$0" "$@"', 'boringcache', ...args], options);
        }
        throw error;
    }
}


/***/ }),

/***/ 245:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getWorkspace = getWorkspace;
exports.getCacheTagPrefix = getCacheTagPrefix;
exports.pathExists = pathExists;
const core = __importStar(__nccwpck_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module '@actions/core'"); e.code = 'MODULE_NOT_FOUND'; throw e; }())));
const fs = __importStar(__nccwpck_require__(896));
/**
 * Resolve workspace from input or environment.
 * Used by docker, buildkit, nodejs, rust, ruby actions.
 */
function getWorkspace(inputWorkspace) {
    let workspace = inputWorkspace || process.env.BORINGCACHE_DEFAULT_WORKSPACE || '';
    if (!workspace) {
        core.setFailed('Workspace is required. Set workspace input or BORINGCACHE_DEFAULT_WORKSPACE env var.');
        throw new Error('Workspace required');
    }
    if (!workspace.includes('/')) {
        workspace = `default/${workspace}`;
    }
    return workspace;
}
/**
 * Resolve cache tag prefix from input or the provided default.
 */
function getCacheTagPrefix(inputCacheTag, defaultPrefix) {
    if (inputCacheTag) {
        return inputCacheTag;
    }
    return defaultPrefix;
}
/**
 * Async file/directory existence check.
 */
async function pathExists(p) {
    try {
        await fs.promises.access(p);
        return true;
    }
    catch {
        return false;
    }
}


/***/ }),

/***/ 861:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.runModeRestore = runModeRestore;
exports.runModeSave = runModeSave;
const core = __importStar(__nccwpck_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module '@actions/core'"); e.code = 'MODULE_NOT_FOUND'; throw e; }())));
const exec = __importStar(__nccwpck_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module '@actions/exec'"); e.code = 'MODULE_NOT_FOUND'; throw e; }())));
const fs = __importStar(__nccwpck_require__(896));
const os = __importStar(__nccwpck_require__(857));
const path = __importStar(__nccwpck_require__(928));
const core_1 = __nccwpck_require__(796);
const utils_1 = __nccwpck_require__(219);
const DOCKER_CACHE_DIR_FROM = path.join(os.tmpdir(), 'boringcache-one-buildkit-cache-from');
const DOCKER_CACHE_DIR_TO = path.join(os.tmpdir(), 'boringcache-one-buildkit-cache-to');
const DOCKER_METADATA_FILE = path.join(os.tmpdir(), 'boringcache-one-docker-metadata.json');
const BUILDKIT_CACHE_DIR_FROM = path.join(os.tmpdir(), 'boringcache-one-buildkit-local-from');
const BUILDKIT_CACHE_DIR_TO = path.join(os.tmpdir(), 'boringcache-one-buildkit-local-to');
const BUILDKIT_METADATA_FILE = path.join(os.tmpdir(), 'boringcache-one-buildkit-metadata.json');
const DEFAULT_REGISTRY_CACHE_REF_TAG = 'buildcache';
const DEFAULT_MANAGED_BUILDKIT_IMAGE = 'ghcr.io/boringcache/buildkit:v0.30.0-bc.2';
function actionProxyOptions(options, proxyPlan) {
    return {
        ...options,
        onDemand: proxyPlan?.startup_mode === 'on-demand',
        ociPrefetchRefs: proxyPlan?.oci_prefetch_refs || [],
        ociRequiredReadableRefs: options.ociRequiredReadableRefs || [],
        ociHydration: proxyPlan?.oci_hydration || options.ociHydration || utils_1.DEFAULT_OCI_HYDRATION_POLICY,
        metadataHints: proxyPlan?.metadata_hints || options.metadataHints || {},
    };
}
function adapterProxyVerificationSpec(tag, proxyPlan, pathHint) {
    return {
        tag,
        noPlatform: proxyPlan.no_platform,
        noGit: proxyPlan.no_git,
        pathHint,
        saveExpected: !proxyPlan.read_only,
    };
}
function registryCacheVerificationSpecs(cacheTag, ociCache, noPlatform, noGit, saveExpected, pathHint) {
    void ociCache;
    const uniqueTags = Array.from(new Set([cacheTag].map((tag) => tag.trim()).filter(Boolean)));
    return uniqueTags.map((tag) => ({
        tag,
        noPlatform,
        noGit,
        pathHint,
        saveExpected,
    }));
}
const SUPPORTED_CLI_DRY_RUN_SCHEMA_VERSION = 1;
const SUPPORTED_CLI_SETUP_SCHEMA_VERSION = 1;
function assertSupportedCliDryRunSchema(adapter, plan) {
    if (plan.schema_version !== SUPPORTED_CLI_DRY_RUN_SCHEMA_VERSION) {
        const actual = plan.schema_version === undefined ? 'missing' : String(plan.schema_version);
        throw new Error(`boringcache ${adapter} dry-run JSON schema_version ${actual} is not supported by this action `
            + `(expected ${SUPPORTED_CLI_DRY_RUN_SCHEMA_VERSION}). Update boringcache/one or pin cli-version.`);
    }
}
function currentHomeDir() {
    return process.env.HOME || os.homedir();
}
function isPathInside(parent, candidate) {
    const relative = path.relative(path.resolve(parent), path.resolve(candidate));
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
async function runModeRestore(plan, inputs) {
    switch (plan.mode) {
        case 'docker':
            return runDockerRestore(plan, inputs);
        case 'buildkit':
            return runBuildkitRestore(plan, inputs);
        case 'bazel':
            return runBazelRestore(plan, inputs);
        case 'go':
            return runGoRestore(plan, inputs);
        case 'gradle':
            return runGradleRestore(plan, inputs);
        case 'maven':
            return runMavenRestore(plan, inputs);
        case 'rust-sccache':
            return runRustRestore(plan, inputs);
        case 'turbo-proxy':
            return runTurboProxyRestore(plan, inputs);
        case 'nx-proxy':
            return runNxProxyRestore(plan, inputs);
        case 'archive':
            return {};
    }
}
async function runModeSave(mode, options = {}) {
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
        case 'go':
            await stopProxyFromState();
            return;
        case 'gradle':
        case 'maven':
        case 'nx-proxy':
        case 'turbo-proxy':
            await stopProxyFromState();
            return;
        case 'rust-sccache':
            await runRustSave(options);
            return;
        case 'archive':
            return;
    }
}
function parseBooleanInput(value, inputName, defaultValue = false) {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }
    const normalized = String(value).trim();
    if (['true', 'True', 'TRUE'].includes(normalized)) {
        return true;
    }
    if (['false', 'False', 'FALSE'].includes(normalized)) {
        return false;
    }
    throw new Error(`Unsupported ${inputName} "${value}". Expected true, True, TRUE, false, False, or FALSE.`);
}
function parsePortInput(value, inputName) {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
        throw new Error(`Unsupported ${inputName} "${value}". Expected a TCP port from 1 to 65535.`);
    }
    const port = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(port) || port < 1 || port > 65_535) {
        throw new Error(`Unsupported ${inputName} "${value}". Expected a TCP port from 1 to 65535.`);
    }
    return port;
}
async function resolvePreferredPort(value, inputName, defaultPort) {
    if (value.trim()) {
        return parsePortInput(value, inputName);
    }
    return defaultPort ?? await (0, core_1.findAvailablePort)();
}
function parseList(input, separator = /[\n,]/) {
    return input
        .split(separator)
        .map((item) => item.trim())
        .filter(Boolean);
}
function appendMetadataHintArgs(args, metadataHintsInput) {
    for (const hint of parseList(metadataHintsInput)) {
        args.push('--metadata-hint', hint);
    }
}
function parseMultiline(input) {
    return input
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}
function slugify(value) {
    return value.replace(/[^a-zA-Z0-9]/g, '-');
}
function sanitizeBuilderToken(value) {
    return slugify(value)
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
}
function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}
function proxyPlanningReadOnly(requestedReadOnly) {
    return requestedReadOnly || (!(0, core_1.hasSaveToken)() && (0, core_1.hasRestoreToken)());
}
function requireAdapterSetupPlan(adapter, setup) {
    if (!setup || (!Object.keys(setup.env_vars || {}).length && !(setup.files || []).length && !(setup.directories || []).length)) {
        throw new Error(`boringcache ${adapter} dry-run JSON did not include adapter setup planning data`);
    }
    const setupSchemaVersion = setup.schema_version ?? SUPPORTED_CLI_SETUP_SCHEMA_VERSION;
    if (setupSchemaVersion !== SUPPORTED_CLI_SETUP_SCHEMA_VERSION) {
        throw new Error(`boringcache ${adapter} setup schema_version ${setupSchemaVersion} is not supported by this action `
            + `(expected ${SUPPORTED_CLI_SETUP_SCHEMA_VERSION}). Update boringcache/one or pin cli-version.`);
    }
    return setup;
}
function exportEnvVars(envVars) {
    for (const [key, value] of Object.entries(envVars)) {
        process.env[key] = value;
        core.exportVariable(key, value);
    }
}
function applyAdapterSetupPlan(setup) {
    exportEnvVars(setup.env_vars || {});
    for (const directory of setup.directories || []) {
        ensureDir(directory);
    }
    for (const file of setup.files || []) {
        ensureDir(path.dirname(file.path));
        if (file.mode === 'append') {
            if (fs.existsSync(file.path) && fs.readFileSync(file.path, 'utf8').includes(file.content)) {
                continue;
            }
            fs.appendFileSync(file.path, file.content);
        }
        else if (file.mode === 'write') {
            fs.writeFileSync(file.path, file.content);
        }
        else {
            throw new Error(`Unsupported adapter setup file mode for ${file.path}`);
        }
    }
}
function setupFilePath(setup, suffix) {
    return (setup.files || []).find((file) => file.path.endsWith(suffix))?.path || '';
}
function setupDirectory(setup) {
    return (setup.directories || [])[0] || '';
}
function requireSetupFilePath(setup, suffix, label) {
    const filePath = setupFilePath(setup, suffix);
    if (!filePath) {
        throw new Error(`boringcache adapter setup plan did not include ${label}`);
    }
    return filePath;
}
function requireSetupDirectory(setup, label) {
    const directory = setupDirectory(setup);
    if (!directory) {
        throw new Error(`boringcache adapter setup plan did not include ${label}`);
    }
    return directory;
}
function modeStateKey(key) {
    return `mode-${key}`;
}
function saveModeState(key, value) {
    core.saveState(modeStateKey(key), value);
}
function getModeState(key) {
    return core.getState(modeStateKey(key));
}
function getModeStateList(key) {
    return getModeState(key)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
}
function appendModeStateListValue(key, value) {
    if (!value) {
        return;
    }
    const existing = getModeState(key)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    if (existing.includes(value)) {
        return;
    }
    existing.push(value);
    saveModeState(key, existing.join(','));
}
function markModeVerifyTagSkipped(tag) {
    appendModeStateListValue('skipped-verify-tags', tag);
}
function addLocalBinPaths() {
    const home = currentHomeDir();
    core.addPath(path.join(home, '.local', 'bin'));
    core.addPath(path.join(home, '.boringcache', 'bin'));
}
function registryProxyLogPath(port) {
    return path.join(os.tmpdir(), `boringcache-proxy-${port}.log`);
}
function setProxyOutputs(port) {
    const logPath = registryProxyLogPath(port);
    core.saveState('proxy-port', String(port));
    core.saveState('proxy-log-path', logPath);
    core.setOutput('proxy-port', String(port));
    core.setOutput('proxy-log-path', logPath);
}
function saveProxyModeState(port) {
    saveModeState('proxy-port', String(port));
    saveModeState('proxy-log-path', registryProxyLogPath(port));
}
function getModeStateBoolean(key) {
    return getModeState(key) === 'true';
}
async function verifyOciPromotionRefsAfterStop() {
    const refs = getModeStateList('oci-promotion-ref-tags');
    if (refs.length === 0) {
        return;
    }
    const workspace = getModeState('workspace');
    const cacheTag = getModeState('cache-tag');
    const port = Number.parseInt(getModeState('proxy-port'), 10);
    if (!workspace || !cacheTag) {
        throw new Error(`Cannot verify OCI promotion refs without workspace and cache tag. requested=[${refs.join(', ')}]`);
    }
    if (!Number.isFinite(port) || port <= 0) {
        throw new Error(`Cannot verify OCI promotion refs without a proxy port. requested=[${refs.join(', ')}]`);
    }
    const host = getModeState('proxy-host') || '127.0.0.1';
    let verificationProxyPid = null;
    try {
        const verificationProxy = await (0, core_1.startRegistryProxy)({
            command: 'cache-registry',
            workspace,
            tag: cacheTag,
            host,
            port,
            noGit: getModeStateBoolean('proxy-no-git'),
            noPlatform: getModeStateBoolean('proxy-no-platform'),
            verbose: getModeStateBoolean('verbose'),
            readOnly: true,
            ociRequiredReadableRefs: refs,
            requireOciImportReady: true,
            ociImportReadyTimeoutMs: ociPromotionVerificationTimeoutMs(),
            ociHydration: utils_1.DEFAULT_OCI_HYDRATION_POLICY,
        });
        verificationProxyPid = verificationProxy.pid > 0 ? verificationProxy.pid : null;
        const readiness = verificationProxy.ociImportReadiness;
        if (!readiness?.ready) {
            throw new Error(`OCI promotion refs were not readable after proxy shutdown. readable=[${readiness?.readableRefs.join(', ') || ''}] unreadable=[${readiness?.unreadableRefs.join(', ') || refs.join(', ')}]`);
        }
        core.info(`Verified OCI promotion refs after proxy shutdown: ${readiness.readableRefs.join(', ')}`);
    }
    catch (error) {
        throw new Error(`OCI promotion refs were not readable after proxy shutdown. requested=[${refs.join(', ')}]: ${errorMessage(error)}`);
    }
    finally {
        if (verificationProxyPid !== null) {
            await (0, core_1.stopRegistryProxy)(verificationProxyPid);
        }
    }
}
function ociPromotionVerificationTimeoutMs() {
    const raw = core.getState('verify-timeout-seconds') || core.getInput('verify-timeout-seconds') || '180';
    return (0, utils_1.normalizeVerifyTimeoutSeconds)(raw) * 1000;
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
async function verifyOciPromotionRefsThenStopProxy(proxyPid) {
    try {
        const proxyPort = Number.parseInt(getModeState('proxy-port'), 10);
        await (0, core_1.stopRegistryProxy)(parseInt(proxyPid, 10), Number.isFinite(proxyPort) ? proxyPort : undefined);
    }
    catch (stopError) {
        throw new Error(`Failed to stop BoringCache proxy cleanly before OCI promotion verification: ${errorMessage(stopError)}`);
    }
    await verifyOciPromotionRefsAfterStop();
}
async function shutdownBazelServer() {
    await exec.exec('bazel', ['shutdown'], {
        ignoreReturnCode: true,
        silent: true,
    });
}
async function execBoringCache(args, options) {
    return (0, core_1.execBoringCache)(args, options);
}
function emitCliPlannerWarnings(stderr) {
    for (const line of stderr.split('\n').map((value) => value.trim()).filter(Boolean)) {
        if (line.startsWith('warning:')) {
            core.warning(line.replace(/^warning:\s*/, ''));
        }
    }
}
function normalizeDockerCacheBackend(value) {
    const backend = (value.trim() || 'boringcache');
    if (backend === 'boringcache' || backend === 'registry' || backend === 'local') {
        return backend;
    }
    throw new Error(`Unsupported Docker/BuildKit cache backend: ${value}. Expected boringcache, registry, or local.`);
}
function buildKitCacheBackendFor(cacheBackend) {
    return cacheBackend === 'registry' ? 'registry' : 'boringcache';
}
function normalizeDockerCommand(value) {
    const command = (value.trim() || 'build');
    if (command === 'build' || command === 'setup') {
        return command;
    }
    throw new Error(`Unsupported docker-command "${value}". Expected build or setup.`);
}
function normalizeDockerCacheMode(value) {
    const mode = (value.trim() || 'max');
    if (mode === 'min' || mode === 'max') {
        return mode;
    }
    throw new Error(`Unsupported cache-mode "${value}". Expected min or max.`);
}
function normalizeSccacheMode(value) {
    const mode = (value.trim() || 'local');
    if (mode === 'local' || mode === 'proxy') {
        return mode;
    }
    throw new Error(`Unsupported sccache-mode "${value}". Expected local or proxy.`);
}
function normalizeRustupProfile(value) {
    const profile = (value.trim() || 'minimal');
    if (profile === 'minimal' || profile === 'default' || profile === 'complete') {
        return profile;
    }
    throw new Error(`Unsupported profile "${value}". Expected minimal, default, or complete.`);
}
function usesRegistryCachePlan(backend) {
    return backend !== 'local';
}
async function resolveAdapterCliPlan(adapter, workspace, workingDirectory, inputCacheTag, preferredPort, noPlatform, noGit, readOnly, options = {}) {
    const args = [adapter, '--workspace', workspace];
    const trimmedCacheTag = inputCacheTag.trim();
    if (trimmedCacheTag) {
        args.push('--tag', trimmedCacheTag);
    }
    if (preferredPort > 0) {
        args.push('--port', String(preferredPort));
    }
    if (noPlatform) {
        args.push('--no-platform');
    }
    if (noGit) {
        args.push('--no-git');
    }
    if (readOnly) {
        args.push('--read-only');
    }
    appendMetadataHintArgs(args, options.metadataHintsInput || '');
    for (const line of parseMultiline(options.bazelrcLines || '')) {
        args.push('--bazelrc-line', line);
    }
    if (options.gradleHome?.trim()) {
        args.push('--gradle-home', options.gradleHome.trim());
    }
    if (options.enableGradleBuildCache === false) {
        args.push('--no-gradle-build-cache-property');
    }
    if (options.mavenLocalRepo?.trim()) {
        args.push('--maven-local-repo', options.mavenLocalRepo.trim());
    }
    if (options.mavenExtensionsPath?.trim()) {
        args.push('--maven-extensions-path', options.mavenExtensionsPath.trim());
    }
    if (options.mavenBuildCacheConfigPath?.trim()) {
        args.push('--maven-build-cache-config-path', options.mavenBuildCacheConfigPath.trim());
    }
    if (options.mavenBuildCacheExtensionVersion?.trim()) {
        args.push('--maven-build-cache-extension-version', options.mavenBuildCacheExtensionVersion.trim());
    }
    if (options.mavenBuildCacheId?.trim()) {
        args.push('--maven-build-cache-id', options.mavenBuildCacheId.trim());
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
        throw new Error(stderr.trim() || stdout.trim() || `boringcache ${adapter} --dry-run --json exited with code ${exitCode}`);
    }
    emitCliPlannerWarnings(stderr);
    let plan;
    try {
        plan = JSON.parse(stdout);
    }
    catch (error) {
        throw new Error(`Failed to parse boringcache ${adapter} dry-run JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    assertSupportedCliDryRunSchema(adapter, plan);
    return plan;
}
async function resolveOciCliPlan(adapter, adapterCommand, workspace, workingDirectory, inputCacheTag, preferredPort, host, endpointHost, noPlatform, noGit, readOnly, cacheMode, cacheRefTag, ociHydration, metadataHintsInput = '', buildkitCacheBackend = 'boringcache', dockerToolCacheInput = '') {
    const args = [adapter, '--workspace', workspace];
    const trimmedCacheTag = inputCacheTag.trim();
    const trimmedCacheRefTag = cacheRefTag.trim();
    if (trimmedCacheTag) {
        args.push('--tag', trimmedCacheTag);
    }
    if (preferredPort > 0) {
        args.push('--port', String(preferredPort));
    }
    if (host.trim()) {
        args.push('--host', host.trim());
    }
    if (endpointHost.trim()) {
        args.push('--endpoint-host', endpointHost.trim());
    }
    if (noPlatform) {
        args.push('--no-platform');
    }
    if (noGit) {
        args.push('--no-git');
    }
    if (readOnly) {
        args.push('--read-only');
    }
    if (cacheMode.trim()) {
        args.push('--cache-mode', cacheMode.trim());
    }
    args.push('--backend', buildkitCacheBackend);
    if (trimmedCacheRefTag) {
        args.push('--cache-ref-tag', trimmedCacheRefTag);
    }
    const trimmedOciHydration = ociHydration.trim();
    if (trimmedOciHydration) {
        args.push('--oci-hydration', trimmedOciHydration);
    }
    if (adapter === 'docker') {
        for (const tool of parseList(dockerToolCacheInput)) {
            args.push('--tool-cache', tool);
        }
    }
    appendMetadataHintArgs(args, metadataHintsInput);
    args.push('--dry-run', '--json', '--', ...adapterCommand);
    let stdout = '';
    let stderr = '';
    const env = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
            env[key] = value;
        }
    }
    if (env.GITHUB_ACTIONS === 'true' && !env.BORINGCACHE_CI_RUN_STARTED_AT) {
        env.BORINGCACHE_CI_RUN_STARTED_AT = new Date().toISOString();
        process.env.BORINGCACHE_CI_RUN_STARTED_AT = env.BORINGCACHE_CI_RUN_STARTED_AT;
    }
    const exitCode = await exec.exec('boringcache', args, {
        cwd: workingDirectory,
        env,
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
        throw new Error(stderr.trim() || stdout.trim() || `boringcache ${adapter} --dry-run --json exited with code ${exitCode}`);
    }
    emitCliPlannerWarnings(stderr);
    let plan;
    try {
        plan = JSON.parse(stdout);
    }
    catch (error) {
        throw new Error(`Failed to parse boringcache ${adapter} dry-run JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    assertSupportedCliDryRunSchema(adapter, plan);
    if (!plan.oci_cache?.registry_ref || !plan.oci_cache.cache_from) {
        throw new Error(`boringcache ${adapter} dry-run JSON did not include OCI cache planning data`);
    }
    return plan;
}
async function resolveDockerCliPlan(workspace, workingDirectory, inputCacheTag, preferredPort, host, endpointHost, noPlatform, noGit, readOnly, cacheMode, cacheRefTag, ociHydration, metadataHintsInput = '', buildkitCacheBackend = 'boringcache', dockerToolCacheInput = '') {
    return resolveOciCliPlan('docker', ['docker', 'buildx', 'build', '.'], workspace, workingDirectory, inputCacheTag, preferredPort, host, endpointHost, noPlatform, noGit, readOnly, cacheMode, cacheRefTag, ociHydration, metadataHintsInput, buildkitCacheBackend, dockerToolCacheInput);
}
async function resolveBuildkitCliPlan(workspace, workingDirectory, inputCacheTag, preferredPort, host, endpointHost, noPlatform, noGit, readOnly, cacheMode, cacheRefTag, ociHydration, metadataHintsInput = '', buildkitCacheBackend = 'boringcache') {
    return resolveOciCliPlan('buildkit', ['buildctl', 'build', '--frontend', 'dockerfile.v0'], workspace, workingDirectory, inputCacheTag, preferredPort, host, endpointHost, noPlatform, noGit, readOnly, cacheMode, cacheRefTag, ociHydration, metadataHintsInput, buildkitCacheBackend);
}
async function restoreSimpleCache(workspace, cacheKey, cacheDir, flags = {}) {
    if (!(0, core_1.hasRestoreToken)()) {
        core.notice(`Skipping cache restore (${(0, core_1.missingRestoreTokenMessage)()})`);
        return;
    }
    const args = ['restore', workspace, `${cacheKey}:${cacheDir}`];
    if (flags.verbose) {
        args.push('--verbose');
    }
    await execBoringCache(args);
}
async function saveSimpleCache(workspace, cacheKey, cacheDir, flags = {}) {
    if (!(0, core_1.hasSaveToken)()) {
        core.notice(`Skipping cache save (${(0, core_1.missingSaveTokenMessage)()})`);
        return;
    }
    if (!fs.existsSync(cacheDir) || fs.readdirSync(cacheDir).length === 0) {
        core.notice('No cache files to save');
        return;
    }
    const args = ['save', workspace, `${cacheKey}:${cacheDir}`, '--force'];
    if (flags.verbose) {
        args.push('--verbose');
    }
    if (flags.exclude) {
        args.push('--exclude', flags.exclude);
    }
    await execBoringCache(args);
}
function getEffectiveRegistryTag(cacheTag, registryTag) {
    return registryTag || cacheTag;
}
function extractRegistryCacheRefTag(cacheFrom) {
    const refMatch = cacheFrom.match(/(?:^|,)ref=([^,]+)/);
    const ref = refMatch?.[1]?.trim();
    if (!ref) {
        return null;
    }
    const lastSlash = ref.lastIndexOf('/');
    const lastColon = ref.lastIndexOf(':');
    if (lastColon <= lastSlash || lastColon === ref.length - 1) {
        return null;
    }
    return ref.slice(lastColon + 1);
}
function registryCacheFromRefTags(ociCache) {
    if (!ociCache) {
        return [];
    }
    if (ociCache.cache_from_ref_tags?.length) {
        return ociCache.cache_from_ref_tags;
    }
    return (ociCache.cache_from_refs || [])
        .map(extractRegistryCacheRefTag)
        .filter((tag) => Boolean(tag));
}
function registryCacheImportSpecs(ociCache, refTags) {
    const imports = ociCache.cache_from_refs?.length ? ociCache.cache_from_refs : [ociCache.cache_from];
    const byRefTag = new Map();
    for (const cacheFrom of imports) {
        const refTag = extractRegistryCacheRefTag(cacheFrom);
        if (refTag && !byRefTag.has(refTag)) {
            byRefTag.set(refTag, cacheFrom.trim());
        }
    }
    const selectedImports = refTags
        ? refTags
            .map((refTag) => byRefTag.get(refTag))
            .filter((cacheFrom) => Boolean(cacheFrom))
        : imports
            .map((cacheFrom) => cacheFrom.trim())
            .filter(Boolean);
    return selectedImports;
}
function effectiveRegistryCacheImports(ociCache, proxy) {
    const requestedRefTags = registryCacheFromRefTags(ociCache);
    const readableRefTags = proxy?.ociImportReadiness
        ? proxy.ociImportReadiness.readableRefs
        : requestedRefTags;
    const unreadableRefTags = proxy?.ociImportReadiness?.unreadableRefs || [];
    return {
        importSpecs: registryCacheImportSpecs(ociCache, readableRefTags),
        readableRefTags,
        requestedRefTags,
        unreadableRefTags,
        importReady: proxy?.ociImportReadiness?.ready ?? true,
    };
}
function registryCacheEvidence(adapter, ociCache, imports, cacheTo) {
    const runMetadata = ociCache.run_metadata;
    const effectiveBuildKitCacheBackend = ociCache.buildkit_cache_backend === 'registry' ? 'registry' : 'boringcache';
    return {
        adapter,
        cache_backend: effectiveBuildKitCacheBackend,
        buildkit_cache_backend: effectiveBuildKitCacheBackend,
        registry_ref: ociCache.registry_ref,
        cache_from: imports.importSpecs,
        cache_to: cacheTo || '',
        requested_ref_tags: imports.requestedRefTags,
        readable_ref_tags: imports.readableRefTags,
        unreadable_ref_tags: imports.unreadableRefTags,
        import_ready: imports.importReady,
        immutable_run_ref_tag: ociCache.immutable_run_ref_tag || '',
        promotion_ref_tags: ociCache.promotion_ref_tags || [],
        ci: {
            provider: runMetadata?.provider || '',
            run_uid: runMetadata?.run_uid || '',
            run_attempt: runMetadata?.run_attempt || '',
            source_ref_type: runMetadata?.source_ref_type || '',
            source_ref_name: runMetadata?.source_ref_name || '',
            run_started_at: runMetadata?.run_started_at || '',
        },
    };
}
function recordOciRegistryPlanState(ociPlan, cacheTag) {
    saveModeState('workspace', ociPlan.workspace);
    saveModeState('cache-tag', cacheTag);
    return {
        resolvedWorkspace: ociPlan.workspace,
        resolvedCacheTag: cacheTag,
        registryVerification: {
            noPlatform: ociPlan.proxy.no_platform,
            noGit: ociPlan.proxy.no_git,
            saveExpected: !ociPlan.proxy.read_only,
        },
        registryOciCache: ociPlan.oci_cache,
    };
}
function setRegistryCacheOutputs(spec) {
    core.setOutput('registry-ref', spec.ref);
    core.setOutput('cache-from', spec.from.join('\n'));
    core.setOutput('cache-to', spec.to || '');
    core.setOutput('buildkit-cache-backend', spec.ociCache?.buildkit_cache_backend || 'registry');
    core.setOutput('docker-cache-run-ref', spec.ociCache?.immutable_run_ref_tag || '');
    core.setOutput('docker-cache-from-refs', (spec.usedRefTags || registryCacheFromRefTags(spec.ociCache)).join('\n'));
    core.setOutput('docker-cache-requested-from-refs', registryCacheFromRefTags(spec.ociCache).join('\n'));
    core.setOutput('docker-cache-unreadable-from-refs', (spec.unreadableRefTags || []).join('\n'));
    core.setOutput('docker-cache-import-ready', String(spec.importReady ?? true));
    core.setOutput('docker-cache-promotion-refs', (spec.ociCache?.promotion_ref_tags || []).join('\n'));
    core.setOutput('docker-ci-provider', spec.ociCache?.run_metadata?.provider || '');
    core.setOutput('docker-ci-run-id', spec.ociCache?.run_metadata?.run_uid || '');
    core.setOutput('docker-ci-run-attempt', spec.ociCache?.run_metadata?.run_attempt || '');
    core.setOutput('docker-ci-ref-type', spec.ociCache?.run_metadata?.source_ref_type || '');
    core.setOutput('docker-ci-ref-name', spec.ociCache?.run_metadata?.source_ref_name || '');
    core.setOutput('docker-ci-run-started-at', spec.ociCache?.run_metadata?.run_started_at || '');
    core.setOutput('cache-dir', '');
    core.setOutput('save-cache-dir', '');
}
function setLocalCacheOutputs(cacheDirFrom, cacheDirTo, cacheMode) {
    core.setOutput('registry-ref', '');
    core.setOutput('cache-from', `type=local,src=${cacheDirFrom}`);
    core.setOutput('cache-to', `type=local,dest=${cacheDirTo},mode=${cacheMode}`);
    core.setOutput('buildkit-cache-backend', '');
    core.setOutput('docker-cache-run-ref', '');
    core.setOutput('docker-cache-from-refs', '');
    core.setOutput('docker-cache-requested-from-refs', '');
    core.setOutput('docker-cache-unreadable-from-refs', '');
    core.setOutput('docker-cache-import-ready', 'true');
    core.setOutput('docker-cache-promotion-refs', '');
    core.setOutput('docker-ci-provider', '');
    core.setOutput('docker-ci-run-id', '');
    core.setOutput('docker-ci-run-attempt', '');
    core.setOutput('docker-ci-ref-type', '');
    core.setOutput('docker-ci-ref-name', '');
    core.setOutput('docker-ci-run-started-at', '');
    core.setOutput('cache-dir', cacheDirFrom);
    core.setOutput('save-cache-dir', cacheDirTo);
}
async function inspectDockerTemplate(containerName, template) {
    let output = '';
    const result = await exec.exec('docker', ['inspect', '-f', template, containerName], {
        ignoreReturnCode: true,
        silent: true,
        listeners: {
            stdout: (data) => {
                output += data.toString();
            },
        },
    });
    const value = output.trim();
    if (result !== 0 || !value || value === '<no value>') {
        return null;
    }
    return value;
}
async function getContainerGateway(containerName) {
    const directGateway = await inspectDockerTemplate(containerName, '{{.NetworkSettings.Gateway}}');
    if (directGateway) {
        return directGateway;
    }
    const networkGateways = await inspectDockerTemplate(containerName, '{{range .NetworkSettings.Networks}}{{if .Gateway}}{{.Gateway}}{{"\\n"}}{{end}}{{end}}');
    if (networkGateways) {
        const firstGateway = networkGateways
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find(Boolean);
        if (firstGateway) {
            return firstGateway;
        }
    }
    core.warning(`Could not determine gateway for container ${containerName}, falling back to 172.17.0.1`);
    return '172.17.0.1';
}
async function getContainerNetworkMode(containerName) {
    const networkMode = await inspectDockerTemplate(containerName, '{{.HostConfig.NetworkMode}}');
    if (!networkMode) {
        core.warning(`Could not determine network mode for container ${containerName}, assuming bridge`);
        return 'bridge';
    }
    return networkMode;
}
async function setupQemuIfNeeded(platforms) {
    if (!platforms) {
        return;
    }
    const result = await exec.exec('docker', ['run', '--privileged', '--rm', 'tonistiigi/binfmt', '--install', 'all'], { ignoreReturnCode: true });
    if (result !== 0) {
        throw new Error(`Failed to set up QEMU for multi-platform builds (exit ${result})`);
    }
}
function buildxBuilderName() {
    const runId = String(process.env.GITHUB_RUN_ID || Date.now());
    const actionId = sanitizeBuilderToken(process.env.GITHUB_ACTION || 'one') || 'one';
    const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return `boringcache-${runId}-${actionId}-${uniqueSuffix}`;
}
function hasDriverImageOpt(driverOpts) {
    return driverOpts.some((opt) => opt.trim().startsWith('image='));
}
async function setupBuildxBuilder(driver, driverOpts, buildkitdConfigInline, registryMode, useManagedBuildKitImage) {
    const builderName = buildxBuilderName();
    let driverToUse = driver || 'docker-container';
    if (driverToUse === 'docker') {
        core.warning('Buildx driver "docker" does not support cache export; falling back to "docker-container".');
        driverToUse = 'docker-container';
    }
    const effectiveDriverOpts = [...driverOpts];
    if (useManagedBuildKitImage && driverToUse === 'docker-container' && !hasDriverImageOpt(effectiveDriverOpts)) {
        effectiveDriverOpts.push(`image=${DEFAULT_MANAGED_BUILDKIT_IMAGE}`);
    }
    if (registryMode && driverToUse === 'docker-container' && !effectiveDriverOpts.some((opt) => opt.startsWith('network='))) {
        effectiveDriverOpts.push('network=host');
    }
    let configPath = '';
    if (buildkitdConfigInline.trim()) {
        configPath = path.join(os.tmpdir(), `buildkitd-${Date.now()}.toml`);
        fs.writeFileSync(configPath, buildkitdConfigInline);
    }
    const args = ['buildx', 'create', '--name', builderName, '--driver', driverToUse];
    for (const driverOpt of effectiveDriverOpts) {
        args.push('--driver-opt', driverOpt);
    }
    if (driverToUse === 'docker-container') {
        args.push('--buildkitd-flags', '--oci-worker-gc=false');
    }
    if (configPath) {
        args.push('--config', configPath);
    }
    args.push('--use');
    const createResult = await exec.exec('docker', args, { ignoreReturnCode: true });
    if (createResult !== 0) {
        throw new Error(`Failed to create buildx builder (exit ${createResult})`);
    }
    return builderName;
}
async function cleanupBuildxBuilder(builderName) {
    if (!builderName) {
        return;
    }
    const removeResult = await exec.exec('docker', ['buildx', 'rm', '--force', builderName], {
        ignoreReturnCode: true,
    });
    if (removeResult !== 0) {
        core.warning(`Failed to remove buildx builder ${builderName} (exit ${removeResult})`);
    }
}
async function getBuilderPlatforms(builderName) {
    let output = '';
    const result = await exec.exec('docker', ['buildx', 'inspect', builderName, '--bootstrap'], {
        ignoreReturnCode: true,
        silent: true,
        listeners: {
            stdout: (data) => {
                output += data.toString();
            },
        },
    });
    if (result !== 0) {
        return '';
    }
    const line = output.split('\n').find((value) => value.trim().startsWith('Platforms:'));
    return line ? line.replace('Platforms:', '').trim() : '';
}
function dockerBuildxArgs(opts) {
    const args = ['buildx', 'build', '--builder', opts.builder, '-f', opts.dockerfile];
    for (const tag of opts.tags) {
        args.push('-t', `${opts.image}:${tag}`);
    }
    for (const buildArg of opts.buildArgs) {
        args.push('--build-arg', buildArg);
    }
    for (const secret of opts.secrets) {
        args.push('--secret', secret);
    }
    if (opts.target) {
        args.push('--target', opts.target);
    }
    if (opts.platforms) {
        args.push('--platform', opts.platforms);
    }
    if (opts.push) {
        args.push('--push');
    }
    if (opts.load) {
        args.push('--load');
    }
    if (opts.noCache) {
        args.push('--no-cache');
    }
    if (opts.provenance) {
        args.push('--provenance=true');
    }
    if (opts.sbom) {
        args.push('--sbom=true');
    }
    if (opts.cacheFrom?.length) {
        for (const cacheFrom of opts.cacheFrom) {
            args.push('--cache-from', cacheFrom);
        }
    }
    if (opts.cacheTo) {
        args.push('--cache-to', opts.cacheTo);
    }
    else if (opts.cacheDirFrom) {
        args.push('--cache-from', `type=local,src=${opts.cacheDirFrom}`);
        args.push('--cache-to', `type=local,dest=${opts.cacheDirTo},mode=${opts.cacheMode}`);
    }
    args.push('--metadata-file', DOCKER_METADATA_FILE);
    args.push('.');
    return args;
}
async function buildDockerImage(opts) {
    const args = dockerBuildxArgs(opts);
    const result = await exec.exec('docker', args, {
        cwd: opts.context,
        env: {
            ...process.env,
            DOCKER_BUILDKIT: '1',
        },
    });
    if (result !== 0) {
        throw new Error(`docker buildx build failed with exit code ${result}`);
    }
}
function ociAdapterCliArgsForAcceleratedBuild(adapter, workspace, cacheTag, buildkitCacheBackend, port, proxyBindHost, refHost, inputs, cacheMode, registryRefTagInput, command, commandArgs) {
    const args = [
        adapter,
        '--workspace',
        workspace,
        '--tag',
        cacheTag,
        '--backend',
        buildkitCacheBackend,
        '--port',
        String(port),
        '--host',
        proxyBindHost,
        '--endpoint-host',
        refHost,
        '--cache-mode',
        cacheMode,
    ];
    if (inputs.proxyNoPlatform) {
        args.push('--no-platform');
    }
    if (inputs.proxyNoGit) {
        args.push('--no-git');
    }
    if (inputs.readOnly) {
        args.push('--read-only');
    }
    if (registryRefTagInput.trim()) {
        args.push('--cache-ref-tag', registryRefTagInput.trim());
    }
    if (inputs.ociHydration.trim()) {
        args.push('--oci-hydration', inputs.ociHydration.trim());
    }
    if (adapter === 'docker') {
        for (const tool of parseList(inputs.dockerToolCache)) {
            args.push('--tool-cache', tool);
        }
    }
    appendMetadataHintArgs(args, inputs.metadataHints);
    args.push('--', command, ...commandArgs);
    return args;
}
async function buildDockerImageWithCliAdapter(workspace, cacheTag, buildkitCacheBackend, port, proxyBindHost, refHost, inputs, cacheMode, registryRefTagInput, opts) {
    const dockerBuildArgs = dockerBuildxArgs({
        ...opts,
        cacheFrom: undefined,
        cacheTo: undefined,
        cacheDirFrom: undefined,
        cacheDirTo: undefined,
    });
    const args = ociAdapterCliArgsForAcceleratedBuild('docker', workspace, cacheTag, buildkitCacheBackend, port, proxyBindHost, refHost, inputs, cacheMode, registryRefTagInput, 'docker', dockerBuildArgs);
    const result = await execBoringCache(args, {
        cwd: opts.context,
        env: {
            ...process.env,
            DOCKER_BUILDKIT: '1',
        },
    });
    if (result !== 0) {
        throw new Error(`boringcache docker --backend ${buildkitCacheBackend} failed with exit code ${result}`);
    }
}
function readDockerMetadata() {
    if (!fs.existsSync(DOCKER_METADATA_FILE)) {
        return { imageId: '', digest: '' };
    }
    try {
        const data = JSON.parse(fs.readFileSync(DOCKER_METADATA_FILE, 'utf8'));
        return {
            imageId: data['containerimage.config.digest'] || '',
            digest: data['containerimage.digest'] || '',
        };
    }
    catch (error) {
        core.warning(`Failed to parse Docker metadata file: ${error.message}`);
        return { imageId: '', digest: '' };
    }
}
function materializeMaybeFile(value, filename, rootDir) {
    if (!value.trim()) {
        return '';
    }
    const candidate = path.resolve(rootDir, value);
    // BuildKit TLS file inputs may name files only inside the checked-out workspace.
    // Absolute or parent-traversal values are treated as inline PEM content instead.
    // codeql[js/path-injection]
    if (fs.existsSync(candidate)) {
        if (isPathInside(rootDir, candidate)) {
            return candidate;
        }
        core.warning(`Ignoring ${filename} path outside the workspace; treating input as inline content.`);
    }
    const target = path.join(os.tmpdir(), filename);
    // Inline TLS content is materialized to a fixed filename under the runner temp directory.
    // codeql[js/path-injection]
    fs.writeFileSync(target, value);
    return target;
}
async function installBuildctl() {
    addLocalBinPaths();
    try {
        const result = await exec.exec('buildctl', ['--version'], {
            ignoreReturnCode: true,
            silent: true,
        });
        if (result === 0) {
            return;
        }
    }
    catch {
    }
    const version = 'v0.19.0';
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'buildctl-'));
    const archivePath = path.join(tmpDir, 'buildkit.tar.gz');
    const installDir = path.join(currentHomeDir(), '.local', 'bin');
    try {
        const url = `https://github.com/moby/buildkit/releases/download/${version}/buildkit-${version}.linux-amd64.tar.gz`;
        const curlCode = await exec.exec('curl', ['-fsSL', '--output', archivePath, url], { ignoreReturnCode: true });
        if (curlCode !== 0) {
            throw new Error(`Failed to download buildctl from ${url}`);
        }
        await exec.exec('tar', ['-xzf', archivePath, '-C', tmpDir]);
        await fs.promises.mkdir(installDir, { recursive: true });
        const srcPath = path.join(tmpDir, 'bin', process.platform === 'win32' ? 'buildctl.exe' : 'buildctl');
        const destPath = path.join(installDir, process.platform === 'win32' ? 'buildctl.exe' : 'buildctl');
        await fs.promises.copyFile(srcPath, destPath);
        if (process.platform !== 'win32') {
            await fs.promises.chmod(destPath, 0o755);
        }
        core.addPath(installDir);
    }
    finally {
        await fs.promises.rm(tmpDir, { recursive: true, force: true });
    }
}
function buildctlArgs(opts) {
    const args = ['--addr', opts.addr];
    if (opts.tlsCa || opts.tlsCert || opts.tlsKey) {
        if (opts.tlsCa) {
            args.push('--tlscacert', opts.tlsCa);
        }
        if (opts.tlsCert) {
            args.push('--tlscert', opts.tlsCert);
        }
        if (opts.tlsKey) {
            args.push('--tlskey', opts.tlsKey);
        }
    }
    if (opts.tlsSkipVerify) {
        args.push('--tlsskipverify');
    }
    args.push('build', '--frontend', 'dockerfile.v0');
    args.push('--local', `context=${opts.contextPath}`);
    args.push('--local', `dockerfile=${opts.dockerfileDir}`);
    args.push('--opt', `filename=${opts.dockerfileName}`);
    if (opts.noCache) {
        args.push('--no-cache');
    }
    if (opts.platforms) {
        args.push('--opt', `platform=${opts.platforms}`);
    }
    if (opts.target) {
        args.push('--opt', `target=${opts.target}`);
    }
    for (const buildArg of opts.buildArgs) {
        args.push('--opt', `build-arg:${buildArg}`);
    }
    for (const secret of opts.secrets) {
        args.push('--secret', secret);
    }
    for (const ssh of opts.sshSpecs) {
        args.push('--ssh', ssh);
    }
    if (opts.importCache?.length) {
        for (const importCache of opts.importCache) {
            args.push('--import-cache', importCache);
        }
    }
    if (opts.exportCache) {
        args.push('--export-cache', opts.exportCache);
    }
    else if (opts.cacheDirFrom) {
        args.push('--import-cache', `type=local,src=${opts.cacheDirFrom}`);
        args.push('--export-cache', `type=local,dest=${opts.cacheDirTo},mode=${opts.cacheMode}`);
    }
    if (opts.output?.trim()) {
        args.push('--output', opts.output.trim());
    }
    else {
        const nameParams = opts.imageTags.map((tag) => `name=${tag}`).join(',');
        args.push('--output', `type=image,${nameParams},push=${opts.push ? 'true' : 'false'}`);
    }
    args.push('--metadata-file', opts.metadataFile);
    return args;
}
async function buildWithBuildctl(opts) {
    const args = buildctlArgs(opts);
    const result = await exec.exec('buildctl', args);
    if (result !== 0) {
        throw new Error(`buildctl failed with exit code ${result}`);
    }
}
function readBuildkitDigest(metadataFile) {
    if (!fs.existsSync(metadataFile)) {
        return '';
    }
    try {
        const data = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
        return data['containerimage.digest'] || '';
    }
    catch (error) {
        core.warning(`Failed to parse BuildKit metadata file: ${error.message}`);
        return '';
    }
}
async function execRustBoringCache(args) {
    return execBoringCache(args);
}
function getCargoHome() {
    return process.env.CARGO_HOME || path.join(currentHomeDir(), '.cargo');
}
function configureCargoEnv() {
    const cargoHome = getCargoHome();
    process.env.CARGO_HOME = cargoHome;
    core.exportVariable('CARGO_HOME', cargoHome);
    core.addPath(path.join(cargoHome, 'bin'));
    core.exportVariable('CARGO_TERM_COLOR', 'always');
}
async function setupRustToolchain(version, options) {
    const profile = options.profile || 'minimal';
    await exec.exec('rustup', ['toolchain', 'install', version, '--profile', profile, '--no-self-update']);
    await exec.exec('rustup', ['default', version]);
    for (const target of parseList(options.targets || '', /,/)) {
        await exec.exec('rustup', ['target', 'add', target]);
    }
    for (const component of parseList(options.components || '', /,/)) {
        await exec.exec('rustup', ['component', 'add', component]);
    }
    await exec.exec('rustc', ['--version']);
}
async function detectRustVersion(workingDir, inputVersion) {
    if (inputVersion) {
        return inputVersion;
    }
    const toolchainToml = path.join(workingDir, 'rust-toolchain.toml');
    try {
        const content = await fs.promises.readFile(toolchainToml, 'utf-8');
        const match = content.match(/channel\s*=\s*["']([^"']+)["']/);
        if (match?.[1]) {
            return match[1];
        }
    }
    catch {
    }
    const toolchainFile = path.join(workingDir, 'rust-toolchain');
    try {
        return (await fs.promises.readFile(toolchainFile, 'utf-8')).trim();
    }
    catch {
    }
    const toolVersionsFile = path.join(workingDir, '.tool-versions');
    try {
        const content = await fs.promises.readFile(toolVersionsFile, 'utf-8');
        const rustLine = content.split('\n').find((line) => line.startsWith('rust '));
        if (rustLine) {
            return rustLine.split(/\s+/)[1].trim();
        }
    }
    catch {
    }
    return 'stable';
}
async function hasGitDependencies(lockPath) {
    try {
        const content = await fs.promises.readFile(lockPath, 'utf-8');
        return content.includes('source = "git+');
    }
    catch {
        return false;
    }
}
function getSccacheDir() {
    return process.env.SCCACHE_DIR || path.join(currentHomeDir(), '.cache', 'sccache');
}
function configureSccacheEnv(cacheSize, sccacheDir) {
    process.env.RUSTC_WRAPPER = 'sccache';
    core.exportVariable('RUSTC_WRAPPER', 'sccache');
    process.env.SCCACHE_DIR = sccacheDir;
    core.exportVariable('SCCACHE_DIR', sccacheDir);
    process.env.SCCACHE_CACHE_SIZE = cacheSize;
    core.exportVariable('SCCACHE_CACHE_SIZE', cacheSize);
    core.exportVariable('CC', 'sccache cc');
    core.exportVariable('CXX', 'sccache c++');
    core.exportVariable('SCCACHE_IDLE_TIMEOUT', process.env.SCCACHE_IDLE_TIMEOUT || '0');
    // SCCACHE_DIR is action-owned cache state selected by the action plan.
    // codeql[js/path-injection]
    fs.mkdirSync(sccacheDir, { recursive: true });
}
async function startSccacheServer() {
    await exec.exec('sccache', ['--start-server'], { ignoreReturnCode: true });
}
async function installSccache(versionInput = '0.14.0') {
    addLocalBinPaths();
    if (await (0, core_1.hasToolVersionOnPath)('sccache', versionInput)) {
        core.info(`Using existing sccache ${versionInput} from PATH`);
        return;
    }
    const version = versionInput.trim();
    if (!/^v?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(version)) {
        throw new Error(`Invalid sccache version: ${versionInput}`);
    }
    const normalizedVersion = version.startsWith('v') ? version : `v${version}`;
    let assetName = null;
    if (process.platform === 'linux') {
        if (process.arch === 'x64') {
            assetName = `sccache-${normalizedVersion}-x86_64-unknown-linux-musl`;
        }
        else if (process.arch === 'arm64') {
            assetName = `sccache-${normalizedVersion}-aarch64-unknown-linux-musl`;
        }
    }
    else if (process.platform === 'darwin' && process.arch === 'arm64') {
        assetName = `sccache-${normalizedVersion}-aarch64-apple-darwin`;
    }
    else if (process.platform === 'win32' && process.arch === 'x64') {
        assetName = `sccache-${normalizedVersion}-x86_64-pc-windows-msvc`;
    }
    if (!assetName) {
        await exec.exec('cargo', ['install', 'sccache', '--locked']);
        return;
    }
    const extension = process.platform === 'win32' ? '.zip' : '.tar.gz';
    const url = `https://github.com/mozilla/sccache/releases/download/${normalizedVersion}/${assetName}${extension}`;
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sccache-'));
    const archivePath = path.join(tempDir, `sccache${extension}`);
    try {
        const curlCode = await exec.exec('curl', ['-sS', '--fail', '--location', '--output', archivePath, url], {
            ignoreReturnCode: true,
        });
        if (curlCode !== 0) {
            throw new Error(`Failed to download sccache from ${url}`);
        }
        if (process.platform === 'win32') {
            await exec.exec('unzip', ['-q', archivePath, '-d', tempDir]);
        }
        else {
            await exec.exec('tar', ['-xzf', archivePath, '-C', tempDir]);
        }
        const installDir = path.join(currentHomeDir(), '.local', 'bin');
        // The install directory is runner-local tool state under the home directory.
        // codeql[js/path-injection]
        await fs.promises.mkdir(installDir, { recursive: true });
        const binaryName = process.platform === 'win32' ? 'sccache.exe' : 'sccache';
        const srcPath = path.join(tempDir, assetName, binaryName);
        const destPath = path.join(installDir, binaryName);
        // The source is from the verified release archive and destination is runner-local tool state.
        // codeql[js/path-injection]
        await fs.promises.copyFile(srcPath, destPath);
        if (process.platform !== 'win32') {
            // codeql[js/path-injection]
            await fs.promises.chmod(destPath, 0o755);
        }
        core.addPath(installDir);
    }
    finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
}
async function stopSccacheServer() {
    let output = '';
    try {
        await exec.exec('sccache', ['--show-stats'], {
            ignoreReturnCode: true,
            listeners: {
                stdout: (data) => {
                    const text = data.toString();
                    output += text;
                    process.stdout.write(text);
                },
                stderr: (data) => {
                    const text = data.toString();
                    output += text;
                    process.stderr.write(text);
                },
            },
        });
    }
    catch {
    }
    finally {
        try {
            await exec.exec('sccache', ['--stop-server'], { ignoreReturnCode: true });
        }
        catch {
        }
    }
    return summarizeSccacheStats(output);
}
async function startPortableCacheProxy(workspace, port, tag, readOnly = false, proxyPlan) {
    const proxy = await (0, core_1.startRegistryProxy)(actionProxyOptions({
        command: 'cache-registry',
        workspace,
        tag,
        host: proxyPlan.host || '127.0.0.1',
        port,
        noPlatform: proxyPlan.no_platform,
        noGit: proxyPlan.no_git,
        readOnly,
    }, proxyPlan));
    return proxy;
}
function parseSccacheIntegerStat(output, label) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = output.match(new RegExp(`^${escaped}\\s+(\\d+)$`, 'm'));
    return match ? Number.parseInt(match[1], 10) : null;
}
function parseSccacheTextStat(output, label) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = output.match(new RegExp(`^${escaped}\\s+(.+)$`, 'm'));
    return match ? match[1].trim() : null;
}
function summarizeSccacheStats(output) {
    if (!output.trim()) {
        return null;
    }
    const compileRequests = parseSccacheIntegerStat(output, 'Compile requests');
    const cacheHits = parseSccacheIntegerStat(output, 'Cache hits');
    const cacheMisses = parseSccacheIntegerStat(output, 'Cache misses');
    if (compileRequests === null || cacheHits === null || cacheMisses === null) {
        return null;
    }
    return {
        compileRequests,
        cacheHits,
        cacheMisses,
        rustHitRate: parseSccacheTextStat(output, 'Cache hits rate (Rust)'),
    };
}
function emptyRustTagCheckStatus() {
    return {
        hit: false,
        cacheEntryHit: false,
        kvHit: false,
        kvChecked: false,
    };
}
function checkResultHasKvProbe(result) {
    return typeof result.kv_entry_count === 'number'
        || typeof result.kv_total_size === 'number'
        || (result.status === 'hit' && result.cache_type === 'kv');
}
function checkResultHasKvRows(result) {
    if (typeof result.kv_entry_count === 'number') {
        return result.kv_entry_count > 0;
    }
    return result.status === 'hit' && result.cache_type === 'kv';
}
function checkResultHasCacheEntryHit(result) {
    if (result.status !== 'hit') {
        return false;
    }
    return result.cache_type !== 'kv';
}
async function checkRustTagStatus(workspace, tag, { noPlatform = false, noGit = false, requireServerSignature = false, } = {}) {
    const args = ['check', workspace, tag, '--json'];
    if (requireServerSignature) {
        args.unshift('--require-server-signature');
    }
    if (noPlatform) {
        args.push('--no-platform');
    }
    if (noGit) {
        args.push('--no-git');
    }
    let stdout = '';
    const exitCode = await execBoringCache(args, {
        ignoreReturnCode: true,
        silent: true,
        listeners: {
            stdout: (data) => {
                stdout += data.toString();
            },
        },
    });
    if (exitCode !== 0) {
        return emptyRustTagCheckStatus();
    }
    try {
        const summary = JSON.parse(stdout);
        const results = summary.results || [];
        const cacheEntryHit = results.some(checkResultHasCacheEntryHit);
        const kvHit = results.some(checkResultHasKvRows);
        const kvChecked = results.some(checkResultHasKvProbe);
        const legacyHit = results.length === 0 && typeof summary.hits === 'number' && summary.hits > 0;
        return {
            hit: cacheEntryHit || kvHit || legacyHit,
            cacheEntryHit: cacheEntryHit || legacyHit,
            kvHit,
            kvChecked,
        };
    }
    catch (error) {
        core.warning(`Failed to parse boringcache check JSON for ${tag}: ${error.message}`);
        return emptyRustTagCheckStatus();
    }
}
async function checkRustTagHit(workspace, tag, options = {}) {
    return (await checkRustTagStatus(workspace, tag, options)).hit;
}
async function checkRustProxyTagStatus(workspace, tag, options = {}) {
    const strictStatus = await checkRustTagStatus(workspace, tag, {
        ...options,
        requireServerSignature: true,
    });
    if (strictStatus.kvChecked || strictStatus.kvHit) {
        return strictStatus;
    }
    const kvStatus = await checkRustTagStatus(workspace, tag, {
        ...options,
        requireServerSignature: false,
    });
    return {
        hit: strictStatus.cacheEntryHit || kvStatus.kvHit,
        cacheEntryHit: strictStatus.cacheEntryHit,
        kvHit: kvStatus.kvHit,
        kvChecked: kvStatus.kvChecked || kvStatus.kvHit,
    };
}
function configureTurboRemoteEnv(apiUrl, token, team) {
    core.exportVariable('TURBO_API', apiUrl);
    core.exportVariable('TURBO_TOKEN', token);
    core.exportVariable('TURBO_TEAM', team || 'team_boringcache');
}
function rewritePlannedProxyPort(value, plannedPort, actualPort) {
    if (plannedPort === actualPort) {
        return value;
    }
    return value.replace(new RegExp(`:${plannedPort}(?=/|$)`), `:${actualPort}`);
}
function turboEnvForStartedProxy(plan, actualPort, tokenOverride, teamOverride) {
    const envVars = {};
    for (const [key, value] of Object.entries(plan.env_vars || {})) {
        envVars[key] = rewritePlannedProxyPort(value, plan.proxy.port, actualPort);
    }
    const endpointHost = plan.proxy.endpoint_host || '127.0.0.1';
    envVars.TURBO_API = `http://${endpointHost}:${actualPort}`;
    envVars.TURBO_TOKEN = tokenOverride.trim()
        || envVars.TURBO_TOKEN
        || 'boringcache';
    envVars.TURBO_TEAM = teamOverride.trim()
        || envVars.TURBO_TEAM
        || 'boringcache';
    envVars.BORINGCACHE_PROXY_PORT = String(actualPort);
    return envVars;
}
function nxEnvForStartedProxy(plan, actualPort, accessTokenOverride) {
    const envVars = {};
    for (const [key, value] of Object.entries(plan.env_vars || {})) {
        envVars[key] = rewritePlannedProxyPort(value, plan.proxy.port, actualPort);
    }
    const endpointHost = plan.proxy.endpoint_host || '127.0.0.1';
    envVars.NX_SELF_HOSTED_REMOTE_CACHE_SERVER = `http://${endpointHost}:${actualPort}`;
    envVars.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN = accessTokenOverride.trim()
        || envVars.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN
        || 'boringcache';
    envVars.BORINGCACHE_PROXY_PORT = String(actualPort);
    return envVars;
}
function plannedNodePackageManagerEnv(packageManager, plan) {
    const plannedEnv = plan.env_vars || {};
    if (!packageManager) {
        return {};
    }
    const envVars = {};
    switch (packageManager.name) {
        case 'pnpm':
            for (const key of ['PNPM_STORE_DIR', 'NPM_CONFIG_STORE_DIR']) {
                if (plannedEnv[key]) {
                    envVars[key] = plannedEnv[key];
                }
            }
            break;
        case 'yarn':
            for (const key of ['YARN_CACHE_FOLDER', 'YARN_ENABLE_GLOBAL_CACHE']) {
                if (plannedEnv[key]) {
                    envVars[key] = plannedEnv[key];
                }
            }
            break;
        case 'npm':
            for (const key of ['npm_config_cache', 'NPM_CONFIG_CACHE']) {
                if (plannedEnv[key]) {
                    envVars[key] = plannedEnv[key];
                }
            }
            break;
    }
    return envVars;
}
function plannedNodePackageManagerCacheDir(packageManager, plan) {
    if (!packageManager) {
        return null;
    }
    switch (packageManager.name) {
        case 'pnpm':
            return plan.env_vars?.PNPM_STORE_DIR || plan.env_vars?.NPM_CONFIG_STORE_DIR || packageManager.cacheDir;
        case 'yarn':
            return plan.env_vars?.YARN_CACHE_FOLDER || packageManager.cacheDir;
        case 'npm':
            return plan.env_vars?.npm_config_cache || plan.env_vars?.NPM_CONFIG_CACHE || packageManager.cacheDir;
    }
}
async function ensureCorepackPackageManager(workingDirectory, packageManager, runtimeTools) {
    if (!packageManager || packageManager.name === 'npm' || runtimeTools.some((tool) => tool.name === packageManager.name)) {
        return;
    }
    const corepackEnabled = await exec.exec('corepack', ['enable'], { cwd: workingDirectory, ignoreReturnCode: true });
    if (corepackEnabled !== 0) {
        core.notice(`corepack enable failed for ${packageManager.name}; continuing without corepack bootstrap`);
        return;
    }
    if (packageManager.packageManagerField) {
        await exec.exec('corepack', ['install'], { cwd: workingDirectory, ignoreReturnCode: true });
        return;
    }
    if (packageManager.version) {
        await exec.exec('corepack', ['prepare', `${packageManager.name}@${packageManager.version}`, '--activate'], { cwd: workingDirectory, ignoreReturnCode: true });
    }
}
function sccacheEnvForStartedProxy(plan, actualPort) {
    const envVars = {};
    for (const [key, value] of Object.entries(plan.env_vars || {})) {
        envVars[key] = rewritePlannedProxyPort(value, plan.proxy.port, actualPort);
    }
    envVars.SCCACHE_IDLE_TIMEOUT = process.env.SCCACHE_IDLE_TIMEOUT
        || envVars.SCCACHE_IDLE_TIMEOUT
        || '0';
    return envVars;
}
function getRustArchiveEntry(entries, requested, description) {
    const entry = entries.get(requested);
    if (!entry?.path?.trim()) {
        throw new Error(`CLI dry-run did not resolve a ${description} path for ${requested}.`);
    }
    return entry;
}
function saveRustArchiveEntryState(key, entry) {
    saveModeState(`${key}-tag`, entry.tag);
    saveModeState(`${key}-path`, entry.path);
}
function readRustArchiveEntryState(key) {
    const tag = getModeState(`${key}-tag`);
    const entryPath = getModeState(`${key}-path`);
    if (!tag || !entryPath) {
        return null;
    }
    return {
        requested: key,
        tag,
        path: entryPath,
        tagPathPair: `${tag}:${entryPath}`,
    };
}
function buildRustCacheArgs(action, workspace, entry, verbose, exclude = '') {
    const args = [action, workspace, entry.tagPathPair];
    if (verbose) {
        args.push('--verbose');
    }
    if (action === 'save' && exclude) {
        args.push('--exclude', exclude);
    }
    return args;
}
async function restoreRustArchiveEntry(workspace, entry, verbose) {
    const preflightHit = await checkRustTagHit(workspace, entry.tag);
    const exitCode = await execRustBoringCache(buildRustCacheArgs('restore', workspace, entry, verbose));
    return preflightHit && exitCode === 0;
}
function toolEnabled(plan, toolName) {
    return plan.runtimeTools.some((tool) => tool.name === toolName);
}
async function runDockerRestore(plan, inputs) {
    const context = path.resolve(plan.workingDirectory, core.getInput('context') || '.');
    const dockerfile = core.getInput('dockerfile') || 'Dockerfile';
    const dockerCommand = normalizeDockerCommand(core.getInput('docker-command'));
    const shouldBuild = dockerCommand !== 'setup';
    const imageInput = core.getInput('image') || '';
    const image = shouldBuild
        ? core.getInput('image', { required: true })
        : (imageInput || 'boringcache/docker-setup');
    const tags = parseList(core.getInput('tags') || 'latest');
    const buildArgs = parseMultiline(core.getInput('build-args') || '');
    const secrets = parseMultiline(core.getInput('secrets') || '');
    const dockerToolCache = inputs.dockerToolCache;
    const dockerToolCaches = parseList(dockerToolCache);
    const target = core.getInput('target') || '';
    const platforms = core.getInput('platforms') || '';
    const push = parseBooleanInput(core.getInput('push'), 'push', false);
    const load = parseBooleanInput(core.getInput('load'), 'load', true) && !platforms;
    const noCache = parseBooleanInput(core.getInput('no-cache'), 'no-cache', false);
    const provenance = parseBooleanInput(core.getInput('provenance'), 'provenance', false);
    const sbom = parseBooleanInput(core.getInput('sbom'), 'sbom', false);
    const cacheMode = normalizeDockerCacheMode(core.getInput('cache-mode'));
    const driver = core.getInput('driver') || 'docker-container';
    const driverOpts = parseMultiline(core.getInput('driver-opts') || '');
    const buildkitdConfigInline = core.getInput('buildkitd-config-inline') || '';
    const cacheBackend = normalizeDockerCacheBackend(core.getInput('cache-backend') || 'registry');
    const buildkitCacheBackend = buildKitCacheBackendFor(cacheBackend);
    if (dockerToolCaches.length > 0 && !shouldBuild) {
        throw new Error('docker-tool-cache requires docker-command=build so boringcache docker can inject the BuildKit secret.');
    }
    const registryTagInput = core.getInput('registry-tag') || '';
    const registryRefTagInput = core.getInput('registry-ref-tag') || '';
    const localCacheTag = inputs.cacheTag || slugify(image);
    const cacheFlags = { verbose: inputs.verbose, exclude: inputs.exclude };
    const registryCachePlan = usesRegistryCachePlan(cacheBackend);
    let registryVerification = null;
    let registryOciCache;
    let modeEvidence;
    let resolvedWorkspace = plan.workspace;
    let resolvedCacheTag = localCacheTag;
    saveModeState('workspace', plan.workspace);
    saveModeState('cache-tag', localCacheTag);
    saveModeState('verbose', String(inputs.verbose));
    saveModeState('exclude', inputs.exclude);
    const builderName = await setupBuildxBuilder(driver, driverOpts, buildkitdConfigInline, registryCachePlan, cacheBackend === 'boringcache');
    saveModeState('builder-name', builderName);
    core.setOutput('buildx-name', builderName);
    core.setOutput('buildx-platforms', await getBuilderPlatforms(builderName));
    await setupQemuIfNeeded(platforms);
    if (registryCachePlan) {
        let proxyBindHost = '127.0.0.1';
        let refHost = '127.0.0.1';
        if (driver === 'docker-container') {
            const containerName = `buildx_buildkit_${builderName}0`;
            const networkMode = await getContainerNetworkMode(containerName);
            if (networkMode !== 'host') {
                proxyBindHost = '0.0.0.0';
                refHost = await getContainerGateway(containerName);
            }
        }
        const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port', 5000);
        const dockerPlan = await resolveDockerCliPlan(plan.workspace, plan.workingDirectory, getEffectiveRegistryTag(localCacheTag, registryTagInput), requestedPort, proxyBindHost, refHost, inputs.proxyNoPlatform, inputs.proxyNoGit, proxyPlanningReadOnly(inputs.readOnly), cacheMode, registryRefTagInput || DEFAULT_REGISTRY_CACHE_REF_TAG, inputs.ociHydration, inputs.metadataHints, buildkitCacheBackend, dockerToolCache);
        const requestedImportRefTags = registryCacheFromRefTags(dockerPlan.oci_cache);
        const cacheTag = dockerPlan.tag;
        const usesCliWrappedBuild = dockerToolCaches.length > 0;
        if (usesCliWrappedBuild) {
            const planState = recordOciRegistryPlanState(dockerPlan, cacheTag);
            resolvedWorkspace = planState.resolvedWorkspace;
            resolvedCacheTag = planState.resolvedCacheTag;
            registryVerification = planState.registryVerification;
            registryOciCache = planState.registryOciCache;
            const effectiveImports = effectiveRegistryCacheImports(dockerPlan.oci_cache);
            setRegistryCacheOutputs({
                ref: dockerPlan.oci_cache.registry_ref,
                from: effectiveImports.importSpecs,
                to: dockerPlan.oci_cache.cache_to,
                ociCache: dockerPlan.oci_cache,
                usedRefTags: effectiveImports.readableRefTags,
                unreadableRefTags: effectiveImports.unreadableRefTags,
                importReady: effectiveImports.importReady,
            });
            if (shouldBuild) {
                await buildDockerImageWithCliAdapter(dockerPlan.workspace, getEffectiveRegistryTag(localCacheTag, registryTagInput), buildkitCacheBackend, requestedPort, proxyBindHost, refHost, inputs, cacheMode, registryRefTagInput || DEFAULT_REGISTRY_CACHE_REF_TAG, {
                    dockerfile,
                    context,
                    image,
                    tags,
                    buildArgs,
                    secrets,
                    target,
                    platforms,
                    push,
                    load,
                    noCache,
                    provenance,
                    sbom,
                    builder: builderName,
                    cacheMode,
                });
            }
            modeEvidence = registryCacheEvidence('docker', dockerPlan.oci_cache, effectiveImports, dockerPlan.oci_cache.cache_to);
        }
        else {
            const proxy = await (0, core_1.startRegistryProxy)(actionProxyOptions({
                command: 'cache-registry',
                workspace: dockerPlan.workspace,
                tag: cacheTag,
                host: dockerPlan.proxy.host || proxyBindHost,
                port: dockerPlan.proxy.port,
                noGit: dockerPlan.proxy.no_git,
                noPlatform: dockerPlan.proxy.no_platform,
                verbose: inputs.verbose,
                readOnly: dockerPlan.proxy.read_only,
                ociRequiredReadableRefs: requestedImportRefTags,
                requireOciImportReady: inputs.requireOciImportReady,
                ociAliasPromotionRefs: dockerPlan.oci_cache?.promotion_ref_tags || [],
            }, dockerPlan.proxy));
            saveModeState('proxy-pid', String(proxy.pid));
            saveProxyModeState(proxy.port);
            saveModeState('proxy-host', dockerPlan.proxy.host || proxyBindHost);
            saveModeState('proxy-no-git', String(dockerPlan.proxy.no_git));
            saveModeState('proxy-no-platform', String(dockerPlan.proxy.no_platform));
            saveModeState('oci-promotion-ref-tags', (dockerPlan.oci_cache?.promotion_ref_tags || []).join(','));
            setProxyOutputs(proxy.port);
            const planState = recordOciRegistryPlanState(dockerPlan, cacheTag);
            resolvedWorkspace = planState.resolvedWorkspace;
            resolvedCacheTag = planState.resolvedCacheTag;
            registryVerification = planState.registryVerification;
            registryOciCache = planState.registryOciCache;
            const effectiveImports = effectiveRegistryCacheImports(dockerPlan.oci_cache, proxy);
            setRegistryCacheOutputs({
                ref: dockerPlan.oci_cache.registry_ref,
                from: effectiveImports.importSpecs,
                to: dockerPlan.oci_cache.cache_to,
                ociCache: dockerPlan.oci_cache,
                usedRefTags: effectiveImports.readableRefTags,
                unreadableRefTags: effectiveImports.unreadableRefTags,
                importReady: effectiveImports.importReady,
            });
            if (shouldBuild) {
                await buildDockerImage({
                    dockerfile,
                    context,
                    image,
                    tags,
                    buildArgs,
                    secrets,
                    target,
                    platforms,
                    push,
                    load,
                    noCache,
                    provenance,
                    sbom,
                    builder: builderName,
                    cacheMode,
                    cacheFrom: effectiveImports.importSpecs,
                    cacheTo: dockerPlan.oci_cache.cache_to,
                });
            }
            modeEvidence = registryCacheEvidence('docker', dockerPlan.oci_cache, effectiveImports, dockerPlan.oci_cache.cache_to);
        }
    }
    else {
        ensureDir(DOCKER_CACHE_DIR_FROM);
        ensureDir(DOCKER_CACHE_DIR_TO);
        saveModeState('cache-dir', DOCKER_CACHE_DIR_TO);
        await restoreSimpleCache(plan.workspace, localCacheTag, DOCKER_CACHE_DIR_FROM, cacheFlags);
        setLocalCacheOutputs(DOCKER_CACHE_DIR_FROM, DOCKER_CACHE_DIR_TO, cacheMode);
        modeEvidence = {
            adapter: 'docker',
            cache_backend: 'local',
            cache_dir_from: DOCKER_CACHE_DIR_FROM,
            cache_dir_to: DOCKER_CACHE_DIR_TO,
            import_ready: true,
        };
        if (shouldBuild) {
            await buildDockerImage({
                dockerfile,
                context,
                image,
                tags,
                buildArgs,
                secrets,
                target,
                platforms,
                push,
                load,
                noCache,
                provenance,
                sbom,
                builder: builderName,
                cacheMode,
                cacheDirFrom: DOCKER_CACHE_DIR_FROM,
                cacheDirTo: DOCKER_CACHE_DIR_TO,
            });
        }
    }
    if (shouldBuild) {
        const { imageId, digest } = readDockerMetadata();
        core.setOutput('image-id', imageId);
        core.setOutput('digest', digest);
    }
    core.setOutput('workspace', resolvedWorkspace);
    core.setOutput('cache-tag', resolvedCacheTag);
    const saveExpected = registryVerification?.saveExpected ?? !inputs.readOnly;
    return {
        cacheTag: resolvedCacheTag,
        evidence: modeEvidence,
        // docker-command=setup defers the build to later workflow steps, so treat
        // write-capable registry refs as save-expected and verify after post-save.
        verificationSpecs: registryCacheVerificationSpecs(resolvedCacheTag, registryOciCache, registryVerification?.noPlatform || false, registryVerification?.noGit || false, saveExpected, plan.workingDirectory),
    };
}
async function runDockerSave(options = {}) {
    const allowSaves = options.allowSaves !== false;
    const builderName = getModeState('builder-name');
    try {
        const proxyPid = getModeState('proxy-pid');
        if (proxyPid) {
            if (allowSaves) {
                await verifyOciPromotionRefsThenStopProxy(proxyPid);
            }
            else {
                await stopProxyFromState();
            }
            return;
        }
        if (!allowSaves) {
            return;
        }
        const workspace = getModeState('workspace');
        const cacheDir = getModeState('cache-dir');
        const cacheTag = getModeState('cache-tag');
        if (!workspace || !cacheDir || !cacheTag) {
            return;
        }
        addLocalBinPaths();
        await saveSimpleCache(workspace, cacheTag, cacheDir, {
            verbose: getModeState('verbose') === 'true',
            exclude: getModeState('exclude'),
        });
    }
    finally {
        await cleanupBuildxBuilder(builderName);
    }
}
async function runBuildkitRestore(plan, inputs) {
    const workspaceRoot = process.env.GITHUB_WORKSPACE || plan.workingDirectory;
    const contextInput = core.getInput('context') || '.';
    const contextPath = path.resolve(plan.workingDirectory, contextInput);
    const dockerfileInput = core.getInput('dockerfile') || 'Dockerfile';
    const dockerfilePath = path.resolve(plan.workingDirectory, contextInput, dockerfileInput);
    const dockerfileDir = path.dirname(dockerfilePath);
    const dockerfileName = path.basename(dockerfilePath);
    if (!fs.existsSync(contextPath)) {
        throw new Error(`Context path does not exist: ${contextPath}`);
    }
    if (!fs.existsSync(dockerfilePath)) {
        throw new Error(`Dockerfile does not exist: ${dockerfilePath}`);
    }
    const image = core.getInput('image', { required: true });
    const tags = parseList(core.getInput('tags') || 'latest');
    const imageTags = tags.length > 0 ? tags.map((tag) => `${image}:${tag}`) : [`${image}:latest`];
    const push = parseBooleanInput(core.getInput('push'), 'push', false);
    const output = core.getInput('output') || '';
    const buildArgs = parseMultiline(core.getInput('build-args') || '');
    const secrets = parseMultiline(core.getInput('secrets') || '');
    const sshSpecs = parseMultiline(core.getInput('ssh') || '');
    const target = core.getInput('target') || '';
    const platforms = core.getInput('platforms') || '';
    const noCache = parseBooleanInput(core.getInput('no-cache'), 'no-cache', false);
    const cacheMode = normalizeDockerCacheMode(core.getInput('cache-mode'));
    const buildkitHost = core.getInput('buildkit-host', { required: true });
    const tlsCaInput = core.getInput('buildkit-tls-ca') || '';
    const tlsCertInput = core.getInput('buildkit-tls-cert') || '';
    const tlsKeyInput = core.getInput('buildkit-tls-key') || '';
    const tlsSkipVerify = parseBooleanInput(core.getInput('buildkit-tls-skip-verify'), 'buildkit-tls-skip-verify', false);
    const cacheBackend = normalizeDockerCacheBackend(core.getInput('cache-backend') || 'registry');
    const buildkitCacheBackend = buildKitCacheBackendFor(cacheBackend);
    const registryTagInput = core.getInput('registry-tag') || '';
    const registryRefTagInput = core.getInput('registry-ref-tag') || '';
    const localCacheTag = inputs.cacheTag || slugify(image);
    const cacheFlags = { verbose: inputs.verbose, exclude: inputs.exclude };
    const registryCachePlan = usesRegistryCachePlan(cacheBackend);
    let registryVerification = null;
    let registryOciCache;
    let modeEvidence;
    let resolvedWorkspace = plan.workspace;
    let resolvedCacheTag = localCacheTag;
    saveModeState('workspace', plan.workspace);
    saveModeState('cache-tag', localCacheTag);
    saveModeState('verbose', String(inputs.verbose));
    saveModeState('exclude', inputs.exclude);
    if (fs.existsSync(BUILDKIT_METADATA_FILE)) {
        fs.rmSync(BUILDKIT_METADATA_FILE);
    }
    await installBuildctl();
    const tlsCa = materializeMaybeFile(tlsCaInput, 'buildkit-ca.pem', workspaceRoot);
    const tlsCert = materializeMaybeFile(tlsCertInput, 'buildkit-cert.pem', workspaceRoot);
    const tlsKey = materializeMaybeFile(tlsKeyInput, 'buildkit-key.pem', workspaceRoot);
    if (registryCachePlan) {
        let proxyBindHost = '127.0.0.1';
        let refHost = '127.0.0.1';
        if (buildkitHost.startsWith('docker-container://')) {
            const containerName = buildkitHost.replace('docker-container://', '');
            const networkMode = await getContainerNetworkMode(containerName);
            if (networkMode !== 'host') {
                proxyBindHost = '0.0.0.0';
                refHost = await getContainerGateway(containerName);
            }
        }
        const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port', 5000);
        const dockerPlan = await resolveBuildkitCliPlan(plan.workspace, plan.workingDirectory, getEffectiveRegistryTag(localCacheTag, registryTagInput), requestedPort, proxyBindHost, refHost, inputs.proxyNoPlatform, inputs.proxyNoGit, proxyPlanningReadOnly(inputs.readOnly), cacheMode, registryRefTagInput || DEFAULT_REGISTRY_CACHE_REF_TAG, inputs.ociHydration, inputs.metadataHints, buildkitCacheBackend);
        const requestedImportRefTags = registryCacheFromRefTags(dockerPlan.oci_cache);
        const cacheTag = dockerPlan.tag;
        const proxy = await (0, core_1.startRegistryProxy)(actionProxyOptions({
            command: 'cache-registry',
            workspace: dockerPlan.workspace,
            tag: cacheTag,
            host: dockerPlan.proxy.host || proxyBindHost,
            port: dockerPlan.proxy.port,
            noGit: dockerPlan.proxy.no_git,
            noPlatform: dockerPlan.proxy.no_platform,
            verbose: inputs.verbose,
            readOnly: dockerPlan.proxy.read_only,
            ociRequiredReadableRefs: requestedImportRefTags,
            requireOciImportReady: inputs.requireOciImportReady,
            ociAliasPromotionRefs: dockerPlan.oci_cache?.promotion_ref_tags || [],
        }, dockerPlan.proxy));
        saveModeState('proxy-pid', String(proxy.pid));
        saveProxyModeState(proxy.port);
        saveModeState('proxy-host', dockerPlan.proxy.host || proxyBindHost);
        saveModeState('proxy-no-git', String(dockerPlan.proxy.no_git));
        saveModeState('proxy-no-platform', String(dockerPlan.proxy.no_platform));
        saveModeState('oci-promotion-ref-tags', (dockerPlan.oci_cache?.promotion_ref_tags || []).join(','));
        setProxyOutputs(proxy.port);
        const planState = recordOciRegistryPlanState(dockerPlan, cacheTag);
        resolvedWorkspace = planState.resolvedWorkspace;
        resolvedCacheTag = planState.resolvedCacheTag;
        registryVerification = planState.registryVerification;
        registryOciCache = planState.registryOciCache;
        const effectiveImports = effectiveRegistryCacheImports(dockerPlan.oci_cache, proxy);
        setRegistryCacheOutputs({
            ref: dockerPlan.oci_cache.registry_ref,
            from: effectiveImports.importSpecs,
            to: dockerPlan.oci_cache.cache_to,
            ociCache: dockerPlan.oci_cache,
            usedRefTags: effectiveImports.readableRefTags,
            unreadableRefTags: effectiveImports.unreadableRefTags,
            importReady: effectiveImports.importReady,
        });
        await buildWithBuildctl({
            addr: buildkitHost,
            tlsCa,
            tlsCert,
            tlsKey,
            tlsSkipVerify,
            contextPath,
            dockerfileDir,
            dockerfileName,
            buildArgs,
            secrets,
            sshSpecs,
            target,
            platforms,
            cacheMode,
            importCache: effectiveImports.importSpecs,
            exportCache: dockerPlan.oci_cache.cache_to,
            output,
            imageTags,
            push,
            noCache,
            metadataFile: BUILDKIT_METADATA_FILE,
        });
        modeEvidence = registryCacheEvidence('buildkit', dockerPlan.oci_cache, effectiveImports, dockerPlan.oci_cache.cache_to);
    }
    else {
        ensureDir(BUILDKIT_CACHE_DIR_FROM);
        ensureDir(BUILDKIT_CACHE_DIR_TO);
        saveModeState('cache-dir', BUILDKIT_CACHE_DIR_TO);
        await restoreSimpleCache(plan.workspace, localCacheTag, BUILDKIT_CACHE_DIR_FROM, cacheFlags);
        setLocalCacheOutputs(BUILDKIT_CACHE_DIR_FROM, BUILDKIT_CACHE_DIR_TO, cacheMode);
        modeEvidence = {
            adapter: 'buildkit',
            cache_backend: 'local',
            cache_dir_from: BUILDKIT_CACHE_DIR_FROM,
            cache_dir_to: BUILDKIT_CACHE_DIR_TO,
            import_ready: true,
        };
        await buildWithBuildctl({
            addr: buildkitHost,
            tlsCa,
            tlsCert,
            tlsKey,
            tlsSkipVerify,
            contextPath,
            dockerfileDir,
            dockerfileName,
            buildArgs,
            secrets,
            sshSpecs,
            target,
            platforms,
            cacheMode,
            cacheDirFrom: BUILDKIT_CACHE_DIR_FROM,
            cacheDirTo: BUILDKIT_CACHE_DIR_TO,
            output,
            imageTags,
            push,
            noCache,
            metadataFile: BUILDKIT_METADATA_FILE,
        });
    }
    core.setOutput('digest', readBuildkitDigest(BUILDKIT_METADATA_FILE));
    core.setOutput('workspace', resolvedWorkspace);
    core.setOutput('cache-tag', resolvedCacheTag);
    const saveExpected = registryVerification?.saveExpected ?? !inputs.readOnly;
    return {
        cacheTag: resolvedCacheTag,
        evidence: modeEvidence,
        verificationSpecs: registryCacheVerificationSpecs(resolvedCacheTag, registryOciCache, registryVerification?.noPlatform || false, registryVerification?.noGit || false, saveExpected, plan.workingDirectory),
    };
}
async function runBuildkitSave(options = {}) {
    const allowSaves = options.allowSaves !== false;
    const proxyPid = getModeState('proxy-pid');
    if (proxyPid) {
        if (allowSaves) {
            await verifyOciPromotionRefsThenStopProxy(proxyPid);
        }
        else {
            await stopProxyFromState();
        }
        return;
    }
    if (!allowSaves) {
        return;
    }
    const workspace = getModeState('workspace');
    const cacheDir = getModeState('cache-dir');
    const cacheTag = getModeState('cache-tag');
    if (!workspace || !cacheDir || !cacheTag) {
        return;
    }
    addLocalBinPaths();
    await saveSimpleCache(workspace, cacheTag, cacheDir, {
        verbose: getModeState('verbose') === 'true',
        exclude: getModeState('exclude'),
    });
}
async function runBazelRestore(plan, inputs) {
    const inputVersion = core.getInput('bazel-version') || '';
    const bazelrcLines = core.getInput('bazelrc-lines') || '';
    const runtimeVersion = plan.runtimeTools.find((tool) => tool.name === 'bazel')?.version || '';
    const bazelVersion = inputVersion || runtimeVersion;
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const proxyPlan = await resolveAdapterCliPlan('bazel', plan.workspace, plan.workingDirectory, inputs.cacheTag, requestedPort, inputs.proxyNoPlatform, inputs.proxyNoGit, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
        bazelrcLines,
    });
    const workspace = proxyPlan.workspace;
    const cacheTag = proxyPlan.tag;
    const setup = requireAdapterSetupPlan('bazel', proxyPlan.setup);
    saveModeState('proxy-pid', '');
    if (bazelVersion) {
        core.exportVariable('USE_BAZEL_VERSION', bazelVersion);
    }
    const proxy = await (0, core_1.startRegistryProxy)(actionProxyOptions({
        command: 'cache-registry',
        workspace,
        tag: cacheTag,
        host: proxyPlan.proxy.host || '127.0.0.1',
        port: proxyPlan.proxy.port,
        noGit: proxyPlan.proxy.no_git,
        noPlatform: proxyPlan.proxy.no_platform,
        verbose: inputs.verbose,
        readOnly: proxyPlan.proxy.read_only,
    }, proxyPlan.proxy));
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy.port);
    applyAdapterSetupPlan(setup);
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('workspace', workspace);
    return {
        cacheTag,
        verificationSpecs: [adapterProxyVerificationSpec(cacheTag, proxyPlan.proxy, plan.workingDirectory)],
    };
}
function configureGoProxyEnv(gocacheprog) {
    core.exportVariable('GOCACHEPROG', gocacheprog);
}
function goCacheProgForProxy(proxyPlan, port) {
    const endpoint = `http://${proxyPlan.proxy.endpoint_host}:${port}`;
    const planned = proxyPlan.env_vars?.GOCACHEPROG?.trim();
    if (!planned) {
        return `boringcache go-cacheprog --endpoint ${endpoint}`;
    }
    if (planned.includes('--endpoint=')) {
        return planned.replace(/--endpoint=\S+/, `--endpoint=${endpoint}`);
    }
    if (planned.includes('--endpoint')) {
        return planned.replace(/--endpoint\s+\S+/, `--endpoint ${endpoint}`);
    }
    return `${planned} --endpoint ${endpoint}`;
}
async function runGoRestore(plan, inputs) {
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const proxyPlan = await resolveAdapterCliPlan('go', plan.workspace, plan.workingDirectory, inputs.cacheTag, requestedPort, inputs.proxyNoPlatform, inputs.proxyNoGit, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
    });
    const workspace = proxyPlan.workspace;
    const cacheTag = proxyPlan.tag;
    saveModeState('proxy-pid', '');
    const proxy = await (0, core_1.startRegistryProxy)(actionProxyOptions({
        command: 'cache-registry',
        workspace,
        tag: cacheTag,
        host: proxyPlan.proxy.host || '127.0.0.1',
        port: proxyPlan.proxy.port,
        noGit: proxyPlan.proxy.no_git,
        noPlatform: proxyPlan.proxy.no_platform,
        verbose: inputs.verbose,
        readOnly: proxyPlan.proxy.read_only,
    }, proxyPlan.proxy));
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy.port);
    configureGoProxyEnv(goCacheProgForProxy(proxyPlan, proxy.port));
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('workspace', workspace);
    return {
        cacheTag,
        verificationSpecs: [adapterProxyVerificationSpec(cacheTag, proxyPlan.proxy, plan.workingDirectory)],
    };
}
async function runGradleRestore(plan, inputs) {
    const gradleHome = core.getInput('gradle-home') || '';
    const enableBuildCache = parseBooleanInput(core.getInput('enable-build-cache'), 'enable-build-cache', true);
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const proxyPlan = await resolveAdapterCliPlan('gradle', plan.workspace, plan.workingDirectory, inputs.cacheTag, requestedPort, inputs.proxyNoPlatform, inputs.proxyNoGit, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
        gradleHome,
        enableGradleBuildCache: enableBuildCache,
    });
    const workspace = proxyPlan.workspace;
    const cacheTag = proxyPlan.tag;
    const setup = requireAdapterSetupPlan('gradle', proxyPlan.setup);
    const proxy = await (0, core_1.startRegistryProxy)(actionProxyOptions({
        command: 'cache-registry',
        workspace,
        tag: cacheTag,
        host: proxyPlan.proxy.host || '127.0.0.1',
        port: proxyPlan.proxy.port,
        noGit: proxyPlan.proxy.no_git,
        noPlatform: proxyPlan.proxy.no_platform,
        verbose: inputs.verbose,
        readOnly: proxyPlan.proxy.read_only,
    }, proxyPlan.proxy));
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy.port);
    applyAdapterSetupPlan(setup);
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('workspace', workspace);
    return {
        cacheTag,
        verificationSpecs: [adapterProxyVerificationSpec(cacheTag, proxyPlan.proxy, plan.workingDirectory)],
    };
}
async function runMavenRestore(plan, inputs) {
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const mavenExtensionsPath = core.getInput('maven-extensions-path') || '';
    const mavenBuildCacheConfigPath = core.getInput('maven-build-cache-config-path') || '';
    const mavenLocalRepo = core.getInput('maven-local-repo') || '';
    const mavenBuildCacheExtensionVersion = core.getInput('maven-build-cache-extension-version') || '';
    const mavenBuildCacheId = core.getInput('maven-build-cache-id') || '';
    const proxyPlan = await resolveAdapterCliPlan('maven', plan.workspace, plan.workingDirectory, inputs.cacheTag, requestedPort, inputs.proxyNoPlatform, inputs.proxyNoGit, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
        mavenExtensionsPath,
        mavenBuildCacheConfigPath,
        mavenLocalRepo,
        mavenBuildCacheExtensionVersion,
        mavenBuildCacheId,
    });
    const workspace = proxyPlan.workspace;
    const cacheTag = proxyPlan.tag;
    const setup = requireAdapterSetupPlan('maven', proxyPlan.setup);
    const proxy = await (0, core_1.startRegistryProxy)(actionProxyOptions({
        command: 'cache-registry',
        workspace,
        tag: cacheTag,
        host: proxyPlan.proxy.host || '127.0.0.1',
        port: proxyPlan.proxy.port,
        noGit: proxyPlan.proxy.no_git,
        noPlatform: proxyPlan.proxy.no_platform,
        verbose: inputs.verbose,
        readOnly: proxyPlan.proxy.read_only,
    }, proxyPlan.proxy));
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy.port);
    applyAdapterSetupPlan(setup);
    const extensionsPath = requireSetupFilePath(setup, 'extensions.xml', 'maven extensions.xml');
    const buildCacheConfigPath = requireSetupFilePath(setup, 'maven-build-cache-config.xml', 'maven build-cache config');
    const localRepo = requireSetupDirectory(setup, 'maven local repository directory');
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('maven-extensions-path', extensionsPath);
    core.setOutput('maven-build-cache-config-path', buildCacheConfigPath);
    core.setOutput('maven-local-repo', localRepo);
    core.setOutput('workspace', workspace);
    return {
        cacheTag,
        verificationSpecs: [adapterProxyVerificationSpec(cacheTag, proxyPlan.proxy, plan.workingDirectory)],
    };
}
async function runTurboProxyRestore(plan, inputs) {
    const turboApiUrl = core.getInput('turbo-api-url') || '';
    const turboToken = core.getInput('turbo-token') || 'boringcache';
    const turboTeam = core.getInput('turbo-team') || '';
    const turboPortInput = core.getInput('turbo-port');
    const preferredPort = await resolvePreferredPort(turboPortInput || inputs.proxyPort, turboPortInput ? 'turbo-port' : 'proxy-port', 4227);
    const turboPlan = await resolveAdapterCliPlan('turbo', plan.workspace, plan.workingDirectory, inputs.cacheTag, preferredPort, inputs.proxyNoPlatform, inputs.proxyNoGit, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
    });
    const workspace = turboPlan.workspace;
    const cacheTag = turboPlan.tag;
    const packageManager = await (0, utils_1.detectNodePackageManager)(plan.workingDirectory);
    await ensureCorepackPackageManager(plan.workingDirectory, packageManager, plan.runtimeTools);
    if (packageManager) {
        core.setOutput('package-manager', packageManager.name);
        core.setOutput('package-manager-cache-dir', plannedNodePackageManagerCacheDir(packageManager, turboPlan) || packageManager.cacheDir);
    }
    if (turboApiUrl) {
        exportEnvVars(plannedNodePackageManagerEnv(packageManager, turboPlan));
        configureTurboRemoteEnv(turboApiUrl, turboToken, turboTeam);
        core.setOutput('workspace', workspace);
        core.setOutput('cache-tag', cacheTag);
        return { cacheTag, verificationSpecs: [] };
    }
    let proxy;
    try {
        proxy = await startPortableCacheProxy(workspace, turboPlan.proxy.port || preferredPort, cacheTag, turboPlan.proxy.read_only, turboPlan.proxy);
    }
    catch {
        proxy = await startPortableCacheProxy(workspace, await (0, core_1.findAvailablePort)(), cacheTag, turboPlan.proxy.read_only, turboPlan.proxy);
    }
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy.port);
    exportEnvVars(turboEnvForStartedProxy(turboPlan, proxy.port, turboToken, turboTeam));
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('workspace', workspace);
    return {
        cacheTag,
        verificationSpecs: [adapterProxyVerificationSpec(cacheTag, turboPlan.proxy, plan.workingDirectory)],
    };
}
async function runNxProxyRestore(plan, inputs) {
    const nxAccessToken = core.getInput('nx-access-token');
    const nxPortInput = core.getInput('nx-port');
    const preferredPort = await resolvePreferredPort(nxPortInput || inputs.proxyPort, nxPortInput ? 'nx-port' : 'proxy-port', 4228);
    const nxPlan = await resolveAdapterCliPlan('nx', plan.workspace, plan.workingDirectory, inputs.cacheTag, preferredPort, inputs.proxyNoPlatform, inputs.proxyNoGit, proxyPlanningReadOnly(inputs.readOnly), {
        metadataHintsInput: inputs.metadataHints,
    });
    const workspace = nxPlan.workspace;
    const cacheTag = nxPlan.tag;
    let proxy;
    try {
        proxy = await startPortableCacheProxy(workspace, nxPlan.proxy.port || preferredPort, cacheTag, nxPlan.proxy.read_only, nxPlan.proxy);
    }
    catch {
        proxy = await startPortableCacheProxy(workspace, await (0, core_1.findAvailablePort)(), cacheTag, nxPlan.proxy.read_only, nxPlan.proxy);
    }
    saveModeState('proxy-pid', String(proxy.pid));
    saveProxyModeState(proxy.port);
    exportEnvVars(nxEnvForStartedProxy(nxPlan, proxy.port, nxAccessToken));
    core.setOutput('cache-tag', cacheTag);
    setProxyOutputs(proxy.port);
    core.setOutput('workspace', workspace);
    return {
        cacheTag,
        verificationSpecs: [adapterProxyVerificationSpec(cacheTag, nxPlan.proxy, plan.workingDirectory)],
    };
}
async function runRustRestore(plan, inputs) {
    const cacheTagPrefix = (inputs.cacheTag || plan.cacheTagPrefix || '').trim();
    const inputVersion = core.getInput('rust-version') || core.getInput('toolchain');
    const workingDir = plan.workingDirectory;
    const cacheCargo = parseBooleanInput(core.getInput('cache-cargo'), 'cache-cargo', true);
    const cacheCargoBin = parseBooleanInput(core.getInput('cache-cargo-bin'), 'cache-cargo-bin', false);
    const cacheTarget = parseBooleanInput(core.getInput('cache-target'), 'cache-target', true);
    const useSccache = parseBooleanInput(core.getInput('sccache'), 'sccache', false);
    const sccacheVersion = core.getInput('sccache-version') || '0.14.0';
    const sccacheMode = normalizeSccacheMode(core.getInput('sccache-mode'));
    const sccacheCacheSize = core.getInput('sccache-cache-size') || '5G';
    const targets = core.getInput('targets');
    const components = core.getInput('components');
    const profile = normalizeRustupProfile(core.getInput('profile'));
    const rustVersion = await detectRustVersion(workingDir, inputVersion);
    configureCargoEnv();
    const rustMajorMinor = rustVersion.match(/^(\d+\.\d+)/)?.[1] || rustVersion;
    const rustToolTagSuffix = `rust${rustMajorMinor}`;
    const lockPath = path.join(workingDir, 'Cargo.lock');
    const hasGitDeps = cacheCargo && await hasGitDependencies(lockPath);
    const rustEntryIds = [];
    if (cacheCargo) {
        rustEntryIds.push('cargo-registry');
        if (hasGitDeps) {
            rustEntryIds.push('cargo-git');
        }
    }
    if (cacheCargoBin) {
        rustEntryIds.push('cargo-bin');
    }
    if (cacheTarget) {
        rustEntryIds.push('target');
    }
    if (useSccache) {
        rustEntryIds.push('sccache-dir');
    }
    const rustEntriesPlan = rustEntryIds.length > 0
        ? await (0, utils_1.resolveCliArchiveEntries)(workingDir, {
            workspaceInput: inputs.workspace.trim(),
            entryIds: rustEntryIds,
            cacheTag: cacheTagPrefix,
            toolTagSuffix: rustToolTagSuffix,
            fallbackWorkspace: plan.workspace,
        })
        : { workspace: plan.workspace, entries: [], envVars: {} };
    exportEnvVars(rustEntriesPlan.envVars);
    const rustEntries = new Map(rustEntriesPlan.entries.map((entry) => [entry.requested, entry]));
    const workspace = rustEntriesPlan.workspace || plan.workspace;
    const cargoRegistryEntry = cacheCargo
        ? getRustArchiveEntry(rustEntries, 'cargo-registry', 'cargo registry cache')
        : null;
    const cargoGitEntry = cacheCargo && hasGitDeps
        ? getRustArchiveEntry(rustEntries, 'cargo-git', 'cargo git cache')
        : null;
    const cargoBinEntry = cacheCargoBin
        ? getRustArchiveEntry(rustEntries, 'cargo-bin', 'cargo bin cache')
        : null;
    const targetEntry = cacheTarget
        ? getRustArchiveEntry(rustEntries, 'target', 'Rust target cache')
        : null;
    const sccacheEntry = useSccache
        ? getRustArchiveEntry(rustEntries, 'sccache-dir', 'sccache cache')
        : null;
    if (useSccache && sccacheMode !== 'proxy') {
        configureSccacheEnv(sccacheCacheSize, sccacheEntry?.path || getSccacheDir());
    }
    core.setOutput('workspace', workspace);
    core.setOutput('rust-version', rustVersion);
    core.setOutput('cache-tag', cacheTagPrefix);
    core.setOutput('cargo-tag', cargoRegistryEntry?.tag || '');
    core.setOutput('cargo-git-tag', cargoGitEntry?.tag || '');
    core.setOutput('cargo-bin-tag', cargoBinEntry?.tag || '');
    core.setOutput('target-tag', targetEntry?.tag || '');
    core.setOutput('sccache-tag', sccacheEntry?.tag || '');
    saveModeState('workspace', workspace);
    saveModeState('cache-tag-prefix', cacheTagPrefix);
    saveModeState('rust-version', rustVersion);
    saveModeState('working-dir', workingDir);
    saveModeState('cache-cargo', String(cacheCargo));
    saveModeState('cache-cargo-bin', String(cacheCargoBin));
    saveModeState('cache-target', String(cacheTarget));
    saveModeState('use-sccache', String(useSccache));
    saveModeState('sccache-mode', sccacheMode);
    saveModeState('verbose', String(inputs.verbose));
    saveModeState('skipped-verify-tags', '');
    let registryRestored = false;
    let cargoGitRestored = false;
    let cargoBinRestored = false;
    let targetRestored = false;
    let sccacheRestored = false;
    if (cargoRegistryEntry) {
        registryRestored = await restoreRustArchiveEntry(workspace, cargoRegistryEntry, inputs.verbose);
        saveRustArchiveEntryState('cargo-registry', cargoRegistryEntry);
    }
    if (cargoGitEntry) {
        cargoGitRestored = await restoreRustArchiveEntry(workspace, cargoGitEntry, inputs.verbose);
        saveRustArchiveEntryState('cargo-git', cargoGitEntry);
    }
    if (cargoBinEntry) {
        cargoBinRestored = await restoreRustArchiveEntry(workspace, cargoBinEntry, inputs.verbose);
        saveRustArchiveEntryState('cargo-bin', cargoBinEntry);
    }
    if (targetEntry) {
        targetRestored = await restoreRustArchiveEntry(workspace, targetEntry, inputs.verbose);
        saveRustArchiveEntryState('target', targetEntry);
    }
    if (useSccache && sccacheEntry) {
        await installSccache(sccacheVersion);
        if (sccacheMode === 'proxy') {
            const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
            const proxyPlan = await resolveAdapterCliPlan('sccache', workspace, workingDir, sccacheEntry.tag, requestedPort, true, true, proxyPlanningReadOnly(inputs.readOnly), {
                metadataHintsInput: inputs.metadataHints,
            });
            const sccachePreflightStatus = await checkRustProxyTagStatus(proxyPlan.workspace, proxyPlan.tag, {
                noPlatform: proxyPlan.proxy.no_platform,
                noGit: proxyPlan.proxy.no_git,
            });
            sccacheRestored = sccachePreflightStatus.kvHit;
            const proxy = await (0, core_1.startRegistryProxy)(actionProxyOptions({
                command: 'cache-registry',
                workspace: proxyPlan.workspace,
                tag: proxyPlan.tag,
                host: proxyPlan.proxy.host || '127.0.0.1',
                port: proxyPlan.proxy.port,
                noGit: proxyPlan.proxy.no_git,
                noPlatform: proxyPlan.proxy.no_platform,
                verbose: inputs.verbose,
                readOnly: proxyPlan.proxy.read_only,
            }, proxyPlan.proxy));
            exportEnvVars(sccacheEnvForStartedProxy(proxyPlan, proxy.port));
            await startSccacheServer();
            saveModeState('proxy-pid', String(proxy.pid));
            saveProxyModeState(proxy.port);
            saveRustArchiveEntryState('sccache', {
                ...sccacheEntry,
                tag: proxyPlan.tag,
                tagPathPair: `${proxyPlan.tag}:${sccacheEntry.path}`,
            });
            saveModeState('sccache-preflight-hit', String(sccachePreflightStatus.hit));
            saveModeState('sccache-preflight-cache-entry-hit', String(sccachePreflightStatus.cacheEntryHit));
            saveModeState('sccache-preflight-kv-hit', String(sccachePreflightStatus.kvHit));
            saveModeState('sccache-preflight-kv-checked', String(sccachePreflightStatus.kvChecked));
            setProxyOutputs(proxy.port);
        }
        else {
            sccacheRestored = await restoreRustArchiveEntry(workspace, sccacheEntry, inputs.verbose);
            await startSccacheServer();
            saveRustArchiveEntryState('sccache', sccacheEntry);
            saveModeState('sccache-preflight-hit', String(sccacheRestored));
            saveModeState('sccache-preflight-cache-entry-hit', String(sccacheRestored));
            saveModeState('sccache-preflight-kv-hit', 'false');
            saveModeState('sccache-preflight-kv-checked', 'false');
        }
    }
    if (!(plan.setup === 'mise' && toolEnabled(plan, 'rust'))) {
        await setupRustToolchain(rustVersion, { profile, targets, components });
    }
    const cacheHit = registryRestored || cargoGitRestored || cargoBinRestored || targetRestored || sccacheRestored;
    core.setOutput('cache-hit', String(cacheHit));
    core.setOutput('sccache-hit', String(sccacheRestored));
    const verificationSpecs = [];
    if (cargoRegistryEntry) {
        verificationSpecs.push({
            tag: cargoRegistryEntry.tag,
            noPlatform: false,
            noGit: false,
            pathHint: cargoRegistryEntry.path,
            saveExpected: true,
        });
    }
    if (cargoGitEntry) {
        verificationSpecs.push({
            tag: cargoGitEntry.tag,
            noPlatform: false,
            noGit: false,
            pathHint: cargoGitEntry.path,
            saveExpected: true,
        });
    }
    if (cargoBinEntry) {
        verificationSpecs.push({
            tag: cargoBinEntry.tag,
            noPlatform: false,
            noGit: false,
            pathHint: cargoBinEntry.path,
            saveExpected: true,
        });
    }
    if (targetEntry) {
        verificationSpecs.push({
            tag: targetEntry.tag,
            noPlatform: false,
            noGit: false,
            pathHint: targetEntry.path,
            saveExpected: true,
        });
    }
    if (sccacheEntry) {
        verificationSpecs.push({
            tag: readRustArchiveEntryState('sccache')?.tag || sccacheEntry.tag,
            noPlatform: sccacheMode === 'proxy',
            noGit: sccacheMode === 'proxy',
            pathHint: sccacheMode === 'proxy' ? workingDir : sccacheEntry.path,
            saveExpected: sccacheMode !== 'proxy' || !inputs.readOnly,
        });
    }
    return { cacheHit, cacheTag: cacheTagPrefix, verificationSpecs };
}
async function runRustSave(options = {}) {
    const workspace = getModeState('workspace');
    const cacheCargo = getModeState('cache-cargo') === 'true';
    const cacheCargoBin = getModeState('cache-cargo-bin') === 'true';
    const cacheTarget = getModeState('cache-target') === 'true';
    const useSccache = getModeState('use-sccache') === 'true';
    const sccacheMode = getModeState('sccache-mode') || 'local';
    const verbose = getModeState('verbose') === 'true';
    const exclude = core.getInput('exclude');
    const allowSaves = options.allowSaves !== false;
    if (!workspace) {
        return;
    }
    if (!allowSaves) {
        if (useSccache) {
            await stopSccacheServer();
            if (sccacheMode === 'proxy') {
                await stopProxyFromState();
            }
        }
        return;
    }
    if (!(0, core_1.hasSaveToken)()) {
        if (useSccache && sccacheMode === 'proxy') {
            await stopSccacheServer();
            await stopProxyFromState();
        }
        core.notice(`Save skipped: ${(0, core_1.missingSaveTokenMessage)()}`);
        return;
    }
    if (cacheCargo) {
        const cargoRegistryEntry = readRustArchiveEntryState('cargo-registry');
        const cargoGitEntry = readRustArchiveEntryState('cargo-git');
        if (cargoRegistryEntry) {
            await execRustBoringCache(buildRustCacheArgs('save', workspace, cargoRegistryEntry, verbose, exclude));
        }
        if (cargoGitEntry) {
            await execRustBoringCache(buildRustCacheArgs('save', workspace, cargoGitEntry, verbose, exclude));
        }
    }
    if (cacheCargoBin) {
        const cargoBinEntry = readRustArchiveEntryState('cargo-bin');
        if (cargoBinEntry) {
            await execRustBoringCache(buildRustCacheArgs('save', workspace, cargoBinEntry, verbose, exclude));
        }
    }
    if (cacheTarget) {
        const targetEntry = readRustArchiveEntryState('target');
        if (targetEntry) {
            await execRustBoringCache(buildRustCacheArgs('save', workspace, targetEntry, verbose, exclude));
        }
    }
    if (useSccache) {
        if (sccacheMode === 'proxy') {
            const sccacheTag = getModeState('sccache-tag');
            const preflightCacheEntryHit = getModeState('sccache-preflight-cache-entry-hit') === 'true';
            const preflightKvHit = getModeState('sccache-preflight-kv-hit') === 'true';
            const preflightKvChecked = getModeState('sccache-preflight-kv-checked') === 'true';
            const sccacheStats = await stopSccacheServer();
            await stopProxyFromState();
            if (sccacheTag && (!sccacheStats || sccacheStats.compileRequests === 0)) {
                markModeVerifyTagSkipped(sccacheTag);
                if (preflightKvHit) {
                    core.info(`Skipping sccache post-save verification for ${sccacheTag}: no compile requests were observed.`);
                }
                else if (preflightCacheEntryHit) {
                    core.info(`Skipping sccache post-save verification for ${sccacheTag}: signed cache entry existed, but no compile requests were observed.`);
                }
                else {
                    core.info(`Skipping sccache save for ${sccacheTag}: no compile requests were observed.`);
                }
                return;
            }
            if (sccacheTag && sccacheStats && sccacheStats.compileRequests > 0) {
                const postShutdownStatus = await checkRustProxyTagStatus(workspace, sccacheTag, {
                    noPlatform: true,
                    noGit: true,
                });
                const rustHitRate = sccacheStats.rustHitRate || 'unknown';
                core.info(`sccache proxy stats for ${sccacheTag}: compile_requests=${sccacheStats.compileRequests}, cache_hits=${sccacheStats.cacheHits}, cache_misses=${sccacheStats.cacheMisses}, rust_hit_rate=${rustHitRate}`);
                if (sccacheStats.cacheHits === 0) {
                    if (preflightKvHit) {
                        core.warning(`sccache proxy saw 0 cache hits across ${sccacheStats.compileRequests} compile requests even though direct KV rows existed for '${sccacheTag}' before startup. Check sccache key churn, emitted tag semantics, and proxy read logs.`);
                    }
                    else if (preflightCacheEntryHit && postShutdownStatus.kvHit) {
                        core.notice(`sccache proxy saw 0 cache hits across ${sccacheStats.compileRequests} compile requests for '${sccacheTag}'. A signed cache entry existed before startup, but direct KV rows were absent; the run populated the proxy KV cache for future runs.`);
                    }
                    else if (preflightCacheEntryHit && preflightKvChecked && postShutdownStatus.kvChecked) {
                        core.warning(`sccache proxy saw 0 cache hits across ${sccacheStats.compileRequests} compile requests for '${sccacheTag}'. A signed cache entry existed before startup, but direct KV rows were absent and still were not visible after shutdown. Check proxy KV publish logs and save token scope.`);
                    }
                    else if (preflightCacheEntryHit) {
                        core.warning(`sccache proxy saw 0 cache hits across ${sccacheStats.compileRequests} compile requests for '${sccacheTag}'. A signed cache entry existed before startup, but this CLI/API did not report direct KV row visibility. Check boringcache/one cli-version alignment and proxy read/write logs.`);
                    }
                    else if (postShutdownStatus.kvHit) {
                        core.notice(`sccache proxy saw 0 cache hits across ${sccacheStats.compileRequests} compile requests, but '${sccacheTag}' published successfully. This looks like a cold fill.`);
                    }
                    else if (postShutdownStatus.cacheEntryHit) {
                        core.warning(`sccache proxy saw 0 cache hits across ${sccacheStats.compileRequests} compile requests and '${sccacheTag}' had a signed cache entry after shutdown, but direct KV rows were not visible. Check boringcache/one cli-version alignment and proxy KV publish logs.`);
                    }
                    else {
                        core.notice(`sccache proxy saw 0 cache hits across ${sccacheStats.compileRequests} compile requests and '${sccacheTag}' was not reported as direct KV rows during post-shutdown verification. This usually means a cold fill; check proxy publish logs if the next run also misses.`);
                    }
                }
            }
        }
        else {
            const sccacheEntry = readRustArchiveEntryState('sccache');
            const sccacheTag = sccacheEntry?.tag || '';
            const preflightHit = getModeState('sccache-preflight-hit') === 'true';
            if (sccacheEntry) {
                const sccacheStats = await stopSccacheServer();
                if (!sccacheStats || sccacheStats.compileRequests === 0) {
                    markModeVerifyTagSkipped(sccacheTag);
                    if (preflightHit) {
                        core.info(`Skipping sccache post-save verification for ${sccacheTag}: no compile requests were observed.`);
                    }
                    else {
                        core.info(`Skipping sccache save for ${sccacheTag}: no compile requests were observed.`);
                    }
                    return;
                }
                await execRustBoringCache(buildRustCacheArgs('save', workspace, sccacheEntry, verbose, exclude));
            }
        }
    }
}
async function stopProxyFromState() {
    const proxyPid = getModeState('proxy-pid');
    if (proxyPid) {
        const proxyPort = Number.parseInt(getModeState('proxy-port'), 10);
        await (0, core_1.stopRegistryProxy)(parseInt(proxyPid, 10), Number.isFinite(proxyPort) ? proxyPort : undefined);
    }
}


/***/ }),

/***/ 310:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.normalizeMode = normalizeMode;
exports.resolveModeSpec = resolveModeSpec;
exports.assertImplementedMode = assertImplementedMode;
const MODE_SPECS = {
    archive: {
        resolved: 'archive',
        implemented: true,
        description: 'Portable archive caching and actions/cache compatibility.',
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
    'nx-proxy': {
        resolved: 'nx-proxy',
        implemented: true,
        description: 'Nx self-hosted remote cache proxy integration.',
    },
    'rust-sccache': {
        resolved: 'rust-sccache',
        implemented: true,
        description: 'Rust sccache proxy integration.',
    },
    'turbo-proxy': {
        resolved: 'turbo-proxy',
        implemented: true,
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
        case 'go':
        case 'gradle':
        case 'maven':
        case 'nx-proxy':
        case 'rust-sccache':
        case 'turbo-proxy':
            return normalized;
        default:
            throw new Error(`Unsupported mode "${value}". Expected auto, archive, docker, buildkit, bazel, go, gradle, maven, nx-proxy, rust-sccache, or turbo-proxy.`);
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
        `Use the BoringCache CLI directly until this adapter lands.`);
}


/***/ }),

/***/ 436:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.run = run;
const core = __importStar(__nccwpck_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module '@actions/core'"); e.code = 'MODULE_NOT_FOUND'; throw e; }())));
const core_1 = __nccwpck_require__(796);
const utils_1 = __nccwpck_require__(219);
const mode_handlers_1 = __nccwpck_require__(861);
function buildRuntimeRestoreFlagArgs(inputs) {
    const flagArgs = [];
    if (inputs.enableCrossOsArchive || inputs.noPlatform) {
        flagArgs.push('--no-platform');
    }
    if (inputs.verbose) {
        flagArgs.push('--verbose');
    }
    return flagArgs;
}
function buildCliSetupOptions(inputs, cliPlatform) {
    return {
        version: inputs.cliVersion,
        platform: cliPlatform,
        ...(inputs.trustedWorkspaceSigningKeyFingerprint
            ? { trustedWorkspaceSigningKeyFingerprint: inputs.trustedWorkspaceSigningKeyFingerprint }
            : {}),
    };
}
async function emitRestoreDiagnostics(plan, inputs, resolvedTags, overallHit, runtimeHit, trustState) {
    const diagnostics = (0, utils_1.loadDiagnosticsConfig)(inputs);
    await (0, utils_1.runDiagnosticsGroup)(diagnostics, 'BoringCache Diagnostics', async () => {
        core.info(`workspace: ${plan.workspace}`);
        core.info(`setup: ${plan.setup}`);
        core.info(`mode: ${plan.mode}`);
        core.info(`preset: ${plan.preset}`);
        core.info(`working-directory: ${plan.workingDirectory}`);
        core.info(`cache-tag: ${plan.cacheTagPrefix || '(none)'}`);
        core.info(`runtime-cache-tag: ${plan.runtimeTag || '(none)'}`);
        core.info(`resolved-entries: ${plan.archiveEntries || '(none)'}`);
        core.info(`resolved-tags: ${resolvedTags.join(',') || '(none)'}`);
        core.info(`cache-hit: ${String(overallHit)}`);
        core.info(`runtime-cache-hit: ${String(runtimeHit)}`);
        core.info(`verify-mode: ${inputs.verify}`);
        core.info(`trust-state: status=${trustState.status} event=${trustState.event_name || '(none)'} save-policy=${trustState.save_policy} save-on-pull-request=${String(trustState.save_on_pull_request)}`);
        core.info(`token-capabilities: restore=${String(trustState.token_capabilities.restore)} save=${String(trustState.token_capabilities.save)} legacy-api-only=${String(trustState.token_capabilities.legacy_api_only)}`);
        if (diagnostics.includeLogs) {
            const proxyLogPath = core.getState('proxy-log-path');
            if (proxyLogPath) {
                const logTail = (0, utils_1.readLogTail)(proxyLogPath, diagnostics.logLines);
                core.info(`proxy-log-path: ${proxyLogPath}`);
                if (logTail.length > 0) {
                    core.info(`proxy-log-tail (${logTail.length} lines):`);
                    for (const line of logTail) {
                        core.info(line);
                    }
                }
            }
        }
    });
}
async function restoreEntries(workspace, entriesString, flagArgs, restoreCandidates = []) {
    if (!entriesString.trim()) {
        return { hit: false, saveEntries: '' };
    }
    const parsedEntries = (0, utils_1.parseEntries)(entriesString, 'restore', { resolvePaths: false });
    if (parsedEntries.length === 0) {
        return { hit: false, saveEntries: '' };
    }
    const restoreEntriesArg = parsedEntries.map((entry) => `${entry.tag}:${entry.restorePath}`).join(',');
    const saveEntries = parsedEntries.map((entry) => `${entry.tag}:${entry.savePath}`).join(',');
    const restoreMissShouldFail = flagArgs.includes('--fail-on-cache-miss');
    const primaryHit = await checkEntries(workspace, parsedEntries.map((entry) => entry.tag), flagArgs);
    let selectedRestoreEntries = restoreEntriesArg;
    let hit = primaryHit;
    if (!hit) {
        for (const candidate of restoreCandidates) {
            if (!candidate.entries.trim()) {
                continue;
            }
            const candidateEntries = (0, utils_1.parseEntries)(candidate.entries, 'restore', { resolvePaths: false });
            const candidateHit = await checkEntries(workspace, candidateEntries.map((entry) => entry.tag), flagArgs);
            if (candidateHit) {
                core.info(`Cache hit with restore key ${candidate.tagPrefix}`);
                selectedRestoreEntries = candidate.entries;
                hit = true;
                break;
            }
        }
    }
    if (!hit && restoreMissShouldFail) {
        throw new Error(`Cache restore failed for ${restoreEntriesArg}`);
    }
    const restoreFlagArgs = hit ? flagArgs : flagArgs.filter((arg) => arg !== '--fail-on-cache-miss');
    const restoreExitCode = await (0, utils_1.execBoringCache)(['restore', workspace, selectedRestoreEntries, ...restoreFlagArgs], { ignoreReturnCode: true });
    if (restoreExitCode !== 0) {
        throw new Error(`Cache restore failed for ${selectedRestoreEntries}`);
    }
    return {
        hit,
        saveEntries,
    };
}
async function checkEntries(workspace, tags, restoreFlagArgs) {
    const checkTags = tags.map((tag) => tag.trim()).filter(Boolean);
    if (checkTags.length === 0) {
        return false;
    }
    let stdout = '';
    const args = ['check', workspace, checkTags.join(','), ...checkFlagArgs(restoreFlagArgs), '--json'];
    const exitCode = await (0, utils_1.execBoringCache)(args, {
        ignoreReturnCode: true,
        silent: true,
        listeners: {
            stdout: (data) => {
                stdout += data.toString();
            },
        },
    });
    if (!stdout.trim()) {
        if (exitCode !== 0) {
            core.warning(`Cache check failed for ${checkTags.join(',')}; treating as a miss.`);
        }
        else {
            core.warning(`boringcache check --json produced no output for ${checkTags.join(',')}; treating as a miss.`);
        }
        return false;
    }
    let summary;
    try {
        summary = JSON.parse(stdout);
    }
    catch (error) {
        core.warning(`Failed to parse boringcache check JSON for ${checkTags.join(',')}: ${error instanceof Error ? error.message : String(error)}; treating as a miss.`);
        return false;
    }
    return (summary.results || []).some((result) => result.status === 'hit');
}
function checkFlagArgs(restoreFlagArgs) {
    const args = [];
    if (restoreFlagArgs.includes('--no-platform')) {
        args.push('--no-platform');
    }
    if (restoreFlagArgs.includes('--no-git')) {
        args.push('--no-git');
    }
    return args;
}
async function run() {
    const originalCwd = process.cwd();
    let restoreFailureContext = {};
    try {
        const inputs = (0, utils_1.getInputs)();
        restoreFailureContext = {
            diagnostics_level: (0, utils_1.loadDiagnosticsConfig)(inputs).level,
            verify_mode: inputs.verify,
        };
        const saveEnabled = (0, utils_1.saveConfigured)(inputs);
        delete process.env.BORINGCACHE_SAVE_ON_PULL_REQUEST;
        const saveAllowed = saveEnabled ? (0, utils_1.applySaveTokenPolicy)(inputs) : false;
        if (!saveEnabled) {
            (0, utils_1.applyRestoreOnlyTokenPolicy)();
        }
        const trustState = (0, utils_1.buildActionTrustState)(inputs, {
            saveConfigured: saveEnabled,
            saveAllowed,
        });
        const effectiveInputs = saveEnabled && saveAllowed
            ? inputs
            : { ...inputs, readOnly: true };
        const cliPlatform = inputs.cliPlatform || undefined;
        if (inputs.cliVersion.toLowerCase() !== 'skip') {
            await (0, utils_1.ensureBoringCache)(buildCliSetupOptions(inputs, cliPlatform));
        }
        const plan = await (0, utils_1.buildPlan)(inputs);
        restoreFailureContext = {
            ...restoreFailureContext,
            workspace: plan.workspace,
            setup: plan.setup,
            mode: plan.mode,
            preset: plan.preset,
            working_directory: plan.workingDirectory,
            cache_tag: plan.cacheTagPrefix || '',
            runtime_cache_tag: plan.runtimeTag || '',
            trust_state: trustState,
        };
        process.chdir(plan.workingDirectory);
        await (0, utils_1.applyPresetCacheEnv)(plan);
        const runtimeRestore = await restoreEntries(plan.workspace, plan.runtimeEntry || '', buildRuntimeRestoreFlagArgs(inputs));
        const archiveRestore = await restoreEntries(plan.workspace, plan.archiveEntries, (0, utils_1.buildFlagArgs)(inputs), plan.archiveRestoreCandidates);
        let usedMiseRuntime = false;
        if (plan.setup === 'mise') {
            usedMiseRuntime = await (0, utils_1.applyMiseSetup)(plan.runtimeTools, runtimeRestore.hit, plan.workingDirectory);
        }
        const modeRestore = await (0, mode_handlers_1.runModeRestore)(plan, effectiveInputs);
        const genericSaveEntries = [usedMiseRuntime ? runtimeRestore.saveEntries : '', archiveRestore.saveEntries]
            .filter(Boolean)
            .join(',');
        const verificationSpecs = [
            ...(0, utils_1.buildGenericVerificationSpecs)(plan, inputs, usedMiseRuntime),
            ...(modeRestore.verificationSpecs || []),
        ];
        const resolvedTags = (0, utils_1.resolveVerificationTags)(verificationSpecs, plan.workingDirectory);
        const saveCapable = saveEnabled && (0, core_1.hasSaveToken)();
        const saveExpectedSpecs = verificationSpecs.filter((spec) => spec.saveExpected);
        const deferredVerifySpecs = saveCapable ? saveExpectedSpecs : [];
        const immediateVerifySpecs = verificationSpecs.filter((spec) => !spec.saveExpected);
        const deferredVerifyTags = (0, utils_1.resolveVerificationTags)(deferredVerifySpecs, plan.workingDirectory);
        const overallHit = modeRestore.cacheHit ?? (runtimeRestore.hit || archiveRestore.hit);
        const diagnostics = (0, utils_1.loadDiagnosticsConfig)(inputs);
        core.setOutput('cache-hit', String(overallHit));
        core.setOutput('runtime-cache-hit', String(runtimeRestore.hit));
        core.setOutput('diagnostics-level', diagnostics.level);
        core.setOutput('resolved-mode', plan.mode);
        core.setOutput('resolved-tools', (0, utils_1.serializeTools)(plan.runtimeTools));
        core.setOutput('workspace', plan.workspace);
        core.setOutput('cache-tag', modeRestore.cacheTag || plan.cacheTagPrefix);
        core.setOutput('runtime-cache-tag', plan.runtimeTag || '');
        core.setOutput('resolved-entries', plan.archiveEntries);
        core.setOutput('resolved-tags', resolvedTags.join(','));
        (0, utils_1.writeActionEvidence)('restore', {
            phase_status: 'completed',
            phase_summary: (0, utils_1.restorePhaseSummary)({
                cacheHit: overallHit,
                runtimeCacheHit: runtimeRestore.hit,
                trustState,
                saveCapable,
            }),
            workspace: plan.workspace,
            setup: plan.setup,
            mode: plan.mode,
            preset: plan.preset,
            working_directory: plan.workingDirectory,
            cache_tag: modeRestore.cacheTag || plan.cacheTagPrefix || '',
            runtime_cache_tag: plan.runtimeTag || '',
            resolved_entries: plan.archiveEntries,
            resolved_tags: resolvedTags,
            cache_hit: overallHit,
            runtime_cache_hit: runtimeRestore.hit,
            mode_evidence: modeRestore.evidence || {},
            diagnostics_level: diagnostics.level,
            trust_state: trustState,
            save_configured: saveEnabled,
            save_allowed: saveAllowed,
            save_capable: saveCapable,
            verify_mode: inputs.verify,
            verify_save_tags: deferredVerifyTags,
            token_capabilities: {
                ...trustState.token_capabilities,
            },
        });
        restoreFailureContext = {
            ...restoreFailureContext,
            cache_tag: modeRestore.cacheTag || plan.cacheTagPrefix || '',
            resolved_entries: plan.archiveEntries,
            resolved_tags: resolvedTags,
            cache_hit: overallHit,
            runtime_cache_hit: runtimeRestore.hit,
            mode_evidence: modeRestore.evidence || {},
            trust_state: trustState,
            save_configured: saveEnabled,
            save_allowed: saveAllowed,
            save_capable: saveCapable,
            verify_save_tags: deferredVerifyTags,
        };
        core.saveState('resolved-mode', plan.mode);
        core.saveState('cli-version', inputs.cliVersion);
        core.saveState('cli-platform', cliPlatform || '');
        core.saveState('working-directory', plan.workingDirectory);
        core.saveState('generic-cache-entries', genericSaveEntries);
        core.saveState('generic-cache-workspace', plan.workspace);
        core.saveState('runtime-mise-used', String(usedMiseRuntime));
        core.saveState('generic-cache-exclude', inputs.exclude);
        core.saveState('no-platform', String(inputs.noPlatform));
        core.saveState('enableCrossOsArchive', String(inputs.enableCrossOsArchive));
        core.saveState('force', String(inputs.force));
        core.saveState('verbose', String(inputs.verbose));
        core.saveState('diagnostics-level', diagnostics.level);
        core.saveState('diagnostics-log-lines', String(diagnostics.logLines));
        core.saveState('resolved-tags', resolvedTags.join(','));
        core.saveState('verify-save-specs', JSON.stringify(deferredVerifySpecs));
        core.saveState('verify-save-tags', deferredVerifyTags.join(','));
        core.saveState('verify-mode', inputs.verify);
        core.saveState('verify-timeout-seconds', String(inputs.verifyTimeoutSeconds));
        core.saveState('verify-require-server-signature', String(inputs.verifyRequireServerSignature));
        core.saveState('save-configured', String(saveEnabled));
        core.saveState('save-allowed', String(saveAllowed));
        if (!saveCapable && inputs.verify !== 'none' && saveExpectedSpecs.length > 0) {
            core.info('Skipping save-expected tag verification in restore step: no save-capable token is available.');
        }
        if (inputs.verify !== 'none' && immediateVerifySpecs.length > 0) {
            await (0, utils_1.verifyVerificationSpecs)(plan.workspace, immediateVerifySpecs, {
                mode: inputs.verify,
                timeoutSeconds: inputs.verifyTimeoutSeconds,
                requireServerSignature: inputs.verifyRequireServerSignature,
                verbose: inputs.verbose,
            });
        }
        await emitRestoreDiagnostics(plan, inputs, resolvedTags, overallHit, runtimeRestore.hit, trustState);
        if (!saveEnabled) {
            core.info('Post step save is disabled by save-policy: off.');
        }
        if (saveEnabled && (0, utils_1.isPullRequestEvent)() && !saveAllowed) {
            core.info('Post step will stay restore-only unless save-on-pull-request: true is set.');
        }
    }
    catch (error) {
        (0, utils_1.writeActionFailureEvidence)('restore', error, restoreFailureContext);
        core.setFailed(`boringcache/one restore failed: ${(0, utils_1.actionErrorMessage)(error)}`);
    }
    finally {
        process.chdir(originalCwd);
    }
}
if (require.main === require.cache[eval('__filename')]) {
    void run();
}


/***/ }),

/***/ 219:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MAX_VERIFY_CHECK_ATTEMPT_SECONDS = exports.MAX_VERIFY_TIMEOUT_SECONDS = exports.DEFAULT_VERIFY_TIMEOUT_SECONDS = exports.MAX_DIAGNOSTICS_LOG_BYTES = exports.MAX_DIAGNOSTICS_LOG_LINES = exports.DEFAULT_OCI_HYDRATION_POLICY = exports.parseEntries = exports.installMiseTool = exports.installMise = exports.hasToolVersionOnPath = exports.hasMiseToolVersion = exports.getMiseInstallsDir = exports.execBoringCache = exports.exportMiseEnv = exports.ensureBoringCache = exports.activateMiseTool = void 0;
exports.getInputs = getInputs;
exports.isPullRequestEvent = isPullRequestEvent;
exports.saveConfigured = saveConfigured;
exports.saveAllowedForEvent = saveAllowedForEvent;
exports.saveSkippedByConfigurationMessage = saveSkippedByConfigurationMessage;
exports.saveSkippedByPolicyMessage = saveSkippedByPolicyMessage;
exports.applyPullRequestSaveScopeEnv = applyPullRequestSaveScopeEnv;
exports.applyRestoreOnlyTokenPolicy = applyRestoreOnlyTokenPolicy;
exports.applySaveTokenPolicy = applySaveTokenPolicy;
exports.readSavedSaveAllowance = readSavedSaveAllowance;
exports.readSavedSaveConfiguration = readSavedSaveConfiguration;
exports.buildActionTrustState = buildActionTrustState;
exports.restorePhaseSummary = restorePhaseSummary;
exports.postPhaseSummary = postPhaseSummary;
exports.normalizeSavePolicy = normalizeSavePolicy;
exports.normalizeDiagnosticsMode = normalizeDiagnosticsMode;
exports.normalizeDiagnosticsLogLines = normalizeDiagnosticsLogLines;
exports.normalizeOciHydrationPolicy = normalizeOciHydrationPolicy;
exports.resolveDiagnosticsConfig = resolveDiagnosticsConfig;
exports.loadDiagnosticsConfig = loadDiagnosticsConfig;
exports.runDiagnosticsGroup = runDiagnosticsGroup;
exports.writeActionEvidence = writeActionEvidence;
exports.writeActionFailureEvidence = writeActionFailureEvidence;
exports.actionErrorMessage = actionErrorMessage;
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
const core = __importStar(__nccwpck_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module '@actions/core'"); e.code = 'MODULE_NOT_FOUND'; throw e; }())));
const exec = __importStar(__nccwpck_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module '@actions/exec'"); e.code = 'MODULE_NOT_FOUND'; throw e; }())));
const childProcess = __importStar(__nccwpck_require__(317));
const fs = __importStar(__nccwpck_require__(896));
const os = __importStar(__nccwpck_require__(857));
const path = __importStar(__nccwpck_require__(928));
const timers = __importStar(__nccwpck_require__(557));
const core_1 = __nccwpck_require__(796);
Object.defineProperty(exports, "activateMiseTool", ({ enumerable: true, get: function () { return core_1.activateMiseTool; } }));
Object.defineProperty(exports, "ensureBoringCache", ({ enumerable: true, get: function () { return core_1.ensureBoringCache; } }));
Object.defineProperty(exports, "exportMiseEnv", ({ enumerable: true, get: function () { return core_1.exportMiseEnv; } }));
Object.defineProperty(exports, "execBoringCache", ({ enumerable: true, get: function () { return core_1.execBoringCache; } }));
Object.defineProperty(exports, "getMiseInstallsDir", ({ enumerable: true, get: function () { return core_1.getMiseInstallsDir; } }));
Object.defineProperty(exports, "hasMiseToolVersion", ({ enumerable: true, get: function () { return core_1.hasMiseToolVersion; } }));
Object.defineProperty(exports, "hasToolVersionOnPath", ({ enumerable: true, get: function () { return core_1.hasToolVersionOnPath; } }));
Object.defineProperty(exports, "installMise", ({ enumerable: true, get: function () { return core_1.installMise; } }));
Object.defineProperty(exports, "installMiseTool", ({ enumerable: true, get: function () { return core_1.installMiseTool; } }));
Object.defineProperty(exports, "parseEntries", ({ enumerable: true, get: function () { return core_1.parseEntries; } }));
const modes_1 = __nccwpck_require__(310);
exports.DEFAULT_OCI_HYDRATION_POLICY = 'metadata-only';
exports.MAX_DIAGNOSTICS_LOG_LINES = 500;
exports.MAX_DIAGNOSTICS_LOG_BYTES = 512 * 1024;
exports.DEFAULT_VERIFY_TIMEOUT_SECONDS = 180;
exports.MAX_VERIFY_TIMEOUT_SECONDS = 900;
exports.MAX_VERIFY_CHECK_ATTEMPT_SECONDS = 30;
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
        cliVersion: core.getInput('cli-version') || 'v1.13.77',
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
        saveAlways: core.getBooleanInput('save-always'),
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
        dockerToolCache: core.getInput('docker-tool-cache'),
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
function applyRestoreOnlyTokenPolicy() {
    const restoreFallback = process.env.BORINGCACHE_RESTORE_TOKEN ||
        process.env.BORINGCACHE_SAVE_TOKEN ||
        process.env.BORINGCACHE_API_TOKEN;
    const hadSaveCapableToken = Boolean(process.env.BORINGCACHE_SAVE_TOKEN || process.env.BORINGCACHE_API_TOKEN);
    if (restoreFallback) {
        process.env.BORINGCACHE_RESTORE_TOKEN = restoreFallback;
    }
    delete process.env.BORINGCACHE_SAVE_TOKEN;
    delete process.env.BORINGCACHE_API_TOKEN;
    return hadSaveCapableToken;
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
    if (applyRestoreOnlyTokenPolicy()) {
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
function buildActionTrustState(inputs, options) {
    const saveCapable = options.saveCapable ?? (0, core_1.hasSaveToken)();
    let status = 'read_write';
    if (!options.saveConfigured) {
        status = 'restore_only_by_configuration';
    }
    else if (!options.saveAllowed) {
        status = 'restore_only_by_event_policy';
    }
    else if (!saveCapable) {
        status = 'restore_only_missing_save_token';
    }
    return {
        status,
        event_name: (process.env.GITHUB_EVENT_NAME || '').trim(),
        save_policy: inputs.savePolicy,
        save_on_pull_request: inputs.saveOnPullRequest,
        save_configured: options.saveConfigured,
        save_allowed: options.saveAllowed,
        save_capable: saveCapable,
        token_capabilities: {
            restore: (0, core_1.hasRestoreToken)(),
            save: (0, core_1.hasSaveToken)(),
            legacy_api_only: (0, core_1.isUsingLegacyApiTokenOnly)(),
        },
    };
}
function restorePhaseSummary(options) {
    if (options.cacheHit) {
        const hitDetail = options.runtimeCacheHit
            ? 'BoringCache restored at least one requested cache for this step, including the runtime cache.'
            : 'BoringCache restored at least one requested cache for this step.';
        if (options.saveCapable) {
            return {
                status: 'cache_hit',
                headline: 'Cache restored',
                detail: hitDetail,
                next_step: 'Continue the workflow; the post step can refresh save-expected tags.',
            };
        }
        return {
            status: 'cache_hit_restore_only',
            headline: 'Cache restored',
            detail: `${hitDetail} This run is restore-only: ${trustStateDetail(options.trustState)}`,
            next_step: restoreOnlyNextStep(options.trustState),
        };
    }
    if (options.saveCapable) {
        return {
            status: 'cache_miss_will_save',
            headline: 'No cache restored',
            detail: 'BoringCache did not restore a matching cache; this workflow can save one in the post step.',
            next_step: 'Let the post step finish, then inspect the post phase if the next run stays cold.',
        };
    }
    return {
        status: 'cache_miss_restore_only',
        headline: 'No cache restored',
        detail: `BoringCache did not restore a matching cache, and this run is restore-only: ${trustStateDetail(options.trustState)}`,
        next_step: restoreOnlyNextStep(options.trustState),
    };
}
function postPhaseSummary(saveStatus, trustState) {
    switch (saveStatus) {
        case 'saved':
            return {
                status: 'saved',
                headline: 'Cache saved',
                detail: 'BoringCache saved archive entries for future runs.',
                next_step: 'The next matching run can restore these entries.',
            };
        case 'mode_post_and_generic_save':
            return {
                status: 'saved',
                headline: 'Cache saved',
                detail: 'BoringCache completed mode-specific post work and saved archive entries for future runs.',
                next_step: 'The next matching run can restore these caches.',
            };
        case 'no_generic_save':
            return {
                status: 'no_generic_save',
                headline: 'No archive save needed',
                detail: 'The post step had no archive entries to save.',
                next_step: 'No action is needed unless archive entries were expected.',
            };
        case 'mode_post_no_generic_save':
            return {
                status: 'mode_post_no_generic_save',
                headline: 'Mode post step completed',
                detail: 'BoringCache completed mode-specific post work; there were no archive entries to save.',
                next_step: 'No action is needed unless archive entries were expected.',
            };
        case 'skipped_configuration':
        case 'mode_post_skipped_configuration':
            return {
                status: 'skipped_configuration',
                headline: 'Save skipped by configuration',
                detail: saveSkippedByConfigurationMessage(),
                next_step: 'Use save-policy: auto when trusted jobs should populate cache entries.',
            };
        case 'skipped_policy':
        case 'mode_post_skipped_policy':
            return {
                status: 'skipped_policy',
                headline: 'Save skipped by event policy',
                detail: saveSkippedByPolicyMessage(),
                next_step: 'Seed caches from a trusted branch, or set save-on-pull-request: true only for trusted pull request workflows.',
            };
        case 'skipped_missing_save_token':
        case 'mode_post_missing_save_token':
            return {
                status: 'skipped_missing_save_token',
                headline: 'Save skipped: missing save token',
                detail: `Save skipped: ${(0, core_1.missingSaveTokenMessage)()}`,
                next_step: 'Set BORINGCACHE_SAVE_TOKEN for trusted jobs that should write cache entries.',
            };
        default:
            return {
                status: saveStatus || 'completed',
                headline: 'Post step completed',
                detail: `BoringCache post step completed with status ${saveStatus || 'completed'} and trust state ${trustState.status}.`,
                next_step: 'Inspect mode-specific evidence if cache behavior is still unclear.',
            };
    }
}
function failurePhaseSummary(phase, error) {
    const phaseName = phase === 'post' ? 'Post step' : 'Restore';
    return {
        status: 'failed',
        headline: `${phaseName} failed`,
        detail: actionErrorMessage(error),
        next_step: 'Open the action logs and fix the reported error; the evidence file keeps the redacted failure context.',
    };
}
function trustStateDetail(trustState) {
    switch (trustState.status) {
        case 'restore_only_by_configuration':
            return 'save-policy is off.';
        case 'restore_only_by_event_policy':
            return 'pull request jobs stay restore-only by default.';
        case 'restore_only_missing_save_token':
            return (0, core_1.missingSaveTokenMessage)();
        default:
            return 'save is not currently available.';
    }
}
function restoreOnlyNextStep(trustState) {
    switch (trustState.status) {
        case 'restore_only_by_configuration':
            return 'Use save-policy: auto when trusted jobs should populate cache entries.';
        case 'restore_only_by_event_policy':
            return 'Seed caches from a trusted branch, or set save-on-pull-request: true only for trusted pull request workflows.';
        case 'restore_only_missing_save_token':
            return 'Set BORINGCACHE_SAVE_TOKEN for trusted jobs that should write cache entries.';
        default:
            return 'No action is needed unless this workflow should refresh cache entries.';
    }
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
    const parsed = parsePositiveIntegerInput(value, 'diagnostics-log-lines');
    if (parsed > exports.MAX_DIAGNOSTICS_LOG_LINES) {
        core.warning(`diagnostics-log-lines "${value}" is too high; tailing ${exports.MAX_DIAGNOSTICS_LOG_LINES} lines to keep diagnostics bounded.`);
        return exports.MAX_DIAGNOSTICS_LOG_LINES;
    }
    return parsed;
}
function normalizeOciHydrationPolicy(value) {
    switch ((value || exports.DEFAULT_OCI_HYDRATION_POLICY).trim().toLowerCase()) {
        case 'metadata-only':
        case 'bodies-before-ready':
            return (value || exports.DEFAULT_OCI_HYDRATION_POLICY).trim().toLowerCase();
        default:
            throw new Error(`Unsupported oci-hydration "${value}". Expected metadata-only or bodies-before-ready.`);
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
function writeActionEvidence(phase, payload) {
    const evidencePath = actionEvidencePath();
    const current = readActionEvidence(evidencePath);
    const now = new Date().toISOString();
    const evidence = {
        schema_version: 'boringcache_one_evidence.v1',
        generated_at: current.generated_at || now,
        updated_at: now,
        phases: sanitizeEvidencePhases({
            ...current.phases,
            [phase]: payload,
        }),
    };
    try {
        fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
        fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
        core.setOutput('evidence-path', evidencePath);
        core.saveState('evidence-path', evidencePath);
        return evidencePath;
    }
    catch (error) {
        core.warning(`Could not write BoringCache evidence file at ${evidencePath}: ${errorMessage(error)}`);
        return '';
    }
}
function writeActionFailureEvidence(phase, error, context = {}) {
    return writeActionEvidence(phase, {
        ...context,
        phase_status: 'failed',
        phase_summary: failurePhaseSummary(phase, error),
        error: evidenceError(error),
    });
}
function actionErrorMessage(error) {
    return redactEvidenceText(errorMessage(error)).slice(0, 2000);
}
function actionEvidencePath() {
    const savedPath = (core.getState('evidence-path') || '').trim();
    if (savedPath) {
        return savedPath;
    }
    const configuredPath = (process.env.BORINGCACHE_ONE_EVIDENCE_PATH || '').trim();
    if (configuredPath) {
        return configuredPath;
    }
    return path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'boringcache-one-evidence.json');
}
function readActionEvidence(filePath) {
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (isActionEvidence(parsed)) {
            return parsed;
        }
    }
    catch {
        // A missing or malformed local evidence file should not fail cache setup.
    }
    return {
        schema_version: 'boringcache_one_evidence.v1',
        phases: {},
    };
}
function isActionEvidence(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const candidate = value;
    return candidate.schema_version === 'boringcache_one_evidence.v1'
        && !!candidate.phases
        && typeof candidate.phases === 'object'
        && !Array.isArray(candidate.phases);
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function evidenceError(error) {
    const errorType = error instanceof Error && error.name ? error.name : typeof error;
    return {
        type: errorType,
        message: actionErrorMessage(error),
    };
}
function sanitizeEvidencePhases(phases) {
    return Object.fromEntries(Object.entries(phases).map(([phase, payload]) => [
        phase,
        sanitizeEvidenceRecord(payload),
    ]));
}
function sanitizeEvidenceRecord(record) {
    return sanitizeEvidenceValue(record);
}
function sanitizeEvidenceValue(value) {
    if (typeof value === 'string') {
        return redactEvidenceText(value);
    }
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeEvidenceValue(item));
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [
            key,
            sanitizeEvidenceValue(item),
        ]));
    }
    return value;
}
function redactEvidenceText(value) {
    const secretQueryFieldPattern = 'token|secret|password|credential|authorization|signature|sig|api[-_]?key|x-amz-security-token|x-amz-signature|x-goog-signature';
    const secretHeaderFieldPattern = 'token|secret|password|credential|signature|api[-_]?key|x-amz-security-token|x-amz-signature|x-goog-signature';
    let redacted = value
        .replace(/(authorization):\s*Bearer\s+[^\s,;]+/gi, '$1: Bearer ***')
        .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer ***')
        .replace(new RegExp(`(${secretQueryFieldPattern})=([^&\\s]+)`, 'gi'), '$1=***')
        .replace(new RegExp(`(${secretHeaderFieldPattern}):\\s*([^\\s]+)`, 'gi'), '$1: ***')
        .replace(/(authorization):\s+(?!Bearer\s+\*\*\*)[^\r\n,;]+/gi, '$1: ***');
    for (const secret of evidenceSecretValues()) {
        redacted = redacted.split(secret).join('***');
    }
    return redacted;
}
function evidenceSecretValues() {
    const secretNamePattern = /(TOKEN|SECRET|PASSWORD|PASS|PRIVATE|CREDENTIAL|AUTH|KEY)/i;
    const values = new Set();
    for (const [name, value] of Object.entries(process.env)) {
        if (!value || value.length < 4 || !secretNamePattern.test(name)) {
            continue;
        }
        values.add(value);
    }
    return Array.from(values).sort((a, b) => b.length - a.length);
}
function readLogTail(filePath, maxLines) {
    const lineLimit = Math.min(Math.floor(maxLines), exports.MAX_DIAGNOSTICS_LOG_LINES);
    if (!filePath || lineLimit < 1) {
        return [];
    }
    let fileDescriptor = null;
    try {
        fileDescriptor = fs.openSync(filePath, 'r');
        const fileSize = fs.fstatSync(fileDescriptor).size;
        const chunkSize = 64 * 1024;
        const byteLimit = Math.min(fileSize, exports.MAX_DIAGNOSTICS_LOG_BYTES);
        const chunks = [];
        let position = fileSize;
        let bytesCollected = 0;
        let lines = [];
        while (position > 0 && bytesCollected < byteLimit && lines.length <= lineLimit) {
            const bytesToRead = Math.min(chunkSize, position, byteLimit - bytesCollected);
            position -= bytesToRead;
            const buffer = Buffer.allocUnsafe(bytesToRead);
            const bytesRead = fs.readSync(fileDescriptor, buffer, 0, bytesToRead, position);
            if (bytesRead <= 0) {
                break;
            }
            bytesCollected += bytesRead;
            chunks.unshift(buffer.subarray(0, bytesRead));
            lines = Buffer.concat(chunks)
                .toString('utf8')
                .split(/\r?\n/)
                .filter((line) => line.trim().length > 0);
        }
        const tailLines = lines.slice(-lineLimit);
        if (tailLines.length > 0 && position > 0 && bytesCollected >= byteLimit && lines.length <= lineLimit) {
            tailLines[0] = `[truncated to last ${exports.MAX_DIAGNOSTICS_LOG_BYTES} bytes] ${tailLines[0]}`;
        }
        return tailLines.map((line) => redactEvidenceText(line));
    }
    catch {
        return [];
    }
    finally {
        if (fileDescriptor !== null) {
            fs.closeSync(fileDescriptor);
        }
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
        return exports.DEFAULT_VERIFY_TIMEOUT_SECONDS;
    }
    const parsed = parsePositiveIntegerInput(value, 'verify-timeout-seconds');
    if (parsed > exports.MAX_VERIFY_TIMEOUT_SECONDS) {
        core.warning(`verify-timeout-seconds "${value}" is too high; waiting at most ${exports.MAX_VERIFY_TIMEOUT_SECONDS}s to keep verification bounded.`);
        return exports.MAX_VERIFY_TIMEOUT_SECONDS;
    }
    return parsed;
}
function parsePositiveIntegerInput(value, inputName) {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
        throw new Error(`Unsupported ${inputName} "${value}". Expected a positive integer.`);
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error(`Unsupported ${inputName} "${value}". Expected a positive integer.`);
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
    const value = process.env.BORINGCACHE_NO_GIT?.trim().toLowerCase();
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
    for (const key of [
        'BORINGCACHE_GIT_BRANCH',
        'GITHUB_HEAD_REF',
        'GITHUB_REF_NAME',
        'CI_COMMIT_REF_NAME',
        'CI_COMMIT_BRANCH',
        'CIRCLE_BRANCH',
        'BITBUCKET_BRANCH',
    ]) {
        const value = process.env[key]?.trim();
        if (value) {
            return normalizeRef(value);
        }
    }
    return undefined;
}
function detectCiSha() {
    for (const key of [
        'BORINGCACHE_GIT_SHA',
        'GITHUB_SHA',
        'CI_COMMIT_SHA',
        'CIRCLE_SHA1',
        'BITBUCKET_COMMIT',
    ]) {
        const value = process.env[key]?.trim();
        if (value) {
            return value;
        }
    }
    return undefined;
}
function envDefaultBranch() {
    const value = process.env.BORINGCACHE_DEFAULT_BRANCH?.trim();
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
async function runTagCheck(workspace, batch, options, timeoutSeconds) {
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
    let env;
    if (!options.requireServerSignature) {
        env = envWithOverrides({ BORINGCACHE_REQUIRE_SERVER_SIGNATURE: '0' });
    }
    const result = await runBoringcacheCheckWithTimeout(args, timeoutSeconds, env);
    if (result.exitCode !== 0 && shouldParseCheckJson) {
        const acceptedTags = pendingOnlyForAcceptedSaveTags(result.stdout, acceptedPendingTags);
        if (acceptedTags.length > 0) {
            core.info(`Accepted pending save verification for tags: ${acceptedTags.join(', ')}`);
            return { ...result, exitCode: 0 };
        }
    }
    return result;
}
async function runBoringcacheCheckWithTimeout(args, timeoutSeconds, env) {
    const timeoutMs = Math.max(1, timeoutSeconds) * 1000;
    const outputLimit = 1024 * 1024;
    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        let settled = false;
        let timedOut = false;
        let killTimer;
        let timeoutTimer;
        const finish = (result) => {
            if (settled) {
                return;
            }
            settled = true;
            if (timeoutTimer) {
                timers.clearTimeout(timeoutTimer);
            }
            if (killTimer) {
                timers.clearTimeout(killTimer);
            }
            resolve({
                ...result,
                stdout: result.stdout.trim(),
                stderr: result.stderr.trim(),
            });
        };
        const appendOutput = (current, data) => {
            const next = current + data.toString();
            if (next.length <= outputLimit) {
                return next;
            }
            return next.slice(next.length - outputLimit);
        };
        let child;
        try {
            child = childProcess.spawn('boringcache', args, {
                env: env || process.env,
                windowsHide: true,
            });
        }
        catch (error) {
            finish({
                exitCode: 1,
                stdout,
                stderr: appendOutput(stderr, Buffer.from(`${errorMessage(error)}\n`)),
            });
            return;
        }
        timeoutTimer = timers.setTimeout(() => {
            timedOut = true;
            stderr = appendOutput(stderr, Buffer.from(`boringcache check timed out after ${timeoutSeconds}s\n`));
            killTimer = timers.setTimeout(() => {
                child.kill('SIGKILL');
            }, 2000);
            child.kill('SIGTERM');
        }, timeoutMs);
        child.stdout?.on('data', (data) => {
            stdout = appendOutput(stdout, data);
        });
        child.stderr?.on('data', (data) => {
            stderr = appendOutput(stderr, data);
        });
        child.on('error', (error) => {
            finish({
                exitCode: 1,
                stdout,
                stderr: appendOutput(stderr, Buffer.from(`${error.message}\n`)),
            });
        });
        child.on('close', (code, signal) => {
            if (timedOut) {
                finish({
                    exitCode: 124,
                    stdout,
                    stderr,
                    timedOut: true,
                });
                return;
            }
            finish({
                exitCode: code ?? (signal ? 1 : 0),
                stdout,
                stderr,
            });
        });
    });
}
function boundedCheckAttemptTimeoutSeconds(timeoutSeconds, deadline) {
    const remainingSeconds = deadline
        ? Math.max(1, Math.ceil((deadline - Date.now()) / 1000))
        : Math.max(1, timeoutSeconds);
    return Math.min(remainingSeconds, timeoutSeconds, exports.MAX_VERIFY_CHECK_ATTEMPT_SECONDS);
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
            const result = await runTagCheck(workspace, batch, options, boundedCheckAttemptTimeoutSeconds(options.timeoutSeconds));
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
            const result = await runTagCheck(workspace, batch, options, boundedCheckAttemptTimeoutSeconds(options.timeoutSeconds, deadline));
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
        if (pomMatch?.[1]) {
            return pomMatch[1].trim();
        }
    }
    return null;
}
async function detectMavenVersion(workingDirectory) {
    const wrapperProps = await readFile(path.join(workingDirectory, '.mvn', 'wrapper', 'maven-wrapper.properties'));
    if (wrapperProps) {
        const match = wrapperProps.match(/apache-maven-([0-9]+(?:\.[0-9]+)*)-bin/i);
        if (match?.[1]) {
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
        if (match?.[1]) {
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
    const packageManagerField = typeof packageJson?.packageManager === 'string'
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
    if (!packageManager?.version) {
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
        if (toolTagSuffix?.trim()) {
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
    const plan = await runDryRunPlan(workingDirectory, {
        workspaceInput: options.workspaceInput,
        entryIds: options.entryIds,
        cacheTag: options.cacheTag,
        toolTagSuffix: options.toolTagSuffix,
        fallbackWorkspace: options.fallbackWorkspace,
    });
    const workspace = plan.workspace?.trim()
        || options.fallbackWorkspace?.trim()
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
    const plan = await runDryRunPlan(workingDirectory, {
        workspaceInput,
        fallbackWorkspace,
    });
    return plan.workspace?.trim() || null;
}
function cliPlanHasProvenance(plan) {
    return Boolean(plan.workspace_source || plan.repo_config_path || plan.archive_entries);
}
function cliPlanUsesRepoConfigResolution(plan) {
    const firstEntry = plan.archive_entries?.[0];
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
        archiveEntries.push(...plan.tag_path_pairs);
        if (!cacheTagPrefix) {
            const firstEntry = plan.archive_entries?.[0];
            const firstPair = plan.tag_path_pairs[0];
            cacheTagPrefix = firstEntry?.resolved_tag || firstEntry?.tag
                || (firstPair ? (0, core_1.parseEntries)(firstPair, 'restore', { resolvePaths: false })[0]?.tag : undefined);
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
            if (!inputs.cacheTag.trim() && !cliToolTagSuffix?.trim()) {
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
    if (resolvedArchivePrefix?.trim()) {
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


/***/ }),

/***/ 317:
/***/ ((module) => {

module.exports = require("child_process");

/***/ }),

/***/ 982:
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),

/***/ 896:
/***/ ((module) => {

module.exports = require("fs");

/***/ }),

/***/ 611:
/***/ ((module) => {

module.exports = require("http");

/***/ }),

/***/ 278:
/***/ ((module) => {

module.exports = require("net");

/***/ }),

/***/ 857:
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ 928:
/***/ ((module) => {

module.exports = require("path");

/***/ }),

/***/ 557:
/***/ ((module) => {

module.exports = require("timers");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId].call(module.exports, module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __nccwpck_require__(436);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;