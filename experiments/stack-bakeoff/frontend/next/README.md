# Next.js candidate

**Supporting Artifact / Not a Source of Truth**。正式な比較・推奨は[Architecture](../../../../docs/architecture.md#frontend-bake-off)。

`experiments/stack-bakeoff`で共通[Setup](../../README.md#setup)後、`npm.cmd run dev:next`で4174へ起動、`npm.cmd run build:next`でbuildする。App Routerの2routeから共通Client componentを呼ぶ。

共通MockでViteと同じE2Eを実施。SSR/RSC/Server Functionsの付加価値、実API pair、公開配信、実Playbackは未検証。Nextが生成するAGENTS.md/CLAUDE.mdはこの実験内の開発手順であり、正式な設計SSOTではない。
