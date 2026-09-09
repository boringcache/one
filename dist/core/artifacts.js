import * as core from '@actions/core';
import * as path from 'path';
import { execBoringCache } from './setup';
const INPUT_NAMES = [
    'artifact-command', 'artifact-path', 'artifact-name', 'artifact-id',
    'artifact-workspace', 'artifact-retention-days', 'artifact-include-hidden',
];
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const MAX_INVENTORY_PAGES = 100;
export function getArtifactInputs(mode) {
    if (mode !== 'artifact') {
        const supplied = INPUT_NAMES.filter((name) => {
            const value = core.getInput(name);
            return value && !(name === 'artifact-include-hidden' && value === 'false');
        });
        if (supplied.length)
            throw new Error(`${supplied.join(', ')} requires mode: artifact.`);
        return undefined;
    }
    const command = core.getInput('artifact-command');
    if (command !== 'push' && command !== 'pull') {
        throw new Error('mode: artifact requires artifact-command: push or pull.');
    }
    const inputs = {
        command,
        paths: core.getInput('artifact-path').split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
        name: core.getInput('artifact-name'),
        id: core.getInput('artifact-id'),
        workspace: core.getInput('artifact-workspace'),
        retentionDays: core.getInput('artifact-retention-days'),
        includeHidden: core.getBooleanInput('artifact-include-hidden'),
    };
    if (core.getInput('cache-profiles') || core.getInput('proxy-port') ||
        ['save-always', 'lookup-only', 'fail-on-cache-miss', 'fail-on-cache-error'].some((name) => core.getBooleanInput(name))) {
        throw new Error('Artifact transfers run in this step and fail on errors; cache profiles, proxy ports, and cache lifecycle flags do not apply.');
    }
    if (command === 'push') {
        if (!inputs.paths.length)
            throw new Error('Artifact push requires artifact-path.');
        if (inputs.id)
            throw new Error('artifact-id is only valid for artifact-command: pull.');
        if (inputs.retentionDays && !/^(?:[1-9]\d?|[1-3]\d{2}|400)$/.test(inputs.retentionDays)) {
            throw new Error('artifact-retention-days must be an integer from 1 to 400.');
        }
    }
    else {
        if (Boolean(inputs.id) === Boolean(inputs.name)) {
            throw new Error('Artifact pull requires exactly one of artifact-id or artifact-name.');
        }
        if (inputs.id && !/^art_[A-Za-z0-9]+$/.test(inputs.id)) {
            throw new Error('artifact-id must be an immutable art_... ID.');
        }
        if (inputs.paths.length > 1)
            throw new Error('Artifact pull accepts one destination in artifact-path.');
        if (inputs.retentionDays || inputs.includeHidden) {
            throw new Error('Artifact retention and hidden-file selection apply only to artifact-command: push.');
        }
    }
    return inputs;
}
async function artifactJson(args) {
    const stdout = [];
    let stderr = '';
    let bytes = 0;
    const status = await execBoringCache(['artifact', ...args, '--json'], {
        silent: true,
        ignoreReturnCode: true,
        listeners: {
            stdout: (data) => {
                bytes += data.length;
                if (bytes <= MAX_OUTPUT_BYTES)
                    stdout.push(data);
            },
            stderr: (data) => { stderr = `${stderr}${data.toString()}`.slice(-8000); },
        },
    });
    if (status !== 0)
        throw new Error(`Artifact ${args[0]} failed (exit ${status}).${stderr.trim() ? ` ${stderr.trim()}` : ''}`);
    if (bytes > MAX_OUTPUT_BYTES)
        throw new Error('Artifact CLI response exceeds the supported size.');
    let result;
    try {
        result = JSON.parse(Buffer.concat(stdout).toString('utf8'));
    }
    catch {
        throw new Error('Artifact CLI returned invalid JSON.');
    }
    if (!result || result.schema_version !== 1)
        throw new Error('Artifact CLI returned an unsupported response schema.');
    return result;
}
async function resolveArtifactId(inputs, workspaceArgs) {
    if (inputs.id)
        return inputs.id;
    const runId = process.env.GITHUB_RUN_ID;
    const attempt = process.env.GITHUB_RUN_ATTEMPT;
    if (!runId || !attempt)
        throw new Error('Artifact name lookup requires GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT; use artifact-id outside a workflow run.');
    let selected;
    for (let page = 1; page <= MAX_INVENTORY_PAGES; page++) {
        const result = await artifactJson(['list', '--name', inputs.name, '--limit', '100', '--page', String(page), ...workspaceArgs]);
        if (!Array.isArray(result.artifacts) || result.page !== page || !Number.isSafeInteger(result.total) || result.total < 0) {
            throw new Error('Artifact CLI returned an invalid inventory.');
        }
        for (const artifact of result.artifacts) {
            if (artifact.name === inputs.name && artifact.status === 'ready' && artifact.source_type === 'cli' &&
                artifact.source_run_id === runId && String(artifact.source_context?.run_attempt) === attempt) {
                if (selected)
                    throw new Error('More than one ready artifact matches this name, run, and attempt; use artifact-id.');
                if (!/^art_[A-Za-z0-9]+$/.test(artifact.id))
                    throw new Error('Artifact inventory returned an invalid ID.');
                selected = artifact.id;
            }
        }
        if (page * 100 >= result.total) {
            if (!selected)
                throw new Error('No ready artifact matches this name, run, and attempt; use the upload artifact-id for another run.');
            return selected;
        }
    }
    throw new Error('Artifact name lookup exceeded 10,000 entries; use the upload artifact-id.');
}
export async function transferArtifact(inputs) {
    const workspaceArgs = inputs.workspace ? ['--workspace', inputs.workspace] : [];
    let args;
    let selectedId = '';
    if (inputs.command === 'push') {
        args = ['push', ...workspaceArgs];
        if (inputs.name)
            args.push('--name', inputs.name);
        if (inputs.retentionDays)
            args.push('--retention-days', inputs.retentionDays);
        if (inputs.includeHidden)
            args.push('--include-hidden');
        // Absolute paths also keep option-shaped filenames literal. The CLI owns glob expansion.
        args.push(...inputs.paths.map((value) => path.resolve(value)));
    }
    else {
        selectedId = await resolveArtifactId(inputs, workspaceArgs);
        args = ['pull', selectedId, ...workspaceArgs];
        if (inputs.paths[0])
            args.push(path.resolve(inputs.paths[0]));
    }
    const result = await artifactJson(args);
    const receipt = result.artifact;
    if (!receipt || !/^art_[A-Za-z0-9]+$/.test(receipt.id) || receipt.status !== 'ready' ||
        !/^sha256:[a-f0-9]{64}$/.test(receipt.content_digest) || (selectedId && receipt.id !== selectedId)) {
        throw new Error('Artifact CLI did not return the expected ready artifact receipt.');
    }
    if (inputs.command === 'pull' && (typeof result.destination !== 'string' || !result.destination)) {
        throw new Error('Artifact pull did not return its completed destination.');
    }
    core.setOutput('artifact-id', receipt.id);
    core.setOutput('artifact-digest', receipt.content_digest);
    if (inputs.command === 'pull')
        core.setOutput('artifact-download-path', path.resolve(result.destination));
    core.info(`Artifact ${receipt.id} ${inputs.command === 'push' ? 'uploaded' : 'downloaded'}.`);
    return {
        operation: inputs.command,
        artifact_id: receipt.id,
        artifact_digest: receipt.content_digest,
        artifact_status: receipt.status,
        ...(inputs.command === 'pull' ? { destination: path.resolve(result.destination) } : {}),
    };
}
