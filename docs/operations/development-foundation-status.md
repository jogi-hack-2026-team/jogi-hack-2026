# 開発基盤の現行状態

2026-09-30の候補記録を、2026-10-03の[技術構成合意](../architecture.md#2026-10-03の技術構成合意)に基づき更新しました。[D-23](../architecture.md#d-23)の基本構成はFE側の依頼者報告とBE本人の了承記録に基づく採用記録。[D-24](../architecture.md#d-24)／[D-25](../architecture.md#d-25)は検証・運用条件付き第一候補で、最終採択・公開・課金作成の許可ではありません。版・追加ツール・Secret管理・外部設定・運用担当は未確定。[D-18](../architecture.md#d-18-旧開発スタックの一時退避)の基本構成未定状態はD-23で置き換えますが、[履歴](../../archive/music-exploration/README.md)の復元・動作確認は実装Issueで行い、未完了です。

現行の共通基盤は、Issue/PR運用、Git Hook、`mise.toml`の共通タスク、[文書・設定チェック](../../scripts/check-foundation.ps1)、[Foundation CI](../../.github/workflows/foundation.yml)です。#71〜#73の限定先行Engineには別の[型検査・数値テストCI](../../packages/prediction/README.md#検証ci)を追加しました。#70でroot workspace、Node 24.21.0の版固定、[Application CI](../../.github/workflows/application.yml)、Compose、単一コンテナを導入しました（[手順](../DEVELOPMENT_GUIDE.md#アプリを起動検証する)）。Engine検証CIの固定版は検証版のまま、lockfileはrootへ統合しました。`pwsh -NoProfile -File scripts/check-foundation.ps1`はアプリの起動、ビルド、型検査、DB接続を実行しません。

当時の導入・検証結果、外部操作の承認待ち、チーム環境の未確認事項は[旧基盤状態の全文](../../archive/music-exploration/docs/operations/development-foundation-status.md)に保管しました。当時の成功を現行構成の動作確認と扱いません。

#70向けの[mise・環境設定共有の準備案](environment-sharing-preparation.md)には、現在の共通タスク、空の設定例と共有前の確認項目をまとめた。Secret管理方式・runtimeを採択したものではなく、Engine単体検証には環境値を渡さない。

## 現在の未決定事項

- 採用基本構成の残る追加ツール（migrationツール等）と、認証／公開先の最終採択・検証・運用条件（[D-23](../architecture.md#d-23)〜[D-25](../architecture.md#d-25)）。
- 公開先のアカウント・課金設定・regionの作成と最終受入（確定後、承認を受けてから）。
- stagingへのhealthコンテナ配置とManaged PostgreSQL接続（公開先の承認後。#70から#75へ移管）。
- 退避した旧構成のうち使わない部分の削除。

## 履歴への入口

- [旧開発ガイド](../../archive/music-exploration/docs/DEVELOPMENT_GUIDE.md#13-初回セットアップ)：当時の起動・停止・検証手順。
- [旧開発基盤ADR](../../archive/music-exploration/docs/decisions/0001-development-foundation.md)：当時の採択方針。
- [旧基盤状態](../../archive/music-exploration/docs/operations/development-foundation-status.md)：個別設定・検証・未確認事項。
- [引き継ぎの棚卸し](reuse-handoff.md)：次案で再評価する資産と条件。
