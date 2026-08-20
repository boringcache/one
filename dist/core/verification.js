import * as core from '@actions/core';
import * as childProcess from 'child_process';
import * as timers from 'timers';
import { errorMessage } from './evidence';
import { parsePositiveIntegerInput } from './input-values';
export const DEFAULT_VERIFY_TIMEOUT_SECONDS = 180;
export const MAX_VERIFY_TIMEOUT_SECONDS = 900;
export const MAX_VERIFY_CHECK_ATTEMPT_SECONDS = 30;
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
    const batch = {
        tags: [],
        saveExpectedTags: new Set(),
    };
    for (const spec of specs) {
        if (!batch.tags.includes(spec.tag)) {
            batch.tags.push(spec.tag);
        }
        if (spec.saveExpected) {
            batch.saveExpectedTags.add(spec.tag);
        }
    }
    return batch.tags.length > 0 ? [batch] : [];
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
    // The CLI plan already resolved platform and Git scope. Verification checks
    // those exact opaque tags rather than asking the Action to plan them again.
    args.push('--no-platform', '--no-git');
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
    const specs = exactTags.map((tag) => ({ tag }));
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
