import * as core from '@actions/core';
import * as fs from 'fs';
import { parsePositiveIntegerInput } from './input-values';
import { getActionState } from './lifecycle-state';
import { redactEvidenceText } from './redaction';
export const MAX_DIAGNOSTICS_LOG_LINES = 500;
export const MAX_DIAGNOSTICS_LOG_BYTES = 512 * 1024;
export function normalizeDiagnosticsMode(value) {
    switch ((value || 'auto').trim().toLowerCase()) {
        case 'auto':
        case 'off':
        case 'summary':
        case 'verbose':
            return (value || 'auto').trim().toLowerCase();
        default:
            throw new Error(`Unsupported diagnostics mode "${value}". Expected auto, off, summary, or verbose.`);
    }
}
export function normalizeDiagnosticsLogLines(value) {
    if (!value || !value.trim()) {
        return 40;
    }
    const parsed = parsePositiveIntegerInput(value, 'diagnostics-log-lines');
    if (parsed > MAX_DIAGNOSTICS_LOG_LINES) {
        core.warning(`diagnostics-log-lines "${value}" is too high; tailing ${MAX_DIAGNOSTICS_LOG_LINES} lines to keep diagnostics bounded.`);
        return MAX_DIAGNOSTICS_LOG_LINES;
    }
    return parsed;
}
export function resolveDiagnosticsConfig(mode, logLines) {
    let level;
    switch (mode) {
        case 'auto':
            level = core.isDebug() ? 'verbose' : 'off';
            break;
        case 'off':
        case 'summary':
        case 'verbose':
            level = mode;
            break;
    }
    return {
        level,
        enabled: level !== 'off',
        includeLogs: level === 'verbose',
        logLines,
    };
}
export function loadDiagnosticsConfig(inputs) {
    const savedLevel = (getActionState('diagnostics-level') || '').trim().toLowerCase();
    if (savedLevel === 'off' || savedLevel === 'summary' || savedLevel === 'verbose') {
        const savedLogLines = normalizeDiagnosticsLogLines((getActionState('diagnostics-log-lines') || '').trim() || String(inputs.diagnosticsLogLines));
        return {
            level: savedLevel,
            enabled: savedLevel !== 'off',
            includeLogs: savedLevel === 'verbose',
            logLines: savedLogLines,
        };
    }
    return resolveDiagnosticsConfig(inputs.diagnostics, inputs.diagnosticsLogLines);
}
export async function runDiagnosticsGroup(diagnostics, title, fn) {
    if (!diagnostics.enabled) {
        return;
    }
    await core.group(title, fn);
}
export function readLogTail(filePath, maxLines) {
    const lineLimit = Math.min(Math.floor(maxLines), MAX_DIAGNOSTICS_LOG_LINES);
    if (!filePath || lineLimit < 1) {
        return [];
    }
    let fileDescriptor = null;
    try {
        fileDescriptor = fs.openSync(filePath, 'r');
        const fileSize = fs.fstatSync(fileDescriptor).size;
        const chunkSize = 64 * 1024;
        const byteLimit = Math.min(fileSize, MAX_DIAGNOSTICS_LOG_BYTES);
        const chunks = [];
        let position = fileSize;
        let bytesCollected = 0;
        let lines = [];
        while (position > 0 && bytesCollected < byteLimit && lines.length <= lineLimit) {
            const bytesToRead = Math.min(chunkSize, position, byteLimit - bytesCollected);
            position -= bytesToRead;
            const buffer = Buffer.allocUnsafe(bytesToRead);
            const bytesRead = fs.readSync(fileDescriptor, buffer, 0, bytesToRead, position);
            if (bytesRead <= 0) {
                break;
            }
            bytesCollected += bytesRead;
            chunks.unshift(buffer.subarray(0, bytesRead));
            lines = Buffer.concat(chunks)
                .toString('utf8')
                .split(/\r?\n/)
                .filter((line) => line.trim().length > 0);
        }
        const tailLines = lines.slice(-lineLimit);
        if (tailLines.length > 0 && position > 0 && bytesCollected >= byteLimit && lines.length <= lineLimit) {
            tailLines[0] = `[truncated to last ${MAX_DIAGNOSTICS_LOG_BYTES} bytes] ${tailLines[0]}`;
        }
        return tailLines.map((line) => redactEvidenceText(line));
    }
    catch {
        return [];
    }
    finally {
        if (fileDescriptor !== null) {
            fs.closeSync(fileDescriptor);
        }
    }
}
