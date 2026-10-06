-- 記録開始日（Architecture「初期進捗と日々の記録の境界」の最小案を#76で実装）。
-- Goal作成時に、そのGoalのtimezoneでの暦日を固定する。以後timezoneを変えても動かさない。
-- 既存行があればcurrent_date（DBサーバーの日付）で埋めるが、本番DBは未作成で既存Goalはない前提。
-- 新規行はAPIが必ず値を指定するため、既定値は外す。
alter table goal add column record_start_date date not null default current_date;
alter table goal alter column record_start_date drop default;
