-- R-11: 既存Goalは未回答・版0。記録開始日や実記録は変更しない。
alter table goal
  add column question_prior jsonb not null default '{"a":null,"b":null}'::jsonb,
  add column answer_revision bigint not null default 0,
  add column question_prior_snapshot jsonb,
  add constraint goal_answer_revision_safe check (answer_revision between 0 and 9007199254740991),
  add constraint goal_question_prior_shape check (
    jsonb_typeof(question_prior) = 'object'
    and question_prior ?& array['a', 'b']
    and question_prior - 'a' - 'b' = '{}'::jsonb
    and question_prior->'a' in ('null'::jsonb, '"UNKNOWN"'::jsonb, '"LOW"'::jsonb, '"MID"'::jsonb, '"HIGH"'::jsonb)
    and question_prior->'b' in ('null'::jsonb, '"UNKNOWN"'::jsonb, '"LOW"'::jsonb, '"MID"'::jsonb, '"HIGH"'::jsonb)
  ),
  add constraint goal_question_prior_snapshot_presence check (
    (question_prior = '{"a":null,"b":null}'::jsonb and question_prior_snapshot is null)
    or (question_prior <> '{"a":null,"b":null}'::jsonb and question_prior_snapshot is not null)
  );
