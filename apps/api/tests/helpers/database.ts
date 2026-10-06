// テスト用PostgreSQL。DATABASE_URLがあればその管理用接続を使い、なければembedded-postgresの
// ローカルクラスタ（apps/api/.local、Git除外）を起動する。テストファイルごとに専用databaseを作り、終了時に削除する。
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export type TestDatabase = {
  connectionString: string;
  pool: pg.Pool;
  close: () => Promise<void>;
};

type AdminConnection = { url: string; stop: () => Promise<void> };

const localDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.local');

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

async function startEmbedded(): Promise<AdminConnection> {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  mkdirSync(localDir, { recursive: true });
  const dataDir = join(localDir, 'pg-test');
  const credentialFile = join(localDir, 'pg-test.json');
  const isNew = !existsSync(join(dataDir, 'PG_VERSION'));
  let credential: { user: string; password: string };
  if (isNew) {
    credential = { user: 'futureroi_test', password: randomBytes(18).toString('base64url') };
    writeFileSync(credentialFile, JSON.stringify(credential), { mode: 0o600 });
  } else {
    credential = JSON.parse(readFileSync(credentialFile, 'utf8')) as { user: string; password: string };
  }
  const port = await freePort();
  const server = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: credential.user,
    password: credential.password,
    port,
    persistent: true,
    onLog: () => {},
    onError: () => {},
  });
  if (isNew) await server.initialise();
  await server.start();
  return {
    url: `postgres://${credential.user}:${encodeURIComponent(credential.password)}@127.0.0.1:${port}/postgres`,
    stop: () => server.stop(),
  };
}

async function adminConnection(): Promise<AdminConnection> {
  const url = process.env.DATABASE_URL;
  if (url) return { url, stop: async () => {} };
  return startEmbedded();
}

async function waitForNoBackends(adminPool: pg.Pool, name: string): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const r = await adminPool.query<{ n: number }>('select count(*)::int as n from pg_stat_activity where datname = $1', [name]);
    if ((r.rows[0]?.n ?? 0) === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const admin = await adminConnection();
  const name = `t_${randomBytes(6).toString('hex')}`;
  const adminPool = new pg.Pool({ connectionString: admin.url, max: 1 });
  await adminPool.query(`create database "${name}"`);
  const url = new URL(admin.url);
  url.pathname = `/${name}`;
  const connectionString = url.toString();
  const pool = new pg.Pool({ connectionString, max: 3 });
  return {
    connectionString,
    pool,
    close: async () => {
      await pool.end();
      // clientがsocketを閉じた直後でも、サーバー側のbackendは（特にportをproxyするCIのservice containerでは）
      // 数ms残ることがある。その状態で強制dropすると、閉じかけのclientへ「terminating connection」が届き、
      // 次のテストの失敗として現れる。backendが消えるのを待ってからdropし、残る場合だけforceを使う。
      await waitForNoBackends(adminPool, name);
      await adminPool.query(`drop database "${name}" with (force)`);
      await adminPool.end();
      await admin.stop();
    },
  };
}
