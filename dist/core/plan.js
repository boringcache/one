import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { hasBrokeredWorkloadIdentity } from './auth';
import { execBoringCache } from './setup';
import { requireCliVerificationTags } from './tags';
import { resolveModeSpec, } from '../modes';
function splitEntriesInput(entries) {
    const values = [];
    let current = '';
    for (let index = 0; index < entries.length; index += 1) {
        const character = entries[index];
        if (character === '\\' && entries[index + 1] === ',') {
            current += ',';
            index += 1;
        }
        else if (character === ',' || character === '\n') {
            values.push(current);
            current = '';
        }
        else if (character !== '\r') {
            current += character;
        }
    }
    values.push(current);
    return values.filter((entry) => entry.trim());
}
function parseCliVersion(version) {
    const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
    if (!match) {
        return null;
    }
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}
export async function resolveCliCapabilityVersion(version) {
    const requestedVersion = version.trim();
    if (requestedVersion.toLowerCase() === 'skip' || parseCliVersion(requestedVersion)) {
        return requestedVersion;
    }
    let stdout = '';
    let stderr = '';
    const exitCode = await execBoringCache(['--version'], {
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
    const output = `${stdout}\n${stderr}`;
    const match = output.match(/\bboringcache\s+v?(\d+\.\d+\.\d+(?:[-+][^\s]+)?)/i);
    if (exitCode !== 0 || !match) {
        throw new Error(`Unable to determine installed BoringCache CLI capabilities for cli-version '${requestedVersion || '(empty)'}'. `
            + `Expected 'boringcache --version' to report a semantic version, but it exited ${exitCode}`
            + `${output.trim() ? `: ${output.trim()}` : '.'}`);
    }
    return match[1];
}
export function archiveRunArgs(profiles, policy) {
    const args = ['run'];
    for (const profile of profiles) {
        args.push('--profile', profile);
    }
    if (policy.stage) {
        args.push('--stage');
    }
    else {
        args.push(policy.readOnly ? '--read-only' : '--write');
    }
    return args;
}
async function runDryRunPlan(workingDirectory, profiles, policy) {
    const executePlan = async () => {
        const args = [...archiveRunArgs(profiles, policy), '--dry-run', '--json'];
        let stdout = '';
        let stderr = '';
        const exitCode = await exec.exec('boringcache', args, {
            cwd: workingDirectory,
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
        if (exitCode !== 0) {
            throw new Error(stderr.trim() || stdout.trim() || `boringcache run --dry-run --json exited with code ${exitCode}`);
        }
        try {
            return JSON.parse(stdout);
        }
        catch (error) {
            throw new Error(`Failed to parse boringcache dry-run JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
    };
    return executePlan();
}
export function requireMachineConnectionWorkspace(plan) {
    if (hasBrokeredWorkloadIdentity() && (!plan.workspace?.trim() || plan.workspace_source !== 'machine-connection')) {
        throw new Error('The BoringCache CLI plan did not resolve the Machine connection workspace. Update the CLI and runner supervisor to versions that support the approved binding workspace.');
    }
}
export async function buildArchiveEntries(inputs) {
    const cacheProfiles = splitEntriesInput(inputs.cacheProfiles).map((entry) => entry.trim());
    if (cacheProfiles.length === 0) {
        return {
            entries: '',
            profiles: [],
            envVars: {},
            verificationTags: [],
        };
    }
    const plan = await runDryRunPlan(inputs.workingDirectory, cacheProfiles, inputs);
    requireMachineConnectionWorkspace(plan);
    const firstEntry = plan.archive_entries?.[0];
    const cacheTagPrefix = firstEntry?.resolved_tag || firstEntry?.tag;
    const verificationTags = requireCliVerificationTags(plan.verification_tags, 'archive');
    if (plan.tag_path_pairs.length > 0 && verificationTags.length === 0) {
        throw new Error('The selected BoringCache CLI returned archive entries without exact verification tags.');
    }
    if (plan.tag_path_pairs.length > 0
        && !['restore', 'save'].every((phase) => plan.archive_phases?.includes(phase))) {
        throw new Error('The selected BoringCache CLI does not run archive restore and save phases. '
            + 'Remove the cli-version pin or select a CLI release that supports `boringcache run --phase`.');
    }
    return {
        entries: plan.tag_path_pairs.join('\n'),
        profiles: cacheProfiles,
        envVars: plan.env_vars,
        cacheTagPrefix,
        workspace: plan.workspace,
        verificationTags,
    };
}
export function validateOneInputs(modeSpec, archiveEntries) {
    if (modeSpec.resolved === 'archive' && !archiveEntries) {
        throw new Error('Archive mode requires cache-profiles from the committed .boringcache.toml plan.');
    }
    if (modeSpec.resolved !== 'archive' && archiveEntries) {
        throw new Error(`cache-profiles belongs to mode=archive; use a separate archive Action step before mode=${modeSpec.resolved}.`);
    }
}
export async function buildPlan(inputs) {
    const modeSpec = resolveModeSpec(inputs.mode);
    const archiveEntries = await buildArchiveEntries(inputs);
    validateOneInputs(modeSpec, archiveEntries.entries);
    const workspace = archiveEntries.workspace || '';
    if (!workspace && modeSpec.resolved === 'archive') {
        throw new Error('The BoringCache CLI plan did not resolve a workspace. Set workspace in .boringcache.toml.');
    }
    const cacheTagPrefix = getCacheTagPrefix(archiveEntries.cacheTagPrefix);
    return {
        workspace,
        workingDirectory: inputs.workingDirectory,
        mode: modeSpec.resolved,
        modeSpec,
        cacheTagPrefix,
        envVars: archiveEntries.envVars,
        archiveEntries: archiveEntries.entries,
        archiveProfiles: archiveEntries.profiles,
        archiveVerificationTags: archiveEntries.verificationTags,
    };
}
export function getCacheTagPrefix(resolvedArchivePrefix) {
    if (resolvedArchivePrefix?.trim()) {
        return resolvedArchivePrefix.trim();
    }
    return 'one';
}
export async function applyCliPlanEnv(plan) {
    for (const [key, value] of Object.entries(plan.envVars)) {
        core.exportVariable(key, value);
    }
}
