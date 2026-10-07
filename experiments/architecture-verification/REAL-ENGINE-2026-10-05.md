# 実Engineでの単体計測と混合負荷（2026-10-05）

**Supporting Artifact / Not a Source of Truth。採択・本実装・配備先の性能証拠ではない。**

[Issue #84](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/84)の検証2は、これまで代用のCPU消費で行っていた。main統合済みの純粋Engine（`packages/prediction`）へ差し替えて、候補runtimeで測り直した。D-23〜D-25の状態、worker poolの採否、`/today`の応答項目は変更しない。

## 結論

- **T-14：** 実Engineの必須3条件は、Node 24.21.0・Apple M5で各回34〜75ms。500ms未満を満たした。
- **混合負荷：** 実Engineを同期で動かすと、失敗は0件だが、CRUDのp95が約5msから39〜85msへ伸びた。同一プロセス内のworker 2本へ移すと、CRUDのp95は1.4〜6.2msのままだった。
- **未確認：** Cloud Runの1 vCPU、実クラウド、最悪入力、長時間、3人以上の同時利用。この端末は10コアで、workerが別コアを使える。1 vCPUで同じ効果が出るとは言えない。

## 環境

| 項目 | 値 |
| --- | --- |
| 端末 | Apple M5、論理10コア、メモリ16GB、macOS（darwin 25.4.0、arm64） |
| Node.js | v24.21.0（候補packageが固定する版） |
| Engine | `packages/prediction`。最終変更commit `a49cbfd`、作業ツリーの変更なし。package内のTypeScript 5.8.3でbuild |
| サーバー | [隔離候補1.7.7](candidate-1.7.7/README.md)。Fastify 5.12.5、Better Auth 1.7.7、pg 8.23.0 |
| PostgreSQL | 18.4（`embedded-postgres`の実バイナリ、空の合成DB） |
| 使えなかったもの | Docker、gcloud、pwsh |

負荷生成・API・PostgreSQLは同じ端末で動かした。数値は桁の目安として読む。

## T-14（単体）

Engineの[benchmark.mjs](../../packages/prediction/scripts/benchmark.mjs)を、変更せずにNode 24.21.0で3回実行した。K=200、horizon 1095、seed固定。各回は初回＋5回の最大値。

| 必要なDONE回数 | 1回目 | 2回目 | 3回目 | 判定（各500ms未満） |
| --- | --- | --- | --- | --- |
| 120 | 38.7ms | 37.8ms | 36.6ms | PASS |
| 400 | 72.4ms | 74.1ms | 73.9ms | PASS |
| 1095 | 34.4ms | 34.7ms | 39.8ms | PASS |

1回目は単独実行、2・3回目は検証スクリプト内の実行。同じNode 24.21.0で、Engineの47テストもすべて通った。

## 混合負荷

### 条件

- 合成ユーザー2人。予測するGoalは3つで、残りのDONE回数がT-14の120／400／1095になるようにした。
- 各Goalに60日分の記録を入れた。昨日と今日は未記録にした。
- 記録の書き込みは別のGoalへ送った。予測するGoalを「今日は未記録」のまま保つため。
- CRUD系（Goal一覧、記録の書き込み、セッション確認）を毎秒20件、`/today`を毎秒1／4／10件、一定間隔で送った。
- 計測8秒、warmup 1秒、DB接続pool 5、worker 2本。全体を2回実行した。

### 結果

単位はms。1回目／2回目の順。全条件でHTTPエラー0件。

| 計算 | 実行方式 | today到着 | CRUD p95 | セッション確認 p95 | today p95 | サーバー内の計算 最大 | event-loop最大 | CPU使用率 | RSS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| なし（基準） | 同期 | 4/秒 | 5.8／5.1 | 8.3／8.7 | 9.7／6.0 | — | 12.1／12.4 | 0.10／0.09 | 191MB |
| 実Engine | 同期 | 1/秒 | 39.1／40.1 | 44.7／25.5 | 117.0／117.5 | 111.4／113.6 | 120.5／122.2 | 0.18／0.17 | 195MB |
| 実Engine | worker×2 | 1/秒 | 6.2／5.1 | 7.7／6.5 | 116.7／115.2 | 111.2／110.8 | 13.2／13.2 | 0.17／0.16 | 260MB |
| 実Engine | 同期 | 4/秒 | 64.8／65.5 | 87.6／81.8 | 112.5／113.3 | 109.5／110.6 | 116.5／119.2 | 0.36／0.36 | 198〜203MB |
| 実Engine | worker×2 | 4/秒 | 3.4／3.3 | 4.9／4.7 | 108.8／114.7 | 107.3／110.3 | 12.1／11.4 | 0.33／0.34 | 269〜273MB |
| 実Engine | 同期 | 10/秒 | 79.0／85.2 | 81.7／36.2 | 86.4／87.0 | 85.3／86.4 | 94.2／95.1 | 0.63／0.63 | 216〜228MB |
| 実Engine | worker×2 | 10/秒 | 1.5／1.4 | 2.0／1.8 | 87.6／87.3 | 86.8／88.9 | 11.6／11.5 | 0.57／0.57 | 270〜273MB |

### 読み取り

- **`/today`はすべて実Engineが計算した。** 応答の計算元と残り回数をクライアント側で数え、3つの大きさがすべて含まれることを確認した。
- **サーバー内の計算は最大85〜114ms。** 単体のT-14（34〜75ms）より長い。入力が違う（60日分の記録）ことに加え、条件ごとにプロセスを起動し直している。原因の切り分けはしていない。
- **同期実行では、計算1回分がそのまま他の要求の待ち時間になる。** event-loopの最大遅延は計算の最大値とほぼ同じだった。CRUDのp50は2〜21msで、計算と重なった要求だけが遅れている。
- **毎秒10件でも破綻しなかった。** CPU使用率は0.63で、未完了は計測終了時の1件だけ。代用計算の「500ms×毎秒4件」のような積み上がりは起きなかった。
- **worker 2本では、CRUDとセッション確認は計算の影響を受けなかった。** workerの空き待ちは0.05ms以下。RSSは約45〜75MB増えた。

## 今回の検証が示さないこと

- **1 vCPUでの挙動。** workerを使っても、コアが1つなら計算とCRUDがCPUを取り合う。Cloud Runの1 vCPU・512MiBで同じ結果になる証拠ではない。
- **配備先の計算時間。** M5より遅いCPUでは計算が伸びる。採用環境でのT-14の再計測は残る。
- **最悪入力。** 代表3入力だけを使った。全入力での上限ではない。
- **長時間・多人数。** 各条件8秒、2人。メモリの伸びや接続数の上限は見ていない。
- **Productの応答形式。** `/today`に載せた計算元・計算時間は負荷観測用で、採択した契約ではない。

## チームが判断する項目への影響

[比較文書 v3.1](SELECTION-v3.1.md)の方針は「計算が100msを超えるなら、同一プロセス内のworker poolで実行する」。今回のサーバー内の計算は最大85〜114msで、この境界の前後にある。1 vCPUでの計測がまだないので、予測の実行場所（同期かworkerか）はここでは決めない。判断には次が要る。

1. 1 vCPUに制限したLinuxコンテナで、同じスクリプトを実行する。
2. 承認後の実Cloud Runで、T-14と混合負荷を実行する（[計画](CLOUD-TRIAL-PLAN.md)）。

## 再実行

リポジトリのルートから実行する。Secretの実値とDockerは不要。使用ポートは3230と55592。

```bash
cd packages/prediction && npm ci && cd ../..
cd experiments/architecture-verification/candidate-1.7.7 && npm ci
./node_modules/.bin/node ../../../packages/prediction/scripts/check.mjs test
npm run typecheck
npm run verify:real-engine
```

`check.mjs test`がEngineをbuildして47テストを実行する。buildがないと`verify:real-engine`は開始前に止まる。結果は`results/post-fix/v8-real-engine-mixed-load.json`に上書きされる。今回の生結果は[2回分](results/2026-10-05/real-engine/)を保存した。

## 検証コードの変更

- [predict-real.ts](candidate-1.7.7/src/predict-real.ts)：buildした実Engineの`predict`を呼び、計算時間を測る。
- `predict-pool.ts`・`predict-worker.ts`：同じworker poolで実Engineを実行できるようにした。
- `app.ts`・`server.ts`・`contracts.ts`：`SPIKE_PREDICT_ENGINE=real`のときだけ`/today`が実Engineを呼ぶ。既定は従来の代用計算のまま。
- [v8-real-engine-mixed-load.ts](candidate-1.7.7/verify/v8-real-engine-mixed-load.ts)：T-14の実行、配線の確認、混合負荷。

親package（1.7.6の履歴）と`packages/prediction`は変更していない。
