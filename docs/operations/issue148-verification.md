# #148 phase1の検証記録

対象はIssue #148と引継ぎZIPのACCEPTANCE-DESIGN.mdにある36ケース。通常checkoutのEngine2・.vscode、元spec-harnessの途中FE6ファイルを保全し、独立worktreeで25f473feを起点に実装した。元タスクのAPI/migration実行審査拒否を解消済みとは扱わず、今回の直接実装指示を根拠とする具体操作の審査が通過した。承認転記・他経路の回避は行わない。本番変更・merge・deployは未実施。

## 実行と範囲

- API/DB受入初回：24 node tests、成功24、失敗0、skip0。U01〜U06、V01〜V08、I01〜I10、M01〜M02を複数oracleへまとめている。受入ID数とnode test数は同じではない。
- 修正後型チェック：成功。FE単体：53件成功、失敗0、skip0。
- 全回帰初回：ローカルメモリ不足下で接続timeoutなどが発生し中断。PASSではない。起動した自分のrunnerをPID・親子関係で特定して停止した。stale PID fileの正規停止はNo such processとなったため、現存する自分のクラスタを別途確認して停止した。生成data dirは削除していない。
- 実ブラウザ初回：待受前socket hangupで失敗。2回目：selector不一致・試験用sign-up上限で失敗。製品動作の成功証拠ではない。runnerを観測DOMに合わせ、専用環境だけAUTH_SIGN_UP_MAX／AUTH_SIGN_IN_MAXを100にして再検証する。
- 現在の全回帰・image・実ブラウザの最終結果は後続の更新で記録する。未完了を合格とは扱わない。

## 再現方法

Nodeはpackage.jsonの24.21.0。`npm ci --ignore-scripts --no-audit --no-fund`後、`npm run typecheck`、`npm test`、`npm run build`を実行する。DATABASE_URLは専用合成PostgreSQLの管理用接続のみを渡す（テストは個別DBを作成・終了後drop）。普段の環境・本番URLを使わない。

ブラウザrunnerは[issue148-browser.mjs](../../apps/web/tests/issue148-browser.mjs)。既存playwright-coreの絶対pathをISSUE148_PLAYWRIGHT_ROOT、既存Chrome/Edge executableをISSUE148_BROWSER_EXEに指定する。依存やブラウザを自動導入しない。loopback8097の専用SPA/API image、15488のPostgreSQL（database futureroi_issue148、role issue148_synthetic）だけを操作する。`.tools/issue148/compose.yaml`は同名の専用project・tmpfsで起動し、BETTER_AUTH_URLは8097、合成Secretのみを使用する。runner冒頭でDB名・roleを照合する。通常8080・audit8088/8089や旧projectを使わない。

F01の昨日は合成Goalの開始日を1日前に設定して試験し、自然な2日間の利用試験とは扱わない。F02の503、F03のGET503、F06のPOST commit後応答切断、F08の確定422、F10の保存後GET失敗は人工条件。I03のAPI試験は受信済み結果を捨てるケースで、実通信切断はF06で別に検証する。競合順は行lock待機を観測・制御し、sleepだけで成功を主張しない。

## 残る受入

内部3人での担当交代・初見利用者の理解確認はNOT_RUN。独立した逆対レビュー・Human Approve・main反映・本番migration・公開配置も未完了。セルフレビュー・人工障害・CI成功でこれらを代替しない。同日ログ一般の競合解消、削除CAS、#147の画面再設計、#153/#155のcache方針は範囲外。
