# Hono candidate

**Supporting Artifact / Not a Source of Truth**。正式な比較・推奨は[Architecture](../../../../docs/architecture.md#backend-bake-off)。

`experiments/stack-bakeoff`で共通[Setup](../../README.md#setup)とDB起動後、`npm.cmd run api:hono`で4310へ起動する。`npm.cmd test`は両候補の実HTTP・DB・数値試験。`npm.cmd run e2e`はViteとの1組を含む。

同じService/SQLをHonoのroute/error/CORSから呼び、Feedbackの冪等性・競合とTraceの原子的保存を検証する。外部APIはMock、DBのみDocker。edge環境、app container、公開認証、実Playbackは未検証。
