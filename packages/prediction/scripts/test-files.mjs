import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// tests配下の階層が増えても回帰を取りこぼさない。例やfixtureはtest suffixで区別する。
export function collectTestFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
    .flatMap(entry => entry.isDirectory() ? collectTestFiles(join(directory, entry.name))
      : entry.isFile() && entry.name.endsWith('.test.mjs') ? [join(directory, entry.name)] : []);
}
