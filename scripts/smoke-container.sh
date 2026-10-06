#!/usr/bin/env sh
# 単一コンテナのsmoke test。CI（.github/workflows/application.yml）とDockerがある端末で使う。
# 必要な環境変数: IMAGE（build済みimage）、DATABASE_URL（コンテナからhost networkで到達できる接続先）。
# 確認: health、SPAの深いURL、存在しないAPI・対象外methodのJSON 404、assetのcache、SIGTERMで10秒以内にexit 0。
set -eu

: "${IMAGE:?IMAGE is required}"
: "${DATABASE_URL:?DATABASE_URL is required}"
PORT="${PORT:-8080}"
NAME="future-roi-smoke-$$"

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run --detach --name "$NAME" --network host \
  --env DATABASE_URL="$DATABASE_URL" --env PORT="$PORT" "$IMAGE" >/dev/null

base="http://127.0.0.1:$PORT"
i=0
until curl --silent --fail "$base/api/health" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "ERROR: health did not respond"; docker logs "$NAME"; exit 1
  fi
  sleep 0.5
done

fail() { echo "ERROR: $1"; docker logs "$NAME"; exit 1; }

body=$(curl --silent "$base/api/health")
[ "$body" = '{"status":"ok","database":"ok"}' ] || fail "health body: $body"

status=$(curl --silent --output /dev/null --write-out '%{http_code}' "$base/health")
[ "$status" = "200" ] || fail "deep URL /health status $status"
curl --silent "$base/health" | grep -q '<div id="root">' || fail "deep URL did not return the SPA"
curl --silent --head "$base/health" | grep -qi 'cache-control: no-cache' || fail "index.html must not be cached"

status=$(curl --silent --output /dev/null --write-out '%{http_code}' "$base/api/nope")
[ "$status" = "404" ] || fail "unknown API status $status"
curl --silent "$base/api/nope" | grep -q '"NOT_FOUND"' || fail "unknown API must be JSON 404"

status=$(curl --silent --output /dev/null --write-out '%{http_code}' --request POST "$base/goals")
[ "$status" = "404" ] || fail "POST to a page status $status"
curl --silent --request POST "$base/goals" | grep -q '"NOT_FOUND"' || fail "POST to a page must be JSON 404"

asset=$(curl --silent "$base/" | sed -n 's/.*src="\(\/assets\/[^"]*\.js\)".*/\1/p' | head -n 1)
[ -n "$asset" ] || fail "no script asset in index.html"
curl --silent --head "$base$asset" | grep -qi 'cache-control: public, max-age=31536000, immutable' || fail "asset cache-control"

start=$(date +%s)
docker stop --time 10 "$NAME" >/dev/null
elapsed=$(( $(date +%s) - start ))
code=$(docker inspect --format '{{.State.ExitCode}}' "$NAME")
[ "$code" = "0" ] || fail "exit code after SIGTERM was $code"
[ "$elapsed" -le 10 ] || fail "shutdown took ${elapsed}s"
docker logs "$NAME" 2>&1 | grep -q 'shutdown: complete' || fail "shutdown log missing"
echo "PASS: health, SPA deep URL, JSON 404s, asset cache, SIGTERM exit 0 in ${elapsed}s"
