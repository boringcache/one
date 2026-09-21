import * as core from '@actions/core';
let recordedObservation = null;
export function recordCompilerCacheObservation(observation) {
    recordedObservation = observation;
}
export function compilerCacheObservation() {
    return recordedObservation;
}
export function resetCompilerCacheObservation() {
    recordedObservation = null;
}
export function compilerCacheHitRate(observation) {
    const hits = observation.cache_hits;
    const misses = observation.cache_misses;
    if (hits === null || misses === null) {
        return null;
    }
    const lookups = hits + misses;
    return lookups > 0 ? hits / lookups : null;
}
function formatPercentage(rate) {
    const percentage = rate * 100;
    return Number.isInteger(percentage)
        ? `${percentage}%`
        : `${percentage.toFixed(2)}%`;
}
function nativeResultLine(observation) {
    if (observation.status === 'unavailable') {
        const reason = observation.unavailable_reason === 'daemon_unreachable'
            ? 'its daemon was no longer reachable when the post step read them'
            : observation.unavailable_reason === 'stats_command_failed'
                ? 'the statistics command failed'
                : 'the statistics could not be read';
        return `**${observation.tool}:** statistics unavailable — ${reason}.`;
    }
    const hits = observation.cache_hits;
    const misses = observation.cache_misses;
    if (hits === null || misses === null) {
        return `**${observation.tool}:** statistics unavailable — the native counters were not reported.`;
    }
    if (hits + misses === 0) {
        return `**${observation.tool}:** no cache lookups.`;
    }
    const rate = compilerCacheHitRate(observation);
    const rateText = rate === null ? '' : ` — ${formatPercentage(rate)} hit rate`;
    return `**${observation.tool}:** ${hits} hits, ${misses} misses${rateText}.`;
}
function nativeDetailLine(observation) {
    if (observation.status === 'unavailable') {
        return '';
    }
    const parts = [];
    if (observation.compile_requests !== null) {
        const executed = observation.compile_requests_executed !== null
            ? `; ${observation.compile_requests_executed} executed`
            : '';
        parts.push(`${observation.compile_requests} compile requests${executed}.`);
    }
    const errors = [];
    if (observation.cache_errors !== null) {
        errors.push(`errors: ${observation.cache_errors}`);
    }
    if (observation.cache_read_errors !== null) {
        errors.push(`read errors: ${observation.cache_read_errors}`);
    }
    if (observation.cache_write_errors !== null) {
        errors.push(`write errors: ${observation.cache_write_errors}`);
    }
    if (observation.cache_timeouts !== null) {
        errors.push(`timeouts: ${observation.cache_timeouts}`);
    }
    if (errors.length > 0) {
        const sentence = errors.join('; ');
        parts.push(`${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`);
    }
    if (observation.remote_storage_hits !== null && observation.remote_storage_hits !== undefined) {
        parts.push(`Remote storage: ${observation.remote_storage_hits} hits, ${observation.remote_storage_misses ?? 0} misses.`);
    }
    return parts.join(' ');
}
export function renderCompilerCacheSummary(observation, publication) {
    const lines = ['### BoringCache cache results', ''];
    if (observation) {
        lines.push(nativeResultLine(observation));
        const detail = nativeDetailLine(observation);
        if (detail) {
            lines.push('', detail);
        }
        lines.push('');
    }
    lines.push(`**Publication:** ${publication.headline} — ${publication.detail}`);
    return `${lines.join('\n')}\n`;
}
export async function writeCompilerCacheJobSummary(observation, publication) {
    if (!observation) {
        return;
    }
    if (!(process.env.GITHUB_STEP_SUMMARY || '').trim()) {
        return;
    }
    try {
        await core.summary.addRaw(renderCompilerCacheSummary(observation, publication)).write();
    }
    catch (error) {
        core.debug(`Could not write the BoringCache job summary: ${error instanceof Error ? error.message : String(error)}`);
    }
}
