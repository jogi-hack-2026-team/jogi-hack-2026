# Fastify candidate

**Supporting Artifact / Not a Source of Truth**。正式な比較・推奨は[Architecture](../../../../docs/architecture.md#backend-bake-off)。

`experiments/stack-bakeoff`で共通[Setup](../../README.md#setup)とDB起動後、`npm.cmd run api:fastify`で4311へ起動する。`npm.cmd test`はHonoと同じ実HTTP・DB・数値試験を実行する。

共通Service/SQLでFeedbackの冪等性・競合とTraceの原子的保存を検証する。組込みschema validation・loggingの強みは机上評価のみ。Frontend pair統合、外部実API、app container、公開認証は未検証。
