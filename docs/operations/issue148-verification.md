# #148 phase1の検証記録

対象はIssue #148と引継ぎZIPのACCEPTANCE-DESIGN.mdにある36ケース。通常checkoutのEngine2・.vscode、元spec-harnessの途中FE6ファイルを保全し、独立worktreeで25f473feを起点に実装した。初回引継ぎではmain ca002394を取り込んだ。後続FE引継ぎの基準mainと検証は下記へ分ける。元タスクのAPI/migration実行審査拒否を解消済みとは扱わず、今回の直接実装指示を根拠とする具体操作の審査が通過した。承認転記・他経路の回避は行わない。本番変更・merge・deployは未実施。

## 初回引継ぎのローカル結果（ffe7604まで）

実装commit 3a5b10cと、その後のDemo試験の明示量1の送信修正を対象に再実行した。後続変更は検証記録・参照番号・合成専用Compose。リモート最終HEADのCIはDraft PRのChecksで別に確認し、ここへ過去SHAのCI成功を流用しない。

| 検証 | 結果と範囲 |
| --- | --- |
| Node24.21.0、各worktree自身の依存 | 通常ディレクトリ。既存node_modules junctionを再利用せず、lockfileからinstall |
| `npm run typecheck` | 全workspace成功 |
| `npm test` | API145・FE60・Prediction70、合計275成功／失敗0／skip0 |
| `npm run build` | 全workspace成功 |
| `scripts/check-foundation.ps1` | 成功：text files・local links・環境例・ignore・diff。アプリ検証の代替ではない |
| 受入U01〜U06、V01〜V08、I01〜I10、M01〜M02 | 全26 ID成功。API/DB24 node testsへ複数oracleをまとめた。全API145に含む |
| migration source | 初回・再実行、移行前1〜4のGoal/log量・日付・metadata保全、旧SKIP-onlyの保守lock成功（M01） |
| migration compiled/container | 専用の空DBへ認証→app1〜5を初回適用、再実行auth/app差分なし成功 |
| Chrome＋新SPA/API image | F01〜F10とF06-late-operation、11成功。合成Docker DB、8097のみ |
| #147とのローカル併用 | PR147 HEAD bc24cc0156ab56c24065b6daac4d7908f2465cbaと3a5b10cの隔離コピーで型・build成功、8098実API/UIの同11ケース成功。PR147へ書込・pushなし |
| 独立敵対レビュー | 別コンテキストの静的レビュー。遅延K1応答が新K2の回復情報を消すP1を修正し、単体＋実ブラウザ回帰を追加。再レビューでBlockingなし。独立したテスト実行やHuman Approveではない |

#147併用ではGoalFormPageの2箇所で画面配置と保存中disabledを両方保持し、Goal API testsの2箇所でprogressDoneと設定版／unitLockedを両方保持した。progressDone・PageTitle・reason=expired・P-17・auth/router/layout/fontを#148へ重複実装しない。#156/#158はmainから保持した。#153のAPI cache、#155のFE所有者境界（PR159）、#157（PR163）、#162（PR173）は未mergeで別作業。並行PRのP-19／D-28と重複しないよう、本変更をP-20／D-29とした。

検証image ID：`sha256:97cf0724bada72c272843cf1a0ce2e5247943d72f97120d6c2a87f7346bee2e7`。このimageのアプリsourceは3a5b10cと同一。

## 再現方法と証拠の限界

Nodeはpackage.jsonの24.21.0。`npm ci --ignore-scripts --no-audit --no-fund`後、`npm run typecheck`、`npm test`、`npm run build`を実行する。DATABASE_URLは専用合成PostgreSQLの管理用接続のみを渡す。テストは個別DBを作成・終了後dropする。普段の環境・本番URLを使わない。

[合成専用Compose](../../apps/web/tests/fixtures/issue148-compose.yaml)を`docker compose -f apps/web/tests/fixtures/issue148-compose.yaml up -d --build`で起動する。project future-roi-148-takeover、loopback8097の専用SPA/API image、15488のPostgreSQL（database futureroi_issue148、role issue148_synthetic）、tmpfsと合成認証Secretのみ。普段の8080・audit8088/8089や旧projectを使わない。試験用sign-up/sign-in上限100はこの環境だけで、製品の既定値を変更しない。

`/api/health`が成功した後、[browser runner](../../apps/web/tests/issue148-browser.mjs)を`node apps/web/tests/issue148-browser.mjs`で明示実行する。既存playwright-coreの絶対pathをISSUE148_PLAYWRIGHT_ROOT、既存Chrome/Edge executableをISSUE148_BROWSER_EXEへ指定する。依存・ブラウザを自動導入しない。runner冒頭でDB名・roleを照合し、結果はGit除外の`.tools/issue148/browser/results.json`に出す。終了時は同じComposeの`stop`で専用環境だけ停止する。

`ISSUE148_PLAYWRIGHT_ROOT`と`ISSUE148_BROWSER_EXE`は必須で、個人のWindows pathへの既定値はない。未設定・空白なら不足変数と本手順を表示し、DB接続・ブラウザ起動前にexit 1となる（[入口の回帰](../../apps/web/tests/browser-configuration.test.mjs)）。OSごとの既存インストールpathを明示する。別専用projectで実行する場合は`ISSUE148_ORIGIN`と`ISSUE148_DB_PORT`もそのloopback endpointへ合わせる。smoke脚本の作成UUIDは起動済みapp内の固定Nodeから`node:crypto.randomUUID()`で取得する。hostの`/proc`やuuidgenは不要。macOSでの実行確認は別途必要。

### 作成結果が不明な場合の確認手順

1. POST応答の切断・5xxでは「失敗して未作成」と断定しない。同ownerのsessionStorage原文（キーと元body）を保持し、入力は固定する。自動POSTや新key発行はしない。
2. 同accountで「もう一度保存」、または戻る／reload後の「保存する」を明示選択する。非cache sessionでownerを確認し、同key／元bodyを送る。作成済みなら現在DTOへ回復し、Goalは増えない（F06・F19）。
3. 確定422では該当操作だけを終了し、項目エラーへ焦点を移す。利用者が訂正して保存すると初めて新keyを発行する（F08・実APIのF17）。読取／削除例外なら原文を残して回復エラーを示し、一覧で確認する（F20）。
4. 409入力不一致は盲目的に再送せず一覧で確認する。owner変更は作成時accountで再確認する。削除結果410に限り「新しいGoalとして作成」を明示選択でき、新keyは次の保存で発行する（F11・F14・F15）。

遅延応答の終了条件はowner・key・保存原文の一致。F06-late-operationは遅延成功、F18は人工遅延422とK2の応答切断を制御して逆順を確認する。NULの確定422はF17・F20で実APIを使い、Storage例外だけを人工条件にする。

F01の昨日は合成Goalの開始日を1日前に設定して試験し、自然な2日間の利用試験とは扱わない。F02の503、F03のGET503、F06のPOST commit後応答切断、F08の確定422、F10の保存後GET失敗は人工条件。I03のAPI試験は受信済み結果を捨てるケースで、実通信切断はF06で別に検証する。競合順は行lock待機を観測・制御し、sleepだけで成功を主張しない。F06-late-operationは古い送信の応答を保留し、新しい送信をcommit後に切断してから古い応答を返す。新キー保全とreload回復をassertした。

## 途中の失敗・中断

全回帰初回はローカルメモリ不足下の接続timeout等で中断し、PASSではない。起動した自分のrunnerをPID・親子関係で特定して停止した。stale PID fileの正規停止はNo such processとなり、現存する自分のクラスタを別途確認して停止した。生成data dirは削除していない。その後の失敗にはR-11の回答snapshotへ公開contextの追加項目を渡す不整合、旧テストの禁止unit変更と量省略があった。原因を修正し、期待値を弱めず全回帰を再実行した。

ブラウザの途中実行では待受前socket hangup、観測DOMと異なるselector、試験用sign-up制限、最新取得中のdisabled待機不足で失敗した。専用環境・runnerを直して最終11成功を確認した。#147併用初回型チェックはGoal DTO testsの競合marker残存で失敗し、両側項目を統合した再実行で成功した。

## 未実行・残件

- 内部3人での担当交代・初見利用者の理解確認：NOT_RUN。
- Human Approve、チームによる契約採択、main反映、本番migration、公開配置：未実施。
- 初回HEADでは`CREATE_RESULT_DELETED`のAPI410・台帳保持・復活禁止を検証した。FEの明示新規操作は初回では未追加で、下記の追加引継ぎで対応する。
- 同日ログ一般の競合解消、削除CAS、全mutation冪等性、#147の画面再設計、#153/#155のcache方針は範囲外。

初回セルフレビューのBlockingは修正済み。実利用受入・チームの契約採択・Human Approveは残件であり、ローカル・CI・人工障害の成功で代替しない。READMEの一般setupや製品runtime環境変数は変わらないため追加更新不要。

## FEの追加引継ぎ（2026-10-09）

元のworktreeを上書きせず、`ffe76048c3858101e4ed2d7bf3c225c53a8c8f8e`から専用worktree／ローカルbranchで継続する。今回の直接指示でstashの3件に加えて409分類・破損回復情報・旧change-mapの同期を扱う。#147（main 685e7d0）・#176（main 10c1df73）のmerge競合を解消し、progressDone・画面配置・単位固定・設定版・明示量と動的migration checkerを両方保持する。追加のschemaやdependencyは導入しない。元の審査拒否の撤回や他のbranchの承認として扱わない。

- 409回復の直接GETはAbortSignalを渡し、離脱・境界変更で中断する。ownerと開始時のPrivateEpochの同一性を確認してからcacheへ反映し、同じownerに戻るA→B→Aも旧世代の応答を捨てる。
- 410が確定した同owner／keyに限って「新しいGoalとして作成」を出す。操作を選ぶまで入力・キーを保持し、選んだ後も新キーは次の保存で初めて発行する。通信結果不明は同じキーで回復する。削除Goalは復活しない。
- 壊れたJSON・旧schemaは初期描画を止めず、原文を保持してPOSTを止める。409の入力不一致は一覧確認、owner変更は作成時accountでの再認証へ案内する。通信失敗での同key/body保全と区別し、自動破棄・新key発行・自動再作成をしない。
- 409後に最新unitLockedと編集単位が食い違った場合は「保存済みの単位に戻す」を出す。ほかの入力を残し、自動保存しない。

修正前：Node24.21.0の遅延GET回帰は同世代1成功、A→B／A→B→A／離脱3失敗。実ChromeのF11（410）・F12（単位固定）は必要なボタンが存在せず2失敗。修正後の遅延GET回帰4件は成功。これは実hookとQueryClientを使う制御回帰で、Reactの描画・実認証でのアカウント切替の証明ではない。

途中の実Chrome再実行は専用appのmigration checksum不一致（LF/CRLFのartifact差）により接続拒否で失敗した。PASSとしていない。SQLや適用履歴のchecksumは変更せず、停止済みtmpfsを起動した新しい合成DBでpublic表0件を確認し、Gitのartifactから作った同一imageだけで初期化した。

### 追加引継ぎのローカル結果

実装commit `45000427739d1afa381676dd86e3c0fac7cc8574`と追加のbrowser runner修正を対象に、Node24.21.0で再実行した。記録・runnerの最終commit後にも同HEADで型・全test・build・Foundation、Git artifactのimageとブラウザを再実行し、最終remote HEADとCIのSHA・結果は[PR #175](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/175)へ記録する。初回の275件・旧image・旧SHAのCIは本追加の成功へ流用しない。

| 検証 | 結果と範囲 |
| --- | --- |
| `npm run typecheck` / `npm run build` | 全workspace成功 |
| `npm test` | API147・FE75・Prediction70、合計292成功／失敗0／skip0。遅延GET4件・回復情報破損・409分類を含む |
| Foundation / 動的migration checker | `scripts/check-foundation.ps1`成功。`node --test scripts/tests/check-migrations.test.mjs`の5件成功。#176のcheckerとmigration実ファイルinventoryを保持 |
| compiled migration | 空の合成DBへauth・app0001〜0005を適用。same imageの再実行はauth tables/columnsとapp appliedがすべて空、checker `noop`成功 |
| 実Chrome / 専用SPA・API image | F01〜F16＋F06-late-operationの17件を通し実行して成功。409・410・応答切断・単位復帰・破損情報・別owner・#147の進捗/desktop配置を確認 |
| 保全 | 通常checkoutと元spec-harnessのtracked差分hashは開始時と一致。元直接worktreeはcleanのまま。stash `5615001f7c41ddbbed7e8ee3d13dd81b17ec43bc`はapply後も保持 |

専用環境はworktree内`.tools/issue148-fe/compose.yaml`、project `future-roi-148-fe-followup`、SPA/API `18097`、DB `15588`。browser runnerへ`ISSUE148_ORIGIN=http://127.0.0.1:18097`と`ISSUE148_DB_PORT=15588`を渡す。`git archive HEAD`のtracked artifact（SQLはGitのLF）をstandard Dockerfileでbuildする。上記実装commitのimageは`sha256:78c127937875314775b81bef31321a3dcc5df92b1a9eeb50964b1cab25d68be7`、revision labelは同commit。以後の記録・runnerだけのcommitでも新HEADのartifactを作り直す。DBの適用履歴・checksum・認証制限行は書き換えない。停止はこのprojectの`stop`だけを使う。

追加実行の途中では、Docker依存取得の通信timeout、実DOMの`p`をheadingとして探したselector、保存ボタンの待機timeout、通し実行での認証GET429が発生した。Oracle（保存量・件数・owner/key/body・raw保持）は弱めず、DOM selectorと待機を修正した。固定版のDB limiterは直前の許可要求から60秒間要求が途切れるとresetするため、5ケースごとに認証要求を止めて待つ。製品の制限値やDB行は変更していない。全workspace初回のAPI146/147・FE75・Prediction70はDemo登録時のDB接続失敗による500で全体失敗。Demo12件の単独再実行と、その後の全workspace292件の再実行は成功した。単独で再現しなかった原因をFEロジックの欠陥と断定しない。

今回のセルフレビューはIssue契約、owner/epoch、回復情報の保全、両側merge内容、文書と実装を照合しBlockingなし。独立した再レビューやHuman Approve、内部3人・初見利用者の受入、本番migration・merge・deployは未実施。

#159／#163の全統合は別段階。初回のGit比較では#147と3、#159と1、#163と13ファイルが競合し、#164は競合しなかった。二つの0005は全文ファイル名が異なり、runnerはファイル名・checksumで管理するため番号重複だけでは失敗しない。統合時は両migration・実ファイルinventory・M01を照合する（#174/#176の動的checkerは今回保持）。targetDateは作成hash・設定版・rebase・固定attemptにも接続する必要があり、このFE修正では未実装。

## PR #175の再レビュー修正（2026-10-09）

remote `608df0c3de388e25338ce8393fd453e07c7948fc`から別worktree／local branch `fix/148-review-followup`を作り、main `48b5f4270c855bb015f8b7b91ca7a7ae4b0bf891`を取り込んだ。change-mapの競合は#147／#176／#181の現在地と#148追加契約を保持して解消。旧175 worktree・stash・通常checkout・#159 branchへ書き込まない。

- S2：browser runnerの個人Windows path既定値を廃止。必須2環境変数不足はDB・browser前に理由付きexit 1。片方／両方未設定の3回帰を追加。
- S3：2 smoke脚本は起動済みapp内の固定NodeでUUIDを生成する。Git Bashの構文確認と専用app内でUUID取得を確認。macOS実機はNOT_RUN。
- Q1：上の確認手順で切断／5xxと確定422／409／410を分ける。未知結果は同owner・key・元body／rawを保持し、自動POST・新key発行をしない。
- NULの確定422：cleanupが初回ロードのbody schema検証を再利用して`CreateRecoveryError`となり、項目エラー表示と入力復帰を止めていた。修正前の単体回帰は実際に失敗。cleanupを送信snapshotのowner・key・raw照合に限定し、初回ロードの厳密検証を保持した。Storage例外時は操作と原文を残し、回復エラーと422の項目エラーを両方表示する。

修正後の初回全workspace回帰はNode24.21.0でAPI149・FE81・Prediction70、計300成功／失敗0／skip0。型検査・Foundation・動的migration checker5件成功。新規Chrome回帰はF17（実NUL422から訂正）・F18（人工遅延422対K2）・F19（人工503）・F20のStorage読取／削除例外の5件成功。F18初回は未作成の一覧に存在しない「Goalを追加」を探してtimeoutとなり、K2の判定へ未到達だった。実画面の「最初のGoalをつくる」へselectorを訂正して再実行し、raw・キー・本文・件数のoracleを維持した。専用app初回health probeの接続切断もPASSに含めず、migration完了後のhealth成功を別に確認した。

今回の専用ComposeはGit除外`.tools/review175/compose.yaml`、project `codex-task5-pr175-review`、app18175／DB15675、合成DB `futureroi_issue148`／role `issue148_synthetic`のtmpfs。最終commit後のGit artifact・revision labelを持つimageで空DBへのcompiled migration／再実行no-op・実Chrome全22ケースを確認する。最終HEAD・image ID・そのHEADでの全体回帰／CI／独立レビュー結果はPR #175に記録し、旧608のCIや過去imageを新HEADの成功へ流用しない。

API・共有schema・SQL・dependency・CI・製品のauth設定に新しい変更を追加しない。取り込んだmainの私的API no-storeは保持する。#159の最新SHAとの併用は親タスクの独立確認対象で、本修正単独の成功から統合成功を主張しない。Human Approve・チーム採択・内部3人／初見受入・macOS実機・本番migration・merge・deployは未実施。

## 変更ファイル

- [.github/workflows/application.yml](../../.github/workflows/application.yml)
- [apps/api/migrations/0005_goal_data_integrity.sql](../../apps/api/migrations/0005_goal_data_integrity.sql)
- [apps/api/src/contracts/goal.ts](../../apps/api/src/contracts/goal.ts)
- [apps/api/src/contracts/log.ts](../../apps/api/src/contracts/log.ts)
- [apps/api/src/contracts/r11.ts](../../apps/api/src/contracts/r11.ts)
- [apps/api/src/db/seed-demo.ts](../../apps/api/src/db/seed-demo.ts)
- [apps/api/src/goals/routes.ts](../../apps/api/src/goals/routes.ts)
- [apps/api/src/goals/store.ts](../../apps/api/src/goals/store.ts)
- [apps/api/src/logs/routes.ts](../../apps/api/src/logs/routes.ts)
- [apps/api/src/logs/store.ts](../../apps/api/src/logs/store.ts)
- [apps/api/src/prediction/r11.ts](../../apps/api/src/prediction/r11.ts)
- [apps/api/src/prediction/store.ts](../../apps/api/src/prediction/store.ts)
- [apps/api/tests/demo-seed.test.ts](../../apps/api/tests/demo-seed.test.ts)
- [apps/api/tests/goal-data-integrity.test.ts](../../apps/api/tests/goal-data-integrity.test.ts)
- [apps/api/tests/goals-concurrency.test.ts](../../apps/api/tests/goals-concurrency.test.ts)
- [apps/api/tests/goals.test.ts](../../apps/api/tests/goals.test.ts)
- [apps/api/tests/helpers/stack.ts](../../apps/api/tests/helpers/stack.ts)
- [apps/api/tests/logs.test.ts](../../apps/api/tests/logs.test.ts)
- [apps/api/tests/migrate.test.ts](../../apps/api/tests/migrate.test.ts)
- [apps/api/tests/question-prior-http.test.ts](../../apps/api/tests/question-prior-http.test.ts)
- [apps/api/tests/question-prior.test.ts](../../apps/api/tests/question-prior.test.ts)
- [apps/api/tests/record-concurrency.test.ts](../../apps/api/tests/record-concurrency.test.ts)
- [apps/api/tests/seed-r11-compatibility.test.ts](../../apps/api/tests/seed-r11-compatibility.test.ts)
- [apps/web/src/api/goals-http.ts](../../apps/web/src/api/goals-http.ts)
- [apps/web/src/api/http.ts](../../apps/web/src/api/http.ts)
- [apps/web/src/api/today-http.ts](../../apps/web/src/api/today-http.ts)
- [apps/web/src/copy/goals.ts](../../apps/web/src/copy/goals.ts)
- [apps/web/src/features/goals/GoalFormPage.tsx](../../apps/web/src/features/goals/GoalFormPage.tsx)
- [apps/web/src/features/goals/create-attempt.ts](../../apps/web/src/features/goals/create-attempt.ts)
- [apps/web/src/features/goals/goal-form.ts](../../apps/web/src/features/goals/goal-form.ts)
- [apps/web/src/features/logs/RecordChoiceBar.tsx](../../apps/web/src/features/logs/RecordChoiceBar.tsx)
- [apps/web/src/features/logs/SaveFailure.tsx](../../apps/web/src/features/logs/SaveFailure.tsx)
- [apps/web/src/features/logs/YesterdayCorrection.tsx](../../apps/web/src/features/logs/YesterdayCorrection.tsx)
- [apps/web/src/features/logs/YesterdayPrompt.tsx](../../apps/web/src/features/logs/YesterdayPrompt.tsx)
- [apps/web/src/features/logs/record-log.ts](../../apps/web/src/features/logs/record-log.ts)
- [apps/web/src/features/logs/useSaveLog.ts](../../apps/web/src/features/logs/useSaveLog.ts)
- [apps/web/src/features/today/TodayPage.tsx](../../apps/web/src/features/today/TodayPage.tsx)
- [apps/web/src/features/today/snapshot.ts](../../apps/web/src/features/today/snapshot.ts)
- [apps/web/tests/fixtures/issue148-compose.yaml](../../apps/web/tests/fixtures/issue148-compose.yaml)
- [apps/web/tests/goal-form.test.mjs](../../apps/web/tests/goal-form.test.mjs)
- [apps/web/tests/goal-integrity.test.mjs](../../apps/web/tests/goal-integrity.test.mjs)
- [apps/web/tests/goal-recovery.test.mjs](../../apps/web/tests/goal-recovery.test.mjs)
- [apps/web/tests/issue148-browser.mjs](../../apps/web/tests/issue148-browser.mjs)
- [apps/web/tests/record-log.test.mjs](../../apps/web/tests/record-log.test.mjs)
- [apps/web/tests/today-data.test.mjs](../../apps/web/tests/today-data.test.mjs)
- [docs/architecture.md](../../docs/architecture.md)
- [docs/change-map.md](../../docs/change-map.md)
- [docs/operations/issue148-verification.md](../../docs/operations/issue148-verification.md)
- [docs/product-spec.md](../../docs/product-spec.md)
- [scripts/smoke-compose.sh](../../scripts/smoke-compose.sh)
- [scripts/smoke-container.sh](../../scripts/smoke-container.sh)
