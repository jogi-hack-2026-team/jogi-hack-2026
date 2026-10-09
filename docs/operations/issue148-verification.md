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

途中の実Chrome再実行は専用appのmigration checksum不一致（LF/CRLFのartifact差）により接続拒否で失敗した。PASSとしていない。SQLや適用履歴のchecksumは変更せず、停止済みtmpfsの新しい合成DBを今回の同一imageだけで初期化して再検証する。最終結果は完了後に追記する。

#159／#163の全統合は別段階。初回のGit比較では#147と3、#159と1、#163と13ファイルが競合し、#164は競合しなかった。二つの0005は全文ファイル名が異なり、runnerはファイル名・checksumで管理するため番号重複だけでは失敗しない。統合時は両migration・実ファイルinventory・M01を照合する（#174/#176の動的checkerは今回保持）。targetDateは作成hash・設定版・rebase・固定attemptにも接続する必要があり、このFE修正では未実装。

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
- [apps/web/tests/issue148-browser.mjs](../../apps/web/tests/issue148-browser.mjs)
- [apps/web/tests/record-log.test.mjs](../../apps/web/tests/record-log.test.mjs)
- [apps/web/tests/today-data.test.mjs](../../apps/web/tests/today-data.test.mjs)
- [docs/architecture.md](../../docs/architecture.md)
- [docs/change-map.md](../../docs/change-map.md)
- [docs/operations/issue148-verification.md](../../docs/operations/issue148-verification.md)
- [docs/product-spec.md](../../docs/product-spec.md)
- [scripts/smoke-compose.sh](../../scripts/smoke-compose.sh)
- [scripts/smoke-container.sh](../../scripts/smoke-container.sh)
