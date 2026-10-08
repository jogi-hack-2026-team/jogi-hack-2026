import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import test from 'node:test';
import { promisify } from 'node:util';

const run = promisify(execFile);
const helper = new URL('./helpers/database.ts', import.meta.url).href;

test('合成DBのclose後に所有postmaster・io_worker・PID fileを残さず、子Nodeが自然終了する', async () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^DATABASE_URL$/i.test(key)));
  const script = `
    import assert from 'node:assert/strict';
    import { existsSync, readFileSync } from 'node:fs';
    import { join } from 'node:path';
    import { createTestDatabase } from ${JSON.stringify(helper)};
    const db = await createTestDatabase();
    let directory;
    let owned;
    try {
      const config = await db.pool.query("select current_setting('data_directory') as dir");
      directory = config.rows[0].dir;
      const workers = await db.pool.query("select pid from pg_stat_activity where lower(backend_type) = 'io worker'");
      assert.ok(workers.rows.length > 0, '固定PostgreSQL 18の実io_workerを検査する');
      const postmaster = Number(readFileSync(join(directory, 'postmaster.pid'), 'utf8').split('\\n')[0]);
      assert.ok(Number.isSafeInteger(postmaster) && postmaster > 0);
      owned = [postmaster, ...workers.rows.map(row => row.pid)];
    } finally {
      await db.close();
    }
    assert.equal(existsSync(join(directory, 'postmaster.pid')), false, '正常停止でPID fileも除去する');
    const alive = (pid) => {
      try { process.kill(pid, 0); return true; }
      catch (error) { if (error.code !== 'ESRCH') throw error; return false; }
    };
    const deadline = Date.now() + 5000;
    while (owned.some(alive) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert.deepEqual(owned.filter(alive), [], '自分のpostmaster/io_workerを残さない');
    console.log(JSON.stringify({ closed: true }));
  `;
  // deadlineは失敗にする。成功markerだけでなく、子のstdio closeと正常終了をexecFileで待つ。
  const { stdout } = await run(process.execPath, ['--input-type=module', '--eval', script], {
    env,
    windowsHide: true,
    timeout: 120_000,
  });
  assert.deepEqual(JSON.parse(stdout.trim()), { closed: true });
});
