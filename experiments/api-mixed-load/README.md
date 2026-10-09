# 現行APIの混合負荷計測（Issue #161）

**Supporting Artifact / Not a Source of Truth。** 親 [#160](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/160) で予測計算の実行方式（同期維持／worker／保留）を決めるための実測であり、採択・公開性能・無料枠・同時利用可能人数の保証ではない。正式な仕様は [Architecture](../../docs/architecture.md)、過去の候補spikeでの実測は [REAL-ENGINE-2026-10-07.md](../architecture-verification/REAL-ENGINE-2026-10-07.md) を参照する。

## 何を測るか

現行 `apps/api`（Fastify、[engine.ts](../../apps/api/src/prediction/engine.ts) が純粋Engineを同期で呼ぶ）を **別OS processとして** `apps/api/src/server.ts` から起動し、`/today` の予測計算中に記録PUT・Goal一覧・session確認がどれだけ待たされるかを測る。製品コードは変更しない。

| 要素 | 内容 |
| --- | --- |
| DB | `apps/api/tests/helpers/database.ts` と同じembedded PostgreSQL（`apps/api/.local`、Git除外）に専用databaseを作り、終了時に削除する。外部DBは使わない |
| 利用者 | 合成3人。sign-upはHTTP経由。各利用者は記録用Goal 1、予測用Goal 1（60日分の合成記録、今日・昨日は未記録）、Demo Seed（`seedDemo`）の2Goalを持つ |
| 予測用Goal | `requiredFutureDone` が既定でT-14の3入力（120／400／1095）になるよう `total_required` を調整する。`MIXED_LOAD_SIZES=a,b,c` で差し替えられる |
| oracle | DBの事実から `predict` / `predictWithQuestionPrior` を直接呼び、負荷前に `/today`（旧表現・`?view=r11`）と完全一致を確認する。負荷中の応答はこの期待bodyとの一致を数える（Engineはseed固定で決定的） |
| server側metrics | [server-metrics-preload.mjs](server-metrics-preload.mjs) を `node --import` で同じprocessに読み込み、event-loop遅延・CPU・RSSをloopbackの別portで返す。現行APIにサービス内の計算timerはないため、**event-loop遅延の最大値を1回の同期ブロック（predict）の最長時間の近似**として使う |
| 位相 | warmup送信停止→全応答drain→server metrics reset→測定→送信停止→全応答drain→metrics取得→SIGTERM。warmupの遅延は測定へ混ぜない |

### シナリオ

1. **3人デモ相当（closed loop）**：3利用者が「予測GoalのToday（r11）→1秒→記録PUT→0.5秒→Goal一覧→session確認→DemoGoalのToday（r11）→1秒」を繰り返す。warmup 5秒、測定30秒。3人が手を止めずに操作し続ける上限側の想定。
2. **候補spikeと同じopen loop**：CRUD 20rps（一覧／記録PUT／session確認を順番に）、Todayを1／4／10rpsで固定送信。warmup 1秒、測定8秒。計算なしの基準（Today 0rps）と、旧表現・r11表現のそれぞれで実行する。open loopのsession確認は固定版Better Authの100回／60秒／IPに当たるため、利用者ごとに複数のX-Forwarded-For IPへ分散する（回数制限の鍵が変わるだけで、API処理は同じ）。

## 実行

repository rootで、Node 24.21.0・`npm ci`・`npm run build:prediction` を済ませてから実行する。

```bash
node experiments/api-mixed-load/run.ts
```

```bash
MIXED_LOAD_SIZES=548,700,800 node experiments/api-mixed-load/run.ts
```

```bash
node experiments/api-mixed-load/engine-sweep.mjs
```

- `run.ts` は `results/<UTC時刻>/mixed-load.json` に生結果（条件・provenance（`run.ts` 自身のSHA256とexperiments配下のdirty状態を含む）・各種p50/p95/p99/max・件数・HTTP status別件数・server metrics・生の遅延配列）を保存する。wiring・全cohortの収束・要求失敗0・oracle不一致0をすべて満たしたときだけexit 0。
- `engine-sweep.mjs` は純粋Engine単体で `requiredFutureDone` を変えながら計測し、この端末で最も重いサイズを探す。`results/<UTC時刻>/engine-sweep.json` に保存する。
- server processは `LOG_LEVEL=warn`（製品既定はinfo。応答ごとのaccess logを書かない）、`TRUST_PROXY_HOPS=1`、認証回数上限1000で起動する。`NODE_ENV` は未設定（loopback HTTP）。

## 読み方の注意

- 負荷generator・API・PostgreSQLは同じ端末（多コア）で動く。1 vCPU・実Cloud・公開runtimeの性能ではない。
- 各条件は1回8〜30秒。桁の目安として読む。
- 予測入力は代表3サイズ＋Demo Seed 2Goalで、全入力の最悪値ではない。`engine-sweep.mjs` の結果も1種類の記録パターンに限る。
- 過去の候補spike結果（546.83ms FAIL、CRUD p95 5秒超）はWindows端末・隔離候補の値であり、本計測で書き換えない。
- 結果の要約と判断材料は、同じディレクトリの `REPORT-<日付>.md` にまとめる。
