# 音楽探索プロダクト仕様

正式なProduct仕様のSingle Source of Truth。実現方法の正本は[Architecture](architecture.md)。2026-09-24、[Issue #34](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/34)で初版を整理した。本番アプリは未実装であり、比較PoCの動作をそのまま正式仕様にはしない。

## 状態と根拠

| 状態 | 意味 |
| --- | --- |
| DECIDED | 人間が明示決定した事項。決定者・記録・範囲を残す |
| RECOMMENDED | 採用を推奨する候補。採用済みではない |
| CONDITIONAL | 条件の成立確認または詳細決定が必要な候補 |
| OPEN | 未決。推測で補完しない |

以下のBaselineは、依頼者が人間との仕様検討・研究調査を経た有力案として提示したもの。**今回の調査の前提として維持するが、全項目をチームの最終DECIDEDには昇格させない**。元研究の全資料・過去の異常系レビュー本文は今回の添付、main、#21・#22のコメントにはなかったため、独立に再検証済みとはしない。

確定している今回の作業方針は、正式設計文書を本書とArchitectureの2本へ集約すること、比較PoCの実施、Issue #34のScopeがMustであること。プロダクト全体のMUST / SHOULD / COULD分類は下記のレビュー案であり、チーム承認待ち。

## Product Overview

- Concept / Core Value（Baseline）: 自分の好みについて仮説を立て、次の曲で確かめながら未知曲を探索する。主目的は音楽探索であり、自己分析の断定ではない。
- Target User（OPEN）: 好きな曲を起点に未知曲を見つけたい人を想定するが、具体的な対象層・利用状況・既存手段への不満はユーザー検証で確定する。
- Principles（Baseline）: 好みの多面性を保持する、推薦判断と説明を一致させる、障害を好みと誤認しない、根拠不足を正常に扱う、ログイン前にCore Experienceを提供する。
- Product Name、具体UIレイアウト、画面分割、色、操作文言はOPEN。Frontend担当との協議事項であり、PoCの英語2画面を製品UIとして採択しない。

## User Experience

1. Guestが曲を検索し、異なる録音のSeedを最低3曲・最大5曲選ぶ。Featureを取得可能なら、Seed自体は再生できなくてもよい。
2. Seedを個別のPrototypeとして保持する。3曲未満なら探索を開始せず、追加選択を案内する。
3. 初回はRelevant Candidateを推薦する。InteractionとDecision Traceの保存に成功してから確定表示する。
4. 再生可能な未知曲を聴き、LIKE / NEUTRAL / DISLIKE / UNSUREを明示する。保存失敗と再生失敗を区別する。
5. 2曲目以降は既存Evidenceを使ってAdaptiveに選び、初回Probeは最大2回、連続Probeを禁止する。
6. 初回5曲をCheckpointとしてPreference Summaryを示す。根拠不足なら仮説0件でも正常終了できる。
7. 継続探索のBaselineは同じPreference Stateを引き継ぐこと。続行条件、Probe上限のリセット、終了条件、履歴の保存期間はOPEN。

Guestの保存方式・期限・別端末復帰はArchitectureで検討する。LoginをSeed選択・初回探索・Summaryの前提にしない。

## RecommendationとPreference

| Product Behaviorとしての要求 | Current Design / Baseline | 状態・未決点 |
| --- | --- | --- |
| 複数の好みの起点を保つ | 3〜5のMulti-Prototype Seedsを保持。単一平均だけに集約しない | Baseline維持。Anchor選定詳細はCONDITIONAL |
| 異なる尺度の特徴を比較可能にする | Catalog内percentileへ変換し、CandidateとAnchor Seedの特徴別距離をContextに使う | CONDITIONAL。参照Catalog、同順位、外れ値、欠損、更新時の版管理はOPEN |
| 好みに近い探索と仮説を確かめる探索を両立する | Relevant Candidate / Contrastive Probe Candidate | Baseline維持。pool分割・探索率・不足時fallbackはOPEN |
| 評価を次の推薦へ反映する | Gaussian Linear Thompson Sampling、prior θ ~ N(0,I) | 第一候補を維持。観測ノイズ分散・正則化・Context符号/正規化の詳細はCONDITIONAL |
| 初回に偏ったProbe体験を避ける | Session Controllerが初回Relevant、Probe最大2、連続禁止を管理 | Baseline維持。5曲の計数規則はOPEN |
| 評価変更後も現在の評価と学習状態を一致させる | canonical Feedback集合からPosteriorを再計算する | 第一候補を維持。変更競合のUI提示はOPEN |
| 仮説と推薦で好みの根拠を共有する | Multi-Prototype Seeds / Posterior / Rating History / Aspect Feedback / Evidence Ledgerを共通Preference Stateとする | 独立した別ML Preference Modelは作らない案。Aspectの更新規則はOPEN |
| 表示説明を実際の判断に対応させる | Decision TraceからRecommendation Rationaleを生成する | LLMの自由な推薦理由生成はMVPで使わない案 |

基本7特徴はdanceability、energy、valence、tempo、acousticness、speechiness、instrumentalness。loudness、livenessは補助。ReccoBeatsをFeature取得元の候補として維持するが、実曲のcoverage・利用条件・欠損率は未検証。YouTube動画・音声をML Featureとして取得・加工しない。

Evidence Ledgerは「どのInteraction、録音、Anchor、特徴版、Rating revision、Aspect訂正を根拠にしたか」を追跡する案。推薦を表示しただけのイベントと、嗜好学習に利用できる明示評価を分ける。7特徴＋切片の8次元はPoCの仮定であり、新しい正式Algorithm Decisionではない。

## Feedback

| 入力・事象 | Preference Learning | ユーザーに保証すること |
| --- | --- | --- |
| LIKE | reward +1 | 保存後の次回判断へ反映 |
| NEUTRAL | reward 0 | 観測としてPosteriorを更新する。更新なしと混同しない |
| DISLIKE | reward -1 | 明示的な好みの否定として扱う |
| UNSURE | 更新なし | 不確実という履歴は残せるが、0報酬として学習しない |
| Playback Failure | 更新なし | DISLIKEへ変換しない。復旧・代替操作の詳細はOPEN |
| Skip | OPEN | 未評価の離脱から負のrewardを推定しない。カウントと次曲への進み方は未決 |
| 同一Interactionのretry | 追加更新なし | 重複送信がPreferenceを二重更新しない |
| Rating Revision | 現在のcanonical集合へ一致させる | 古いRatingを残した二重加算をしない。競合時に黙って古い状態へ戻さない |

Ratingの履歴を監査用に残すか、変更可能期間、同一値の再保存時のUI、複数タブの競合表示はOPEN。PoCのexpectedRevision方式はArchitecture候補であり、ユーザー操作の仕様を固定しない。

## PlaybackとRecording Identity

- Product Requirement: 未知曲の推薦対象は再生可能な録音に限定する。Seedの再生可否と混同しない。
- Current Design: YouTube IFrame Player APIを第一候補とし、YouTubeはPlayback Providerとして扱う。実データでの成立性を確認するまでCONDITIONAL。
- Canonical Recording Identityの第一候補はISRC。YouTube Video IDはPlayback Mappingであり、録音の同一性を保証するIDとして使わない。ISRC欠損・重複・別マスター/ライブ版の扱いはOPEN。
- Mapping状態: UNVERIFIED（未確認）、CANDIDATE（機械判定を通過した候補）、VERIFIED（Machine Gate＋Human Reviewで対応する録音と再生条件を確認）、REJECTED（不適合）。
- VERIFIEDは永続的な再生保証ではない。確認日時・対象地域/端末・録音一致の証拠・判定者を記録する案。公開中か・埋め込み可能かだけでVERIFIEDへ昇格させない。
- 同じ録音を別動画に置き換えて再推薦しない。禁止範囲をセッション内か継続探索/アカウント全体までとするかはOPEN。
- 再生失敗はMappingの再確認対象とし、学習イベントと分離する。広告・地域制限・削除・年齢制限・autoplay拒否を試験対象にする。
- 今回、実IFrame再生・実Mapping・30曲等の検証済みCatalogは作成していない。10〜15秒の自動停止仕様を追加しない。実装前に[YouTubeの必須機能](https://developers.google.com/youtube/terms/required-minimum-functionality)と利用規約を確認する。

## Preference Hypothesis

| 状態候補 | 表示の意味 |
| --- | --- |
| SIMILARITY_ASSOCIATED | ある特徴でAnchorに近い曲と好評価が関連している可能性 |
| CONTRAST_ASSOCIATED | ある特徴で異なる曲と好評価が関連している可能性 |
| LOW_RELEVANCE | 現在のEvidenceでは特徴の関係が弱い可能性。嫌いの断定ではない |
| UNDETERMINED | 根拠が不足し、判断できない |
| CONTESTED | 評価や訂正の根拠が競合している |

Probeは因果関係の証明ではない。Threshold、必要Evidence数、信頼度の表示、異なるAnchor間の集約、CONTESTEDへの遷移規則はOPEN。User Correction / Aspect Feedbackは本人の訂正を根拠として保持する案であり、未検証の数値rewardへ自動変換しない。仮説0件やUNDETERMINEDを正常な結果として説明し、曲の探索は妨げない。

## Requirements

Priorityは**提案**（MUST候補等）であり、Project #34のMust決定を製品全要件へ転用しない。Verificationの「PoC」は合成Catalog上の限定検証であり、製品のAcceptance完了を意味しない。実装方式を要件本文に固定しない。

| ID | Priority案 | Requirement / Rationale | Acceptance Criteria | Verification | Related Architecture |
| --- | --- | --- | --- | --- | --- |
| R-01 | MUST | 好きな3〜5録音を選び複数の好みを保持する | 2曲以下・6曲以上・重複録音を拒否。再生不可でもFeature取得可能ならSeedに使える | PoC:件数/ID重複。録音/Featureは実Catalog待ち | [A-02](architecture.md#a-02-recommendationとpreference) |
| R-02 | MUST | 特徴尺度による偏りを避ける | 欠損・変換版・Anchorを追跡し、生の尺度をそのまま線形入力にしない | 合成percentileのみ。実変換はOPEN | [A-02](architecture.md#a-02-recommendationとpreference) |
| R-03 | MUST | 評価を次曲判断へ反映する | 4評価の区別、UNSURE非学習、NEUTRAL観測、有限な更新結果 | PoC:数値/DB/HTTP、実推薦品質は未検証 | [A-02](architecture.md#a-02-recommendationとpreference) |
| R-04 | MUST | 初回5曲を探索の区切りにする | 1曲目Relevant、Probe最大2、非連続。再生失敗・Skipの計数はO-01決定後に検証 | PoC:commit5件だけ。実体験の計数はOPEN | [A-03](architecture.md#a-03-sessionと整合性) |
| R-05 | MUST | 同じFeedback再送で二重学習しない | 同時再送でもcanonical評価とPosteriorが一意に一致 | PoC:16並列、競合/別Interaction同時更新 | [A-03](architecture.md#a-03-sessionと整合性) |
| R-06 | SHOULD | Ratingを訂正できる | 訂正後にcanonical集合から求めた状態と一致し、古いretryを拒否 | PoC:revision競合/再計算 | [A-03](architecture.md#a-03-sessionと整合性) |
| R-07 | MUST | 保存できた判断だけを確定表示する | Trace保存失敗で半端なInteractionを残さない。retryで同じ結果を返す | PoC:SQL失敗注入・HTTP/画面 | [A-03](architecture.md#a-03-sessionと整合性) |
| R-08 | MUST | 未知曲は再生可能な録音に限定する | Mapping根拠と録音一致を人が確認。再生障害を負評価へ変換しない | Playback Mockのみ。実再生は公開前ゲート | [A-04](architecture.md#a-04-catalogとplayback) |
| R-09 | MUST | 同一録音を再推薦しない | 別動画・別Track IDでも既提示Recordingを排除。範囲O-03を決定する | PoC:合成Track IDのみ。ISRC照合はOPEN | [A-04](architecture.md#a-04-catalogとplayback) |
| R-10 | MUST | Login前にCore Experienceを完了できる | Seed→初回探索→Summary。reload時の保存失敗を通知 | PoC:E2E、実期限/認可は未実装 | [A-05](architecture.md#a-05-authenticationとguest) |
| R-11 | MUST | 他人のPreferenceを閲覧・更新させない | 他Guestの識別情報では404等で拒否し、内部情報を漏らさない | PoC:token所有権。公開時のCookie/CSRFはOPEN | [A-05](architecture.md#a-05-authenticationとguest) |
| R-12 | MUST | 説明が実際の推薦判断と一致する | Candidate/Anchor/特徴版/評価版/選択根拠を追跡できる | PoC:保存Traceと返却値一致。文面生成は未実装 | [A-06](architecture.md#a-06-hypothesisとobservability) |
| R-13 | MUST | 不足Evidenceを正常結果として扱う | Hypothesis 0件でもSummary表示・探索可能。因果的に断定しない | PoC:固定の不足説明のみ。分類ThresholdはOPEN | [A-06](architecture.md#a-06-hypothesisとobservability) |
| R-14 | SHOULD | 根拠へユーザー訂正を反映できる | 訂正と推定を区別し、矛盾した根拠を追跡 | 未実装、Aspect semanticsはOPEN | [A-06](architecture.md#a-06-hypothesisとobservability) |
| R-15 | MUST | 外部障害・候補不足で評価を捏造しない | timeout/429/500と候補0を区別し、未保存推薦を確定表示しない | PoC:外部障害Mock。実quota/候補不足UXはOPEN | [A-04](architecture.md#a-04-catalogとplayback) |
| R-16 | SHOULD | Checkpoint後も好みを引き継いで探索できる | 履歴/既出録音/評価を維持し、継続時のProbe条件を満たす | PoC対象外、O-04決定待ち | [A-03](architecture.md#a-03-sessionと整合性) |

## Scope

以下はチームレビュー用のRECOMMENDED分類。正式分類の承認はOPEN。

| 分類案 | 内容 |
| --- | --- |
| MUST | R-01〜05、R-07〜13、R-15。Core Experience・学習/保存の一貫性・再生成立性 |
| SHOULD | R-06、R-14、R-16。Rating訂正、Aspect訂正、継続探索 |
| COULD | 永続Account、別端末復帰、より詳細な評価可視化。要件と費用の承認後に検討 |
| WON'T | 今回のPoCで本番アプリを完成させること、全FE×BE組合せ、YouTube音声のML利用、LLMによる自由な推薦理由、未承認の有料契約。製品に恒久禁止する判断とは分ける |

## Failureと境界値

| 条件 | 保証する振る舞い / 未決点 |
| --- | --- |
| Seed不足/6件/同一録音 | 探索開始前に修正を要求。Feature欠損の除外理由・再検索案内の文言はOPEN |
| Feature欠損/NaN/版違い | 不明を0や中央値で黙って埋めない。対象除外/補完の採択はOPEN |
| Playback failure | 負評価・学習回数へ変換しない。試行/成功再生/有効評価のカウントを分離しO-01で決定 |
| Candidate shortage/Probe不足 | VERIFIED条件や重複禁止を黙って緩めない。Relevant fallback・停止・再Seedの優先順位はOPEN |
| Duplicate recording | Mappingが異なっても同一録音を排除。欠損ISRCの同定規則はOPEN |
| Feedback retry/応答消失 | 二重反映しない。再送/保存状態を確認する。競合はユーザーへ明示 |
| 5-track count | commit数、再生成功数、評価数を混同しない。PoCはcommit5件で止めるが、正式定義はOPEN |
| Hypothesis 0件/CONTESTED | 異常終了にせず、不足/競合を説明。断定文を生成しない |
| Guest保存不可/期限切れ | 保存不可を通知。消失した状態を復元できたと装わない。復帰動作はOPEN |

## Evaluation

| 観点 | 評価方法案 | 現在の証拠・ゲート |
| --- | --- | --- |
| Catalog / Playback成立性 | 必要曲数、Feature coverage、録音一致、VERIFIED件数、地域/端末別再生成功率、失敗原因を記録 | 実曲0件検証。必要な規模・合格率はOPEN。ここを満たさず公開Goにしない |
| Algorithm | 固定乱数のsynthetic preferenceで更新正当性・探索傾向・重複/Probe制約を確認。random/relevant-onlyと比較 | PoCは解析解・有限性・guardrailのみ。好み推定の優位性やregret改善を実証していない |
| User | 3〜5曲選択→探索→Summaryの完遂、再生失敗、分かりづらい表現、所要時間を観察 | 被験者・評価尺度・閾値・具体UIアンケートはOPEN |
| Core Value | 未知曲発見と「仮説を次曲で確かめられた」経験を別々に評価 | 自己分析の納得度だけを成功指標にしない。実ユーザー評価未実施 |

## Product Decision Log

| ID / 状態 | Context / Candidates | Decision / Reason | Rejected Alternatives / Consequences | Evidence |
| --- | --- | --- | --- | --- |
| P-01 DECIDED | 正式仕様の分散。機能別文書/ADR群 vs 2文書 | 正式Product/Architecture SSOTは2本。チームが読む入口を固定する | 新規の正式scope/requirements/技術選定/ADR群は作らない。既存基盤履歴は保持 | 2026-09-24依頼者追加指示、#34 |
| P-02 RECOMMENDED・Baseline維持 | 多面的な好み。Multi-Prototype vs 単一平均 | 個別Seedを保持し、Anchorとの距離を利用する案を維持 | 単一平均だけへの集約をしない。Feature版/欠損処理が必要 | 依頼者「Current Baseline Decisions」 |
| P-03 CONDITIONAL・Baseline維持 | 学習と探索。Gaussian LinTS | reward/prior/UNSUREの提示Baselineを維持 | 新MLモデルへ置換しない。品質評価と尺度決定が残る | 依頼者Baseline、[線形TS原論文](https://proceedings.mlr.press/v28/agrawal13.html)。論文は当プロダクトの有効性を保証しない |
| P-04 CONDITIONAL・Baseline維持 | 録音と再生の分離。ISRC / Playback ID | ISRC＋VERIFIED Mapping、YouTube候補を維持 | Video IDをRecording IDとみなさない。実Catalog/規約確認が公開前に必要 | 依頼者Baseline、上記YouTube公式情報 |
| P-05 RECOMMENDED・Baseline維持 | 説明の整合と過剰断定回避 | 共通Stateから仮説を生成しTraceから理由を作る | 自由文LLM理由と独立MLモデルはMVP候補から外す。閾値はOPEN | 依頼者Baseline |

## Open Questions

| ID | 人間が決める内容 | 関係する要件 |
| --- | --- | --- |
| O-01 | 5曲の計数、Skip・再生失敗・UNSURE時の進行、候補不足時の操作 | R-04、R-08、R-15 |
| O-02 | percentile母集団・欠損・Context定義・ノイズ分散・Probe候補/Adaptive規則・仮説閾値 | R-02、R-03、R-13 |
| O-03 | ISRC欠損・別録音判定・再推薦禁止範囲・VERIFIED再確認期限 | R-01、R-08、R-09 |
| O-04 | 継続探索、履歴保持、Guest失効/復旧、Rating変更期間、Aspect更新規則 | R-06、R-10、R-14、R-16 |
| O-05 | Target User、製品名、UI協議、MUST/SHOULD/COULDの正式分類、評価合格基準 | 全体 |

## Reconsideration Policy

別案の存在だけではBaselineを再議論しない。欠陥、要件未達、重大な規約/安全/運用リスク、期間超過、同等価値の単純化、説明/テスト/保守性の明確な改善、一次情報による前提変更、PoCの不成立がある場合だけ提案する。

提案は `RECONSIDERATION PROPOSAL: 対象Decision` とし、Current Decision / Proposed Alternative / Why Reconsider / Evidence / Advantages over Current Decision / Disadvantages・New Risks / Impact / Migration Cost / Recommendationを記載する。RecommendationはKEEP CURRENT / CONSIDER ALTERNATIVE / STRONGLY RECOMMEND CHANGE / CURRENT DECISION IS NO-GOのいずれか。**提案→人間Decision→正式反映**の順を守る。

今回、Baselineを変更するだけの証拠は得ていないため、新しい変更Proposalはなし（KEEP CURRENT）。未検証のPlaybackや未決のカウントを成立済みに扱わない。Architectureの条件付き推奨は、既存Product Decisionの置換ではない。
