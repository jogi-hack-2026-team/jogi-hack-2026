#!/usr/bin/env sh
set -eu
. ./scripts/smoke-env.sh
export BETTER_AUTH_SECRET='synthetic-placeholder-must-survive'
probe() {
  [ "$BETTER_AUTH_SECRET" = '' ] || return 2
  [ "$1" = 'argument with spaces' ] || return 3
  return "$2"
}
without_auth_secret probe 'argument with spaces' 0
[ "$BETTER_AUTH_SECRET" = 'synthetic-placeholder-must-survive' ] || exit 4
if without_auth_secret probe 'argument with spaces' 7; then exit 5; else result=$?; fi
[ "$result" = 7 ] || exit 6
[ "$BETTER_AUTH_SECRET" = 'synthetic-placeholder-must-survive' ] || exit 8
echo 'PASS: missing-secret probe preserves caller environment and exit status'
