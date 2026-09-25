# BE Design Intent

**Supporting Artifact / Not a Source of Truth**。正式決定は[Product Spec](../product-spec.md)と[Architecture](../architecture.md)。本書は2026-09-25、Issue #36の判断理由・実装支援を記録する。本番実装済みを意味しない。

以下はレビュー可能な設計理由であり、AIのprivate chain-of-thoughtではない。

## DI-BE-01

**FastifyをHTTP Adapterに留める**

- ID / Title: DI-BE-01 / FastifyをHTTP Adapterに留める
- Context: 複数担当者がHTTP型やvalidation方式を各所へ広げ得る。
- Intent: HTTPを交換しても推薦/業務判断を保持する。
- Design: Route→Application Service→Domain、永続/外部アクセスはRepository/Adapter経由。入力schema/応答serialization、所有権context変換は境界で実施。
- Why: Hono/Fastifyが共通Serviceで動くPoCは分離可能性の証拠。
- Invariants: Preference/Recommendation/Candidate/Catalog/HypothesisはFastify Request/Reply/Contextに依存しない。
- Non-Goals: 先取りしたClean Architecture framework、DI基盤、Microservices。
- Alternatives Considered: Route内の業務処理、Framework Contextを全層へ渡す。
- Trade-offs: DTOとDomain変換、schema/型の一元化が必要。
- Failure / Risk: TS型だけで検証したつもりになる、schemaをユーザー入力から生成する。
- Change Guidance: 契約のschema生成元・Type Providerを選び、Domain単体試験とHTTP契約試験を分ける。
- Related Requirements: R-03 / R-05 / R-11 / R-19 / E-05
- Related Decisions: D-08 / D-10 / D-11
- Evidence: [EV-BE-01](evidence.md#ev-be-01) / [EV-BE-03](evidence.md#ev-be-03) / [EV-BE-04](evidence.md#ev-be-04)
- Code Map: [Fastify app](../../experiments/stack-bakeoff/backend/fastify/app.ts)、[Service](../../experiments/stack-bakeoff/backend/shared/service.ts)。PoCは共通手動validator、logger:false。
- Tests: [backend.test.ts](../../experiments/stack-bakeoff/tests/backend.test.ts)の共通HTTP契約。本番schema/serialization/redaction試験は未整備。

## DI-BE-02

**外部通信とAtomic Commitを分ける**

- ID / Title: DI-BE-02 / 外部通信とAtomic Commitを分ける
- Context: 外部待ち中にDBをlockするとpoolを占有する。一方Traceなしで推薦を出せない。
- Intent: 短いtransactionで一貫した推薦だけ確定する。
- Design: 外部取得/Mapping準備はtransaction外。commit時にowner/State版と候補有効性を再検査し、Interaction＋Traceを同一client transactionへ保存。commit後に応答する。
- Why: 外部可用性をDB lock時間から切り離し、途中失敗で半分の記録を残さない。
- Invariants: Trace保存失敗ならInteractionもrollback。応答消失retryは同一確定結果。
- Non-Goals: 外部APIとDBを分散transactionで結ぶ。
- Alternatives Considered: lock中のYouTube検索、Traceを後から非同期保存。
- Trade-offs: 版競合では再選択/再試行が必要。
- Failure / Risk: 取得後のState/Mapping変化、commit後HTTP切断。
- Change Guidance: 外部処理追加時はlock保持区間とtimeoutを測る。transaction clientを途中で交換しない。
- Related Requirements: R-07 / R-08 / R-12 / R-15
- Related Decisions: D-08 / D-12 / D-14
- Evidence: [EV-BE-01](evidence.md#ev-be-01) / [EV-BE-05](evidence.md#ev-be-05) / [EV-BE-07](evidence.md#ev-be-07)
- Code Map: [database.transaction](../../experiments/stack-bakeoff/backend/shared/database.ts)、[Service.recommend](../../experiments/stack-bakeoff/backend/shared/service.ts)。
- Tests: Trace INSERT失敗注入/commit retryは既存。取得後失効・共有State版変化は未整備。

## DI-BE-03

**canonical Feedbackとownerの直列化**

- ID / Title: DI-BE-03 / canonical Feedbackとownerの直列化
- Context: 同時retryと別Sessionから同じPreferenceへの更新が競合する。
- Intent: 常に一つの現在評価集合とそれに対応するPosteriorを持つ。
- Design: Interactionごとにcurrent評価を一意化、revisionで競合検出。共有Preference owner/Stateをlockし、Session進行と一貫した順で更新。Rating Revisionはcanonical集合から再構築。
- Why: process内mutexやSession行だけでは複数process/共有長期Stateを守れない。
- Invariants: 二重学習・黙った上書きなし。revision/retryはcheckpointを増やさない。
- Non-Goals: 差分weight補正、無期限lock、今のSession専用lockを長期共有へ流用。
- Alternatives Considered: 楽観制御＋retryは将来比較可能。
- Trade-offs: 履歴増大によるrebuild/lock待ち。
- Failure / Risk: hot owner、deadlock、pool枯渇。
- Change Guidance: query/index/transaction時間を測り、変更後は複数Session共通owner・process越し・stale retryを検証。
- Related Requirements: R-04〜07 / R-16
- Related Decisions: D-12 / D-13
- Evidence: [EV-BE-01](evidence.md#ev-be-01) / [EV-BE-02](evidence.md#ev-be-02) / [EV-BE-05](evidence.md#ev-be-05)
- Code Map: [Service.feedback/session](../../experiments/stack-bakeoff/backend/shared/service.ts)、[scale](../../experiments/stack-bakeoff/scripts/scale.ts)。旧PoCは独立Session State。
- Tests: 16/100重複・revision・10k canonical一致は既存。共通ownerを共有する複数Session試験は未整備。

## DI-BE-04

**安全なError boundaryと構造化ログ**

- ID / Title: DI-BE-04 / 安全なError boundaryと構造化ログ
- Context: エラー全文にはtoken/SQL/外部応答が含まれ得る。
- Intent: 原因を追跡でき、ユーザーへ復旧に必要な状態を返す。
- Design: HTTP Adapterで安定error code/statusへ変換。request ID、status、duration、error category、非秘密Trace参照を許可リスト化する。
- Why: ログ量を増やすだけではsecret漏洩と調査困難が増える。
- Invariants: Cookie/Authorization/token/body/DB接続情報を記録しない。障害を負報酬にしない。
- Non-Goals: 外部error全文の返却、全request bodyログ。
- Alternatives Considered: 無構造consoleログ、DomainがHTTP例外を生成する方式。
- Trade-offs: redactionと相関IDの試験が必要。
- Failure / Risk: loggerの既定serializerがURL query/tokenを含む、upstreamの秘密が例外経由で漏れる。
- Change Guidance: Pino設定・HTTP response schema・ログfixtureの秘密非出力を確認。監視Providerは別採択。
- Related Requirements: R-11 / R-15 / R-19 / E-02
- Related Decisions: D-11
- Evidence: [EV-BE-03](evidence.md#ev-be-03) / [EV-BE-01](evidence.md#ev-be-01)
- Code Map: [Fastify error handler](../../experiments/stack-bakeoff/backend/fastify/app.ts)。Production log設定は未実装。
- Tests: PoC timeout/429/500/invalid JSON。redaction、URL query、request相関、観測指標の製品試験は未整備。
