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
exports.getWorkspace = getWorkspace;
exports.getCacheTagPrefix = getCacheTagPrefix;
exports.pathExists = pathExists;
const core = __importStar(require("@actions/core"));
const fs = __importStar(require("fs"));
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
