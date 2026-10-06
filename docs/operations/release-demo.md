# リリース・デモ・提出の手順

HTML §16–17に基づく最小運用。ProductはFuture ROI（[Product Spec](../product-spec.md#現行状態2026-09-30)）。基本構成は[D-23](../architecture.md#d-23)にFE側の依頼者報告とBE本人の了承記録に基づく採用として記録。認証・公開先は[Architecture](../architecture.md#deployment)の検証・運用条件付き第一候補で、一般公開・課金作成の許可ではない。公開先の最終受入、予算、担当者、URLは未定。
migrationは`npm run db:migrate`（認証→アプリの順。コンテナ内は`node apps/api/dist/db/migrate-cli.js all`。[手順](../DEVELOPMENT_GUIDE.md#起動)）。Demo Seedは`npm run db:seed:demo`の枠だけがあり、#82で実装するまで未実装として失敗する。deployコマンドは未定で、存在しないコマンドは掲載しない。

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
| Demo Data・初期状態への戻し方 | 再開が早いGoalと遅いGoalの合成記録（[R-09](../product-spec.md#requirementsmvp)）。スクリプトは未作成 | 開発データと分け、手順を再実行できる |
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
