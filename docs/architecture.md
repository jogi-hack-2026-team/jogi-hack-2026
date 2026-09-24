# ArchitectureとTechnology Stack

正式な実現方式のSingle Source of Truth。[Product Spec](product-spec.md)が保証する振る舞いを定め、本書が実現方法・技術候補・検証・Decision Logを定める。2026-09-24、[Issue #34](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/34)の比較結果。**Vite＋React / HonoをRECOMMENDEDとするが、チーム採択前でありDECIDEDではない。**

## GoalsとConstraints

3人、開発期間2026-09-19〜10-12、Code Freeze 10-12。調査時点から約18日。既存研究を理由なくやり直さず、Baselineを自然に実現できる最小構成を選ぶ。無料優先、外部費用・公開・認証Provider・DB正式採用は人間判断。Product要件をFrameworkの都合で変更しない。

Engineering Requirements: E-01＝3人が説明・debug・分担できる、E-02＝SecretをBrowser/ログへ出さず障害を追跡できる、E-03＝同一契約で再現試験できる、E-04＝低コストでデモまで維持できる。数値性能だけでWinnerを決めない。

## System Contextと責務

以下は候補設計であり、全モジュールが実装済みという図ではない。PoCは合成Catalog・Playback Mock・部分的Preference Stateである。

Browser（React UI）→ Application API → Session / Recommendation / Preference → Persistenceという同期経路を基本とする。Catalog AdapterとPlayback Resolverは外部API障害をDomainへそのまま漏らさず、Verified Catalogと明示的なエラーを返す。YouTube IFrameはBrowserで再生し、Feature取得はReccoBeats候補へ分離する。

| 責務 | 保有する判断・データ / 境界 | 要件 |
| --- | --- | --- |
| Frontend | 選択・表示・Loading/Error・再送。Posteriorの正本を持たない | R-01、R-07、R-10 |
| Application API | 入力検証、Guest所有権、HTTP契約、適切なエラー。推薦ロジックは含めない | R-05、R-11、R-15 |
| Exploration Session | 進行、既出録音、Checkpoint、Probe guardrail | R-04、R-09、R-16 |
| Recommendation | θ sample、選択、判断Trace。Playbackから独立 | R-03、R-12 |
| Candidate Generation | Relevant / Probe poolと不足状態。Verified/重複制約を守る | R-08、R-09、R-15 |
| Preference | Seeds、canonical Rating、Posterior、履歴とEvidenceの整合 | R-01、R-03、R-05、R-06 |
| Hypothesis | 共通Preference Stateから関連仮説を導く。独立MLモデルを持たない案 | R-13、R-14 |
| Track Catalog | Recording Identity、Feature版、欠損、percentile参照集合 | R-01、R-02、R-09 |
| ReccoBeats Adapter | Feature/Metadata入出力、timeout/429/500、schema/利用条件 | R-02、R-15 |
| YouTube Resolver | Recording→Playback候補のMapping。動画を学習特徴にしない | R-08、R-09 |
| Human Verification | Machine Gate＋人の証拠に基づくMapping状態遷移 | R-08 |
| Feedback | 再送/Rating変更/競合をcanonical集合へ適用 | R-05、R-06 |
| Decision Trace | commit対象の判断と説明を同じsnapshotで保持 | R-07、R-12 |
| Authentication / Guest | Sessionの所有者、失効、Account移行 | R-10、R-11 |
| Persistence | Unique/FK/transaction/locking。SQL例外をAPI詳細へ漏らさない | R-05、R-07、R-11 |
| Observability | request相関、障害分類、Trace参照、評価の集計 | R-12、R-15、E-02 |

3人の分担案: UI/Guest操作、API/DB整合性、Catalog/推薦/Evaluation。契約を先に固定し、同じプロセスでも別モジュールで並行作業できる。担当者の習熟度・実作業速度は未計測であり、分担の最終決定はOPEN。

## A-01 Architecture候補

| Candidate | Pros / Cons | Failure Boundary | Transaction Boundary | Deployment Units | Team / Complexity / 3-week Fit |
| --- | --- | --- | --- | --- | --- |
| A: Single Application / Modular Monolith | 一つのAPIにDomainを分割。静的FEも同じoriginで配信でき運用が小さい。全体停止は共有 | 外部Adapter単位でエラーを分類。プロセス障害は全体 | Session/Feedback/Traceを1DB transactionで扱える | app 1＋DB 1 | UI/API/推薦モジュールで分担。最小。RECOMMENDED |
| B: Static Frontend＋別Application API | UIとAPIを独立配信・previewできる。CORS/Cookie/環境差が増える | 配信とAPI障害を分離。API/DB停止で探索不可 | API側の1DBで完結。FEへcommit後だけ返す | static FE＋API＋DB | 共通契約で分担。追加運用を許容する場合のALTERNATIVE |
| C: FE＋API＋独立Recommendation Service | 大きなモデルや別runtime/GPUを必要とする将来には分離しやすい | 推薦RPC・Timeoutが追加される | 推薦結果とInteractionの分散境界を調整する必要 | FE＋API＋推薦＋DB | 現在の8次元計算には必要性なし。今回REJECTED候補 |

PoCは比較を容易にするためB形状（localhostの別port）で接続した。Aの単一配信・reverse proxy・公開デプロイまで実証したものではない。A/Bの推薦・DBモジュールは共通にできるため、採用Hosting次第で配置を決める。将来の拡張性だけを理由にCを採用しない。

## A-02 RecommendationとPreference

Baselineを維持する。Seedを個別に保存し、Feature変換版・Anchor・canonical Rating集合とPosteriorを対応させる。Hypothesisは同じStateを参照する。ReccoBeats生Featureからpercentileを作る処理、ISRC照合、Aspect/Evidence Ledgerの完全なスキーマはOPEN。

PoCは7つの**合成percentile値**の絶対距離＋切片で8次元Contextを作り、prior N(0,I)、観測ノイズ分散1のGaussian線形モデルを使用する。A=I+Σxxᵀ、b=Σrx、平均A⁻¹b、共分散A⁻¹。Cholesky分解でsolveとGaussian sampleを行う。LIKE +1 / NEUTRAL 0 / DISLIKE -1、UNSUREは観測から除く。

候補を最寄りSeedとの距離順に半分へ分け、負評価がある場合に許容されたProbe poolへ切り替えるのは**PoC仮定**。正式なAdaptive規則ではない。未評価の確定表示でもcommit数が進むこともPoCの制限。[Product O-01/O-02](product-spec.md#open-questions)の決定に従い本実装を作る。

[数値コード](../experiments/stack-bakeoff/backend/shared/lints.ts)では、解析解との一致、正負rewardによる順位反転、1000回更新時の有限性を確認した。8次元sample 10,000回は約36.1msだった。これはJavaScriptでこの規模の計算が実行可能という証拠であり、音楽推薦の品質・因果的説明・最適探索率の証明ではない。[線形TS原論文](https://proceedings.mlr.press/v28/agrawal13.html)の理論条件と現実のユーザー評価を同一視しない。

## A-03 Sessionと整合性

RECOMMENDED: canonical Feedbackを一意に保存し、同じSessionの更新を直列化したtransaction内でPosteriorを再計算する。PoCはPostgreSQLのSession行を`FOR UPDATE`し、FeedbackのInteraction PKとrevisionを使う。Recommendationも同じ行をlockし、Preference版・Candidate score・θ・Anchor・ContextをTraceへ保存する。

1. Guest所有権を確認してSessionをlockする。
2. Recommendationの同一Interaction ID retryなら保存済み結果を返す。新規なら候補を選ぶ。
3. InteractionとTraceを同じclientのtransactionで保存し、commit後だけHTTP応答へ返す。
4. Feedbackは同じ値・同じrevision retryを再適用しない。競合revisionは409にする。
5. Rating変更後のcanonical集合を読み直し、Posteriorを更新してcommitする。

[node-postgres](https://node-postgres.com/features/transactions)の同一client要件と[PostgreSQL行lock](https://www.postgresql.org/docs/current/explicit-locking.html)に従う。外部API通信をlock区間へ入れない案とし、PoCもDB transaction中に外部通信しない。Session lockは異なるInteraction間のlost updateも防ぐが、同一Sessionの高頻度入力で待ち時間が増える。履歴が増えた後の再計算上限・retry backoff・deadlock対応は本実装時に計測する。

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

CONDITIONAL: ISRC第一候補のRecording→Provider Mappingを分離し、VERIFIED Catalogのみ推薦の入力にする。確認状態の正本はDB、機械判定結果・人の確認証拠・失効条件を残す。ReccoBeats AdapterとYouTube Resolverは独立モジュールとし、失敗は学習rewardへ変換しない。

PoCは12件の合成Track ID・Feature・画像とPlayback Mockだけを使用した。実ISRC、ReccoBeats、YouTube、Human Review、Mapping失効、候補0件/不足、同一録音の別ID排除は未実装。PoCのTrack ID重複排除をR-09の実録音保証としない。

Timeout/429/500のHTTP変換は両候補で確認した。実Adapterはschema検証、有限のtimeout、上限付きretryとjitter、Retry-After、quota記録が必要。自動retry回数・キャッシュ可否・TTLはサービス条件の確認後に決める。PoCは自動retryを実装していない。Playback providerの障害はUI・Mapping・運用記録へ伝え、DISLIKEを作らない。

YouTubeの[必須機能](https://developers.google.com/youtube/terms/required-minimum-functionality)でReferer、player表示、autoplay等の条件を確認した。これだけで全規約適合・ML利用権・対象地域の再生成功を保証しない。ReccoBeats公式Docs本文は今回の取得経路で読めず、詳細の再確認をOPENとして残す。

## A-05 AuthenticationとGuest

GuestでCore Experience可能というR-10は維持する。RECOMMENDEDな公開構成候補は、推測不能なGuest識別子＋server側State＋Secure/HttpOnly/SameSite Cookie。CSRF、期限、削除、別端末、Cookie拒否時のUXはOPEN。Loginを先に要求する代替は採らない。

PoCはlocalhost限定でUUID tokenを発行し、DBにはSHA-256 hashを保持、BrowserはlocalStorageへ保存する。reload復元・破損JSONからの初期化はE2E、他Guestの拒否はHTTP試験で確認した。保存失敗の表示はコード読み合わせのみ。XSS耐性・Cookie/CSRF・expiry・盗難token対策・公開認証の証明ではなく、**このPoCをそのまま公開しない**。

永続AccountはCOULD候補。候補は外部OIDC Provider、DB提供Auth、AccountなしでMVP。具体Provider採用はOPENで、新しいSecretや有料契約は作っていない。Guest→Account移行では所有権を確認して同一transaction内でStateを引き継ぐ案。既存Accountとの履歴・録音重複・Posterior統合規則は人間決定後に実装する。

## A-06 HypothesisとObservability

Baseline通り、Hypothesis Engineは共通Preference StateとEvidence Ledgerを読み、別のML Preference Modelを作らない案。5状態、因果断定禁止、0件を正常結果とする要求は[Product Spec](product-spec.md#preference-hypothesis)が正本。分類Threshold、Aspectの重み、CONTESTED解消はOPEN。PoCは固定の根拠不足メッセージのみで、Engineを実証していない。

Recommendation RationaleはTraceから生成する案。Observabilityはrequest ID、HTTP status、所要時間、エラー分類、非秘密のTrace参照を構造化する。Cookie/Authorization/token/body/DB接続情報や外部APIキーをログへ出さない。Error Tracking ProviderはOPENで、まず既存実行環境のログを使う候補。PoCでは安全なstatus/timingの測定とDB Traceを残し、Production向けログ基盤は未実装。

Algorithm Evaluationは更新の正当性と推薦品質を分離する。実ユーザー評価、偏り、探索と搾取の比較、Evidence/Hypothesis精度は未検証。単なる低レイテンシをCore Valueの証明にしない。

## Frontend Bake-off

Required Characteristics: React/TypeScript、2画面遷移、非同期検索、Client/Server Stateの分離、Guest復元、Playback失敗表示、4種Feedback、Error Boundary、契約共有、E2E、短い変更確認サイクル。現要件には公開検索流入/SEOやserver-render必須の根拠がないため、SSR/RSC/Server Functionsは利用可能性だけで加点しない。

| 候補 / 調査版 | 候補理由・公式根拠 | 比較結果 / Maintenance・リスク |
| --- | --- | --- |
| Vite 8.3.1＋React 19.3.0＋React Router 7.18.4 | Client中心の探索。[Docs](https://vite.dev/guide/)、[Release](https://github.com/vitejs/vite/releases)、[配信](https://vite.dev/guide/static-deploy) | 最終候補として実装。npm stableを確認。Node 22.15.1で成功。SSRなし、Router/非同期状態は選んで組む必要。Vite release一覧はcreate-viteも含み、latestタグだけで本体版を決めない |
| Next.js 16.3.6 | FE＋server責務を一つにできる代替。[Docs](https://nextjs.org/docs/app/getting-started/installation)、[9/22 release](https://github.com/vercel/next.js/releases/tag/v16.3.6)、[self-host](https://nextjs.org/docs/app/guides/self-hosting) | 最終候補として実装。App Router/client境界/Turbopack/生成設定を理解する必要。今回server機能の追加価値は未実証 |
| TanStack Start 1.168.58（npm latest） | 型付きrouting/検索parameter/server functions。[Docs](https://tanstack.com/start/latest/docs/framework/react/overview)、[Release](https://github.com/TanStack/router/releases)、[Hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting) | 机上比較のみ。公式OverviewはRC表記。npmの1.xをGA保証にしない。必要性のないserver機能と短期の導入評価を増やさず、今回は最終候補外。品質不足や永続No-Goとは結論しない |

同じ[画面/Mock API](../experiments/stack-bakeoff/frontend/shared/)、[契約](../experiments/stack-bakeoff/shared/contract.ts)、[E2E](../experiments/stack-bakeoff/tests/frontend.spec.ts)を共有し、routing/bootstrapだけ候補固有にした。したがって、画面実装力の独立比較やFramework固有loader/server functionsを最大活用した比較ではない。

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

## Backend Bake-off

Required Characteristics: HTTP契約、入力検証、Guest所有権、同時Feedback、1transactionのInteraction/Trace、外部失敗の分類、8次元LinTS、型・統合テスト、Docker local DB、移植可能性。TypeScript自体を目的にせず、同じ数値処理が十分小さいことを確認して言語境界を減らす。

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

1＝要求への適合が弱い、3＝追加設計/未確認がある、5＝このsliceで十分。次の点数は**定性的なレビュー案**であり、実測と同格の客観値ではない。資料・上記観察から付け、未知を高得点で埋めない。総合=Σ(weight×score/5)。PoC未実装候補は未採点とする。

| FE評価軸 | Weight | Vite | Next | 判断理由 |
| --- | --- | --- | --- | --- |
| Product Fit | 20 | 5 | 4 | client中心の現要件にSSR必須の根拠なし |
| 3-week Delivery | 20 | 4 | 4 | 両方slice成立。チーム実装速度は未検証 |
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
| 3-week Delivery | 20 | 4 | 4 | 薄いHTTP層で実装。チーム習熟度はOPEN |
| Transaction / Consistency | 15 | 5 | 5 | 共通SQLで成立。Framework固有の優位ではない |
| Type / Validation | 10 | 3 | 4 | Honoは追加構成、Fastifyはschema機構あり。PoC比較では共通validator |
| External API | 10 | 4 | 4 | 障害分類成功。実backoff未検証 |
| Testability | 10 | 5 | 5 | 同じHTTP試験成功 |
| Deployment | 5 | 5 | 4 | Hono adapter選択肢。今回はNodeのみ検証 |
| Numeric Fit | 5 | 5 | 5 | 共通JSで成立 |
| Maintenance | 5 | 4 | 4 | 直近修正release確認 |
| 合計 | 100 | 85 | 86 | 僅差であり勝敗判定に使わない |

FrontendはVite、Backendは**薄いHTTP境界と配置選択を重視してHonoをRECOMMENDED**とする。Fastifyはschema/log/plugin標準化を優先する場合に選ぶ有力代替で、スコアでは僅かに上回る。採用前にチームが両方のadapterと共通整合性コードを説明できるか確認する。DXや学習コストの点差を過大評価しない。

重みはDeliveryとProduct Fit合計40で短期完成を優先し、BEでは整合性15を追加した。ただし整合性・規約・公開可否は点数で相殺せずゲートとする。Maintenance/Deploymentを高めた場合の選択変化も人間レビュー対象。

No-Go gate: 要件を自然に満たせない、冪等性/原子性が破れる、期間内に説明/実装できない、公開方法が成立しない、費用/規約/保守に重大問題がある場合。今回の最終候補にFramework固有の致命的No-Goは未発見。一方、**実Catalog/Playback、公開Guest security、Provider/Preview未検証のため製品公開Goは出せない**。

## 統合PoC

Vite＋Honoだけを接続し、検索→3Seed→Session作成→推薦commit→表示→LIKE→次曲commit→reload復元をPlaywrightで確認した。CORSは実browser通信で動作し、共通型を使用する。Mock FE各4ケース＋統合1ケース＝9成功。Next×Hono統合の1枠は全組合せを避ける方針で明示skipした。

独立試験では失敗を確認したが、実API障害/DB障害中の全統合画面・応答消失からの再送・モバイル/実スクリーンリーダーは未検証。公開Previewは作成していない。Provider未採用のまま勝手にクラウドリソースを作らず、実施待ちとして記録する。

## Database

| Candidate | Transaction・制約・運用 | Cost / Provider | 状態 |
| --- | --- | --- | --- |
| PostgreSQL | row lock/unique/FKで今回の整合性を検証。schema migration・pool・backup/restoreが必要 | local Dockerは追加契約なし。Hosted Providerは別選定 | **RECOMMENDEDだが正式採用はOPEN**。PoCで使用しただけ |
| SQLite | 一つの永続processで小規模運用する代替。writeの直列化とhost storage設計が必要 | local file。hostの永続volume/複数instance制約を要確認 | ALTERNATIVE。比較PoC未実施 |
| PostgreSQL互換managed | DB機能だけでなくpause/connection pooling/region/backupが選定条件 | Neon / Supabase等。具体planと予算はOPEN | CONDITIONAL。Supabase Auth等を自動採用しない |

本番migration tool、index、Catalog import、Rating履歴、失効・削除、restore実証は未実装。PoC DBは一時データかつlocalhost専用trust認証であり、外部接続先として使用しない。

## Deploymentと費用

| 対象 | 候補 / 判断 | 未決・Failure behavior |
| --- | --- | --- |
| FE | A: APIと同origin配信、B: static hosting | 配信障害とAPI停止をUIで区別。SPA fallback/asset cache/Previewは未検証 |
| Backend | Node process/container host。Hono/FastifyともNodeで比較済み | cold start、HTTP timeout、connection pool上限、health endpoint、app containerはOPEN |
| Database | Neon / Supabase / Render等のPostgreSQL候補 | region、接続、期限、restore、予算承認後に決定 |
| Preview / Staging | 選んだProviderで非本番DB/Secretを分離 | 外部作成なし。今回のローカルE2Eを公開Preview成功とはしない |
| Secrets | 既存Doppler方針を維持。server側だけへ渡す | 未確定のProduction環境変数名や値を追加しない |
| Cost | 無料優先。無料枠を超える前の停止/通知を設計 | 有料契約・支払手段・勝手なplan変更なし。絶対無料と保証しない |

2026-09-24の一次情報: [Render Free](https://render.com/docs/free)の無料PostgreSQLは作成後30日で期限、[Supabase](https://supabase.com/docs/guides/platform/free-project-pausing)のFree projectには低活動7日によるpause、[Vercel Hobby](https://vercel.com/docs/plans/hobby)にはpersonal/non-commercial条件がある。これらを「大会期間だから必ず無料で利用可」と解釈しない。Neonは古いblogのquotaが複数あり、現行[pricing](https://neon.com/pricing)をこの取得経路で読み取れなかったため数値はOPEN。チーム利用可否と最新quotaを公開直前に確認する。

## Background JobsとCache

Redis / Queue / 常駐Worker / Cronは現時点で**NOT ADOPTED**（今回の候補に追加しない判断。恒久禁止ではない）。現要件の同期8次元計算、少量Catalog、手動Mapping確認のために分散基盤を導入する根拠がない。再検証期限や大量importの必要性が具体化した場合、既存process内の明示実行から検討する。Provider規約に沿うCatalog cacheの可否・TTLはOPEN。

## TestingとCI/CD

| 種類 | 今回実施 / 残ること |
| --- | --- |
| Unit / Numeric | 解析解、reward符号による順位変化、1000更新の有限性。安定性の一般証明ではない |
| Algorithm Simulation | syntheticのみ。嗜好分布/尺度/長期regret/quality比較はOPEN |
| Integration | 同じPostgreSQLと実HTTPで両BEの原子性・競合・認可・Validation |
| E2E | 両FEの共通sliceと推奨pair。実YouTube/端末/全面的accessibilityは未検証 |
| External Contract / Mock | timeout/429/500。実API schema/権利/quota/変更追随は未検証 |
| Failure | Trace INSERT失敗、入力不正、Guest破損JSON、render error、Playback Mock失敗 |
| CI/CD | 既存GitHub ActionsのFoundationを維持。文書・設定チェックでありPoC app CIとは別。PoC CIは未追加、cloud deploy/secret/required checksを変更していない |

再実行手順と各PoCの証明範囲は[実験README](../experiments/stack-bakeoff/README.md)へ。これはSupporting Artifact / Not a Source of Truthであり、本書のDecisionの代わりにはしない。

## 要件との双方向整合

| Architecture判断 | Product / Engineering根拠 | 状態・検証限界 |
| --- | --- | --- |
| A-01 modular monolith、FE/API配置 | E-01、E-04、R-07 | 推奨。単一配信と公開hostはOPEN |
| A-02 多prototype/変換版/LinTS | R-01、R-02、R-03 | 合成値のみ。実変換/品質はOPEN |
| A-03 lock/unique/transaction/trace | R-04、R-05、R-06、R-07、R-16 | 部分PoC成功。正式5曲計数/継続探索はOPEN |
| A-04 Catalog/Mapping/Adapter | R-08、R-09、R-15 | Mockだけ。実Recording/PlaybackはOPEN |
| A-05 Guest/認可/Account移行 | R-10、R-11 | Guest部分のみ。公開security・期限・移行はOPEN |
| A-06 共通Hypothesis/観測 | R-12、R-13、R-14、E-02 | Trace一致のみ。Hypothesis/Evidence/ログ運用はOPEN |
| 共通契約/比較test/再実行 | E-03 | 同じsliceで検証。Framework固有強みの全面比較ではない |

ProductのMUST候補R-01〜05、R-07〜13、R-15はすべて実現案またはOPENへ到達する。要件のない推薦別process/Redis/Queueは追加しない。Accountと継続探索は優先度承認前に実装を広げない。

## Architecture Decision Log

| ID / 状態 | Context / Candidates | Decision / Reason | Rejected Alternatives / Consequences | Evidence |
| --- | --- | --- | --- | --- |
| D-01 RECOMMENDED | 3人・約18日、整合性境界。A/B/C | A modular monolithを第一候補、Bは配置代替 | 独立推薦serviceは必要性不足。Aの単一配信検証が残る | A-01、数値/DB PoC |
| D-02 RECOMMENDED | client探索、Vite/Next/Start | Vite＋Reactを推奨 | Nextは有力代替、Startは今回は最終候補外。Routerと非同期状態の設計責任が残る | FE実測/公式Docs |
| D-03 RECOMMENDED | HTTP/整合性、Hono/Fastify/FastAPI | Honoを推奨。Fastifyはschema/log標準化を重視する代替 | FastAPIの別runtime便益は未発見。HonoのValidation/Logging設計が必要 | BE実測/同一試験、Scoring |
| D-04 CONDITIONAL | canonical Feedbackと原子性 | PostgreSQL＋Session lockを推奨候補 | DB正式採用・Provider・migrationは別判断。PoC利用から昇格しない | 競合/rollback試験 |
| D-05 OPEN | Hosting/Auth/Preview/実Playback | 無料条件・実機・契約確認後に人間が決定 | 未承認の外部リソース追加なし。製品公開の成立性は未確定 | 本書の未検証一覧 |

Baseline変更を支持する明確な証拠は得られず、Reconsideration Proposalはなし。提案が必要になった場合は[Productの再検討ルール](product-spec.md#reconsideration-policy)に従う。チーム採択後に本書のDecisionをDECIDEDへ更新し、根拠・日付・制約を残す。
