import { spawn } from 'child_process';
export async function runNativeProcess(command, args, timeoutMs, spawnProcess = spawn, stdio = 'inherit') {
    return await new Promise((resolve, reject) => {
        let settled = false;
        const child = spawnProcess(command, args, { env: process.env, stdio, windowsHide: true });
        const timeout = setTimeout(() => {
            if (settled)
                return;
            settled = true;
            try {
                child.kill('SIGKILL');
            }
            catch { }
            reject(new Error(`${command} ${args.join(' ')} did not exit within ${Math.ceil(timeoutMs / 1000)} seconds; the launcher was terminated.`));
        }, timeoutMs);
        child.once('error', (error) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timeout);
            reject(error);
        });
        child.once('exit', (exitCode, signal) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timeout);
            resolve({ exitCode, signal });
        });
    });
}
