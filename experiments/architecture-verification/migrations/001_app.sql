-- Spike-only subset of the Data Model referenced by #74 (goal / action_log).
-- Kept minimal: enough to verify ownership, uniqueness and status-specific amount rules.
create table goal (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user" (id) on delete cascade,
  title text not null,
  unit text not null check (unit in ('minutes', 'count')),
  total_required numeric not null check (total_required > 0),
  session_amount numeric not null check (session_amount > 0),
  initial_progress numeric not null default 0 check (initial_progress >= 0),
  timezone text not null,
  created_at timestamptz not null default now()
);
create index goal_user_id_idx on goal (user_id);

create table action_log (
  goal_id uuid not null references goal (id) on delete cascade,
  local_date date not null,
  status text not null check (status in ('DONE', 'SKIPPED')),
  amount numeric,
  recorded_at timestamptz not null default now(),
  primary key (goal_id, local_date),
  check (
    (status = 'DONE' and amount is not null and amount > 0)
    or (status = 'SKIPPED' and amount is null)
  )
);
