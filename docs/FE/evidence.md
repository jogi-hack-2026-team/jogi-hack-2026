# FE Evidence

**Supporting Artifact / Not a Source of Truth**。正式判断は[Product Spec](../product-spec.md)と[Architecture](../architecture.md)。閲覧・コード確認日: 2026-09-25。論文の知見、公式仕様、過去実験、人間の判断を区別する。

## EV-FE-01

- Accessed Date: 2026-09-25
- Type: LOCAL_POC (historical)
- Source / Author / Date: チームPoC、2026-09-24〜25。[再評価結果](../../experiments/stack-bakeoff/results/reevaluation-verification.json)、[build計測](../../experiments/stack-bakeoff/results/reevaluation-build-metrics.json)。
- Reviewed section / Conditions: [共通E2E](../../experiments/stack-bakeoff/tests/frontend.spec.ts)、[3候補](../../experiments/stack-bakeoff/frontend/)。3 FE×4件＋Vite React Router/Fastify実HTTP統合1件=13成功、2skip。
- Supports: 共通画面・reload復元・破損Guest・render errorのPoC比較。温まったbuild 3回の中央値はReact Router 882.83ms、TanStack 1265.86ms、Next 6479.21ms。
- Does not support / Limitations: 再実行ではない。TanStack/Nextの実API統合はskip。cache保持・逐次実行で、Next出力にはserver/cacheがありsize単純比較不可。実Player、Cookie、Save/継続、本番性能や全面的accessibilityは未証明。
- Applied to: D-09、DI-FE-01〜03。速さを採択理由の中心にしない。

## EV-FE-02

- Accessed Date: 2026-09-25
- Type: SPEC
- Source / Author / Date: TanStack maintainers、Router latest docs（更新日表示なし）。[Search Params](https://tanstack.com/router/latest/docs/framework/react/guide/search-params)、[Router Context](https://tanstack.com/router/latest/docs/framework/react/guide/router-context)。Context7 /tanstack/router。
- Reviewed section / Conditions: validateSearch、型付きnavigation、route context。PoC main.tsxのsearch validationも確認。
- Supports: URL入力をruntime検証し、その結果の型をnavigationへ共有する設計手段。依存注入とDomain Stateの所有権は別。
- Does not support / Limitations: 型が自動的に認可・保存整合性を保証するわけではない。開発工数削減やUX優位は未測定。最終version pinは実装Issueで確認。
- Applied to: D-09、DI-FE-02。

## EV-FE-03

- Accessed Date: 2026-09-25
- Type: ENGINEERING + LOCAL_POC
- Source / Author / Date: Issue #36の人間採択と[旧FE比較](../architecture.md#frontend-bake-off)、[PoC README](../../experiments/stack-bakeoff/README.md)。
- Reviewed section / Conditions: Next App Router、Vite React Router、Vite TanStackを同じ操作sliceで比較。
- Supports: 公開SEO/SSRがCoreでない現在はSPAとAPIの境界を簡単に保つ。今後のURL状態の型契約を重視しTanStackを採る。
- Does not support / Limitations: Nextが遅い/不適切、React Routerに型安全性がないとは言わない。新たにSEO/SSRが要件化すれば再検討。
- Applied to: D-09。
