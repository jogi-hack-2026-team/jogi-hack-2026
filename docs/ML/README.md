# Recommendation / Online Learning

**Supporting Artifact / Not a Source of Truth**。正式決定は[Product Spec](../product-spec.md)と[Architecture](../architecture.md)。本書は2026-09-25、Issue #36の判断理由・実装支援を記録する。本番実装済みを意味しない。

## この領域の責務

未知曲を選び、明示評価から好みの関連を更新する。Contextual Banditは特徴と過去評価を使って探索と既知の好みを両立する逐次選択方式。Deep Learningではない。

主なModule: Feature Reference、Multi-Prototype、Relevant/Probe生成、Gaussian LinTS、Hypothesis/Evidence、Evaluation。これは責務名であり、同名の本番ディレクトリが存在するという意味ではない。

## 読む順番

1. [Productの要件](../product-spec.md#requirements)と[現行Architecture](../architecture.md#現在の採択と読む順番)。
2. [Decision詳細](decision-log.md): D-13 / P-03 / P-09を比較理由・再検討条件から読む。
3. [Design Intent](design-intent.md): 変更前に守る条件と失敗境界を確認する。
4. [Implementation Guide](implementation-guide.md): 未実装の部分、着手順、Code/Test Mapへ進む。
5. [Evidence](evidence.md): 根拠の出典、支持しない主張、未検証範囲を確認する。

## Critical Invariants

推薦時のAnchor/Context/版をFeedbackへ使う。別版を混ぜない。Save/失敗/UNSUREを報酬観測へ変換しない。Probeを因果証明にしない。

## 隣接する領域

[FE](../FE/README.md)が操作と表示、[BE](../BE/README.md)が認可とcommit、[ML](../ML/README.md)が選択と数値の責任を持つ。[変更対応表](../change-map.md)から既存PoCに進める。本番コード・正式公開API・migration・製品E2Eは未整備。
