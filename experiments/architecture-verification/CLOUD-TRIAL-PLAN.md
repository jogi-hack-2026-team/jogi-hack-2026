# 実クラウド検証計画（未承認・未実施）

Supporting Artifact / Not a Source of Truth。2026-10-02。採択、課金、配備を承認する文書ではない。

## 承認対象を最小にする

1. 先に既存の認証済みstagingがあるか、利用者が非秘密のproject ID・region・billing有効/無効・Free利用量の概要を指定する。接続ツールが用意できればread-onlyで確認する。資格情報をチャットや成果物へ渡さない。
2. 存在しなければ、専用Cloud Runサービス1つと専用Neon Freeプロジェクト1つ、必要なイメージ置場とSecret参照の作成・試験・削除だけを承認対象にする。既存/本番のDBやプロジェクトの設定を変えない。課金が未有効なら、その有効化は別の明示承認が必要。
3. 最初はCloud Run Singapore `asia-southeast1` とNeon AWS Singapore `aws-ap-southeast-1`。日本からの操作遅延が不利なら、同じ合成DBにCloud Run Tokyo `asia-northeast1`を順番に比較する。2地域を同時に常設しない。
4. **費用優先のため実クラウド試験は未承認・未実施。前回のUSD 1案も承認されていない。継続公開の月額上限も未承認。**予算通知・max instancesだけでは請求額の厳密な上限にならない。残り無料枠、通貨、課金account共有、ネットワーク、ログ、build/registryを開始前に確認し、見積超過のおそれがあれば実行しない。

## 最小設定案

| 項目 | 案と根拠 |
| --- | --- |
| Node | 検証済み24.21.0、Better Auth候補1.7.7をlockfile固定。更新担当を決める |
| 配信 | 1つのFastifyコンテナでSPAとAPI、HTTPS、同一origin。`HOST=0.0.0.0`、`PORT`を使用 |
| Cloud Run | request billing、min instances 0、1 vCPU、512MiB、concurrency 4、timeout 30秒、初回max instances 1。第二段階の共有counter確認だけmax 2を承認対象に追加する |
| CPU | 予測・DB書込みをHTTP応答前に完了。workerは同一コンテナ内でawaitし、応答後のバックグラウンドCPUに依存しない |
| Neon | Freeのみ、空の合成DB、可能なら0.25 CU固定。固定不可ならautoscale条件と上限を確認し、最大2 CU側でも試験予算を評価。5分休止を維持 |
| Pool | アプリの`pg.Pool` max 2 / instanceから開始、max 5を比較。接続取得timeout 5秒、query timeout 10秒、idle timeout 10秒を隔離版へ追加して再typecheck。Neon pooled URLのtransaction poolingとdirect URLを分け、migrationはdirectの専用操作で一度だけ行う |
| 認証 | 合成2ユーザーのみ。1.7.7でPG/Kysely。int8 parserの範囲を限定。公開前にアプリ状態変更APIにもOrigin方針を実装して回帰確認 |
| Migration | ライブラリ固定版でauth→app、サービス起動時は`SPIKE_MIGRATE=0`。全instanceが同時にmigrationしない |
| HTTP | Cookie値・password・DB URLをログへ出さない。転送ヘッダーの値は非秘密の試験IPだけで確認。hop数はstaging実測後に固定 |
| 終了 | LinuxコンテナでSIGTERM→処理中要求完了→pool解放→10秒以内終了を確認 |
| 不要 | min 1、Redis、Cloud SQL、VPC connector、CDN、独自domain、メール、LLM、外部worker、Queueを追加しない |

`candidate-1.7.7/Dockerfile.verification`はローカルLinuxでbuild/起動済み、runtime約101MB。認証/DBは成功。修正前SIGTERMはexit137、承認済み最小hook後は通常keep-alive/9条件で10秒以内exit0。[Linux結果](LINUX-2026-10-02.md)はローカル証拠であり、実Cloud/Engine/費用等の残条件を解消せず、そのまま公開しない。Secret不足・productionの非HTTPSを拒否するgateは維持する。

## 合成データと回数

- 全試験を2つの固定合成メールidentityだけで実施。各人Goal 1つ、各Goalに60日分の合成履歴。実在メール・ユーザーデータを使わない。
- HTTP認証flowは各条件3周。登録、再読込、ログアウト、旧Cookie401、期限切れ401、他人Goalのread/today/log/delete404、本人正常操作を確認する。
- Originは正常、cross-site、same-site別port/subdomain、`null`、欠落を別々に扱う。**実ブラウザ**のform/JSON/fetch、credential送付、CORS/preflight、SameSiteを記録し、単なるNodeのCookie付き要求と分ける。
- HTTPSのsession cookieはSecure/HttpOnly/SameSite/Pathを属性だけ保存。直接Better Auth handlerとFastify routeのSet-Cookie本数・属性を比較し、Cloud Run外側でも複数行を確認する。
- SQL往復：pool acquire、接続/TLS、`SELECT 1`、migrationなしのauth session、Goal読取、upsert、today snapshotをそれぞれwarm 30回。pool max 2/5、direct/pooledを比較し、client側・server側・DB待ちを分ける。**アクセスによってNeonの休止時計をリセットする**ため、cold試験の待機中はDBを叩かない。
- Cold条件：Neon休止/Cloud Run warm、Neon warm/Cloud Run新instance、両方coldを別々に各3回。DB側は6分以上無通信を取り、Neon状態表示でも休止を確認。Cloud Runの単なる待機はscale-to-zeroの証拠にならないのでinstance ID/start timeで確認する。cold sample 3件からp95を主張せず各値を提示する。
- Rate-limit：合意前の試験上限はmax 5/window 60秒。1バケツ20並列を10回、2instanceへ交互に送る試験も10回。再起動1回、待機境界1回。2つの独立instanceへ届いたことをinstance IDで証明する。max 1をcounter共有の保証にしない。共有回線の2人も同じ制限を受ける点を記録する。
- 実Engine：Product `predict`実装とテストベクトルを受領してから、T-14のrequiredFutureDone 120/400/1095、K=200、horizon=1095、固定seedでwarmup 3回＋10回ずつ。各500ms未満という既存条件を緩めない。未実装なら「実Engine試験未実施」で止め、代用負荷を証拠にしない。
- 実Engine混合：認証/一覧/記録の合計2 req/s＋today 1 req/s、concurrency 1/2/4で各60秒を2回。pool 2で実施し、DB待ちが原因ならpool 5の比較を追加。未完了queue、失敗数、CRUD/session/today p50/p95、loop lag、CPU/RSS、SQL回数/待ち、worker queue待ちを保存。queueを無制限に積ませず、timeout/503/429を別集計する。追加試験はHTTP合計2,000件、混合負荷合計12分の上限以内で調整する。

## 復元を安全に試す

空の試験DBだけで、正常ログイン時刻t0をsnapshot/PITR対象に記録→ログアウト→Aユーザーを削除→旧Cookie401を確認する。t0へ**新しい試験branch**を復元し、同じSecret・同じimageの試験サービスから旧Cookieを送る。userとsessionの復活・認証結果を確認し、復元先のsession全失効後に旧Cookie401を確認する。本番を巻き戻さない。

復旧運用では、認証再開前に全session失効、復元後の再ログイン、削除要求の再適用を担当者が確認する。削除済みuserを識別する記録を同じ復元DBだけに置くと一緒に巻き戻るため、復元外の削除記録の保管方針が必要。復元したパスワードやaccountの古い状態も検討する。Secret rotationだけを全問題の解決としない。

今回のローカル試験はメモリ内のSQL行snapshot再投入による機序の確認。Neon PITR・manual snapshot・dump/restore・災害復旧時間の実測は上記の別試験で確認する。

## 試験費用の見積と終了

請求前提を検証前に再確認する。最大2instance、計30分のactive/start/stop時間を仮に割り当てると、CPU ≤3,600秒、メモリ ≤1,800 GiB秒、HTTP ≤2,000件。SG単価で無料枠適用前のCloud Run計算部分は約$0.13。Neonを最大2 CUで3時間と仮定すると6 CUh（Free残枠を開始前に確認）。この仮定は上限保証ではなく、実時間・scale挙動・通信・build・image保存・Secret・ログは別に集計する。Free超過なら有料登録せず試験を止める。

終了時は受付を止め、試験中のHTTPをdrainし、所有を確認した専用Cloud Runサービス/試験revision、専用イメージ、試験専用Secret、Neon復元branchと専用projectを削除する。既存共用registry/projectを一括削除しない。削除結果と残resource、Neon CUh・転送・容量、Cloud Run使用量をread-onlyで記録し、遅延する課金明細は後日確認する。削除までを事前承認の対象に含め、継続公開へ自動移行しない。

## 公式根拠（2026-10-02）

[Cloud Run billing/CPU](https://docs.cloud.google.com/run/docs/configuring/billing-settings)、[SIGTERMの10秒](https://docs.cloud.google.com/run/docs/container-contract)、[max instances超過の可能性](https://docs.cloud.google.com/run/docs/about-instance-autoscaling)、[料金](https://cloud.google.com/run/pricing)、[Neon Free](https://neon.com/docs/introduction/plans)、[Neonリージョン](https://neon.com/docs/introduction/regions)、[Neon transaction pooling](https://neon.com/docs/connect/connection-pooling)。

## 隔離修正後の接続数に関する追記（2026-10-02）

認証のint8変換をアプリへ広げないため、candidateはapp poolとauth poolを分けた。上のpool max2/5はapp側と読み替え、auth max2を別に加える。初回app2＋auth2＝最大4接続/instance、2instanceなら8。app5比較では最大7/instance、2instanceなら14。Neon pooled/direct接続の上限と512MiBでのメモリもこの合計で評価する。resource設定・予算・クラウド試験の承認はまだない。

ローカルOrigin・429・session失効の修正後結果は[追加報告](FOLLOWUP-2026-10-02.md)に記録した。[Linux試験](LINUX-2026-10-02.md)はbuild/認証成功・終了失敗。Neon PITR、user/password復旧方針、実Engine、HTTPS/proxy/cold/warmは未実施のまま。

追加のpool分離：修正版はapp max2＋auth max2から開始し、2instanceで計8接続。通常app5＋auth2なら2instanceで14接続。全poolの合算とNeon接続上限を確認する。Linux終了問題は最小hook後にローカル再試験済み。Cloud Runの実signal/TLS/proxy/CPU割当条件は別途、対象と費用の承認後に確認する。
