import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
export const localDir = join(rootDir, '.local');
