-- #157（Product Spec P-19）：到達予定日（B案）。
-- 任意で、既存Goalは未設定（null）のまま。「今日より後」の確認はGoalのtimezoneの今日が要るためAPIで行う。
-- 量の単位・保存（整数分）は変えない（P-18）。
alter table goal
  add column target_date date;
