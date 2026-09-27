import test from 'node:test';
import assert from 'node:assert/strict';
import { bodyDependencies, selectQueue } from './ml-agent-core.mjs';

const issue = (number, body = '', state = 'open', extra = {}) => ({
  number, title: '[Task][ML] ' + number, body: '## 完了条件\n- [ ] 確認\n' + body, state,
  labels: [], assignees: [{ login: 'Kaito-Iwase' }], ...extra,
});
const project = (number, scope = 'Must', status = 'Ready') => ({
  content: { number }, fields: [
    { name: 'Scope', value: { name: scope } },
    { name: 'Status', value: { name: status } },
  ],
});
const select = (issues, items, options = {}) =>
  selectQueue({ issues, projectItems: items, actor: 'Kaito-Iwase', ...options });

test('current ML dependency wording excludes parent and related references', () => {
  assert.deepEqual(bodyDependencies(
    '親Issue: #23。前提: #41、#42。実録音に対する受入は#39、校正は#40に依存。関連: #45'
  ).sort((a, b) => a - b), [39, 40, 41, 42]);
});

test('an open prerequisite blocks a Project Ready issue', () => {
  const result = select(
    [issue(38, '', 'open'), issue(41, '前提: #38。')],
    [project(38, 'Must', 'In progress'), project(41)],
  );
  assert.equal(result.selected, null);
  assert.match(result.entries.find((x) => x.issue.number === 41).reasons.join(' '), /Blocked by #38/);
});

test('human decision marker and uncompleted native dependency fail closed', () => {
  const result = select(
    [issue(41, 'tie規約はOPENであり、着手前に決定を記録する'), issue(42)],
    [project(41), project(42)],
    { nativeDependencies: { 42: [{ number: 41 }] } },
  );
  assert.equal(result.selected, null);
  assert.match(result.entries.find((x) => x.issue.number === 41).reasons.join(' '), /Human decision/);
  assert.match(result.entries.find((x) => x.issue.number === 42).reasons.join(' '), /Blocked by #41/);
});

test('Scope outranks downstream count; upstream wins within Scope', () => {
  const issues = [
    issue(50), issue(51, '前提: #50。'), issue(60), issue(61, '前提: #60。'),
  ];
  const items = [project(50, 'Should'), project(51, 'Must'), project(60), project(61)];
  const result = select(issues, items);
  assert.equal(result.selected.issue.number, 60);
  assert.equal(result.entries.find((x) => x.issue.number === 60).downstream, 1);
});

test('existing PR, another assignee, and missing Scope prevent duplicate execution', () => {
  const result = select(
    [issue(50), issue(51, '', 'open', { assignees: [{ login: 'teammate' }] }), issue(52)],
    [project(50), project(51), project(52, null)],
    { prs: [{ headRefName: 'feat/50-ml', body: 'Closes #50' }] },
  );
  assert.equal(result.selected, null);
  assert.match(result.entries.find((x) => x.issue.number === 50).reasons.join(' '), /Pull request/);
  assert.match(result.entries.find((x) => x.issue.number === 51).reasons.join(' '), /Assigned/);
  assert.match(result.entries.find((x) => x.issue.number === 52).reasons.join(' '), /Scope unset/);
});

test('only a recorded local run may resume In progress; closed not_planned does not unblock', () => {
  const issues = [issue(38, '', 'closed', { state_reason: 'not_planned' }), issue(41, '前提: #38。')];
  const items = [project(41, 'Must', 'In progress')];
  assert.equal(select(issues, items).selected, null);
  const resumed = select(issues, items, { activeNumbers: [41] });
  assert.equal(resumed.selected, null);
  assert.match(resumed.entries[0].reasons.join(' '), /Blocked by #38/);
  issues[0].state_reason = 'completed';
  assert.equal(select(issues, items, { activeNumbers: [41] }).selected.issue.number, 41);
});

test('the current seven-issue ML queue has no safe automatic starter', () => {
  const issues = [
    issue(38), issue(39, '前提: #38。人間が事前に合格率を設定する'),
    issue(40), issue(41, '前提: #38。着手前に決定を記録する'),
    issue(42, '前提: #41。'),
    issue(43, '前提: #41、#42。受入は#39、校正は#40に依存。'),
    issue(44, '前提: #40、#42、#43。人間の校正判断前に確定させない'),
  ];
  const items = [project(38, 'Must', 'In progress'), project(39),
    project(40, 'Must', 'In progress'), project(41), project(42), project(43), project(44)];
  const result = select(issues, items);
  assert.equal(result.entries.length, 7);
  assert.equal(result.selected, null);
  assert.equal(result.entries.find((x) => x.issue.number === 38).downstream, 5);
});
