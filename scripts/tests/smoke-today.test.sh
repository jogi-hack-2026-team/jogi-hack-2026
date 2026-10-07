#!/usr/bin/env sh
set -eu
. ./scripts/smoke-today.sh
test_dir=$(mktemp -d)
cleanup() { rm -f "$test_dir/clock" "$test_dir/saves" "$test_dir/output"; rmdir "$test_dir"; }
trap cleanup EXIT
fail() { echo "FAIL: $1" >&2; exit 1; }
smoke_today_clock() {
  n=$(cat "$test_dir/clock"); n=$((n + 1)); echo "$n" > "$test_dir/clock"
  case "$scenario:$n" in
    rollover:1|retry-bad:1|twice:1|http:1|model:1|jump:1|stable-bad-boundary:1) echo '2026-12-31 2027-01-01' ;;
    jump:2) echo '2027-01-02 2027-01-03' ;;
    twice:3) echo '2027-01-02 2027-01-03' ;;
    *) echo '2027-01-01 2027-01-02' ;;
  esac
}
smoke_save_log() {
  echo "$1" >> "$test_dir/saves"
  [ "$scenario" != put-http ] || return 22
  [ "$scenario" != put-body ] || { echo '{}'; return; }
  echo "{\"localDate\":\"$1\",\"status\":\"DONE\",\"amount\":30}"
}
smoke_get_today() {
  [ "$scenario" != http ] || return 22
  recorded_day=$(tail -n 1 "$test_dir/saves")
  reported_day=$recorded_day
  case "$scenario" in
    rollover|retry-bad|twice)
      if [ "$recorded_day" = 2026-12-31 ]; then reported_day=2027-01-01
      elif [ "$scenario" = twice ]; then reported_day=2027-01-02; fi ;;
    jump) reported_day=2027-01-02 ;;
  esac
  case "$scenario" in
    model) echo '{"reason":"TODAY_RECORDED"}' ;;
    stable-bad|stable-bad-boundary|retry-bad|twice|jump) echo "{\"today\":\"$reported_day\",\"modelVersion\":\"behavior-persistence-m1-v1\",\"reason\":\"CAN_RECORD\"}" ;;
    rollover)
      if [ "$(wc -l < "$test_dir/saves" | tr -d ' ')" = 1 ]; then
        echo "{\"today\":\"$reported_day\",\"modelVersion\":\"behavior-persistence-m1-v1\",\"reason\":\"CAN_RECORD\"}"
      else
        echo "{\"today\":\"$reported_day\",\"modelVersion\":\"behavior-persistence-m1-v1\",\"reason\":\"TODAY_RECORDED\"}"
      fi ;;
    *) echo "{\"today\":\"$reported_day\",\"modelVersion\":\"behavior-persistence-m1-v1\",\"reason\":\"TODAY_RECORDED\"}" ;;
  esac
}
run_case() {
  scenario=$1; expected=$2; saves=$3
  echo 0 > "$test_dir/clock"; : > "$test_dir/saves"
  if (verify_recorded_today) > "$test_dir/output" 2>&1; then actual=0; else actual=1; fi
  [ "$actual" = "$expected" ] || { cat "$test_dir/output"; fail "$scenario outcome"; }
  [ "$(wc -l < "$test_dir/saves" | tr -d ' ')" = "$saves" ] || fail "$scenario retry count"
  if [ "$expected" = 1 ]; then grep -q "FAIL: $4" "$test_dir/output" || fail "$scenario failure reason"; fi
  echo "PASS: $scenario"
}
run_case normal 0 1
run_case rollover 0 2
run_case stable-bad 1 1 'Today did not reflect the log'
run_case stable-bad-boundary 1 1 'Today did not reflect the log'
run_case retry-bad 1 2 'Today did not reflect the log'
run_case twice 1 2 'Today crossed midnight again'
run_case jump 1 1 'Today clock changed unexpectedly'
run_case http 1 1 'Today HTTP failure'
run_case model 1 1 'Today did not return the Engine result'
run_case put-http 1 1 'log save HTTP failure'
run_case put-body 1 1 'log save body'
