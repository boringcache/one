import * as core from '@actions/core';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { setTimeout as delay } from 'timers/promises';
const RECEIPT_SCHEMA = 'buildkit-state-handoff.v1';
const IMAGE_READY_FILE = 'image-ready.json';
const FINALIZE_REQUEST_FILE = 'finalize-request.json';
const FINISHED_FILE = 'finished.json';
const POLL_INTERVAL_MS = 250;
const FINISH_TIMEOUT_MS = 60 * 60 * 1000;
const LOG_CHUNK_BYTES = 1024 * 1024;
export function stateWorkerDirectory() {
    const root = process.env.RUNNER_TEMP || os.tmpdir();
    const runId = sanitizePathToken(process.env.GITHUB_RUN_ID || String(process.pid));
    const action = sanitizePathToken(process.env.GITHUB_ACTION || 'one');
    return path.join(root, `boringcache-state-${runId}-${action}-${Date.now().toString(36)}`);
}
export async function startStateWorker(args, options) {
    const directory = path.resolve(options.directory || stateWorkerDirectory());
    fs.mkdirSync(directory, { recursive: false, mode: 0o700 });
    const logPath = path.join(directory, 'worker.log');
    const logFd = fs.openSync(logPath, 'wx', 0o600);
    const separator = args.indexOf('--');
    const workerArgs = [...args];
    workerArgs.splice(separator >= 0 ? separator : workerArgs.length, 0, '--state-handoff-dir', directory, '--state-handoff-defer-finalize');
    let child;
    try {
        child = spawn('boringcache', workerArgs, {
            cwd: options.cwd,
            detached: true,
            stdio: ['ignore', logFd, logFd],
            env: options.env || process.env,
        });
        await new Promise((resolve, reject) => {
            const onSpawn = () => {
                child.removeListener('error', onError);
                resolve();
            };
            const onError = (error) => {
                child.removeListener('spawn', onSpawn);
                reject(new Error(`Failed to start the BoringCache state worker: ${error.message}`));
            };
            child.once('spawn', onSpawn);
            child.once('error', onError);
        });
        child.on('error', (error) => {
            core.warning(`BoringCache state worker process error: ${error.message}`);
        });
        child.unref();
    }
    finally {
        fs.closeSync(logFd);
    }
    if (!child.pid) {
        throw new Error('Failed to start the BoringCache state worker');
    }
    const handle = {
        pid: child.pid,
        directory,
        logPath,
        logOffset: 0,
    };
    core.info(`BoringCache state worker started (PID: ${handle.pid})`);
    return handle;
}
export async function waitForStateImageReady(handle) {
    const readyPath = path.join(handle.directory, IMAGE_READY_FILE);
    const finishedPath = path.join(handle.directory, FINISHED_FILE);
    while (true) {
        handle.logOffset = emitNewLog(handle.logPath, handle.logOffset);
        if (fs.existsSync(readyPath)) {
            const receipt = readReceipt(readyPath, handle.pid, 'image-ready');
            if (receipt.command_exit_code !== 0) {
                throw new Error(`Invalid image-ready receipt with command exit code ${receipt.command_exit_code}`);
            }
            handle.cacheHit = receipt.state_restored === true;
            core.info('Docker image is ready; BuildKit state finalization continues in the Action post phase.');
            return handle;
        }
        if (fs.existsSync(finishedPath)) {
            const receipt = readReceipt(finishedPath, handle.pid, 'finished');
            throw new Error(receipt.error || `BoringCache state worker finished before image-ready (exit ${receipt.exit_code})`);
        }
        if (!isProcessAlive(handle.pid)) {
            handle.logOffset = emitNewLog(handle.logPath, handle.logOffset);
            throw new Error(`BoringCache state worker exited before publishing ${IMAGE_READY_FILE}`);
        }
        await delay(POLL_INTERVAL_MS);
    }
}
export async function waitForStateWorker(handle, timeoutMs = FINISH_TIMEOUT_MS) {
    const finishedPath = path.join(handle.directory, FINISHED_FILE);
    const deadline = Date.now() + timeoutMs;
    while (true) {
        handle.logOffset = emitNewLog(handle.logPath, handle.logOffset);
        if (fs.existsSync(finishedPath)) {
            const receipt = readReceipt(finishedPath, handle.pid, 'finished');
            handle.logOffset = emitRemainingLog(handle.logPath, handle.logOffset);
            if (!receipt.success || receipt.exit_code !== 0) {
                throw new Error(receipt.error || `BoringCache state worker failed with exit code ${receipt.exit_code}`);
            }
            core.info('BoringCache state finalization and atomic publication completed.');
            return receipt;
        }
        if (!isProcessAlive(handle.pid)) {
            handle.logOffset = emitNewLog(handle.logPath, handle.logOffset);
            throw new Error(`BoringCache state worker exited without publishing ${FINISHED_FILE}`);
        }
        if (Date.now() >= deadline) {
            throw new Error(`Timed out waiting for BoringCache state finalization after ${Math.round(timeoutMs / 1000)}s`);
        }
        await delay(POLL_INTERVAL_MS);
    }
}
export function requestStateFinalization(handle) {
    const requestPath = path.join(handle.directory, FINALIZE_REQUEST_FILE);
    if (fs.existsSync(requestPath)) {
        readReceipt(requestPath, handle.pid, 'finalize-requested');
        return;
    }
    const temporary = path.join(handle.directory, `.${FINALIZE_REQUEST_FILE}.${process.pid}.${Date.now()}.tmp`);
    const receipt = {
        schema_version: RECEIPT_SCHEMA,
        phase: 'finalize-requested',
        pid: handle.pid,
        requested_at: new Date().toISOString(),
    };
    try {
        fs.writeFileSync(temporary, `${JSON.stringify(receipt)}\n`, { flag: 'wx', mode: 0o600 });
        fs.renameSync(temporary, requestPath);
    }
    finally {
        if (fs.existsSync(temporary)) {
            fs.rmSync(temporary);
        }
    }
    core.info('BoringCache state finalization requested from the Action post phase.');
}
function readReceipt(receiptPath, expectedPid, expectedPhase) {
    let receipt;
    try {
        receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    }
    catch (error) {
        throw new Error(`Invalid BoringCache state receipt ${receiptPath}: ${error.message}`);
    }
    if (receipt.schema_version !== RECEIPT_SCHEMA
        || receipt.phase !== expectedPhase
        || receipt.pid !== expectedPid) {
        throw new Error(`Unexpected BoringCache state receipt ${receiptPath}: schema=${receipt.schema_version} phase=${receipt.phase} pid=${receipt.pid}`);
    }
    return receipt;
}
function emitNewLog(logPath, offset) {
    if (!fs.existsSync(logPath)) {
        return offset;
    }
    const size = fs.statSync(logPath).size;
    if (size <= offset) {
        return offset;
    }
    const length = Math.min(size - offset, LOG_CHUNK_BYTES);
    const buffer = Buffer.alloc(length);
    const fd = fs.openSync(logPath, 'r');
    try {
        fs.readSync(fd, buffer, 0, length, offset);
    }
    finally {
        fs.closeSync(fd);
    }
    const output = buffer.toString('utf8').trimEnd();
    if (output) {
        core.info(output);
    }
    return offset + length;
}
function emitRemainingLog(logPath, offset) {
    let nextOffset = emitNewLog(logPath, offset);
    while (nextOffset > offset) {
        offset = nextOffset;
        nextOffset = emitNewLog(logPath, offset);
    }
    return offset;
}
function isProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (error) {
        return error.code !== 'ESRCH';
    }
}
function sanitizePathToken(value) {
    return value.replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '') || 'one';
}
