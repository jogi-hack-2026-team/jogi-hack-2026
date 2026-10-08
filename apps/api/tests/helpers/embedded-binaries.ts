import { readFile, readlink, realpath, symlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';

/** npm ci --ignore-scriptsでも固定版の実embeddedを使えるよう、配布物のlibリンクだけを復元する。 */
export async function restoreEmbeddedLinks(): Promise<void> {
  const require = createRequire(import.meta.url);
  const platform = process.platform === 'win32' ? 'windows' : process.platform;
  const entry = require.resolve(`@embedded-postgres/${platform}-${process.arch}`);
  const root = dirname(dirname(entry));
  const native = await realpath(join(root, 'native'));
  const manifest: unknown = JSON.parse(await readFile(join(native, 'pg-symlinks.json'), 'utf8'));
  if (!Array.isArray(manifest)) throw new Error('Invalid embedded PostgreSQL link manifest');
  if (manifest.length === 0) return; // Windows配布物には復元するリンクがない。
  const lib = join(native, 'lib');
  if (await realpath(lib) !== lib) throw new Error('Embedded PostgreSQL lib directory must not be a symlink');

  const path = (value: unknown) => {
    // 固定配布物の全entryはnative/lib直下。外部pathや親参照へ書き込まない。
    if (typeof value !== 'string' || !/^native\/lib\/[^/\\]+$/.test(value)) {
      throw new Error('Embedded PostgreSQL link must be inside native/lib');
    }
    const result = resolve(root, value);
    if (dirname(result) !== lib) throw new Error('Embedded PostgreSQL link must be inside native/lib');
    return result;
  };
  for (const link of manifest) {
    if (!link || typeof link !== 'object' || !('source' in link) || !('target' in link)) {
      throw new Error('Invalid embedded PostgreSQL link entry');
    }
    const source = path(link.source);
    const target = path(link.target);
    if (!(await realpath(source)).startsWith(lib + sep)) {
      throw new Error('Embedded PostgreSQL link source is outside native/lib');
    }
    try {
      await symlink(relative(dirname(target), source), target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      // npm ciがscriptを実行した環境／同時初期化でも、同じ既存linkだけを許す。
      // 既存のfileや異なるlinkを削除・上書きして直さない。
      if (resolve(dirname(target), await readlink(target)) !== source) {
        throw new Error('Unexpected existing embedded PostgreSQL link');
      }
    }
  }
}
