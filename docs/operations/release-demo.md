# リリース・デモ・提出の手順

HTML §16–17に基づく最小運用。ProductはFuture ROI（[Product Spec](../product-spec.md#現行状態2026-09-30)）。基本構成は[D-23](../architecture.md#d-23)にFE側の依頼者報告とBE本人の了承記録に基づく採用として記録。2026-10-08の公開第一候補は**FE・BEともVercel Hobby、DBはNeon Free、ローカル開発はDocker**（[D-25](../architecture.md#d-25)）。本人アカウント・厳密に費用0円を前提とし、採用確定・配備済みではない。一般公開・外部作成・課金の許可ではなく、公開先の最終受入、運用担当者、URLは未定。1〜2年の継続を視野に置くが、無料条件が変わらないことや稼働継続を保証しない。
migrationは`npm run db:migrate`（認証→アプリの順。コンテナ内は`node apps/api/dist/db/migrate-cli.js all`。[手順](../DEVELOPMENT_GUIDE.md#起動)）。[Demo Seed](demo-seed.md)は認証作成済みuserIdとtimezoneを明示し、専用2Goalだけを作成・resetする。deployコマンドは未定で、存在しないコマンドは掲載しない。

## 公開候補の採用前に行う最小検証

全項目は未実施で、[#83](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/83)の既存公開受入へ紐付ける。#70→#75→#83のhealth／SPA・DB・Cookie／proxy・休止後応答・メモリ／遅延の移管を保全する。実行コード・CI・環境設定・アカウント・請求・権限・Secretはこの候補記録では変更しない。検証先の作成と試験範囲は別途承認後。負荷試験は[Vercel Fair Use](https://vercel.com/docs/limits/fair-use-guidelines)で許可された範囲・事前許可を確認する。

| 確認対象 | 最小の確認と合格の根拠 |
| --- | --- |
| 無料条件・本人運用 | [無料運用の条件](../architecture.md#無料運用の条件)と実プラン・利用量・追加機能を照合し、非商用適合、公開Organization接続、commit作者と自動配備条件、管理共有の制限、上限時の停止／再開方法を記録する。非商用は無収益だけで判定しない。費用が生じる条件なら採用せず再検討 |
| monorepo root・起動点 | rootの`package.json`／`package-lock.json`で3 workspaceの依存を解決する。BEのProject rootを`apps/api`とする候補ではroot側依存・buildの参照範囲を確認し、設定値と自動検出結果を記録する。[`app.ts`](../../apps/api/src/app.ts)は`buildApp` factory、[`server.ts`](../../apps/api/src/server.ts)が設定・poolを作り`listen()`する起動点。factoryが起動点として誤検出されず、正しいserverがFunctionに含まれ`GET /api/health`がDB到達時200／到達不可時503を返すことを確認 |
| Prediction build・exports・Node | `packages/prediction`→API／Webの順でbuildし、[`exports`](../../packages/prediction/package.json)の`dist/src/index.js`等とworkspace依存が公開bundleで解決することを確認。`predict`／`predictWithQuestionPrior`の両入口を実行する。公開Node 24.xの実minor／patchを記録し、ローカル24.21.0との互換性を確認 |
| SPA assets・`/api` | Webのbuild済みassetsが配信bundleへ入り、`/`・`/goals`・GoalのTodayへ直アクセス／再読込できる。hash付きassetsのcacheとindexの再検証を確認。存在しないassets・保護hook通過後の未知API／対象外methodはJSON 404になり、`/api`をSPA HTMLへfallbackしない。同一originでWebとAPIへ到達する |
| HTTPS・認証・全Set-Cookie | 公開HTTPSの`BETTER_AUTH_URL`と実URLを一致させ、登録→ログイン→再読込→ログアウト→再ログインを3人の端末で確認。全Set-Cookieが欠落・結合されず転送され、Secure・`__Secure-`・HttpOnly・SameSite=Lax、Origin拒否と他userのGoal／記録の分離が保たれる |
| IP・認証レート制限 | proxyの転送ヘッダーの実形式とhop数を記録し、`TRUST_PROXY_HOPS`とクライアントIPの一致を確認。偽装ヘッダーで回数制限を回避できず、複数Function instance／再起動でもDB上の制限・Retry-Afterが整合すること、共有回線で3人が正当に使えることを確認 |
| DB接続・migration・休止復帰 | アプリ用5＋認証用2のpoolをinstance数込みでNeonの上限と比較し、idle接続解放・取得待ち・接続切断・既存5秒timeoutを確認。認証用bigint parserとapp側の文字列型を保全。migrationは別実行で直結URLを使い、session advisory lockをtransaction poolerへ流さない。認証→アプリの順、反復・失敗時rollbackを確認。Neonが休止した後のhealth・再ログイン・読込／保存を確認し、初回応答・DB／Functionのメモリ・region間遅延とエラー回復を記録。常時pingで休止を避けない |
| Goal・記録・再計算の整合 | 再ログイン後のGoal作成／編集／削除、今日／昨日のDONE・SKIPPED、日付境界・保存失敗、R-11回答の保存／訂正後の予測を確認。画面・DB・両予測入口の値とrevisionが整合し、他人の値や古い応答を採用しない。R-04/P-14の既存文書不一致は#80で追跡し、この記録で解消済みにしない |
| CPU・混合負荷・無料枠 | 両予測入口でT-14の既定入力・seed／configと500ms未満を保全し、FunctionのActive CPUとwall timeを別記録。3人の主要Flowと予測＋CRUD／sessionの混合時に計算最大・p95・待ち行列・失敗・メモリ・DB接続数を測り、月間利用仮定と無料枠を照合。旧216.01／227.02msはNode wall timeで、Vercel CPUへ換算しない。[旧mixed-load](../../experiments/architecture-verification/REAL-ENGINE-2026-10-07.md)の546.83ms FAIL・overallExitCode=1・CRUD p95 5秒超は未解消。新しい成功で過去結果を書き換えず、比較条件と解消できた範囲を記録 |

各項目の結果にはcommit SHA・CI・URL・実runtime／region・日時・担当・試験条件・期待値／実測・未確認／Known Limitationsを残す。ローカルDocker／CIの成功から公開成功へ昇格しない。機能QAは開発者3人で行い、UX改善・初見理解確認は後続（#81）として分ける。公開確認・復旧・デモ・提出の既存完了条件はこの検証表だけでは完了しない。

## リリース担当者が行うこと

1. MVP → Feature Complete → Release Candidate → Code Freezeの順に、対象Issueの完了条件と未完了Mustを確認する。GitHub Milestoneの旧検討記録は[履歴](../../archive/music-exploration/docs/operations/development-foundation-status.md#外部操作の引き継ぎと承認待ち)を参照し、次案で必要性を確認する。
2. 対象PRの別メンバーのApprove、CI結果、実機確認、仕様・ADRの更新を確認する。文書チェックのみの成功をアプリ検証済みと扱わない。
3. DB実装ではSchema変更をGit管理したMigrationとしてレビューする。Development Seed、Demo Seed、Test Fixtureを区別し、デモ用データに実在ユーザーのSecretや個人情報を混ぜない。
4. 公開先決定後、Deploy成功・Environment・Migration・Demo Seed・主要Flow・エラー表示・Responsive表示を確認する。Productionの手動変更は理由と手順を記録し、承認を受ける。
5. 正常動作したcommit SHA、検証結果、既知の制約、使用URLと提出資料をリリース記録へ残す。Tag名はチームで決める。HTMLの`v0.1.0`等は例であり予約済みではない。
6. Tag / GitHub Releaseの作成・公開は対象SHAと内容を示して承認を受けてから行う。最終版は2026-10-12のFreezeまでに固定する。Freezeの締切時刻・提出条件は[Issue #19](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/19)で確認する。

## デモ担当者が記入・確認すること

| 項目 | 現在 | 完了確認 |
| --- | --- | --- |
| 担当者・所要時間・説明順 | 未定 | 説明担当と操作担当で通し練習 |
| 使用URL・対象Release SHA | 未定 | 別メンバーの端末から到達 |
| Demo Account | メール＋パスワード認証（[R-01](../product-spec.md#requirementsmvp)、#75でローカル実装済み）。公開環境のアカウントは未作成 | 利用権限を確認。資格情報は承認済みの手段で共有。認証の試行上限（既定: 1接続元60秒に5回）はデモ会場の共有回線に合わせて`AUTH_SIGN_IN_MAX`で調整する |
| Demo Data・初期状態への戻し方 | 再開が早いGoalと遅いGoalの合成記録（[R-09](../product-spec.md#requirementsmvp)）。[Demo Seedとreset](demo-seed.md)で認証済みuserIdの専用2Goalだけを作成・置換する | 開発データと分け、手順を再実行できる。公開環境・恒久Demo Account・Webの通し確認は未実施 |
| 操作手順・期待結果 | [Core User Flow](../product-spec.md#core-user-flow)。期待結果は実装後に記入 | 主要Flowを順番どおりに再現 |
| 通信・アプリのAPI（`/api`）障害時の説明 | 未確認（アプリ実装後に確認） | タイムアウト・エラー表示と代替デモを事前確認。MVPにない外部APIの採用を前提にしない |
| Backup Plan | 未定 | 許可された録画・画面資料などをチームで決める |

MVP完成後に主要デモFlowをPlaywright CLI＋SkillによるE2E対象にする。実装前に空の成功テストを作らない。

## 障害時

直前の正常Releaseと対象commitを特定し、公開先に合った復旧方法を確認する。
アプリを戻してもDBのMigrationが自動的に戻るとは限らないため、互換性とバックアップ・復元手順を確認してから実行する。
問題PRのRevertは通常のPRでレビューする。Production操作、Tag移動、データ削除を無断で行わない。
障害時に別のSecret管理サービスへ切り替えたり、Secret実値を画面共有したりしない。
依存更新は対象Issueで必要なものに限り、固定版・変更内容・既存検証への影響を確認する。認証依存の更新とDB復旧の担当・手順は公開前に確認し、未定の担当を推測しない。Migrationの互換性・適用順・バックアップと復旧結果は既存のリリース記録へ残す。
障害調査に必要なログでもパスワード・Cookie・Token・DB接続文字列を出力せず、共有前に秘匿を確認する。
