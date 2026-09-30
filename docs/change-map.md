# 仕様・実装・確認方法の対応表

現行ProductはFuture ROI。要件は[Product Spec](product-spec.md)、実現方式は[Architecture](architecture.md)が正本。**2026-09-30時点でProduct機能のコードはない。** 下表の「実装予定の場所」は[Architecture](architecture.md#repository構成)の候補構成（技術選定確定待ち）に基づく予定であり、実装後に実在するパスとテストへ更新する。旧音楽案の対応表は[履歴](../archive/music-exploration/docs/change-map.md)へ保管した。

## アプリの仕様と実装

| 対象 | 仕様 | 実装予定の場所 | 確認方法（予定） |
| --- | --- | --- | --- |
| 認証（R-01） | [R-01](product-spec.md#requirementsmvp)、[D-24](architecture.md#d-24) | `apps/api/src/auth/`、`apps/web/src/routes/` | APIテスト（未ログイン401・他人404）、主要FlowのE2E |
| Goal（R-02） | [R-02](product-spec.md#requirementsmvp)、[Data Model](architecture.md#data-model) | `apps/api/src/goals/`、`apps/api/migrations/` | APIテスト |
| 記録・前日補完（R-03・R-04） | [R-03・R-04](product-spec.md#requirementsmvp)、[P-14](product-spec.md#p-14-記録のルール) | `apps/api/src/logs/` | APIテスト（今日・昨日以外は422、上書き、timezone境界） |
| Today Decision（R-05〜R-08） | [表示仕様](product-spec.md#today-decision画面の表示仕様) | `apps/api/src/prediction/`、`apps/web/src/routes/` | APIテスト（`/today`）、E2E |
| Prediction Engine | [Prediction Engine](architecture.md#prediction-engine) | `packages/prediction/` | Vitest＋fast-check（[T-01〜T-15](architecture.md#test-strategy)） |
| デモデータ（R-09） | [R-09](product-spec.md#requirementsmvp) | 未定（Demo Seedスクリプト） | デモ手順の通し確認 |
| 公開（R-10） | [Deployment](architecture.md#deployment) | 未定 | 公開URLで主要Flow |
| 予測モデルの根拠 | [判断記録](prediction/decision-log.md)、[Evidence](prediction/evidence.md) | [検証スクリプト](../experiments/prediction-model-validation/README.md)（本番コードではない） | スクリプトの再実行 |
| 旧音楽案の機能・実験 | 履歴のみ | [保管場所](../archive/music-exploration/README.md) | — |

## 開発基盤と作業手順

| 対象 | 状態・説明先 | 実装・確認方法 |
| --- | --- | --- |
| Issue・Branch・PR・レビュー | [CONTRIBUTING](../CONTRIBUTING.md) | Issueの目的・Scope・担当・完了条件とPR検証を確認 |
| 文書・設定チェック | [開発ガイド](DEVELOPMENT_GUIDE.md#文書チェックで起きること) | [mise設定](../mise.toml) → [check-foundation.ps1](../scripts/check-foundation.ps1)。`pwsh -NoProfile -File scripts/check-foundation.ps1` |
| アプリの起動構成（npm workspaces・Compose・Application CI） | [D-23](architecture.md#d-23)の候補（技術選定確定待ち）。確定後、現行の場所への復元をI-01で行う | 復元前は[旧構成](../archive/music-exploration/package.json)・[旧Compose](../archive/music-exploration/compose.yaml)が履歴として残る |
| 公開先と外部設定 | [D-25](architecture.md#d-25)、[基盤状態](operations/development-foundation-status.md) | アカウント・課金の作成は承認後 |
| 再利用資産 | [再利用資産](operations/reuse-handoff.md) | 実装Issueで採否を記録 |
| 技術選定の最小検証（[Issue #84](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/84)） | Supporting Artifact。第一候補を採択前に実測した記録で、採択・Productの実装ではない。[検証報告](../experiments/architecture-verification/REPORT.md)、[訂正後の比較](../experiments/architecture-verification/SELECTION-v3.1.md)。要約と実装時の対策は[Architecture](architecture.md#第一候補の検証状況84--85) | [検証コードと再実行手順](../experiments/architecture-verification/README.md)。専用のpackageで `npm run verify:*`。予測エンジンの性能、コンテナ、配備先は未実施 |

## 確認記録と残課題

この表は2026-09-30のリポジトリ内の所在を示す。Product機能、DB接続、外部Service、公開配置は未実装・未確認。
