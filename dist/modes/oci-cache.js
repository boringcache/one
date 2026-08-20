import * as core from '@actions/core';
import { startRegistryProxy, stopRegistryProxy, PROXY_VERIFICATION_STOP_TIMEOUT_MS, } from '../core';
import { DEFAULT_OCI_HYDRATION_POLICY, normalizeVerifyTimeoutSeconds } from '../utils';
import { errorMessage, getModeState, getModeStateBoolean, getModeStateList, reportedProxyStopTimeoutMs, saveModeState, } from './shared';
export async function verifyOciPromotionRefsAfterStop() {
    const refs = getModeStateList('oci-promotion-ref-tags');
    if (refs.length === 0) {
        return;
    }
    const workspace = getModeState('workspace');
    const cacheTag = getModeState('cache-tag');
    const port = Number.parseInt(getModeState('proxy-port'), 10);
    if (!workspace || !cacheTag) {
        throw new Error(`Cannot verify managed cache promotion refs without workspace and cache tag. requested=[${refs.join(', ')}]`);
    }
    if (!Number.isFinite(port) || port <= 0) {
        throw new Error(`Cannot verify managed cache promotion refs without a proxy port. requested=[${refs.join(', ')}]`);
    }
    const host = getModeState('proxy-host') || '127.0.0.1';
    let verificationProxyPid = null;
    try {
        const verificationProxy = await startRegistryProxy({
            command: 'cache-registry',
            workspace,
            tag: cacheTag,
            host,
            port,
            noGit: getModeStateBoolean('proxy-no-git'),
            noPlatform: getModeStateBoolean('proxy-no-platform'),
            verbose: getModeStateBoolean('verbose'),
            readOnly: true,
            ociRequiredReadableRefs: refs,
            requireOciImportReady: true,
            ociImportReadyTimeoutMs: ociPromotionVerificationTimeoutMs(),
            ociHydration: DEFAULT_OCI_HYDRATION_POLICY,
        });
        verificationProxyPid = verificationProxy.pid > 0 ? verificationProxy.pid : null;
        const readiness = verificationProxy.ociImportReadiness;
        if (!readiness?.ready) {
            throw new Error(`Managed cache promotion refs were not readable after proxy shutdown. readable=[${readiness?.readableRefs.join(', ') || ''}] unreadable=[${readiness?.unreadableRefs.join(', ') || refs.join(', ')}]`);
        }
        core.info(`Verified managed cache promotion refs after proxy shutdown: ${readiness.readableRefs.join(', ')}`);
    }
    catch (error) {
        throw new Error(`Managed cache promotion refs were not readable after proxy shutdown. requested=[${refs.join(', ')}]: ${errorMessage(error)}`);
    }
    finally {
        if (verificationProxyPid !== null) {
            try {
                await stopRegistryProxy(verificationProxyPid, port, PROXY_VERIFICATION_STOP_TIMEOUT_MS);
            }
            catch (stopError) {
                core.warning(`Failed to stop the managed cache verification proxy: ${errorMessage(stopError)}`);
            }
        }
    }
}
export function ociPromotionVerificationTimeoutMs() {
    const raw = core.getState('verify-timeout-seconds') || core.getInput('verify-timeout-seconds') || '180';
    return normalizeVerifyTimeoutSeconds(raw) * 1000;
}
export async function verifyOciPromotionRefsThenStopProxy(proxyPid) {
    try {
        const proxyPort = Number.parseInt(getModeState('proxy-port'), 10);
        await stopRegistryProxy(parseInt(proxyPid, 10), Number.isFinite(proxyPort) ? proxyPort : undefined, reportedProxyStopTimeoutMs());
    }
    catch (stopError) {
        throw new Error(`Failed to stop BoringCache proxy cleanly before managed cache promotion verification: ${errorMessage(stopError)}`);
    }
    await verifyOciPromotionRefsAfterStop();
}
export function extractCacheRefTag(cacheFrom) {
    const refMatch = cacheFrom.match(/(?:^|,)ref=([^,]+)/);
    const ref = refMatch?.[1]?.trim();
    if (!ref) {
        return null;
    }
    const lastSlash = ref.lastIndexOf('/');
    const lastColon = ref.lastIndexOf(':');
    if (lastColon <= lastSlash || lastColon === ref.length - 1) {
        return null;
    }
    return ref.slice(lastColon + 1);
}
export function buildKitCacheFromRefTags(buildKitCache) {
    if (!buildKitCache) {
        return [];
    }
    if (buildKitCache.cache_from_ref_tags?.length) {
        return buildKitCache.cache_from_ref_tags;
    }
    return (buildKitCache.cache_from_refs || [])
        .map(extractCacheRefTag)
        .filter((tag) => Boolean(tag));
}
export function buildKitCacheImportSpecs(buildKitCache, refTags) {
    const imports = buildKitCache.cache_from_refs?.length ? buildKitCache.cache_from_refs : [buildKitCache.cache_from];
    const byRefTag = new Map();
    for (const cacheFrom of imports) {
        const refTag = extractCacheRefTag(cacheFrom);
        if (refTag && !byRefTag.has(refTag)) {
            byRefTag.set(refTag, cacheFrom.trim());
        }
    }
    const selectedImports = refTags
        ? refTags
            .map((refTag) => byRefTag.get(refTag))
            .filter((cacheFrom) => Boolean(cacheFrom))
        : imports
            .map((cacheFrom) => cacheFrom.trim())
            .filter(Boolean);
    return selectedImports;
}
export function effectiveBuildKitCacheImports(buildKitCache, proxy) {
    const requestedRefTags = buildKitCacheFromRefTags(buildKitCache);
    const readableRefTags = proxy?.ociImportReadiness
        ? proxy.ociImportReadiness.readableRefs
        : requestedRefTags;
    const unreadableRefTags = proxy?.ociImportReadiness?.unreadableRefs || [];
    return {
        importSpecs: buildKitCacheImportSpecs(buildKitCache, readableRefTags),
        readableRefTags,
        requestedRefTags,
        unreadableRefTags,
        importReady: proxy?.ociImportReadiness?.ready ?? true,
    };
}
export function buildKitCacheEvidence(adapter, buildKitCache, imports, cacheTo) {
    const runMetadata = buildKitCache.run_metadata;
    return {
        adapter,
        cache_backend: 'boringcache',
        buildkit_cache_backend: 'boringcache',
        cache_ref: buildKitCache.cache_ref,
        cache_from: imports.importSpecs,
        cache_to: cacheTo || '',
        requested_ref_tags: imports.requestedRefTags,
        readable_ref_tags: imports.readableRefTags,
        unreadable_ref_tags: imports.unreadableRefTags,
        import_ready: imports.importReady,
        immutable_run_ref_tag: buildKitCache.immutable_run_ref_tag || '',
        promotion_ref_tags: buildKitCache.promotion_ref_tags || [],
        ci: {
            provider: runMetadata?.provider || '',
            run_uid: runMetadata?.run_uid || '',
            run_attempt: runMetadata?.run_attempt || '',
            source_ref_type: runMetadata?.source_ref_type || '',
            source_ref_name: runMetadata?.source_ref_name || '',
            run_started_at: runMetadata?.run_started_at || '',
        },
    };
}
export function recordBuildKitCachePlanState(buildKitPlan, cacheTag) {
    saveModeState('workspace', buildKitPlan.workspace);
    saveModeState('cache-tag', cacheTag);
    return {
        resolvedWorkspace: buildKitPlan.workspace,
        resolvedCacheTag: cacheTag,
    };
}
export function setBuildKitCacheOutputs(spec) {
    core.setOutput('cache-ref', spec.ref);
    core.setOutput('cache-from', spec.from.join('\n'));
    core.setOutput('cache-to', spec.to || '');
    core.setOutput('docker-cache-run-ref', spec.buildKitCache?.immutable_run_ref_tag || '');
    core.setOutput('docker-cache-from-refs', (spec.usedRefTags || buildKitCacheFromRefTags(spec.buildKitCache)).join('\n'));
    core.setOutput('docker-cache-requested-from-refs', buildKitCacheFromRefTags(spec.buildKitCache).join('\n'));
    core.setOutput('docker-cache-unreadable-from-refs', (spec.unreadableRefTags || []).join('\n'));
    core.setOutput('docker-cache-import-ready', String(spec.importReady ?? true));
    core.setOutput('docker-cache-promotion-refs', (spec.buildKitCache?.promotion_ref_tags || []).join('\n'));
    core.setOutput('docker-ci-provider', spec.buildKitCache?.run_metadata?.provider || '');
    core.setOutput('docker-ci-run-id', spec.buildKitCache?.run_metadata?.run_uid || '');
    core.setOutput('docker-ci-run-attempt', spec.buildKitCache?.run_metadata?.run_attempt || '');
    core.setOutput('docker-ci-ref-type', spec.buildKitCache?.run_metadata?.source_ref_type || '');
    core.setOutput('docker-ci-ref-name', spec.buildKitCache?.run_metadata?.source_ref_name || '');
    core.setOutput('docker-ci-run-started-at', spec.buildKitCache?.run_metadata?.run_started_at || '');
    core.setOutput('cache-dir', '');
    core.setOutput('save-cache-dir', '');
}
