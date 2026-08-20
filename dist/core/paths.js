import * as core from '@actions/core';
import * as os from 'os';
import * as path from 'path';
const SAFE_PATH_COMPONENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export function currentHomeDir() {
    return process.env.HOME || os.homedir();
}
export function localBinDir() {
    return path.join(currentHomeDir(), '.local', 'bin');
}
export function addLocalBinPaths() {
    const home = currentHomeDir();
    core.addPath(path.join(home, '.local', 'bin'));
    core.addPath(path.join(home, '.boringcache', 'bin'));
}
export function isPathInside(parent, candidate) {
    const root = path.resolve(parent);
    const target = path.resolve(candidate);
    const boundary = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
    return target === root || target.startsWith(boundary);
}
export function safePathComponent(label, value) {
    if (!SAFE_PATH_COMPONENT.test(value)) {
        throw new Error(`Invalid verified release ${label}: ${value}`);
    }
    return value;
}
