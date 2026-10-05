import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { makeInitialPrior, validateInitialPrior, rebuildRaw, posteriorFromRaw, betaGeometricQuantile, priorWeight, evaluate } from '../src/prototype.ts';
import { completionPmf, drawsFromPosterior, quantileDays } from '../reference/completion-dp.mjs';

const goal = { totalRequired: 100, sessionAmount: 10, initialProgress: 0, frequency: 'daily', actionSpec: 'study-english:10-minutes:daily:v1' };
const experienced = { experience: 'same_action', afterDone: 'often', afterSkip: 'rarely' };
const initial = (answers = experienced) => makeInitialPrior(answers, goal.actionSpec);
const today = '2026-09-20';
function logs(sequence) {
  return [...sequence].flatMap((s, i) => s === 'U' ? [] : [{ localDate: `2026-09-${String(i + 1).padStart(2, '0')}`, status: s === 'D' ? 'DONE' : 'SKIPPED', amount: s === 'D' ? 10 : null }]);
}

test('independent a/b mapping includes mixed tendencies without personality labels', () => {
  for (const [answer, shape] of [['often', [3, 1]], ['sometimes', [2, 2]], ['rarely', [1, 3]]]) {
    const p = initial({ ...experienced, afterDone: answer }); assert.deepEqual(p.a, shape); assert.deepEqual(p.b, [1, 3]);
  }
  const p = initial(); assert.equal(p.sourceA, 'questionnaire'); assert.equal(p.sourceB, 'questionnaire');
  const r = evaluate(goal, [], today, p, 'questionnaire_draft');
  assert.deepEqual(r.counts, { dd: 0, ds: 0, sd: 0, ss: 0 }); assert.equal(r.actualDone, 0);
  assert.equal(r.provenance.a.label, 'QUESTIONNAIRE_ONLY'); assert.equal(r.provenance.b.label, 'QUESTIONNAIRE_ONLY');
  assert.equal(r.core.g50, 3); assert.equal(r.core.g80, 12); assert.equal(r.completion.status, 'available');
});

test('new/unknown experience and missing answers keep common priors and deterministic plan', () => {
  for (const experience of ['new_action', 'unknown']) {
    const p = initial({ ...experienced, experience }); assert.deepEqual(p.a, [2, 2]); assert.deepEqual(p.b, [2, 2]);
    const r = evaluate(goal, [], today, p, 'questionnaire_draft');
    assert.equal(r.core.status, 'conditional_plan'); assert.equal(r.completion.status, 'conditional_plan');
    assert.deepEqual(r.plan, { status: 'conditional_plan', remainingSessions: 10, daysFromToday: 9, assumption: 'FROM_TODAY_DAILY_ONE_SESSION' });
    assert.equal(r.diagnostics[0], 'ANSWERS_IGNORED_WITHOUT_SAME_ACTION_EXPERIENCE');
  }
  for (const answer of ['unknown', 'unanswered']) {
    const r = evaluate(goal, [], today, initial({ ...experienced, afterSkip: answer }), 'questionnaire_draft');
    assert.equal(r.provenance.a.initialSource, 'questionnaire'); assert.equal(r.provenance.b.initialSource, 'common');
    assert.equal(r.core.status, 'conditional_plan'); assert.equal(r.completion.status, 'conditional_plan');
  }
});

test('baseline ignores questionnaire shapes and preserves R06/P12', () => {
  const r = evaluate(goal, [], today, initial());
  assert.deepEqual(r.posterior, { a: [2, 2], b: [2, 2] }); assert.equal(r.core.status, 'insufficient');
  assert.equal(r.completion.reason, 'NO_DONE_ORIGIN_TRANSITION'); assert.equal(r.plan, null);
  const done = evaluate(goal, logs('DDDD'), today, initial());
  assert.equal(done.core.status, 'insufficient'); assert.equal(done.completion.reason, 'NO_SKIP_ORIGIN_TRANSITION');
  const skip = evaluate(goal, logs('SSSS'), today, initial());
  assert.equal(skip.core.status, 'available'); assert.equal(skip.completion.reason, 'NO_DONE_ORIGIN_TRANSITION');
});

test('only adjacent actual raw logs count; unknown gaps, unsorted input, leap dates', () => {
  const raw = logs('DUSSD'); const before = structuredClone(raw);
  const r = rebuildRaw([...raw].reverse(), today, goal);
  assert.deepEqual(r.counts, { dd: 0, ds: 0, sd: 1, ss: 1 }); assert.equal(r.actualDone, 20); assert.deepEqual(raw, before);
  assert.deepEqual(rebuildRaw([{ localDate: '2024-02-29', status: 'DONE', amount: 10 }, { localDate: '2024-03-01', status: 'SKIPPED', amount: null }], today, goal).counts, { dd: 0, ds: 1, sd: 0, ss: 0 });
  const patterns = { DDD: { dd: 2, ds: 0, sd: 0, ss: 0 }, SSS: { dd: 0, ds: 0, sd: 0, ss: 2 }, DSD: { dd: 0, ds: 1, sd: 1, ss: 0 }, DUD: { dd: 0, ds: 0, sd: 0, ss: 0 }, UUU: { dd: 0, ds: 0, sd: 0, ss: 0 } };
  for (const [seq, expected] of Object.entries(patterns)) assert.deepEqual(rebuildRaw(logs(seq), today, goal).counts, expected);
});

test('posterior updates only the observed origin and provenance weights are origin-specific', () => {
  const p = initial(); const d = evaluate(goal, logs('DDDDD'), today, p, 'questionnaire_draft');
  assert.deepEqual(d.posterior, { a: [7, 1], b: [1, 3] }); assert.equal(d.provenance.a.priorWeight, .5); assert.equal(d.provenance.b.priorWeight, 1);
  assert.equal(d.provenance.a.observations, 4); assert.equal(d.provenance.b.observations, 0);
  const s = evaluate(goal, logs('SSSSS'), today, p, 'questionnaire_draft'); assert.deepEqual(s.posterior, { a: [3, 1], b: [1, 7] });
  assert.equal(s.provenance.a.label, 'QUESTIONNAIRE_ONLY'); assert.equal(s.provenance.b.label, 'OBSERVED_PLUS_QUESTIONNAIRE');
  const unknown = evaluate(goal, logs('DSD'), today, initial({ ...experienced, experience: 'unknown' }), 'questionnaire_draft');
  assert.equal(unknown.core.status, 'available'); assert.equal(unknown.completion.status, 'available'); assert.equal(unknown.provenance.b.label, 'OBSERVED_PLUS_COMMON');
});

test('answer revisions rebuild from unchanged raw; raw correction removes both neighboring transitions', () => {
  const raw = logs('DSD'); const p1 = initial(); const p2 = makeInitialPrior({ ...experienced, afterSkip: 'often' }, goal.actionSpec, 2);
  const r1 = evaluate(goal, raw, today, p1, 'questionnaire_draft'); const r2 = evaluate(goal, raw, today, p2, 'questionnaire_draft');
  assert.deepEqual(r1.counts, r2.counts); assert.equal(r1.actualDone, r2.actualDone); assert.deepEqual(r2.posterior.b, [4, 1]); assert.deepEqual(p1.b, [1, 3]);
  const corrected = raw.map(l => l.status === 'SKIPPED' ? { ...l, status: 'DONE', amount: 4 } : l);
  const r3 = evaluate(goal, corrected, today, p1, 'questionnaire_draft');
  assert.deepEqual(r3.counts, { dd: 2, ds: 0, sd: 0, ss: 0 }); assert.deepEqual(r3.posterior.b, [1, 3]); assert.equal(r3.actualDone - r1.actualDone, 4);
});

test('actual progress, prior, today condition, and future sessions stay separate', () => {
  const raw = logs('DSD'); raw[2].amount = 7;
  for (const sessionAmount of [10, 6]) {
    const r = evaluate({ ...goal, initialProgress: 5, totalRequired: 45, sessionAmount }, raw, '2026-09-03', initial(), 'questionnaire_draft');
    assert.equal(r.actualDone, 22); assert.equal(r.projectedDone, 22); assert.equal(r.requiredFutureDone, Math.ceil(23 / sessionAmount));
    assert.equal(r.core.reason, 'TODAY_RECORDED'); assert.equal(r.completion.scenario, 'CURRENT_STATE');
  }
  for (const remaining of [10, 20]) {
    const r = evaluate({ ...goal, totalRequired: 20 + remaining }, logs('DSD'), '2026-09-04', initial(), 'questionnaire_draft');
    assert.equal(r.actualDone, 20); assert.equal(r.projectedDone, 30); assert.equal(r.requiredFutureDone, remaining === 10 ? 0 : 1);
    if (remaining === 10) assert.equal(r.completion.p50Days, 0);
  }
  const s = evaluate(goal, logs('S'), '2026-09-01', initial({ ...experienced, experience: 'new_action' }), 'questionnaire_draft');
  assert.equal(s.projectedDone, 0); assert.equal(s.plan.daysFromToday, 10); assert.equal(s.plan.assumption, 'FROM_TOMORROW_DAILY_ONE_SESSION');
});

test('achieved precedes shortage/today-recorded/non-daily; non-daily is never daily converted', () => {
  for (const frequency of ['daily', 'non_daily']) for (const raw of [[], logs('S')]) {
    const r = evaluate({ ...goal, initialProgress: 100, frequency }, raw, today, initial(), 'questionnaire_draft');
    assert.equal(r.core.reason, 'COMPLETED'); assert.equal(r.completion.status, 'completed'); assert.equal(r.plan, null);
  }
  const r = evaluate({ ...goal, frequency: 'non_daily' }, [], today, initial(), 'questionnaire_draft');
  assert.equal(r.core.reason, 'NON_DAILY'); assert.equal(r.completion.reason, 'NON_DAILY'); assert.equal(r.plan, null);
});

test('safe boundary validation: malformed inputs, amounts, dates, duplicates, future, versions', () => {
  for (const bad of [0, -1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '10']) assert.throws(() => rebuildRaw([], today, { ...goal, totalRequired: bad }));
  for (const date of ['2026-02-29', '2026-02-30', '2026-9-01', 'garbage']) assert.throws(() => rebuildRaw([{ localDate: date, status: 'DONE', amount: 10 }], today, goal), /INVALID_DATE/);
  assert.throws(() => rebuildRaw(logs('DD'), '2026-09-01', goal), /FUTURE_DATE/);
  assert.throws(() => rebuildRaw([...logs('D'), ...logs('D')], today, goal), /DUPLICATE_DATE/);
  for (const [status, amount] of [['DONE', null], ['DONE', 0], ['DONE', .5], ['SKIPPED', 10], ['UNKNOWN', null]]) assert.throws(() => rebuildRaw([{ localDate: today, status, amount }], today, goal));
  assert.throws(() => rebuildRaw(logs('D'), today, { ...goal, initialProgress: Number.MAX_SAFE_INTEGER }), /AMOUNT_OVERFLOW/);
  for (const bad of [{ ...initial(), mappingVersion: 'v2' }, { ...initial(), schemaVersion: 2 }, { ...initial(), a: [6, 2] }, { ...initial(), sourceB: 'common' }, { ...initial(), revision: 0 }]) assert.throws(() => validateInitialPrior(bad, goal.actionSpec));
  assert.throws(() => validateInitialPrior(initial(), 'different-action'), /ACTION_SPEC_MISMATCH/);
  assert.throws(() => initial({ ...experienced, afterDone: 'optimistic_person' }), /INVALID_ANSWERS/);
  for (const s of [[.5, 3], [0, 2], [2, Infinity]]) assert.throws(() => posteriorFromRaw({ a: s, b: [2, 2] }, { dd: 0, ds: 0, sd: 0, ss: 0 }), /INVALID_SHAPE/);
  assert.throws(() => posteriorFromRaw(initial(), { dd: -1, ds: 0, sd: 0, ss: 0 }), /INVALID_COUNTS/);
  assert.throws(() => evaluate(goal, [], today, initial(), 'questionnaire_draft', { samples: 0, horizonDays: 10, seed: 1 }), /INVALID_CONFIG/);
});

test('exact alpha=1 and threshold quantiles; integer domain and explicit quantile bound', () => {
  assert.equal(betaGeometricQuantile([1, 3], 50), 3); assert.equal(betaGeometricQuantile([1, 3], 80), 12);
  assert.equal(betaGeometricQuantile([5, 5], 50), 1); assert.equal(betaGeometricQuantile([2, 2], 50), 1); assert.equal(betaGeometricQuantile([2, 2], 80), 3);
  for (const beta of [1, 3, 12, 1000, 5000]) for (const [q, factor] of [[50, 2], [80, 5]]) {
    assert.equal(betaGeometricQuantile([1, beta], q), (factor - 1) * beta); // independent telescoping survival beta/(beta+t)
    let t = 1; while (factor * beta * (beta + 1) > (beta + t) * (beta + t + 1)) t++;
    assert.equal(betaGeometricQuantile([2, beta], q), t);
  }
  assert.equal(betaGeometricQuantile([1, 3], 80, 5), null);
  assert.throws(() => betaGeometricQuantile([2, 2], 95), /INVALID_QUANTILE_CONFIG/);
});

test('strength sensitivity is explicit: 4 recedes faster than 8, no empirical ranking', () => {
  for (const n of [0, 1, 4, 12]) {
    assert.equal(priorWeight([3, 1], n), 4 / (4 + n)); assert.equal(priorWeight([6, 2], n), 8 / (8 + n));
    assert(priorWeight([3, 1], n) <= priorWeight([6, 2], n));
  }
  const c = { dd: 0, ds: 0, sd: 0, ss: 12 };
  assert.deepEqual(posteriorFromRaw({ a: [3, 1], b: [3, 1] }, c).b, [3, 13]);
  assert.deepEqual(posteriorFromRaw({ a: [6, 2], b: [6, 2] }, c).b, [6, 14]);
  assert.equal(betaGeometricQuantile([3, 13], 50), 4); assert.equal(betaGeometricQuantile([6, 14], 50), 2);
  for (const s of [[1, 3], [2, 2], [3, 1]]) for (const n of [1, 4, 12]) {
    assert(betaGeometricQuantile([s[0] + n, s[1]], 80) <= betaGeometricQuantile(s, 80));
    assert(betaGeometricQuantile([s[0], s[1] + n], 80) >= betaGeometricQuantile(s, 80));
  }
});

function enumerate(need, a, b, horizon, start) {
  const pmf = new Float64Array(horizon + 2);
  const walk = (d, last, n, mass) => {
    if (n >= need) { pmf[d] += mass; return; }
    if (d === horizon) { pmf[horizon + 1] += mass; return; }
    const p = last === 'D' ? a : b;
    walk(d + 1, 'D', n + 1, mass * p); walk(d + 1, 'S', n, mass * (1 - p));
  };
  walk(0, start, 0, 1); return pmf;
}
test('unchanged DP agrees with independent full path enumeration for all 9 s4 combinations and origins', () => {
  for (const a of [[3, 1], [2, 2], [1, 3]]) for (const b of [[3, 1], [2, 2], [1, 3]]) for (const start of ['D', 'S']) {
    const draws = drawsFromPosterior({ a, b }, 3); const expected = new Float64Array(10);
    for (const [pa, pb] of draws) enumerate(3, pa, pb, 8, start).forEach((mass, d) => expected[d] += mass / 3);
    const actual = completionPmf(3, draws, 8, start); const unpruned = completionPmf(3, draws, 8, start, false);
    actual.forEach((mass, d) => { assert(Math.abs(mass - expected[d]) < 1e-12); assert(Math.abs(mass - unpruned[d]) < 1e-12); });
  }
  assert.equal(quantileDays(completionPmf(1, [[.9999999995, .5], [1e-10, 1e-10]], 10), .5, 10), 3);
  assert.equal(quantileDays(completionPmf(11, [[.8, .5]], 10), .5, 10), null);
});

test('determinism, amount invariance of core and completion monotonicity', () => {
  const p = initial(); const r = evaluate(goal, logs('DSD'), today, p, 'questionnaire_draft');
  assert.deepEqual(evaluate(goal, logs('DSD'), today, p, 'questionnaire_draft'), r);
  const larger = evaluate({ ...goal, totalRequired: 120 }, logs('DSD'), today, p, 'questionnaire_draft');
  assert.equal(larger.core.g50, r.core.g50); assert(larger.completion.p50Days >= r.completion.p50Days);
  const progress = evaluate({ ...goal, initialProgress: 20 }, logs('DSD'), today, p, 'questionnaire_draft');
  assert.equal(progress.core.g50, r.core.g50); assert(progress.completion.p50Days <= r.completion.p50Days);
});

test('historical580 provenance: recorded count matches individual checks and original DP copy', () => {
  const raw = JSON.parse(fs.readFileSync(new URL('../historical/results/raw.json', import.meta.url)));
  const summary = JSON.parse(fs.readFileSync(new URL('../historical/results/summary.json', import.meta.url)));
  assert.equal(raw.assertions, 580); assert.equal(raw.checks.length, 580); assert(raw.checks.every(c => c.pass === true)); assert.equal(summary.assertions, 580);
  const data = fs.readFileSync(new URL('../reference/completion-dp.mjs', import.meta.url));
  assert.equal(createHash('sha256').update(data).digest('hex'), raw.environment.sources['completion-dp.mjs'].sha256);
  assert.equal(raw.recoveryCaveat, 'Independent origin stress counts, not necessarily jointly realizable as one raw chronology. Not actual observed logs.');
});
