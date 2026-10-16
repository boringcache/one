import * as fs from 'fs';
import { StringDecoder } from 'string_decoder';
import { cacheStorageFullSkip } from './evidence';
import { redactEvidenceText } from './redaction';
// Failure delivery must survive verbose activity after a warning. Scan the
// completed log once with bounded lines and retained records; display uses tails.
export function readProxyFailures(filePath) {
    const result = { warnings: [] };
    const seen = new Set();
    const maxLineLength = 8192;
    let pending = '';
    const accept = (line) => {
        const skip = cacheStorageFullSkip(line);
        if (!/^warning: |^error:\s+/i.test(line)
            && !/Shutdown: (flush|checkpoint promotion) timeout reached/i.test(line) && !skip) {
            return;
        }
        const text = redactEvidenceText(line.replace(/\r$/, ''));
        if (!result.failure && (/^error:\s+/i.test(text)
            || /Shutdown: (flush|checkpoint promotion) timeout reached/i.test(text))) {
            result.failure = text;
        }
        if (text.startsWith('warning: ') && seen.size < 32 && !seen.has(text)) {
            seen.add(text);
            result.warnings.push(text.slice('warning: '.length));
        }
        if (!result.storageFullSkip && skip) {
            result.storageFullSkip = redactEvidenceText(skip);
        }
    };
    const consume = (text) => {
        let start = 0;
        for (;;) {
            const newline = text.indexOf('\n', start);
            const end = newline < 0 ? text.length : newline;
            pending += text.slice(start, end).slice(0, maxLineLength - pending.length);
            if (newline < 0) {
                break;
            }
            accept(pending);
            pending = '';
            start = newline + 1;
        }
    };
    let descriptor;
    try {
        descriptor = fs.openSync(filePath, 'r');
        const size = fs.fstatSync(descriptor).size;
        const buffer = Buffer.allocUnsafe(64 * 1024);
        const decoder = new StringDecoder('utf8');
        let position = 0;
        while (position < size) {
            const read = fs.readSync(descriptor, buffer, 0, Math.min(buffer.length, size - position), position);
            if (read === 0) {
                break;
            }
            position += read;
            consume(decoder.write(buffer.subarray(0, read)));
        }
        consume(decoder.end());
        if (pending) {
            accept(pending);
        }
    }
    catch {
        // Missing logs cannot establish a cache failure.
    }
    finally {
        if (descriptor !== undefined) {
            fs.closeSync(descriptor);
        }
    }
    return result;
}
