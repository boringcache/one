export function redactEvidenceText(value) {
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
        if (!value || value.length < 4 || !secretNamePattern.test(name) || isLocalProxyPlaceholder(name, value)) {
            continue;
        }
        values.add(value);
    }
    return Array.from(values).sort((a, b) => b.length - a.length);
}
function isLocalProxyPlaceholder(name, value) {
    if (value !== 'boringcache') {
        return false;
    }
    const endpointName = name === 'TURBO_TOKEN'
        ? 'TURBO_API'
        : name === 'NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN'
            ? 'NX_SELF_HOSTED_REMOTE_CACHE_SERVER'
            : '';
    const endpoint = endpointName ? process.env[endpointName] : '';
    if (!endpoint) {
        return false;
    }
    try {
        const url = new URL(endpoint);
        return url.protocol === 'http:'
            && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    }
    catch {
        return false;
    }
}
