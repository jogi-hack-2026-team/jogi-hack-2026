# 仕様・実装・確認方法の対応表

現行Productの要件は未決定。[Product Spec](product-spec.md)と[Architecture](architecture.md)が現在の判断の入口。旧音楽案の詳細な対応表は[履歴](../archive/music-exploration/docs/change-map.md)へ保管した。過去のPoCや起動成功を次案の機能確認と扱わない。

## アプリの仕様と実装

| 対象 | 現在の状態 | 実装・確認の入口 |
| --- | --- | --- |
| Product機能 | 要件・実装とも未定 | 次案の決定後に仕様、コード、確認方法を追記する |
| Web / APIの最小起動 | health表示・応答のみ。次案への再利用は未決定 | [Web](../apps/web/)、[API](../apps/api/)、[Application CI](../.github/workflows/application.yml)。`npm run typecheck`と`npm run build`はProduct動作を検証しない |
| 旧音楽案の機能・実験 | 履歴のみ | [保管場所](../archive/music-exploration/README.md)を参照。旧要件・設計・PoCの対応は[旧表](../archive/music-exploration/docs/change-map.md)に残す |

## 開発基盤と作業手順

| 対象 | 状態・説明先 | 実装・確認方法 |
| --- | --- | --- |
| Issue・Branch・PR・レビュー | [CONTRIBUTING](../CONTRIBUTING.md) | Issueの目的・Scope・担当・完了条件とPR検証を確認 |
| 文書・設定チェック | [開発ガイド](DEVELOPMENT_GUIDE.md#文書チェックで起きること) | [mise設定](../mise.toml) → [check-foundation.ps1](../scripts/check-foundation.ps1)。`pwsh -NoProfile -File scripts/check-foundation.ps1` |
| Web / API / ローカルDB | [開発ガイド](DEVELOPMENT_GUIDE.md#composeでwebapipostgresqlを起動する) | [Compose](../compose.yaml)、[アプリ設定](../package.json)。DB schema・migration・Product試験は未整備 |
| 開発用Toolchainと外部設定 | [Architecture D-15](architecture.md#d-15)、[基盤状態](operations/development-foundation-status.md) | 実際の接続・権限・他メンバー環境は利用前に別途確認 |
| 次案への引き継ぎ | [再利用資産](operations/reuse-handoff.md) | 要件を決めた後に各資産の採否と検証条件をIssueへ記録 |

## 確認記録と残課題

この表は2026-09-30のリポジトリ内の所在を示す。実行済みの検証は対象Issue・PRと[基盤の状態記録](operations/development-foundation-status.md)を確認する。次案の仕様、技術採択、Product機能、DB接続、外部Service、公開配置は未確認。
