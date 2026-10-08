import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import test from 'node:test';
import { promisify } from 'node:util';

const run = promisify(execFile);
const helper = new URL('./helpers/database.ts', import.meta.url).href;

test('embeddedの合成DBはLANG未設定・C localeでもUTF8でUnicode文字数を保持する', async (t) => {
  // CIのservice DBも外し、子プロセスだけの環境で実際のembedded初期化を通す。
  // 親のDATABASE_URL/locale、システムlocale、既存clusterは変更しない。
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !/^(DATABASE_URL|LANG|LANGUAGE|LC_.*)$/i.test(key),
  ));
  const script = `
    import { createTestDatabase } from ${JSON.stringify(helper)};
    const db = await createTestDatabase();
    try {
      const result = await db.pool.query(
        "select current_setting('server_encoding') as encoding, char_length($1::text) as japanese, char_length($2::text) as emoji",
        ['日'.repeat(100), '😀'.repeat(100)],
      );
      console.log(JSON.stringify(result.rows[0]));
    } finally {
      await db.close();
    }
  `;
  for (const [name, overrides] of [
    ['locale変数を全て外す', {}],
    ['LANGなし・LC_ALL=C', { LC_ALL: 'C' }],
  ] as const) {
    await t.test(name, async () => {
      const { stdout } = await run(process.execPath, ['--input-type=module', '--eval', script], {
        env: { ...env, ...overrides },
      });
      assert.deepEqual(JSON.parse(stdout.trim()), { encoding: 'UTF8', japanese: 100, emoji: 100 });
    });
  }
});
