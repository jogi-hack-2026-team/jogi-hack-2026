# ML Design Intent

**Supporting Artifact / Not a Source of Truth**。正式決定は[Product Spec](../product-spec.md)と[Architecture](../architecture.md)。本書は2026-09-25、Issue #36の判断理由・実装支援を記録する。本番実装済みを意味しない。

以下はレビュー可能な設計理由であり、AIのprivate chain-of-thoughtではない。

## DI-ML-01

**推薦時のAnchorとContextを固定する**

- ID / Title: DI-ML-01 / 推薦時のAnchorとContextを固定する
- Context: Feedback到着までに状態や候補の最適Seedが変わり得る。
- Intent: 評価を提示時の判断へ結び付ける。
- Design: Relevantは共通θ_sampleで各Seedをscoreしmax/argmax、Probeは生成Anchorを固定。TraceへContext/Anchor/State/変換/model版を保存する。
- Why: 別Anchorで学習するとユーザーが聴いた時と異なる観測になる。
- Invariants: Feedback時にAnchor/Contextを再計算しない。
- Non-Goals: 最新Stateで過去の理由を作り直す。
- Alternatives Considered: 最寄りSeedの固定選択、平均Seed、feedback時argmax。
- Trade-offs: 候補×Seed比較とTrace容量が増える。
- Failure / Risk: 同点規約・版が不明、Probeの対象特徴とAnchorがずれる。
- Change Guidance: tie-break、候補pool snapshot、版を契約化し、state変化後のFeedbackをfixtureで確認。
- Related Requirements: R-01 / R-03 / R-12
- Related Decisions: P-09 / D-13
- Evidence: [EV-ML-00](evidence.md#ev-ml-00) / [EV-ML-01](evidence.md#ev-ml-01) / [EV-ML-09](evidence.md#ev-ml-09)
- Code Map: [Service.recommend/feedback](../../experiments/stack-bakeoff/backend/shared/service.ts)。PoC Anchorは最寄りでmax-scoreと異なる。
- Tests: 保存Context再利用は既存。max/argmaxとProbe固定は本番未実装。

## DI-ML-02

**Feature versionを混ぜない**

- ID / Title: DI-ML-02 / Feature versionを混ぜない
- Context: 参照集合・正規化を変えると同じ録音の座標が変わる。
- Intent: 各Posteriorの観測空間を固定する。
- Design: unique recording＋有効7特徴のFeature Referenceをversion管理。Mapping VERIFIEDを参照母集団の条件にしない。Contextは負距離＋先頭切片をsqrt(8)で正規化。
- Why: Playback整備の進捗は好みの学習尺度の変更理由にならない。
- Invariants: 異なるtransform/context/model版の観測を黙って同じPosteriorへ集計しない。
- Non-Goals: 生tempoを他の0〜1値へ無変換で混在。
- Alternatives Considered: VERIFIED限定のpercentile、単一固定距離threshold。
- Trade-offs: Catalog偏りとtie規約、移行再構築の手間。
- Failure / Risk: 旧PoCの正距離・末尾切片と新Contextを混ぜる。
- Change Guidance: 同順位/欠損・版移行のOPENを決め、旧履歴の再構築かState分離を明記。library/solve参照値試験を実施。
- Related Requirements: R-02 / R-03 / R-12
- Related Decisions: P-09 / D-13
- Evidence: [EV-ML-00](evidence.md#ev-ml-00) / [EV-ML-09](evidence.md#ev-ml-09)
- Code Map: [lints.context](../../experiments/stack-bakeoff/backend/shared/lints.ts)、[contract](../../experiments/stack-bakeoff/shared/contract.ts)。実transformはなし。
- Tests: 現行Context/版混在拒否/percentile単調性・ties・欠損は未整備。既存finite testは新モデル品質の証明ではない。

## DI-ML-03

**Save・失敗・不明をRewardにしない**

- ID / Title: DI-ML-03 / Save・失敗・不明をRewardにしない
- Context: 操作や障害の意味を同じ好みsignalへ押し込むと学習が歪む。
- Intent: 明示的な3値だけを報酬観測とする。
- Design: LIKE +1 / NEUTRAL 0 / DISLIKE -1。UNSUREはcheckpointのみ、Skip/Save/Playback failureは学習なし。AspectはEvidence Ledgerへ分離。
- Why: 保存意図や機器障害は好みの正負と等価ではない。
- Invariants: NEUTRALはBを更新し、UNSUREはB/fとも更新しない。
- Non-Goals: Save reward加算、失敗DISLIKE、Aspectの直接weight加算。
- Alternatives Considered: implicit listen時間をrewardにする方式。
- Trade-offs: 明示入力の負担、少ない観測。
- Failure / Risk: UNSUREを0へ変換、revisionで旧Ratingを二重保持。
- Change Guidance: 入力分類をFE/BE/ML共通契約にし、canonical再構築と副作用非発生を検証。
- Related Requirements: R-03〜06 / R-14 / R-17
- Related Decisions: P-07 / P-08 / D-13
- Evidence: [EV-ML-00](evidence.md#ev-ml-00) / [EV-ML-04](evidence.md#ev-ml-04) / [EV-ML-06](evidence.md#ev-ml-06)
- Code Map: [Service.feedback](../../experiments/stack-bakeoff/backend/shared/service.ts)。Save/Aspect実装なし。
- Tests: NEUTRAL/UNSURE/revisionは既存。Save/失敗/AspectのB/f不変とcheckpoint境界は未整備。

## DI-ML-04

**ProbeとHypothesisで因果・確信を誇張しない**

- ID / Title: DI-ML-04 / ProbeとHypothesisで因果・確信を誇張しない
- Context: 似た曲でも未観測の歌声/文脈が異なり、5回では不確実性が大きい。
- Intent: 根拠と限界を伴う探索仮説を表示する。
- Design: Probeのother-feature closenessとtarget contrastを別検査。仮説はuncertainty＋ROPE、衝突EvidenceはCONTESTED。
- Why: 単一係数符号や重み付き距離だけでは少量Evidenceと交絡を隠す。
- Invariants: Probeは因果証明ではない。全UNDETERMINEDも正常。Hard条件/Probe最大2を破らない。
- Non-Goals: あなたは必ず好きという断言、5曲で学習完了。
- Alternatives Considered: 平均符号分類、重み付き目的関数だけのProbe。
- Trade-offs: 候補不足と保守的な表示が増える。
- Failure / Risk: モデル誤指定でposteriorだけが狭くなりFalse Certaintyを生む。
- Change Guidance: 複数Synthetic User・感度分析・実User Testを通しROPE/区間水準を人間が決定。
- Related Requirements: R-13 / R-14 / R-15
- Related Decisions: P-05 / P-09 / D-13
- Evidence: [EV-ML-01](evidence.md#ev-ml-01) / [EV-ML-05](evidence.md#ev-ml-05) / [EV-ML-07](evidence.md#ev-ml-07) / [EV-ML-08](evidence.md#ev-ml-08)
- Code Map: [Service](../../experiments/stack-bakeoff/backend/shared/service.ts)の距離二分Probeは旧仮定。Hypothesis Engine未実装。
- Tests: [評価計画](evaluation.md)。feature別Probe/分類/False Certaintyの試験は未整備。
