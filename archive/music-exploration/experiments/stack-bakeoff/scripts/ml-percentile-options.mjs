#!/usr/bin/env node
// Issue #57: synthetic comparison only. This file does not define a production transform.
import assert from 'node:assert/strict';

const features = [
  'danceability', 'energy', 'valence', 'tempo',
  'acousticness', 'speechiness', 'instrumentalness',
];
const rows = [
  { id: 'A', values: [0.2, 0.4, 0.5, 100, 0.3, 0.1, 0.0] },
  { id: 'B', values: [0.2, 0.6, 0.5, 110, 0.3, 0.2, 0.0] },
  { id: 'C', values: [0.2, 0.8, 0.7, 120, 0.4, 0.1, 0.1] },
  { id: 'D', values: [0.8, 0.8, 0.9, 130, 0.6, 0.4, 0.2] },
  { id: 'E', values: [0.5, 0.5, 0.6, 125, 0.5, 0.3, 0.1] },
];
const referenceV1 = rows.slice(0, 4);
const referenceV2 = rows;
const policies = ['lower', 'mid', 'upper'];

function validate(values) {
  if (!Array.isArray(values) || values.length !== features.length ||
      values.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new TypeError('A complete, finite seven-feature vector is required');
  }
}

function percentile(reference, featureIndex, value, policy) {
  if (!policies.includes(policy)) throw new RangeError('Unknown comparison policy');
  for (const row of reference) validate(row.values);
  if (reference.length === 0) throw new RangeError('Empty reference');
  if (!Number.isFinite(value)) throw new TypeError('Query feature must be finite');
  const less = reference.filter((row) => row.values[featureIndex] < value).length;
  const equal = reference.filter((row) => row.values[featureIndex] === value).length;
  const weight = { lower: 0, mid: 0.5, upper: 1 }[policy];
  return (less + weight * equal) / reference.length;
}

function transform(reference, values, policy) {
  validate(values);
  return values.map((value, index) => percentile(reference, index, value, policy));
}

function context(seed, candidate) {
  return [1, ...seed.map((value, index) => -Math.abs(value - candidate[index]))]
    .map((value) => value / Math.sqrt(8));
}

function norm(values) {
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
}

function oneLikePosterior(contextVector) {
  return {
    B: contextVector.flatMap((a, row) => contextVector.map((b, col) =>
      (row === col ? 1 : 0) + a * b)),
    f: contextVector,
  };
}

function round(value) {
  return Number(value.toFixed(6));
}

function rounded(values) {
  return values.map(round);
}

function invalidCase(values) {
  try {
    transform(referenceV1, values, 'mid');
    throw new Error('Expected a validation error');
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return error.message;
  }
}

// Independent hand calculations for the tied feature and outside-range queries.
assert.equal(percentile(referenceV1, 0, 0.2, 'lower'), 0);
assert.equal(percentile(referenceV1, 0, 0.2, 'mid'), 0.375);
assert.equal(percentile(referenceV1, 0, 0.2, 'upper'), 0.75);
assert.equal(percentile(referenceV1, 0, 0.8, 'mid'), 0.875);
assert.equal(percentile(referenceV2, 0, 0.2, 'mid'), 0.3);
assert.equal(percentile(referenceV2, 0, 0.8, 'mid'), 0.9);
assert.ok(Math.abs(context(
  transform(referenceV2, rows[0].values, 'mid'),
  transform(referenceV2, rows[3].values, 'mid'),
)[1] + 0.6 / Math.sqrt(8)) < 1e-12);
for (const policy of policies) {
  assert.equal(percentile(referenceV1, 3, 90, policy), 0);
  assert.equal(percentile(referenceV1, 3, 140, policy), 1);
  assert.ok(transform(referenceV1, rows[0].values, policy)
    .every((value) => value >= 0 && value <= 1));
}

const byPolicy = Object.fromEntries(policies.map((policy) => {
  const seedV1 = transform(referenceV1, rows[0].values, policy);
  const candidateV1 = transform(referenceV1, rows[3].values, policy);
  const seedV2 = transform(referenceV2, rows[0].values, policy);
  const candidateV2 = transform(referenceV2, rows[3].values, policy);
  const contextV1 = context(seedV1, candidateV1);
  const contextV2 = context(seedV2, candidateV2);
  const posteriorV1 = oneLikePosterior(contextV1);
  const posteriorV2 = oneLikePosterior(contextV2);
  return [policy, {
    seedQv1: rounded(seedV1), candidateQv1: rounded(candidateV1),
    contextV1: rounded(contextV1),
    seedQv2: rounded(seedV2), candidateQv2: rounded(candidateV2),
    contextV2: rounded(contextV2),
    contextDriftL2: round(norm(contextV1.map((value, index) => value - contextV2[index]))),
    oneLikeBDriftFrobenius: round(norm(posteriorV1.B.map((value, index) =>
      value - posteriorV2.B[index]))),
    oneLikeFDriftL2: round(norm(posteriorV1.f.map((value, index) =>
      value - posteriorV2.f[index]))),
  }];
}));

assert.notDeepEqual(byPolicy.lower.contextV1, byPolicy.mid.contextV1);
assert.notDeepEqual(byPolicy.mid.contextV1, byPolicy.upper.contextV1);
assert.ok(byPolicy.mid.contextDriftL2 > 0);

console.log(JSON.stringify({
  fixture: { features, referenceV1: referenceV1.map((row) => row.id),
    referenceV2: referenceV2.map((row) => row.id), seed: 'A', candidate: 'D', reward: 'LIKE (+1)' },
  formulas: { lower: 'L/N', mid: '(L + E/2)/N', upper: '(L + E)/N',
    counts: 'L = reference values < query; E = reference values = query' },
  tieExample: { feature: 'danceability', query: 0.2, less: 0, equal: 3,
    lower: 0, mid: 0.375, upper: 0.75 },
  outsideReference: { feature: 'tempo', belowMinimum: 90, qBelow: 0,
    aboveMaximum: 140, qAbove: 1 },
  invalidSyntheticInputs: {
    missing: invalidCase(rows[0].values.slice(0, 6)),
    nan: invalidCase([...rows[0].values.slice(0, 6), Number.NaN]),
  },
  policies: byPolicy,
}, null, 2));
