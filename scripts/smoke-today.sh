# Compose smokeの記録→Today検証。時計とHTTPは呼び出し側が用意し、境界を固定して回帰確認できる。
verify_recorded_today() {
  today_log_count=1
  today_attempt=0
  today_clock=$(smoke_today_clock) || fail 'Today clock unavailable'
  while :; do
    today_jst=${today_clock%% *}
    next_jst=${today_clock#* }
    saved=$(smoke_save_log "$today_jst") || fail 'log save HTTP failure'
    [ "$saved" = "{\"localDate\":\"$today_jst\",\"status\":\"DONE\",\"amount\":30}" ] || fail 'log save body'
    today_body=$(smoke_get_today) || fail 'Today HTTP failure'
    echo "$today_body" | grep -q '"modelVersion":"behavior-persistence-m1-v1"' || fail 'Today did not return the Engine result'
    reported_today=$(echo "$today_body" | sed -n 's/.*"today":"\([0-9-]*\)".*/\1/p')
    if [ "$reported_today" != "$today_jst" ]; then
      # PUTとTodayの間で翌日になった場合だけ、翌日の記録から1回やり直す。
      # HTTP/保存body/modelの失敗や時計の大きな変更はretryで隠さない。
      [ "$reported_today" = "$next_jst" ] || fail 'Today clock changed unexpectedly'
      today_after_clock=$(smoke_today_clock) || fail 'Today clock unavailable'
      today_after=${today_after_clock%% *}
      [ "$today_after" = "$next_jst" ] || fail 'Today clock changed unexpectedly'
      [ "$today_attempt" = 0 ] || fail 'Today crossed midnight again'
      echo 'Today crossed Tokyo midnight; retrying the log/Today check once'
      today_attempt=1
      today_log_count=2
      today_clock=$today_after_clock
      continue
    fi
    echo "$today_body" | grep -q '"reason":"TODAY_RECORDED"' || fail 'Today did not reflect the log'
    return 0
  done
}
