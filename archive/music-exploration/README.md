# 廃止した音楽探索案の記録

2026-09-29に廃止したProduct案の文書・比較実験を、当時の根拠と検証範囲を確認できるよう保管する。**現行仕様、実装計画、次のProductの技術採択ではない。** 現在の判断は[Product Spec](docs/product-spec.md)と[Architecture](docs/architecture.md)を参照する。

| 内容 | 記録 |
| --- | --- |
| 当時の要件・Scope・Product Decision | [旧Product Spec](docs/product-spec.md) |
| 当時のArchitecture・技術比較・Decision | [旧Architecture](docs/architecture.md) |
| 仕様・実装・検証の対応 | [旧変更対応表](docs/change-map.md) |
| 領域別の判断理由と実装支援 | [FE](docs/FE/README.md)、[BE](docs/BE/README.md)、[ML](docs/ML/README.md) |
| 比較PoC・測定結果・合成評価 | [stack-bakeoff](experiments/stack-bakeoff/README.md) |
| 旧ML Issue自動実行の設計・模擬テスト | [Harnessの記録](docs/operations/ml-agent-harness.md)。runnerの通常実行は停止 |

この保管場所の数値・Provider条件・権利・実再生・Team環境は当時の条件付き記録。再利用する場合は新しいIssueで対象要件とEvidenceを確認する。[再利用資産の棚卸し](../../docs/operations/reuse-handoff.md)に現行の入口をまとめる。
