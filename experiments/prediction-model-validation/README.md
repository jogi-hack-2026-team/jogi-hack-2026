# 予測モデル検証スクリプト

Supporting Artifact / Not a Source of Truth。使い捨ての数値実験で、本番のPrediction Engineではない。結果の要約は[Evidence](../../docs/prediction/evidence.md)、正式な判断は[Architecture](../../docs/architecture.md#prediction-engine)。

依存パッケージなし。Node 24以上で、このフォルダから実行する（2026-09-30にNode 25.2.0で実行。2026-10-02に分位点の境界誤差とDPの微小確率の打ち切りを直し、全スクリプトをNode 24.21.0で再実行して`results/`を更新）。

| ファイル | 内容 | 実行 |
| --- | --- | --- |
| `engine2.mjs` | 2状態モデルの試作（MC、到達日分布のDP、乱数） | 他から読み込む |
| `exp1.mjs` | 固定θでのMCとDPの比較、CRNの効果、実行時間 | `node exp1.mjs` |
| `exp2.mjs` | 恒等式（SKIP = DONE ⊕ Geometric(b)）の確認、記録漏れの影響 | `node exp2.mjs` |
| `final.mjs` | M0 / M1 / M2の比較（`main`）とM2の事前分布の感度（`prior`） | `node final.mjs 150 main`、`node final.mjs 100 prior` |
| `final2.mjs` | 同一観測でのモデル選択、漸化式の厳密性、中心指標の候補比較、完了の目安の実行時間 | `node final2.mjs` |
| `final3.mjs` | M1の中心指標での事前分布Beta(1,1)とBeta(2,2)の比較 | `node final3.mjs` |
| `bench.mjs` | 仕様の乱数・サンプラーのテストベクトル、素朴なDPの実行時間 | `node bench.mjs` |
| `bench2.mjs` | 配列の使い回しと刈り込みを入れたDPの最悪ケースの実行時間 | `node bench2.mjs` |
| `bgq-boundary-check.mjs` | Beta-Geometric分位点の境界の回帰チェック（境界例・α = 2の閉形式との照合・旧実装との不一致件数） | `node bgq-boundary-check.mjs` |
| `completion-dp.mjs` | 完了の目安のDP（微小確率で打ち切らない参照実装）と分位点の判定 | 他から読み込む |
| `dp-truncation-check.mjs` | DPの回帰チェック（打ち切りで分位点が変わるレビュー例、`requiredFutureDone = 1`の独立式との照合、刈り込みあり／なしの一致、ちょうど同点の例） | `node dp-truncation-check.mjs` |

`exp2.mjs`の事前分布の感度（2状態・完了日P50の評価）は、中心指標が変わる前の検討で使ったもので、現在の事前分布の判断には`final.mjs prior`と`final3.mjs`を使う。
