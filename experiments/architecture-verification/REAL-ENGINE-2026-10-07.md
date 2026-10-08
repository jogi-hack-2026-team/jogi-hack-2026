# 実Engine混合負荷の訂正と公開R-11の別検証（2026-10-07）

**Supporting Artifact / Not a Source of Truth。採択・本実装・配備先の性能証拠ではない。Refs #84 / PR #131。**

旧[2026-10-05報告](REAL-ENGINE-2026-10-05.md)の混合負荷は、今日の仮想DONE控除により意図した回数より1回小さく、warmup応答が測定へ混入していた。旧JSONは改変しない。以下は隔離候補だけの修正・新しい日時の検証であり、本体Engine・Product DTO・prior採択・worker本採択を変更しない。

## 入力と測定境界

- 60日の合成履歴は40 DONE×30＝1200、20 SKIPPED。昨日と今日は未記録。N＝120／400／1095に対し残量は `(N+1)×30`、Goal totalは4830／13230／34080。todayの仮想DONEを1回引いた将来DONE回数がNになる。
- oracleはDBのGoal、実DONE量、today状態からBigIntで独立計算する。serverのprogressや自己申告回数はoracleの入力にしない。保存JSONに全入力・oracleを含め、各応答を送信先Goalのoracleと照合する。
- warmupは送信時のcohortに固定し、送信停止→全応答drain→server metrics reset→測定→送信停止→全応答drain→metrics取得の順とする。list/write/session/todayそれぞれにsent＝success＋failure、server compute count＝測定today成功数を検査する。
- 原7条件（computeなし基準、旧predict inline/workerでtoday 1/4/10rps）はCRUD20rps、2合成identity、worker2本、pool5、warmup1秒、測定8秒のまま。R-11公開入口は同じ7条件を別実行し、強度4の既存mappingと回答HIGH/LOWを記録する。旧predictの結果をR-11性能へ流用しない。

## 回帰と失敗処理

固定Node24.21.0で候補typecheckと[10件回帰](candidate-1.7.7/verify/v9-real-engine-regression.test.ts)が成功。fraction10.5／安全整数外／DB numericの精度喪失／実績合計overflow、Engine例外後の正常job、worker exit/error、不正envelope、postMessage clone失敗、close時のrunning/queuedと以後のjob、遅いwarmup応答を確認した。HTTP境界は合成sessionとin-memory DB stubによる確認であり、実DB性能試験と区別する。

real modeだけ入力量をEngineの安全整数境界へ合わせる。workerはjob例外をenvelopeで返し、親がrejectする。予期しないworker deathではpool全体を利用不可にし、running/queued/以後のjobをrejectする。HTTPは503、healthは応答を継続する。正常jobの失敗はworkerを保持し、次jobを計算できる。[Node24の公式error/exit仕様](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html#event-error)を確認した。終了・再送・closeは同じ失敗状態を使い、Promiseを残さない。

測定runnerの[ledger回帰](candidate-1.7.7/verify/measurement-ledger.test.ps1)もPASS。有効な保存済みFAILの後に残りrunを収集して最終exit1を維持する。結果なし・実行エラーは中断し、空ledgerをPASSにしない。all-PASSだけexit0。測定窓・500ms判定・assertionを緩めていない。

## 旧predictの新測定

[run1／run2と実行ledger](results/2026-10-07/real-engine-review/20261007T113320Z/)は候補HEAD `93a4efd4e80cdef3811a47880d6bd520257e94e1`、参照main `e55d3cea9fc97860191939e6aa7173215b3df29b`。CPUはIntel i7-1360P・論理16CPU、メモリ15.6GiB、Windows x64、Node24.21.0。generator・API・DBは同じ端末、他UI tests/buildを停止して逐次測定した。Engineの最終変更 `16792bf`、source tree `5fb64f192b965b22b4597c9ace473e0e7bbe150f`、dist hash `b8b3c4b7c2c8ca2c8dc57daae4b4079f6c6c2d762533d140932f50f149681ab5`。

旧predict単体T-14は両回PASS。各入力は初回＋5回の全sampleで500ms未満、最大は120で102.06／153.02ms、400で216.01／196.70ms、1095で84.19／17.86ms。初回・暖機5回・seed/config・全入力は生JSONの `engineBenchmarkRaw` を参照。T-14の30日入力と混合負荷の60日入力を混同しない。

混合負荷はrun1が6PASS/0FAIL、run2が5PASS/1FAIL。両回で独立oracle、送信cohort、server計算件数、要求失敗0件が成立した。**run2 inline4rpsのサービス内計算最大546.83msは500ms未満を満たさずE4 FAIL**。単体T-14 PASSからサービス内の全callをPASSと報告しない。

表は1回目／2回目、時間はms、rpsはtimerの設定値、未完了は測定窓を閉じた瞬間の件数。未完了は全drain後の失敗数ではない。8秒の実送信は旧predictの1rpsで7件、4rpsで31件、10rpsで73〜75件だった。generatorも同じ端末のため厳密な到着率を保証せず、nominal 80件へ補正しない。各条件・種別の実sentと成功/失敗件数はJSONに保存した。

| 条件 | today rps | CRUD p95 | session p95 | today p95 | 計算最大 | 未完了 |
| --- | --- | --- | --- | --- | --- | --- |
| 基準（computeなし） | 4 | 12.0／13.0 | 15.4／23.1 | 11.4／22.6 | — | 0／0 |
| predict inline | 1 | 229.8／214.6 | 180.5／101.9 | 378.2／400.3 | 365.43／388.50 | 0／0 |
| predict worker2 | 1 | 13.1／11.9 | 16.0／23.2 | 477.9／402.9 | 468.71／393.22 | 0／0 |
| predict inline | 4 | 341.9／375.7 | 398.1／498.5 | 397.0／483.9 | 394.53／546.83 | 1／1 |
| predict worker2 | 4 | 9.1／11.0 | 12.4／15.9 | 417.4／426.8 | 435.68／426.25 | 1／1 |
| predict inline | 10 | 5424.5／5530.8 | 8690.9／8838.4 | 5684.2／5664.5 | 486.28／435.95 | 32／33 |
| predict worker2 | 10 | 8.2／9.0 | 10.9／12.6 | 417.0／446.0 | 385.35／472.12 | 2／3 |

inline10rpsは要求失敗がなくても待ち行列が伸び、CRUD p95は5秒を超えた。同じ多コア端末のworkerではその遅延が小さいが、1vCPUの根拠にはしない。旧macOS/M5の数値と比較して環境差の原因を断定しない。各種sent/成功/失敗、実到着数、CPU/RSS/event-loop/DB待ち/worker待ちは全条件を生JSONに保存した。

## 公開R-11の別測定と総合結果

[公開R-11 run1／run2](results/2026-10-07/real-engine-review/20261007T114010Z/)は候補HEAD `b7fb21c1af973041e93aa1b982cd6be119219c3b`。旧predict測定時から変更したのはrunner/ledgerだけで、候補API・worker・負荷generatorの差分はない。測定時の未commit差分は報告入口のREADMEだけで、候補src/verifyはclean。参照mainとdist hashは4runとも一致する。

公開 `predictWithQuestionPrior` は既存 `r11-strength4-v1` mapping（LOW α1/β3、MID α2/β2、HIGH α3/β1）、回答a=HIGH/b=LOW、K200/horizon1095/seed20261012。modelVersionは `m1-question-prior-v1`。単体は旧benchmarkと同じ全入力を直接公開入口へ渡し、初回＋暖機5回を別計測した。最大は120で112.95／126.52ms、400で227.02／187.85ms、1095で119.07／90.31ms、両回とも全callが500ms未満。これは旧predictの単体値の転用ではない。

公開R-11の2runは各7PASS/0FAIL（E0は旧predict単体の参考検査、R11は公開入口の別検査）。混合負荷も各応答のentryPoint・oracle・cohortを検査した。

| 条件 | today rps | CRUD p95 | session p95 | today p95 | 計算最大 | 未完了 |
| --- | --- | --- | --- | --- | --- | --- |
| 基準（computeなし） | 4 | 11.0／10.7 | 16.4／12.7 | 13.3／10.6 | — | 0／0 |
| 公開R-11 inline | 1 | 279.0／218.2 | 236.1／230.0 | 410.2／390.8 | 398.72／372.51 | 0／0 |
| 公開R-11 worker2 | 1 | 9.0／11.7 | 14.0／18.3 | 442.7／352.2 | 396.89／347.08 | 0／0 |
| 公開R-11 inline | 4 | 365.1／304.2 | 344.5／358.5 | 409.4／383.4 | 404.75／379.06 | 1／1 |
| 公開R-11 worker2 | 4 | 10.1／10.1 | 17.3／16.0 | 445.1／437.3 | 468.45／439.88 | 1／1 |
| 公開R-11 inline | 10 | 5798.0／5744.8 | 9272.9／9019.6 | 6016.3／5748.2 | 428.34／409.47 | 33／33 |
| 公開R-11 worker2 | 10 | 7.8／8.2 | 9.2／14.0 | 410.4／418.6 | 374.34／400.56 | 1／1 |

[4run総合JSON](results/2026-10-07/real-engine-review/aggregate.json)は28条件、25PASS/1FAIL、**overallExitCode=1**。R-11だけのrunner exit0で旧predictのE4 FAILを消さない。[集計script](candidate-1.7.7/verify/summarize-real-engine.ps1)が実run JSONと実行ledgerを照合し、全4runが揃わない場合も失敗する。要求失敗は全条件0件だが、inline10rpsの待ち行列・5秒超CRUD遅延は残る。

Windows専用DBは終了確認後に今回所有したdata directoryと生成credentialを削除し、[cleanup証跡](results/2026-10-07/real-engine-review/cleanup.json)を保存した。公開logの絶対checkout pathは `<task-workspace>` へ置換し、数値を含む生JSONは編集していない。

## 環境と起動回帰

候補はPR131の専用checkout、現Engineは別のdetached main checkout `e55d3cea` を参照する。GitHub PR Mergeやローカル履歴統合は行っていない。`SPIKE_ENGINE_ROOT` を親generator・各server・workerへ明示し、参照EngineのHEAD/source tree/dist hashを生結果に記録する。PR同梱の旧distは現mainとして読み込まない。

Node24.21.0/npm11.19.0（既存mise runtime）でroot `npm ci`・Engine buildと、候補の独立 `npm ci` を確認した。現Engineの70テストもNode24で成功。初期のsystem Node22/npm10でのinstall/testは準備作業に留め、測定runtimeと区別する。

初回測定はPG55592のbindで失敗し性能値を取得できなかった。Windowsの除外範囲55552–55651を読み取り確認し、OS設定を変えず未予約・未使用65392へ変更した。[失敗ログ・ledger・短い起動回帰](results/2026-10-07/real-engine-review/20261007T112408Z/)を保持する。起動回帰はstartPg→select1／PostgreSQL18.4版→stopでPASS。これは性能測定ではない。

## 再実行

Node24.21.0/npm11.19.0、専用checkoutと空の合成DBだけを使う。本番DBや既存secretは不要。Engineの参照checkoutは現mainを別途取得しておき、HEADを記録する。

```powershell
# Engine参照checkoutのroot
npm ci --no-audit --no-fund
npm run build:prediction
npm run test --workspace=@futureroi/prediction
# PR131の独立候補checkoutへ移動
cd <PR131 checkout>/experiments/architecture-verification/candidate-1.7.7
npm ci --no-audit --no-fund
$env:SPIKE_ENGINE_ROOT = '<Engine checkout>/packages/prediction'
npm run typecheck
npm run verify:real-regression
# 他tests/buildを止めた測定枠で逐次実行
pwsh -NoProfile -File verify-real-engine.ps1 -EngineRoot $env:SPIKE_ENGINE_ROOT -PgPort 65392
pwsh -NoProfile -File verify/measurement-ledger.test.ps1
pwsh -NoProfile -File verify/summarize-real-engine.ps1 -EvidenceRoot ../results/<UTC日付>/real-engine-review
```

非Windowsは同じ環境変数に加え `SPIKE_PG_PORT=65392`、`SPIKE_PREDICT_ENTRY=predict` または `question-prior`、一意の `SPIKE_RESULT_TAG` を指定して `npm run verify:real-engine` を実行する。今回検証したのはWindows x64の手順であり、別OSの実行結果を保証しない。

今回の途中中断からの再開では `-Entries question-prior` を指定し、旧predictの2runを再実行・上書きせず公開R-11の2runを収集した。新規測定は新しい日時folderを作る。既存4runを保持したrootへさらに追加する場合は別のEvidenceRootに分け、集計scriptの「ちょうど4run」検査をすり抜けない。

## 限界

負荷generator・API・PostgreSQLは同じ端末。代表3入力・各8秒・2人であり、最悪入力、長時間、多人数、1vCPU、実Cloud・課金・配備先性能は未検証。性能値からworkerの本採択やprior採択を決めない。HTTPの観測summaryはProduct DTOではない。
