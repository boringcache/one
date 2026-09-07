import * as core from '@actions/core';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { setTimeout as delay } from 'timers/promises';
import { hasBrokeredWorkloadIdentity, hasRestoreToken } from './auth';
import { getActionState, saveActionState } from './lifecycle-state';
import { execBoringCache } from './setup';
const BROKER_FILE_ENV = 'BORINGCACHE_CI_BROKER_FILE';
const START_TIMEOUT_MS = 90_000;
const STOP_TIMEOUT_MS = 60_000;
const POLL_MS = 100;
// GitHub owns the interval between main and post. The CLI owns authentication
// and renews its session while this credential-free child waits for post-save.
const KEEP_SESSION = `
const fs = require('fs');
const path = require('path');
const directory = process.argv[1];
const brokerFile = process.env.BORINGCACHE_CI_BROKER_FILE;
if (!brokerFile) process.exit(1);
const ready = path.join(directory, 'ready');
fs.writeFileSync(ready + '.tmp', brokerFile, { mode: 0o600 });
fs.renameSync(ready + '.tmp', ready);
const timer = setInterval(() => {
  if (!fs.existsSync(path.join(directory, 'keepalive'))) clearInterval(timer);
}, 100);
`;
export class WorkloadIdentityError extends Error {
}
function useBroker(file) {
    process.env[BROKER_FILE_ENV] = file;
    // The supervisor retains the provider request credential for renewal.
    // Cache commands launched by this Action receive only the broker handle.
    for (const name of [
        'BORINGCACHE_RESTORE_TOKEN', 'BORINGCACHE_STAGE_TOKEN', 'BORINGCACHE_SAVE_TOKEN',
        'BORINGCACHE_ADMIN_TOKEN', 'BORINGCACHE_API_TOKEN', 'BORINGCACHE_TOKEN',
        'BORINGCACHE_TOKEN_FILE', 'ACTIONS_ID_TOKEN_REQUEST_URL', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN',
        'CIRCLE_OIDC_TOKEN', 'CIRCLE_OIDC_TOKEN_V2', 'BORINGCACHE_OIDC_TOKEN',
    ]) {
        delete process.env[name];
    }
}
function rememberBroker(file) {
    saveActionState('ci-broker-file', file);
    useBroker(file);
}
export async function startWorkloadIdentity() {
    if (hasBrokeredWorkloadIdentity()) {
        rememberBroker(process.env[BROKER_FILE_ENV].trim());
        return;
    }
    // Explicit split credentials select the static path. Once either path is
    // selected, an authentication failure never switches to the other one.
    if (hasRestoreToken())
        return;
    if (!process.env.ACTIONS_ID_TOKEN_REQUEST_URL && !process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN)
        return;
    const directory = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'boringcache-one-session-'));
    fs.chmodSync(directory, 0o700);
    saveActionState('ci-session-directory', directory);
    fs.writeFileSync(path.join(directory, 'keepalive'), '', { mode: 0o600 });
    const log = fs.openSync(path.join(directory, 'session.log'), 'wx', 0o600);
    let child;
    try {
        child = spawn('boringcache', [
            'ci', 'run', '--oidc-provider', 'auto', '--',
            process.execPath, '-e', KEEP_SESSION, directory,
        ], {
            detached: true,
            windowsHide: true,
            stdio: ['ignore', 'ignore', log],
            // Keep RUNNER_TRACKING_ID so GitHub also reaps the supervisor if a
            // failed or cancelled job skips post-save. Its temp cleanup owns every
            // file, including the CLI's private broker directory, on that path.
            env: { ...process.env, TMPDIR: directory, TMP: directory, TEMP: directory },
        });
    }
    finally {
        fs.closeSync(log);
    }
    let spawnError;
    child.on('error', (error) => { spawnError = error; });
    child.unref();
    try {
        const deadline = Date.now() + START_TIMEOUT_MS;
        const ready = path.join(directory, 'ready');
        while (!fs.existsSync(ready)) {
            if (spawnError || child.exitCode !== null || child.signalCode !== null) {
                throw new WorkloadIdentityError('Unable to start the Machine connection. Approve this repository through Connect CI, grant the job id-token: write, and use CLI v1.20.5 or newer. No static credential was used.');
            }
            if (Date.now() >= deadline) {
                throw new WorkloadIdentityError('Timed out starting the Machine connection. Check the identity provider and BoringCache availability. No static credential was used.');
            }
            await delay(POLL_MS);
        }
        const stat = fs.lstatSync(ready);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) {
            throw new WorkloadIdentityError('The Machine connection returned an invalid startup handle.');
        }
        const file = fs.readFileSync(ready, 'utf8');
        if (!path.isAbsolute(file) || /[\r\n\0]/.test(file)) {
            throw new WorkloadIdentityError('The Machine connection returned an invalid broker path.');
        }
        rememberBroker(file);
        await checkWorkloadIdentity();
        core.exportVariable(BROKER_FILE_ENV, file);
        core.info('Machine connection ready. The CLI will renew it through post-save.');
    }
    catch (error) {
        fs.rmSync(path.join(directory, 'keepalive'), { force: true });
        const deadline = Date.now() + 10_000;
        while (!spawnError && child.exitCode === null && child.signalCode === null && Date.now() < deadline) {
            await delay(POLL_MS);
        }
        // Before readiness no other Action can use this process. Retain its child
        // object instead of persisting a PID that a later step could reuse.
        if (child.exitCode === null && child.signalCode === null && !spawnError) {
            if (process.platform === 'win32') {
                child.kill('SIGTERM');
            }
            else if (child.pid) {
                // The CLI and its broker share this detached process group. Its
                // separately grouped keeper exits when keepalive is removed above.
                try {
                    process.kill(-child.pid, 'SIGTERM');
                }
                catch { /* Already stopped. */ }
            }
        }
        throw error;
    }
}
export function restoreWorkloadIdentity() {
    const file = getActionState('ci-broker-file');
    if (file)
        useBroker(file);
}
export async function checkWorkloadIdentity() {
    if (!getActionState('ci-broker-file'))
        return;
    try {
        // Validate the live session without replacing the saved publication plan.
        const status = await execBoringCache(['ci', 'trust', '--request', 'restore', '--json'], { silent: true });
        if (status !== 0)
            throw new WorkloadIdentityError('The session check failed.');
    }
    catch {
        throw new WorkloadIdentityError('The Machine connection is unavailable or expired. Cache access has stopped without falling back to a static credential. Rerun the job after restoring the connection.');
    }
}
export async function stopWorkloadIdentity() {
    const directory = getActionState('ci-session-directory');
    if (!directory)
        return;
    fs.rmSync(path.join(directory, 'keepalive'), { force: true });
    const file = getActionState('ci-broker-file');
    const deadline = Date.now() + STOP_TIMEOUT_MS;
    while (file && fs.existsSync(file)) {
        if (Date.now() >= deadline) {
            throw new WorkloadIdentityError('The Machine connection did not stop within 60 seconds.');
        }
        await delay(POLL_MS);
    }
    fs.rmSync(directory, { recursive: true, force: true });
    saveActionState('ci-session-directory', '');
    if (process.env[BROKER_FILE_ENV] === file) {
        delete process.env[BROKER_FILE_ENV];
        core.exportVariable(BROKER_FILE_ENV, '');
    }
}
