import * as core from '@actions/core';
import * as path from 'path';
import { normalizeDiagnosticsLogLines, normalizeDiagnosticsMode } from './diagnostics';
import { normalizeTrustPolicy } from './trust';
import { normalizeMode } from '../modes';
export const DEFAULT_OCI_HYDRATION_POLICY = 'metadata-only';
export function getInputs() {
    const diagnostics = normalizeDiagnosticsMode(core.getInput('diagnostics'));
    return {
        cliVersion: core.getInput('cli-version') || 'v1.20.1',
        cliPlatform: core.getInput('cli-platform'),
        mode: normalizeMode(core.getInput('mode')),
        workingDirectory: path.resolve(core.getInput('working-directory') || '.'),
        trustPolicy: normalizeTrustPolicy(core.getInput('trust-policy') || 'auto'),
        readOnly: false,
        stage: false,
        saveAlways: core.getBooleanInput('save-always'),
        diagnostics,
        diagnosticsLogLines: normalizeDiagnosticsLogLines('40'),
        proxyPort: core.getInput('proxy-port'),
        cacheProfiles: core.getInput('cache-profiles'),
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
