# Recommendation Evidence

**Supporting Artifact / Not a Source of Truth**。正式判断は[Product Spec](../product-spec.md)と[Architecture](../architecture.md)。閲覧・コード確認日: 2026-09-25。論文の知見、公式仕様、過去実験、人間の判断を区別する。

RESEARCHは研究条件での結果、PRODUCTION_RESEARCHは運営環境の事例、SPECは仕様、LOCAL_POCは限定実験、ENGINEERING / HYPOTHESISは設計判断・未検証仮説。いずれも他の種別へ無断で昇格しない。

## EV-ML-00

- Accessed Date: 2026-09-25
- Type: ENGINEERING (human decision)
- Source / Author / Date: 2026-09-25依頼者の文書確定指示、[Issue #36](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/36)、[P-08 / P-09](../product-spec.md#product-decision-log)。
- Reviewed section / Conditions: 3〜5Seed、7特徴、負距離正規化、Gaussian LinTS、Save/継続Mustの採択。
- Supports: 現行仕様の決定源。Prototype保持、Trace、信号分離で追跡可能性を確保する意図。
- Does not support / Limitations: 需要、5回の推定精度、max/argmax、ROPE、Probe効用を実証したEvidenceではない。これらの適合性はHYPOTHESISとしてevaluationで検証。
- Applied to: P-08 / 09、D-13、DI-ML-01〜04。

## EV-ML-01

- Accessed Date: 2026-09-25
- Type: RESEARCH (theory)
- Source / Author / Date: Shipra Agrawal / Navin Goyal、Microsoft Research、ICML 2013、PMLR 28(3):127–135。[Thompson Sampling for Contextual Bandits with Linear Payoffs](https://proceedings.mlr.press/v28/agrawal13.html)、[本文](https://proceedings.mlr.press/v28/agrawal13.pdf)。
- Reviewed section / Conditions: §2.1〜2.3、Algorithm 1。期待報酬が線形、条件付きsub-Gaussian noise等の仮定。被験者データによる製品実験ではない。
- Supports: Contextを使う線形banditと、行列更新・Gaussian sampleで不確実性を探索へ使う方法。
- Does not support / Limitations: 原論文は探索分散v²B⁻¹を用い、本設計の固定noise1と同一保証ではない。ordinal評価、非線形好み、Seedごとのmax、5回で良い推薦/説明を保証しない。
- Applied to: D-13、DI-ML-01 / 04。理論と実装の数値整合は別試験。

## EV-ML-02

- Accessed Date: 2026-09-25
- Type: RESEARCH
- Source / Author / Date: Lihong Li / Wei Chu / John Langford / Robert Schapire、WWW 2010。[A Contextual-Bandit Approach to Personalized News Article Recommendation](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/p661.pdf)。
- Reviewed section / Conditions: 線形UCBの構成とYahooニュースのrandomized logによるoffline評価。観測signalはclick。
- Supports: 不確実性を上側信頼境界で扱うLinUCBを比較候補にする理由。offline比較はlogging条件を揃える必要。
- Does not support / Limitations: 音楽明示3値・複数Seed・5回checkpointの有効性は対象外。ニュースでの改善量を移植しない。
- Applied to: D-13、evaluationの追加baseline。

## EV-ML-03

- Accessed Date: 2026-09-25
- Type: PRODUCTION_RESEARCH
- Source / Author / Date: James McInerneyほか、Spotify、RecSys 2018、DOI 10.1145/3240323.3240354。[Explore, Exploit, and Explain](https://jamesmc.com/s/BartRecSys.pdf)。
- Reviewed section / Conditions: §3.1〜3.2はitem/explanation/contextのjoint model、§4.1は関連playlistを事前選別したrandomized log、§4.2は本番A/B。主なsignalはstream。
- Supports: 探索と説明を一緒に評価する必要、候補のrelevance制約、学習時と提供時の特徴変換一致が運用上重要。
- Does not support / Limitations: Bartのlogistic/factorization modelと本設計LinTSは別。既存Spotify user・playlist推薦の結果をGuestの未知単曲5回へ一般化しない。説明は反応に影響するため仮説の真実性とengagementも分ける。
- Applied to: DI-ML-02 / 04、評価のDiscoveryとHypothesis分離。

## EV-ML-04

- Accessed Date: 2026-09-25
- Type: PRODUCTION_RESEARCH
- Source / Author / Date: Paolo Dragone / Rishabh Mehrotra / Mounia Lalmas、Spotify Research、2019-05-01。[Deriving User- and Content-specific Rewards for Contextual Bandits](https://research.atspotify.com/2019/5/deriving-user-and-content-specific-rewards-for-contextual-bandits)。
- Reviewed section / Conditions: playlistのimplicit listening rewardとuser/content群差を扱う研究紹介。
- Supports: 報酬の定義はuser/content/目的に依存し、Saveや再生障害を無条件で同じ観測にしない設計上の注意。
- Does not support / Limitations: 明示+1/0/-1が最適という実証ではない。co-clusteringやimplicit stream rewardを採用する根拠にはしない。
- Applied to: DI-ML-03。

## EV-ML-05

- Accessed Date: 2026-09-25
- Type: RESEARCH / SIMULATION
- Source / Author / Date: Ofer Meshiほか、Google/YouTube、ICML 2023 Many Facets of Preference Learning Workshop。[Preference Elicitation for Music Recommendations](https://icml.cc/media/icml-2023/Slides/29091.pdf)。Chih-Wei Hsuほか、SIGIR 2024、[Minimizing Live Experiments in Recommender Systems](https://arxiv.org/html/2409.17436v1)（公開版2024-09-26）。
- Reviewed section / Conditions: 前者のartist onboarding・coverage/選好予測を扱う方式、後者§2の同課題、§4のuser simulator、§5の実験基盤。
- Supports: 入力予算が小さいonboardingで好みの広がりを扱い、simulatorをlive試験の前に使うという問題設定。
- Does not support / Limitations: artist選択と曲の7音響特徴は異なる。学習済みembeddingや履歴がある条件をGuestへ移せない。simulator内の順位一致は実Userの需要や満足を保証しない。
- Applied to: Multi-Prototypeの比較観点、evaluationの複数User Model。

## EV-ML-06

- Accessed Date: 2026-09-25
- Type: RESEARCH
- Source / Author / Date: Dmitry Bogdanov / Martín Haro / Ferdinand Fuhrmann / Anna Xambó / Emilia Gómez / Perfecto Herrera、UPF MTG、Information Processing & Management 49(1), 2013, 13–33、DOI 10.1016/j.ipm.2012.06.004。[Semantic audio content-based music recommendation and visualization based on user preference examples](https://mtg.upf.edu/system/files/publications/bogdanov-IPM2013.pdf)。
- Reviewed section / Conditions: §4（p19）の12名、25〜45歳、主に音楽愛好者、Seed 23〜178/中央値57。§5.1のsemantic profile比較、§5.2のfamiliarity/liking/listening intention。
- Supports: 複数の好み例を使う音響推薦と、既知度・好感・聴く意図を別評価する先行例。
- Does not support / Limitations: 標本が小さく音楽経験に偏る。3〜5Seedのmax score、未知曲Guest、LinTS、Save非rewardの直接比較ではない。
- Applied to: P-09 / DI-ML-01 / 03、Discoveryの既知度確認。

## EV-ML-07

- Accessed Date: 2026-09-25
- Type: RESEARCH / SIMULATION
- Source / Author / Date: Eugene Ieほか、Google、2019。[RecSim: A Configurable Simulation Platform for Recommender Systems](https://arxiv.org/pdf/1909.04847)、[Google Research解説](https://research.google/blog/recsim-a-configurable-simulation-platform-for-recommender-systems/)（2019-11-19）。
- Reviewed section / Conditions: user/document/responseを構成するsimulation frameworkのモデル分離。
- Supports: ユーザーの反応・候補・環境仮定を変えてpolicyの挙動を調べる評価設計。
- Does not support / Limitations: simulationが現実を再現する保証ではない。RecSim導入自体は不要で、小さい独自fixtureでも目的を満たせる。
- Applied to: evaluationの複数Synthetic User、sim-to-real限界。

## EV-ML-08

- Accessed Date: 2026-09-25
- Type: RESEARCH (position / research agenda)
- Source / Author / Date: Filip Radlinski / Krisztian Balog / Fernando Diaz / Lucas Dixon / Ben Wedin、Google、SIGIR 2022、DOI 10.1145/3477495.3531873。[On Natural Language User Profiles for Transparent and Scrutable Recommendation](https://storage.googleapis.com/gweb-research2023-media/pubtools/6643.pdf)。
- Reviewed section / Conditions: §§2〜3のprofile提示/修正、§3.2.4のstated/revealed preference不一致、§4の評価課題。
- Supports: Userが仮説を検査し異議を示せる設計、衝突Evidenceを隠さず別評価する動機。
- Does not support / Limitations: 本稿は新たな被験者実験で今回のUXを実証したものではない。LLM採用、Aspectから直接weight操作、ROPE閾値の根拠ではない。
- Applied to: DI-ML-04、R-13 / 14、Hypothesis探索価値の評価。

## EV-ML-09

- Accessed Date: 2026-09-25
- Type: LOCAL_POC (historical)
- Source / Author / Date: [lints.ts](../../experiments/stack-bakeoff/backend/shared/lints.ts)、[Service](../../experiments/stack-bakeoff/backend/shared/service.ts)、[backend.test.ts](../../experiments/stack-bakeoff/tests/backend.test.ts)、2026-09-24〜25。
- Reviewed section / Conditions: 合成特徴、正の距離＋末尾切片、正規化なし。手書きCholesky solve/sample、prior I、noise1。
- Supports: 解析解/有限性、NEUTRAL更新・UNSURE除外、保存Contextを使うcanonical rebuildの限定Evidence。
- Does not support / Limitations: 正式な負距離/先頭切片/sqrt(8)、max-score Anchor、percentile reference、feature別Probe、ROPE、5有効Interaction、推薦品質は未検証。PoCは最寄りAnchorと距離二分Probe。
- Applied to: D-13、DI-ML-01〜04、本番へコピー前に差分試験が必要。

## 利用権とEvidenceの境界

Feature仕様が公開されていること、研究で音楽Dataが使われたことは、当サービスの保存・学習許諾ではない。[EV-BE-08の公式規約調査](../BE/evidence.md#保存学習用途の追加確認)を実Catalog導入のgateとする。研究用と公開用のデータ権利も分ける。
