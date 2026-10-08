import { setTimeout as delay } from 'timers/promises';
const MAX_OIDC_RESPONSE_BYTES = 32 * 1024;
const OIDC_REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 250;
const MAX_BACKOFF_MS = 4_000;
const MAX_RETRY_AFTER_MS = 15_000;
class TransientOidcFailure extends Error {
    retryAfterMs;
    constructor(message, retryAfterMs) {
        super(message);
        this.retryAfterMs = retryAfterMs;
    }
}
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function retryableStatus(status) {
    return status === 408 || status === 429 || (status >= 500 && status !== 507);
}
function retryAfterMs(headers) {
    const value = headers.get('retry-after')?.trim();
    if (!value)
        return undefined;
    if (/^\d+$/.test(value))
        return Number(value) * 1000;
    const deadline = Date.parse(value);
    return Number.isNaN(deadline) ? undefined : Math.max(0, deadline - Date.now());
}
function oidcRetryDelayMs(attempt, retryAfter) {
    if (attempt >= MAX_ATTEMPTS)
        return undefined;
    const backoff = Math.min(BASE_DELAY_MS * 2 ** Math.min(attempt - 1, 4), MAX_BACKOFF_MS);
    return retryAfter === undefined ? backoff : Math.max(backoff, Math.min(retryAfter, MAX_RETRY_AFTER_MS));
}
async function requestIdentityTokenOnce(url, requestToken, provider, maxBytes) {
    let response;
    try {
        response = await fetch(url, {
            headers: { authorization: `Bearer ${requestToken}` },
            redirect: 'error',
            signal: AbortSignal.timeout(OIDC_REQUEST_TIMEOUT_MS),
        });
    }
    catch (error) {
        throw new TransientOidcFailure(`${provider} OIDC request failed: ${errorMessage(error)}`);
    }
    if (!response.ok || !response.body) {
        const message = `${provider} OIDC request failed with HTTP ${response.status}`;
        if (retryableStatus(response.status)) {
            throw new TransientOidcFailure(message, retryAfterMs(response.headers));
        }
        throw new Error(message);
    }
    const contentLength = response.headers.get('content-length');
    if (contentLength && Number(contentLength) > maxBytes) {
        throw new Error(`${provider} OIDC response is too large`);
    }
    const chunks = [];
    let size = 0;
    try {
        for await (const chunk of response.body) {
            const bytes = Buffer.from(chunk);
            size += bytes.byteLength;
            if (size > maxBytes)
                break;
            chunks.push(bytes);
        }
    }
    catch (error) {
        throw new TransientOidcFailure(`Failed to read the ${provider} OIDC response: ${errorMessage(error)}`);
    }
    if (size > maxBytes)
        throw new Error(`${provider} OIDC response is too large`);
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!isObject(payload) || typeof payload.value !== 'string'
        || payload.value.length > maxBytes || /\s/.test(payload.value)) {
        throw new Error(`${provider} OIDC response is invalid`);
    }
    return payload.value;
}
export async function requestIdentityToken(url, requestToken, provider, maxBytes) {
    for (let attempt = 1;; attempt += 1) {
        try {
            return await requestIdentityTokenOnce(url, requestToken, provider, maxBytes);
        }
        catch (error) {
            if (!(error instanceof TransientOidcFailure))
                throw error;
            const wait = oidcRetryDelayMs(attempt, error.retryAfterMs);
            if (wait === undefined) {
                throw new Error(`${provider} OIDC request failed after ${attempt} attempts: ${error.message}`);
            }
            process.stderr.write(`${provider} OIDC request attempt ${attempt} of ${MAX_ATTEMPTS} failed: ${error.message}; retrying in ${(wait / 1000).toFixed(2)}s\n`);
            await delay(wait);
        }
    }
}
export async function githubIdentityToken() {
    const requestURL = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
    const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
    if (!requestURL || !requestToken) {
        throw new Error('GitHub OIDC request capability is required for attest');
    }
    const url = new URL(requestURL);
    const trustedHost = url.hostname === 'actions.githubusercontent.com'
        || url.hostname.endsWith('.actions.githubusercontent.com');
    if (url.protocol !== 'https:' || (url.port !== '' && url.port !== '443') || !trustedHost
        || url.username || url.password || url.hash || url.searchParams.getAll('audience').length !== 1
        || url.searchParams.get('audience') !== 'sigstore') {
        throw new Error('GitHub OIDC request URL is invalid');
    }
    if (requestToken.trim() !== requestToken || /[^\x21-\x7e]/.test(requestToken)
        || requestToken.length > 32 * 1024) {
        throw new Error('GitHub OIDC request credential is invalid');
    }
    try {
        return await requestIdentityToken(url, requestToken, 'GitHub', MAX_OIDC_RESPONSE_BYTES);
    }
    finally {
        delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
        delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
    }
}
