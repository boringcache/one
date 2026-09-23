import * as core from '@actions/core';
import * as path from 'path';
import { normalizeDiagnosticsLogLines, normalizeDiagnosticsMode } from './diagnostics';
import { normalizeTrustPolicy } from './trust';
import { normalizeMode } from '../modes';
import { getArtifactInputs } from './artifacts';
export const DEFAULT_OCI_HYDRATION_POLICY = 'metadata-only';
export const SAVE_ALWAYS_ENVIRONMENT = 'BORINGCACHE_SAVE_ALWAYS';
export function resolveSavePolicy() {
    const requested = (core.getInput('save') || 'on-success').trim().toLowerCase();
    if (requested !== 'on-success' && requested !== 'always' && requested !== 'never') {
        throw new Error(`Unsupported save "${requested}". Expected on-success, always, or never.`);
    }
    if (requested === 'on-success' && core.getBooleanInput('save-always')) {
        return 'always';
    }
    return requested;
}
export function getInputs() {
    const diagnostics = normalizeDiagnosticsMode(core.getInput('diagnostics'));
    const mode = normalizeMode(core.getInput('mode'));
    return {
        cliVersion: core.getInput('cli-version') || 'v1.32.0',
        cliPlatform: core.getInput('cli-platform'),
        mode,
        artifact: getArtifactInputs(mode),
        workingDirectory: path.resolve(core.getInput('working-directory') || '.'),
        trustPolicy: normalizeTrustPolicy(core.getInput('trust-policy') || 'auto'),
        readOnly: false,
        stage: false,
        saveAlways: core.getBooleanInput('save-always'),
        savePolicy: resolveSavePolicy(),
        diagnostics,
        diagnosticsLogLines: normalizeDiagnosticsLogLines('40'),
        proxyPort: core.getInput('proxy-port'),
        cacheProfiles: core.getInput('cache-profiles'),
        gradleHome: core.getInput('gradle-home'),
        failOnCacheMiss: core.getBooleanInput('fail-on-cache-miss'),
        failOnCacheError: core.getBooleanInput('fail-on-cache-error'),
        lookupOnly: core.getBooleanInput('lookup-only'),
        verbose: diagnostics === 'verbose',
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
