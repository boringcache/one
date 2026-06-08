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
exports.getAuthTokens = getAuthTokens;
exports.hasRestoreToken = hasRestoreToken;
exports.hasSaveToken = hasSaveToken;
exports.isUsingLegacyApiTokenOnly = isUsingLegacyApiTokenOnly;
exports.warnIfUsingLegacyApiToken = warnIfUsingLegacyApiToken;
exports.missingRestoreTokenMessage = missingRestoreTokenMessage;
exports.missingSaveTokenMessage = missingSaveTokenMessage;
const core = __importStar(require("@actions/core"));
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
