import { createHash } from 'crypto';
import { stdin, stdout } from 'process';
import { attest, PolicyError, TUFError, ValidationError, VerificationError, verify } from 'sigstore';
import { parse as parseToml } from 'smol-toml';
import { assertOneVerificationMaterial, assertPublisherIdentity, PublisherPolicyError, publisherVerifyOptions, } from './trust-provider-identity';
import { githubIdentityToken } from './trust-provider-oidc';
const PROTOCOL_VERSION = 1;
const MAX_REQUEST_BYTES = 512 * 1024;
const MAX_BUNDLE_BYTES = 256 * 1024;
const BUNDLE_MEDIA_TYPE = 'application/vnd.dev.sigstore.bundle+json';
const STATEMENT_TYPE = 'https://in-toto.io/Statement/v1';
const PREDICATE_TYPE = 'https://boringcache.com/attestation/publisher-subject/v1';
const PAYLOAD_TYPE = 'application/vnd.in-toto+json';
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function assertSubject(value) {
    if (!isObject(value) || !['archive', 'archive-graph', 'oci', 'gha-cache', 'kv-batch', 'artifact', 'registry'].includes(String(value.kind))) {
        throw new Error('subject.kind is invalid');
    }
    if (!isObject(value.digest) || !/^[0-9a-f]{64}$/.test(String(value.digest.sha256))) {
        throw new Error('subject.digest.sha256 is invalid');
    }
}
function assertBaseRequest(value) {
    if (!isObject(value) || value.protocol_version !== PROTOCOL_VERSION) {
        throw new Error('unsupported protocol_version');
    }
    if (typeof value.request_id !== 'string' || !/^[0-9a-f-]{36}$/.test(value.request_id)) {
        throw new Error('request_id is invalid');
    }
    assertSubject(value.subject);
}
function statementFor(subject) {
    return {
        _type: STATEMENT_TYPE,
        subject: [{
                name: `boringcache:${subject.kind}`,
                digest: { sha256: subject.digest.sha256 },
            }],
        predicateType: PREDICATE_TYPE,
        predicate: { kind: subject.kind },
    };
}
function subjectDigest(subject) {
    return `sha256:${subject.digest.sha256}`;
}
function decodeBase64(value, field, maxBytes) {
    if (typeof value !== 'string' || value.length > Math.ceil(maxBytes / 3) * 4 + 4) {
        throw new Error(`${field} is too large`);
    }
    const decoded = Buffer.from(value, 'base64');
    if (decoded.byteLength > maxBytes || decoded.toString('base64') !== value) {
        throw new Error(`${field} is not canonical bounded base64`);
    }
    return decoded;
}
async function handleAttest(request) {
    const identityToken = await githubIdentityToken();
    const statement = Buffer.from(JSON.stringify(statementFor(request.subject)));
    const bundle = await attest(statement, PAYLOAD_TYPE, {
        identityToken,
        tlogUpload: true,
        timeout: 15_000,
    });
    const bundleBytes = Buffer.from(JSON.stringify(bundle));
    if (bundleBytes.byteLength > MAX_BUNDLE_BYTES) {
        throw new Error('Sigstore bundle exceeds 256 KiB');
    }
    return {
        protocol_version: PROTOCOL_VERSION,
        request_id: request.request_id,
        status: 'success',
        subject_digest: subjectDigest(request.subject),
        bundle: {
            media_type: BUNDLE_MEDIA_TYPE,
            encoding: 'base64',
            data: bundleBytes.toString('base64'),
        },
    };
}
function parsePolicy(request) {
    if (request.policy.encoding !== 'base64')
        throw new Error('policy.encoding must be base64');
    const bytes = decodeBase64(request.policy.data, 'policy.data', MAX_REQUEST_BYTES);
    const actualDigest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    if (request.policy.sha256 !== actualDigest)
        throw new Error('policy digest mismatch');
    const document = parseToml(bytes.toString('utf8'));
    if (Number(document.trust?.version) !== PROTOCOL_VERSION || document.trust?.verifier !== 'sigstore') {
        throw new Error('policy does not configure Sigstore verifier protocol v1');
    }
    const publishers = document.trust.publishers;
    if (!Array.isArray(publishers) || publishers.length === 0) {
        throw new Error('policy has no trusted publishers');
    }
    return publishers;
}
function assertStatement(bundle, subject) {
    const envelope = bundle.dsseEnvelope;
    if (!isObject(envelope) || envelope.payloadType !== PAYLOAD_TYPE || typeof envelope.payload !== 'string') {
        throw new Error('bundle does not contain a BoringCache DSSE attestation');
    }
    const payload = decodeBase64(envelope.payload, 'bundle DSSE payload', 64 * 1024);
    const statement = JSON.parse(payload.toString('utf8'));
    if (JSON.stringify(statement) !== JSON.stringify(statementFor(subject))) {
        throw new Error('attested statement does not match the requested subject');
    }
}
async function verifyPublisher(bundle, publisher) {
    const signer = await verify(bundle, publisherVerifyOptions(publisher));
    return assertPublisherIdentity(signer, publisher);
}
async function handleVerify(request) {
    if (request.bundle.media_type !== BUNDLE_MEDIA_TYPE || request.bundle.encoding !== 'base64') {
        return denyResponse(request, 'invalid_bundle');
    }
    let bundle;
    try {
        const bundleBytes = decodeBase64(request.bundle.data, 'bundle.data', MAX_BUNDLE_BYTES);
        bundle = JSON.parse(bundleBytes.toString('utf8'));
        assertOneVerificationMaterial(bundle);
        assertStatement(bundle, request.subject);
    }
    catch {
        return denyResponse(request, 'invalid_bundle');
    }
    for (const publisher of parsePolicy(request)) {
        try {
            const identity = await verifyPublisher(bundle, publisher);
            return {
                protocol_version: PROTOCOL_VERSION,
                request_id: request.request_id,
                decision: 'allow',
                subject_digest: subjectDigest(request.subject),
                identity,
                reason_code: 'trusted_publisher',
            };
        }
        catch (error) {
            if (error instanceof TUFError)
                throw error;
            if (!(error instanceof PublisherPolicyError) && !(error instanceof PolicyError)
                && !(error instanceof VerificationError) && !(error instanceof ValidationError)) {
                throw error;
            }
        }
    }
    return denyResponse(request, 'untrusted_publisher');
}
function denyResponse(request, reasonCode) {
    return {
        protocol_version: PROTOCOL_VERSION,
        request_id: request.request_id,
        decision: 'deny',
        subject_digest: subjectDigest(request.subject),
        identity: null,
        reason_code: reasonCode,
    };
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
export async function runProvider(request) {
    assertBaseRequest(request);
    if (request.operation === 'attest')
        return handleAttest(request);
    if (request.operation === 'verify')
        return handleVerify(request);
    throw new Error('operation must be attest or verify');
}
async function main() {
    try {
        const response = await runProvider(await readRequest());
        stdout.write(JSON.stringify(response));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`Sigstore provider failed: ${message}\n`);
        process.exitCode = 1;
    }
}
if (process.argv[1] === __filename) {
    void main();
}
