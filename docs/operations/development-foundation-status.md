# 開発基盤の現行状態

2026-09-30現在、現行のアプリ用Runtime、Framework、DB、Secret管理、Deploymentは未決定です。[Architecture D-18](../architecture.md#d-18-旧開発スタックの一時退避)により、旧Web/API・Compose・Node/npm・Doppler固定設定を[履歴](../../archive/music-exploration/README.md)へ一時退避しました。次案の採択後に不要と判断したものだけを整理します。

現行の共通基盤は、Issue/PR運用、Git Hook、`mise.toml`の共通タスク、[文書・設定チェック](../../scripts/check-foundation.ps1)、[Foundation CI](../../.github/workflows/foundation.yml)です。`pwsh -NoProfile -File scripts/check-foundation.ps1`はアプリの起動、ビルド、型検査、DB接続を実行しません。

当時の導入・検証結果、外部操作の承認待ち、チーム環境の未確認事項は[旧基盤状態の全文](../../archive/music-exploration/docs/operations/development-foundation-status.md)に保管しました。当時の成功を現行構成の動作確認と扱いません。

## 現在の未決定事項

- 次のProductの課題・機能・Scopeと必要な技術的性質。
- アプリRuntime、FE/BE構成、DB、Secret管理、外部Service、公開先と検証方法。
- 旧構成の再利用または削除。新しいIssueで要件と比較根拠を記録して判断する。

## 履歴への入口

- [旧開発ガイド](../../archive/music-exploration/docs/DEVELOPMENT_GUIDE.md#13-初回セットアップ)：当時の起動・停止・検証手順。
- [旧開発基盤ADR](../../archive/music-exploration/docs/decisions/0001-development-foundation.md)：当時の採択方針。
- [旧基盤状態](../../archive/music-exploration/docs/operations/development-foundation-status.md)：個別設定・検証・未確認事項。
- [引き継ぎの棚卸し](reuse-handoff.md)：次案で再評価する資産と条件。
