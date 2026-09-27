import { test } from "node:test";
import assert from "node:assert/strict";
import {
  features,
  formalContext,
  runSyntheticEvaluation,
} from "../scripts/ml-synthetic-evaluation.ts";

const smallRun = () =>
  runSyntheticEvaluation({
    generatedAt: "2026-09-27T00:00:00.000Z",
    commit: "test-commit",
    calibrationSeeds: [41001, 41002],
    finalSeeds: [91001, 91002, 91003],
  });

test("formal context uses intercept first and negative normalized distances", () => {
  const context = formalContext(
    [0.2, 0.8, 0.5, 0.9, 0.1, 0.4, 0.7],
    [0.1, 0.7, 0.9, 0.2, 0.3, 0.4, 0.0],
  );
  assert.equal(context.length, 8);
  assert.equal(context[0], 1 / Math.sqrt(8));
  assert.ok(context.slice(1).every((value) => value <= 0));
  assert.ok(Math.abs(context[1] - -0.1 / Math.sqrt(8)) < 1e-12);
  assert.ok(Math.abs(context[4] - -0.7 / Math.sqrt(8)) < 1e-12);
});

test("synthetic evaluation is deterministic for fixed seeds", () => {
  assert.deepEqual(smallRun(), smallRun());
});

test("evaluation keeps valid interactions separate from reward observations", () => {
  const result = smallRun();
  assert.equal(result.final.byScenarioPolicy.length, 6 * 3);
  for (const row of result.final.byScenarioPolicy) {
    assert.equal(row.validInteractions.max <= 5, true);
    assert.equal(row.rewardObservations.max <= row.validInteractions.max, true);
  }
  const unsureRows = result.final.byScenarioPolicy.filter(
    (row) => row.scenarioId === "unsure_heavy",
  );
  assert.equal(unsureRows.length, 3);
  assert.ok(
    unsureRows.some(
      (row) => row.rewardObservations.median < row.validInteractions.median,
    ),
  );
});

test("constraint detection reports injected hard-constraint examples", () => {
  const result = smallRun();
  const detected = new Set(
    result.hardConstraintDetection.injectedFixtureDetectedTypes,
  );
  assert.ok(detected.has("DUPLICATE_RECORDING"));
  assert.ok(detected.has("SAVED_CONTEXT_MISMATCH"));
  assert.ok(detected.has("ILLEGAL_FALLBACK_AFTER_BLOCKED_CATALOG"));
  assert.equal(
    Object.keys(result.hardConstraintDetection.finalPolicyRunViolationCounts)
      .length,
    0,
  );
});

test("all seven visible feature names are represented in hypothesis output", () => {
  const result = smallRun();
  const names = Object.keys(
    result.final.byScenarioPolicy[0].hypothesisClassificationsExample,
  );
  assert.deepEqual(names, [...features]);
});
