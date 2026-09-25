# 音楽探索プロダクト仕様

正式なProduct仕様のSingle Source of Truth。実現方法の正本は[Architecture](architecture.md)。2026-09-24、[Issue #34](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/34)で初版を整理した。本番アプリは未実装であり、比較PoCの動作をそのまま正式仕様にはしない。

## 状態と根拠

| 状態 | 意味 |
| --- | --- |
| DECIDED | 人間が明示決定した事項。決定者・記録・範囲を残す |
| RECOMMENDED | 採用を推奨する候補。採用済みではない |
| CONDITIONAL | 条件の成立確認または詳細決定が必要な候補 |
| OPEN | 未決。推測で補完しない |

2026-09-25 JSTの依頼者「Product Spec / Architecture 全面同期・再評価」のConversation Decision Snapshot（S25）を現在の人間Baselineとして同期した。S25が定めるBehavior/Current Designは**DECIDED（現行Baseline）**へ戻す。Snapshot自身が「候補」「第一候補」「再評価」とする採択・Priorityはその区分を保つ。DECIDEDは実データ・実ユーザーでのValidation成功を意味しない。過去研究の全資料がRepositoryにないことを理由に、提示されたDecisionを再びOPENへ戻さない。

2026-09-25の依頼者「Documentation Finalization」（F25、[Issue #36](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/36)）がS25の未決部分を更新した。以下のScopeと明示設計をDECIDEDとする。採択と動作確認は別で、本番アプリは未実装。正式決定は本書とArchitecture、詳細な理由・Evidence・実装手順は[FE](FE/README.md) / [BE](BE/README.md) / [ML](ML/README.md)のSupporting Docsに置く。

## Product Overview

- Concept / Core Value（Baseline）: 自分の好みについて仮説を立て、次の曲で確かめながら未知曲を探索する。主目的は音楽探索であり、自己分析の断定ではない。
- Target User（DECIDED / S25）: 新しい曲を探すことが好きなライト〜ミドル層の音楽リスナー。Spotify / YouTube Music等を日常利用し、音楽理論に詳しくなくても「なんか好き」が分かり、その理由は言語化しづらい。自分で探索することも楽しめる層。
- Need Validation（未検証）: 好み理解の価値、評価入力の負担、既存サービスと別に利用する理由はユーザー検証が必要。対象層の決定と需要の確認を区別する。
- Principles（Baseline）: 好みの多面性を保持する、推薦判断と説明を一致させる、障害を好みと誤認しない、根拠不足を正常に扱う、ログイン前にCore Experienceを提供する。
- Product Name、具体UIレイアウト、画面分割、色、操作文言はOPEN。Frontend担当との協議事項であり、PoCの英語2画面を製品UIとして採択しない。

## User Experience

1. Guestが「一番好きな曲」ではなく「自分の好みを表す曲」を最低3曲・最大5曲選ぶ。Artist/GenreのHard Constraintを設けない。極端な類似偏りにだけSoft Guidanceを検討する。Feature取得可能ならSeedは再生できなくてもよい。
2. Seedを個別のPrototypeとして保持する。3曲未満なら探索を開始せず、追加選択を案内する。
3. 初回はRelevant Candidateを推薦する。InteractionとDecision Traceの保存に成功してから確定表示する。
4. 再生可能な未知曲を聴き、LIKE / NEUTRAL / DISLIKE / UNSUREを明示する。保存失敗と再生失敗を区別する。
5. 2曲目以降はEvidenceを使ってAdaptiveに選ぶ。初回Probe最大2は維持し、連続禁止は不足時にTraceへ理由を記録した場合だけ緩和できるUX Guardrailとする。
6. PLAYBACK_STARTEDかつExplicit Feedback acceptedの異なるInteractionが5件でCheckpointにする。4評価すべてを数え、UNSUREは学習しない。Playback failure、開始前離脱、FeedbackなしSkipは数えない。最低再生秒数は固定せず、開始/評価時刻を記録可能にする。学習完了を意味せず、全特徴UNDETERMINED・仮説0件も正常。
7. CheckpointでPreference SummaryとTrace由来の推薦理由を表示し、気に入った発見をSave / Bookmarkできる。
8. 同じPreference Stateを引き継いで探索を続けられる。Saveと継続探索はMUST。次Checkpointの区切り、Probe上限のリセット、終了条件、履歴の保存期間はOPEN。

Guestはserver-side IdentityとSecure / HttpOnly / SameSite Cookieを基本設計とする。期限・削除・別端末復帰はOPEN。LoginをSeed選択・探索・Feedback・Summary・Save・継続探索の前提にせず、Account Auth障害からCoreを独立させる。

## RecommendationとPreference

| Product Behaviorとしての要求 | Current Design / Baseline | 状態・未決点 |
| --- | --- | --- |
| 複数の好みの起点を保つ | 3〜5のMulti-Prototype Seedsを保持。単一平均だけに集約しない | DECIDED / F25。Relevantは最大sample scoreのSeed、Probeは生成時Anchor |
| 異なる尺度の特徴を比較可能にする | Catalog percentileとAnchor距離、下記8次元Context | DECIDED / F25。参照集合は下記。percentile同順位規約・版移行はOPEN |
| 好みに近い探索と仮説を確かめる探索を両立する | Relevant / 特徴k以外を近づけkに差を持つContrastive Probe | DECIDED / S25。距離閾値・Adaptiveの具体式はOPEN |
| 評価を次の推薦へ反映する | Gaussian LinTSを採用、prior N(0,I)、noise scale 1 | 数式はDECIDED / S25のCurrent Design。実推薦品質は未検証 |
| 初回に偏ったProbe体験を避ける | 初回Relevant、Probe最大2、不足時だけ連続禁止緩和 | DECIDED / S25。5曲計数はUser Experience参照 |
| 評価変更後も現在の評価と学習状態を一致させる | canonical Feedback集合からPosterior / Preference Stateを再計算 | BehaviorはDECIDED、優先度SHOULD。変更可能期間はOPEN |
| 仮説と推薦で好みの根拠を共有する | Seeds / Posterior / Rating History / Aspect Feedback / Evidence Ledgerが共通State | DECIDED / S25。独立MLモデルを作らず、AspectはWeightへ直接加算しない |
| 表示説明を実際の判断に対応させる | Decision TraceからRationaleを生成 | DECIDED / S25。MVPでLLM自由生成は採用しない |

基本7特徴はdanceability、energy、valence、tempo、acousticness、speechiness、instrumentalness。loudness、livenessは補助。ReccoBeatsをFeature取得元の候補として維持するが、実曲のcoverage・欠損率は未検証。公式Termsは確認済みだが、永続Feature Reference・LinTS利用等の許諾は[EV-BE-08](BE/evidence.md#保存学習用途の追加確認)のとおりOPEN。YouTube動画・音声をML Featureとして取得・加工しない。

補助2特徴を主要独立Featureへ入れない設計理由: loudnessは音量/マスタリング差を好みへ直結させる危険がありenergyとの重複を検証する必要がある。livenessはライブらしさの補助情報であり、好みそのものとの関係は未検証。少数評価で次元を増やす前に増分価値を検証する。これは設計上の理由であり、当Catalogで相関を実測した結論ではない。

Current Design（S25）: `q_j(c) ∈ [0,1]`、`δ_j(c,s) = |q_j(c) - q_j(s)|`、`φ(c,s) = [1, -δ_1, …, -δ_7] / sqrt(8)`。Candidateを複数Seedに対して評価可能にし、単一平均に潰さない。Relevantは同じθ_sampleで各Seedの`score(c,s)=φ(c,s)^T θ_sample`を計算し、`score(c)=max_s score(c,s)`、`anchor(c)=argmax_s score(c,s)`。Probeは生成時Anchorを固定する。同点規約は実装契約で決め、保存した選択を再現可能にする。

Feature Reference Catalogはunique recordingかつ7特徴が有効な集合で、Playback VERIFIEDは要求しない。empirical percentile（参照集合内の経験的な順位）に変換し、transform versionを固定する。Seed Catalogは選択可能な録音、Recommendation CatalogはVERIFIED Mappingを持つ推薦可能な録音であり、3集合を分ける。Mapping検証の進捗でFeature Spaceを動かさない。

Relevant候補はSeedごとのpercentile空間k-NN（近いk件）のunion / dedupeとempirical relevance guardで作る。Probeは対象以外の近さと対象特徴の差を別々に評価し、Pareto filtering（他の候補が両指標とも優れる候補を除く）を第一案とする。K・guard・contrast・pool閾値はCalibration待ち。

`B_0=I, f_0=0`、評価を受けると`B_t=B_(t-1)+φ_t φ_t^T`、`f_t=f_(t-1)+φ_t r_t`、`μ_t=B_t^-1 f_t`、`Σ_t=B_t^-1`、推薦時`θ_sample ~ N(μ_t,Σ_t)`。逆行列を直接作らず安定したsolveを使ってよい。UNSURE/Skip/Save/Playback failureはこの観測を加えない。尺度・特徴順序・符号を変える場合は別モデル版として扱う。

Anchor Consistency: 推薦に使ったAnchor Seed、Context、Candidate Type、Probe Feature（Relevantでは対象なし）、Preference State Version、Decision情報をTraceへ保存する。Feedback時に別Anchorや最新FeatureからContextを再計算せず、保存したContextを使う。Evidence LedgerはInteraction・録音・特徴版・Rating revision・Aspect訂正を根拠として追跡する。

## Candidate Shortage

DECIDED / S25。Hard Constraintは必須Feature有効、Playback Mapping有効、既出Recording除外、Context生成可能、Probeなら対象特徴以外の近さと対象差の条件成立。Random中心の探索や単なる距離上位曲をProbeと呼ぶ方式へ置換しない。

Track 1でRelevantが0なら開始不可。Track 2〜5は、(1) Relevant＋Probeから選択、(2) ProbeなしならRelevantのみ、(3) Relevantなし・有効ProbeありならProbe可、(4) 必要なら連続禁止だけ理由をTraceへ記録して緩和、(5) Probe最大2到達かつRelevantなしなら`BLOCKED_CATALOG`。両poolが0でも停止する。UNVERIFIED/既出録音/不正Featureで強制的に5曲を埋めない。具体的な停止画面・再Seed操作はOPEN。

## Feedback

| 入力・事象 | Preference Learning | ユーザーに保証すること |
| --- | --- | --- |
| LIKE | reward +1 | 保存後の次回判断へ反映 |
| NEUTRAL | reward 0 | 観測としてPosteriorを更新する。更新なしと混同しない |
| DISLIKE | reward -1 | 明示的な好みの否定として扱う |
| UNSURE | 更新なし | 不確実という履歴は残せるが、0報酬として学習しない |
| Playback Failure | 更新なし | DISLIKEへ変換しない。復旧・代替操作の詳細はOPEN |
| Skip | 更新なし | FeedbackなしSkipはCheckpointへ数えず、負のrewardを推定しない。操作UIはOPEN |
| 同一Interactionのretry | 追加更新なし | 重複送信がPreferenceを二重更新しない |
| Rating Revision | 現在のcanonical集合へ一致させる | 古いRatingを残した二重加算をしない。競合時に黙って古い状態へ戻さない |

1 Interactionにつき1 Current Feedback State。履歴と現在値を分け、retryで二重更新せず、Concurrent updateを黙って上書きしない。Rating変更は許可し、canonical集合から再計算する。場当たり的なweight差分追加はしない。Rating Historyの保存期間・変更可能期間・競合UIはOPEN。PoCのexpectedRevision方式はArchitecture候補。

## SaveとSession Intent

Saveは「後でもう一度聴きたい」BookmarkでRatingとは別概念。LinTS Rewardへ直接加えないことはDECIDED / S25。Product評価signalには使える。機能優先度はMUST（F25）。

Long-term Preferenceと一時的なSession Intentを概念上分離する。Persistent Preference State＋Temporary Session Intentが第一候補（COULD / FUTURE）。IntentはCandidate Generationへ影響できるがPosteriorへ直接書かない。初期からLong-term LinTS＋Session LinTSの2モデルを作らない。永続Account必須とはせずGuestの保存方式と分ける。

## PlaybackとRecording Identity

- Product Requirement: 未知曲の推薦対象は再生可能な録音に限定する。Seedの再生可否と混同しない。
- Current Design: YouTube IFrame Player APIを第一候補とし、YouTubeはPlayback Providerとして扱う。実データでの成立性を確認するまでCONDITIONAL。
- Recording Identity（DECIDED / S25）: ISRCありなら`isrc:{normalizedIsrc}`、なしなら`reccobeats:{trackId}`。同一ISRCは同一Recording、異なるISRCはMVPでは別Recording。Remix/Live/EditもISRCを第一判断基準とする。YouTube Video IDはPlayback MappingでありRecording IDではない。正規化手順・不正形式の処理はOPENだが、欠損fallback自体は未決ではない。ISRCの誤登録・欠損由来の重複を完全には防げないLimitationを残す。
- Mapping状態: UNVERIFIED（未確認）、CANDIDATE（機械判定を通過した候補）、VERIFIED（Machine Gate＋Human Reviewで対応する録音と再生条件を確認）、REJECTED（不適合）。
- VERIFIEDは特定時点でMachine Gate＋Human Reviewを通ったMapping。Artist/Track/Version、Official Artist Channel・Artist official・Topic・Label/Distributor等の出所、Official Audio/MV、Embeddable、Region、Duration、Human reviewer、verifiedAtをEvidenceとして記録する。出所は根拠の種類であり全種類必須という意味ではない。自動検索・公開中・埋め込み可だけで昇格させず、永久保証としない。
- 同じ録音を別動画に置き換えて再推薦しない。禁止範囲をセッション内か継続探索/アカウント全体までとするかはOPEN。
- 再生失敗はMappingの再確認対象とし、学習イベントと分離する。広告・地域制限・削除・年齢制限・autoplay拒否を試験対象にする。
- YouTube Views / Likes / Comments / PopularityをPreference Featureにしない。Preference LearningはReccoBeats Audio FeaturesとUser Explicit Feedbackから行うBaseline。
- 今回、実IFrame再生・実Mapping・30曲等の検証済みCatalogは作成していない。10〜15秒の自動停止仕様を追加しない。実装前に[YouTubeの必須機能](https://developers.google.com/youtube/terms/required-minimum-functionality)と利用規約を確認する。

## Preference Hypothesis

| 状態（S25 Baseline） | 表示の意味 |
| --- | --- |
| SIMILARITY_ASSOCIATED | ある特徴でAnchorに近い曲と好評価が関連している可能性 |
| CONTRAST_ASSOCIATED | ある特徴で異なる曲と好評価が関連している可能性 |
| LOW_RELEVANCE | 現在のEvidenceでは特徴の関係が弱い可能性。嫌いの断定ではない |
| UNDETERMINED | 根拠が不足し、判断できない |
| CONTESTED | 評価や訂正の根拠が競合している |

Posterior（評価後のパラメータ分布）の平均の符号だけでは分類しない。credible interval（モデルの下での信用区間）とROPE（実用上差が小さい領域）を使い、区間が正のROPE外ならSIMILARITY_ASSOCIATED、負のROPE外ならCONTRAST_ASSOCIATED、全体がROPE内ならLOW_RELEVANCE、それ以外はUNDETERMINEDとする。明確に衝突するEvidence sourceはCONTESTEDとして扱う。Probeは因果関係の証明ではない。ROPE幅・90/95%等の区間水準・必要Evidence数・異なるAnchorの集約・CONTESTED解消条件はCalibration / UX検証待ち。全特徴UNDETERMINEDでも正常で、曲の探索は妨げない。

Aspect Feedback（SHOULD）は「ノリが好き」「テンポは重要でない」等をEvidence Ledger、Hypothesis State、Probe対象、Model Limitation検出へ使い、Feature Weightへ直接加算しない。Adaptive Aspect QuestionはContrastive ProbeまたはModel Mismatch時、1曲最大1問・初回5曲最大2回・連続を避ける・任意Skip可能という候補。Question選択基準と初回最大2問程度というUX案はCalibration / UX Test待ち。

## Requirements

PriorityはF25で**DECIDED**。Issue #36自体のScope Mustとは区別する。Verificationの「PoC」は合成Catalog上の限定検証であり、製品のAcceptance完了を意味しない。実装方式を要件本文に固定しない。

| ID | Priority | Requirement / Rationale | Acceptance Criteria | Verification | Related Architecture |
| --- | --- | --- | --- | --- | --- |
| R-01 | MUST | 好きな3〜5録音を選び複数の好みを保持する | 2曲以下・6曲以上・重複録音を拒否。再生不可でもFeature取得可能ならSeedに使える | PoC:件数/ID重複。録音/Featureは実Catalog待ち | [A-02](architecture.md#a-02-recommendationとpreference) |
| R-02 | MUST | 特徴尺度による偏りを避ける | 欠損・変換版・Anchorを追跡し、生の尺度をそのまま線形入力にしない | 合成percentileのみ。実変換はOPEN | [A-02](architecture.md#a-02-recommendationとpreference) |
| R-03 | MUST | 評価を次曲判断へ反映する | 4評価の区別、UNSURE非学習、NEUTRAL観測、有限な更新結果 | PoC:数値/DB/HTTP、実推薦品質は未検証 | [A-02](architecture.md#a-02-recommendationとpreference) |
| R-04 | MUST | 初回5曲を探索の区切りにする | 再生開始＋明示評価受理が5件。UNSUREを数え、再生失敗/未評価Skipを数えない。1曲目Relevant、Probe最大2 | 旧PoCはcommit計数で不適合。新規受入試験が必要 | [A-03](architecture.md#a-03-sessionと整合性) |
| R-05 | MUST | 同じFeedback再送で二重学習しない | 同時再送でもcanonical評価とPosteriorが一意に一致 | PoC:16並列、競合/別Interaction同時更新 | [A-03](architecture.md#a-03-sessionと整合性) |
| R-06 | SHOULD | Ratingを訂正できる | 訂正後にcanonical集合から求めた状態と一致し、古いretryを拒否 | PoC:revision競合/再計算 | [A-03](architecture.md#a-03-sessionと整合性) |
| R-07 | MUST | 保存できた判断だけを確定表示する | Trace保存失敗で半端なInteractionを残さない。retryで同じ結果を返す | PoC:SQL失敗注入・HTTP/画面 | [A-03](architecture.md#a-03-sessionと整合性) |
| R-08 | MUST | 未知曲は再生可能な録音に限定する | Mapping根拠と録音一致を人が確認。再生障害を負評価へ変換しない | Playback Mockのみ。実再生は公開前ゲート | [A-04](architecture.md#a-04-catalogとplayback) |
| R-09 | MUST | 同一録音を再推薦しない | 別動画・別Track IDでも既提示Recordingを排除。範囲O-03を決定する | PoC:合成Track IDのみ。ISRC照合はOPEN | [A-04](architecture.md#a-04-catalogとplayback) |
| R-10 | MUST | Login前にCore Experienceを完了できる | Seed→探索→Feedback→Summary→Save→継続。Auth Provider障害でもGuest Coreは利用可能。reload時の保存失敗を通知 | PoC:E2E、実期限/公開認証は未実装 | [A-05](architecture.md#a-05-authenticationとguest) |
| R-11 | MUST | 他人のPreferenceを閲覧・更新させない | 他Guestの識別情報では404等で拒否し、内部情報を漏らさない | PoC:token所有権。公開時のCookie/CSRFはOPEN | [A-05](architecture.md#a-05-authenticationとguest) |
| R-12 | MUST | 説明と学習が実際の判断と一致する | Anchor/Context/Candidate Type/Probe Feature/Preference版を保存し、学習に保存Contextを使う | PoCは保存Contextを再利用。Probe Feature・完全な説明は未実装 | [A-02](architecture.md#a-02-recommendationとpreference)、[A-06](architecture.md#a-06-hypothesisとobservability) |
| R-13 | MUST | 不足Evidenceを正常結果として扱う | Hypothesis 0件でもSummary表示・探索可能。因果的に断定しない | PoC:固定の不足説明のみ。分類ThresholdはOPEN | [A-06](architecture.md#a-06-hypothesisとobservability) |
| R-14 | SHOULD | 根拠へユーザー訂正を反映できる | 訂正と推定を区別し、矛盾した根拠を追跡 | 未実装、具体質問/分類基準はOPEN | [A-06](architecture.md#a-06-hypothesisとobservability) |
| R-15 | MUST | 外部障害・候補不足でHard Constraintを破らない | Track 1はRelevantなしで開始不可。以降は不足手順に従い、最大2Probe到達かつRelevantなしならBLOCKED_CATALOG。連続禁止の緩和だけTraceへ記録可 | 外部障害Mockのみ。不足制御は未実装 | [A-03](architecture.md#a-03-sessionと整合性)、[A-04](architecture.md#a-04-catalogとplayback) |
| R-16 | MUST | Checkpoint後も好みを引き継いで探索できる | 履歴/既出録音/評価を維持し、継続時のProbe条件を満たす | PoC対象外、O-04決定待ち | [A-03](architecture.md#a-03-sessionと整合性) |
| R-17 | MUST | 保存したい曲をBookmarkできる | SaveをRatingから分離し、Posteriorを変えない | 未実装。優先度はF25 | [A-07](architecture.md#a-07-saveとsession-intent) |
| R-18 | COULD / FUTURE | 一時的な探索意図と長期Preferenceを分離する | Intentは候補生成へ作用しPosteriorへ直書きせず、独立2モデルを初期導入しない | 未実装。具体IntentはOPEN | [A-07](architecture.md#a-07-saveとsession-intent) |
| R-19 | MUST | 障害を追跡し秘密を漏らさない | request/traceの相関、構造化された障害分類、Cookie/token/body等の非記録を確認 | 本番未実装 | [A-06](architecture.md#a-06-hypothesisとobservability) |
| R-20 | SHOULD | 発見や保存曲を振り返れる | Basic HistoryとSaved Songs / Discoveries一覧。所有者を分離 | 本番未実装。詳細履歴はCOULD | [A-07](architecture.md#a-07-saveとsession-intent) |

## Scope

F25で決定。MUSTの受入条件は上のR-IDで追跡する。

| 分類 | 内容 |
| --- | --- |
| MUST | R-01〜05、R-07〜13、R-15〜17、R-19。Multi-Prototype / Relevant / Contrastive Probe / Gaussian LinTS、YouTube PlaybackとVERIFIED Mapping、4値評価、Checkpoint / Summary / Rationale、Guest、Save、継続、冪等性、Trace、外部障害と候補不足、Observability |
| SHOULD | R-06、R-14、R-20。Rating Revision、Adaptive Aspect Question、Hypothesis Correction、Basic History、保存曲・発見の見やすい表示 |
| COULD / FUTURE | R-18、Account、Guest→Account移行、Session Intent、Detailed Preference Profile / History、Seed Editing、Advanced Filters |
| WON'T for MVP | Lyrics analysis、LLM自由生成説明、Deep Learning / Neural Bandit / Deep RL、Collaborative Filtering、Social / Follow、Playlist管理clone、Multiple Playback Provider、Non-stationary Preference Model、不要なMicroservices |


## Failureと境界値

| 条件 | 保証する振る舞い / 未決点 |
| --- | --- |
| Seed不足/6件/同一録音 | 探索開始前に修正を要求。Feature欠損の除外理由・再検索案内の文言はOPEN |
| Feature欠損/NaN/版違い | 不明を0や中央値で黙って埋めない。対象除外/補完の採択はOPEN |
| Playback failure | 負評価・Checkpointへ変換しない。再生開始/失敗/明示評価の別イベントを保持。失敗後の復旧操作はOPEN |
| Candidate shortage/Probe不足 | [不足時手順](#candidate-shortage)に従う。Hard ConstraintとProbe最大2は維持 |
| Duplicate recording | Mappingが異なってもrecordingKeyで排除。ISRC欠損はReccoBeats IDへfallback。データ品質由来の重複はLimitation |
| Feedback retry/応答消失 | 二重反映しない。再送/保存状態を確認する。競合はユーザーへ明示 |
| 5-track count | 再生開始＋受理された4種評価を持つ異なるInteractionを数える。retry/revisionで水増ししない。旧PoCのcommit5件は正式定義を検証していない |
| Hypothesis 0件/CONTESTED | 異常終了にせず、不足/競合を説明。断定文を生成しない |
| Guest保存不可/期限切れ | 保存不可を通知。消失した状態を復元できたと装わない。復帰動作はOPEN |

## Evaluation

| 観点 | 評価方法案 | 現在の証拠・ゲート |
| --- | --- | --- |
| Catalog / Playback成立性 | 必要曲数、Feature coverage、録音一致、VERIFIED件数、地域/端末別再生成功率、失敗原因を記録 | 実曲0件検証。必要な規模・合格率はOPEN。ここを満たさず公開Goにしない |
| Algorithm | 固定乱数のsynthetic preferenceで更新正当性・探索傾向・重複/Probe制約を確認。Nearest Seed、Greedy Bayesian Linear、LinTSを同条件比較。可能ならLinUCBを追加 | PoCは解析解・有限性・guardrailのみ。好み推定の優位性やregret改善を実証していない |
| User | 3〜5曲選択→探索→Summaryの完遂、再生失敗、分かりづらい表現、所要時間を観察 | 5-track Completion、Time to Checkpoint、UNSURE / Save / Continue率、Discovery Hit、入力負担を別々に測る。被験者・合格閾値・UIアンケートはOPEN |
| Core Value | 未知曲発見と「仮説を次曲で確かめられた」経験を別々に評価 | 自己分析の納得度だけを成功指標にしない。実ユーザー評価未実施 |

詳細な4層評価、複数Synthetic Userによる感度分析、5 interaction時点のFalse Certainty、実User Testへの接続は[ML Evaluation](ML/evaluation.md)を参照。Simulationだけで需要・Product成功を証明しない。

## Product Decision Log

正本には結論の索引を置き、詳しい理由は領域別文書、作業経緯はIssue/PRへ分ける。[記録の規則](../CONTRIBUTING.md#decision-logを増やしすぎないためのルール)に従い、通常の修正のたびにDecisionを追加しない。

| ID | 日付 | 状態 | 判断要約・後続判断 |
| --- | --- | --- | --- |
| P-01 | 2026-09-24 | DECIDED | 正式SSOTはProduct / Architectureの2本 |
| P-02 | 2026-09-25（S25） | DECIDED | Target User、未知曲探索、個別Seedを保持 |
| P-03 | 2026-09-25（S25） | DECIDED、P-09 / D-13で詳細化 | 正規化負距離Context、Gaussian LinTS、保存Context更新 |
| P-04 | 2026-09-25（S25） | DECIDED、ProviderはCONDITIONAL | RecordingとPlaybackを分離、Machine＋Human検証 |
| P-05 | 2026-09-25（S25） | DECIDED、P-09で詳細化 | 共通Stateの仮説とTrace由来の説明、因果断定しない |
| P-06 | 2026-09-25（S25） | DECIDED | 再生開始＋明示評価で5曲、Probe最大2と不足時手順 |
| P-07 | 2026-09-25（S25） | BehaviorはDECIDED、旧優先度はSUPERSEDED → P-08 | canonical更新、Save非reward、Intent/Aspectの分離 |

[P-01〜07の理由・代替案](ML/decision-log.md#p-0107の判断理由) / [仕様整理 #34](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/34)。

### P-08 F25のScopeとCore Loop

2026-09-25 / DECIDED。Save・継続をMUST、訂正・質問・Basic HistoryをSHOULD、Account・IntentをCOULDとする。発見後も体験を続けられるため。P-07の優先度案を置換。

[判断理由・代替案・Evidence](FE/decision-log.md#p-08-detailed-rationale) / [承認・作業記録 #36](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/36)。

### P-09 Featureと不確実性の表現

2026-09-25 / DECIDED。Feature ReferenceとPlaybackを分離し、Relevantのmax/argmax Anchorと不確実性＋ROPEを採る。尺度の安定と過剰断定回避のため。P-03 / P-05を詳細化、数値校正はOPEN。

[判断理由・代替案・Evidence](ML/decision-log.md#p-09-detailed-rationale) / [承認・作業記録 #36](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/36)。

## Open Questions

| ID | 人間が決める内容 | 関係する要件 |
| --- | --- | --- |
| O-01 | 再生開始と失敗の順序・遅延イベントの受付、失敗後の復旧/再Seed UI。計数と不足順序は決定済み | R-04、R-08、R-15 |
| O-02 | percentile同順位規約・版移行、Relevant/Probe閾値・Adaptive選択・ROPE/credible threshold。参照集合、max/argmax Anchor、Context式とnoise 1は決定済み | R-02、R-03、R-13 |
| O-03 | ISRC正規化の詳細、不正値の処理、再推薦禁止範囲・VERIFIED再確認期限。recordingKey/fallbackは決定済み | R-01、R-08、R-09 |
| O-04 | 継続探索、履歴保持、Guest失効/復旧、Rating変更期間、Aspect更新規則 | R-06、R-10、R-14、R-16 |
| O-05 | 製品名、最終UX、評価合格基準・Target Userの需要検証。ScopeはF25で決定済み | 全体 |
| O-06 | Saveの保持/削除、Session Intentの選択肢・有効期限・解除、任意Aspect質問の発火基準 | R-14、R-17、R-18 |

## 既存内容の同期判定

| 判定 | 対象・扱い |
| --- | --- |
| KEEP | 2文書SSOT、Core Value、7特徴、Guest、原子性、冪等性、因果断定禁止、評価4軸、過去PoCの証拠 |
| UPDATE | S25に基づくTarget User、Seed制約、recordingKey、Context/Posterior、Anchor固定、計数・不足時手順、Mapping証拠 |
| REMOVE | 決定済みの5曲計数・noise・ISRC欠損fallbackを「未決」とする記述。元の版はGit履歴に保持 |
| RECLASSIFY | 決定済みBaselineと実データValidationを別軸へ。旧PoCのcommit数・正距離Context・距離上位Probeは旧仮定の証拠 |
| RESEARCH NEEDED | 需要、実Catalog/Playback/権利、閾値、具体UI、公開Auth、Stage 2/3運用 |

## Reconsideration Policy

別案の存在だけではBaselineを再議論しない。欠陥、要件未達、重大な規約/安全/運用リスク、期間超過、同等価値の単純化、説明/テスト/保守性の明確な改善、一次情報による前提変更、PoCの不成立がある場合だけ提案する。

提案は `RECONSIDERATION PROPOSAL: 対象Decision` とし、Current Decision / Proposed Alternative / Why Reconsider / Evidence / Advantages over Current Decision / Disadvantages・New Risks / Impact / Migration Cost / Recommendationを記載する。RecommendationはKEEP CURRENT / CONSIDER ALTERNATIVE / STRONGLY RECOMMEND CHANGE / CURRENT DECISION IS NO-GOのいずれか。**提案→人間Decision→正式反映**の順を守る。

Product/Algorithm Baselineを置換するProposalはなし（KEEP CURRENT）。今回の更新は人間Snapshotの正式反映であり、未検証のPlaybackや需要を検証済みに扱わない。採択済みの技術候補再評価は[BEのProposal履歴](BE/decision-log.md#reconsideration-proposal-preliminary-hono推奨)を参照。現行の技術判断はArchitectureを正本とし、Product Decisionとは区別する。
