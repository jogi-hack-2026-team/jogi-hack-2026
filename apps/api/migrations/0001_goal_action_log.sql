-- Data Model（docs/architecture.md#data-model）のgoal / action_log。
-- 認証テーブル（"user"等）は固定版Better Authのmigration（db:migrate:auth）が先に作る。
create table goal (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null references "user"(id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 100),
  unit            text not null check (unit in ('minutes', 'sessions')),
  total_required  integer not null check (total_required > 0),
  initial_progress integer not null default 0 check (initial_progress >= 0),
  session_amount  integer not null check (session_amount > 0),
  timezone        text not null,            -- IANA名（例 Asia/Tokyo）。有効性はAPI側で検証する
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index goal_user_id_idx on goal (user_id);

create table action_log (
  id          uuid primary key default gen_random_uuid(),
  goal_id     uuid not null references goal(id) on delete cascade,
  local_date  date not null,
  status      text not null check (status in ('DONE', 'SKIPPED')),
  -- CHECKは結果がNULLでも通過するため、DONE側でNULLを明示的に拒否する
  amount      integer check ((status = 'DONE' and amount is not null and amount > 0) or (status = 'SKIPPED' and amount is null)),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (goal_id, local_date)
);

-- updated_atは更新時にDBが進める（アプリ側の書き忘れで上書きの有無を追えなくなるのを防ぐ）。
create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;
create trigger goal_set_updated_at before update on goal for each row execute function set_updated_at();
create trigger action_log_set_updated_at before update on action_log for each row execute function set_updated_at();
