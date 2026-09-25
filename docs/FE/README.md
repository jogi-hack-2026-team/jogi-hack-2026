# Frontend

**Supporting Artifact / Not a Source of Truth**。正式決定は[Product Spec](../product-spec.md)と[Architecture](../architecture.md)。本書は2026-09-25、Issue #36の判断理由・実装支援を記録する。本番実装済みを意味しない。

## この領域の責務

ユーザーが選び、聴き、評価し、発見を保存して続ける操作を担当する。APIで保存された結果を表示し、失敗と未確定を分かる形で伝える。

主なModule: Seed検索/選択、探索画面、Player Adapter、Feedback、Summary、Save/継続、API Adapter、Router。これは責務名であり、同名の本番ディレクトリが存在するという意味ではない。

## 読む順番

1. [Productの要件](../product-spec.md#requirements)と[現行Architecture](../architecture.md#現在の採択と読む順番)。
2. [Decision詳細](decision-log.md): D-09を比較理由・再検討条件から読む。
3. [Design Intent](design-intent.md): 変更前に守る条件と失敗境界を確認する。
4. [Implementation Guide](implementation-guide.md): 未実装の部分、着手順、Code/Test Mapへ進む。
5. [Evidence](evidence.md): 根拠の出典、支持しない主張、未検証範囲を確認する。

## Critical Invariants

確定前の推薦を表示しない。URLやlocalStorageをPreferenceの正本にしない。Playback障害からRatingを生成しない。

## 隣接する領域

[FE](../FE/README.md)が操作と表示、[BE](../BE/README.md)が認可とcommit、[ML](../ML/README.md)が選択と数値の責任を持つ。[変更対応表](../change-map.md)から既存PoCに進める。本番コード・正式公開API・migration・製品E2Eは未整備。
