-- #157（Product Spec P-18）：到達予定日（B案）と時間のGoalの記録の単位（C案）。
-- 到達予定日は任意で、既存Goalは未設定（null）のまま。「今日より後」の確認はGoalのtimezoneの今日が要るためAPIで行う。
-- 記録の単位は、時間のGoal（unit = 'minutes'）で1回の量・日々の記録を分と時間のどちらで入力・表示するか。
-- 量はこれまでどおり分で保存するので、既存Goalと記録の値・Engineの入力は変わらない。既存Goalは「分」で入力していたので 'minutes'。
-- 回のGoal（unit = 'sessions'）には時間の単位がないため 'minutes' に固定し、APIでは null として返す。
alter table goal
  add column target_date date,
  add column record_unit text not null default 'minutes',
  add constraint goal_record_unit_values check (record_unit in ('minutes', 'hours')),
  add constraint goal_record_unit_time_only check (unit = 'minutes' or record_unit = 'minutes');
