import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { execBoringCache } from './setup';
import { parseEntries } from './inputs';
import { requireCliVerificationTags } from './tags';
import { resolveRuntimeTools } from './runtime-tools';
import { assertImplementedMode, resolveModeSpec, } from '../modes';
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
function appendCliPublicationPolicy(args, readOnly) {
    args.push(readOnly ? '--read-only' : '--write');
}
async function runDryRunPlan(workingDirectory, options) {
    const { profileNames = [], readOnly = false, noGit = false, } = options;
    const executePlan = async () => {
        const args = ['run'];
        for (const profileName of profileNames) {
            args.push('--profile', profileName);
        }
        if (noGit) {
            args.push('--no-git');
        }
        appendCliPublicationPolicy(args, readOnly);
        args.push('--dry-run', '--json');
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
async function maybeResolveWorkspaceViaCli(workingDirectory, readOnly) {
    const plan = await runDryRunPlan(workingDirectory, {
        readOnly,
    });
    return plan.workspace?.trim() || null;
}
export async function buildArchiveEntries(inputs) {
    const cacheProfiles = splitEntriesInput(inputs.cacheProfiles).map((entry) => entry.trim());
    if (cacheProfiles.length === 0) {
        return {
            entries: '',
            envVars: {},
            verificationTags: [],
        };
    }
    const plan = await runDryRunPlan(inputs.workingDirectory, {
        profileNames: cacheProfiles,
        readOnly: inputs.readOnly,
        noGit: inputs.stage,
    });
    const firstEntry = plan.archive_entries?.[0];
    const firstPair = plan.tag_path_pairs[0];
    const cacheTagPrefix = firstEntry?.resolved_tag || firstEntry?.tag
        || (firstPair ? parseEntries(firstPair, 'restore', { separatorMode: 'single' })[0]?.tag : undefined);
    const verificationTags = requireCliVerificationTags(plan.verification_tags, 'archive');
    if (plan.tag_path_pairs.length > 0 && verificationTags.length === 0) {
        throw new Error('The selected BoringCache CLI returned archive entries without exact verification tags.');
    }
    return {
        entries: plan.tag_path_pairs.join('\n'),
        envVars: plan.env_vars,
        cacheTagPrefix,
        workspace: plan.workspace,
        verificationTags,
    };
}
export function validateOneInputs(inputs, modeSpec, archiveEntries) {
    if (inputs.setup !== 'mise' && inputs.tools.trim()) {
        core.warning(`Ignoring tools because setup=${inputs.setup}`);
    }
    if (modeSpec.resolved === 'archive' && !archiveEntries) {
        throw new Error('Archive mode requires cache-profiles from the committed .boringcache.toml plan.');
    }
}
export async function buildPlan(inputs) {
    const modeSpec = resolveModeSpec(inputs.mode);
    assertImplementedMode(modeSpec);
    const resolvedMavenVersion = inputs.mavenVersion || '3.9.16';
    const runtimeTools = await resolveRuntimeTools(inputs.setup, inputs.mode, inputs.tools, inputs.workingDirectory);
    if (inputs.setup === 'mise'
        && modeSpec.resolved === 'maven'
        && resolvedMavenVersion
        && !runtimeTools.some((tool) => tool.name === 'maven')) {
        runtimeTools.push({
            name: 'maven',
            version: resolvedMavenVersion,
            label: 'Maven',
            source: 'mode',
        });
    }
    const archiveEntries = await buildArchiveEntries(inputs);
    const workspace = archiveEntries.workspace
        || await maybeResolveWorkspaceViaCli(inputs.workingDirectory, inputs.readOnly);
    if (!workspace) {
        throw new Error('The BoringCache CLI plan did not resolve a workspace. Set workspace in .boringcache.toml.');
    }
    const cacheTagPrefix = getCacheTagPrefix(archiveEntries.cacheTagPrefix);
    validateOneInputs(inputs, modeSpec, archiveEntries.entries);
    return {
        workspace,
        workingDirectory: inputs.workingDirectory,
        setup: inputs.setup,
        mode: modeSpec.resolved,
        modeSpec,
        cacheTagPrefix,
        runtimeTools,
        envVars: archiveEntries.envVars,
        archiveEntries: archiveEntries.entries,
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
