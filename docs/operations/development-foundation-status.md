# 開発基盤の現行状態

2026-09-30、Future ROIの技術スタックと公開先の候補を[Architecture D-23](../architecture.md#d-23)〜[D-25](../architecture.md#d-25)に記録しました（技術選定確定待ち）。確定するまで、現行のアプリ用Runtime、Framework、DB、Secret管理、Deploymentは未決定です。[D-18](../architecture.md#d-18-旧開発スタックの一時退避)で[履歴](../../archive/music-exploration/README.md)へ退避した旧Web/API・Compose・Node/npmの設定は、確定後に必要な部分だけ現行の場所へ戻します。

現行の共通基盤は、Issue/PR運用、Git Hook、`mise.toml`の共通タスク、[文書・設定チェック](../../scripts/check-foundation.ps1)、[Foundation CI](../../.github/workflows/foundation.yml)です。#71〜#73の限定先行Engineには別の[型検査・数値テストCI](../../packages/prediction/README.md#検証ci)を追加しました。固定した検証版は製品runtimeの採択ではなく、Application CI・workspace・採用基盤との統合はI-01後に整合します。`pwsh -NoProfile -File scripts/check-foundation.ps1`はアプリの起動、ビルド、型検査、DB接続を実行しません。

当時の導入・検証結果、外部操作の承認待ち、チーム環境の未確認事項は[旧基盤状態の全文](../../archive/music-exploration/docs/operations/development-foundation-status.md)に保管しました。当時の成功を現行構成の動作確認と扱いません。

#70向けの[mise・環境設定共有の準備案](environment-sharing-preparation.md)には、現在の共通タスク、空の設定例と共有前の確認項目をまとめた。Secret管理方式・runtimeを採択したものではなく、Engine単体検証には環境値を渡さない。

## 現在の未決定事項

- 技術スタックと公開先の確定（[D-23](../architecture.md#d-23)〜[D-25](../architecture.md#d-25)、別担当の精査結果と比較）。
- 公開先のアカウント・課金設定・regionの作成と最終受入（確定後、承認を受けてから）。
- アプリの起動構成・Application CIの現行の場所への復元と、その動作確認（I-01）。
- 退避した旧構成のうち使わない部分の削除。

## 履歴への入口

- [旧開発ガイド](../../archive/music-exploration/docs/DEVELOPMENT_GUIDE.md#13-初回セットアップ)：当時の起動・停止・検証手順。
- [旧開発基盤ADR](../../archive/music-exploration/docs/decisions/0001-development-foundation.md)：当時の採択方針。
- [旧基盤状態](../../archive/music-exploration/docs/operations/development-foundation-status.md)：個別設定・検証・未確認事項。
- [引き継ぎの棚卸し](reuse-handoff.md)：次案で再評価する資産と条件。
