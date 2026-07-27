export function getAuthTokens() {
    const saveToken = process.env.BORINGCACHE_SAVE_TOKEN || undefined;
    const stageToken = process.env.BORINGCACHE_STAGE_TOKEN || saveToken;
    const restoreToken = process.env.BORINGCACHE_RESTORE_TOKEN || stageToken;
    return {
        restoreToken,
        stageToken,
        saveToken,
    };
}
export function hasRestoreToken() {
    return Boolean(getAuthTokens().restoreToken);
}
export function hasSaveToken() {
    return Boolean(getAuthTokens().saveToken);
}
export function hasStageToken() {
    return Boolean(getAuthTokens().stageToken);
}
export function missingRestoreTokenMessage() {
    return 'A restore-capable token is required. Set BORINGCACHE_RESTORE_TOKEN, BORINGCACHE_STAGE_TOKEN, or BORINGCACHE_SAVE_TOKEN.';
}
export function missingSaveTokenMessage() {
    return 'A save-capable token is required. Set BORINGCACHE_SAVE_TOKEN.';
}
export function missingStageTokenMessage() {
    return 'A stage-capable token is required. Set BORINGCACHE_STAGE_TOKEN or BORINGCACHE_SAVE_TOKEN.';
}
