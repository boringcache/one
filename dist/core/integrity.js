import * as crypto from 'crypto';
import * as fs from 'fs';
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
export async function sha256File(filePath) {
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(filePath)) {
        hash.update(chunk);
    }
    return hash.digest('hex');
}
export function parseSha256(content, assetName) {
    const value = content.trim();
    const match = value.match(/^([a-f0-9]{64})(?:\s+\*?(.+))?$/i);
    if (!match) {
        throw new Error(`Invalid SHA-256 checksum for ${assetName}`);
    }
    const [, digest, namedAsset] = match;
    if (namedAsset && namedAsset !== assetName) {
        throw new Error(`SHA-256 checksum names ${namedAsset}, expected ${assetName}`);
    }
    return digest.toLowerCase();
}
export async function readSha256File(filePath, assetName) {
    return parseSha256(await fs.promises.readFile(filePath, 'utf8'), assetName);
}
export async function verifySha256(filePath, expectedDigest, assetName) {
    if (!SHA256_PATTERN.test(expectedDigest)) {
        throw new Error(`Invalid expected SHA-256 digest for ${assetName}`);
    }
    const actualDigest = await sha256File(filePath);
    if (actualDigest !== expectedDigest.toLowerCase()) {
        throw new Error(`SHA-256 verification failed for ${assetName}: expected ${expectedDigest.toLowerCase()}, got ${actualDigest}`);
    }
}
