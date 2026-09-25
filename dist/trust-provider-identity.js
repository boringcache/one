export class PublisherPolicyError extends Error {
}
export const OID = {
    sourceRepositoryRef: '1.3.6.1.4.1.57264.1.14',
    sourceRepositoryIdentifier: '1.3.6.1.4.1.57264.1.15',
    buildConfigURI: '1.3.6.1.4.1.57264.1.18',
    buildConfigDigest: '1.3.6.1.4.1.57264.1.19',
    buildTrigger: '1.3.6.1.4.1.57264.1.20',
};
const UTF8_STRING_TAG = 0x0c;
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function exactPattern(value) {
    return `^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
}
function workflowURI(ref) {
    return `https://github.com/${ref}`;
}
function deny(message) {
    throw new PublisherPolicyError(message);
}
export function publisherVerifyOptions(publisher) {
    if (publisher.type !== 'sigstore-keyless')
        throw new Error('unsupported publisher type');
    if (!/^https:\/\//.test(publisher.issuer))
        throw new Error('publisher issuer is invalid');
    if (!/^\d+$/.test(publisher['repository-id']))
        throw new Error('publisher repository-id is invalid');
    const signerRef = publisher['job-workflow-ref'] ?? publisher['workflow-ref'];
    return {
        certificateIssuer: publisher.issuer,
        certificateIdentityURI: exactPattern(workflowURI(signerRef)),
        ctLogThreshold: 1,
        tlogThreshold: 1,
        timeout: 15_000,
    };
}
export function assertOneVerificationMaterial(bundle) {
    const material = bundle.verificationMaterial;
    if (!isObject(material))
        throw new Error('bundle has no verification material');
    const alternatives = ['certificate', 'x509CertificateChain', 'publicKey']
        .filter((name) => material[name] !== undefined && material[name] !== null);
    if (alternatives.length !== 1) {
        throw new Error(`bundle must carry exactly one verification material, found ${alternatives.length}`);
    }
}
export function decodeUtf8String(value) {
    if (value.length < 2 || value[0] !== UTF8_STRING_TAG)
        return undefined;
    let offset = 1;
    let length = value[offset];
    offset += 1;
    if (length & 0x80) {
        const count = length & 0x7f;
        if (count < 1 || count > 2 || offset + count > value.length)
            return undefined;
        length = 0;
        for (let index = 0; index < count; index += 1) {
            length = (length << 8) | value[offset];
            offset += 1;
        }
        if (length < 0x80)
            return undefined;
    }
    if (offset + length !== value.length)
        return undefined;
    return Buffer.from(value.subarray(offset, offset + length)).toString('utf8');
}
function signerExtension(signer, oid) {
    const pair = signer.identity?.oids?.find((entry) => entry.oid?.id.join('.') === oid);
    return pair === undefined ? undefined : decodeUtf8String(pair.value);
}
function requireExtension(signer, oid, field) {
    const value = signerExtension(signer, oid);
    if (value === undefined)
        deny(`the verified certificate does not record ${field}`);
    return value;
}
export function assertPublisherIdentity(signer, publisher) {
    if (signer.identity?.oids === undefined) {
        deny('the verified signer has no certificate identity');
    }
    const repositoryId = requireExtension(signer, OID.sourceRepositoryIdentifier, 'a source repository identifier');
    if (repositoryId !== publisher['repository-id']) {
        deny(`certificate repository ${repositoryId} is not the trusted repository`);
    }
    const buildConfigURI = requireExtension(signer, OID.buildConfigURI, 'a build configuration');
    if (buildConfigURI !== workflowURI(publisher['workflow-ref'])) {
        deny(`certificate workflow ${buildConfigURI} is not the trusted workflow`);
    }
    const sourceRefs = publisher['source-refs'] ?? [];
    const sourceRef = requireExtension(signer, OID.sourceRepositoryRef, 'a source ref');
    if (sourceRefs.length > 0 && !sourceRefs.includes(sourceRef)) {
        deny(`certificate ref ${sourceRef} is not a trusted ref`);
    }
    const events = publisher.events ?? [];
    const event = requireExtension(signer, OID.buildTrigger, 'a build trigger');
    if (events.length > 0 && !events.includes(event)) {
        deny(`certificate event ${event} is not a trusted event`);
    }
    const expectedWorkflowSha = publisher['workflow-sha'];
    const workflowSha = signerExtension(signer, OID.buildConfigDigest);
    if (expectedWorkflowSha !== undefined && workflowSha !== expectedWorkflowSha) {
        deny(`certificate workflow digest ${workflowSha ?? 'missing'} is not the trusted digest`);
    }
    const jobWorkflowRef = publisher['job-workflow-ref'];
    return {
        issuer: publisher.issuer,
        repository_id: repositoryId,
        source_ref: sourceRef,
        event,
        workflow_ref: publisher['workflow-ref'],
        ...(jobWorkflowRef ? { job_workflow_ref: jobWorkflowRef } : {}),
        ...(workflowSha ? { workflow_sha: workflowSha } : {}),
    };
}
