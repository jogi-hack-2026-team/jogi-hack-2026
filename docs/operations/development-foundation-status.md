# 開発基盤の現行状態

2026-09-30の候補記録を、2026-10-03の[技術構成合意](../architecture.md#2026-10-03の技術構成合意)に基づき更新しました。[D-23](../architecture.md#d-23)の基本構成はFE側の依頼者報告とBE本人の了承記録に基づく採用記録。[D-24](../architecture.md#d-24)／[D-25](../architecture.md#d-25)は検証・運用条件付き第一候補で、最終採択・公開・課金作成の許可ではありません。版・runner・migration方式は#70/#74で固定済み。Secret共有管理・外部設定・運用担当の残条件は未確定。[D-18](../architecture.md#d-18-旧開発スタックの一時退避)の基本構成未定状態はD-23で置き換えますが、[履歴](https://github.com/jogi-hack-2026-team/jogi-hack-2026/blob/77c71a5f248a4dce4ce9fb8af6619b41541be9d8/archive/music-exploration/README.md)の復元・動作確認は実装Issueで追います。現在の起動基盤・migration・認証の導入と、未結合業務機能・未配置公開環境を分けて確認します。

現行の共通基盤は、Issue/PR運用、Git Hook、`mise.toml`の共通タスク、[文書・設定チェック](../../scripts/check-foundation.ps1)、[Foundation CI](../../.github/workflows/foundation.yml)です。#71〜#73の限定先行Engineには別の[型検査・数値テストCI](../../packages/prediction/README.md#検証ci)を追加しました。#70でroot workspace、Node 24.21.0の版固定、[Application CI](../../.github/workflows/application.yml)、Compose、単一コンテナを導入しました（[手順](../DEVELOPMENT_GUIDE.md#アプリを起動検証する)）。Engine検証CIの固定版は検証版のまま、lockfileはrootへ統合しました。`pwsh -NoProfile -File scripts/check-foundation.ps1`はアプリの起動、ビルド、型検査、DB接続を実行しません。

当時の導入・検証結果、外部操作の承認待ち、チーム環境の未確認事項は[旧基盤状態の全文](https://github.com/jogi-hack-2026-team/jogi-hack-2026/blob/77c71a5f248a4dce4ce9fb8af6619b41541be9d8/archive/music-exploration/docs/operations/development-foundation-status.md)に保管しました。当時の成功を現行構成の動作確認と扱いません。

#70向けの[mise・環境設定共有の準備案](environment-sharing-preparation.md)には、現在の共通タスク、空の設定例と共有前の確認項目をまとめた。Secret管理方式・runtimeを採択したものではなく、Engine単体検証には環境値を渡さない。

公開先は2026-10-08の依頼者方針により、**本人アカウント・厳密0円でFE／BEともVercel Hobby、DBはNeon Free、ローカルはDocker**を第一候補にしています。[D-25](../architecture.md#d-25)の非商用・無料枠・共有制限と[採用前の最小検証](release-demo.md#公開候補の採用前に行う最小検証)を#83で追跡します。採用確定・デプロイ済みではなく、Cloud Runの旧候補はD-25に保持します。

## 現在の未決定事項

- 認証／公開先の最終受入・検証・運用条件（[D-24](../architecture.md#d-24)／[D-25](../architecture.md#d-25)）。Runtime・runner・migration方式は[#70/#74の記録](../architecture.md#2026-10-06の版固定と起動構成)で固定済み。ローカルのDB migration・認証は実装済みで、[Docker一式起動](../DEVELOPMENT_GUIDE.md#dockerで一式を起動する)は#130で補完する。
- 本人アカウントの無料プラン・非商用適合・接続／共有条件・region・運用担当・最終受入。外部作成・権限・公開操作は承認後とし、有料への切替を前提にしない。
- stagingのhealth／SPA／APIとManaged PostgreSQL接続、HTTPS／Cookie／proxy、休止後応答・メモリ・遅延。従来のhealthコンテナ配置を含む#70→#75→#83の[移管記録](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/83#issuecomment-6007399074)を保持し、Functionでの確認を追加する。
- 退避した旧構成のうち使わない部分の削除。

## 履歴への入口

- [旧開発ガイド](https://github.com/jogi-hack-2026-team/jogi-hack-2026/blob/77c71a5f248a4dce4ce9fb8af6619b41541be9d8/archive/music-exploration/docs/DEVELOPMENT_GUIDE.md#13-初回セットアップ)：当時の起動・停止・検証手順。
- [旧開発基盤ADR](https://github.com/jogi-hack-2026-team/jogi-hack-2026/blob/77c71a5f248a4dce4ce9fb8af6619b41541be9d8/archive/music-exploration/docs/decisions/0001-development-foundation.md)：当時の採択方針。
- [旧基盤状態](https://github.com/jogi-hack-2026-team/jogi-hack-2026/blob/77c71a5f248a4dce4ce9fb8af6619b41541be9d8/archive/music-exploration/docs/operations/development-foundation-status.md)：個別設定・検証・未確認事項。
- [引き継ぎの棚卸し](reuse-handoff.md)：次案で再評価する資産と条件。
