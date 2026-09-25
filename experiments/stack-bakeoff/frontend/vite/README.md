# Vite candidate

**Supporting Artifact / Not a Source of Truth**。正式な比較・推奨は[Architecture](../../../../docs/architecture.md#frontend-bake-off)。

`experiments/stack-bakeoff`で共通[Setup](../../README.md#setup)後、`npm.cmd run dev:vite`で4173へ起動、`npm.cmd run build:vite`でbuildする。共通画面とReact Routerの2routeを接続する。

検索、Seed 3〜5曲、4評価、Guest復元、Error Boundaryを共通Mockで検証。`?mode=live`は4310のAPI＋PostgreSQLへ接続し、再評価の`api:integration`はFastifyを使う（初回はHono）。実Playback、公開配信、History fallback、モバイル性能は証明しない。UIデザインの正式採択ではない。
