import { hasRestoreToken, hasSaveToken, hasStageToken } from './auth';
const TRUST_POLICIES = ['auto', 'restore', 'stage', 'publish'];
const RESTORE_TOKEN_ENV = 'BORINGCACHE_RESTORE_TOKEN';
const STAGE_TOKEN_ENV = 'BORINGCACHE_STAGE_TOKEN';
const SAVE_TOKEN_ENV = 'BORINGCACHE_SAVE_TOKEN';
const ADMIN_TOKEN_ENV = 'BORINGCACHE_ADMIN_TOKEN';
const RETIRED_TOKEN_ENV = ['BORINGCACHE_API_TOKEN', 'BORINGCACHE_TOKEN'];
const RETIRED_AMBIENT_ENV = ['BORINGCACHE_SAVE_ON_PULL_REQUEST', 'BORINGCACHE_RESTORE_PR_CACHE'];
const PULL_REQUEST_EVENTS = new Set(['pull_request', 'pull_request_target']);
const TRUST_STATUSES = [
    'publish',
    'stage',
    'restore_only',
    'restore_only_by_event_policy',
    'restore_only_missing_stage_token',
    'restore_only_missing_save_token',
];
const TRUST_REASONS = [
    'explicit_request',
    'trusted_event',
    'untrusted_change',
    'missing_stage_token',
    'missing_save_token',
];
const RESOLVED_POLICIES = ['restore', 'stage', 'publish'];
const PROMOTABLE_TOKEN_ENV = new Set([RESTORE_TOKEN_ENV, STAGE_TOKEN_ENV, SAVE_TOKEN_ENV]);
const REVOCABLE_ENV = new Set([
    ...RETIRED_AMBIENT_ENV,
    STAGE_TOKEN_ENV,
    SAVE_TOKEN_ENV,
    ADMIN_TOKEN_ENV,
    ...RETIRED_TOKEN_ENV,
]);
const RESTORE_ONLY_REVOKE_ENV = new Set([
    ...RETIRED_AMBIENT_ENV,
    STAGE_TOKEN_ENV,
    SAVE_TOKEN_ENV,
    ADMIN_TOKEN_ENV,
    ...RETIRED_TOKEN_ENV,
]);
const WRITE_REVOKE_ENV = new Set([
    ...RETIRED_AMBIENT_ENV,
    ADMIN_TOKEN_ENV,
    ...RETIRED_TOKEN_ENV,
]);
export function normalizeTrustPolicy(value) {
    const normalized = (value || 'auto').trim().toLowerCase();
    if (!TRUST_POLICIES.includes(normalized)) {
        throw new Error(`Unsupported trust-policy "${value}". Expected auto, restore, stage, or publish.`);
    }
    return normalized;
}
export function isPullRequestEvent() {
    return PULL_REQUEST_EVENTS.has((process.env.GITHUB_EVENT_NAME || '').trim().toLowerCase());
}
export async function resolveTrustDecision(requested, runCli) {
    const decision = await requestCliTrustDecision(requested, runCli);
    return decision ?? compatibilityTrustDecision(requested);
}
export function applyTrustEnvPolicy(decision) {
    const { env_policy: policy } = decision;
    if (!decision.write_allowed) {
        const promoted = policy.promote_restore_token_from
            .map((name) => process.env[name])
            .find((value) => Boolean(value));
        if (promoted) {
            process.env[policy.restore_token_env] = promoted;
        }
    }
    for (const name of policy.revoke) {
        delete process.env[name];
    }
}
export function buildActionTrustState(decision) {
    return {
        status: decision.status,
        event_name: (process.env.GITHUB_EVENT_NAME || '').trim(),
        requested_policy: decision.requested,
        resolved_policy: decision.resolved,
        write_allowed: decision.write_allowed,
        decision_source: decision.source,
        reason: decision.reason,
        provider: decision.context.provider,
        detail: decision.detail,
        next_step: decision.next_step,
        token_capabilities: decision.token_capabilities,
    };
}
export function parseSavedTrustDecision(raw, requested) {
    let value;
    try {
        value = JSON.parse(raw);
    }
    catch (error) {
        throw new Error(`Saved CLI trust decision is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    return validateTrustDecision(value, requested);
}
async function requestCliTrustDecision(requested, runCli) {
    let stdout = '';
    let stderr = '';
    let exitCode;
    try {
        exitCode = await runCli(['ci', 'trust', '--request', requested, '--json'], {
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
    }
    catch (error) {
        throw new Error(`Unable to execute the CLI trust resolver: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (unsupportedTrustCommand(exitCode, stderr)) {
        return null;
    }
    if (exitCode !== 0) {
        throw new Error(`The CLI trust resolver failed with exit code ${exitCode}${stderr.trim() ? `: ${stderr.trim()}` : '.'}`);
    }
    if (!stdout.trim()) {
        throw new Error('The CLI trust resolver returned no decision.');
    }
    try {
        return validateTrustDecision(JSON.parse(stdout), requested, 'cli');
    }
    catch (error) {
        throw new Error(`The CLI trust resolver returned an invalid decision: ${error instanceof Error ? error.message : String(error)}`);
    }
}
function unsupportedTrustCommand(exitCode, stderr) {
    return exitCode === 2
        && /unrecognized subcommand\s+['"`](?:ci|trust)['"`]/i.test(stderr);
}
function validateTrustDecision(value, requested, forcedSource) {
    const decision = record(value, 'trust decision');
    const schemaVersion = numberField(decision, 'schema_version');
    if (schemaVersion !== 1) {
        throw new Error(`Unsupported trust decision schema_version ${schemaVersion}; expected 1`);
    }
    const actualRequested = enumField(decision, 'requested', TRUST_POLICIES);
    if (actualRequested !== requested) {
        throw new Error(`Trust decision requested ${actualRequested}, but the Action requested ${requested}`);
    }
    const resolved = enumField(decision, 'resolved', RESOLVED_POLICIES);
    const status = enumField(decision, 'status', TRUST_STATUSES);
    const reason = enumField(decision, 'reason', TRUST_REASONS);
    const writeAllowed = booleanField(decision, 'write_allowed');
    if (writeAllowed !== (resolved !== 'restore')) {
        throw new Error(`Trust decision write_allowed contradicts resolved=${resolved}`);
    }
    if (actualRequested === 'restore' && resolved !== 'restore') {
        throw new Error('Trust decision may not turn a restore request into a write decision');
    }
    if (actualRequested === 'stage' && resolved === 'publish') {
        throw new Error('Trust decision may not turn a stage request into publication');
    }
    if (actualRequested === 'publish' && resolved === 'stage') {
        throw new Error('Trust decision may not turn a publish request into staging');
    }
    if ((resolved === 'publish' && status !== 'publish') || (resolved === 'stage' && status !== 'stage')) {
        throw new Error(`Trust decision status ${status} contradicts resolved=${resolved}`);
    }
    if (resolved === 'restore' && (status === 'publish' || status === 'stage')) {
        throw new Error(`Trust decision status ${status} contradicts resolved=restore`);
    }
    const context = record(decision.context, 'trust decision context');
    const tokenCapabilities = record(decision.token_capabilities, 'trust decision token_capabilities');
    const envPolicy = record(decision.env_policy, 'trust decision env_policy');
    const promote = stringArrayField(envPolicy, 'promote_restore_token_from');
    const revoke = stringArrayField(envPolicy, 'revoke');
    if (stringField(envPolicy, 'restore_token_env') !== RESTORE_TOKEN_ENV) {
        throw new Error(`Trust decision restore_token_env must be ${RESTORE_TOKEN_ENV}`);
    }
    if (!sameOrderedValues(promote, [...PROMOTABLE_TOKEN_ENV])) {
        throw new Error('Trust decision must use the split restore, stage, and save promotion order');
    }
    if (revoke.some((name) => !REVOCABLE_ENV.has(name)) || new Set(revoke).size !== revoke.length) {
        throw new Error('Trust decision requested an unsupported environment revocation');
    }
    const expectedRevoke = writeAllowed ? WRITE_REVOKE_ENV : RESTORE_ONLY_REVOKE_ENV;
    if (!sameValues(revoke, expectedRevoke)) {
        throw new Error(writeAllowed
            ? 'Write-capable trust decisions must revoke administrative and retired credential variables'
            : 'Restore-only trust decisions must revoke every write-capable and retired token variable');
    }
    const restoreCapability = booleanField(tokenCapabilities, 'restore');
    const stageCapability = booleanField(tokenCapabilities, 'stage');
    const saveCapability = booleanField(tokenCapabilities, 'save');
    if ((saveCapability && !stageCapability) || (stageCapability && !restoreCapability)) {
        throw new Error('Trust decision token capabilities must preserve save -> stage -> restore authority');
    }
    if ((resolved === 'stage' && !stageCapability) || (resolved === 'publish' && !saveCapability)) {
        throw new Error(`Trust decision resolved=${resolved} without the required token capability`);
    }
    const sourceValue = forcedSource || decision.source;
    if (sourceValue !== 'cli' && sourceValue !== 'action-compatibility') {
        throw new Error('Trust decision source must be cli or action-compatibility');
    }
    return {
        schema_version: schemaVersion,
        requested: actualRequested,
        resolved,
        status,
        reason,
        write_allowed: writeAllowed,
        detail: stringField(decision, 'detail'),
        next_step: stringField(decision, 'next_step'),
        context: {
            provider: stringField(context, 'provider'),
            event: stringField(context, 'event'),
            untrusted_source: booleanField(context, 'untrusted_source'),
            ...optionalStringFields(context, [
                'repository',
                'source_ref_name',
                'base_ref_name',
                'run_uid',
                'run_attempt',
            ]),
        },
        token_capabilities: {
            restore: restoreCapability,
            stage: stageCapability,
            save: saveCapability,
        },
        env_policy: {
            restore_token_env: RESTORE_TOKEN_ENV,
            promote_restore_token_from: promote,
            revoke,
        },
        source: sourceValue,
    };
}
function sameOrderedValues(actual, expected) {
    return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}
function sameValues(actual, expected) {
    return actual.length === expected.size && actual.every((value) => expected.has(value));
}
function record(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${label} must be an object`);
    }
    return value;
}
function stringField(value, name) {
    const field = value[name];
    if (typeof field !== 'string' || !field.trim()) {
        throw new Error(`Trust decision ${name} must be a non-empty string`);
    }
    return field;
}
function numberField(value, name) {
    const field = value[name];
    if (typeof field !== 'number' || !Number.isInteger(field)) {
        throw new Error(`Trust decision ${name} must be an integer`);
    }
    return field;
}
function booleanField(value, name) {
    const field = value[name];
    if (typeof field !== 'boolean') {
        throw new Error(`Trust decision ${name} must be a boolean`);
    }
    return field;
}
function stringArrayField(value, name) {
    const field = value[name];
    if (!Array.isArray(field) || field.some((entry) => typeof entry !== 'string')) {
        throw new Error(`Trust decision ${name} must be an array of strings`);
    }
    return field;
}
function enumField(value, name, allowed) {
    const field = value[name];
    if (typeof field !== 'string' || !allowed.includes(field)) {
        throw new Error(`Trust decision ${name} has unsupported value ${String(field)}`);
    }
    return field;
}
function optionalStringFields(value, names) {
    const result = {};
    for (const name of names) {
        const field = value[name];
        if (field === undefined || field === null) {
            continue;
        }
        if (typeof field !== 'string') {
            throw new Error(`Trust decision context ${name} must be a string when present`);
        }
        result[name] = field;
    }
    return result;
}
function compatibilityTrustDecision(requested) {
    const untrustedSource = isPullRequestEvent();
    const capabilities = {
        restore: hasRestoreToken(),
        stage: hasStageToken(),
        save: hasSaveToken(),
    };
    const intended = requested === 'auto' ? (untrustedSource ? 'restore' : 'publish') : requested;
    const [resolved, status, reason] = compatibilityOutcome(requested, intended, capabilities);
    return {
        schema_version: 1,
        requested,
        resolved,
        status,
        reason,
        write_allowed: resolved !== 'restore',
        detail: compatibilityDetail(status),
        next_step: compatibilityNextStep(status),
        context: {
            provider: 'github-actions',
            event: untrustedSource ? 'pull-request' : 'other',
            untrusted_source: untrustedSource,
            repository: process.env.GITHUB_REPOSITORY || undefined,
            source_ref_name: process.env.GITHUB_REF_NAME || undefined,
            base_ref_name: process.env.GITHUB_BASE_REF || undefined,
            run_uid: process.env.GITHUB_RUN_ID || undefined,
            run_attempt: process.env.GITHUB_RUN_ATTEMPT || undefined,
        },
        token_capabilities: capabilities,
        env_policy: compatibilityEnvPolicy(resolved),
        source: 'action-compatibility',
    };
}
function compatibilityOutcome(requested, intended, capabilities) {
    if (intended === 'stage' && !capabilities.stage) {
        return ['restore', 'restore_only_missing_stage_token', 'missing_stage_token'];
    }
    if (intended === 'publish' && !capabilities.save) {
        return ['restore', 'restore_only_missing_save_token', 'missing_save_token'];
    }
    if (intended === 'restore') {
        return requested === 'auto'
            ? ['restore', 'restore_only_by_event_policy', 'untrusted_change']
            : ['restore', 'restore_only', 'explicit_request'];
    }
    return [intended, intended, requested === 'auto' ? 'trusted_event' : 'explicit_request'];
}
function compatibilityEnvPolicy(resolved) {
    return {
        restore_token_env: RESTORE_TOKEN_ENV,
        promote_restore_token_from: [RESTORE_TOKEN_ENV, STAGE_TOKEN_ENV, SAVE_TOKEN_ENV],
        revoke: resolved === 'restore'
            ? [...RETIRED_AMBIENT_ENV, STAGE_TOKEN_ENV, SAVE_TOKEN_ENV, ADMIN_TOKEN_ENV, ...RETIRED_TOKEN_ENV]
            : [...RETIRED_AMBIENT_ENV, ADMIN_TOKEN_ENV, ...RETIRED_TOKEN_ENV],
    };
}
function compatibilityDetail(status) {
    switch (status) {
        case 'publish':
            return 'Publication updates the published cache tag.';
        case 'stage':
            return 'Staging creates an immutable candidate without moving the published tag.';
        case 'restore_only':
            return 'trust-policy is restore.';
        case 'restore_only_by_event_policy':
            return 'trust-policy auto resolves untrusted pull-request changes to restore.';
        case 'restore_only_missing_stage_token':
            return `No stage-capable token is available. Set ${STAGE_TOKEN_ENV} or ${SAVE_TOKEN_ENV}.`;
        case 'restore_only_missing_save_token':
            return `No save-capable token is available. Set ${SAVE_TOKEN_ENV}.`;
    }
}
function compatibilityNextStep(status) {
    switch (status) {
        case 'publish':
            return 'Let the run finish; the next matching run restores what it publishes.';
        case 'stage':
            return 'Select the exact candidate in a trusted run, or promote it explicitly.';
        case 'restore_only':
            return 'Use trust-policy stage or publish only when this job is trusted for that operation.';
        case 'restore_only_by_event_policy':
            return 'Use trust-policy stage for an immutable candidate, or publish only when this pull-request job is explicitly trusted.';
        case 'restore_only_missing_stage_token':
            return `Set ${STAGE_TOKEN_ENV} for jobs that should stage immutable candidates.`;
        case 'restore_only_missing_save_token':
            return `Set ${SAVE_TOKEN_ENV} for trusted jobs that should write cache entries.`;
    }
}
