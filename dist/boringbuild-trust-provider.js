import { createHash, createPublicKey, verify as verifySignature } from 'crypto';
import { stdin, stdout } from 'process';
import { parse as parseToml } from 'smol-toml';
const PROTOCOL_VERSION = 1;
const MAX_REQUEST_BYTES = 512 * 1024;
const MAX_BUNDLE_BYTES = 256 * 1024;
const MAX_TOKEN_BYTES = 64 * 1024;
const MEDIA_TYPE = 'application/vnd.boringbuild.publisher-oidc+jwt';
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function subjectAudience(subject) {
    return `urn:boringcache:publisher:v1:${subject.kind}:sha256:${subject.digest.sha256}`;
}
function subjectDigest(subject) {
    return `sha256:${subject.digest.sha256}`;
}
function assertRequest(value) {
    if (!isObject(value) || value.protocol_version !== PROTOCOL_VERSION
        || typeof value.request_id !== 'string' || !/^[0-9a-f-]{36}$/.test(value.request_id)
        || !isObject(value.subject) || ![
        'archive', 'archive-graph', 'oci', 'gha-cache', 'kv-batch', 'artifact', 'registry',
    ].includes(String(value.subject.kind))
        || !isObject(value.subject.digest)
        || !/^[0-9a-f]{64}$/.test(String(value.subject.digest.sha256))) {
        throw new Error('publisher request is invalid');
    }
}
function decodeBase64(value, field, limit) {
    if (typeof value !== 'string' || value.length > Math.ceil(limit / 3) * 4 + 4) {
        throw new Error(`${field} is too large`);
    }
    const bytes = Buffer.from(value, 'base64');
    if (bytes.byteLength > limit || bytes.toString('base64') !== value) {
        throw new Error(`${field} is not canonical bounded base64`);
    }
    return bytes;
}
function decodeBase64Url(value, field, limit) {
    if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > Math.ceil(limit / 3) * 4 + 4) {
        throw new Error(`${field} is invalid`);
    }
    const bytes = Buffer.from(value, 'base64url');
    if (bytes.byteLength > limit || bytes.toString('base64url') !== value) {
        throw new Error(`${field} is invalid`);
    }
    return bytes;
}
function exactRequestURL(value, audience) {
    const url = new URL(value);
    const query = [...url.searchParams.entries()];
    if (url.protocol !== 'https:' || (url.port !== '' && url.port !== '443')
        || url.username || url.password || url.hash
        || !/^\/_boringbuild\/oidc\/token\/[^/]+$/.test(url.pathname)
        || query.length !== 2 || query[0][0] !== 'api-version' || query[0][1] !== '1'
        || query[1][0] !== 'audience' || query[1][1] !== audience) {
        throw new Error('BoringBuild OIDC request URL is invalid');
    }
    return url;
}
async function identityToken(subject) {
    const requestURL = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
    const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
    if (!requestURL || !requestToken)
        throw new Error('BoringBuild OIDC request capability is required');
    const url = exactRequestURL(requestURL, subjectAudience(subject));
    if (requestToken.trim() !== requestToken || /[^\x21-\x7e]/.test(requestToken)
        || requestToken.length > 32 * 1024) {
        throw new Error('BoringBuild OIDC request credential is invalid');
    }
    let response;
    try {
        response = await fetch(url, {
            headers: { authorization: `Bearer ${requestToken}` },
            redirect: 'error',
            signal: AbortSignal.timeout(15_000),
        });
    }
    finally {
        delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
        delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
    }
    if (!response.ok || !response.body)
        throw new Error(`BoringBuild OIDC request failed with HTTP ${response.status}`);
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
        const bytes = Buffer.from(chunk);
        size += bytes.byteLength;
        if (size > MAX_TOKEN_BYTES)
            throw new Error('BoringBuild OIDC response is too large');
        chunks.push(bytes);
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!isObject(payload) || typeof payload.value !== 'string'
        || payload.value.length > MAX_TOKEN_BYTES || /\s/.test(payload.value)) {
        throw new Error('BoringBuild OIDC response is invalid');
    }
    return payload.value;
}
function parseToken(token) {
    if (Buffer.byteLength(token) > MAX_TOKEN_BYTES)
        throw new Error('OIDC token is too large');
    const parts = token.split('.');
    if (parts.length !== 3)
        throw new Error('OIDC token is invalid');
    const header = JSON.parse(decodeBase64Url(parts[0], 'OIDC header', 2048).toString('utf8'));
    const claims = JSON.parse(decodeBase64Url(parts[1], 'OIDC claims', 32 * 1024).toString('utf8'));
    if (!isObject(header) || !isObject(claims) || header.alg !== 'RS256' || header.typ !== 'JWT'
        || typeof header.kid !== 'string') {
        throw new Error('OIDC token header or claims are invalid');
    }
    return {
        header, claims, signed: `${parts[0]}.${parts[1]}`,
        signature: decodeBase64Url(parts[2], 'OIDC signature', 1024),
    };
}
function pinnedKey(publisher) {
    const key = publisher['public-key'];
    if (!isObject(key) || typeof key.kid !== 'string'
        || typeof key.n !== 'string' || typeof key.e !== 'string') {
        throw new Error('BoringBuild publisher has no pinned public key');
    }
    decodeBase64Url(key.n, 'public key modulus', 1024);
    decodeBase64Url(key.e, 'public key exponent', 8);
    const thumbprint = createHash('sha256')
        .update(JSON.stringify({ e: key.e, kty: 'RSA', n: key.n }))
        .digest('base64url');
    if (key.kid !== thumbprint)
        throw new Error('BoringBuild public key ID is invalid');
    const publicKey = createPublicKey({ key: { kty: 'RSA', n: key.n, e: key.e }, format: 'jwk' });
    if ((publicKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
        throw new Error('BoringBuild public key is too small');
    }
    return publicKey;
}
function validOrigin(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && url.origin === value && !url.username && !url.password;
    }
    catch {
        return false;
    }
}
function assertIdentity(claims, publisher, subject) {
    if (!validOrigin(publisher.issuer) || !validOrigin(publisher['forge-origin'])
        || claims.iss !== publisher.issuer
        || claims.aud !== subjectAudience(subject)
        || claims.forge_origin !== publisher['forge-origin']
        || claims.repository_id !== publisher['repository-id']
        || claims.workflow_ref !== publisher['workflow-ref']
        || !Array.isArray(publisher['source-refs']) || !publisher['source-refs'].includes(claims.ref)
        || !Array.isArray(publisher.events) || !publisher.events.includes(claims.event_name)
        || claims.boringbuild_source_trust !== 'trusted'
        || claims.boringbuild_ingress !== 'forge'
        || !['1', '2'].includes(String(claims.boringbuild_claims_version))
        || typeof claims.sub !== 'string' || !claims.sub
        || typeof claims.jti !== 'string' || !claims.jti
        || !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.nbf)
        || !Number.isSafeInteger(claims.exp)
        || claims.exp <= claims.iat
        || claims.exp - claims.iat > 600
        || claims.nbf > claims.iat
        || claims.iat - claims.nbf > 120
        || claims.iat > Math.floor(Date.now() / 1000) + 120) {
        throw new Error('BoringBuild publisher identity is not authorized');
    }
}
function publishersFromPolicy(request) {
    const policy = request.policy;
    if (!isObject(policy) || policy.encoding !== 'base64')
        throw new Error('policy is invalid');
    const bytes = decodeBase64(policy.data, 'policy', MAX_REQUEST_BYTES);
    const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    if (policy.sha256 !== digest)
        throw new Error('policy digest mismatch');
    const document = parseToml(bytes.toString('utf8'));
    const trust = document.trust;
    if (!isObject(trust) || Number(trust.version) !== PROTOCOL_VERSION
        || trust.verifier !== 'boringbuild-oidc' || !Array.isArray(trust.publishers)) {
        throw new Error('policy does not configure BoringBuild OIDC verification');
    }
    return trust.publishers.filter((publisher) => isObject(publisher) && publisher.type === 'boringbuild-oidc');
}
function deny(request, reasonCode) {
    return {
        protocol_version: PROTOCOL_VERSION,
        request_id: request.request_id,
        decision: 'deny',
        subject_digest: subjectDigest(request.subject),
        identity: null,
        reason_code: reasonCode,
    };
}
export async function runBoringBuildProvider(request) {
    assertRequest(request);
    if (request.operation === 'attest') {
        const token = await identityToken(request.subject);
        return {
            protocol_version: PROTOCOL_VERSION,
            request_id: request.request_id,
            status: 'success',
            subject_digest: subjectDigest(request.subject),
            bundle: {
                media_type: MEDIA_TYPE,
                encoding: 'base64',
                data: Buffer.from(token).toString('base64'),
            },
        };
    }
    if (request.operation !== 'verify')
        throw new Error('operation must be attest or verify');
    const publishers = publishersFromPolicy(request);
    const bundle = request.bundle;
    if (!isObject(bundle) || bundle.media_type !== MEDIA_TYPE || bundle.encoding !== 'base64') {
        return deny(request, 'invalid_bundle');
    }
    let token;
    let parsed;
    try {
        token = decodeBase64(bundle.data, 'bundle', MAX_BUNDLE_BYTES).toString('utf8');
        parsed = parseToken(token);
    }
    catch {
        return deny(request, 'invalid_bundle');
    }
    for (const publisher of publishers) {
        try {
            const key = pinnedKey(publisher);
            if (parsed.header.kid !== publisher['public-key'].kid
                || !verifySignature('RSA-SHA256', Buffer.from(parsed.signed), key, parsed.signature)) {
                continue;
            }
            assertIdentity(parsed.claims, publisher, request.subject);
            return {
                protocol_version: PROTOCOL_VERSION,
                request_id: request.request_id,
                decision: 'allow',
                subject_digest: subjectDigest(request.subject),
                identity: {
                    issuer: publisher.issuer,
                    forge_origin: publisher['forge-origin'],
                    repository_id: publisher['repository-id'],
                    source_ref: parsed.claims.ref,
                    event: parsed.claims.event_name,
                    workflow_ref: publisher['workflow-ref'],
                    key_id: publisher['public-key'].kid,
                },
                reason_code: 'trusted_publisher',
            };
        }
        catch {
            continue;
        }
    }
    return deny(request, 'untrusted_publisher');
}
async function readRequest() {
    const chunks = [];
    let size = 0;
    for await (const chunk of stdin) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.byteLength;
        if (size > MAX_REQUEST_BYTES)
            throw new Error('provider request exceeds 512 KiB');
        chunks.push(bytes);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function main() {
    try {
        stdout.write(JSON.stringify(await runBoringBuildProvider(await readRequest())));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`BoringBuild publisher provider failed: ${message}\n`);
        process.exitCode = 1;
    }
}
if (process.argv[1] === __filename) {
    void main();
}
