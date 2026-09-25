# Recommendation Implementation Guide

**Supporting Artifact / Not a Source of Truth**。正式仕様は[Product Spec](../product-spec.md)と[Architecture](../architecture.md)。以下は2026-09-25の実装準備であり、本番実装済みという意味ではない。

## 最初の作業

[Decision](decision-log.md)、[Intent](design-intent.md)、[Evidence](evidence.md)、[Evaluation](evaluation.md)を読んで、実Catalog/PlaybackとAlgorithm Simulationを別のP0 Issueへ切り出す。数値計算の採用ライブラリ・校正値はOPEN。本番はTypeScript、実験ではPython / NumPy / SciPy / pandas / matplotlib等を利用可能だが、本番dependencyへ自動追加しない。

## 入力から推薦まで

1. Feature Referenceをunique recording＋有効7特徴で作り、データ出所・取得/変換版を記録する。Playback VERIFIED集合と混ぜない。利用権gateは[BE Evidence](../BE/evidence.md#保存学習用途の追加確認)。
2. 各Featureを参照分布のempirical percentileへ変換する。同順位・範囲外・欠損・新曲追加時の規約を先に決める。新参照版を旧Posteriorへ混ぜない。
3. 3〜5Seedを個別Prototypeとして保持。RelevantはSeed別kNNのunion、録音dedupe、経験分布によるrelevance guardを通す。kと閾値はcalibration対象。
4. Probeは対象特徴kの差と、それ以外の特徴の近さを別々に検査する。Pareto優先は提案であり、最終tie-break/選択閾値は未決。生成時のAnchorを保持する。
5. 正式Contextは `φ=[1,-abs(p1-p1_seed),…,-abs(p7-p7_seed)]/sqrt(8)`。1回のdecisionで同じθ_sampleを使い、Relevantの各Seed scoreのmaxとargmaxを選ぶ。Probeは生成Anchor固定。
6. State版・候補/除外理由・score・Anchor/Context・乱数再現情報・方式/変換版・guardrail理由をTraceへ渡す。Interaction＋TraceのcommitはBEが担当する。

## Feedbackから更新まで

LIKE=1、NEUTRAL=0、DISLIKE=-1を保存済みContextと組にしてcanonical観測へ入れる。UNSURE、Save、Skip、再生障害は観測へ入れない。NEUTRALはfを変えなくてもBの情報量を変える。再送は新観測ではない。

`B=I+Σφφᵀ`、`f=Σφr`、`μ=solve(B,f)`、covariance `B⁻¹`。逆行列を直接組み立てるより安定した分解/solveで実装する。`B=LLᵀ`なら標準正規zに対し `solve(Lᵀ,z)` を使うsampleの向きも参照値で確認する。Rating Revisionはcanonical集合から再構築し、過去Context/Anchorを再計算しない。数値不正・非正定値・版不整合を黙って0や大きなjitterで隠さず、原因を分類して失敗させる。許容誤差等は採択前に固定する。

## HypothesisとAspect

負距離Contextなので正係数は類似性方向、負係数は差の方向を表す。ただし分類は平均符号だけで行わず、区間とROPE（実用上ほぼゼロとみなす範囲）を使う。区間がROPE内ならLOW_RELEVANCE、十分に正/負側ならSIMILARITY_ASSOCIATED / CONTRAST_ASSOCIATED、それ以外はUNDETERMINEDとする方式を校正する。区間水準・ROPE幅・境界比較はOPEN。明示Aspectと行動Evidenceが衝突する場合のCONTESTEDは別Ledgerで扱い、直接weightへ足さない。7特徴で歌声・歌詞・文脈をすべて説明できるとは言わない。

## Code / Test Map

| PoC | 再利用を検討できる責務 | 先に埋める差分 |
| --- | --- | --- |
| [lints.ts](../../experiments/stack-bakeoff/backend/shared/lints.ts) | 小さい行列のupdate/solve/sample | 正距離→負距離、末尾→先頭切片、sqrt(8)、ライブラリ比較、基準fixture |
| [service.ts](../../experiments/stack-bakeoff/backend/shared/service.ts) | 保存Contextによるrebuild、推薦commit調整 | nearest Anchor→max-score、距離半分Probe→feature別Probe、正式checkpoint |
| [contract.ts](../../experiments/stack-bakeoff/shared/contract.ts) | DTOの責務候補 | feature/context/model version、Hypothesis/Evidence、Save/継続の契約 |
| [backend.test.ts](../../experiments/stack-bakeoff/tests/backend.test.ts) | prior/更新/finite等 | 正式式fixture、anchor固定、版拒否、制約、simulation比較 |

## 数値と品質を分けて検証する

解析可能な1観測/NEUTRAL/UNSURE/重複/訂正のfixture、B対称性/正定値、batch rebuildとの一致、sample平均/covariance（固定seedと統計誤差）、percentileの単調性とtie、anchor固定を検証する。次に[複数User Model評価](evaluation.md)へ進む。finiteな結果が出ることと、良い推薦や正しい仮説が得られることは別。
