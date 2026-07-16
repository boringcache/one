import * as core from '@actions/core';
let warnedAboutLegacyApiToken = false;
export function getAuthTokens() {
    const apiToken = process.env.BORINGCACHE_API_TOKEN || undefined;
    const saveToken = process.env.BORINGCACHE_SAVE_TOKEN || apiToken;
    const restoreToken = process.env.BORINGCACHE_RESTORE_TOKEN || saveToken;
    return {
        restoreToken,
        saveToken,
        apiToken,
    };
}
export function hasRestoreToken() {
    return Boolean(getAuthTokens().restoreToken);
}
export function hasSaveToken() {
    return Boolean(getAuthTokens().saveToken);
}
export function isUsingLegacyApiTokenOnly() {
    return Boolean(process.env.BORINGCACHE_API_TOKEN &&
        !process.env.BORINGCACHE_RESTORE_TOKEN &&
        !process.env.BORINGCACHE_SAVE_TOKEN);
}
export function warnIfUsingLegacyApiToken() {
    if (warnedAboutLegacyApiToken || !isUsingLegacyApiTokenOnly()) {
        return;
    }
    warnedAboutLegacyApiToken = true;
    core.notice('Using BORINGCACHE_API_TOKEN as a legacy compatibility fallback. Prefer BORINGCACHE_RESTORE_TOKEN and BORINGCACHE_SAVE_TOKEN for new workflows.');
}
export function missingRestoreTokenMessage() {
    return 'A restore-capable token is required. Set BORINGCACHE_RESTORE_TOKEN, BORINGCACHE_SAVE_TOKEN, or BORINGCACHE_API_TOKEN.';
}
export function missingSaveTokenMessage() {
    return 'A save-capable token is required. Set BORINGCACHE_SAVE_TOKEN or BORINGCACHE_API_TOKEN.';
}
