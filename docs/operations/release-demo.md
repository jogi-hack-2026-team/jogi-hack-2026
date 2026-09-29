# リリース・デモ・提出の手順

HTML §16–17に基づく最小運用。2026-09-29に音楽探索案を廃止したため、次のProduct・MVP・技術採択は[Product Spec](../product-spec.md#現行状態2026-09-29)と[Architecture](../architecture.md#現行状態2026-09-30)で未定とする。公開先の最終受入、担当者、URL、Account Authも未定。旧FE / BEの起動構成は[履歴](../../archive/music-exploration/README.md)へ一時退避した。
存在しない起動・migration・seed・deployコマンドは掲載しない。決定後にこの文書を更新する。

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
| Demo Account | 次のProductの認証要件は未定 | 利用権限を確認。資格情報は承認済みの手段で共有 |
| Demo Data・初期状態への戻し方 | 次のProductのData要件と初期化手順は未定 | 開発データと分け、手順を再実行できる |
| 操作手順・期待結果 | 次のProductの主要Flowは未定 | 決定後に主要Flowを順番どおりに再現 |
| 外部API障害・通信障害時の説明 | API採用待ち | タイムアウト・エラー表示と代替デモを事前確認 |
| Backup Plan | 未定 | 許可された録画・画面資料などをチームで決める |

MVP完成後に主要デモFlowをPlaywright CLI＋SkillによるE2E対象にする。実装前に空の成功テストを作らない。

## 障害時

直前の正常Releaseと対象commitを特定し、公開先に合った復旧方法を確認する。
アプリを戻してもDBのMigrationが自動的に戻るとは限らないため、互換性とバックアップ・復元手順を確認してから実行する。
問題PRのRevertは通常のPRでレビューする。Production操作、Tag移動、データ削除を無断で行わない。
障害時に別のSecret管理サービスへ切り替えたり、Secret実値を画面共有したりしない。
