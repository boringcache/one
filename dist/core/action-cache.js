import * as cache from '@actions/cache';
import * as core from '@actions/core';
export async function saveImmutableToolCache(paths, key, label) {
    try {
        const cacheId = await cache.saveCache(paths, key);
        if (cacheId >= 0) {
            core.info(`Saved ${label} to cache (key: ${key})`);
        }
        else {
            core.debug(`${label} cache was not saved because another job already reserved key ${key}`);
        }
    }
    catch (error) {
        core.debug(`${label} cache save failed: ${error instanceof Error ? error.message : error}`);
    }
}
