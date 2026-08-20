import * as core from '@actions/core';
import * as path from 'path';
import { normalizeDiagnosticsLogLines, normalizeDiagnosticsMode } from './diagnostics';
import { normalizeSetup } from './runtime-tools';
import { normalizeTrustPolicy } from './trust';
import { normalizeVerifyMode, normalizeVerifyTimeoutSeconds } from './verification';
import { normalizeMode } from '../modes';
export const DEFAULT_OCI_HYDRATION_POLICY = 'metadata-only';
export function getInputs() {
    return {
        cliVersion: core.getInput('cli-version') || 'v1.19.4',
        cliPlatform: core.getInput('cli-platform'),
        setup: normalizeSetup(core.getInput('setup')),
        mode: normalizeMode(core.getInput('mode')),
        workingDirectory: path.resolve(core.getInput('working-directory') || '.'),
        tools: core.getInput('tools'),
        mavenVersion: core.getInput('maven-version') || '3.9.16',
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
        managedBuildkitImage: core.getInput('managed-buildkit-image') || 'ghcr.io/boringcache/buildkit@sha256:e46b92c02707107ab1e1396c7609f5a7b7949fbe72bdf4c00230436fbc62e42b',
        dockerToolCache: core.getInput('docker-tool-cache'),
        dockerToolCacheTarget: core.getInput('docker-tool-cache-target'),
        cacheProfiles: core.getInput('cache-profiles'),
        failOnCacheMiss: core.getBooleanInput('fail-on-cache-miss'),
        failOnCacheError: core.getBooleanInput('fail-on-cache-error'),
        lookupOnly: core.getBooleanInput('lookup-only'),
        force: core.getBooleanInput('force'),
        verbose: core.getBooleanInput('verbose'),
    };
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
    if (!inputs.readOnly && !inputs.stage) {
        flagArgs.push('--include-pr-tag');
    }
    return flagArgs;
}
