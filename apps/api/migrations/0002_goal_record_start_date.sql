-- 記録開始日（Architecture「初期進捗と日々の記録の境界」の最小案を#76で実装）。
-- Goal作成時に、そのGoalのtimezoneでの暦日を固定する。以後timezoneを変えても動かさない。
-- 既存Goalの開始日は未採択の互換性判断が必要。DBの日付で黙って埋めない。
-- lockで既存行確認とschema変更の間の書込みを止め、空DBだけ適用する。
lock table goal in access exclusive mode;
do $$ begin
  if exists (select 1 from goal) then
    raise exception 'Existing Goals require an explicit record_start_date backfill decision before migration 0002';
  end if;
end $$;
alter table goal add column record_start_date date not null;
