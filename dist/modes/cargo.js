import * as core from '@actions/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ensureAdapterTools } from '../core/managed-tools';
import { adapterVerificationSpecs, appendCliPublicationPolicy, appendMetadataHintArgs, checkDirectCacheTagStatus, emptyDirectCacheTagCheckStatus, execBoringCache, proxyPlanningReadOnly, readBoundedJsonObject, resolveAdapterCliPlan, resolvePreferredPort, } from './shared';
export function cargoArchiveVerificationSpecs(cargoPlan, _workingDirectory) {
    return adapterVerificationSpecs(cargoPlan);
}
export function cargoCompilerCacheEnabled(cargoPlan) {
    // Compatible older CLIs predate the explicit layer field and always compose
    // sccache, so a missing value preserves their released behavior.
    return cargoPlan.cargo_cache?.compiler_cache !== 'none';
}
export function cargoCompilerCacheTag(cargoPlan) {
    // Older CLIs exposed only the adapter-level tag. Prefer the explicit layer
    // identity while preserving their released dry-run contract.
    return cargoPlan.cargo_cache?.compiler_cache_tag || cargoPlan.tag;
}
export async function runCargoRestore(plan, inputs) {
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const cargoPlan = await resolveAdapterCliPlan('cargo', plan.workspace, plan.workingDirectory, '', requestedPort, proxyPlanningReadOnly(inputs.readOnly), { metadataHintsInput: inputs.metadataHints });
    const command = cargoPlan.command || [];
    const targetEntry = (cargoPlan.archive_entries || []).find((entry) => entry.kind === 'cargo-target' || entry.requested === 'cargo-target');
    const compilerCacheEnabled = cargoCompilerCacheEnabled(cargoPlan);
    const compilerCacheTag = cargoCompilerCacheTag(cargoPlan);
    const [targetPreflight, compilerPreflight] = await Promise.all([
        targetEntry
            ? checkDirectCacheTagStatus(cargoPlan.workspace, targetEntry.tag, {
                noPlatform: cargoPlan.proxy.no_platform,
                noGit: cargoPlan.proxy.no_git,
                requireServerSignature: true,
            })
            : emptyDirectCacheTagCheckStatus(),
        compilerCacheEnabled
            ? checkDirectCacheTagStatus(cargoPlan.workspace, compilerCacheTag, {
                noPlatform: cargoPlan.proxy.no_platform,
                noGit: cargoPlan.proxy.no_git,
                requireServerSignature: true,
            })
            : emptyDirectCacheTagCheckStatus(),
    ]);
    const cacheHit = targetEntry ? targetPreflight.cacheEntryHit : compilerPreflight.kvHit;
    const cacheTag = targetEntry?.tag || (compilerCacheEnabled ? compilerCacheTag : '');
    core.setOutput('sccache-tag', compilerCacheEnabled ? compilerCacheTag : '');
    core.setOutput('sccache-hit', String(compilerCacheEnabled && compilerPreflight.kvHit));
    if (inputs.failOnCacheMiss && !inputs.lookupOnly) {
        throw new Error('mode=cargo does not support fail-on-cache-miss while executing yet; '
            + 'the CLI adapter does not expose that lifecycle hook. Use lookup-only for a preflight check.');
    }
    if (inputs.lookupOnly && inputs.failOnCacheMiss && !cacheHit) {
        throw new Error(`Cargo cache miss for ${cacheTag || 'the CLI-owned Cargo layers'}`);
    }
    const verificationSpecs = cargoArchiveVerificationSpecs(cargoPlan, plan.workingDirectory);
    const resolvedEntries = (cargoPlan.archive_entries || [])
        .map((entry) => entry.tag_path_pair)
        .join('\n');
    if (inputs.lookupOnly) {
        return {
            cacheHit,
            cacheTag,
            resolvedEntries,
            verificationSpecs,
            evidence: {
                command,
                command_executed: false,
                lookup_only: true,
                target_cache_hit: targetPreflight.cacheEntryHit,
                compiler_cache_hit: compilerPreflight.kvHit,
                cargo_cache: cargoPlan.cargo_cache,
                archive_entries: cargoPlan.archive_entries || [],
            },
        };
    }
    if (compilerCacheEnabled) {
        await ensureAdapterTools('cargo', { sccache: core.getInput('sccache-version') }, execBoringCache, plan.workingDirectory);
    }
    const nativeEvidencePath = compilerCacheEnabled
        ? path.join(os.tmpdir(), `boringcache-one-cargo-native-${process.pid}-${Date.now()}.json`)
        : '';
    const args = ['cargo', '--workspace', cargoPlan.workspace, '--port', String(cargoPlan.proxy.port)];
    appendCliPublicationPolicy(args, cargoPlan.proxy.read_only);
    appendMetadataHintArgs(args, inputs.metadataHints);
    if (inputs.failOnCacheError) {
        args.push('--fail-on-cache-error');
    }
    if (nativeEvidencePath) {
        args.push('--native-tool-evidence-json', nativeEvidencePath);
    }
    const startedAt = Date.now();
    let nativeToolEvidence = null;
    try {
        const exitCode = await execBoringCache(args, {
            cwd: plan.workingDirectory,
            ignoreReturnCode: true,
        });
        if (exitCode !== 0) {
            throw new Error(`boringcache cargo exited with code ${exitCode}`);
        }
        nativeToolEvidence = nativeEvidencePath ? readBoundedJsonObject(nativeEvidencePath) : null;
    }
    finally {
        if (nativeEvidencePath) {
            fs.rmSync(nativeEvidencePath, { force: true });
        }
    }
    const commandEvidence = {
        command,
        elapsed_seconds: Math.round((Date.now() - startedAt) / 100) / 10,
        native_tool: nativeToolEvidence,
    };
    core.setOutput('cache-tag', cacheTag);
    core.setOutput('workspace', cargoPlan.workspace);
    return {
        cacheHit,
        cacheTag,
        resolvedEntries,
        verificationSpecs,
        evidence: {
            ...commandEvidence,
            command_executed: true,
            target_cache_hit: targetPreflight.cacheEntryHit,
            compiler_cache_hit: compilerPreflight.kvHit,
            cargo_cache: cargoPlan.cargo_cache,
            archive_entries: cargoPlan.archive_entries || [],
        },
    };
}
