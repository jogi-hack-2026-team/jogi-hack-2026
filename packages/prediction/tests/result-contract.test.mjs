import test from 'node:test';
import assert from 'node:assert/strict';
import { predict, DEFAULT_CONFIG, PredictionInputError, PredictionConfigError } from '../dist/src/index.js';

const goal = { totalRequired: 100, initialProgress: 0, sessionAmount: 10 };
const config = { ...DEFAULT_CONFIG, samples: 8, horizonDays: 20 };
const today = '2026-10-10';
const log = (day, status = 'DONE') => ({ localDate: `2026-10-${String(day).padStart(2, '0')}`,
  status, amount: status === 'DONE' ? 1 : null });

test('Result contract: calendar days include UNKNOWN and explicit counts end at today or yesterday', () => {
  // Expected numbers are fixed calendar examples, not derived by observe().
  for (const [logs, observedDays, recordedDays] of [
    [[], 0, 0], [[log(10)], 1, 1], [[log(10, 'SKIPPED')], 1, 1],
    [[log(9)], 1, 1], [[log(3)], 7, 1], [[log(3), log(10)], 8, 2],
    [[log(9), log(3, 'SKIPPED'), log(5)], 7, 3],
  ]) {
    const input = { goal, today, logs };
    const original = structuredClone(input);
    const result = predict(input, config);
    assert.equal(result.observations.observedDays, observedDays);
    assert.equal(result.observations.recordedDays, recordedDays);
    assert.deepEqual(input, original);
  }
});

test('Result contract: Gregorian leap/century/year boundaries preserve the UNKNOWN rule', () => {
  for (const [first, last, next, slots, transitions] of [
    ['1900-02-28', '1900-03-01', '1900-03-02', 2, 1],
    ['2000-02-28', '2000-03-01', '2000-03-02', 3, 0],
    ['2024-02-28', '2024-03-01', '2024-03-02', 3, 0],
    ['2025-12-31', '2026-01-01', '2026-01-02', 2, 1],
    ['0001-01-01', '0001-01-02', '0001-01-03', 2, 1],
  ]) {
    const result = predict({ goal, today: next, logs: [
      { localDate: first, status: 'SKIPPED', amount: null },
      { localDate: last, status: 'DONE', amount: 1 },
    ] }, config);
    assert.equal(result.observations.observedDays, slots);
    assert.equal(result.observations.recordedDays, 2);
    assert.equal(result.observations.effectiveTransitions, transitions);
  }
});

test('Result contract: initial progress and completed state never fabricate an observation origin', () => {
  for (const initialProgress of [0, 12, 100]) {
    const result = predict({ goal: { ...goal, initialProgress }, today, logs: [] }, config);
    assert.equal(result.observations.observedDays, 0);
    assert.equal(result.observations.recordedDays, 0);
    assert.equal(result.completion.status, initialProgress === 100 ? 'completed' : 'insufficient');
  }
  const result = predict({ goal: { ...goal, initialProgress: 100 }, today, logs: [log(3)] }, config);
  assert.equal(result.completion.status, 'completed');
  assert.equal(result.observations.observedDays, 7);
  assert.equal(result.observations.recordedDays, 1);
});

test('Result contract: extending the window with isolated SKIPPED changes metadata alone', () => {
  const input = { goal, today, logs: [log(7, 'SKIPPED'), log(8), log(9)] };
  const narrow = predict(input, config);
  const wide = predict({ ...input, logs: [log(3, 'SKIPPED'), ...input.logs] }, config);
  assert.deepEqual([narrow.observations.observedDays, narrow.observations.recordedDays], [3, 3]);
  assert.deepEqual([wide.observations.observedDays, wide.observations.recordedDays], [7, 4]);
  const numerical = result => ({ ...result, observations: { ...result.observations,
    observedDays: undefined, recordedDays: undefined } });
  assert.deepEqual(numerical(narrow), numerical(wide));
  assert.equal(wide.completion.status, 'available');
});

test('Error contract: public classes classify input/config/derived paths without a transport response', () => {
  const input = { goal, today, logs: [log(7, 'SKIPPED'), log(8), log(9)] };
  for (const [call, Class, reason, path] of [
    [() => predict({ ...input, logs: [log(8), log(7, 'SKIPPED'), log(8)] }, config),
      PredictionInputError, 'DUPLICATE_LOG_DATE', ['logs', 2, 'localDate']],
    [() => predict({ ...input, logs: [log(11)] }, config),
      PredictionInputError, 'FUTURE_LOG_DATE', ['logs', 0, 'localDate']],
    [() => predict(input, { ...config, prior: 1.5 }),
      PredictionConfigError, 'INVALID_INTEGER', ['prior']],
    [() => predict(input, { ...config, prior: Number.MAX_SAFE_INTEGER }),
      PredictionConfigError, 'UNSAFE_POSTERIOR', ['posterior', 'a', 'alpha']],
  ]) {
    assert.throws(call, error => {
      assert.ok(error instanceof Class && error instanceof RangeError);
      assert.equal(error.reason, reason);
      assert.deepEqual(error.path, path);
      assert.ok(Object.isFrozen(error.path));
      assert.equal('statusCode' in error, false);
      assert.equal('code' in error, false);
      assert.equal('value' in error, false);
      return true;
    });
  }
});

test('Result contract: recording or correcting today recomputes the complete result without retained state', () => {
  const input = { goal, today, logs: [log(7, 'SKIPPED'), log(8), log(9)] };
  const original = predict(input, config);
  const recorded = predict({ ...input, logs: [...input.logs, { ...log(10), amount: 3 }] }, config);
  const corrected = predict({ ...input, logs: [...input.logs, log(10, 'SKIPPED')] }, config);
  assert.deepEqual([original.observations.observedDays, original.observations.recordedDays], [3, 3]);
  assert.deepEqual([recorded.observations.observedDays, recorded.observations.recordedDays], [4, 4]);
  assert.deepEqual([corrected.observations.observedDays, corrected.observations.recordedDays], [4, 4]);
  assert.equal(recorded.progress.done, original.progress.done + 3);
  assert.equal(corrected.progress.done, original.progress.done);
  assert.equal(recorded.completion.scenario, 'CURRENT_STATE');
  assert.equal(corrected.completion.scenario, 'CURRENT_STATE');
  assert.deepEqual(predict(input, config), original);
});
