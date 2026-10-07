#!/usr/bin/env sh
# 既定Composeを独立project・空のenv-file・合成データだけで検証する。既存volumeは参照しない。
# CIとDocker Desktop + Git Bashで実行可能。通常のローカルenv/credentialは渡さない。
set -eu
. ./scripts/smoke-today.sh
. ./scripts/smoke-env.sh
PROJECT="future-roi-compose-smoke-$(date +%s)-$$"
ENV_FILE=$(mktemp)
JAR=$(mktemp)
export LOCAL_APP_PORT="${SMOKE_APP_PORT:-18080}"
export LOCAL_DB_PORT="${SMOKE_DB_PORT:-15432}"
export LOCAL_DB_PASSWORD='compose-smoke-only-%#?@-placeholder'
export BETTER_AUTH_SECRET='compose-smoke-only-secret-0123456789abcdef'
base="http://127.0.0.1:$LOCAL_APP_PORT"
dc() { docker compose --file compose.yaml --env-file "$ENV_FILE" --project-name "$PROJECT" "$@"; }
cleanup() {
  # 自分で作成したprojectだけを停止する。volumeを削除せず失敗時の調査にも残す。
  dc down --timeout 15 >/dev/null 2>&1 || true
  echo "RETAINED (if created): project=$PROJECT volume=${PROJECT}_postgres_data"
  rm -f "$ENV_FILE" "$JAR"
}
trap cleanup EXIT
echo "SMOKE: project=$PROJECT volume=${PROJECT}_postgres_data"
fail() { echo "FAIL: $1"; exit 1; }
sql() { dc exec -T db psql -X -U futureroi -d futureroi -v ON_ERROR_STOP=1 -At -c "$1"; }
app_id() { dc ps --all --quiet app; }
healthy() {
  i=0
  until curl --silent --fail "$base/api/health" >/dev/null 2>&1; do
    i=$((i + 1))
    [ "$i" -lt 120 ] || fail 'health did not become ready'
    sleep 0.5
  done
}
assert_stopped() {
  i=0
  while [ "$(docker inspect --format '{{.State.Running}}' "$(app_id)")" = true ]; do
    i=$((i + 1)); [ "$i" -lt 60 ] || fail 'failed startup remained running'; sleep 0.5
  done
  [ "$(docker inspect --format '{{.State.ExitCode}}' "$(app_id)")" = 1 ] || fail 'failed startup must exit 1'
  if curl --silent --fail "$base/api/health" >/dev/null 2>&1; then fail 'failed startup served HTTP'; fi
}

dc config --quiet
without_auth_secret dc up -d --wait --wait-timeout 120 db
[ -z "$(app_id)" ] || fail 'db-only host development unexpectedly started app'
dc up -d --build --wait --wait-timeout 120
healthy
[ "$(curl --silent --fail "$base/api/health")" = '{"status":"ok","database":"ok"}' ] || fail 'health body'
curl --silent --fail "$base/health" | grep -q '<div id="root">' || fail 'SPA deep route'
asset=$(curl --silent --fail "$base/health" | sed -n 's/.*src="\(\/assets\/[^" ]*\.js\)".*/\1/p' | head -n 1)
[ -n "$asset" ] || fail 'SPA JS asset missing'
curl --silent --fail "$base$asset" >/dev/null || fail 'SPA JS asset unavailable'
[ "$(curl --silent --output /dev/null --write-out '%{http_code}' "$base/api/goals")" = 401 ] || fail 'anonymous API boundary'

email="compose-smoke-$$@example.test"
curl --silent --fail --cookie-jar "$JAR" --header "origin: $base" --header 'content-type: application/json' \
  --data "{\"email\":\"$email\",\"password\":\"smoke-only-user-password\",\"name\":\"Compose Smoke\"}" \
  "$base/api/auth/sign-up/email" >/dev/null
curl --silent --fail --cookie "$JAR" "$base/api/auth/get-session" | grep -q "\"email\":\"$email\"" || fail 'session after sign-up'
# mainに統合されたGoal・記録・Todayを通し、コンテナ内のEngine配置も検証する。
created=$(curl --silent --fail --cookie "$JAR" --header "origin: $base" --header 'content-type: application/json' \
  --data '{"title":"compose smoke goal","unit":"minutes","totalRequired":600,"sessionAmount":30,"timezone":"Asia/Tokyo"}' "$base/api/goals")
goal_id=$(echo "$created" | sed -n 's/.*"id":"\([0-9a-f-]*\)".*/\1/p')
[ -n "$goal_id" ] || fail 'goal creation missing id'
smoke_today_clock() {
  # hostのTZ実装・時計に依存せず、APIと同じNode/ICU・時計・暦日計算を使う。
  dc exec -T app node --input-type=module -e 'import { localDateIn, shiftLocalDate } from "./apps/api/dist/goals/local-date.js"; const today = localDateIn(new Date(), "Asia/Tokyo"); console.log(today, shiftLocalDate(today, 1));'
}
smoke_save_log() {
  curl --silent --fail --cookie "$JAR" --header "origin: $base" --header 'content-type: application/json' \
    --request PUT --data '{"status":"DONE"}' "$base/api/goals/$goal_id/logs/$1"
}
smoke_get_today() { curl --silent --fail --cookie "$JAR" "$base/api/goals/$goal_id/today"; }
verify_recorded_today
[ "$(curl --silent --output /dev/null --write-out '%{http_code}' --cookie "$JAR" "$base/api/compose-smoke-missing")" = 404 ] || fail 'unknown protected API must remain 404'
[ "$(curl --silent --output /dev/null --write-out '%{http_code}' --cookie "$JAR" --header 'origin: http://evil.example' \
  --header 'content-type: application/json' --data '{}' "$base/api/goals")" = 403 ] || fail 'mutation origin boundary'
curl --silent --cookie "$JAR" "$base/api/nope" | grep -q '"NOT_FOUND"' || fail 'unknown authenticated API must be JSON'

# 起動時にschemaが完成していることと、再実行後のuser・sentinel保持を確かめる。
sql 'create table compose_smoke_sentinel (id integer primary key); insert into compose_smoke_sentinel values (1)' >/dev/null
checksum=$(sql "select checksum from schema_migrations where name='0001_goal_action_log.sql'")
[ "${#checksum}" = 64 ] || fail 'migration was not recorded'
recorded=$(sql 'select count(*) from schema_migrations')
dc run --rm --no-deps app node apps/api/dist/db/migrate-cli.js all | grep -q '"applied":\[\]' || fail 'repeat migration was not a no-op'
dc up -d --build --wait --wait-timeout 120
dc restart app >/dev/null
healthy
[ "$(sql 'select count(*) from compose_smoke_sentinel')" = 1 ] || fail 'data changed after restart'
[ "$(sql 'select count(*) from schema_migrations')" = "$recorded" ] || fail 'migration history changed after restart'
curl --silent --fail --cookie "$JAR" "$base/api/auth/get-session" | grep -q "\"email\":\"$email\"" || fail 'session lost after restart'
[ "$(sql "select count(*) from action_log where goal_id='$goal_id'")" = "$today_log_count" ] || fail 'log lost after restart'
dc logs --no-color app | grep -q 'startup: migrations complete' || fail 'automatic migration missing'

dc stop app >/dev/null
[ "$(docker inspect --format '{{.State.ExitCode}}' "$(app_id)")" = 0 ] || fail 'SIGTERM must exit 0'
dc logs --no-color app | grep -q 'shutdown: complete' || fail 'graceful shutdown missing'

# 自分のDB sessionでlockを保持し、listener開始前の中止でもSIGKILLやデータ削除にならないことを確認する。
sql 'select pg_advisory_lock(70740001); select pg_sleep(30)' >/dev/null &
lock_pid=$!
i=0
until [ "$(sql "select count(*) from pg_locks where locktype='advisory' and objid=70740001 and granted")" = 1 ]; do
  i=$((i + 1)); [ "$i" -lt 20 ] || fail 'test migration lock was not acquired'; sleep 0.2
done
dc up -d app >/dev/null
i=0
until [ "$(sql "select count(*) from pg_stat_activity where wait_event='advisory'")" = 1 ]; do
  i=$((i + 1)); [ "$i" -lt 20 ] || fail 'startup did not wait for the migration lock'; sleep 0.2
done
if curl --silent --fail "$base/api/health" >/dev/null 2>&1; then fail 'startup served HTTP before migration'; fi
dc stop app >/dev/null
cancel_exit=$(docker inspect --format '{{.State.ExitCode}}' "$(app_id)")
[ "$cancel_exit" = 143 ] || fail "migration cancellation must exit 143 on SIGTERM; actual=$cancel_exit"
wait "$lock_pid"
[ "$(sql 'select count(*) from compose_smoke_sentinel')" = 1 ] || fail 'data lost on migration cancellation'

# 隔離DBの適用履歴だけを不一致にして、再起動のgateを検証する。既存/本番DBでは実行しない。
sql "update schema_migrations set checksum='smoke-corrupted-history' where name='0001_goal_action_log.sql'" >/dev/null
dc up -d app >/dev/null
assert_stopped
dc logs --no-color app | grep -q 'startup: migration failed (checksum_mismatch)' || fail 'migration checksum failure was not classified'
[ "$(sql 'select count(*) from compose_smoke_sentinel')" = 1 ] || fail 'data lost on migration failure'
[ "$(sql "select count(*) from \"user\" where email='$email'")" = 1 ] || fail 'user lost on migration failure'
sql "update schema_migrations set checksum='$checksum' where name='0001_goal_action_log.sql'" >/dev/null

# 認証設定の不足でも、DB変更/配信より前に非0で止まる。
without_auth_secret dc up -d app >/dev/null
assert_stopped
dc logs --no-color app | grep -q 'startup: configuration failed' || fail 'configuration failure was not reported'
# DBへ届かない失敗も、秘密を含む例外原文を出さず分類し、exit 1にする。
if unreachable=$(dc run --rm --no-deps --env DATABASE_URL=postgres://futureroi@127.0.0.1:1/futureroi app node apps/api/dist/container-start.js 2>&1); then
  fail 'unreachable DB startup succeeded'
fi
echo "$unreachable" | grep -q 'startup: migration failed (db_connection)' || fail 'DB connection failure was not classified'
if echo "$unreachable" | grep -F -e "$LOCAL_DB_PASSWORD" -e "$BETTER_AUTH_SECRET" >/dev/null; then fail 'credential value appeared in failed startup logs'; fi
dc up -d --wait --wait-timeout 120
healthy
curl --silent --fail --cookie "$JAR" --header "origin: $base" --header 'content-type: application/json' \
  --data '{}' "$base/api/auth/sign-out" >/dev/null
[ "$(curl --silent --output /dev/null --write-out '%{http_code}' --cookie "$JAR" "$base/api/goals")" = 401 ] || fail 'old cookie after sign-out'
if dc logs --no-color app 2>&1 | grep -F -e "$LOCAL_DB_PASSWORD" -e "$BETTER_AUTH_SECRET" -e 'smoke-only-user-password' >/dev/null; then
  fail 'credential value appeared in logs'
fi

volume=$(docker inspect --format '{{range .Mounts}}{{if eq .Type "volume"}}{{.Name}}{{end}}{{end}}' "$(dc ps --quiet db)")
dc down --timeout 15 >/dev/null
docker volume inspect "$volume" >/dev/null || fail 'down removed the data volume'
dc up -d --wait --wait-timeout 120
healthy
[ "$(sql 'select count(*) from compose_smoke_sentinel')" = 1 ] || fail 'data lost across down/up'
[ "$(sql "select count(*) from \"user\" where email='$email'")" = 1 ] || fail 'auth data lost across down/up'
[ "$(sql "select count(*) from action_log where goal_id='$goal_id'")" = "$today_log_count" ] || fail 'log lost across down/up'
echo "PASS: default Compose startup, migration repeat/restart/failure gate, SPA/API/auth/Goal/log/Today, running SIGTERM exit 0 / migration wait exit 143, data retained across down/up; project=$PROJECT volume=$volume"
