# BE Decisionの詳細

**Supporting Artifact / Not a Source of Truth**。正式決定は[Product Spec](../product-spec.md)と[Architecture](../architecture.md)。本書は2026-09-25、Issue #36の判断理由・実装支援を記録する。本番実装済みを意味しない。

## 正式Decisionへの索引

| ID | 判断の要点 | この判断で導入しないもの |
| --- | --- | --- |
| [D-08](../architecture.md#d-08) | Modular Monolith。HTTP、Application、Domain、Repository/External Adapterを分ける | 推薦Microservice、Queue、Redisの先取り |
| [D-10](../architecture.md#d-10) | Node / TypeScript。I/O中心、FE契約共有、現時点の整合性Evidence | Goを遅い/不適切とする結論 |
| [D-11](../architecture.md#d-11) | Fastifyで入力/応答schema、ログ、plugin境界を標準化 | DomainのRequest/Reply依存、型だけに依存するvalidation |
| [D-12](../architecture.md#d-12) | PostgreSQL Engineでcanonical評価とTraceをtransactionへ収める | Provider・ORM・migration toolの自動採択 |
| [D-14](../architecture.md#d-14) | Cloud Run / Neonを第一候補にする | 契約、resource作成、最終region確定 |

## D-10とD-11を分ける理由

言語とHTTP Frameworkは異なる判断である。Goは単一binary、concurrency、runtime効率、backend独立性が利点。今回はTypeScriptによる契約共有と既存のNode整合性試験を使い、残る3週間程度の期間で本番境界と検証へ集中する判断をした。経験・習熟度を優劣の根拠にしない。

Hono/Fastifyは同じApplication ServiceとPostgreSQLを使うため、transactionや冪等性の成功はFramework固有の優位性ではない。HonoのWeb Standards / multi-runtime / Workers / RPCは有力で、現行Node/Cloud RunではFastifyのJSON Schema、Type Provider、response serialization、Pino、hook/plugin/encapsulation、LTSという統一手段を重視した。工数削減の効果量は未実測。

## D-12とD-14を分ける理由

Engineが決まってもネットワーク、pooler、cold wake-up、実容量、復旧と費用は決まらない。MySQL/InnoDBもtransactionを持ち、SQLite/WALにも小規模単一writerでの利点がある。今回はPostgreSQLで行lock・rollback・複数processを検証済みで、別Engineへ移る追加工程を正当化する要件がない。Distributed SQLの地域分散を先取りしない。

NeonはPostgreSQL互換、scale-to-zero、branchingと初期無料枠の適合見込みから推奨する。Cloud Runは通常のserver container、instance/concurrency制御と将来別言語moduleの分離先を選べる点を評価する。これらの机上適合と公開Goは別。Account AuthはNeon Managed Better Auth / Firebase AuthenticationのOPENで、Guestをその稼働へ依存させない。

Evidence IDs: [EV-BE-01〜09](evidence.md)。Design Intents: [DI-BE-01〜04](design-intent.md)。Requirements、比較軸、Trade-offs、Known Risks、Reconsider Whenは各正式IDを参照する。


## D-08 Detailed Rationale

正式な状態・判断要約は[正本](../architecture.md#d-08)を参照。以下はF25の比較理由・影響を移した補助記録。

**Modular Monolith**

- ID / Status / Date: D-08 / DECIDED / 2026-09-25。旧判断: D-01の推奨。
- Context: 単一DBの整合性と3人の責務分担が必要。
- Requirements: R-05 / R-07 / E-01 / E-04。
- Candidates: 単一Application内Module、FE＋API別配信、独立推薦service。
- Evaluation Criteria: 原子性、障害境界、期間、debug/運用コスト。
- Decision: Session / Feedback / Preference / Recommendation / Candidate Generation / Catalog / Playback Mapping / Hypothesis / ObservabilityをModule分割する。
- Why: 8次元の同期処理と1DB transactionにRPCは不要。
- Why Not Alternatives: 独立推薦serviceはtimeout/分散commit/配備を増やす。静的FEの分離は配置代替として残す。
- Trade-offs: 同一process障害を共有するが配備・追跡は小さい。
- Consequences: HTTP/DB型をDomainへ漏らさず、推薦入力/出力を版管理する。
- Known Risks / Reconsider When: CPU/障害隔離/別runtimeの必要性を実測した場合のみservice化を比較。
- Evidence IDs: EV-BE-01 / EV-BE-02（[根拠台帳](../BE/evidence.md)）。
- Related Requirements: R-05 / R-07 / E-01 / E-04。Related Design Intents: DI-BE-01（[設計意図](../BE/design-intent.md)）。

## D-10 Detailed Rationale

正式な状態・判断要約は[正本](../architecture.md#d-10)を参照。以下はF25の比較理由・影響を移した補助記録。

**Node.js / TypeScript**

- ID / Status / Date: D-10 / DECIDED / 2026-09-25。旧判断: D-06のruntime提案。
- Context: FEとAPI契約を共有しI/O中心のCoreを期間内に検証する。
- Requirements: R-03 / R-05 / R-07 / E-01 / E-06。
- Candidates: Node / TypeScript、Go。広い候補比較は[ArchitectureのLonglist](../architecture.md#desk-screeningと評価方法)。
- Evaluation Criteria: transaction、契約生成、負荷Evidence、配備/移植/検証工程。
- Decision: BackendとProduction推薦をTypeScriptで実装する。
- Why: 同言語の契約共有と100並列/10k履歴の現時点Evidenceを優先する。
- Why Not Alternatives: Goの単一binary・concurrency・効率・backend独立性は有力。現在の目標負荷においてNode Runtime変更を必要とするボトルネックは確認されていない。
- Trade-offs: CPU計算でevent loopを塞ぐ可能性。Goとの同条件性能実測はない。
- Consequences: DB/lock/pool/計算を分けて測り、worker・索引等を先に比較する。
- Known Risks / Reconsider When: 本実装のCPU/Memory/遅延が目標を満たさずruntime変更の便益が実測された場合。
- Evidence IDs: EV-BE-01 / EV-BE-02 / EV-BE-09（[根拠台帳](../BE/evidence.md)）。
- Related Requirements: R-03 / R-05 / R-07 / E-01 / E-06。Related Design Intents: DI-BE-01 / DI-BE-03（[設計意図](../BE/design-intent.md)）。

## D-11 Detailed Rationale

正式な状態・判断要約は[正本](../architecture.md#d-11)を参照。以下はF25の比較理由・影響を移した補助記録。

**Fastify HTTP Adapter**

- ID / Status / Date: D-11 / DECIDED / 2026-09-25。旧判断: D-03のHono初期推奨とD-06のProposal。
- Context: AIと複数担当者によるAPI実装で契約/validation/logの方式を揃える。
- Requirements: R-05 / R-07 / R-11 / R-19 / E-02 / E-05。
- Candidates: Fastify、Hono。
- Evaluation Criteria: schema/serialization/type provider、logging、plugin/hook/encapsulation、LTSとNode運用。
- Decision: FastifyをHTTP Adapterに採用する。
- Why: JSON Schemaに沿った入出力とPino/log、plugin境界を共通の方式として設計できる。
- Why Not Alternatives: Honoの軽量性/Web Standards/multi-runtime/Workers/RPCは有力だが、現在はNode/Cloud Run中心で契約と運用標準化を優先する。
- Trade-offs: schema compiler/hook/pluginの理解が必要。工数削減・性能優位は未実測。
- Consequences: Domain/ApplicationはRequest/Reply/Contextをimportしない。Type Provider製品・schema生成方式は未決。
- Known Risks / Reconsider When: edge/multi-runtimeが必須、LTS/依存更新問題、契約方式の保守負担増が実証された場合。
- Evidence IDs: EV-BE-03 / EV-BE-04 / EV-BE-01（[根拠台帳](../BE/evidence.md)）。
- Related Requirements: R-05 / R-07 / R-11 / R-19 / E-02 / E-05。Related Design Intents: DI-BE-01 / DI-BE-04（[設計意図](../BE/design-intent.md)）。

## D-12 Detailed Rationale

正式な状態・判断要約は[正本](../architecture.md#d-12)を参照。以下はF25の比較理由・影響を移した補助記録。

**PostgreSQL Engine**

- ID / Status / Date: D-12 / DECIDED / 2026-09-25。旧判断: D-04の条件付き推奨。
- Context: canonical評価、State、Interaction/Trace、録音参照を同時更新する。
- Requirements: R-05 / R-06 / R-07 / R-09 / R-11。
- Candidates: PostgreSQL、MySQL/InnoDB、SQLite/WAL、Distributed SQL。
- Evaluation Criteria: transaction/unique/FK/行lock、複数process整合性、移植/運用/検証コスト。
- Decision: PostgreSQLを採用、Providerとmigration toolは別判断。
- Why: 既存transaction/rollback/並列/複数process/pool Evidenceを本実装の出発点にできる。
- Why Not Alternatives: MySQLも要件を満たし得るが移植再検証の追加便益が未実証。SQLiteは単一writer/複数instance永続性の設計が必要。Distributed SQLは現在の地域要件に過大。
- Trade-offs: 行lock/pool待ち、migration/backup運用が必要。
- Consequences: 同一client transaction、owner/State単位lock、unique/FKを設計。PoC schemaを本番migrationにしない。
- Known Risks / Reconsider When: 必要な配置/費用/可用性が成立しない、競合と容量目標に重大な未達がある場合。
- Evidence IDs: EV-BE-01 / EV-BE-02 / EV-BE-05（[根拠台帳](../BE/evidence.md)）。
- Related Requirements: R-05 / R-06 / R-07 / R-09 / R-11。Related Design Intents: DI-BE-02 / DI-BE-03（[設計意図](../BE/design-intent.md)）。

## D-14 Detailed Rationale

正式な状態・判断要約は[正本](../architecture.md#d-14)を参照。以下はF25の比較理由・影響を移した補助記録。

**Cloud RunとNeon**

- ID / Status / Date: D-14 / RECOMMENDED / CONDITIONAL / 2026-09-25。旧判断: D-05のOPENを第一候補へ具体化。
- Context: 通常のNode serverとtransactionを小さな運用で配備する。
- Requirements: E-04 / E-06 / R-05 / R-07 / R-10。
- Candidates: Cloud Run＋Neon、Cloudflare Workers、[ArchitectureのProvider比較表](../architecture.md#deploymentと費用)の候補。
- Evaluation Criteria: container適合、scale-to-zero、pool/region/復旧、実費。
- Decision: Cloud Run / Neonを第一候補とし、実Deploy PoC後に最終受入とregionを決める。
- Why: 通常serverの運用、PostgreSQL互換とbranching、初期無料枠への適合見込み。
- Why Not Alternatives: WorkersはHono/Web Standardsに強いが現行Fastify構成を優先。Neon以外のProviderを性能不足と断定しない。
- Trade-offs: Cloud RunとNeonの両方のcold start、network/接続・費用制御が必要。
- Consequences: warm/cold遅延、実Schema容量、transaction/pool、復旧を測定。Account AuthはNeon Managed Better Auth / FirebaseのOPEN。
- Known Risks / Reconsider When: cold遅延・費用・region・transaction互換のゲート未達。
- Evidence IDs: EV-BE-06 / EV-BE-07（[根拠台帳](../BE/evidence.md)）。
- Related Requirements: E-04 / E-06 / R-05 / R-07 / R-10。Related Design Intents: DI-BE-02 / DI-BE-03（[設計意図](../BE/design-intent.md)）。

## D-01〜07と採択前Proposalの履歴

過去の文面を保存したSupporting Artifact。以下の状態表記は当時のもの。現在の状態・置換先は[正本の索引](../architecture.md#architecture-decision-log)を参照。

| ID / 状態 | Context / Candidates | Decision / Reason | Rejected Alternatives / Consequences | Evidence |
| --- | --- | --- | --- | --- |
| D-01 RECOMMENDED | 3人・約18日、整合性境界。A/B/C | A modular monolithを第一候補、Bは配置代替 | 独立推薦serviceは必要性不足。Aの単一配信検証が残る | A-01、数値/DB PoC |
| D-02 RECOMMENDED（再評価） | client探索、RR/TanStack Router/Next/Start | Vite＋React Routerを推奨、正式採用待ち | TanStack Routerは有力代替。SSR等の必要性がないためStartはPoC前除外 | 3 FE試験、公式Docs、Longlist |
| D-03 PRELIMINARY（履歴） | 初回Node中心のHono/Fastify/FastAPI比較 | 2026-09-24はHono推奨、採用Decisionではない | 削除せず旧Evidenceを保存。現在の提案はD-06 | BE実測/同一試験、旧Scoring |
| D-04 CONDITIONAL | canonical Feedbackと原子性 | PostgreSQL＋Session lockを推奨候補 | DB正式採用・Provider・migrationは別判断。PoC利用から昇格しない | 競合/rollback試験 |
| D-05 OPEN | Hosting/Auth/Preview/実Playback | 無料条件・実機・契約確認後に人間が決定 | 未承認の外部リソース追加なし。製品公開の成立性は未確定 | 本書の未検証一覧 |
| D-06 PROPOSED / RECOMMENDED | 全Stack Longlist、Stage 1〜3・1〜2年の契約/保守 | Node＋Fastifyを現在の推奨候補として提示 | Honoは代替。未測定の他言語を性能/経験で除外しない。採択前にschema/logging設計を確認 | 下記Proposal、公式LTS、追加scale・統合PoC |
| D-07 CONDITIONAL | Growth時のCatalog/State/Trace増大 | modular境界・版管理・接続上限から段階的拡張 | Worker/queue/serviceを最初から導入しない。共通長期Stateはowner lockが必要 | E-05/E-06、ScaleとEvolution |

## RECONSIDERATION PROPOSAL: Preliminary Hono推奨

**履歴: この提案はF25で採択されD-11へ反映済み。以下は採択前の文章を保持する。現行で承認待ちの提案ではない。**

### Current Decision

初回Node-focused比較では薄いHTTP境界と配置選択からHonoを推奨した。チームの正式採用Decisionにはなっていない。

### Proposed Alternative

NodeのFramework第一候補をFastifyへ変更する提案。Product/AlgorithmのBaseline、Modular Monolith、PostgreSQLの整合性境界は維持する。

### Why Reconsider

評価対象が3週間だけでなく1〜2年のAPI契約・保守・運用へ広がった。今回はedge/multi-runtime要件がなく、Honoの配置選択の便益より、Fastifyの入力/応答schema、logger、plugin境界を一つの方針に揃える便益を重視できる。

### Evidence

- [Fastify Validation / Serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)と[LTS policy](https://fastify.dev/docs/latest/Reference/LTS/)。Context7でもschema/type providerの方式を確認。
- 共通HTTP/DB試験、追加2process・100並列・10k履歴試験で、両候補の原子性・冪等性が成立。Vite/Fastifyの実HTTP統合も成功。
- schema/loggingの長期工数削減は設計上の期待であり、今回の共通validator比較で効果量を測定したものではない。小さい速度差を変更理由にしない。

### Advantages over Current Decision

HTTP schemaとresponse serialization、logging、plugin lifecycleの標準化をFramework内で設計できる。API追加時の共通規則と保守方針を明示しやすい。

### Disadvantages / New Risks

schema compiler/hook/pluginの理解と更新が必要。Nodeへの依存が強く、HonoのWeb API形と複数runtime選択を失う。型共有だけでruntime検証が完結するわけではなく、schema/typeの二重管理を避ける設計が必要。

### Impact

Backend HTTP adapter、入力/応答contract、safe logging、関連testと運用に影響する。Product、Reward、DB transaction、FrontendのCore Flowを変更する提案ではない。

### Migration Cost

本番appは未実装。PoCは既存Fastify adapterで動作し統合pairの変更は小さい。本実装でschema生成/validationとredaction・request IDを整える工程は別途必要で、工数短縮は未実測。旧Hono PoCは比較Evidenceとして保持する。

### Recommendation

**CONSIDER ALTERNATIVE**。現在の推奨候補はFastifyだが、人間採択後にのみ正式Architecture DecisionをDECIDEDにする。Product Baselineを変える新Proposalは今回ない。
