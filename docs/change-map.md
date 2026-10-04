# 仕様・実装・確認方法の対応表

現行ProductはFuture ROI。要件は[Product Spec](product-spec.md)、実現方式は[Architecture](architecture.md)が正本。**Prediction純粋計算の限定先行実装を独立レビューへ出すが、アプリ機能は未結合。** 下表の予定パスは[Architecture](architecture.md#repository構成)の候補構成に基づく。実在するPredictionと未実装のアプリを分けて記載する。旧音楽案の対応表は[履歴](../archive/music-exploration/docs/change-map.md)へ保管した。

## アプリの仕様と実装

| 対象 | 仕様 | 実装・予定の場所 | 確認方法 |
| --- | --- | --- | --- |
| 認証（R-01） | [R-01](product-spec.md#requirementsmvp)、[D-24](architecture.md#d-24) | `apps/api/src/auth/`、`apps/web/src/routes/` | APIテスト（未ログイン401・他人404）、主要FlowのE2E |
| Goal（R-02） | [R-02](product-spec.md#requirementsmvp)、[Data Model](architecture.md#data-model) | `apps/api/src/goals/`、`apps/api/migrations/` | APIテスト |
| 記録・前日補完（R-03・R-04） | [R-03・R-04](product-spec.md#requirementsmvp)、[P-14](product-spec.md#p-14-記録のルール) | `apps/api/src/logs/` | APIテスト（今日・昨日以外は422、上書き、timezone境界） |
| Today Decision（R-05〜R-08） | [表示仕様](product-spec.md#today-decision画面の表示仕様) | `apps/api/src/prediction/`、`apps/web/src/routes/` | APIテスト（`/today`）、E2E |
| Prediction Engine（限定先行、正式結合待ち） | [Prediction Engine](architecture.md#prediction-engine)、[承認範囲・利用条件](../packages/prediction/README.md) | [predict](../packages/prediction/src/predict.ts) → 観測・BigInt中心・RNG・DP | [T-01〜T-15の実テストと計測](../packages/prediction/README.md#ローカル検証)。[検証CI](../.github/workflows/prediction.yml)で型検査と46テスト・実Engine T-14。[接続例](../packages/prediction/examples/README.md)も同じCIで実行する。runnerはNode標準。採用基盤への整合は#70後 |
| デモデータ（R-09） | [R-09](product-spec.md#requirementsmvp) | 未定（Demo Seedスクリプト） | デモ手順の通し確認 |
| 公開（R-10） | [Deployment](architecture.md#deployment) | 未定 | 公開URLで主要Flow |
| 予測モデルの根拠 | [判断記録](prediction/decision-log.md)、[Evidence](prediction/evidence.md) | [検証スクリプト](../experiments/prediction-model-validation/README.md)（本番コードではない） | スクリプトの再実行 |
| 旧音楽案の機能・実験 | 履歴のみ | [保管場所](../archive/music-exploration/README.md) | — |

## 開発基盤と作業手順

| 対象 | 状態・説明先 | 実装・確認方法 |
| --- | --- | --- |
| Issue・Branch・PR・レビュー | [CONTRIBUTING](../CONTRIBUTING.md)、[Future ROIのIssue運用](DEVELOPMENT_GUIDE.md#future-roiのissue運用) | GitHubで階層、最新Issue・PR、着手条件と完了証拠を確認。AIの入口は[AGENTS](../AGENTS.md#16-issue)・[Claude向け指示](../CLAUDE.md) |
| 文書・設定チェック | [開発ガイド](DEVELOPMENT_GUIDE.md#文書チェックで起きること) | [mise設定](../mise.toml) → [check-foundation.ps1](../scripts/check-foundation.ps1)。`pwsh -NoProfile -File scripts/check-foundation.ps1` |
| アプリの起動構成（npm workspaces・Compose・Application CI） | [D-23](architecture.md#d-23)の候補（技術選定確定待ち）。確定後、現行の場所への復元をI-01で行う | 復元前は[旧構成](../archive/music-exploration/package.json)・[旧Compose](../archive/music-exploration/compose.yaml)が履歴として残る |
| 公開先と外部設定 | [D-25](architecture.md#d-25)、[基盤状態](operations/development-foundation-status.md) | アカウント・課金の作成は承認後 |
| 再利用資産 | [再利用資産](operations/reuse-handoff.md) | 実装Issueで採否を記録 |
| 技術選定の最小検証（[Issue #84](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/84)） | Supporting Artifact。第一候補を採択前に実測した記録で、採択・Productの実装ではない。[検証報告](../experiments/architecture-verification/REPORT.md)、[訂正後の比較](../experiments/architecture-verification/SELECTION-v3.1.md)。要約と実装時の対策は[Architecture](architecture.md#第一候補の検証状況84--85) | [検証コードと再実行手順](../experiments/architecture-verification/README.md)。専用のpackageで `npm run verify:*`。予測エンジンの性能、コンテナ、配備先は未実施 |

## 未採択の追加提案

ここはレビュー用のSupporting Docsへの入口であり、上の仕様・実装予定やMustの追加ではない。機能の採否は技術選定Issue #84から分け、[文書分離のIssue](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/94)・[提案のDraft PR](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/95)で提案と根拠を確認する。機能の採用・Scope・時期・実装Issueは未決定。採用しない・保留する場合の資料と入口の扱いも、採否と合わせて判断する。

| 提案 | 説明先 | 状態・確認範囲 |
| --- | --- | --- |
| 数日間の「やる／休む」を仮置きして比べる | [目的・例・現行Mustとの差・画面・計算・分担・受入条件案](prediction/action-scenarios-proposal.md) | 未採択。定型3例の既存DPへの還元、g50との前提差、表示の再検討案とレビュー報告を記録。実装・ユーザー検証・性能測定なし。Product/API/Prediction仕様・既存Issue依存・Ready/BLOCKEDは変更しない |
| 同じ行動の経験質問からのa/b初期分布・条件付き計画 | [PROPOSAL詳細](prediction/question-prior-proposal.md)、[判断理由](prediction/decision-log.md#proposalgoal作成時の質問由来priorと条件付き計画)、[Evidence](prediction/evidence.md#質問由来priorの局所検証2026-10-04) | 未採択。純粋[試作・再現手順](../experiments/question-prior-proposal/README.md)と局所テストのみ。R-02/R-06/P-12/D-20/API/T-11/T-15の採択後差分を記載。正式Product/Architecture・本番FE/BE/Engine・既存Issue依存は変更しない |

## 確認記録と残課題

表の実装予定は2026-09-30の仕様に基づく。Product機能、DB接続、外部Service、公開配置は未実装・未確認。

#71〜#73の限定先行承認に沿った純粋Engineとテストを追加した。型・入口は[src](../packages/prediction/src/index.ts)、固定例は[fixtures.ts](../packages/prediction/tests/fixtures.ts)、補完・訂正の実行例は[再計算例](../packages/prediction/README.md#補完訂正後の再計算例)。[検証手順・残条件](../packages/prediction/README.md#70後に合わせる点と残条件)を確認する。predictは必須metadataを持つPredictionResultを返し、依頼者承認済みの日数集計と公開例外の[契約](../packages/prediction/README.md#metadata公開エラーの契約)を反映した。API結合や正式受入は未完了。純粋Engineの型検査・数値テストCIを追加した。合意反映案PR #97の統合、#70の基盤・採用runtime・runner・統一CIへの整合は残る。
