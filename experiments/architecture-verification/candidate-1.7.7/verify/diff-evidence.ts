// Supporting Artifact / Not a Source of Truth. Preserve the bytes used by provenance hashes.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

export function saveDiffPayload(directory: string, file: string, payload: Uint8Array) {
  if (basename(file) !== file || !/^[a-zA-Z0-9_.-]+$/.test(file)) throw new Error('Invalid diff evidence filename');
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, file), payload, { flag: 'wx' });
  return { file, bytes: payload.byteLength, sha256: createHash('sha256').update(payload).digest('hex') };
}
