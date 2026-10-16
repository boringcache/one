import { routineInfo, verboseDiagnosticsEnabled } from './diagnostics';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
// The toolkit has no quiet option. This scope covers only internal CLI setup,
// before wrapped programs start; their streams never pass through this filter.
export async function withToolCacheOutput(operation, observe) {
    const verbose = verboseDiagnosticsEnabled();
    const filter = (stream) => {
        const originalWrite = stream.write;
        stream.write = (function (chunk, ...rest) {
            const text = typeof chunk === 'string'
                ? chunk
                : Buffer.isBuffer(chunk) ? chunk.toString('utf8') : '';
            observe?.(text);
            // Workflow commands include secret masks and runner state, not just logs.
            if (verbose || text.startsWith('::')) {
                return originalWrite.call(stream, chunk, ...rest);
            }
            const callback = rest.find(value => typeof value === 'function');
            if (callback) {
                process.nextTick(callback);
            }
            return true;
        });
        return () => { stream.write = originalWrite; };
    };
    const restoreStdout = filter(process.stdout);
    const restoreStderr = filter(process.stderr);
    try {
        return await operation();
    }
    finally {
        restoreStderr();
        restoreStdout();
    }
}
export async function saveImmutableToolCache(paths, key, label) {
    try {
        const cacheId = await withToolCacheOutput(() => cache.saveCache(paths, key));
        if (cacheId >= 0) {
            routineInfo(`Saved ${label} to cache (key: ${key})`);
        }
        else {
            core.debug(`${label} cache was not saved because another job already reserved key ${key}`);
        }
    }
    catch (error) {
        core.debug(`${label} cache save failed: ${error instanceof Error ? error.message : error}`);
    }
}
