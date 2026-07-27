export function getAuthTokens() {
    const saveToken = process.env.BORINGCACHE_SAVE_TOKEN || undefined;
    const restoreToken = process.env.BORINGCACHE_RESTORE_TOKEN || saveToken;
    return {
        restoreToken,
        saveToken,
    };
}
export function hasRestoreToken() {
    return Boolean(getAuthTokens().restoreToken);
}
export function hasSaveToken() {
    return Boolean(getAuthTokens().saveToken);
}
export function missingRestoreTokenMessage() {
    return 'A restore-capable token is required. Set BORINGCACHE_RESTORE_TOKEN or BORINGCACHE_SAVE_TOKEN.';
}
export function missingSaveTokenMessage() {
    return 'A save-capable token is required. Set BORINGCACHE_SAVE_TOKEN.';
}
