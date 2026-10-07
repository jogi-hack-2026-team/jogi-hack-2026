-- #82: 名前・メールではなく、CLIが作った専用GoalのIDと所有者を記録する。
-- 0003はR-11の作業で使用する。既存Goal・実記録・認証行は変更しない。
alter table goal add constraint goal_demo_owner_unique unique (id, user_id);

create table demo_seed_goal (
  user_id text not null,
  slot text not null check (slot in ('fast-resumption', 'slow-resumption')),
  goal_id uuid not null unique,
  seed_version integer not null check (seed_version = 1),
  primary key (user_id, slot),
  foreign key (goal_id, user_id) references goal(id, user_id) on delete cascade
);
