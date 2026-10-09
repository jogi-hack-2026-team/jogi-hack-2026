#!/usr/bin/env bash
set -euo pipefail
first=$(npm run db:migrate --silent)
echo "$first"
echo "$first" | node scripts/check-migrations.mjs first
second=$(npm run db:migrate --silent)
echo "$second"
echo "$second" | node scripts/check-migrations.mjs noop
# ビルド済み出力からも同じ順序で実行できる（コンテナ内の手順）
node apps/api/dist/db/migrate-cli.js all | node scripts/check-migrations.mjs noop
