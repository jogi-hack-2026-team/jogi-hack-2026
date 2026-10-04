# Engine接続用の入出力例（#77 / #81 / #82）

**Supporting Doc / Not a Source of Truth.** [正式Engine契約](../../../docs/architecture.md#prediction-engine)と[公開型](../src/types.ts)の利用例。HTTP DTO、DB schema、画面仕様、runtimeの追加採択は行わない。正式アプリ結合は#70後。

## 実行して全入力・実結果を確認する

repo rootで、既存TypeScript compilerの実パスを指定してコンパイル・テスト後、例を実行する。

```powershell
node packages/prediction/scripts/check.mjs test --tsc '<existing-typescript/bin/tsc>'
node packages/prediction/examples/recalculate.mjs
```

[recalculate.mjs](recalculate.mjs)は11ケースそれぞれの`name`、完全な`input`、実`predict`の`calculation`をJSONへ出す。`calculation`は公開`PredictionResult`で、例を識別する外側のname/inputはHTTP応答へ足す契約ではない。既定configはprior=2/K=200/H=1095/seed=20261012。todayは2026-10-10固定で、現在時計を読まない。CIでも同じ例を実行し、各Node版のT14証跡artifactへ保存する。

`ERR_MODULE_NOT_FOUND`ならdist未生成のためtestを先に実行する。compilerが見つからない場合は既存compilerのパスを修正する。コマンドが非0なら失敗のまま確認し、空出力を成功例として扱わない。

## ケースの読み方

共通のGoalはtotal=100/initialProgress=20/sessionAmount=10。記録は3・4日DONE、5・6日SKIPPED、7・9日DONEで、8日はUNKNOWN。DONEの実量は各10。

| name | 入力の変更 | 実績・状態の確認点 |
| --- | --- | --- |
| unknown-gap | 上記のまま。今日未記録 | 実績60、observedDays=7/recordedDays=6、有効遷移4。8日前後を数えず、TODAY_DONE |
| backfill | 8日にDONE実量15を追加 | 実績75、有効遷移6。前後両側を新しい全履歴から再計算 |
| correct-backfill | 8日にSKIPPEDを渡す | 実績60。補完DONEと訂正SKIPPEDを同時に渡さず、1日1行 |
| today-actual | 今日DONE実量3を追加 | 実績63、中心TODAY_RECORDED、完了CURRENT_STATE。sessionAmount=10をもう一度加えない |
| completed | 今日DONE実量40を追加 | 実績100、中心COMPLETED、完了completed。他の不足より優先 |
| today-skipped | 今日SKIPPED/nullを追加 | 実績60、中心TODAY_RECORDED、完了CURRENT_STATE |
| empty-history | ログなし | 日数metadataは0/0、中心・完了とも不足。完了reason=NO_DONE_ORIGIN_TRANSITION |
| done-origin-only | 8・9日のDONEのみ | 完了不足reason=NO_SKIP_ORIGIN_TRANSITION |
| skip-origin-only | 8・9日のSKIPPEDのみ | 中心はavailable、完了はNO_DONE_ORIGIN_TRANSITION。2指標の十分性は別 |
| available-null | totalを11030へ変更 | 両起点は十分。仮実行後にもH+1回必要なため、availableのP50/P80はnull |
| available-zero | totalを70へ変更 | 実績60のまま未達成。今日の仮1sessionで届くavailableのP50/P80は0日 |

nullはH以内の分位点未到達、0日は今日の仮実行で到達、insufficientは遷移起点不足、completedは既に実績で達成。いずれも別状態として扱う。明日は1日目で、日付/週への変換は既存Product仕様に従う呼出側の責務。

## 接続先ごとの使い方

#77はGoalのtimezoneで決めたtodayと、そのGoalの一意日付の全ログsnapshotを`predict(input)`へ渡す。UNKNOWNは行を作らず、DONEは確定した実量、SKIPPEDはnullを渡す。保存時の省略amount補完や外部JSONの構造検証はAPI側の既存契約に従う。補完・訂正で1行を置き換えた後、snapshot全体から再計算する。読み取り順・transaction・workerの未採択部分をこの例から決めない。

#81は中心/完了それぞれのstatusとreasonを参照する。今日記録済みなら比較を出さず、達成済みなら予測を出さない。null/0/不足/達成を区別し、metadataの日数や件数から十分性を再定義しない。通信・Engine例外をinsufficientへ変換しない。[公開例外の扱い](../README.md#metadata公開エラーの契約)を参照する。

#82は固定today/seed/合成履歴から状態を再現するために利用できる。この11ケースは境界確認用で、#82の30–45日・再開が早い/遅い2Goal・認証済みデモアカウント・DB初期化の実装や受入を代替しない。実在ユーザー・資格情報は含まない。

型を呼出側へ接続するときの入口は[公開index](../src/index.ts)の`predict`/`PredictionInput`/`PredictionResult`。`PredictionInputError`/`PredictionConfigError`のclass/reason/pathを使い、message文面から分類しない。HTTP status/API応答codeの変換は新規定義せず、未知の例外も成功Resultへ置換しない。実行例は[connection-examples.test.mjs](../tests/connection-examples.test.mjs)で状態・実量・UNKNOWN・補完後の両側遷移を検証する。
