# 推薦Decisionの詳細

**Supporting Artifact / Not a Source of Truth**。正式決定は[Product Spec](../product-spec.md)と[Architecture](../architecture.md)。本書は2026-09-25、Issue #36の判断理由・実装支援を記録する。本番実装済みを意味しない。

## D-13とP-09

[D-13](../architecture.md#d-13)はProductionの実行境界、[P-03 / P-09](../product-spec.md#product-decision-log)はモデルと表現、[P-08](../product-spec.md#p-08-f25のscopeとcore-loop)は体験の優先度を定める。状態と採択日は正本を参照する。

少量の明示評価に対して、7特徴と切片から成る8次元のGaussian Linear Thompson Samplingを用いる。特徴と予測の関係を追える一方、線形・定常という近似が現実の好みを表せる保証はない。ProductionはTypeScript、実験はPythonの科学計算libraryも利用できる。数学libraryは未選定で、PoCの手書きCholeskyをそのまま採用しない。

| Candidates | 今回の扱いとWhy Not | Known Risks / Reconsider When |
| --- | --- | --- |
| Nearest Seed | 校正で必ず比較する単純な基準。更新と不確実性に基づく探索を持たない | LinTSの追加価値が出なければ複雑さ削減を提案 |
| Greedy Bayesian Linear | posterior mean最大の比較対象。不確実な候補を選ぶ動機が弱い | 探索でBad Recommendationが増えるなら再比較 |
| Gaussian LinTS | 採択。posterior sampleから選び、評価を小さい行列へ逐次反映 | misspecification、特徴相関、5回の弱いEvidenceを校正で評価 |
| LinUCB | 可能なら比較。信頼幅による楽観的選択 | 同一pool/Feedback/乱数条件で比較するまで優劣を決めない |
| Deep Learning / Neural Bandit / Deep RL | MVPで不採用。学習データ・推論基盤・説明/検証コストを必要とする要求がない | データ・品質改善・計算要件が得られた後に再検討 |
| Collaborative Filtering | MVPで不採用。複数ユーザーの学習データが前提になる | 同意・データ量・比較品質を確認した後に検討 |

個別Seedを保持するのは好みの異なる起点を平均で失わないため。Feature ReferenceをPlaybackから独立させるのは検証済み曲数の増加で尺度が変わることを防ぐため。Context/Anchor/版の保存は、後から同じRatingの意味を変えないためである。これらはProjectの設計判断であり、論文に同じ3〜5曲・7特徴・max Anchorが実証されているとは主張しない。

仮説の表示は平均符号だけでなくuncertaintyとROPEを使う。実用上の差の幅・区間水準はOPEN。全特徴UNDETERMINEDでも探索成功を妨げない。AspectはEvidenceと質問の制御に使いweightへ加算しない。Saveは発見後の行動signalとして別に測る。

Related Requirements: R-01〜06 / R-12〜17。Related Design Intents: [DI-ML-01〜04](design-intent.md)。Evidence IDs: [EV-ML-00〜09](evidence.md)。校正と比較の契約は[Evaluation](evaluation.md)。


## P-09 Detailed Rationale

正式な状態・判断要約は[正本](../product-spec.md#p-09-featureと不確実性の表現)を参照。以下はF25の比較理由・影響を移した補助記録。

- ID / Status / Date: P-09 / DECIDED（数値校正はOPEN） / 2026-09-25。P-03 / P-05の未決詳細を更新。
- Context / Requirements: Playback整備の進捗やFeedback再送で好みの意味を変えない。R-01〜03、R-12〜15。
- Candidates / Evaluation Criteria: VERIFIEDのみの参照集合 vs 全有効録音、平均Seed vs 個別Prototype、平均符号のみ vs uncertainty＋ROPE。版安定性、少量Evidenceでの過剰断定、追跡性で比較。
- Decision / Why: 3 Catalogを分離し、Feature Referenceはunique recording＋有効7特徴。Relevantはmax/argmax Seed、Probeは生成Anchor。仮説は信用区間＋ROPEで判断し、未確定を正常表示する。
- Why Not Alternatives: VERIFIED限定はMapping進捗で尺度を変え、Seed平均は複数の好みを消す。符号のみは根拠が薄い場合も断定する。
- Trade-offs / Consequences: 版管理と複数Seed比較、校正が必要。関連仮説は因果説明ではない。
- Known Risks / Reconsider When: 線形モデルの誤指定、特徴相関、参照Catalog偏り。感度分析や実User Testで誤断定/悪推薦が残れば再検討する。
- Evidence IDs: [EV-ML-00 / 01 / 06 / 08](../ML/evidence.md)。研究は考え方の根拠で、今回のmax/argmax・7特徴・5回の有効性を証明しない。
- Related Requirements / Related Design Intents: R-01〜03 / R-12〜15、[DI-ML-01〜04](../ML/design-intent.md)。

## D-13 Detailed Rationale

正式な状態・判断要約は[正本](../architecture.md#d-13)を参照。以下はF25の比較理由・影響を移した補助記録。

**推薦とGuestの独立したCore境界**

- ID / Status / Date: D-13 / DECIDED / 2026-09-25。旧判断: P-03 / P-09およびA-05の基本案。
- Context: ログインなしで小量Feedbackから次曲へ反映する。
- Requirements: R-01〜05 / R-10〜13 / R-16 / R-17。
- Candidates: TypeScriptのGaussian LinTS、重いML runtime、Account必須。
- Evaluation Criteria: 少量データ、説明可能性、数値安定性、障害独立、期間。
- Decision: Productionは8次元LinTSをTypeScriptで実行。Guestはserver Identity＋Secure/HttpOnly/SameSite Cookie。
- Why: Deep Learning/GPUを必要とする計算規模ではない。Account provider障害をGuestへ伝播させない。
- Why Not Alternatives: PyTorch/TensorFlow/scikit-learn/pandasをProductionへ先取りしない。実験でPython/NumPy/pandas/SciPy等は利用可能。
- Trade-offs: 数値library選定とCookie/CSRF/期限の詳細は必要。単純モデルの誤指定も残る。
- Consequences: 逆行列直接計算よりsolve/Cholesky。PoCの手書き行列を無検討に本番化せずlibrary比較と数値参照試験を行う。
- Known Risks / Reconsider When: モデル誤指定や計算負荷で要件未達、Guest保持/所有権の重大問題を確認した場合。
- Evidence IDs: [EV-ML-01 / EV-ML-09](../ML/evidence.md)、[EV-BE-01](../BE/evidence.md#ev-be-01)。
- Related Requirements: R-01〜05 / R-10〜13 / R-16 / R-17。Related Design Intents: [DI-ML-01 / DI-ML-02](../ML/design-intent.md)、[DI-FE-01](../FE/design-intent.md#di-fe-01)。


## P-01〜07の判断理由

S25までの記録を保持する。現在の結論・部分更新は[Productの索引](../product-spec.md#product-decision-log)を参照。旧PriorityはP-08、モデル詳細はP-09 / D-13が更新しており、当時の候補表記を現行へ適用しない。

| ID / 状態 | Context / Candidates | Decision / Reason | Rejected Alternatives / Consequences | Evidence |
| --- | --- | --- | --- | --- |
| P-01 DECIDED | 正式仕様の分散。機能別文書/ADR群 vs 2文書 | 正式Product/Architecture SSOTは2本。チームが読む入口を固定する | 新規の正式scope/requirements/技術選定/ADR群は作らない。既存基盤履歴は保持 | 2026-09-24依頼者追加指示、#34 |
| P-02 DECIDED / Baseline | 多面的な好み。個別Seed vs 単一平均 | 個別Seed・Target User・Core Value・Artist/GenreのHard制約なし | 平均だけに集約しない。需要は別途検証 | S25 §§4–6 |
| P-03 DECIDED / Current Design | 学習と探索。Gaussian LinTSが第一候補 | 正規化した負距離Context、noise 1、提示Posterior式、保存Contextで更新 | raw特徴やFeedback時のAnchor再計算を除外。品質未検証 | S25 §§8–13、[原論文](https://proceedings.mlr.press/v28/agrawal13.html)は製品の有効性を保証しない |
| P-04 DECIDED / Behavior、Providerは第一候補 | 録音と再生の分離。ISRC / Playback ID | recordingKeyと欠損fallback、Machine＋HumanのVERIFIED | 自動検索だけのVERIFIEDを除外。実再生/権利は未検証 | S25 §§7,26–27 |
| P-05 DECIDED / Baseline | 説明の忠実性と過剰断定回避 | 共通Preference State、5状態、Trace由来Rationale | 自由文LLM・独立MLを除外。分類閾値はOPEN | S25 §§19–21,24–25 |
| P-06 DECIDED / Behavior | 5曲と不足時の保証。commit数 vs 有効Interaction | 再生開始＋明示評価、UNSUREを数える。不足手順と最大2Probe | Hard緩和を禁止、連続禁止だけ理由付き緩和。旧PoCとは差分あり | S25 §§14–16 |
| P-07 DECIDED / Behavior、旧優先度案はP-08で更新 | 再送・訂正・別signalの混同 | canonical再計算、Save非reward、Intentは候補生成、Aspect非weight | 二重更新・直接weight加算・初期2モデルを除外。保存/質問UXはOPEN | S25 §§17–23 |
