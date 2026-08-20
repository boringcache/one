import * as os from 'os';
import * as path from 'path';
export function parsePositiveIntegerInput(value, inputName) {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
        throw new Error(`Unsupported ${inputName} "${value}". Expected a positive integer.`);
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error(`Unsupported ${inputName} "${value}". Expected a positive integer.`);
    }
    return parsed;
}
export function expandUserPath(value) {
    if (value.startsWith('~/')) {
        return path.join(process.env.HOME || os.homedir(), value.slice(2));
    }
    return value;
}
export function resolveWorkingPath(value, workingDirectory) {
    const expanded = expandUserPath(value);
    return path.isAbsolute(expanded) ? expanded : path.resolve(workingDirectory, expanded);
}
