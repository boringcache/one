import * as core from '@actions/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
export const CANDIDATE_RECEIPT_FILE_ENV = 'BORINGCACHE_CANDIDATE_RECEIPT_FILE';
export function prepareCandidateReceiptFile() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boringcache-one-candidates-'));
    const receiptFile = path.join(directory, 'receipts.jsonl');
    fs.writeFileSync(receiptFile, '', { mode: 0o600 });
    process.env[CANDIDATE_RECEIPT_FILE_ENV] = receiptFile;
    return receiptFile;
}
export function useCandidateReceiptFile(receiptFile) {
    if (receiptFile.trim()) {
        process.env[CANDIDATE_RECEIPT_FILE_ENV] = receiptFile;
    }
}
export function readCandidateReceipts(receiptFile) {
    if (!receiptFile.trim() || !fs.existsSync(receiptFile)) {
        return [];
    }
    const receipts = new Map();
    for (const line of fs.readFileSync(receiptFile, 'utf8').split('\n')) {
        if (!line.trim()) {
            continue;
        }
        try {
            const parsed = JSON.parse(line);
            const id = parsed.id?.trim() || '';
            const digest = parsed.manifest_root_digest?.trim().toLowerCase() || '';
            if (!id || !/^sha256:[0-9a-f]{64}$/.test(digest)) {
                core.warning('Ignoring malformed BoringCache candidate receipt.');
                continue;
            }
            receipts.set(id, {
                id,
                tag: parsed.tag?.trim() || '',
                manifest_root_digest: digest,
                storage_mode: parsed.storage_mode?.trim() || '',
            });
        }
        catch {
            core.warning('Ignoring invalid JSON in the BoringCache candidate receipt file.');
        }
    }
    return [...receipts.values()];
}
export function publishCandidateOutputs(receiptFile) {
    const receipts = readCandidateReceipts(receiptFile);
    if (receipts.length === 0) {
        return receipts;
    }
    core.setOutput('cache-candidates', receipts.map((receipt) => receipt.id).join('\n'));
    core.setOutput('cache-candidate-digests', receipts.map((receipt) => receipt.manifest_root_digest).join('\n'));
    return receipts;
}
