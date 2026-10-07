#!/usr/bin/env sh
# 単一コンテナのsmoke test。CI（.github/workflows/application.yml）とDockerがある端末で使う。
# 必要な環境変数: IMAGE（build済みimage）、DATABASE_URL（コンテナからhost networkで到達できる接続先）。
# 確認: migration、health、SPAの深いURL、存在しないAPI・対象外methodのJSON 404、assetのcache、
#       登録→セッション→ログアウト→古いCookieは401（複数Set-Cookieの転送を含む）、未ログインの/api/*は401、SIGTERMで10秒以内にexit 0。
# 認証のSecret・URLは確認用の合成値（本番の値を渡さない）。httpのbase URLは BETTER_AUTH_ALLOW_HTTP=1 で許可する。
set -eu

: "${IMAGE:?IMAGE is required}"
: "${DATABASE_URL:?DATABASE_URL is required}"
PORT="${PORT:-8080}"
NAME="future-roi-smoke-$$"

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

AUTH_SECRET="smoke-only-secret-$(date +%s)-0123456789abcdef"
AUTH_URL="http://127.0.0.1:$PORT"

# 起動前にmigration（認証→アプリ）をコンテナ内のビルド済み出力から実行する
docker run --rm --network host --env DATABASE_URL="$DATABASE_URL" "$IMAGE" \
  node apps/api/dist/db/migrate-cli.js all | grep -q '"target":"all"'

docker run --detach --name "$NAME" --network host \
  --env DATABASE_URL="$DATABASE_URL" --env PORT="$PORT" \
  --env BETTER_AUTH_SECRET="$AUTH_SECRET" --env BETTER_AUTH_URL="$AUTH_URL" --env BETTER_AUTH_ALLOW_HTTP=1 \
  "$IMAGE" >/dev/null

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

# 未ログインの /api/* は（routeの有無によらず）401。routeがないpathの404はログイン後に確認する
status=$(curl --silent --output /dev/null --write-out '%{http_code}' "$base/api/nope")
[ "$status" = "401" ] || fail "anonymous unknown API status $status"
curl --silent "$base/api/nope" | grep -q '"UNAUTHENTICATED"' || fail "anonymous unknown API must be JSON 401"

status=$(curl --silent --output /dev/null --write-out '%{http_code}' --request POST "$base/goals")
[ "$status" = "404" ] || fail "POST to a page status $status"
curl --silent --request POST "$base/goals" | grep -q '"NOT_FOUND"' || fail "POST to a page must be JSON 404"

asset=$(curl --silent "$base/" | sed -n 's/.*src="\(\/assets\/[^"]*\.js\)".*/\1/p' | head -n 1)
[ -n "$asset" ] || fail "no script asset in index.html"
curl --silent --head "$base$asset" | grep -qi 'cache-control: public, max-age=31536000, immutable' || fail "asset cache-control"

# 認証の往復（合成アカウント。Cookie値は表示しない）
jar=$(mktemp)
trap 'rm -f "$jar"; cleanup' EXIT
email="smoke-$$@example.test"
password="smoke-password-$(date +%s%N)"
status=$(curl --silent --output /dev/null --write-out '%{http_code}' --cookie-jar "$jar" \
  --header "origin: $AUTH_URL" --header 'content-type: application/json' \
  --data "{\"name\":\"smoke\",\"email\":\"$email\",\"password\":\"$password\"}" "$base/api/auth/sign-up/email")
[ "$status" = "200" ] || fail "sign-up status $status"
grep -q 'session_token' "$jar" || fail "session cookie was not set"
curl --silent --cookie "$jar" "$base/api/auth/get-session" | grep -q "\"email\":\"$email\"" || fail "get-session did not return the user"
status=$(curl --silent --output /dev/null --write-out '%{http_code}' --cookie "$jar" "$base/api/goals")
[ "$status" = "404" ] || fail "authenticated /api/goals status $status (expected 404: protected but no route yet)"
curl --silent --cookie "$jar" "$base/api/nope" | grep -q '"NOT_FOUND"' || fail "authenticated unknown API must be JSON 404"
status=$(curl --silent --output /dev/null --write-out '%{http_code}' "$base/api/goals")
[ "$status" = "401" ] || fail "anonymous /api/goals status $status"
status=$(curl --silent --output /dev/null --write-out '%{http_code}' --cookie "$jar" \
  --header 'origin: http://evil.example' --header 'content-type: application/json' --data '{}' "$base/api/goals")
[ "$status" = "403" ] || fail "foreign-origin mutation status $status"
old_cookie=$(mktemp); cp "$jar" "$old_cookie"
lines=$(curl --silent --include --cookie "$jar" --cookie-jar "$jar" --header "origin: $AUTH_URL" --header 'content-type: application/json' --data '{}' "$base/api/auth/sign-out" | grep -ci '^set-cookie:')
[ "$lines" -ge 1 ] || fail "sign-out did not clear cookies"
status=$(curl --silent --output /dev/null --write-out '%{http_code}' --cookie "$old_cookie" "$base/api/goals")
rm -f "$old_cookie"
[ "$status" = "401" ] || fail "old cookie after sign-out status $status"

start=$(date +%s)
docker stop --time 10 "$NAME" >/dev/null
elapsed=$(( $(date +%s) - start ))
code=$(docker inspect --format '{{.State.ExitCode}}' "$NAME")
[ "$code" = "0" ] || fail "exit code after SIGTERM was $code"
[ "$elapsed" -le 10 ] || fail "shutdown took ${elapsed}s"
docker logs "$NAME" 2>&1 | grep -q 'shutdown: complete' || fail "shutdown log missing"
echo "PASS: migration, health, SPA deep URL, JSON 404s, asset cache, auth round trip, SIGTERM exit 0 in ${elapsed}s"
