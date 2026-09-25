# Recommendation Evaluation Plan

**Supporting Artifact / Not a Source of Truth**。正式仕様は[Product Spec](../product-spec.md)と[Architecture](../architecture.md)。以下は2026-09-25の実装準備であり、本番実装済みという意味ではない。

## 評価の目的と4層

未知曲発見と、好みの仮説を次曲で確かめる価値を別々に測る。5回を学習完了と呼ばず、小さい入力予算でどこまで分かるかを調べる。合格数値・被験者数はOPENで、測定前に人間が決める。

| 層 | 問い | 証拠と合格前のgate |
| --- | --- | --- |
| 1 Catalog / Playback | 必要な曲を特徴付きで取得し正しい録音を聴けるか | 取得総数を分母に7特徴有効率、ISRC coverage、dedupe、VERIFIED率、端末/地域/時刻別play成功、失敗理由、利用権。現状実曲検証0件 |
| 2 Algorithm | 更新が正しく、探索と仮説が仮定変更に耐えるか | 数値fixture＋下記simulation。候補/乱数/開始条件を揃えて比較 |
| 3 UX | 選択・再生・評価・Summary・Save・継続を理解し完遂できるか | completion、時間、UNSURE、負担、操作誤解、再生失敗。User Test未実施 |
| 4 Product Value | 新しい好みの曲を発見し、仮説を確かめる行動へ進めるか | DiscoveryとHypothesisの別指標、自由回答。需要・優位性は未検証 |

## 比較するPolicy

Nearest Seed（学習なし）、Greedy Bayesian Linear（同じモデルの平均で選択、探索なし）、Gaussian LinTS（採択方式）を必須比較。LinUCBは余力があれば追加する。候補Catalog、初期Seed、未提示/録音/Playback制約、Checkpoint定義を揃える。候補生成の効果とpolicyの効果を分け、Multi-Prototype対平均Seed、Probeあり/なし、候補閾値のablationも記録する。比較のためにBaselineへ不利な候補だけを渡さない。

## Synthetic User Model

| Model | 反応生成 | 見つけたい弱点 |
| --- | --- | --- |
| Model-matched Linear | φに既知係数を適用しnoise追加 | 基本更新・探索の実装不正。これだけの勝利ではモデル妥当性を言えない |
| Noisy / Ordinal | 連続効用を閾値で3値へ変換、誤回答も変更 | Gaussian観測と明示評価のずれ |
| Multi-modal | 複数Prototypeの周りに異なる好み | 平均Seedによる嗜好の消失、max-anchor選択の偏り |
| Hidden feature | 歌声/歌詞/文脈に相当する未観測変数を効用へ追加 | 音響7特徴で説明できない誤推薦・偽の確信 |
| Outlier Seed | 1Seedを例外的好み/誤入力として混入 | 特定Seedに探索が偏るか、候補枯渇 |
| UNSURE-heavy | 高い不明率や再生不足に依存した欠測 | 有効5回でも報酬観測が少ない場合の不確実性 |

User Modelの真値とPolicyから見える情報を分離する。Policyが真の係数・hidden値を読めないようにする。5有効Interactionまでを主結果、以後の継続は別図表。reward観測数と有効Interaction数、表示数/再生失敗/Skip数を別々に数える。seed数3〜5、catalog密度、noise、UNSURE率、ROPE、Probe guardを変え、乱数seedを複数反復する。

## Algorithm指標の定義

- Reward / Regret: simulation内の既知効用に対する累積差。Oracleにも同じ有効候補・制約を課す。実Userの真のregretは観測できない。
- Hit / Coverage: User Modelの好み領域への到達、複数Prototype coverage、重複・既知曲率。LIKE率だけで探索全体を評価しない。
- Constraint violations: Probe上限、hard filter、重複録音、保存Context違反。必ずゼロを要求する不変条件。
- Hypothesis accuracy / Coverage: 真値が定義できる合成条件だけで状態分類と区間coverageを評価。hidden/nonlinear modelでは係数の真値と心理的好みを同一視しない。
- False Certainty: 確定的状態を出した中で既知真値と誤る割合と件数。分母0は未定義として報告。全UNDETERMINEDで誤りだけを小さく見せないため、判定率も併記。
- Shortage / Cost: BLOCKED_CATALOG、soft guard緩和、候補数、query/score/solve所要時間。高速化と候補品質の交換を測る。

## UXとCore Valueの実User Test

Target Userに近い人でSeed選択からSave/継続まで観察する。既知曲かを確認し、既知の好きな曲を「未知曲発見」と数えない。操作テストと価値評価を区別し、再生失敗を負評価へ変換しない。少人数Pilotは問題発見であり、母集団への統計的優位の主張に使わない。

| 指標群 | 記録するもの |
| --- | --- |
| Completion / Burden | startした人数を分母に5有効Interaction完遂、Time to Checkpoint、離脱箇所、Seed選択時間、入力負担、UNSURE率 |
| Discovery Value | 未知かつ気に入った曲の発見数/率、Save、再聴意向、継続行動。Saveは評価指標でLinTS rewardではない |
| Hypothesis Exploration Value | 説明を自分の言葉で理解できるか、仮説を確かめる次曲を選べるか、訂正/異議、過剰断定の誤解。納得度だけで成功としない |
| Reliability | 再生失敗、重複表示、再送/復帰、Summaryとの不一致、端末accessibility |

説明の有無や文言で評価が動く可能性があるため、表示版・順序・既知度を記録する。比較User Testをする場合は割付/順序効果/同意・保持範囲を事前設計する。Account情報を集めることは評価の必須条件ではない。

## 再現可能な報告

commit、catalog/feature/context/model/policy版、seed、反応生成式、全parameter、trial数、候補制約、失敗/除外、平均だけでなく分布・不確実性を残す。校正用と最終評価用のUser Model/乱数を分け、結果を見て閾値を合わせた場合は探索的結果と表示する。過去のraw evidenceを上書きしない。

Simulationは不具合/仮定感度の検査で、需要や実User価値の証明ではない。研究の適用条件は[Evidence](evidence.md)を参照。PoCの既存29テストは現行モデルの推薦品質比較ではなく、上記評価は今後の実装Issueで実施する。
