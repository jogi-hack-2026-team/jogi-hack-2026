# 開発基盤の現行状態

2026-09-30の候補記録を、2026-10-03の[技術構成合意](../architecture.md#2026-10-03の技術構成合意)に基づき更新しました。[D-23](../architecture.md#d-23)の基本構成は依頼者によるDiscord上の了承報告に基づく採用記録。[D-24](../architecture.md#d-24)／[D-25](../architecture.md#d-25)は検証・運用条件付き第一候補で、最終採択・公開・課金作成の許可ではありません。版・追加ツール・Secret管理・外部設定・運用担当は未確定。[D-18](../architecture.md#d-18-旧開発スタックの一時退避)の基本構成未定状態はD-23で置き換えますが、[履歴](../../archive/music-exploration/README.md)の復元・動作確認は実装Issueで行い、未完了です。

現行の共通基盤は、Issue/PR運用、Git Hook、`mise.toml`の共通タスク、[文書・設定チェック](../../scripts/check-foundation.ps1)、[Foundation CI](../../.github/workflows/foundation.yml)です。`pwsh -NoProfile -File scripts/check-foundation.ps1`はアプリの起動、ビルド、型検査、DB接続を実行しません。

当時の導入・検証結果、外部操作の承認待ち、チーム環境の未確認事項は[旧基盤状態の全文](../../archive/music-exploration/docs/operations/development-foundation-status.md)に保管しました。当時の成功を現行構成の動作確認と扱いません。

## 現在の未決定事項

- 採用基本構成の版・追加ツールと、認証／公開先の最終採択・検証・運用条件（[D-23](../architecture.md#d-23)〜[D-25](../architecture.md#d-25)）。
- 公開先のアカウント・課金設定・regionの作成と最終受入（確定後、承認を受けてから）。
- アプリの起動構成・Application CIの現行の場所への復元と、その動作確認（I-01）。
- 退避した旧構成のうち使わない部分の削除。

## 履歴への入口

- [旧開発ガイド](../../archive/music-exploration/docs/DEVELOPMENT_GUIDE.md#13-初回セットアップ)：当時の起動・停止・検証手順。
- [旧開発基盤ADR](../../archive/music-exploration/docs/decisions/0001-development-foundation.md)：当時の採択方針。
- [旧基盤状態](../../archive/music-exploration/docs/operations/development-foundation-status.md)：個別設定・検証・未確認事項。
- [引き継ぎの棚卸し](reuse-handoff.md)：次案で再評価する資産と条件。
