# ArchitectureとTechnology Stack

正式な実現方式のSingle Source of Truth。[Product Spec](product-spec.md)が振る舞い、本書が責務・採択・制約を定める。2026-09-25の依頼者「Documentation Finalization」（F25、[Issue #36](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/36)）を根拠にD-08〜14へ正式反映した。本番アプリは未実装。D-01〜07と比較表は判断の履歴であり、古い推奨を現行採択と混同しない。

## 現在の採択と読む順番

| 状態 | 対象 | 詳細・残る条件 |
| --- | --- | --- |
| DECIDED | Modular Monolith | D-08。推薦を含むDomainはHTTP層から独立 |
| DECIDED | React / TypeScript / Vite / TanStack Router | D-09、[FE入口](FE/README.md)。製品UIは未実装 |
| DECIDED | Node.js / TypeScript / Fastify | D-10 / D-11、[BE入口](BE/README.md)。API schema・log実装は残る |
| DECIDED | PostgreSQL Engine | D-12。Provider採択とは別 |
| DECIDED | Gaussian LinTS、Production TypeScript、Guest Core | D-13、[ML入口](ML/README.md)、A-05。数値校正と公開securityは未検証 |
| RECOMMENDED / CONDITIONAL | Neon、Cloud Run | D-14。相互遅延、cold wake-up、schema容量、pool/transaction、費用、regionと実Deployがゲート |
| OPEN | Account Auth | Neon Managed Better Auth / Firebase Authentication。Core完成後に判断可 |

Product → 本書A-01〜07 → 対象領域README → decision-log → design-intent → implementation-guide → evidenceの順で読む。領域文書はSupporting Artifact / Not a Source of Truthで、独立の採択権限を持たない。PoCコードは設計例と検証対象であり、そのまま本番契約にはしない。

## GoalsとConstraints

3人、開発期間2026-09-19〜10-12、Code Freeze 10-12。調査時点から約18日。既存研究を理由なくやり直さず、Baselineを自然に実現できる最小構成を選ぶ。無料優先、外部費用・公開・認証Provider・DB Provider最終採用は人間判断。Product要件をFrameworkの都合で変更しない。

Engineering Requirements: E-01＝3人が説明・debug・分担できる、E-02＝SecretをBrowser/ログへ出さず障害を追跡できる、E-03＝同一契約で再現試験できる、E-04＝低コストでデモまで維持できる、E-05＝1〜2年以上の継続開発で推薦方式・運用を段階的に変更できる、E-06＝負荷・履歴・Catalog増大時に整合性と費用を管理できる。数値性能だけでWinnerを決めない。**チーム習熟度は未確認であり、経験を採点・除外・推奨理由に使わない。** 学習・debug負担は必要な概念、契約生成、障害境界、観測手段から評価する。

## System Contextと責務

以下は採択した責務分割であり、全モジュールが実装済みという図ではない。PoCは合成Catalog・Playback Mock・部分的Preference Stateである。

Browser（React UI）→ Application API → Session / Recommendation / Preference → Persistenceという同期経路を基本とする。Catalog AdapterとPlayback Resolverは外部API障害をDomainへそのまま漏らさず、Verified Catalogと明示的なエラーを返す。YouTube IFrameはBrowserで再生し、Feature取得はReccoBeats候補へ分離する。

| 責務 | 保有する判断・データ / 境界 | 要件 |
| --- | --- | --- |
| Frontend | 選択・表示・Loading/Error・再送。Posteriorの正本を持たない | R-01、R-07、R-10 |
| Application API | 入力検証、Guest所有権、HTTP契約、適切なエラー。推薦ロジックは含めない | R-05、R-11、R-15 |
| Exploration Session | 進行、既出録音、Checkpoint、Probe guardrail | R-04、R-09、R-16 |
| Recommendation | θ sample、選択、判断Trace。Playbackから独立 | R-03、R-12 |
| Candidate Generation | Relevant / Probe poolと不足状態。Verified/重複制約を守る | R-08、R-09、R-15 |
| Preference | Seeds、canonical Rating、Posterior、履歴とEvidenceの整合 | R-01、R-03、R-05、R-06 |
| Hypothesis | 共通Preference Stateから関連仮説を導く。独立MLモデルを持たない | R-13、R-14 |
| Track Catalog | Recording Identity、Feature版、欠損、percentile参照集合 | R-01、R-02、R-09 |
| ReccoBeats Adapter | Feature/Metadata入出力、timeout/429/500、schema/利用条件 | R-02、R-15 |
| YouTube Resolver | Recording→Playback候補のMapping。動画を学習特徴にしない | R-08、R-09 |
| Human Verification | Machine Gate＋人の証拠に基づくMapping状態遷移 | R-08 |
| Feedback | 再送/Rating変更/競合をcanonical集合へ適用 | R-05、R-06 |
| Decision Trace | commit対象の判断と説明を同じsnapshotで保持 | R-07、R-12 |
| Authentication / Guest | Sessionの所有者、失効、Account移行 | R-10、R-11 |
| Persistence | Unique/FK/transaction/locking。SQL例外をAPI詳細へ漏らさない | R-05、R-07、R-11 |
| Observability | request相関、障害分類、Trace参照、評価の集計 | R-12、R-15、R-19、E-02 |

3人の分担案: UI/Guest操作、API/DB整合性、Catalog/推薦/Evaluation。契約を先に固定し、同じプロセスでも別モジュールで並行作業できる。Team Parallelismはこの責務・共有契約・migrationの衝突範囲で評価し、個人の経験を使わない。担当の最終決定はOPEN。

## A-01 Architecture候補

F25 / D-08でAのModular Monolithを採択。表は比較履歴。最初から推薦serviceを作らず、推薦入力/出力を版付きの境界へ閉じる。静的FEの最終配信方法はDeployment検証で決める。

| Candidate | Pros / Cons | Failure Boundary | Transaction Boundary | Deployment Units | Team / Complexity / 3-week Fit |
| --- | --- | --- | --- | --- | --- |
| A: Single Application / Modular Monolith | 一つのAPIにDomainを分割。静的FEも同じoriginで配信でき運用が小さい。全体停止は共有 | 外部Adapter単位でエラーを分類。プロセス障害は全体 | Session/Feedback/Traceを1DB transactionで扱える | app 1＋DB 1 | UI/API/推薦モジュールで分担。最小。RECOMMENDED |
| B: Static Frontend＋別Application API | UIとAPIを独立配信・previewできる。CORS/Cookie/環境差が増える | 配信とAPI障害を分離。API/DB停止で探索不可 | API側の1DBで完結。FEへcommit後だけ返す | static FE＋API＋DB | 共通契約で分担。追加運用を許容する場合のALTERNATIVE |
| C: FE＋API＋独立Recommendation Service | 大きなモデルや別runtime/GPUを必要とする将来には分離しやすい | 推薦RPC・Timeoutが追加される | 推薦結果とInteractionの分散境界を調整する必要 | FE＋API＋推薦＋DB | 現在の8次元計算には必要性なし。今回REJECTED候補 |

PoCは比較を容易にするためB形状（localhostの別port）で接続した。Aの単一配信・reverse proxy・公開デプロイまで実証したものではない。A/Bの推薦・DBモジュールは共通にできるため、採用Hosting次第で配置を決める。将来の拡張性だけを理由にCを採用しない。

## A-02 RecommendationとPreference

最新Snapshotを反映する。Seedを個別に保存し、Feature変換版・Anchor・canonical Rating集合とPosteriorを対応させる。Hypothesisは同じStateを参照する。正式設計は `φ=[1,-δ1,…,-δ7]/sqrt(8)`、`B=I+Σφφᵀ`、`f=Σφr`、`μ=B⁻¹f`、`Σ=B⁻¹`、観測ノイズ1。Cholesky等の安定したsolveを使う。Feedbackは保存済みContextを参照し、AnchorやContextを作り直さない。Feature Referenceはunique recording＋7特徴有効、Playback VERIFIED不要。Seed / Recommendation Catalogとは別集合とし、変換版を固定する。同順位処理と移行規約、Aspect/Evidence Ledgerの完全なスキーマはOPEN。

保存した旧PoCは7つの**合成percentile値の正の絶対距離＋末尾の切片、正規化なし**であり、上記SnapshotとContext表現が異なる。prior N(0,I)、観測ノイズ1、A=I+Σxxᵀ、b=Σrx、Choleskyのsolve/sample、rewardの扱いを検証した証拠として残す。LIKE +1 / NEUTRAL 0 / DISLIKE -1、UNSUREは観測から除く。**旧PoCを最新モデルの実装済み証拠にしない。** Context/transform/modelの版を保存し、表現変更時は異なる版のPosteriorを混ぜない。移行時の再構築・互換性確認は本実装の作業。

候補を最寄りSeedとの距離順に半分へ分け、負評価がある場合にProbe poolへ切り替えるのは**旧PoC仮定**で、正式なContrastive Probe条件を満たした証明ではない。新設計は対象Feature k以外の近さとkの差を別々に検査する。未評価でもcommit数が進む旧PoCも最新5曲計数と異なる。[Product](product-spec.md#candidate-shortage)のHard条件と計数を本実装で適用し、O-01/O-02は残る詳細だけを扱う。

[数値コード](../experiments/stack-bakeoff/backend/shared/lints.ts)では、解析解との一致、正負rewardによる順位反転、1000回更新時の有限性を確認した。8次元sample 10,000回は約36.1msだった。これはJavaScriptでこの規模の計算が実行可能という証拠であり、音楽推薦の品質・因果的説明・最適探索率の証明ではない。[線形TS原論文](https://proceedings.mlr.press/v28/agrawal13.html)の理論条件と現実のユーザー評価を同一視しない。

## A-03 Sessionと整合性

DECIDEDな整合性要件を満たす設計として、canonical Feedbackを一意に保存し、同じSessionの更新を直列化したtransaction内でPosteriorを再計算する。PoCはPostgreSQLのSession行を`FOR UPDATE`し、FeedbackのInteraction PKとrevisionを使う。Recommendationも同じ行をlockし、Preference版・Candidate score・θ・Anchor・ContextをTraceへ保存する。

1. Guest所有権を確認してSessionをlockする。
2. Recommendationの同一Interaction ID retryなら保存済み結果を返す。新規なら候補を選ぶ。
3. InteractionとTraceを同じclientのtransactionで保存し、commit後だけHTTP応答へ返す。
4. Feedbackは同じ値・同じrevision retryを再適用しない。競合revisionは409にする。
5. Rating変更後のcanonical集合を読み直し、Posteriorを更新してcommitする。

[node-postgres](https://node-postgres.com/features/transactions)の同一client要件と[PostgreSQL行lock](https://www.postgresql.org/docs/current/explicit-locking.html)に従う。外部API通信をlock区間へ入れない設計とし、PoCもDB transaction中に外部通信しない。Session lockは異なるInteraction間のlost updateも防ぐが、同一Sessionの高頻度入力で待ち時間が増える。履歴が増えた後の再計算上限・retry backoff・deadlock対応は本実装時に計測する。

最新設計ではPLAYBACK_STARTEDとaccepted FeedbackをInteraction単位で保存し、両方を満たす有効Interactionを一度だけCheckpointに数える。UNSUREは計数のみ、再送・Rating変更では曲数を増やさない。Playback failure、未再生離脱、FeedbackなしSkipは数えない。イベント順序逆転・遅延failureの扱いはProduct O-01で決め、単なるcommit数へ置き換えない。Probe上限2とHard条件を保ち、不足時の非連続guardrail緩和をTraceに記録する。

Persistent Preference Stateを複数Sessionが共有する場合、**Session行lockだけでは足りない**。更新をPreference所有者/State行で直列化し、Session進行と一貫したlock順にする設計を推奨する。旧PoCの別Session試験は独立Stateであり、同じ長期Stateを跨ぐ試験ではない。版を使う楽観制御に変える場合も競合を検知して再試行し、黙って上書きしない。

PoCのHTTP契約は[コード](../experiments/stack-bakeoff/shared/contract.ts)と[Service](../experiments/stack-bakeoff/backend/shared/service.ts)にある。公開API仕様の採択ではない。

| Endpoint | 意味 / 成功 | 主な失敗 |
| --- | --- | --- |
| GET /tracks | Mock Catalogを200で取得 | timeout 504、upstream 429を503、upstream 500を502 |
| POST /sessions | seedsを検証してGuest ID/tokenを201で返す | 不正件数/重複/IDは400 |
| POST /interactions | sessionId・interactionIdで推薦をcommit | 認可/不正入力/ID競合/SQL失敗 |
| POST /sessions/:id/next | 次曲を選択してcommit。副作用があるためGETにしない | 同上、PoCで5commit超は409 |
| PUT /interactions/:id/feedback | ratingとexpectedRevisionでcanonical更新 | 400、所有権不一致404、revision競合409 |
| GET /sessions/:id/summary | 保存したSeed・Posterior・版を参照 | Guest情報なし401、他Guest404 |

採用予定スキーマの出発点はSession、Interaction、DecisionTrace、CanonicalFeedbackとし、正式なRatingHistory / EvidenceLedger / Catalog / Mapping / Verificationのmigration設計はOPEN。PoCの`CREATE TABLE IF NOT EXISTS`を本番migration機構として採用しない。

## A-04 CatalogとPlayback

Recording→Provider Mappingを分離する。Identity Baselineは `isrc:{normalizedIsrc}`、ISRCなしなら `reccobeats:{trackId}`。同ISRCは同Recording、異なるISRCはMVPで別Recording。正規化の入力検査詳細はOPEN、データ品質限界は残る。YouTube Video IDで置換しない。VERIFIEDかつ現在有効なMappingだけを推薦入力にし、SeedはFeatureが有効ならPlayback不可でも受け付ける。

MappingにはArtist/Track/Version、Official Artist Channel・artist official・Topic・label/distributor等の出典、Audio/MV、embed・region・duration、人のreviewer/verifiedAt、機械検査結果と失効理由を記録する。自動検索成功からVERIFIEDへ昇格しない。ReccoBeats AdapterとYouTube Resolverは独立し、障害はrewardへ変換しない。YouTubeの再生数・高評価・コメント・人気をPreference Featureへ流入させない。

PoCは12件の合成Track ID・Feature・画像とPlayback Mockだけを使用した。実ISRC、ReccoBeats、YouTube、Human Review、Mapping失効、候補0件/不足、同一録音の別ID排除は未実装。PoCのTrack ID重複排除をR-09の実録音保証としない。

Timeout/429/500のHTTP変換は両候補で確認した。実Adapterはschema検証、有限のtimeout、上限付きretryとjitter、Retry-After、quota記録が必要。自動retry回数・キャッシュ可否・TTLはサービス条件の確認後に決める。PoCは自動retryを実装していない。Playback providerの障害はUI・Mapping・運用記録へ伝え、DISLIKEを作らない。

YouTubeの[必須機能](https://developers.google.com/youtube/terms/required-minimum-functionality)でReferer、player表示、autoplay等の条件を確認した。これだけで全規約適合・ML利用権・対象地域の再生成功を保証しない。F25ではContext7経由でReccoBeatsのID/ISRC付きFeature仕様を確認できた。公式Terms（2026-05-25版）・Rate Limitingも確認し、一般利用と推薦結果cacheには裏付けがある。一方、永久Feature Reference・LinTS学習・派生State保持の許諾、Spotify由来metadataの条件はOPENで、[EV-BE-08](BE/evidence.md#ev-be-08)へ区別して記録する。

## A-05 AuthenticationとGuest

GuestでCore Experience可能というR-10は維持する。F25でDECIDEDの基本設計は、推測不能なGuest識別子＋server側State＋Secure/HttpOnly/SameSite Cookie。CSRF、期限、削除、別端末、Cookie拒否時のUXはOPEN。Loginを先に要求する代替は採らない。

PoCはlocalhost限定でUUID tokenを発行し、DBにはSHA-256 hashを保持、BrowserはlocalStorageへ保存する。reload復元・破損JSONからの初期化はE2E、他Guestの拒否はHTTP試験で確認した。保存失敗の表示はコード読み合わせのみ。XSS耐性・Cookie/CSRF・expiry・盗難token対策・公開認証の証明ではなく、**このPoCをそのまま公開しない**。

永続AccountはCOULD候補。主要候補はNeon Managed Better AuthとFirebase Authentication。AccountはCOULDで、Guest Core完成後に最終判断してよい。具体Provider採用はOPENで、新しいSecretや有料契約は作っていない。Guest→Account移行では所有権を確認して同一transaction内でStateを引き継ぐ案。既存Accountとの履歴・録音重複・Posterior統合規則は人間決定後に実装する。

## A-06 HypothesisとObservability

Baseline通り、Hypothesis Engineは共通Preference StateとEvidence Ledgerを読み、別のML Preference Modelを作らない。5状態、因果断定禁止、全Feature未確定も正常という要求は[Product Spec](product-spec.md#preference-hypothesis)が正本。信用区間＋ROPEの分類方式を採用し、平均符号のみでは判断しない。ROPE値・区間水準、Evidenceの解釈、CONTESTED解消はOPEN。AspectをFeature Weightへ直接加算しない。Probe/Model Mismatch時の任意質問、1曲最大1問・初回最大2問・連続回避をSession側で管理する案。PoCは固定の根拠不足メッセージのみで、Engineを実証していない。

Recommendation RationaleはTraceから生成する案。Observabilityはrequest ID、HTTP status、所要時間、エラー分類、非秘密のTrace参照を構造化する。Cookie/Authorization/token/body/DB接続情報や外部APIキーをログへ出さない。Error Tracking ProviderはOPENで、まず既存実行環境のログを使う候補。PoCでは安全なstatus/timingの測定とDB Traceを残し、Production向けログ基盤は未実装。

Algorithm Evaluationは更新の正当性と推薦品質を分離する。実ユーザー評価、偏り、探索と搾取の比較、Evidence/Hypothesis精度は未検証。単なる低レイテンシをCore Valueの証明にしない。

## A-07 SaveとSession Intent

R-17はBookmarkをRatingとは別の所有者・recordingKey・保存日時の集合として扱い、LinTS更新経路から分離する。Save率はProduct評価の候補でありrewardではない。R-18は永続Preference StateをSessionから参照し、一時IntentはSessionの条件としてCandidate Generationへ渡す。IntentをPosteriorへ書かず、長期/Sessionの二重LinTSは作らない。期限・履歴保持・Guest消失/Account移行・既出範囲はOPEN。Save / Continued ExplorationはMUST、Basic History・保存曲一覧の改善はR-20 SHOULD、Session IntentはCOULD / FUTURE。今回本番実装は行わない。

## Desk Screeningと評価方法

> 以下はIssue #34の比較履歴。採択前の推奨・候補・検証結果を保存する。現行Decisionは冒頭とD-08〜14を参照。今回の文書作業で過去試験を再実行した意味ではない。

2026-09-25 JSTに公式Docs、npm dist-tag、GitHub releaseと活動を確認した。[取得記録とURL](../experiments/stack-bakeoff/results/research-releases.json)を保存。全対象repositoryはarchived=falseだったが、commit頻度・人気・新しさを品質点にしない。releaseのstable/previewを区別し、包括的CVE監査・各クラウド実配置は未実施。以下のREJECT BEFORE POCは今回の要件への便益不足であり、Frameworkの一般的な劣位や恒久禁止ではない。

Stackを選び、その中でFrameworkを比較する。PoCの既存資産やチーム経験はLonglist除外理由にしない。3週間完成性は必要な実装・契約・検証・配置工程で、1〜2年の保守は境界・更新方針・移行経路で評価する。実作業日数を計測した比較ではなく、短期完成の保証ではない。

| 評価軸 | Stage 1での判断 | Stage 2/3・継続開発での判断 |
| --- | --- | --- |
| Product Fit | Guest/小規模LinTS/明示Feedbackを自然に書けるか | Account/履歴/評価・推薦交換で仕様を曲げないか |
| 3-week Delivery | 必須の配信単位・契約生成・migration・テスト工程 | 追加責務を既存境界へ局所的に加えられるか |
| Transaction / Consistency | canonical Feedback/Traceの一括commitは必須ゲート | 共通State lock、版管理、再試行・履歴再構築 |
| Scale | 100並列、pool、履歴の合成試験 | Catalog/Trace増大、外部quota、human reviewを含む |
| Post-Hackathon Evolution | modularな同期処理で開始 | worker/推薦serviceを必要時に分離、全体rewrite回避 |
| Operational Complexity | process/container、Secrets、health、migration、CI、ログ | cold start、pool総数、restore、アラート、運用当番 |
| Cost | 無料枠の期限・停止とデモ再現性 | compute/storage/egress/backup/人的検証の実費 |
| Testability | 数値・HTTP・競合・failure・E2Eの同じ契約 | migration/負荷/実API contract/品質評価を追加 |
| Type / Contract Safety | compile時型とruntime validationを分離 | TS共有またはOpenAPI生成、schema版変更 |
| Maintainability | DomainをHTTP型から切り離す | LTS/破壊変更・ecosystem・依存更新とrefactoring |
| Team Parallelism | UI/API/推薦の3境界、共有fixture | schema/migration変更のレビュー責務を明確化 |
| Learning / Debug Cost | 必要なrouting/hook/DI/型生成等の概念と障害追跡 | RPC/queueを増やす際の再送・運用・観測負担 |

採用ゲートを通った候補で、Stage 1は完成性と整合性、Stage 2/3は契約・保守・運用を重視する。未実測の別言語候補へ架空の性能点を付けず、旧スコアは履歴として残す。

### Backend Stack / Runtime Longlist

| Stack | 適合・短期工程 / 契約とdebug | 運用・Scale・継続性 / Screening |
| --- | --- | --- |
| TypeScript / Node | 現8次元計算とI/O中心処理に適合。FEと型共有可能だがruntime入力/応答検証は別途必要。1言語でもDB整合性設計は省略不可 | CPU処理はevent loopからworker/別processへ出せる。FEとAPIは別deployも可能。**FINALIST**。理由は契約と小さい同期Domainの適合であり既存経験ではない |
| Go | `net/http`とSQLで同じtransactionを表現可能。FEとのOpenAPI生成とGo側数値実装/fixture照合が必要。明示的error/contextで追跡できる | 単一binary/container、複数processとpool制御が可能。CPU/メモリ効率は本sliceで未測定。**ALTERNATIVE**。今回はDB/外部API支配に対する言語変更の便益が未確定、PoC前除外ではなく将来CPU要件時の比較候補 |
| Python | FastAPI/Pydanticの契約、科学計算/MLへの接続が自然。FEは生成型を要する。現8次元に追加MLライブラリは不要 | ASGI worker/DB接続数とCPUタスクを分離する設計。**ALTERNATIVE**。ML依存が決まった場合に再比較。遅いと実測した意味ではない |
| Ruby | Rails API modeのvalidation/migration/transactionを活用でき、管理・CRUDが増える場合に有利。FE契約の生成/検査と独自推薦モジュールは必要 | Web/Job processのpoolと永続DBを運用。**ALTERNATIVE**。現sliceではRailsの広いapplication機構より推薦・外部契約が中心で、追加便益を確証できない |
| Rust | Axum/Towerと型で境界を表せる。async/ownership/DB error・schema生成・数値比較という実装上の設計点がある | binary、Tokio、blocking workの分離。**REJECT BEFORE POC**。今回要求にmemory安全性/低資源の追加目標がなく、その便益の実証前に別契約pipelineを増やす理由が不足。人の習熟度による除外ではない |
| JVM / Kotlin | KtorまたはSpringのtransaction/型/テストを利用可能。FEとのschema生成、JVM設定・packaging工程が加わる | JVM/container・pool/heap・warm-upを観測。**ALTERNATIVE**（Ktor）。既存の組織基盤や複雑な業務連携要件がないため今回は追加工程に見合う便益が弱い。メモリ/速度の劣位は未測定 |

Nodeのサポート期間は[公式release一覧](https://nodejs.org/en/about/previous-releases)で確認し、公開時は現行LTSの最新patchを検証する。PoCの22.15.1を本番推奨版に固定しない。Goも[release policy](https://go.dev/doc/devel/release)に沿う更新が必要。どのStackも1〜2年同じpatchを保つ計画にはしない。

### Backend Framework Longlist

| Framework / 確認版 | 公式根拠・保守 / 今回の判定 |
| --- | --- |
| Hono 4.13.9 | [Node deployment](https://hono.dev/docs/getting-started/nodejs)、[release](https://github.com/honojs/hono/releases)。Web API型の薄い境界。**FINALIST**。複数runtimeは便益候補だが今回Nodeのみ検証 |
| Fastify 5.12.5 | [schema](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)、[LTS](https://fastify.dev/docs/latest/Reference/LTS/)。**FINALIST**。6 alphaをstableに含めない。LTSは次majorとNodeサポートに依存し、同版2年保証ではない |
| NestJS 12.1.0 | [公式Docs](https://docs.nestjs.com/)、[deployment](https://docs.nestjs.com/deployment)、[release](https://github.com/nestjs/nest/releases)。**REJECT BEFORE POC**。module/DI/decoratorによる統一の便益はあるが、3責務程度の現APIでは追加機構を必要とする要求がない |
| chi 5.3.2 | [公式repository / routing・middleware](https://github.com/go-chi/chi)。net/httpとの組合せが小さく、Go採用なら第一比較候補。**ALTERNATIVE**。validation/contract/loggingは構成する必要 |
| Echo 5.3.1 | [公式repository / v5](https://github.com/labstack/echo)。binding/middleware/error境界を提供、v4系列と区別。**ALTERNATIVE**。Go採用時にchiと共通sliceで比較し、未実施で勝敗を付けない |
| FastAPI 0.141.1 | [deployment concepts](https://fastapi.tiangolo.com/deployment/concepts/)、[release notes](https://fastapi.tiangolo.com/release-notes/)。**ALTERNATIVE**。Pydantic/OpenAPIが利点、worker数とメモリ/DB接続は別設計 |
| Rails API mode 8.1.4 | [API guide](https://guides.rubyonrails.org/api_app.html)、[maintenance](https://guides.rubyonrails.org/maintenance_policy.html)。**ALTERNATIVE**。Active Record等の恩恵とconvention依存を評価、継続更新は必要 |
| Axum 0.8.9 | [公式API Docs](https://docs.rs/axum/latest/axum/)、[release](https://github.com/tokio-rs/axum/releases)。Tokio/Hyper/Towerと構成。**REJECT BEFORE POC**、理由はRuntime表。release間隔だけで保守停止としない |
| Ktor 3.6.0 | [deployment](https://ktor.io/docs/server-deployment.html)、[OpenAPI](https://ktor.io/docs/server-openapi.html)。**ALTERNATIVE**。Kotlinの小さいHTTP層として妥当だが本sliceの追加利点は未実証 |
| Spring Boot 4.1.1 | [公式Docs / stable・preview](https://docs.spring.io/spring-boot/index.html)、[release](https://github.com/spring-projects/spring-boot/releases)。**REJECT BEFORE POC**。成熟した業務統合/DI/運用機構を必要とする要求が現時点でなく、Ktorより広い基盤を先取りしない。4.2 milestoneはstable扱いしない |

Backend PoCは2候補に絞る。Go/Python等をFINALISTに選んだのに未実装のまま優劣を付ける扱いはしない。各StackのSQL transaction可否は設計上の適合で、実証済みなのはNodeの2候補だけ。

## Frontend Bake-off

> 以下はIssue #34の比較履歴。採択前の推奨・候補・検証結果を保存する。現行Decisionは冒頭とD-08〜14を参照。今回の文書作業で過去試験を再実行した意味ではない。

Required Characteristics: React/TypeScript、2画面遷移、非同期検索、Client/Server Stateの分離、Guest復元、Playback失敗表示、4種Feedback、Error Boundary、契約共有、E2E、短い変更確認サイクル。現要件には公開検索流入/SEOやserver-render必須の根拠がないため、SSR/RSC/Server Functionsは利用可能性だけで加点しない。

| 候補 / 調査版 | 候補理由・公式根拠 | 比較結果 / Maintenance・リスク |
| --- | --- | --- |
| Vite 8.3.1＋React 19.3.0＋React Router DOM 7.18.4 | Client中心の探索。[Vite Docs](https://vite.dev/guide/)、[React Router modes](https://reactrouter.com/start/modes)、[配信](https://vite.dev/guide/static-deploy) | **FINALIST**。PoCはreact-router-domのnpm版に固定。repositoryにはv8.4.0 releaseもあり、7.18.4を全Routerの最新版とはしない。Node 22.15.1で成功。SSRなし、非同期状態設計は必要 |
| Vite＋TanStack React Router 1.170.39 | 型付きroute/search validation。[公式Overview](https://tanstack.com/router/latest/docs/framework/react/overview)、[repository](https://github.com/TanStack/router) | **FINALIST**。Startとは別のClient Router。code-based routeで追加PoC。型付きsearch/navigationが利点、route tree/register等の定義を要する |
| Next.js 16.3.6 | FE＋server責務を一つにできる代替。[Docs](https://nextjs.org/docs/app/getting-started/installation)、[9/22 release](https://github.com/vercel/next.js/releases/tag/v16.3.6)、[self-host](https://nextjs.org/docs/app/guides/self-hosting) | **FINALIST**。App Router/client境界/Turbopack/生成設定を要する。今回server機能の追加価値は未実証。16.4 canaryはstable比較に含めない |
| TanStack Start 1.168.58（npm latest） | 型付きrouting/検索parameter/server functions。[Docs](https://tanstack.com/start/latest/docs/framework/react/overview)、[Release](https://github.com/TanStack/router/releases)、[Hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting) | **REJECT BEFORE POC**。公式OverviewのRC表記とnpmの1.xを区別。現要件にserver functions/SSR必須の根拠がなく、Router単体で評価できる利点のためにFull-stack基盤を増やさない。GA状態は採用再検討時に再確認 |

同じ[画面/Mock API](../experiments/stack-bakeoff/frontend/shared/)、[契約](../experiments/stack-bakeoff/shared/contract.ts)、[E2E](../experiments/stack-bakeoff/tests/frontend.spec.ts)を共有し、routing/bootstrapだけ候補固有にした。したがって、画面実装力の独立比較やFramework固有loader/server functionsを最大活用した比較ではない。

以下の表は**2026-09-24 Preliminary Evidence**を保存したもの。現在の3候補比較と採用判断は表の後に記す。

| 実測・観察 | Vite＋React | Next.js |
| --- | --- | --- |
| build 3回、中央値 | 877.08 / 882.72 / 952.43ms、**882.72ms** | 4744.36 / 4389.27 / 4695.45ms、**4695.45ms** |
| 固有code/configファイル / 行（Markdown・生成宣言除外） | 3 / 33 | 6 / 69 |
| 共通source | 3ファイル / 520行（両者に共通） | 同左 |
| 共通E2E | 4/4成功 | 4/4成功 |
| TypeScript | 共通strict検査成功。CSS import宣言を追加 | build内のTS検査成功。tsconfigへの自動追記あり |
| Setup / Boilerplate | HTML、bootstrap、Vite React plugin config | layout、2 routes、Next config、package、tsconfigなど |
| Dev体験 | React pluginでFast Refreshを有効化。2route起動と復元を確認 | App Routerのroute announcerとテストselectorが衝突し、accessible nameで解決 |
| Error / Loading / Retry | 共通React Boundary、loading、検索失敗とretry動線、4値Feedback | 同左。native error.tsx/Server Action errorは未比較 |
| API型 / State | shared TypeScript、fetch、localStorageのClient state。HTTP応答のruntime schemaは未整備 | 同左。server componentへの移動は評価していない |
| Output | dist 約267.5KB（HTML/JS/CSS、圧縮前） | .next 約84.25MB（server/cache等を含む総量）。配信bundleと比較不可 |
| Deployment / Lock-in | static配信、別APIまたは同origin server。History fallbackが必要 | Node server/self-host候補。Framework server機能を使うほどadapter/cache理解が必要 |
| 固有概念の最小数（定義付き目安） | root、plugin、Routerの3 | app routes、layout、client境界、Turbopack、生成型の5 |

条件: Windows 11、Core i7-1360P、16 logical CPU、Node 22.15.1。同じlockfile、warm-up 1回＋逐次3回、cache保持、npm install時間を除外。E2E停止後に再計測。[生データと計測script](../experiments/stack-bakeoff/results/build-metrics.json)を残した。Cold build・HMR保持性・低性能端末・Web Vitals・実Previewは未測定。行数は整形設定に依存し、Winner判定の主根拠にしない。

### 再評価のFrontend結論

3候補に同じ画面/非同期Mock/Guest state/Feedbackを接続した。React Routerは既存2route、TanStackはcode-based route treeと`validateSearch`によるlive mode判定、NextはApp Router。TanStackの共通Error BoundaryをRouter外だけに置くと内部境界が先に捕捉し、期待した復旧UIが出ないケースを観測した。route component内へ配置して同じ復旧テストが通った。これをRouterのNo-Goとはしない。

共通E2Eは**各4件成功**。Client/Server Stateは共有fetch adapterで分離、Guestは共通localStorageのPoC。TanStackのtyped navigation/searchは追加の利点だが、共通Screen側のsearch操作、loader/cache/invalidationの独立比較は未実施。React Routerのdata/framework mode、Next SSR/RSCも未比較。3候補とも本番Cookie/外部Playbackを実証したわけではない。

**Vite＋React RouterをRECOMMENDED**、TanStack Routerを有力ALTERNATIVEとする。現2画面と少数parameterでは簡素なDeclarative routingが要求を満たし、typed route/searchの追加定義が解く複雑さはまだ小さい。検索条件をURLへ多く持つ、route数やnested loaderが増える場合にTanStackを再比較する。NextはSSR/公開ページ/同一Frameworkのserver処理が具体要件になった時に価値を再評価する。SPAのAPI契約とDomainを分離しておけば、いずれも全Domainのrewriteは不要。経験・人気・build時間だけを理由にしない。

| 再計測 / warm-up後3回 | Vite＋React Router | Vite＋TanStack Router | Next |
| --- | --- | --- | --- |
| build中央値 | 882.83ms | 1265.86ms | 6479.21ms |
| 固有code/configのファイル数 / 行数 | 3 / 33 | 3 / 72 | 6 / 69 |
| 出力bytes（network転送量ではない） | 267,500 | 303,350 | 106,962,142（cache/server等を含む） |
| 共通画面E2E | 4成功 | 4成功 | 4成功 |

同一Windows/Node、cache保持、逐次実行で全buildとstrict型検査が成功。再計測は[3候補の結果](../experiments/stack-bakeoff/results/reevaluation-build-metrics.json)、検証範囲は[検証記録](../experiments/stack-bakeoff/results/reevaluation-verification.json)。Nextの出力総量をVite配信bundleへ直接比較しない。Viteの2案はstatic hosting＋history fallback、NextはNode self-host等が候補。実hosting、HMR状態保持、Cold build、実機性能は未検証。Team Fitは共通契約とUI/API責務の分担可能性で評価し、習熟度を採点しない。

## Backend Bake-off

> 以下はIssue #34の比較履歴。採択前の推奨・候補・検証結果を保存する。現行Decisionは冒頭とD-08〜14を参照。今回の文書作業で過去試験を再実行した意味ではない。

Required Characteristics: HTTP契約、入力検証、Guest所有権、同時Feedback、1transactionのInteraction/Trace、外部失敗の分類、8次元LinTS、型・統合テスト、Docker local DB、移植可能性。TypeScript自体を目的にしない。以下は**旧Node-focused sliceの比較Evidence**。広いStack選定は上のLonglist、現在の推奨はProposalを参照する。

| 候補 / 調査版 | 候補理由・公式根拠 | 結果 / リスク |
| --- | --- | --- |
| Hono 4.13.9、Node adapter 2.1.1 | 小さいHTTP境界、Web API形、型共有。[Docs/Node配信](https://hono.dev/docs/getting-started/nodejs)、[9/24 release](https://github.com/honojs/hono/releases/tag/v4.13.9) | 最終候補。Middleware/Context/onError/adapterを把握すれば今回のAPIを表現可能。Validation、safe log、timeout等の組合せは自分で整える |
| Fastify 5.12.5 | Node API、schema validation、logging、plugin分割。[Docs](https://fastify.dev/docs/latest/Guides/Getting-Started/)、[Validation](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)、[9/16 security release](https://github.com/fastify/fastify/releases/tag/v5.12.5)、[Deployment](https://fastify.dev/docs/latest/Guides/Serverless/) | 最終候補。同じ要求を満たした。有力代替。hook/plugin/schema/compiler等の追加概念を使いこなすコスト。組込みschema/ログは今回公平な共通処理のため優位を実測していない |
| FastAPI 0.141.1（PyPI） | Python型/validationと科学計算連携。[Docs](https://fastapi.tiangolo.com/)、[Release](https://fastapi.tiangolo.com/release-notes/)、[PyPI stable](https://pypi.org/pypi/fastapi/json)、[Deployment](https://fastapi.tiangolo.com/deployment/) | 机上比較のみ。Python必須の数値処理が今回見つからず、2runtime/型生成/運用を増やす便益が弱い。最終候補外。性能や保守性が劣ると実測したわけではない |

共通Service/SQL/数値処理を同じNodeで動かし、HonoとFastifyのroute/error/CORS層だけ交換。検証は各候補13ケース、共通数値1ケース、親testを含めNode runner表示は29成功・失敗0。[テスト](../experiments/stack-bakeoff/tests/backend.test.ts)と[結果](../experiments/stack-bakeoff/results/verification.json)参照。

| 確認 | Hono / Fastifyの両候補での結果 |
| --- | --- |
| Idempotency / Concurrent | 同一Feedback16並列で1回適用。異なるRatingは一方409。同一Sessionの別Interactionでも2件分を保持 |
| Rating Revision | LIKE/DISLIKE→NEUTRAL→UNSUREでcanonical再計算、古いretryを拒否 |
| Atomicity | TraceのNOT NULL違反を注入するとInteractionもrollback。応答TraceとDB値一致 |
| Invalid / Authorization | Seed件数/重複/不明ID、不正JSON/評価を拒否。他Guestは404 |
| External API | timeout→504、429→503、500/破損JSON→502。実外部APIは呼んでいない |
| Session guardrail | 初回Relevant、5commit、Probe最大2・非連続、既出fixture除外 |
| CORS | 許可したlocalhost FE originのみ返す。不許可originへ許可ヘッダーを返さない |

| 実測 | Hono | Fastify |
| --- | --- | --- |
| app生成→listen（import後、1回） | 5.31ms | 305.07ms |
| Recommendation＋Trace commit median / p95（30回） | 8.68 / 10.96ms | 7.61 / 9.03ms |
| Feedback再計算 median（30回） | 9.29ms | 8.03ms |

[生データ](../experiments/stack-bakeoff/results/backend-metrics.json): PostgreSQL 18.6、localhost HTTP、warm-up各5session、候補ごと逐次30session、Hono→Fastifyの固定順。network/DB/順序効果を含み、統計的優位・負荷耐性・serverless cold startとは扱わない。今回の速さの差でWinnerを決めない。structured logging、実API backoff、background workflow、ORM/migration、edge runtimeでのDB接続は未実装。DockerはDBのみで、app container buildは未検証。

## ScoringとNo-Go

> 以下はIssue #34の比較履歴。採択前の推奨・候補・検証結果を保存する。現行Decisionは冒頭とD-08〜14を参照。今回の文書作業で過去試験を再実行した意味ではない。

以下の点数は**初回比較の履歴**であり、今回のLonglist再評価の総合採点ではない。習熟度・経験は使用しない。現在はDesk Screeningの12軸、追加試験、Stage 1/2/3の分析で判断し、未計測のStackを同じ数値表へ埋めない。

1＝要求への適合が弱い、3＝追加設計/未確認がある、5＝このsliceで十分。次の点数は**定性的なレビュー案**であり、実測と同格の客観値ではない。資料・上記観察から付け、未知を高得点で埋めない。総合=Σ(weight×score/5)。PoC未実装候補は未採点とする。

| FE評価軸 | Weight | Vite | Next | 判断理由 |
| --- | --- | --- | --- | --- |
| Product Fit | 20 | 5 | 4 | client中心の現要件にSSR必須の根拠なし |
| 3-week Delivery | 20 | 4 | 4 | 両方slice成立。本番までの工程見積りは未検証 |
| DX / Debug | 15 | 4 | 4 | 両方debug可能。Next announcer等の差を観測 |
| Type / Contract | 10 | 4 | 4 | 共通TS。runtime応答検証は未整備 |
| Testability | 10 | 5 | 5 | 共通E2E成功 |
| Deployment Freedom | 10 | 5 | 4 | static出力とserver境界の選択余地 |
| Maintenance | 10 | 4 | 4 | 現行release/Docsを確認。継続保守の保証ではない |
| Performance / Output | 5 | 4 | 3 | build差のみ。配信/端末性能は未検証 |
| 合計 | 100 | 88 | 81 | Viteを推奨。数値差だけで正式決定しない |

| BE評価軸 | Weight | Hono | Fastify | 判断理由 |
| --- | --- | --- | --- | --- |
| Product Fit | 20 | 4 | 4 | 両者同じ要求を満たした |
| 3-week Delivery | 20 | 4 | 4 | 薄いHTTP層で実装。公開security/migration等の工程は残る |
| Transaction / Consistency | 15 | 5 | 5 | 共通SQLで成立。Framework固有の優位ではない |
| Type / Validation | 10 | 3 | 4 | Honoは追加構成、Fastifyはschema機構あり。PoC比較では共通validator |
| External API | 10 | 4 | 4 | 障害分類成功。実backoff未検証 |
| Testability | 10 | 5 | 5 | 同じHTTP試験成功 |
| Deployment | 5 | 5 | 4 | Hono adapter選択肢。今回はNodeのみ検証 |
| Numeric Fit | 5 | 5 | 5 | 共通JSで成立 |
| Maintenance | 5 | 4 | 4 | 直近修正release確認 |
| 合計 | 100 | 85 | 86 | 僅差であり勝敗判定に使わない |

初回は薄いHTTP境界と配置選択を重視してVite / Honoを推奨した。Fastifyはschema/log/plugin標準化を優先する代替で、旧スコアも僅かに高かった。これは採用Decisionになっていない。**現在は継続開発時の契約・運用標準化を重視し、Fastifyへの推奨変更を提案する**。採択条件はschema/loggingの具体設計レビューであり、担当者の経験を理由に候補を変えない。

重みはDeliveryとProduct Fit合計40で短期完成を優先し、BEでは整合性15を追加した。ただし整合性・規約・公開可否は点数で相殺せずゲートとする。Maintenance/Deploymentを高めた場合の選択変化も人間レビュー対象。

No-Go gate: 要件を自然に満たせない、冪等性/原子性が破れる、期間内に説明/実装できない、公開方法が成立しない、費用/規約/保守に重大問題がある場合。今回の最終候補にFramework固有の致命的No-Goは未発見。一方、**実Catalog/Playback、公開Guest security、Provider/Preview未検証のため製品公開Goは出せない**。

## 統合PoC

> 以下はIssue #34の比較履歴。採択前の推奨・候補・検証結果を保存する。現行Decisionは冒頭とD-08〜14を参照。今回の文書作業で過去試験を再実行した意味ではない。

初回はVite＋Honoを接続し、検索→3Seed→Session作成→推薦commit→表示→LIKE→次曲commit→reload復元を確認した（9成功・1skip）。今回の再評価では同じsliceを**Vite＋Fastify**へ接続し、CORSを含む実HTTP/DB統合を確認した。共通画面3候補×4件＋統合1件＝**13成功・2skip**。Next/TanStackとの実API統合は全組合せを避けるため明示skip。旧結果ファイルを上書きせず、再評価結果を別名で保存する。

独立試験では失敗を確認したが、実API障害/DB障害中の全統合画面・応答消失からの再送・モバイル/実スクリーンリーダーは未検証。公開Previewは作成していない。Provider未採用のまま勝手にクラウドリソースを作らず、実施待ちとして記録する。

## ScaleとEvolution

### 追加のSystem-level PoC

[実行script](../experiments/stack-bakeoff/scripts/scale.ts)と[生データ](../experiments/stack-bakeoff/results/scale-metrics.json)を保存。各Frameworkを**2つの実OS process**、各pool上限12で起動し、同じDBへ交互に送った。Windows localhost、PostgreSQL tmpfs、Hono→Fastify固定順、単発burst。poolは2ms間隔で観測。継続負荷・本番network・障害時性能の測定ではない。

| Scenario | Hono | Fastify | 確認した不変条件 |
| --- | --- | --- | --- |
| 同一Feedback 100並列 | 全体441.35ms、p95 393.69ms | 全体306.07ms、p95 288.14ms | 両processを跨いでもEvidence/Preference版の適用は1回 |
| 独立Session 100並列 | 全体161.76ms、p95 146.71ms | 全体137.33ms、p95 122.59ms | 100件保存。独立Preferenceであり共通長期Stateではない |
| Rating変更、履歴100 / 1k / 10k | 15.54 / 17.96 / 51.16ms | 13.24 / 16.23 / 54.86ms | 各1回。canonical再計算のPosterior全体と版・Evidenceが一致 |
| pool観測 | 各12接続、最大待ち38 | 各12接続、最大待ち38 | 全scenarioを通じた最大値。DB lock待ち時間そのものの内訳は未計測 |

履歴は5commit制限を持つ旧controllerを迂回してSQLで合成投入した。最新Snapshotのモデル/継続探索が実装済みになった意味ではない。100要求は100実ユーザーの継続利用ではなく、これを10kユーザー対応やFrameworkの統計的な速さの証明にしない。結果が示すのは、冪等性がprocess内mutexだけに依存せず成立することと、pool/同一State直列化を観測すべきこと。

### Stage別の設計と検証境界

| Stage | 想定（容量保証ではない） | 最初に確認するBottleneck / 対応 |
| --- | --- | --- |
| 1 Hackathon | 3人、約3週間、少量Catalog・少人数 | 実PlaybackとVERIFIED Catalog、Guest security、候補不足が成立性を左右する。単一app＋DB、同期LinTS、有限timeout、整合性とdemo復旧を優先 |
| 2 Early Product | 数千〜数万Tracks、100〜1,000 Users、Account/History/評価 | owner単位lock、履歴rebuild、pool総数、外部quota、Trace保存量を測る。DB index・owner rate limit・候補事前絞込み、明示batch importを先に加える。2process試験は部分Evidence |
| 3 Growth | 100,000+ Tracks、10,000+ Users、batch・高度推薦 | Catalog全走査、履歴/Traceの増大、人のMapping確認が支配し得る。検索前処理・version付きcache・workerを計測に応じて追加。推薦service/queueは必要性が確認された段階。Stage 3の負荷実測は未実施 |

**100k Catalogの机上分析:** 最大5Seed×7特徴を全候補で比較すると1要求あたり約350万の特徴距離計算となる（処理時間の実測ではない）。毎回全CatalogをDB→app転送し全scoreをTraceへ保存する方式も増大する。まず有効Feature/Mapping・未提示Recordingで絞り、version付きpercentile配列とSeed別候補索引を用い、Relevant候補とFeature別Probe候補のunionを上限付きで評価する設計案。Probeは最終的にk以外の近さ・kの差を再検査し、性能対策でHard条件を崩さない。Recall/多様性/候補枯渇率との比較が必要であり、具体top-Kや閾値は未決。7特徴のためにVector DBを先取りしない。

**履歴とState:** canonical rebuildは概ね履歴n×次元d²の集計とd³のsolve、DB読出し・lock保持を含む。d=8でもnが伸びる。まずquery/indexと不要な読出しを改善し、rebuild時間・lock待ち・event loop delayを測る。時間超過ならcanonical集合の版付きsnapshotからworkerで再構築し、State版の一致を確認してcommitする方式を比較する。pending中に古いStateを確定済みと見せない設計が必要。Rating差分の場当たり的加算へ変更しない。非同期化でFeedback受付/推薦の意味が変わる場合はProduct Proposalを先に出す。

**Horizontal Scaling / DB:** appを増やしても同じownerの更新は直列化される。`app台数×pool上限＋worker＋管理接続 < DB利用可能接続数`を設計条件とし、provider poolerのtransaction互換も検証する。PoCの2×12は24接続、試験driverは別pool。request timeout・待ち行列上限・owner単位の再送抑制で過負荷を扱う。pool増量だけでhot Stateを解決しない。外部通信はtransaction外へ出し、取得時とcommit時の版・有効性を確認する。

**Trace / Event Growth:** 仮に1万人×20interaction/日×2KB/Traceなら約400MB/日（index・履歴・backup別）。利用頻度も2KBも設計例で実測値ではない。選択Context/Anchor/State版/候補種別/Probe対象/判断規則/guardrail例外は残しつつ、無制限の全候補score複製を避ける。保持期間・削除・集計・partitionの必要性を実データで決め、Explanationを再現できる情報を落とさない。TraceとInteractionの一括commitは維持する。

**外部と人手:** import量はAPI quota、利用権・cache条件、Mapping再確認、人のreview処理量で制限される。10万曲がDBへ入ることと10万曲を検証して再生可能にすることは別。レビュー件数/人時・失効率・地域別失敗率は未計測。bulk importの前に上限付きbatch、重複排除、検査の再開位置を設計する。

### Stackごとの成長経路

共通の最初の候補はDB lock/接続、Catalog、外部API、人手であり、言語のHTTP速度で解消しない。以下は机上分析で、別言語の性能実測ではない。

| Stack | Stage 1 → Stage 2/3 | 追加時のMigration Cost / 全体rewriteが必要になる条件 |
| --- | --- | --- |
| Node / Hono・Fastify | 同期module→pool管理＋複数app。CPU処理はworker/別process、importはjob、必要時Python推薦へ | HTTP adapter交換は小、schema/log標準化は中。DomainにFramework contextや未版管理のJSオブジェクトを永続化すると切離しが大きくなる。正常な境界ならruntime全置換不要 |
| Go / chi・Echo | 同期SQL→複数binary＋bounded goroutine/job。DB pool総数を管理、候補cacheは版付き | TSからの採用変更はHTTP契約生成とDomain/数値移植が必要で中〜大。FE/DBを保持でき、Python RPC追加も可能。goroutine増量ではlock解消しない |
| Python / FastAPI | ASGI API→worker数管理、CPU/MLをprocess/jobへ、importを分離 | schema生成・Python Domain移植は中〜大。ML library選択の変更はmodule内に閉じる。worker追加でメモリ/DB接続が増えるため観測が必要 |
| Ruby / Rails API | API/Active Record→job process、必要時外部推薦。migration/管理機能を活用 | model callbackへ推薦判断を散在させると分離コスト増。service境界とcontractを保てばAPI/Accountを維持して推薦だけ交換可能 |
| Rust / Axum | bounded async API→blocking計算分離、job/別runtime | Domain/型/契約の移植は大きいが、RPC推薦・DBは共有可能。現在の資源制約で採用便益を実証していないため先取りしない |
| JVM / Ktor・Spring | API/container→heap/pool管理、batch/worker、必要時Python RPC | build/配備/型生成・Domain移植は中〜大。Framework persistenceへDomainを密結合させなければ推薦moduleだけ分離できる |

全体rewriteを現在必須とする証拠はない。未版管理の永続Context・UI直結DB・全責務へのFramework型流出を避ける。将来、要求が単一DB整合性では成立しない地域分散や完全offlineなどへ変わった場合はArchitectureを再検討するが、ユーザー数だけを理由にMicroservicesへ置換しない。Migration Costの大小は変更対象からの見積りで、工数実測ではない。

### Recommendation交換とML Evolution

入力を`PreferenceSnapshot + CatalogVersion + CandidateSet + Intent + PolicyVersion`、出力を`Decision + Context + Anchor + TraceData`とする純粋な推薦境界を提案する。Application側だけが所有権・最新State版を検査してInteraction/Traceをcommitする。Domainの数値・候補生成をHTTP ContextやDB ORMから切り離す。

将来Python/別runtimeへ移す時も、版付きschema・timeout・idempotency keyを持つRPCへこの境界を移す。応答中にStateが変われば再選択/再試行し、古いsnapshotで黙って確定しない。workerの結果が直接canonical DBを更新する二重writerを作らない。contract fixture、同入力の数値許容差、failure injectionを移行判定に使う。

Non-stationary Bandit、Collaborative Signal、Audio Embedding、Hybrid RecommenderはFuture候補。時間変化・同意/データ量・特徴利用権・評価改善の根拠が得られた場合に比較する。別Policy版のStateを混ぜず、必要な履歴から再構築する。これらは現在のLinTS変更Decisionではない。推薦境界だけの交換を目指し、将来Pythonを使う可能性だけで今serviceを作らない。

## Database

| Candidate | Transaction・制約・運用 | Cost / Provider | 状態 |
| --- | --- | --- | --- |
| PostgreSQL | row lock/unique/FKで今回の整合性を検証。schema migration・pool・backup/restoreが必要 | local Dockerは追加契約なし。Hosted Providerは別選定 | **DECIDED / D-12**。本番migrationとProvider検証は未実施 |
| SQLite / WAL | 一つの永続processで小規模運用する代替。[公式の適用範囲](https://www.sqlite.org/whentouse.html)に沿ってwrite直列化とhost storageを設計 | local file。永続volume/複数instanceからの共有方式が条件 | ALTERNATIVE。今回の2app・同一State競合と将来のworkerを同じDBへ集約する設計にはPostgreSQLを優先。SQLiteを性能不足と実測した意味ではない |
| MySQL / InnoDB | transaction / row lock / FKで要件を実現できる代替。DB間比較試験は未実施 | managed選択肢あり、費用はProvider依存 | 不採用理由は機能不足でなく、PostgreSQL上の既存整合性Evidenceと追加移植・再検証工程 |
| Distributed SQL | 分散transactionと地域冗長を求める場合に比較。分散障害・retry・費用が追加 | Provider依存 | 現在は地域分散・高可用の具体要件がなく先取りしない |
| PostgreSQL互換managed | DB機能だけでなくpause/connection pooling/region/backupが選定条件 | Neon / Supabase等。具体planと予算はOPEN | CONDITIONAL。Supabase Auth等を自動採用しない |

本番migration tool、index、Catalog import、Rating履歴、失効・削除、restore実証は未実装。PoC DBは一時データかつlocalhost専用trust認証であり、外部接続先として使用しない。

## Deploymentと費用

F25 / D-14: **Cloud RunとNeonが第一候補（RECOMMENDED、最終採択はCONDITIONAL）**。Cloud Runは通常のNode/Fastify serverをcontainerで実行でき、concurrency / instance数をDB接続総数と一緒に管理できる。Cloudflare WorkersはWeb Standards / Honoに強い代替だが、現行Fastify adapterと通常serverの運用を優先する。一般的な性能優位を意味しない。

実Deploy PoCではCloud Run↔Neonのwarm/cold往復遅延、cold wake-up、実Schemaとindex/Trace容量、transaction pool互換、並列負荷・timeout・復旧を測る。regionは結果と費用から決める。Free tier・scale-to-zero・branchingは候補理由であり、無料継続や当Projectの容量適合を保証しない。詳細は[BE Evidence](BE/evidence.md)と[実装順序](BE/implementation-guide.md#全体の実装順序)。

| 対象 | 候補 / 判断 | 未決・Failure behavior |
| --- | --- | --- |
| FE | A: APIと同origin配信、B: static hosting | 配信障害とAPI停止をUIで区別。SPA fallback/asset cache/Previewは未検証 |
| Backend | Node process/container host。Hono/FastifyともNodeで比較済み | cold start、HTTP timeout、connection pool上限、health endpoint、app containerはOPEN |
| Database | Neon / Supabase / Render等のPostgreSQL候補 | region、接続、期限、restore、予算承認後に決定 |
| Preview / Staging | 選んだProviderで非本番DB/Secretを分離 | 外部作成なし。今回のローカルE2Eを公開Preview成功とはしない |
| Secrets | 既存Doppler方針を維持。server側だけへ渡す | 未確定のProduction環境変数名や値を追加しない |
| Cost | 無料優先。無料枠を超える前の停止/通知を設計 | 有料契約・支払手段・勝手なplan変更なし。絶対無料と保証しない |

### Provider比較（Issue #34の2026-09-25 JST確認記録）

以下の価格数値は過去比較時のsnapshotとして保持する。今回の契約・見積の承認ではなく、利用時に公式価格を再確認する。

| Provider / 一次情報 | Stage 1 / 小規模 | Stage 2/3 / 継続運用と条件 |
| --- | --- | --- |
| [Neon pricing](https://neon.com/pricing) | Freeは100 CU-hour/project、0.5GB/project、5GB egress/project、5分無活動でscale-to-zero。DB専用候補、app hostは別。今回pricingを取得できたため旧「数値未読」を更新 | Launchはcompute $0.106/CU-hour、storage $0.35/GB-month、月額最低なしの従量。常時性・復旧履歴・接続/regionをplan単位で検証。Freeのsleepを本番SLOと混同しない |
| [Supabase pricing](https://supabase.com/pricing) | FreeはDB 500MB、egress 5GB、低活動1週間でpause、active project 2。Auth等の同梱は採用理由を別途確認 | Proは$25/月から、DB 8GB、daily backup 7日が表示条件。追加compute・利用量等で総額が変わる。Freeに同じbackupを期待しない。Auth/RLS/Storageを使うほど追加境界の移行が必要 |
| [Render pricing](https://render.com/pricing)、[Free制限](https://render.com/docs/free) | app＋DBの同一provider候補。Free PostgreSQLは30日で期限、Free webには休止条件。デモ後も無料DBが存続すると見積らない | 継続時は有料DB/appとbackup/regionを見積る。サイズ・plan依存のため今回総額を確定しない。container/常駐APIを近接配置できるか実Previewで検証 |
| [Railway pricing](https://railway.com/pricing)、[plans](https://docs.railway.com/pricing/plans) | Free trialは30日/$5 credit、その後Freeは$1/月credit。これは無料で常時API＋DBを賄える保証ではない | Hobbyは$5/月最低（usageに充当）、Proは$20/月最低。team権限・利用量・volume/backupを含む構成を見積る。追加費用を伴うplanを未承認で契約しない |

Neon/SupabaseはDBを先に比較し、Node appの配置費用を別に加える。Render/RailwayはappとDBの配置・運用をまとめる候補。Node APIとDBを近いregionに置き、FEは同origin配信を第一案とする。静的配信を分ける場合はCookie/CORS/Preview契約を検証する。F25でNeon / Cloud Runを第一候補へ更新したが、最終受入・regionは**OPEN**。

現行Termsも確認した: [Neon](https://neon.com/platform-terms)（2026-08-05改定、親契約とplanの従量課金・更新条件を含む）、[Supabase](https://supabase.com/terms)、[Render](https://render.com/terms)、[Railway](https://railway.com/legal/terms)。価格表のFree表示から、チーム契約権限・用途・データ利用の適法性や無期限無料を推定しない。契約主体、選択plan、支払/停止条件、対象データの権利は公開前に人間が確認する。外部サービスの契約・支払情報・リソースは追加していない。

費用は `app compute + DB compute + storage/backup + egress + external API + observability` と、人のMapping確認工数に分ける。Stage 1は無料枠内の上限とsleep/期限、Stage 2は履歴・backup・常時性、Stage 3はbatch/Trace増加・egressを測って予算化する。例としてNeon Launchで平均1 CUを730時間使う仮定ならcomputeだけで$77.38/月、10GB storageは$3.50/月（税・app・他利用料別）。これは利用予測や見積承認ではない。10k usersという人数だけで費用を決めず、requests/active時間/保存量から算出する。

## Background JobsとCache

Redis / Queue / 常駐Worker / Cronは現時点で**NOT ADOPTED**。現要件の同期8次元計算、少量Catalogのために分散基盤を導入する根拠がない。Stage 2のimport/再検証はまず再開可能な明示batch＋DBのjob状態を候補とする。長時間・retry・並列上限が必要になればworkerを別processへ、複数workerの配送/再送管理が複雑になった時にqueueを比較する。job ID/入力版で冪等化し、外部quotaとhuman reviewの処理能力を超えない。

CacheはFeature/Mapping/変換の版と期限・失効をキーにし、provider規約が許す範囲で導入する。最初はprocess内またはDBで足りるか測定し、複数instance間の共有cacheが必要になってからRedis等を比較する。Posteriorや確定Traceの正本をcacheへ移さない。具体TTL・cache権利・worker基盤はOPEN。

## TestingとCI/CD

| 種類 | Issue #34で記録済み / 残ること |
| --- | --- |
| Unit / Numeric | 解析解、reward符号による順位変化、1000更新の有限性。安定性の一般証明ではない |
| Algorithm Simulation | syntheticのみ。嗜好分布/尺度/長期regret/quality比較はOPEN |
| Integration | 同じPostgreSQLと実HTTPで両BEの原子性・競合・認可・Validation |
| E2E | 3 FEの共通sliceとVite/Fastify pair。実YouTube/端末/全面的accessibilityは未検証 |
| Scale | 2 process/100並列/10k履歴の合成試験。持続負荷・100k Catalog lookup・Stage 2/3全体は未実測 |
| External Contract / Mock | timeout/429/500。実API schema/権利/quota/変更追随は未検証 |
| Failure | Trace INSERT失敗、入力不正、Guest破損JSON、render error、Playback Mock失敗 |
| CI/CD | 既存GitHub ActionsのFoundationを維持。文書・設定チェックでありPoC app CIとは別。PoC CIは未追加、cloud deploy/secret/required checksを変更していない |

再実行手順と各PoCの証明範囲は[実験README](../experiments/stack-bakeoff/README.md)へ。これはSupporting Artifact / Not a Source of Truthであり、本書のDecisionの代わりにはしない。

## 要件との双方向整合

| Architecture判断 | Product / Engineering根拠 | 状態・検証限界 |
| --- | --- | --- |
| A-01 modular monolith、FE/API配置 | E-01、E-04、R-07 | 構造はDECIDED。単一配信と公開hostはOPEN |
| A-02 多prototype/変換版/LinTS | R-01、R-02、R-03 | 合成値のみ。実変換/品質はOPEN |
| A-03 lock/unique/transaction/trace | R-04、R-05、R-06、R-07、R-16 | 部分PoC成功。正式5曲のBehaviorは決定済み、実装検証と遅延イベント詳細は残る |
| A-04 Catalog/Mapping/Adapter | R-08、R-09、R-15 | Mockだけ。実Recording/PlaybackはOPEN |
| A-05 Guest/認可/Account移行 | R-10、R-11 | Guest部分のみ。公開security・期限・移行はOPEN |
| A-06 共通Hypothesis/観測 | R-12、R-13、R-14、R-19、E-02 | Trace一致のみ。Hypothesis/Evidence/ログ運用はOPEN |
| A-07 Save/Intentと長期State | R-17、R-18、R-20、R-05、E-05 | Save/継続MUST、履歴SHOULD、Intent COULD。寿命・共通owner競合は未実装 |
| 共通契約/比較test/再実行 | E-03 | 同じsliceで検証。Framework固有強みの全面比較ではない |
| Scale/worker移行/推薦交換 | E-05、E-06、R-03、R-05、R-07、R-15 | 同期moduleが第一案。将来要件のないQueue/Redis/serviceは未導入 |

ProductのMUST R-01〜05、R-07〜13、R-15〜17、R-19は上表とProductのRelated Architectureから責務へ到達する。未実装/Validation待ちは各行で明示。AccountはCOULD、継続探索はMUST。要件のない推薦別process/Redis/Queueは追加しない。

## Architecture Decision Log

D-01〜07はS25までの履歴。F25でD-08〜14へ更新し、旧推奨を消さず参照する。各領域decision-logは下記IDの詳細解説であり別Decisionを作らない。

| ID | 記録日 | 状態・現在の参照先 | 判断要約 |
| --- | --- | --- | --- |
| D-01 | 2026-09-24〜25（#34比較時） | SUPERSEDED → D-08 | Modular Monolith推奨を正式採択へ |
| D-02 | 2026-09-25（S25） | SUPERSEDED → D-09 | React Router推奨からTanStack Router採択へ |
| D-03 | 2026-09-24 | SUPERSEDED → D-06 → D-11 | Hono初期推奨を再評価 |
| D-04 | 2026-09-24〜25（#34比較時） | 一部SUPERSEDED → D-12 / D-14 | PostgreSQL Engine採択、Providerは条件付き |
| D-05 | 2026-09-24〜25（#34比較時） | 一部SUPERSEDED → D-14、AuthはOPEN | Hosting候補を具体化 |
| D-06 | 2026-09-25（S25） | SUPERSEDED → D-10 / D-11 | Node / Fastify提案を採択 |
| D-07 | 2026-09-25（S25） | CONDITIONAL | 負荷を測って段階拡張、先取りの分散基盤は導入しない |

日付は記録期間で、旧Entryに個別採択日がないものへ日時を補っていない。[旧判断の詳細とProposal](BE/decision-log.md#d-0107と採択前proposalの履歴) / [比較作業 #34](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/34)。現行の正式採択は下記D-08〜14。旧IDは再利用しない。

## 既存内容の同期判定と残る人間Decision

| 分類 | 対象 / 扱い |
| --- | --- |
| KEEP | 旧PoC数値・失敗注入・責務境界・A/R ID・未検証事項を保持 |
| UPDATE | SnapshotのContext/計数/Identity/Anchor、Longlist、費用、成長設計、双方向Trace |
| REMOVE | 習熟度を候補除外・採点理由にする扱い、既決Behaviorを未決とする記述。証拠自体は削除しない |
| RECLASSIFY | 旧Vite/Hono推奨とスコアをPreliminaryへ。F25でFastify採択（D-11）。旧Proposalは履歴 |
| RESEARCH NEEDED | 実Catalog/Playback・利用権、最新Baseline実装、共通長期State競合、持続負荷、公開security/Preview/restore |

残る人間Decision / Validationは、Neon・Hosting最終受入とregion/予算、Account Auth、Guest保持/削除・公開security、percentile同順位/版移行・校正、遅延Playback/既出範囲/継続時Probe、Catalog利用権と実Coverage、最終UX/評価閾値・性能/復旧目標。Framework・DB Engine・Save/継続の優先度・max Anchorを再び未定へ戻さない。

## F25の正式Decision

各Entryは2026-09-25の依頼者決定（F25、Issue #36）による。Supporting Docsの詳細は同じIDを参照する。

### D-08

2026-09-25 / **DECIDED** / Modular Monolith。Session / Feedback / Preference / Recommendation / Candidate Generation / Catalog / Playback Mapping / Hypothesis / ObservabilityをModule分割する。

[判断理由・代替案・Evidence](BE/decision-log.md#d-08-detailed-rationale) / [承認・作業記録 #36](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/36)。

### D-09

2026-09-25 / **DECIDED** / React / TypeScript / Vite / TanStack Router。Vite＋TanStack Routerを採用する。

[判断理由・代替案・Evidence](FE/decision-log.md#d-09-detailed-rationale) / [承認・作業記録 #36](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/36)。

### D-10

2026-09-25 / **DECIDED** / Node.js / TypeScript。BackendとProduction推薦をTypeScriptで実装する。

[判断理由・代替案・Evidence](BE/decision-log.md#d-10-detailed-rationale) / [承認・作業記録 #36](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/36)。

### D-11

2026-09-25 / **DECIDED** / Fastify HTTP Adapter。FastifyをHTTP Adapterに採用する。

[判断理由・代替案・Evidence](BE/decision-log.md#d-11-detailed-rationale) / [承認・作業記録 #36](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/36)。

### D-12

2026-09-25 / **DECIDED** / PostgreSQL Engine。PostgreSQLを採用、Providerとmigration toolは別判断。

[判断理由・代替案・Evidence](BE/decision-log.md#d-12-detailed-rationale) / [承認・作業記録 #36](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/36)。

### D-13

2026-09-25 / **DECIDED** / 推薦とGuestの独立したCore境界。Productionは8次元LinTSをTypeScriptで実行。Guestはserver Identity＋Secure/HttpOnly/SameSite Cookie。

[判断理由・代替案・Evidence](ML/decision-log.md#d-13-detailed-rationale) / [承認・作業記録 #36](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/36)。

### D-14

2026-09-25 / **RECOMMENDED / CONDITIONAL** / Cloud RunとNeon。Cloud Run / Neonを第一候補とし、実Deploy PoC後に最終受入とregionを決める。

[判断理由・代替案・Evidence](BE/decision-log.md#d-14-detailed-rationale) / [承認・作業記録 #36](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/36)。
