import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as timers from 'timers';
import { activateMiseTool, ensureBoringCache, ensureXcodePlugin, exportMiseEnv, execBoringCache, hasRestoreToken, hasStageToken, hasSaveToken, missingStageTokenMessage, missingSaveTokenMessage, hasMiseToolVersion, hasToolVersionOnPath, installMise, installMiseTool, parseEntries, readProjectMiseTools, readMiseTomlVersion, readToolVersionsValue, reshimMise, } from './core';
import { assertImplementedMode, normalizeMode, resolveModeSpec, } from './modes';
export { activateMiseTool, ensureBoringCache, ensureXcodePlugin, exportMiseEnv, execBoringCache, hasMiseToolVersion, hasToolVersionOnPath, installMise, installMiseTool, parseEntries, };
export const DEFAULT_OCI_HYDRATION_POLICY = 'metadata-only';
export const CANDIDATE_RECEIPT_FILE_ENV = 'BORINGCACHE_CANDIDATE_RECEIPT_FILE';
export function prepareCandidateReceiptFile() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boringcache-one-candidates-'));
    const receiptFile = path.join(directory, 'receipts.jsonl');
    fs.writeFileSync(receiptFile, '', { mode: 0o600 });
    process.env[CANDIDATE_RECEIPT_FILE_ENV] = receiptFile;
    return receiptFile;
}
export function useCandidateReceiptFile(receiptFile) {
    if (receiptFile.trim()) {
        process.env[CANDIDATE_RECEIPT_FILE_ENV] = receiptFile;
    }
}
export function readCandidateReceipts(receiptFile) {
    if (!receiptFile.trim() || !fs.existsSync(receiptFile)) {
        return [];
    }
    const receipts = new Map();
    for (const line of fs.readFileSync(receiptFile, 'utf8').split('\n')) {
        if (!line.trim()) {
            continue;
        }
        try {
            const parsed = JSON.parse(line);
            const id = parsed.id?.trim() || '';
            const digest = parsed.manifest_root_digest?.trim().toLowerCase() || '';
            if (!id || !/^sha256:[0-9a-f]{64}$/.test(digest)) {
                core.warning('Ignoring malformed BoringCache candidate receipt.');
                continue;
            }
            receipts.set(id, {
                id,
                tag: parsed.tag?.trim() || '',
                manifest_root_digest: digest,
                storage_mode: parsed.storage_mode?.trim() || '',
            });
        }
        catch {
            core.warning('Ignoring invalid JSON in the BoringCache candidate receipt file.');
        }
    }
    return [...receipts.values()];
}
export function publishCandidateOutputs(receiptFile) {
    const receipts = readCandidateReceipts(receiptFile);
    if (receipts.length === 0) {
        return receipts;
    }
    core.setOutput('cache-candidates', receipts.map((receipt) => receipt.id).join('\n'));
    core.setOutput('cache-candidate-digests', receipts.map((receipt) => receipt.manifest_root_digest).join('\n'));
    return receipts;
}
export const MAX_DIAGNOSTICS_LOG_LINES = 500;
export const MAX_DIAGNOSTICS_LOG_BYTES = 512 * 1024;
export const DEFAULT_VERIFY_TIMEOUT_SECONDS = 180;
export const MAX_VERIFY_TIMEOUT_SECONDS = 900;
export const MAX_VERIFY_CHECK_ATTEMPT_SECONDS = 30;
const TOOL_LABELS = {
    bazel: 'Bazel',
    bun: 'Bun',
    composer: 'Composer',
    ccache: 'ccache',
    elixir: 'Elixir',
    erlang: 'Erlang',
    go: 'Go',
    gradle: 'Gradle',
    java: 'Java',
    maven: 'Maven',
    node: 'Node.js',
    nodejs: 'Node.js',
    npm: 'npm',
    pnpm: 'pnpm',
    php: 'PHP',
    python: 'Python',
    ruby: 'Ruby',
    rust: 'Rust',
    turbo: 'Turbo',
    uv: 'uv',
    yarn: 'Yarn',
};
export function getInputs() {
    return {
        cliVersion: core.getInput('cli-version') || 'v1.16.3',
        cliPlatform: core.getInput('cli-platform'),
        setup: normalizeSetup(core.getInput('setup')),
        mode: normalizeMode(core.getInput('mode')),
        workingDirectory: path.resolve(core.getInput('working-directory') || '.'),
        tools: core.getInput('tools'),
        mavenVersion: core.getInput('maven-version') || '3.9.9',
        mavenLocalRepo: core.getInput('maven-local-repo') || '~/.m2/repository',
        trustPolicy: normalizeTrustPolicy(core.getInput('trust-policy') || 'auto'),
        cacheCandidates: core.getInput('cache-candidates', { trimWhitespace: false }),
        readOnly: false,
        stage: false,
        saveAlways: core.getBooleanInput('save-always'),
        verify: normalizeVerifyMode(core.getInput('verify')),
        verifyTimeoutSeconds: normalizeVerifyTimeoutSeconds(core.getInput('verify-timeout-seconds')),
        verifyRequireServerSignature: core.getBooleanInput('verify-require-server-signature'),
        trustedWorkspaceSigningKeyFingerprint: core.getInput('trusted-workspace-signing-key-fingerprint'),
        diagnostics: normalizeDiagnosticsMode(core.getInput('diagnostics')),
        diagnosticsLogLines: normalizeDiagnosticsLogLines(core.getInput('diagnostics-log-lines')),
        metadataHints: core.getInput('metadata-hints'),
        proxyPort: core.getInput('proxy-port'),
        managedBuildkitImage: core.getInput('managed-buildkit-image') || 'ghcr.io/boringcache/buildkit@sha256:cbf9d9e945f955b6e886daeca059ae01be9807512c61260e33e25b1ee94c515e',
        dockerToolCache: core.getInput('docker-tool-cache'),
        cacheProfiles: core.getInput('cache-profiles'),
        failOnCacheMiss: core.getBooleanInput('fail-on-cache-miss'),
        failOnCacheError: core.getBooleanInput('fail-on-cache-error'),
        lookupOnly: core.getBooleanInput('lookup-only'),
        force: core.getBooleanInput('force'),
        verbose: core.getBooleanInput('verbose'),
    };
}
export function isPullRequestEvent() {
    return ['pull_request', 'pull_request_target'].includes((process.env.GITHUB_EVENT_NAME || '').trim().toLowerCase());
}
export function applyRestoreOnlyTokenPolicy() {
    const restoreFallback = process.env.BORINGCACHE_RESTORE_TOKEN ||
        process.env.BORINGCACHE_STAGE_TOKEN ||
        process.env.BORINGCACHE_SAVE_TOKEN;
    const hadWriteCapableToken = Boolean(process.env.BORINGCACHE_STAGE_TOKEN || process.env.BORINGCACHE_SAVE_TOKEN);
    if (restoreFallback) {
        process.env.BORINGCACHE_RESTORE_TOKEN = restoreFallback;
    }
    delete process.env.BORINGCACHE_STAGE_TOKEN;
    delete process.env.BORINGCACHE_SAVE_TOKEN;
    delete process.env.BORINGCACHE_ADMIN_TOKEN;
    delete process.env.BORINGCACHE_API_TOKEN;
    return hadWriteCapableToken;
}
export function resolveTrustPolicy(requested) {
    const intended = requested === 'auto'
        ? (isPullRequestEvent() ? 'restore' : 'publish')
        : requested;
    if (intended === 'stage' && !hasStageToken()) {
        return { resolved: 'restore', status: 'restore_only_missing_stage_token' };
    }
    if (intended === 'publish' && !hasSaveToken()) {
        return { resolved: 'restore', status: 'restore_only_missing_save_token' };
    }
    if (intended === 'restore') {
        return {
            resolved: 'restore',
            status: requested === 'auto' && isPullRequestEvent()
                ? 'restore_only_by_event_policy'
                : 'restore_only',
        };
    }
    return { resolved: intended, status: intended };
}
export function applyTrustTokenPolicy(resolved) {
    delete process.env.BORINGCACHE_SAVE_ON_PULL_REQUEST;
    delete process.env.BORINGCACHE_RESTORE_PR_CACHE;
    if (resolved === 'restore') {
        applyRestoreOnlyTokenPolicy();
    }
}
export function buildActionTrustState(requestedPolicy, resolvedPolicy, status) {
    return {
        status: status || (resolvedPolicy === 'restore' ? 'restore_only' : resolvedPolicy),
        event_name: (process.env.GITHUB_EVENT_NAME || '').trim(),
        requested_policy: requestedPolicy,
        resolved_policy: resolvedPolicy,
        write_allowed: resolvedPolicy !== 'restore',
        token_capabilities: {
            restore: hasRestoreToken(),
            stage: hasStageToken(),
            save: hasSaveToken(),
        },
    };
}
export function restorePhaseSummary(options) {
    if (options.cacheHit) {
        const hitDetail = 'BoringCache restored at least one requested cache for this step.';
        if (options.saveCapable) {
            return {
                status: 'cache_hit',
                headline: 'Cache restored',
                detail: hitDetail,
                next_step: 'Continue the workflow; the post step can refresh save-expected tags.',
            };
        }
        return {
            status: 'cache_hit_restore_only',
            headline: 'Cache restored',
            detail: `${hitDetail} This run is restore-only: ${trustStateDetail(options.trustState)}`,
            next_step: restoreOnlyNextStep(options.trustState),
        };
    }
    if (options.saveCapable) {
        return {
            status: 'cache_miss_will_save',
            headline: 'No cache restored',
            detail: 'BoringCache did not restore a matching cache; this workflow can save one in the post step.',
            next_step: 'Let the post step finish, then inspect the post phase if the next run stays cold.',
        };
    }
    return {
        status: 'cache_miss_restore_only',
        headline: 'No cache restored',
        detail: `BoringCache did not restore a matching cache, and this run is restore-only: ${trustStateDetail(options.trustState)}`,
        next_step: restoreOnlyNextStep(options.trustState),
    };
}
export function postPhaseSummary(saveStatus, trustState) {
    switch (saveStatus) {
        case 'staged':
            return {
                status: 'staged',
                headline: 'Cache candidate staged',
                detail: 'BoringCache staged immutable archive entries without moving published tags.',
                next_step: 'Select the exact candidate in a trusted solve or promote the exact archive snapshot.',
            };
        case 'mode_post_and_generic_stage':
            return {
                status: 'staged',
                headline: 'Cache candidates staged',
                detail: 'BoringCache completed mode-specific candidate publication and staged immutable archive entries without moving published tags.',
                next_step: 'Select exact candidates in a trusted solve or promote an exact archive snapshot.',
            };
        case 'mode_post_staged':
            return {
                status: 'staged',
                headline: 'Cache candidate staged',
                detail: 'BoringCache completed mode-specific immutable candidate publication without moving the published tag.',
                next_step: 'Select the exact candidate in a trusted Docker or BuildKit solve.',
            };
        case 'saved':
            return {
                status: 'saved',
                headline: 'Cache saved',
                detail: 'BoringCache saved archive entries for future runs.',
                next_step: 'The next matching run can restore these entries.',
            };
        case 'mode_post_and_generic_save':
            return {
                status: 'saved',
                headline: 'Cache saved',
                detail: 'BoringCache completed mode-specific post work and saved archive entries for future runs.',
                next_step: 'The next matching run can restore these caches.',
            };
        case 'no_generic_save':
            return {
                status: 'no_generic_save',
                headline: 'No archive save needed',
                detail: 'The post step had no archive entries to save.',
                next_step: 'No action is needed unless archive entries were expected.',
            };
        case 'mode_post_no_generic_save':
            return {
                status: 'mode_post_no_generic_save',
                headline: 'Mode post step completed',
                detail: 'BoringCache completed mode-specific post work; there were no archive entries to save.',
                next_step: 'No action is needed unless archive entries were expected.',
            };
        case 'restore_only':
        case 'mode_post_restore_only':
            return {
                status: 'restore_only',
                headline: 'Restore-only run completed',
                detail: `BoringCache did not publish cache changes: ${trustStateDetail(trustState)}`,
                next_step: restoreOnlyNextStep(trustState),
            };
        case 'skipped_missing_token':
        case 'mode_post_missing_token':
            return {
                status: 'skipped_missing_token',
                headline: 'Publication skipped: missing token capability',
                detail: `BoringCache could not apply trust-policy ${trustState.requested_policy}: ${trustStateDetail(trustState)}`,
                next_step: restoreOnlyNextStep(trustState),
            };
        default:
            return {
                status: saveStatus || 'completed',
                headline: 'Post step completed',
                detail: `BoringCache post step completed with status ${saveStatus || 'completed'} and trust state ${trustState.status}.`,
                next_step: 'Inspect mode-specific evidence if cache behavior is still unclear.',
            };
    }
}
function failurePhaseSummary(phase, error) {
    const phaseName = phase === 'post' ? 'Post step' : 'Restore';
    return {
        status: 'failed',
        headline: `${phaseName} failed`,
        detail: actionErrorMessage(error),
        next_step: 'Open the action logs and fix the reported error; the evidence file keeps the redacted failure context.',
    };
}
function trustStateDetail(trustState) {
    switch (trustState.status) {
        case 'restore_only':
            return 'trust-policy is restore.';
        case 'restore_only_by_event_policy':
            return 'trust-policy auto resolves pull requests to restore.';
        case 'restore_only_missing_stage_token':
            return missingStageTokenMessage();
        case 'restore_only_missing_save_token':
            return missingSaveTokenMessage();
        default:
            return 'save is not currently available.';
    }
}
function restoreOnlyNextStep(trustState) {
    switch (trustState.status) {
        case 'restore_only':
            return 'Use trust-policy: stage or publish only when this job is trusted for that operation.';
        case 'restore_only_by_event_policy':
            return 'Use trust-policy: stage for an immutable candidate, or publish only when this pull-request job is explicitly trusted.';
        case 'restore_only_missing_stage_token':
            return 'Set BORINGCACHE_STAGE_TOKEN for jobs that should stage immutable candidates.';
        case 'restore_only_missing_save_token':
            return 'Set BORINGCACHE_SAVE_TOKEN for trusted jobs that should write cache entries.';
        default:
            return 'No action is needed unless this workflow should refresh cache entries.';
    }
}
export function normalizeTrustPolicy(value) {
    switch ((value || 'auto').trim().toLowerCase()) {
        case 'auto':
        case 'restore':
        case 'stage':
        case 'publish':
            return (value || 'auto').trim().toLowerCase();
        default:
            throw new Error(`Unsupported trust-policy "${value}". Expected auto, restore, stage, or publish.`);
    }
}
export function normalizeDiagnosticsMode(value) {
    switch ((value || 'auto').trim().toLowerCase()) {
        case 'auto':
        case 'off':
        case 'summary':
        case 'verbose':
            return (value || 'auto').trim().toLowerCase();
        default:
            throw new Error(`Unsupported diagnostics mode "${value}". Expected auto, off, summary, or verbose.`);
    }
}
export function normalizeDiagnosticsLogLines(value) {
    if (!value || !value.trim()) {
        return 40;
    }
    const parsed = parsePositiveIntegerInput(value, 'diagnostics-log-lines');
    if (parsed > MAX_DIAGNOSTICS_LOG_LINES) {
        core.warning(`diagnostics-log-lines "${value}" is too high; tailing ${MAX_DIAGNOSTICS_LOG_LINES} lines to keep diagnostics bounded.`);
        return MAX_DIAGNOSTICS_LOG_LINES;
    }
    return parsed;
}
export function resolveDiagnosticsConfig(mode, logLines) {
    let level;
    switch (mode) {
        case 'auto':
            level = core.isDebug() ? 'verbose' : 'off';
            break;
        case 'off':
        case 'summary':
        case 'verbose':
            level = mode;
            break;
    }
    return {
        level,
        enabled: level !== 'off',
        includeLogs: level === 'verbose',
        logLines,
    };
}
export function loadDiagnosticsConfig(inputs) {
    const savedLevel = (core.getState('diagnostics-level') || '').trim().toLowerCase();
    if (savedLevel === 'off' || savedLevel === 'summary' || savedLevel === 'verbose') {
        const savedLogLines = normalizeDiagnosticsLogLines((core.getState('diagnostics-log-lines') || '').trim() || String(inputs.diagnosticsLogLines));
        return {
            level: savedLevel,
            enabled: savedLevel !== 'off',
            includeLogs: savedLevel === 'verbose',
            logLines: savedLogLines,
        };
    }
    return resolveDiagnosticsConfig(inputs.diagnostics, inputs.diagnosticsLogLines);
}
export async function runDiagnosticsGroup(diagnostics, title, fn) {
    if (!diagnostics.enabled) {
        return;
    }
    await core.group(title, fn);
}
export function writeActionEvidence(phase, payload) {
    const evidencePath = actionEvidencePath();
    const current = readActionEvidence(evidencePath);
    const now = new Date().toISOString();
    const evidence = {
        schema_version: 'boringcache_one_evidence.v1',
        generated_at: current.generated_at || now,
        updated_at: now,
        phases: sanitizeEvidencePhases({
            ...current.phases,
            [phase]: payload,
        }),
    };
    try {
        fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
        fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
        core.setOutput('evidence-path', evidencePath);
        core.saveState('evidence-path', evidencePath);
        return evidencePath;
    }
    catch (error) {
        core.warning(`Could not write BoringCache evidence file at ${evidencePath}: ${errorMessage(error)}`);
        return '';
    }
}
export function writeActionFailureEvidence(phase, error, context = {}) {
    return writeActionEvidence(phase, {
        ...context,
        phase_status: 'failed',
        phase_summary: failurePhaseSummary(phase, error),
        error: evidenceError(error),
    });
}
export function actionErrorMessage(error) {
    return redactEvidenceText(errorMessage(error)).slice(0, 2000);
}
function actionEvidencePath() {
    const savedPath = (core.getState('evidence-path') || '').trim();
    if (savedPath) {
        return savedPath;
    }
    const configuredPath = (process.env.BORINGCACHE_ONE_EVIDENCE_PATH || '').trim();
    if (configuredPath) {
        return configuredPath;
    }
    return path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'boringcache-one-evidence.json');
}
function readActionEvidence(filePath) {
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (isActionEvidence(parsed)) {
            return parsed;
        }
    }
    catch {
        // A missing or malformed local evidence file should not fail cache setup.
    }
    return {
        schema_version: 'boringcache_one_evidence.v1',
        phases: {},
    };
}
function isActionEvidence(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const candidate = value;
    return candidate.schema_version === 'boringcache_one_evidence.v1'
        && !!candidate.phases
        && typeof candidate.phases === 'object'
        && !Array.isArray(candidate.phases);
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function evidenceError(error) {
    const errorType = error instanceof Error && error.name ? error.name : typeof error;
    return {
        type: errorType,
        message: actionErrorMessage(error),
    };
}
function sanitizeEvidencePhases(phases) {
    return Object.fromEntries(Object.entries(phases).map(([phase, payload]) => [
        phase,
        sanitizeEvidenceRecord(payload),
    ]));
}
function sanitizeEvidenceRecord(record) {
    return sanitizeEvidenceValue(record);
}
function sanitizeEvidenceValue(value) {
    if (typeof value === 'string') {
        return redactEvidenceText(value);
    }
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeEvidenceValue(item));
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [
            key,
            sanitizeEvidenceValue(item),
        ]));
    }
    return value;
}
function redactEvidenceText(value) {
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
        if (!value || value.length < 4 || !secretNamePattern.test(name)) {
            continue;
        }
        values.add(value);
    }
    return Array.from(values).sort((a, b) => b.length - a.length);
}
export function readLogTail(filePath, maxLines) {
    const lineLimit = Math.min(Math.floor(maxLines), MAX_DIAGNOSTICS_LOG_LINES);
    if (!filePath || lineLimit < 1) {
        return [];
    }
    let fileDescriptor = null;
    try {
        fileDescriptor = fs.openSync(filePath, 'r');
        const fileSize = fs.fstatSync(fileDescriptor).size;
        const chunkSize = 64 * 1024;
        const byteLimit = Math.min(fileSize, MAX_DIAGNOSTICS_LOG_BYTES);
        const chunks = [];
        let position = fileSize;
        let bytesCollected = 0;
        let lines = [];
        while (position > 0 && bytesCollected < byteLimit && lines.length <= lineLimit) {
            const bytesToRead = Math.min(chunkSize, position, byteLimit - bytesCollected);
            position -= bytesToRead;
            const buffer = Buffer.allocUnsafe(bytesToRead);
            const bytesRead = fs.readSync(fileDescriptor, buffer, 0, bytesToRead, position);
            if (bytesRead <= 0) {
                break;
            }
            bytesCollected += bytesRead;
            chunks.unshift(buffer.subarray(0, bytesRead));
            lines = Buffer.concat(chunks)
                .toString('utf8')
                .split(/\r?\n/)
                .filter((line) => line.trim().length > 0);
        }
        const tailLines = lines.slice(-lineLimit);
        if (tailLines.length > 0 && position > 0 && bytesCollected >= byteLimit && lines.length <= lineLimit) {
            tailLines[0] = `[truncated to last ${MAX_DIAGNOSTICS_LOG_BYTES} bytes] ${tailLines[0]}`;
        }
        return tailLines.map((line) => redactEvidenceText(line));
    }
    catch {
        return [];
    }
    finally {
        if (fileDescriptor !== null) {
            fs.closeSync(fileDescriptor);
        }
    }
}
export function normalizeVerifyMode(value) {
    const normalized = (value || 'none').trim().toLowerCase();
    switch (normalized) {
        case 'none':
        case 'check':
        case 'wait':
        case 'warn':
            return normalized;
        default:
            throw new Error(`Unsupported verify mode "${value}". Expected none, check, wait, or warn.`);
    }
}
export function normalizeVerifyTimeoutSeconds(value) {
    if (!value || !value.trim()) {
        return DEFAULT_VERIFY_TIMEOUT_SECONDS;
    }
    const parsed = parsePositiveIntegerInput(value, 'verify-timeout-seconds');
    if (parsed > MAX_VERIFY_TIMEOUT_SECONDS) {
        core.warning(`verify-timeout-seconds "${value}" is too high; waiting at most ${MAX_VERIFY_TIMEOUT_SECONDS}s to keep verification bounded.`);
        return MAX_VERIFY_TIMEOUT_SECONDS;
    }
    return parsed;
}
function parsePositiveIntegerInput(value, inputName) {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
        throw new Error(`Unsupported ${inputName} "${value}". Expected a positive integer.`);
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error(`Unsupported ${inputName} "${value}". Expected a positive integer.`);
    }
    return parsed;
}
export function normalizeSetup(value) {
    switch ((value || 'none').trim().toLowerCase()) {
        case 'mise':
        case 'none':
            return (value || 'none').trim().toLowerCase();
        default:
            throw new Error(`Unsupported setup "${value}". Expected mise or none.`);
    }
}
function expandUserPath(value) {
    if (value.startsWith('~/')) {
        return path.join(process.env.HOME || os.homedir(), value.slice(2));
    }
    return value;
}
function resolveWorkingPath(value, workingDirectory) {
    const expanded = expandUserPath(value);
    return path.isAbsolute(expanded) ? expanded : path.resolve(workingDirectory, expanded);
}
function normalizeRef(value) {
    let normalized = '';
    let lastWasDash = false;
    for (const rawChar of value.trim()) {
        const char = /[A-Za-z0-9]/.test(rawChar)
            ? rawChar.toLowerCase()
            : rawChar === '-' || rawChar === '_' || rawChar === '.'
                ? rawChar
                : '-';
        if (char === '-') {
            if (lastWasDash) {
                continue;
            }
            lastWasDash = true;
        }
        else {
            lastWasDash = false;
        }
        normalized += char;
        if (normalized.length >= 64) {
            break;
        }
    }
    const trimmed = normalized.replace(/^[-.]+|[-.]+$/g, '');
    return trimmed || 'unknown';
}
function isGitDisabledByEnv() {
    const value = process.env.BORINGCACHE_NO_GIT?.trim().toLowerCase();
    return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}
function shortenSha(sha) {
    return sha.trim().slice(0, 12);
}
function isCiEnv() {
    return Boolean(process.env.CI
        || process.env.GITHUB_ACTIONS
        || process.env.GITLAB_CI
        || process.env.CIRCLECI
        || process.env.BITBUCKET_BUILD_NUMBER);
}
function detectCiBranch() {
    for (const key of [
        'BORINGCACHE_GIT_BRANCH',
        'GITHUB_HEAD_REF',
        'GITHUB_REF_NAME',
        'CI_COMMIT_REF_NAME',
        'CI_COMMIT_BRANCH',
        'CIRCLE_BRANCH',
        'BITBUCKET_BRANCH',
    ]) {
        const value = process.env[key]?.trim();
        if (value) {
            return normalizeRef(value);
        }
    }
    return undefined;
}
function detectCiSha() {
    for (const key of [
        'BORINGCACHE_GIT_SHA',
        'GITHUB_SHA',
        'CI_COMMIT_SHA',
        'CIRCLE_SHA1',
        'BITBUCKET_COMMIT',
    ]) {
        const value = process.env[key]?.trim();
        if (value) {
            return value;
        }
    }
    return undefined;
}
function envDefaultBranch() {
    const value = process.env.BORINGCACHE_DEFAULT_BRANCH?.trim();
    return value ? normalizeRef(value) : undefined;
}
function resolveGitStartPath(pathHint, workingDirectory) {
    const candidate = pathHint ? resolveWorkingPath(pathHint, workingDirectory) : workingDirectory;
    if (fs.existsSync(candidate)) {
        return fs.statSync(candidate).isDirectory() ? candidate : path.dirname(candidate);
    }
    const parent = path.dirname(candidate);
    if (parent && parent !== candidate) {
        return parent;
    }
    return workingDirectory;
}
function findGitDir(startPath) {
    let current = path.resolve(startPath);
    while (true) {
        const candidate = path.join(current, '.git');
        // Git discovery walks local parent directories from the checked-out workspace.
        // codeql[js/path-injection]
        if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
            return candidate;
        }
        // codeql[js/path-injection]
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            // codeql[js/path-injection]
            const contents = fs.readFileSync(candidate, 'utf-8');
            const rest = contents.startsWith('gitdir:') ? contents.slice('gitdir:'.length).trim() : '';
            if (rest) {
                return path.isAbsolute(rest) ? rest : path.join(current, rest);
            }
        }
        const parent = path.dirname(current);
        if (parent === current) {
            return null;
        }
        current = parent;
    }
}
function detectBranchFromHead(gitDir) {
    const headPath = path.join(gitDir, 'HEAD');
    // gitDir is discovered under the local checkout; HEAD is fixed Git metadata.
    // codeql[js/path-injection]
    if (!fs.existsSync(headPath)) {
        return undefined;
    }
    // codeql[js/path-injection]
    const contents = fs.readFileSync(headPath, 'utf-8').trim();
    if (!contents.startsWith('ref:')) {
        return undefined;
    }
    const reference = contents.slice('ref:'.length).trim();
    const branchRef = reference.startsWith('refs/heads/') ? reference.slice('refs/heads/'.length) : reference;
    return normalizeRef(branchRef);
}
function detectDefaultBranch(gitDir) {
    const originHead = path.join(gitDir, 'refs', 'remotes', 'origin', 'HEAD');
    // gitDir is discovered under the local checkout; origin/HEAD is fixed Git metadata.
    // codeql[js/path-injection]
    if (!fs.existsSync(originHead)) {
        return undefined;
    }
    // codeql[js/path-injection]
    const contents = fs.readFileSync(originHead, 'utf-8').trim();
    if (!contents.startsWith('ref:')) {
        return undefined;
    }
    const reference = contents.slice('ref:'.length).trim();
    const branchName = reference.split('/').at(-1);
    return branchName ? normalizeRef(branchName) : undefined;
}
function detectGitContext(pathHint, workingDirectory) {
    if (isGitDisabledByEnv()) {
        return {};
    }
    const startPath = resolveGitStartPath(pathHint, workingDirectory);
    const gitDir = findGitDir(startPath);
    const context = {};
    if (gitDir) {
        const gitBranch = detectBranchFromHead(gitDir);
        if (gitBranch) {
            context.branch = gitBranch;
            context.defaultBranch = detectDefaultBranch(gitDir);
        }
    }
    if (!context.branch) {
        context.branch = detectCiBranch();
    }
    const overriddenDefault = envDefaultBranch();
    if (overriddenDefault) {
        context.defaultBranch = overriddenDefault;
    }
    if (!context.commitSha && isCiEnv()) {
        context.commitSha = detectCiSha();
    }
    return context;
}
function tagHasExplicitChannel(tag) {
    return tag.includes('-branch-')
        || tag.includes('-sha-')
        || tag.endsWith('-main')
        || tag.endsWith('-master');
}
function isDefaultBranch(branch, defaultBranch) {
    return defaultBranch ? branch === defaultBranch : branch === 'main' || branch === 'master';
}
function hasPlatformSuffix(tag) {
    const lastPart = tag.split('-').at(-1);
    if (lastPart && ['x86_64', 'arm64', 'arm32', 'x86'].includes(lastPart)) {
        return true;
    }
    return [
        '-ubuntu-',
        '-debian-',
        '-alpine-',
        '-arch-',
        '-macos-',
        '-windows-',
        '-linux-',
    ].some((pattern) => tag.includes(pattern));
}
function detectPlatformSuffix() {
    const arch = process.arch === 'x64'
        ? 'x86_64'
        : process.arch === 'arm64'
            ? 'arm64'
            : process.arch === 'arm'
                ? 'arm32'
                : process.arch === 'ia32'
                    ? 'x86'
                    : process.arch;
    if (process.platform === 'linux') {
        for (const releasePath of ['/etc/os-release', '/usr/lib/os-release']) {
            if (!fs.existsSync(releasePath)) {
                continue;
            }
            const contents = fs.readFileSync(releasePath, 'utf-8');
            let distro = '';
            let version = '';
            for (const line of contents.split('\n')) {
                const [rawKey, rawValue] = line.split('=');
                if (!rawKey || rawValue === undefined) {
                    continue;
                }
                const value = rawValue.trim().replace(/^["']|["']$/g, '');
                if (rawKey === 'ID') {
                    distro = value.toLowerCase();
                }
                else if (rawKey === 'VERSION_ID') {
                    version = value;
                }
            }
            if (distro) {
                const major = version.split('.').at(0) || '';
                switch (distro) {
                    case 'ubuntu':
                        return `ubuntu-${major || '22'}-${arch}`;
                    case 'debian':
                        return `debian-${major || '11'}-${arch}`;
                    case 'alpine':
                        return `alpine-${major || '3'}-${arch}`;
                    case 'arch':
                        return `arch-rolling-${arch}`;
                    default:
                        return `${distro}-${major || '0'}-${arch}`;
                }
            }
        }
        return `linux-unknown-${arch}`;
    }
    if (process.platform === 'darwin') {
        return `macos-unknown-${arch}`;
    }
    if (process.platform === 'win32') {
        return `windows-11-${arch}`;
    }
    return `${process.platform}-unknown-${arch}`;
}
function resolveExactTag(spec, workingDirectory) {
    let resolved = spec.tag;
    if (!spec.noGit && !isGitDisabledByEnv() && !tagHasExplicitChannel(spec.tag)) {
        const gitContext = detectGitContext(spec.pathHint, workingDirectory);
        const branch = gitContext.branch ? normalizeRef(gitContext.branch) : undefined;
        const defaultBranch = gitContext.defaultBranch ? normalizeRef(gitContext.defaultBranch) : undefined;
        if (branch && !isDefaultBranch(branch, defaultBranch)) {
            resolved = `${resolved}-branch-${branch}`;
        }
        else if (!branch && gitContext.commitSha) {
            resolved = `${resolved}-sha-${shortenSha(gitContext.commitSha)}`;
        }
    }
    if (!spec.noPlatform && !hasPlatformSuffix(resolved)) {
        resolved = `${resolved}-${detectPlatformSuffix()}`;
    }
    return resolved;
}
export function resolveVerificationTags(specs, workingDirectory) {
    const resolved = [];
    const seen = new Set();
    for (const spec of specs) {
        const exactTag = resolveExactTag(spec, workingDirectory);
        if (!seen.has(exactTag)) {
            seen.add(exactTag);
            resolved.push(exactTag);
        }
    }
    return resolved;
}
function appendVerificationSpecsFromEntries(specs, entries, noPlatform, noGit) {
    if (!entries.trim()) {
        return;
    }
    for (const entry of parseEntries(entries, 'restore', { separatorMode: 'newline' })) {
        specs.push({
            tag: entry.tag,
            noPlatform,
            noGit,
            pathHint: entry.savePath,
            saveExpected: true,
        });
    }
}
export function buildGenericVerificationSpecs(plan, noGit = false) {
    const specs = [];
    appendVerificationSpecsFromEntries(specs, plan.archiveEntries, false, noGit);
    return specs;
}
function envWithOverrides(overrides) {
    const env = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
            env[key] = value;
        }
    }
    return { ...env, ...overrides };
}
function groupVerificationSpecs(specs) {
    const grouped = new Map();
    for (const spec of specs) {
        const key = `${spec.noPlatform ? '1' : '0'}:${spec.noGit ? '1' : '0'}`;
        const batch = grouped.get(key) || {
            tags: [],
            noPlatform: spec.noPlatform,
            noGit: spec.noGit,
            saveExpectedTags: new Set(),
        };
        if (!batch.tags.includes(spec.tag)) {
            batch.tags.push(spec.tag);
        }
        if (spec.saveExpected) {
            batch.saveExpectedTags.add(spec.tag);
        }
        grouped.set(key, batch);
    }
    return Array.from(grouped.values());
}
async function runTagCheck(workspace, batch, options, timeoutSeconds) {
    const acceptedPendingTags = options.acceptPendingSaveExpected ? batch.saveExpectedTags : new Set();
    const shouldParseCheckJson = acceptedPendingTags.size > 0;
    const args = [];
    if (options.verbose) {
        args.push('--verbose');
    }
    if (options.requireServerSignature) {
        args.push('--require-server-signature');
    }
    args.push('check', workspace, batch.tags.join(','));
    if (batch.noPlatform) {
        args.push('--no-platform');
    }
    if (batch.noGit) {
        args.push('--no-git');
    }
    args.push('--exact', '--fail-on-miss');
    if (shouldParseCheckJson) {
        args.push('--json');
    }
    let env;
    if (!options.requireServerSignature) {
        env = envWithOverrides({ BORINGCACHE_REQUIRE_SERVER_SIGNATURE: '0' });
    }
    const result = await runBoringcacheCheckWithTimeout(args, timeoutSeconds, env);
    if (result.exitCode !== 0 && shouldParseCheckJson) {
        const acceptedTags = pendingOnlyForAcceptedSaveTags(result.stdout, acceptedPendingTags);
        if (acceptedTags.length > 0) {
            core.info(`Accepted pending save verification for tags: ${acceptedTags.join(', ')}`);
            return { ...result, exitCode: 0 };
        }
    }
    return result;
}
async function runBoringcacheCheckWithTimeout(args, timeoutSeconds, env) {
    const timeoutMs = Math.max(1, timeoutSeconds) * 1000;
    const outputLimit = 1024 * 1024;
    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        let settled = false;
        let timedOut = false;
        let killTimer;
        let timeoutTimer;
        const finish = (result) => {
            if (settled) {
                return;
            }
            settled = true;
            if (timeoutTimer) {
                timers.clearTimeout(timeoutTimer);
            }
            if (killTimer) {
                timers.clearTimeout(killTimer);
            }
            resolve({
                ...result,
                stdout: result.stdout.trim(),
                stderr: result.stderr.trim(),
            });
        };
        const appendOutput = (current, data) => {
            const next = current + data.toString();
            if (next.length <= outputLimit) {
                return next;
            }
            return next.slice(next.length - outputLimit);
        };
        let child;
        try {
            child = childProcess.spawn('boringcache', args, {
                env: env || process.env,
                windowsHide: true,
            });
        }
        catch (error) {
            finish({
                exitCode: 1,
                stdout,
                stderr: appendOutput(stderr, Buffer.from(`${errorMessage(error)}\n`)),
            });
            return;
        }
        timeoutTimer = timers.setTimeout(() => {
            timedOut = true;
            stderr = appendOutput(stderr, Buffer.from(`boringcache check timed out after ${timeoutSeconds}s\n`));
            killTimer = timers.setTimeout(() => {
                child.kill('SIGKILL');
            }, 2000);
            child.kill('SIGTERM');
        }, timeoutMs);
        child.stdout?.on('data', (data) => {
            stdout = appendOutput(stdout, data);
        });
        child.stderr?.on('data', (data) => {
            stderr = appendOutput(stderr, data);
        });
        child.on('error', (error) => {
            finish({
                exitCode: 1,
                stdout,
                stderr: appendOutput(stderr, Buffer.from(`${error.message}\n`)),
            });
        });
        child.on('close', (code, signal) => {
            if (timedOut) {
                finish({
                    exitCode: 124,
                    stdout,
                    stderr,
                    timedOut: true,
                });
                return;
            }
            finish({
                exitCode: code ?? (signal ? 1 : 0),
                stdout,
                stderr,
            });
        });
    });
}
function boundedCheckAttemptTimeoutSeconds(timeoutSeconds, deadline) {
    const remainingSeconds = deadline
        ? Math.max(1, Math.ceil((deadline - Date.now()) / 1000))
        : Math.max(1, timeoutSeconds);
    return Math.min(remainingSeconds, timeoutSeconds, MAX_VERIFY_CHECK_ATTEMPT_SECONDS);
}
function formatCheckFailure(result) {
    const details = [result.stderr, result.stdout].filter(Boolean).join('\n');
    return details || `boringcache check exited with code ${result.exitCode}`;
}
function pendingOnlyForAcceptedSaveTags(stdout, acceptedPendingTags) {
    if (!stdout.trim()) {
        return [];
    }
    let parsed;
    try {
        parsed = JSON.parse(stdout);
    }
    catch {
        return [];
    }
    if (!Array.isArray(parsed.results)) {
        return [];
    }
    const accepted = [];
    for (const result of parsed.results) {
        const status = (result.status || '').toLowerCase();
        if (status === 'hit') {
            continue;
        }
        const candidateTags = [result.requested_tag, result.tag].filter((tag) => Boolean(tag));
        const acceptedTag = candidateTags.find((tag) => acceptedPendingTags.has(tag));
        if ((status === 'pending' || status === 'uploading') && acceptedTag) {
            accepted.push(acceptedTag);
            continue;
        }
        return [];
    }
    return accepted;
}
export async function verifyResolvedTags(workspace, exactTags, options) {
    const specs = exactTags.map((tag) => ({
        tag,
        noPlatform: true,
        noGit: true,
    }));
    return verifyVerificationSpecs(workspace, specs, options);
}
export async function verifyVerificationSpecs(workspace, specs, options) {
    const batches = groupVerificationSpecs(specs);
    if (options.mode === 'none' || batches.length === 0) {
        return;
    }
    if (options.mode === 'check') {
        for (const batch of batches) {
            const result = await runTagCheck(workspace, batch, options, boundedCheckAttemptTimeoutSeconds(options.timeoutSeconds));
            if (result.exitCode !== 0) {
                throw new Error(`Verification failed for tags ${batch.tags.join(', ')}: ${formatCheckFailure(result)}`);
            }
        }
        const total = batches.reduce((sum, batch) => sum + batch.tags.length, 0);
        core.info(`Verified ${total} tag${total === 1 ? '' : 's'} in ${workspace}`);
        return;
    }
    const warnOnly = options.mode === 'warn';
    const deadline = Date.now() + options.timeoutSeconds * 1000;
    let attempt = 0;
    let lastFailure = '';
    const total = batches.reduce((sum, batch) => sum + batch.tags.length, 0);
    while (Date.now() < deadline) {
        attempt += 1;
        let pendingBatch = null;
        for (const batch of batches) {
            const result = await runTagCheck(workspace, batch, options, boundedCheckAttemptTimeoutSeconds(options.timeoutSeconds, deadline));
            if (result.exitCode !== 0) {
                pendingBatch = batch;
                lastFailure = formatCheckFailure(result);
                break;
            }
        }
        if (!pendingBatch) {
            core.info(`Verified ${total} tag${total === 1 ? '' : 's'} in ${workspace} after ${attempt} attempt${attempt === 1 ? '' : 's'}`);
            return;
        }
        core.info(`Waiting for tags to become visible (${attempt}): ${pendingBatch.tags.join(', ')}`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    const failureMessage = `Timed out waiting ${options.timeoutSeconds}s for ${total} tag${total === 1 ? '' : 's'} in ${workspace}: ${lastFailure}`;
    if (warnOnly) {
        core.warning(failureMessage);
        return;
    }
    throw new Error(failureMessage);
}
export function parseToolSpecs(input) {
    return input
        .split(/\r?\n|,/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
        const atIndex = entry.lastIndexOf('@');
        if (atIndex <= 0 || atIndex === entry.length - 1) {
            throw new Error(`Invalid tool spec "${entry}". Expected format tool@version.`);
        }
        const name = normalizeToolName(entry.slice(0, atIndex));
        const version = entry.slice(atIndex + 1).trim();
        return {
            name,
            version,
            label: TOOL_LABELS[name] || name,
            source: 'input',
        };
    });
}
export async function resolveRuntimeTools(setup, mode, toolsInput, workingDirectory) {
    if (setup !== 'mise') {
        return [];
    }
    const explicitTools = parseToolSpecs(toolsInput);
    const projectTools = await detectProjectTools(workingDirectory);
    const modeTools = await detectModeTools(mode, workingDirectory);
    return mergeTools(explicitTools, projectTools, modeTools);
}
async function detectProjectTools(workingDirectory) {
    const tools = new Map();
    for (const tool of await readProjectMiseTools(workingDirectory)) {
        const normalizedName = normalizeToolName(tool.name);
        tools.set(normalizedName, {
            name: normalizedName,
            version: tool.version,
            label: TOOL_LABELS[normalizedName] || tool.name,
            source: 'project',
        });
    }
    const detectedTools = await Promise.all([
        detectToolFromProjectFiles(workingDirectory, 'ruby', detectRubyVersion),
        detectToolFromProjectFiles(workingDirectory, 'node', detectNodeVersion),
        detectToolFromProjectFiles(workingDirectory, 'python', detectPythonVersion),
        detectToolFromProjectFiles(workingDirectory, 'go', detectGoVersion),
        detectToolFromProjectFiles(workingDirectory, 'java', detectJavaVersion),
        detectToolFromProjectFiles(workingDirectory, 'maven', detectMavenVersion),
        detectToolFromProjectFiles(workingDirectory, 'bazel', detectBazelVersion),
        detectToolFromProjectFiles(workingDirectory, 'rust', detectRustVersion),
    ]);
    for (const tool of detectedTools) {
        if (tool && !tools.has(tool.name)) {
            tools.set(tool.name, tool);
        }
    }
    const packageManagerTool = await detectNodePackageManagerTool(workingDirectory);
    if (packageManagerTool && !tools.has(packageManagerTool.name)) {
        tools.set(packageManagerTool.name, packageManagerTool);
    }
    return Array.from(tools.values());
}
async function detectModeTools(mode, workingDirectory) {
    switch (mode) {
        case 'turbo':
        case 'nx':
            return detectNodeTurboTools(workingDirectory);
        case 'bazel':
            return detectBazelTools(workingDirectory);
        case 'go':
            return detectGoTools(workingDirectory);
        case 'gradle':
            return detectGradleTools(workingDirectory);
        case 'maven':
            return detectMavenTools(workingDirectory);
        case 'ccache':
            return [];
        case 'sccache':
            return detectRustTools(workingDirectory);
        default:
            return [];
    }
}
async function detectNodeTools(workingDirectory) {
    const tools = [];
    const nodeVersion = await detectNodeVersion(workingDirectory);
    if (nodeVersion) {
        tools.push({ name: 'node', version: nodeVersion, label: 'Node.js', source: 'mode' });
    }
    const packageManagerTool = await detectNodePackageManagerTool(workingDirectory, 'mode');
    if (packageManagerTool) {
        tools.push(packageManagerTool);
    }
    return tools;
}
async function detectNodeTurboTools(workingDirectory) {
    return detectNodeTools(workingDirectory);
}
async function detectGoTools(workingDirectory) {
    const goVersion = await detectGoVersion(workingDirectory);
    if (!goVersion) {
        return [];
    }
    return [{ name: 'go', version: goVersion, label: 'Go', source: 'mode' }];
}
async function detectBazelTools(workingDirectory) {
    const bazelVersion = await detectBazelVersion(workingDirectory);
    if (!bazelVersion) {
        return [];
    }
    return [{ name: 'bazel', version: bazelVersion, label: 'Bazel', source: 'mode' }];
}
async function detectGradleTools(workingDirectory) {
    const javaVersion = await detectJavaVersion(workingDirectory);
    if (!javaVersion) {
        return [];
    }
    return [{ name: 'java', version: javaVersion, label: 'Java', source: 'mode' }];
}
async function detectMavenTools(workingDirectory) {
    const tools = [];
    const javaVersion = await detectJavaVersion(workingDirectory);
    if (javaVersion) {
        tools.push({ name: 'java', version: javaVersion, label: 'Java', source: 'mode' });
    }
    const mavenVersion = await detectMavenVersion(workingDirectory);
    if (mavenVersion) {
        tools.push({ name: 'maven', version: mavenVersion, label: 'Maven', source: 'mode' });
    }
    return tools;
}
async function detectRustTools(workingDirectory) {
    const rustVersion = await detectRustVersion(workingDirectory);
    if (!rustVersion) {
        return [];
    }
    return [{ name: 'rust', version: rustVersion, label: 'Rust', source: 'mode' }];
}
async function detectRubyVersion(workingDirectory) {
    const rubyVersion = await readFirstLine(path.join(workingDirectory, '.ruby-version'));
    if (rubyVersion) {
        return rubyVersion;
    }
    const toolVersion = await readToolVersionsValue(workingDirectory, 'ruby');
    if (toolVersion) {
        return toolVersion;
    }
    return readMiseTomlVersion(workingDirectory, 'ruby');
}
async function detectNodeVersion(workingDirectory) {
    const nodeVersion = await readFirstLine(path.join(workingDirectory, '.node-version'));
    if (nodeVersion) {
        return nodeVersion.replace(/^v/, '');
    }
    const nvmVersion = await readFirstLine(path.join(workingDirectory, '.nvmrc'));
    if (nvmVersion) {
        return nvmVersion.replace(/^v/, '');
    }
    const toolVersion = (await readToolVersionsValue(workingDirectory, 'nodejs'))
        || (await readToolVersionsValue(workingDirectory, 'node'));
    if (toolVersion) {
        return toolVersion;
    }
    return (await readMiseTomlVersion(workingDirectory, 'node'))
        || (await readMiseTomlVersion(workingDirectory, 'nodejs'));
}
async function detectBazelVersion(workingDirectory) {
    const bazelVersion = await readFirstLine(path.join(workingDirectory, '.bazelversion'));
    if (bazelVersion) {
        return bazelVersion;
    }
    const toolVersion = await readToolVersionsValue(workingDirectory, 'bazel');
    if (toolVersion) {
        return toolVersion;
    }
    return readMiseTomlVersion(workingDirectory, 'bazel');
}
async function detectPythonVersion(workingDirectory) {
    const pythonVersion = await readFirstLine(path.join(workingDirectory, '.python-version'));
    if (pythonVersion) {
        return pythonVersion;
    }
    const toolVersion = await readToolVersionsValue(workingDirectory, 'python');
    if (toolVersion) {
        return toolVersion;
    }
    return readMiseTomlVersion(workingDirectory, 'python');
}
async function detectGoVersion(workingDirectory) {
    const goVersion = await readFirstLine(path.join(workingDirectory, '.go-version'));
    if (goVersion) {
        return goVersion;
    }
    const toolVersion = (await readToolVersionsValue(workingDirectory, 'go'))
        || (await readToolVersionsValue(workingDirectory, 'golang'));
    if (toolVersion) {
        return toolVersion;
    }
    return (await readMiseTomlVersion(workingDirectory, 'go'))
        || (await readMiseTomlVersion(workingDirectory, 'golang'));
}
async function detectJavaVersion(workingDirectory) {
    const javaVersion = await readFirstLine(path.join(workingDirectory, '.java-version'));
    if (javaVersion) {
        return javaVersion;
    }
    const toolVersion = await readToolVersionsValue(workingDirectory, 'java');
    if (toolVersion) {
        return toolVersion;
    }
    const miseVersion = await readMiseTomlVersion(workingDirectory, 'java');
    if (miseVersion) {
        return miseVersion;
    }
    const pomXml = await readFile(path.join(workingDirectory, 'pom.xml'));
    if (pomXml) {
        const pomMatch = pomXml.match(/<maven\.compiler\.(?:release|source|target)>\s*([^<\s]+)\s*<\/maven\.compiler\.(?:release|source|target)>/)
            || pomXml.match(/<java\.version>\s*([^<\s]+)\s*<\/java\.version>/);
        if (pomMatch?.[1]) {
            return pomMatch[1].trim();
        }
    }
    return null;
}
async function detectMavenVersion(workingDirectory) {
    const wrapperProps = await readFile(path.join(workingDirectory, '.mvn', 'wrapper', 'maven-wrapper.properties'));
    if (wrapperProps) {
        const match = wrapperProps.match(/apache-maven-([0-9]+(?:\.[0-9]+)*)-bin/i);
        if (match?.[1]) {
            return match[1];
        }
    }
    const toolVersion = await readToolVersionsValue(workingDirectory, 'maven');
    if (toolVersion) {
        return toolVersion;
    }
    return readMiseTomlVersion(workingDirectory, 'maven');
}
async function detectRustVersion(workingDirectory) {
    const rustToolchainToml = await readFile(path.join(workingDirectory, 'rust-toolchain.toml'));
    if (rustToolchainToml) {
        const match = rustToolchainToml.match(/channel\s*=\s*["']([^"']+)["']/);
        if (match?.[1]) {
            return match[1];
        }
    }
    const rustToolchain = await readFirstLine(path.join(workingDirectory, 'rust-toolchain'));
    if (rustToolchain) {
        return rustToolchain;
    }
    const toolVersion = await readToolVersionsValue(workingDirectory, 'rust');
    if (toolVersion) {
        return toolVersion;
    }
    return readMiseTomlVersion(workingDirectory, 'rust');
}
async function detectToolFromProjectFiles(workingDirectory, toolName, detector) {
    const version = await detector(workingDirectory);
    if (!version) {
        return null;
    }
    return {
        name: normalizeToolName(toolName),
        version,
        label: TOOL_LABELS[normalizeToolName(toolName)] || toolName,
        source: 'project',
    };
}
async function readFirstLine(filePath) {
    try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const line = content.split('\n').map((value) => value.trim()).find(Boolean);
        return line || null;
    }
    catch {
        return null;
    }
}
async function readFile(filePath) {
    try {
        return await fs.promises.readFile(filePath, 'utf-8');
    }
    catch {
        return null;
    }
}
async function readPackageJson(workingDirectory) {
    const packageJson = await readFile(path.join(workingDirectory, 'package.json'));
    if (!packageJson) {
        return null;
    }
    try {
        return JSON.parse(packageJson);
    }
    catch {
        return null;
    }
}
function normalizePackageManagerName(name) {
    const normalized = name.trim().toLowerCase();
    if (normalized === 'npm' || normalized === 'pnpm' || normalized === 'yarn') {
        return normalized;
    }
    return null;
}
function packageManagerCacheDir(workingDirectory, name) {
    switch (name) {
        case 'pnpm':
            return path.join(workingDirectory, '.pnpm-store');
        case 'yarn':
            return path.join(workingDirectory, '.yarn-cache');
        case 'npm':
            return path.join(workingDirectory, '.npm-cache');
    }
}
export async function detectNodePackageManager(workingDirectory) {
    const packageJson = await readPackageJson(workingDirectory);
    const packageManagerField = typeof packageJson?.packageManager === 'string'
        ? packageJson.packageManager.trim()
        : '';
    let name = null;
    let version = null;
    if (packageManagerField) {
        const atIndex = packageManagerField.lastIndexOf('@');
        if (atIndex > 0) {
            name = normalizePackageManagerName(packageManagerField.slice(0, atIndex));
            version = packageManagerField.slice(atIndex + 1).trim().split('+')[0] || null;
        }
    }
    if (!name) {
        if (await pathExists(path.join(workingDirectory, 'pnpm-lock.yaml'))) {
            name = 'pnpm';
        }
        else if (await pathExists(path.join(workingDirectory, 'yarn.lock'))) {
            name = 'yarn';
        }
        else if (await pathExists(path.join(workingDirectory, 'package-lock.json'))
            || await pathExists(path.join(workingDirectory, 'npm-shrinkwrap.json'))) {
            name = 'npm';
        }
        else if (packageJson) {
            name = 'npm';
        }
    }
    if (!name) {
        return null;
    }
    return {
        name,
        version,
        packageManagerField: packageManagerField || null,
        cacheDir: packageManagerCacheDir(workingDirectory, name),
        nodeModulesDir: path.join(workingDirectory, 'node_modules'),
    };
}
async function detectNodePackageManagerTool(workingDirectory, source = 'project') {
    const packageManager = await detectNodePackageManager(workingDirectory);
    if (!packageManager?.version) {
        return null;
    }
    return {
        name: packageManager.name,
        version: packageManager.version,
        label: TOOL_LABELS[packageManager.name] || packageManager.name,
        source,
    };
}
async function pathExists(filePath) {
    try {
        await fs.promises.access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
function mergeTools(...toolSets) {
    const merged = new Map();
    for (const toolSet of toolSets) {
        for (const tool of toolSet) {
            if (tool.source === 'input' || !merged.has(tool.name)) {
                merged.set(tool.name, tool);
            }
        }
    }
    return Array.from(merged.values());
}
function normalizeToolName(name) {
    const normalized = name.trim().toLowerCase();
    if (normalized === 'nodejs') {
        return 'node';
    }
    if (normalized === 'golang') {
        return 'go';
    }
    return normalized;
}
function splitEntriesInput(entries) {
    const values = [];
    let current = '';
    for (let index = 0; index < entries.length; index += 1) {
        const character = entries[index];
        if (character === '\\' && entries[index + 1] === ',') {
            current += ',';
            index += 1;
        }
        else if (character === ',' || character === '\n') {
            values.push(current);
            current = '';
        }
        else if (character !== '\r') {
            current += character;
        }
    }
    values.push(current);
    return values.filter((entry) => entry.trim());
}
function parseCliVersion(version) {
    const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
    if (!match) {
        return null;
    }
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}
export async function resolveCliCapabilityVersion(version) {
    const requestedVersion = version.trim();
    if (requestedVersion.toLowerCase() === 'skip' || parseCliVersion(requestedVersion)) {
        return requestedVersion;
    }
    let stdout = '';
    let stderr = '';
    const exitCode = await execBoringCache(['--version'], {
        ignoreReturnCode: true,
        silent: true,
        listeners: {
            stdout: (data) => {
                stdout += data.toString();
            },
            stderr: (data) => {
                stderr += data.toString();
            },
        },
    });
    const output = `${stdout}\n${stderr}`;
    const match = output.match(/\bboringcache\s+v?(\d+\.\d+\.\d+(?:[-+][^\s]+)?)/i);
    if (exitCode !== 0 || !match) {
        throw new Error(`Unable to determine installed BoringCache CLI capabilities for cli-version '${requestedVersion || '(empty)'}'. `
            + `Expected 'boringcache --version' to report a semantic version, but it exited ${exitCode}`
            + `${output.trim() ? `: ${output.trim()}` : '.'}`);
    }
    return match[1];
}
function appendCliPublicationPolicy(args, readOnly) {
    args.push(readOnly ? '--read-only' : '--write');
}
async function runDryRunPlan(workingDirectory, options) {
    const { profileNames = [], readOnly = false, noGit = false, } = options;
    const executePlan = async () => {
        const args = ['run'];
        for (const profileName of profileNames) {
            args.push('--profile', profileName);
        }
        if (noGit) {
            args.push('--no-git');
        }
        appendCliPublicationPolicy(args, readOnly);
        args.push('--dry-run', '--json');
        let stdout = '';
        let stderr = '';
        const exitCode = await exec.exec('boringcache', args, {
            cwd: workingDirectory,
            ignoreReturnCode: true,
            silent: true,
            listeners: {
                stdout: (data) => {
                    stdout += data.toString();
                },
                stderr: (data) => {
                    stderr += data.toString();
                },
            },
        });
        if (exitCode !== 0) {
            throw new Error(stderr.trim() || stdout.trim() || `boringcache run --dry-run --json exited with code ${exitCode}`);
        }
        try {
            return JSON.parse(stdout);
        }
        catch (error) {
            throw new Error(`Failed to parse boringcache dry-run JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
    };
    return executePlan();
}
async function maybeResolveWorkspaceViaCli(workingDirectory, readOnly) {
    const plan = await runDryRunPlan(workingDirectory, {
        readOnly,
    });
    return plan.workspace?.trim() || null;
}
export async function buildArchiveEntries(inputs) {
    const cacheProfiles = splitEntriesInput(inputs.cacheProfiles).map((entry) => entry.trim());
    if (cacheProfiles.length === 0) {
        return {
            entries: '',
            envVars: {},
        };
    }
    const plan = await runDryRunPlan(inputs.workingDirectory, {
        profileNames: cacheProfiles,
        readOnly: inputs.readOnly,
        noGit: inputs.stage,
    });
    const firstEntry = plan.archive_entries?.[0];
    const firstPair = plan.tag_path_pairs[0];
    const cacheTagPrefix = firstEntry?.resolved_tag || firstEntry?.tag
        || (firstPair ? parseEntries(firstPair, 'restore', { separatorMode: 'single' })[0]?.tag : undefined);
    return {
        entries: plan.tag_path_pairs.join('\n'),
        envVars: plan.env_vars,
        cacheTagPrefix,
        workspace: plan.workspace,
    };
}
export function validateOneInputs(inputs, modeSpec, archiveEntries) {
    if (inputs.setup !== 'mise' && inputs.tools.trim()) {
        core.warning(`Ignoring tools because setup=${inputs.setup}`);
    }
    if (modeSpec.resolved === 'archive' && !archiveEntries) {
        throw new Error('Archive mode requires cache-profiles from the committed .boringcache.toml plan.');
    }
}
export async function buildPlan(inputs) {
    const modeSpec = resolveModeSpec(inputs.mode);
    assertImplementedMode(modeSpec);
    const resolvedMavenVersion = inputs.mavenVersion || '3.9.9';
    const runtimeTools = await resolveRuntimeTools(inputs.setup, inputs.mode, inputs.tools, inputs.workingDirectory);
    if (inputs.setup === 'mise'
        && modeSpec.resolved === 'maven'
        && resolvedMavenVersion
        && !runtimeTools.some((tool) => tool.name === 'maven')) {
        runtimeTools.push({
            name: 'maven',
            version: resolvedMavenVersion,
            label: 'Maven',
            source: 'mode',
        });
    }
    const archiveEntries = await buildArchiveEntries(inputs);
    const workspace = archiveEntries.workspace
        || await maybeResolveWorkspaceViaCli(inputs.workingDirectory, inputs.readOnly);
    if (!workspace) {
        throw new Error('The BoringCache CLI plan did not resolve a workspace. Set workspace in .boringcache.toml.');
    }
    const cacheTagPrefix = getCacheTagPrefix(archiveEntries.cacheTagPrefix);
    validateOneInputs(inputs, modeSpec, archiveEntries.entries);
    return {
        workspace,
        workingDirectory: inputs.workingDirectory,
        setup: inputs.setup,
        mode: modeSpec.resolved,
        modeSpec,
        cacheTagPrefix,
        runtimeTools,
        envVars: archiveEntries.envVars,
        archiveEntries: archiveEntries.entries,
    };
}
export function getCacheTagPrefix(resolvedArchivePrefix) {
    if (resolvedArchivePrefix?.trim()) {
        return resolvedArchivePrefix.trim();
    }
    return 'one';
}
export function buildFlagArgs(inputs) {
    const flagArgs = [];
    if (inputs.failOnCacheMiss) {
        flagArgs.push('--fail-on-cache-miss');
    }
    if (inputs.failOnCacheError) {
        flagArgs.push('--fail-on-cache-error');
    }
    if (inputs.lookupOnly) {
        flagArgs.push('--lookup-only');
    }
    if (inputs.verbose) {
        flagArgs.push('--verbose');
    }
    return flagArgs;
}
export async function applyMiseSetup(runtimeTools, cwd) {
    if (runtimeTools.length === 0) {
        return false;
    }
    const pathAvailable = new Map();
    for (const tool of runtimeTools) {
        const available = await hasToolVersionOnPath(tool.name, tool.version);
        pathAvailable.set(`${tool.name}@${tool.version}`, available);
        if (available) {
            core.info(`Using existing ${tool.label} ${tool.version} from PATH`);
        }
    }
    const unresolvedTools = runtimeTools.filter((tool) => !pathAvailable.get(`${tool.name}@${tool.version}`));
    if (unresolvedTools.length === 0) {
        return false;
    }
    await installMise();
    for (const tool of unresolvedTools) {
        if (await hasMiseToolVersion(tool.name, tool.version)) {
            await activateMiseTool(tool.name, tool.version, { label: tool.label });
        }
        else {
            await installMiseTool(tool.name, tool.version, { label: tool.label });
        }
    }
    await reshimMise();
    await exportMiseEnv(cwd);
    return true;
}
export async function applyCliPlanEnv(plan) {
    for (const [key, value] of Object.entries(plan.envVars)) {
        core.exportVariable(key, value);
    }
}
export function serializeTools(runtimeTools) {
    return runtimeTools.map((tool) => `${tool.name}@${tool.version}`).join('\n');
}
