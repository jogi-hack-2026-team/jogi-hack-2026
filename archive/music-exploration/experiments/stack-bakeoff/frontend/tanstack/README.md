# Vite + TanStack Router

**Supporting Artifact / Not a Source of Truth**。Startとは別候補。[Architecture](../../../../docs/architecture.md)が判断の正本。

PoCルートで`npm.cmd run dev:tanstack`（4175）、`npm.cmd run build:tanstack`、`npm.cmd run e2e -- --project=tanstack`。既存と同じ画面・API Mock・4ケースを使い、code-based routeと型付きmode検索パラメータを追加する。型保証はRouter境界のみでHTTP応答のruntime検証を代替しない。Loader/cache・大規模route・Start/server機能・本番UIは未検証。
