import * as core from '@actions/core';
import { DefaultArtifactClient } from '@actions/artifact';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
const STATE_DIAGNOSTIC_FILES = [
    { stateKey: 'mode-state-summary-path', name: 'state-summary.json' },
    { stateKey: 'mode-state-buildkit-log-path', name: 'buildkitd.log' },
    { stateKey: 'mode-state-worker-log-path', name: 'worker.log' },
];
export async function uploadStateDiagnosticsArtifact(artifactName, retentionDays) {
    const name = artifactName.trim();
    if (!name) {
        return;
    }
    const sourceFiles = STATE_DIAGNOSTIC_FILES.map((file) => ({
        ...file,
        source: core.getState(file.stateKey),
    })).filter((file) => file.source && fs.existsSync(file.source) && fs.statSync(file.source).isFile());
    if (sourceFiles.length === 0) {
        throw new Error(`Diagnostics artifact ${name} was requested, but Docker state produced no diagnostic files.`);
    }
    const parent = process.env.RUNNER_TEMP || os.tmpdir();
    const directory = fs.mkdtempSync(path.join(parent, 'boringcache-state-diagnostics-'));
    try {
        const files = sourceFiles.map((file) => {
            const destination = path.join(directory, file.name);
            fs.copyFileSync(file.source, destination);
            return destination;
        });
        const response = await new DefaultArtifactClient().uploadArtifact(name, files, directory, {
            retentionDays,
            compressionLevel: 0,
        });
        core.info(`Uploaded BoringCache state diagnostics artifact ${name} `
            + `(id=${String(response.id ?? 'unknown')} bytes=${String(response.size ?? 'unknown')} digest=${response.digest || 'unknown'}).`);
    }
    finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
}
