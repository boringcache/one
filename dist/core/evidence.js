import * as core from '@actions/core';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { redactEvidenceText } from './redaction';
let processEvidenceId;
export function restorePhaseSummary(options) {
    if (options.cacheHit === undefined) {
        return {
            status: 'cache_result_not_evaluated',
            headline: 'Cache setup completed',
            detail: 'This setup step prepared BoringCache but did not measure reuse by the wrapped build.',
            next_step: 'Use the build cache imports, cached steps, and transfer evidence to judge reuse.',
        };
    }
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
            detail: `${hitDetail} This run is restore-only: ${options.trustState.detail}`,
            next_step: options.trustState.next_step,
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
        detail: `BoringCache did not restore a matching cache, and this run is restore-only: ${options.trustState.detail}`,
        next_step: options.trustState.next_step,
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
                detail: `BoringCache did not publish cache changes: ${trustState.detail}`,
                next_step: trustState.next_step,
            };
        case 'skipped_missing_token':
        case 'mode_post_missing_token':
            return {
                status: 'skipped_missing_token',
                headline: 'Publication skipped: missing token capability',
                detail: `BoringCache could not apply trust-policy ${trustState.requested_policy}: ${trustState.detail}`,
                next_step: trustState.next_step,
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
export function actionEvidenceProductRefs(cliVersion) {
    const productRefs = {
        schema_version: 1,
        cli_version: cliVersion.trim(),
    };
    const actionRepository = (process.env.GITHUB_ACTION_REPOSITORY || '').trim();
    const actionRef = (process.env.GITHUB_ACTION_REF || '').trim();
    if (actionRef) {
        const actionSha = /^[0-9a-f]{40}$/i.test(actionRef) ? actionRef.toLowerCase() : undefined;
        const recordedActionRef = actionSha || actionRef;
        productRefs.action_ref = actionRepository ? `${actionRepository}@${recordedActionRef}` : recordedActionRef;
        if (actionSha) {
            productRefs.action_sha = actionSha;
        }
    }
    return productRefs;
}
export function writeActionEvidence(phase, payload, productRefs) {
    const evidencePath = actionEvidencePath();
    const current = readActionEvidence(evidencePath);
    const now = new Date().toISOString();
    const evidence = {
        schema_version: 'boringcache_one_evidence.v1',
        generated_at: current.generated_at || now,
        updated_at: now,
        product_refs: productRefs || current.product_refs,
        phases: sanitizeEvidencePhases({
            ...current.phases,
            [phase]: payload,
        }),
    };
    try {
        fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
        core.setOutput('evidence-path', evidencePath);
        core.saveState('evidence-id', currentEvidenceId());
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
// Each Action invocation owns one opaque evidence id. GitHub runs the main and
// post entrypoints in separate processes, so only the id crosses that boundary.
// Hashing it into a basename keeps state and environment values out of filesystem
// path expressions while still letting post reopen the main process's envelope.
function currentEvidenceId() {
    const savedEvidenceId = (core.getState('evidence-id') || '').trim();
    if (savedEvidenceId) {
        return savedEvidenceId;
    }
    if (processEvidenceId) {
        return processEvidenceId;
    }
    processEvidenceId = crypto.randomUUID();
    return processEvidenceId;
}
function actionEvidencePath() {
    const digest = crypto.createHash('sha256').update(currentEvidenceId()).digest('hex');
    const basename = path.basename(`boringcache-one-evidence-${digest}.json`);
    return path.join(os.tmpdir(), basename);
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
export function errorMessage(error) {
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
