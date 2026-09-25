const MAX_OIDC_RESPONSE_BYTES = 32 * 1024;
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    const response = await fetch(url, {
        headers: { authorization: `Bearer ${requestToken}` },
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
    });
    delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
    delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
    if (!response.ok || !response.body)
        throw new Error(`GitHub OIDC request failed with HTTP ${response.status}`);
    const contentLength = response.headers.get('content-length');
    if (contentLength && Number(contentLength) > MAX_OIDC_RESPONSE_BYTES) {
        throw new Error('GitHub OIDC response exceeds 32 KiB');
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
        const bytes = Buffer.from(chunk);
        size += bytes.byteLength;
        if (size > MAX_OIDC_RESPONSE_BYTES)
            throw new Error('GitHub OIDC response exceeds 32 KiB');
        chunks.push(bytes);
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!isObject(payload) || typeof payload.value !== 'string'
        || payload.value.length > 32 * 1024 || /\s/.test(payload.value)) {
        throw new Error('GitHub OIDC response is invalid');
    }
    return payload.value;
}
