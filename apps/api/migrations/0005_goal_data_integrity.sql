-- #148: 過去の量を別単位として再解釈せず、設定保存とcreate再送を保全する。
-- 旧SKIP-onlyには過去DONE訂正との区別がないため、旧ログありを保守的に固定する。
-- 実量・初期量・暦日・既存metadataは変更しない。通常環境への適用は別の承認対象。
lock table goal, action_log in access exclusive mode;
alter table goal add column unit_history_locked boolean not null default false;
alter table goal add column goal_settings_revision integer not null default 0
  check (goal_settings_revision >= 0);
alter table goal disable trigger goal_set_updated_at;
update goal g set unit_history_locked = true
  where exists (select 1 from action_log l where l.goal_id = g.id);
alter table goal enable trigger goal_set_updated_at;

-- 予約とGoal作成を同transactionで完了する。削除後はnullをtombstoneとして保持する。
-- 元bodyのhashはGoalの編集後も保持し、同じキーでの復活・異なる作成を拒否する。
create table goal_create_operation (
  user_id text not null references "user"(id) on delete cascade,
  idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  goal_id uuid unique references goal(id) on delete set null,
  primary key (user_id, idempotency_key)
);
