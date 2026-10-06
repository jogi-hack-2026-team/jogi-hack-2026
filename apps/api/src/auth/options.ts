import type { BetterAuthOptions } from 'better-auth';
import type { Pool } from 'pg';

// 認証テーブルの形を決めるBetter Authの設定。migration（db:migrate:auth）と実行時の認証設定が
// 同じ関数を使うことで、作成されるテーブルと実際に使う機能のずれを防ぐ。
// 回数制限はDBへ保存する（再起動・複数instanceをまたいで効かせる。Architecture「実装時に必要な対策」）。
// 版は固定（better-auth 1.7.7、lockfile）。`@latest`のCLIは使わない。
export function authSchemaOptions(pool: Pool) {
  return {
    database: pool,
    emailAndPassword: { enabled: true },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 100 },
  } satisfies BetterAuthOptions;
}
