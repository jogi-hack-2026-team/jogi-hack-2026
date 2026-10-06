import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createAppPool } from './db/pool.ts';

const config = loadConfig();
const pool = createAppPool({ connectionString: config.databaseUrl });
const app = await buildApp({ pool, webDist: config.webDist, logLevel: config.logLevel });

let closing = false;
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (closing) return;
  closing = true;
  app.log.info({ signal }, 'shutdown: stop accepting connections');
  // 処理中の要求が終わらない場合でも、猶予時間を過ぎたら異常終了として打ち切る。
  const deadline = setTimeout(() => {
    app.log.error({ timeoutMs: config.shutdownTimeoutMs }, 'shutdown: timed out');
    process.exit(1);
  }, config.shutdownTimeoutMs);
  deadline.unref();
  try {
    await app.close(); // listenerを閉じ、処理中の要求を完了させる
    await pool.end(); // その後にDB接続を返す
    app.log.info({ signal }, 'shutdown: complete');
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, 'shutdown: failed');
    process.exit(1);
  }
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ host: config.host, port: config.port });
