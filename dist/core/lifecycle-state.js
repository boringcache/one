import * as core from '@actions/core';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
const STATE_ID_KEY = 'lifecycle-id';
const STATE_SCHEMA = 'boringcache_one_lifecycle.v1';
const MAX_STATE_BYTES = 256 * 1024;
let processStateId;
function currentStateId() {
    const saved = (core.getState(STATE_ID_KEY) || '').trim();
    if (saved) {
        return saved;
    }
    processStateId ||= crypto.randomUUID();
    return processStateId;
}
function statePath(id = currentStateId()) {
    const digest = crypto.createHash('sha256').update(id).digest('hex');
    return path.join(os.tmpdir(), `boringcache-one-lifecycle-${digest}.json`);
}
function removeStateDocument(id) {
    fs.rmSync(statePath(id), { force: true });
}
function emptyDocument() {
    return { schema_version: STATE_SCHEMA, values: {} };
}
function readDocument() {
    const filePath = statePath();
    if (!fs.existsSync(filePath)) {
        return emptyDocument();
    }
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_STATE_BYTES) {
        throw new Error('The BoringCache lifecycle state document is invalid.');
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!parsed
        || typeof parsed !== 'object'
        || Array.isArray(parsed)
        || parsed.schema_version !== STATE_SCHEMA
        || typeof parsed.values !== 'object'
        || Array.isArray(parsed.values)) {
        throw new Error(`Unsupported BoringCache lifecycle state; expected ${STATE_SCHEMA}.`);
    }
    const values = parsed.values;
    if (Object.values(values).some((value) => typeof value !== 'string')) {
        throw new Error('The BoringCache lifecycle state document contains a non-string value.');
    }
    return { schema_version: STATE_SCHEMA, values };
}
function writeDocument(document) {
    const filePath = statePath();
    const body = `${JSON.stringify(document)}\n`;
    if (Buffer.byteLength(body) > MAX_STATE_BYTES) {
        throw new Error('The BoringCache lifecycle state document exceeds its 256 KiB limit.');
    }
    const temporaryPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temporaryPath, body, { mode: 0o600 });
    try {
        fs.renameSync(temporaryPath, filePath);
    }
    finally {
        fs.rmSync(temporaryPath, { force: true });
    }
    core.saveState(STATE_ID_KEY, currentStateId());
}
export function getActionState(key) {
    return readDocument().values[key] || '';
}
export function saveActionState(key, value) {
    const document = readDocument();
    document.values[key] = value;
    writeDocument(document);
}
export function removeActionStateDocument() {
    const id = ((core.getState(STATE_ID_KEY) || processStateId) ?? '').trim();
    if (id) {
        removeStateDocument(id);
    }
    processStateId = undefined;
}
export function lifecycleStateIdForTests(values, id = crypto.randomUUID()) {
    const previous = processStateId;
    processStateId = id;
    writeDocument({ schema_version: STATE_SCHEMA, values });
    processStateId = previous;
    return id;
}
export function lifecycleStateForTests(id) {
    const previous = processStateId;
    processStateId = id;
    try {
        return { ...readDocument().values };
    }
    finally {
        processStateId = previous;
    }
}
export function resetLifecycleStateForTests() {
    if (processStateId) {
        removeStateDocument(processStateId);
    }
    processStateId = undefined;
}
