# FE Decisionの詳細

**Supporting Artifact / Not a Source of Truth**。正式決定は[Product Spec](../product-spec.md)と[Architecture](../architecture.md)。本書は2026-09-25、Issue #36の判断理由・実装支援を記録する。本番実装済みを意味しない。

## D-09

Status / Dateは[正式D-09](../architecture.md#d-09)を正本とする。F25で旧D-02のReact Router推奨からTanStack Router採択へ更新した。以下はその理由を実装者向けに展開する。

現在必要なのは、Seed選択、非同期API、再生、評価、Summaryを行き来するclient操作である。SSR（サーバーで画面HTMLを作ること）、React Server Components、Server Functionsが必要な要件は確認されていない。そのためReact / TypeScript / Viteを土台に、URL状態の型付けと検証をRouterへ集約する。

| Candidates | 今回の判断 | Trade-off / 再検討の条件 |
| --- | --- | --- |
| Vite＋React Router | 有力Alternative。2画面だけなら小さく成立する | 宣言的routingの簡潔さが利点。URL契約の追加定義負担が実際に小さい場合に再比較 |
| Vite＋TanStack Router | 採択。typed navigation / search params / search validation / route contextを保守上の価値とする | route treeと型登録・error境界の理解が必要。型だけでAPI応答や認可は保証されない |
| TanStack Start | Full-stack機能を必要とする要求がないため見送り | Server Functions/SSRが必要になればRouterと別の選択として再評価 |
| Next.js | server機能の追加価値が現在のFlowでは確認されない | SSR/公開コンテンツ/同Frameworkでのserver処理が要件になれば再評価 |

Session IntentやDiscoveries filterは将来URL状態が増える例であり、今回その機能をMUSTへ追加する理由にはしない。build時間と行数は限定PoCの観察であって採択理由の中心ではない。人間の今回の選択と、実運用の工数削減の検証は区別する。

Related Requirements: R-01 / R-07 / R-10 / R-16、E-05。Related Design Intents: [DI-FE-01 / 02](design-intent.md)。Evidence IDs: [EV-FE-01〜03](evidence.md)。


## P-08 Detailed Rationale

正式な状態・判断要約は[正本](../product-spec.md#p-08-f25のscopeとcore-loop)を参照。以下はF25の比較理由・影響を移した補助記録。

- ID / Status / Date: P-08 / DECIDED / 2026-09-25。S25の優先度案（P-07）を更新。
- Context / Requirements: 5曲で探索を終わらせず、見つけた曲を持ち帰れること。R-10、R-16、R-17、R-20。
- Candidates / Evaluation Criteria: Summaryのみで終了、Save/継続を後回し、Guestで一連を提供。発見価値、入力負担、期間、状態整合で比較。
- Decision / Why: Saveと同じStateでの継続をMUST、訂正/質問/Basic HistoryをSHOULD、Account/IntentをCOULDとする。未知曲探索というCoreを最後まで成立させるため。
- Why Not Alternatives: Summaryだけでは発見後の利用が途切れる。Account必須は探索前の負担と認証障害への依存を増やす。
- Trade-offs / Consequences: Guestの保持/削除、保存一覧、継続時の計数・既出管理が必要。Account完成はCoreの前提にしない。
- Known Risks / Reconsider When: 入力負担と発見価値は未検証。実Pilotで継続価値不足・Must未達の期間リスクが確認されたら人間へScope変更を提案。
- Evidence IDs: [EV-ML-00](../ML/evidence.md#ev-ml-00)。人間Decisionの記録であり需要検証ではない。
- Related Requirements / Related Design Intents: R-10 / R-16 / R-17 / R-20、[DI-FE-01](../FE/design-intent.md#di-fe-01)、[DI-ML-03](../ML/design-intent.md#di-ml-03)。

## D-09 Detailed Rationale

正式な状態・判断要約は[正本](../architecture.md#d-09)を参照。以下はF25の比較理由・影響を移した補助記録。

**React / TypeScript / Vite / TanStack Router**

- ID / Status / Date: D-09 / DECIDED / 2026-09-25。旧判断: D-02のReact Router推奨。
- Context: client操作中心でSSR要求はないがURL状態の保守が必要。
- Requirements: R-01 / R-07 / R-10 / R-16 / E-05。
- Candidates: Vite＋React Router、Vite＋TanStack Router、TanStack Start、Next.js。
- Evaluation Criteria: 型付きnavigation/search、validation/context、API境界、実装/保守/配信工程。
- Decision: Vite＋TanStack Routerを採用する。
- Why: 将来の検索条件・探索・nested routeに型と検証の境界を置ける。将来機能そのもののScope採択ではない。
- Why Not Alternatives: React Routerは強い代替。Start/NextのSSR/RSC/Server Functionsを必要とする要件は現在ない。
- Trade-offs: route tree/型登録の学習・debugとrouter固有結合が増える。
- Consequences: Router stateとserver Domain stateを分離し、エラー復旧をroute内で検証する。
- Known Risks / Reconsider When: SSR/公開検索流入が必要、または型定義負担が便益を上回ると具体的に確認した場合。
- Evidence IDs: EV-FE-01 / EV-FE-02 / EV-FE-03（[根拠台帳](../FE/evidence.md)）。
- Related Requirements: R-01 / R-07 / R-10 / R-16 / E-05。Related Design Intents: DI-FE-01 / DI-FE-02（[設計意図](../FE/design-intent.md)）。
