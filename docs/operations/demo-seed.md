# Demo Seedの実行とreset（#82）

[R-09](../product-spec.md#requirementsmvp)の「再開が早いGoal／遅いGoal」を、同じ実績量の合成記録で比較する。operatorが明示実行するコマンドで、Compose起動時には実行されない。既存認証アカウントに専用の2Goalを追加し、再実行ではその2Goalだけを新しいIDで置き換える。

## 実行前

1. 対象環境とDB接続先、デモに使うアカウントの利用権限を確認する。公開環境への投入と恒久アカウント／資格情報の作成・共有は、対象を示して別途承認を得る。本変更では実行していない。
2. [開発ガイド](../DEVELOPMENT_GUIDE.md#アプリを起動検証する)で環境変数を準備し、認証→アプリのmigrationを完了する。hostでは`npm run db:migrate`、Dockerでは`docker compose up -d --build`の起動gateが実行する。
3. 通常の登録・ログインで作成済みのデモアカウントについて、認証済み`GET /api/auth/get-session`の`user.id`を確認する。Cookie・passwordはログやGitへ保存しない。メールアドレスやGoalタイトルから対象を推測しない。

CLIはcredential accountの存在をDBで確認するが、「このユーザーをデモに使ってよい」という権限はoperatorが確認する。アカウントを作成したり、password・session・rateLimitを書き換えたりはしない。

## hostから実行する

リポジトリrootでNode24.21.0／locked dependenciesを準備する。`.env`の`DATABASE_URL`を読み、CLIへ引数を転送する。

```sh
npm run db:seed:demo -- --user-id '<確認したuser.id>' --timezone Asia/Tokyo
```

`--user-id`と`--timezone`は必須。timezoneはGoalに保存するIANA名で、`JST`やUTC offsetは不可。日時を指定するCLI引数はなく、lock取得後の現在時刻を1回だけ使う。npmのコマンド表示には入力したuserIdが出るため、共有する出力は必要な結果だけにする。

## Dockerから実行する

appが正常起動し、migration完了を確認してから、同じ単一Node imageのビルド済みCLIを使う。認証Secretを新たに生成する必要はない。

```sh
docker compose exec app node apps/api/dist/db/seed-demo-cli.js --user-id '<確認したuser.id>' --timezone Asia/Tokyo
```

資格情報や接続URLをコマンドへ直接書き込まず、既存の環境変数準備手順を使う。Docker／miseの役割と開発時のhot reloadは[開発ガイド](../DEVELOPMENT_GUIDE.md#dockerで一式を起動する)を参照する。

## 初期状態と確認

| 項目 | 2Goalに共通する値 |
| --- | --- |
| 単位・必要量・初期量・1回量 | sessions・60・0・1 |
| 合成履歴 | Goalのtimezoneの基準日−31〜−2の30暦日。DONE15件、SKIPPED15件 |
| 記録開始日 | 基準日−31 |
| 昨日 | 行を作らない。EngineではUNKNOWN、Today APIでは`yesterdayMissing: true` |
| 今日 | 行を作らない。`todayLog: null`／UNRECORDED |
| 質問回答 | 新Goalのschema既定値を使う。未回答・版0（R-11の0003適用時） |

「デモ：すぐ再開する」はDONE／SKIPPED交互、「デモ：再開に時間がかかる」は先頭15日DONE→15日SKIPPED。既存[Engine fixture](../../packages/prediction/examples/demo-inputs.mjs)の順序と量を保持する。記録日を1日前へ移した理由は、昨日補完と今日記録の両方を通常APIの今日／昨日の窓で試すため。一般のGoal作成日・過去日PUTの制約は変更しない。

成功時は終了code0で`seedVersion`、`baseDate`、timezone、置換Goal数、作成Goal数2、記録数60のJSONを出す。CLI自身はuserId・Goal ID・接続URLを出力しない。対象アカウントでGoal一覧と各`/today`を確認し、昨日補完→今日記録→再計算を試す。基準日が変わった場合は再実行してからデモを始める。

全量15/60のまま、既定Engineでは交互パターンの中心g50/g80は1/1日、固まるパターンは7/21日。完了p50/p80は88/92日と102/183日。この合成例の違いを精度・校正・実ユーザーへの保証と扱わない。Webの表示・操作の通し確認と、公開DB／恒久Demo Accountの用意は別途必要で、CLI/API検証だけで#82をCloseしない。

## 再実行・障害

再実行は同じコマンド。`demo_seed_goal`で所有する2Goalと連鎖する記録を1 transactionで削除・再作成する。タイトルを編集していても対象は専用markerのIDで決まり、同名の通常Goal・同ユーザーの別Goal・他ユーザーの全データは残る。Goalを手動削除した場合はmarkerもCASCADEし、次回に不足分を再作成する。

並行実行はuserId単位のtransaction advisory lockで直列化する。lock待ちは30秒、SQLは35秒、client応答は40秒、接続確立は5秒の有限待機。timeout時は終了code1になり、他の実行を確認してから再実行する。既存HTTPの5秒期限は変えていない。

COMMIT前の失敗でROLLBACKが完了すれば、旧Goal・旧ログ・保存回答を全行保持する。`ROLLBACK_FAILED`はclientを破棄し、接続断で未確定変更を取り消す。`COMMIT_OUTCOME_UNKNOWN`はCOMMIT応答を確認できず、確定済みかもしれない状態。旧データが残ったとは断定せず、接続・migrationを確認し、同じコマンドを再実行して専用2Goalへ収束させる。新IDになるため、古い画面や遅延要求のGoal IDは404となる。一覧を再取得して開き直す。

無効引数やDATABASE_URL未設定はcode2、未作成／credential accountのないuserIdは`AUTH_USER_NOT_FOUND`、所有権の不整合は`OWNERSHIP_INVALID`、その他は`FAILED`でcode1。エラー原文・SQL・接続URLはCLIで表示しない。markerの手動付替え、DB全消去、既存volume削除はreset手順に含めない。

## 設計理由と検証

理由・代替案・不変条件は[Architecture D-27](../architecture.md#d-27)。実装は[seed-demo.ts](../../apps/api/src/db/seed-demo.ts)、合成入力は[demo-data.ts](../../apps/api/src/db/demo-data.ts)、所有権は[migration 0004](../../apps/api/migrations/0004_demo_seed_goal.sql)。R-11の[migration 0003](../../apps/api/migrations/0003_goal_question_prior.sql)を保持し、空のDBでは0001→0002→0003→0004の順に適用する。既存SQLのchecksumは変更しない。

[日付・既存fixture回帰](../../apps/api/tests/demo-data.test.ts)と[専用DBでのAPI／reset回帰](../../apps/api/tests/demo-seed.test.ts)で、データ保全・SQL途中失敗・同一ユーザーの並行実行・DELETEとの競合・lock待ち日またぎ・COMMIT確定不明・CLI終了と非露出を検証する。テストは専用の合成DBだけを作成・削除し、公開DBや既存volumeへ実行しない。`DATABASE_URL`を指定しないAPIテストは既存helperが`.local`へクラスタとテスト資格情報を保存するため、その挙動を許可しない検証では、明示的に隔離した合成PostgreSQLを指定する。

0003の回答APIとDemo resetの[統合回帰](../../apps/api/tests/seed-r11-compatibility.test.ts)は標準の`npm test`に含まれる。非nullの保存回答・snapshotの失敗rollback、通常Goalの回答保全、新Goalの未回答／版0、旧回答PATCHの404、0004→0003の後着順と反復を確認する。CIと[migration回帰](../../apps/api/tests/migrate.test.ts)の初回適用期待列も0001／0002／0003／0004で一致させる。
