import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const features = [
  "danceability",
  "energy",
  "valence",
  "tempo",
  "acousticness",
  "speechiness",
  "instrumentalness",
] as const;

export const dimension = 8;
const sqrtDimension = Math.sqrt(dimension);
const epsilon = 1e-10;

export const versions = {
  catalogVersion: "synthetic-catalog-v1.issue-40",
  featureReferenceVersion: "percentile-7d-synthetic-v1",
  contextVersion: "formal-negative-distance-v1",
  modelVersion: "gaussian-lints-b0-i-f0-0-noise1-v1",
  policyVersion: "issue-40-policy-comparison-v1",
  syntheticUserModelVersion: "issue-40-six-scenarios-v1",
};

export type PolicyId =
  "nearest-seed" | "greedy-bayesian-linear" | "gaussian-lints";

export const policies: PolicyId[] = [
  "nearest-seed",
  "greedy-bayesian-linear",
  "gaussian-lints",
];

export type ScenarioId =
  | "model_matched_linear"
  | "noisy_ordinal"
  | "multi_modal"
  | "hidden_feature"
  | "outlier_seed"
  | "unsure_heavy";

type Rating = "LIKE" | "NEUTRAL" | "DISLIKE" | "UNSURE";
type CandidateType = "RELEVANT" | "PROBE";
type FeatureTruth = "similarity" | "contrast" | "low" | "unknown";

export interface ThresholdConfig {
  id: string;
  description: string;
  relevantKPerSeed: number;
  relevantMaxDistance: number;
  probeOtherMaxDistance: number;
  probeMinContrast: number;
  candidatePoolLimit: number;
  rope: number;
  credibleLevel: 0.8 | 0.9 | 0.95;
}

export const thresholdCandidates: ThresholdConfig[] = [
  {
    id: "strict-candidate",
    description:
      "Higher relevance/probe bars, wider ROPE, 95% interval. Intended to surface shortage and under-classification.",
    relevantKPerSeed: 6,
    relevantMaxDistance: 0.95,
    probeOtherMaxDistance: 0.42,
    probeMinContrast: 0.4,
    candidatePoolLimit: 14,
    rope: 0.16,
    credibleLevel: 0.95,
  },
  {
    id: "balanced-candidate",
    description:
      "Issue #40 descriptive default. Calibration candidate only; not an accepted threshold.",
    relevantKPerSeed: 9,
    relevantMaxDistance: 1.2,
    probeOtherMaxDistance: 0.58,
    probeMinContrast: 0.32,
    candidatePoolLimit: 20,
    rope: 0.1,
    credibleLevel: 0.9,
  },
  {
    id: "loose-candidate",
    description:
      "Larger pools and narrower ROPE. Intended to test false certainty sensitivity.",
    relevantKPerSeed: 12,
    relevantMaxDistance: 1.55,
    probeOtherMaxDistance: 0.78,
    probeMinContrast: 0.23,
    candidatePoolLimit: 28,
    rope: 0.05,
    credibleLevel: 0.8,
  },
];

const finalThreshold = thresholdCandidates[1];

export interface EvaluationOptions {
  calibrationTrialsPerScenario?: number;
  finalTrialsPerScenario?: number;
  calibrationSeeds?: number[];
  finalSeeds?: number[];
  generatedAt?: string;
  commit?: string;
}

interface Rng {
  next(): number;
  normal(): number;
  int(maxExclusive: number): number;
}

export function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  let spare: number | undefined;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(maxExclusive) {
      return Math.floor(next() * maxExclusive);
    },
    normal() {
      if (spare !== undefined) {
        const value = spare;
        spare = undefined;
        return value;
      }
      const u = Math.max(Number.EPSILON, next());
      const v = next();
      const radius = Math.sqrt(-2 * Math.log(u));
      const angle = 2 * Math.PI * v;
      spare = radius * Math.sin(angle);
      return radius * Math.cos(angle);
    },
  };
}

function hashSeed(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const mean = (values: number[]) =>
  values.length === 0 ? 0 : sum(values) / values.length;
const dot = (a: number[], b: number[]) => sum(a.map((x, i) => x * b[i]));
const l1 = (a: number[], b: number[], skip?: number) =>
  sum(a.map((x, i) => (i === skip ? 0 : Math.abs(x - b[i]))));

export function formalContext(candidate: number[], anchor: number[]) {
  if (candidate.length !== 7 || anchor.length !== 7)
    throw new Error("context requires seven features");
  const distances = candidate.map((value, index) => {
    const distance = Math.abs(value - anchor[index]);
    if (!Number.isFinite(distance)) throw new Error("invalid feature value");
    return -distance / sqrtDimension;
  });
  return [1 / sqrtDimension, ...distances];
}

interface Posterior {
  B: number[][];
  f: number[];
  observations: number;
}

function prior(): Posterior {
  return {
    B: Array.from({ length: dimension }, (_, i) =>
      Array.from({ length: dimension }, (_, j) => (i === j ? 1 : 0)),
    ),
    f: Array(dimension).fill(0),
    observations: 0,
  };
}

function clonePosterior(posterior: Posterior): Posterior {
  return {
    B: posterior.B.map((row) => [...row]),
    f: [...posterior.f],
    observations: posterior.observations,
  };
}

function updatePosterior(
  posterior: Posterior,
  context: number[],
  reward: number,
) {
  if (
    context.length !== dimension ||
    !context.every(Number.isFinite) ||
    !Number.isFinite(reward)
  )
    throw new Error("invalid posterior update");
  for (let i = 0; i < dimension; i++) {
    posterior.f[i] += context[i] * reward;
    for (let j = 0; j < dimension; j++) {
      posterior.B[i][j] += context[i] * context[j];
    }
  }
  posterior.observations++;
}

function cholesky(matrix: number[][]) {
  const lower = matrix.map((row) => row.map(() => 0));
  for (let i = 0; i < dimension; i++) {
    for (let j = 0; j <= i; j++) {
      let value = matrix[i][j];
      for (let k = 0; k < j; k++) value -= lower[i][k] * lower[j][k];
      lower[i][j] =
        i === j ? Math.sqrt(Math.max(value, 0)) : value / lower[j][j];
      if (!Number.isFinite(lower[i][j]) || lower[i][i] < 0)
        throw new Error("posterior is not positive definite");
    }
  }
  return lower;
}

function solveLower(lower: number[][], b: number[]) {
  const x = [...b];
  for (let i = 0; i < dimension; i++) {
    for (let j = 0; j < i; j++) x[i] -= lower[i][j] * x[j];
    x[i] /= lower[i][i];
  }
  return x;
}

function solveUpperFromLower(lower: number[][], b: number[]) {
  const x = [...b];
  for (let i = dimension - 1; i >= 0; i--) {
    for (let j = i + 1; j < dimension; j++) x[i] -= lower[j][i] * x[j];
    x[i] /= lower[i][i];
  }
  return x;
}

function posteriorMean(posterior: Posterior) {
  const lower = cholesky(posterior.B);
  return solveUpperFromLower(lower, solveLower(lower, posterior.f));
}

function sampleTheta(posterior: Posterior, rng: Rng) {
  const lower = cholesky(posterior.B);
  const mu = solveUpperFromLower(lower, solveLower(lower, posterior.f));
  const noise = solveUpperFromLower(
    lower,
    Array.from({ length: dimension }, () => rng.normal()),
  );
  return mu.map((value, index) => value + noise[index]);
}

function inverseDiagonal(posterior: Posterior) {
  const lower = cholesky(posterior.B);
  return Array.from({ length: dimension }, (_, index) => {
    const unit = Array(dimension).fill(0);
    unit[index] = 1;
    const column = solveUpperFromLower(lower, solveLower(lower, unit));
    return column[index];
  });
}

interface Scenario {
  id: ScenarioId;
  name: string;
  description: string;
  theta: number[];
  featureTruth: FeatureTruth[];
  utilityScale: number;
  noiseScale: number;
  likeThreshold: number;
  dislikeThreshold: number;
  uncertaintyBand: number;
  unsureRate: number;
  responseFlipRate: number;
  playbackFailureRate: number;
  feedbacklessSkipRate: number;
}

const scenarios: Scenario[] = [
  {
    id: "model_matched_linear",
    name: "Model-matched Linear",
    description:
      "Formal phi(c,s) with a fixed visible theta and small Gaussian noise.",
    theta: [0.15, 1.25, 0.95, 0.55, 0.25, -0.7, 0.25, 0.1],
    featureTruth: [
      "similarity",
      "similarity",
      "similarity",
      "similarity",
      "contrast",
      "similarity",
      "similarity",
    ],
    utilityScale: 2.1,
    noiseScale: 0.08,
    likeThreshold: 0.05,
    dislikeThreshold: -0.16,
    uncertaintyBand: 0.035,
    unsureRate: 0.03,
    responseFlipRate: 0.02,
    playbackFailureRate: 0.01,
    feedbacklessSkipRate: 0.01,
  },
  {
    id: "noisy_ordinal",
    name: "Noisy / Ordinal",
    description:
      "Visible linear utility is converted to ordinal feedback with answer mistakes.",
    theta: [0.05, 0.95, 0.7, 0.25, -0.45, -0.4, 0.15, 0.05],
    featureTruth: [
      "similarity",
      "similarity",
      "similarity",
      "contrast",
      "contrast",
      "similarity",
      "low",
    ],
    utilityScale: 1.8,
    noiseScale: 0.2,
    likeThreshold: 0.12,
    dislikeThreshold: -0.18,
    uncertaintyBand: 0.06,
    unsureRate: 0.08,
    responseFlipRate: 0.08,
    playbackFailureRate: 0.01,
    feedbacklessSkipRate: 0.02,
  },
  {
    id: "multi_modal",
    name: "Multi-modal",
    description:
      "Two seed prototypes are useful, while a single averaged taste would hide one mode.",
    theta: [0.08, 0.9, 0.8, 0.35, 0.2, -0.55, 0.35, 0.1],
    featureTruth: [
      "similarity",
      "similarity",
      "similarity",
      "similarity",
      "contrast",
      "similarity",
      "low",
    ],
    utilityScale: 1.6,
    noiseScale: 0.11,
    likeThreshold: 0.04,
    dislikeThreshold: -0.17,
    uncertaintyBand: 0.045,
    unsureRate: 0.04,
    responseFlipRate: 0.03,
    playbackFailureRate: 0.01,
    feedbacklessSkipRate: 0.02,
  },
  {
    id: "hidden_feature",
    name: "Hidden feature",
    description:
      "Utility is dominated by a hidden vocal/context value unavailable to the policy.",
    theta: [0.02, 0.12, 0.08, 0.04, 0.04, 0.04, 0.04, 0.04],
    featureTruth: ["low", "low", "low", "low", "low", "low", "low"],
    utilityScale: 0.7,
    noiseScale: 0.12,
    likeThreshold: 0.16,
    dislikeThreshold: -0.12,
    uncertaintyBand: 0.05,
    unsureRate: 0.05,
    responseFlipRate: 0.03,
    playbackFailureRate: 0.01,
    feedbacklessSkipRate: 0.02,
  },
  {
    id: "outlier_seed",
    name: "Outlier Seed",
    description:
      "One seed is an exception; candidates around that prototype tend to be low utility.",
    theta: [0.1, 0.85, 0.8, 0.5, 0.25, -0.5, 0.2, 0.1],
    featureTruth: [
      "similarity",
      "similarity",
      "similarity",
      "similarity",
      "contrast",
      "similarity",
      "low",
    ],
    utilityScale: 1.8,
    noiseScale: 0.12,
    likeThreshold: 0.05,
    dislikeThreshold: -0.15,
    uncertaintyBand: 0.045,
    unsureRate: 0.04,
    responseFlipRate: 0.03,
    playbackFailureRate: 0.02,
    feedbacklessSkipRate: 0.03,
  },
  {
    id: "unsure_heavy",
    name: "UNSURE-heavy",
    description:
      "Many accepted interactions are UNSURE, reducing reward observations before checkpoint.",
    theta: [0.08, 0.9, 0.75, 0.35, 0.2, -0.45, 0.2, 0.05],
    featureTruth: [
      "similarity",
      "similarity",
      "similarity",
      "similarity",
      "contrast",
      "similarity",
      "low",
    ],
    utilityScale: 1.5,
    noiseScale: 0.17,
    likeThreshold: 0.07,
    dislikeThreshold: -0.17,
    uncertaintyBand: 0.11,
    unsureRate: 0.33,
    responseFlipRate: 0.04,
    playbackFailureRate: 0.03,
    feedbacklessSkipRate: 0.05,
  },
];

interface Track {
  id: string;
  recordingKey: string;
  features: number[];
  hidden: number;
  prototype: "alpha" | "beta" | "gamma" | "random";
  playbackEligible: boolean;
  isSeed: boolean;
}

interface Fixture {
  scenario: Scenario;
  seed: number;
  seeds: Track[];
  catalog: Track[];
}

const seedBases = [
  [0.22, 0.74, 0.68, 0.36, 0.24, 0.16, 0.38],
  [0.72, 0.32, 0.34, 0.78, 0.62, 0.28, 0.18],
  [0.92, 0.88, 0.16, 0.18, 0.82, 0.74, 0.84],
];

const prototypes = ["alpha", "beta", "gamma"] as const;

function jitter(base: number[], rng: Rng, spread: number) {
  return base.map((value) => clamp01(value + rng.normal() * spread));
}

function makeTrack(
  id: string,
  recordingKey: string,
  featuresValue: number[],
  prototype: Track["prototype"],
  rng: Rng,
  playbackEligible: boolean,
  isSeed = false,
): Track {
  const hiddenBias =
    prototype === "alpha" ? 0.66 : prototype === "beta" ? 0.54 : 0.35;
  return {
    id,
    recordingKey,
    features: featuresValue,
    prototype,
    hidden: clamp01(hiddenBias + rng.normal() * 0.18),
    playbackEligible,
    isSeed,
  };
}

function createFixture(scenario: Scenario, seed: number): Fixture {
  const rng = makeRng(hashSeed(`${scenario.id}:catalog:${seed}`));
  const seeds = seedBases.map((base, index) =>
    makeTrack(
      `seed-${prototypes[index]}`,
      `recording:seed-${prototypes[index]}`,
      base,
      prototypes[index],
      rng,
      true,
      true,
    ),
  );
  const catalog: Track[] = [...seeds];
  const clusterSize = scenario.id === "outlier_seed" ? 5 : 9;
  for (const [prototypeIndex, base] of seedBases.entries()) {
    for (let n = 0; n < clusterSize; n++) {
      const prototype = prototypes[prototypeIndex];
      const outlierPlaybackPenalty =
        scenario.id === "outlier_seed" && prototype === "gamma" ? 0.25 : 0;
      catalog.push(
        makeTrack(
          `${scenario.id}-${prototype}-near-${n}`,
          `recording:${scenario.id}-${prototype}-near-${n}`,
          jitter(base, rng, scenario.id === "outlier_seed" ? 0.095 : 0.12),
          prototype,
          rng,
          rng.next() > 0.06 + outlierPlaybackPenalty,
        ),
      );
    }
    for (let k = 0; k < features.length; k += 2) {
      const direction = rng.next() < 0.5 ? -1 : 1;
      const values = jitter(base, rng, 0.055);
      values[k] = clamp01(values[k] + direction * (0.36 + rng.next() * 0.24));
      catalog.push(
        makeTrack(
          `${scenario.id}-${prototypes[prototypeIndex]}-probe-${k}`,
          `recording:${scenario.id}-${prototypes[prototypeIndex]}-probe-${k}`,
          values,
          prototypes[prototypeIndex],
          rng,
          rng.next() > 0.04,
        ),
      );
    }
  }
  for (let n = 0; n < 12; n++) {
    const values = Array.from({ length: 7 }, () => rng.next());
    const prototype = prototypes[rng.int(prototypes.length)];
    const track = makeTrack(
      `${scenario.id}-random-${n}`,
      `recording:${scenario.id}-random-${n}`,
      values,
      prototype,
      rng,
      rng.next() > 0.11,
    );
    if (scenario.id === "hidden_feature" && n < 5) {
      track.hidden = 0.92 + rng.next() * 0.08;
      track.prototype = n % 2 === 0 ? "alpha" : "beta";
    }
    catalog.push(track);
  }
  const duplicateSource = catalog.find((track) => !track.isSeed)!;
  catalog.push({
    ...duplicateSource,
    id: `${duplicateSource.id}-duplicate-id`,
  });
  return { scenario, seed, seeds, catalog };
}

interface PoolCandidate {
  track: Track;
  candidateType: CandidateType;
  anchor?: Track;
  probeFeature?: number;
  generationDistance: number;
  targetDiff?: number;
  otherDistance?: number;
}

interface PoolResult {
  relevant: PoolCandidate[];
  probe: PoolCandidate[];
  excludedCounts: Record<string, number>;
}

interface TrialState {
  posterior: Posterior;
  validInteractions: number;
  rewardObservations: number;
  attempts: number;
  probeCount: number;
  previousCandidateType?: CandidateType;
  selectedRecordingKeys: Set<string>;
  attemptedRecordingKeys: Set<string>;
}

function eligibleCandidates(fixture: Fixture, state: TrialState) {
  const excludedCounts: Record<string, number> = {
    seed: 0,
    recording_excluded: 0,
    playback_unavailable: 0,
    invalid_feature: 0,
    duplicate_recording_in_pool: 0,
  };
  const seen = new Set<string>();
  const candidates: Track[] = [];
  for (const track of fixture.catalog) {
    if (track.isSeed) {
      excludedCounts.seed++;
      continue;
    }
    if (state.attemptedRecordingKeys.has(track.recordingKey)) {
      excludedCounts.recording_excluded++;
      continue;
    }
    if (!track.playbackEligible) {
      excludedCounts.playback_unavailable++;
      continue;
    }
    if (
      track.features.length !== 7 ||
      !track.features.every((value) => Number.isFinite(value))
    ) {
      excludedCounts.invalid_feature++;
      continue;
    }
    if (seen.has(track.recordingKey)) {
      excludedCounts.duplicate_recording_in_pool++;
      continue;
    }
    seen.add(track.recordingKey);
    candidates.push(track);
  }
  return { candidates, excludedCounts };
}

function buildPools(
  fixture: Fixture,
  state: TrialState,
  config: ThresholdConfig,
): PoolResult {
  const { candidates, excludedCounts } = eligibleCandidates(fixture, state);
  const relevantByRecording = new Map<string, PoolCandidate>();
  for (const seed of fixture.seeds) {
    const nearest = candidates
      .map((track) => ({
        track,
        distance: l1(track.features, seed.features),
      }))
      .filter((candidate) => candidate.distance <= config.relevantMaxDistance)
      .sort(
        (a, b) =>
          a.distance - b.distance || a.track.id.localeCompare(b.track.id),
      )
      .slice(0, config.relevantKPerSeed);
    for (const candidate of nearest) {
      const existing = relevantByRecording.get(candidate.track.recordingKey);
      if (!existing || candidate.distance < existing.generationDistance) {
        relevantByRecording.set(candidate.track.recordingKey, {
          track: candidate.track,
          candidateType: "RELEVANT",
          anchor: seed,
          generationDistance: candidate.distance,
        });
      }
    }
  }
  const probeByRecording = new Map<string, PoolCandidate>();
  if (state.validInteractions > 0 && state.probeCount < 2) {
    for (const track of candidates) {
      for (const seed of fixture.seeds) {
        for (
          let featureIndex = 0;
          featureIndex < features.length;
          featureIndex++
        ) {
          const otherDistance = l1(track.features, seed.features, featureIndex);
          const targetDiff = Math.abs(
            track.features[featureIndex] - seed.features[featureIndex],
          );
          if (
            otherDistance <= config.probeOtherMaxDistance &&
            targetDiff >= config.probeMinContrast
          ) {
            const generationDistance = otherDistance - targetDiff;
            const existing = probeByRecording.get(track.recordingKey);
            if (!existing || generationDistance < existing.generationDistance) {
              probeByRecording.set(track.recordingKey, {
                track,
                candidateType: "PROBE",
                anchor: seed,
                probeFeature: featureIndex,
                generationDistance,
                otherDistance,
                targetDiff,
              });
            }
          }
        }
      }
    }
  }
  const relevant = [...relevantByRecording.values()]
    .sort(
      (a, b) =>
        a.generationDistance - b.generationDistance ||
        a.track.id.localeCompare(b.track.id),
    )
    .slice(0, config.candidatePoolLimit);
  const probe = [...probeByRecording.values()]
    .sort(
      (a, b) =>
        a.generationDistance - b.generationDistance ||
        a.track.id.localeCompare(b.track.id),
    )
    .slice(0, config.candidatePoolLimit);
  return { relevant, probe, excludedCounts };
}

interface Decision {
  blocked?: true;
  blockedReason?: "BLOCKED_CATALOG";
  allowedCounts: {
    relevant: number;
    probe: number;
    allowed: number;
    eligible: number;
  };
  excludedCounts: Record<string, number>;
  track?: Track;
  anchor?: Track;
  candidateType?: CandidateType;
  probeFeature?: number;
  context?: number[];
  theta?: number[];
  score?: number;
  guardrailRelaxed?: string;
}

function chooseRelevantAnchor(track: Track, seeds: Track[], theta?: number[]) {
  if (!theta) {
    return seeds
      .map((seed) => ({
        seed,
        distance: l1(track.features, seed.features),
      }))
      .sort(
        (a, b) => a.distance - b.distance || a.seed.id.localeCompare(b.seed.id),
      )[0].seed;
  }
  return seeds
    .map((seed) => ({
      seed,
      context: formalContext(track.features, seed.features),
    }))
    .map((candidate) => ({
      ...candidate,
      score: dot(candidate.context, theta),
    }))
    .sort((a, b) => b.score - a.score || a.seed.id.localeCompare(b.seed.id))[0]
    .seed;
}

function selectDecision(
  fixture: Fixture,
  state: TrialState,
  config: ThresholdConfig,
  policy: PolicyId,
  rng: Rng,
): Decision {
  const pools = buildPools(fixture, state, config);
  const mayProbe =
    state.validInteractions > 0 &&
    state.probeCount < 2 &&
    state.previousCandidateType !== "PROBE";
  const relaxedProbe =
    state.validInteractions > 0 &&
    state.probeCount < 2 &&
    state.previousCandidateType === "PROBE" &&
    pools.relevant.length === 0;
  const allowedProbe = mayProbe || relaxedProbe ? pools.probe : [];
  const allowed =
    state.validInteractions === 0
      ? pools.relevant
      : [...pools.relevant, ...allowedProbe];
  const allowedCounts = {
    relevant: pools.relevant.length,
    probe: pools.probe.length,
    allowed: allowed.length,
    eligible:
      pools.relevant.length +
      pools.probe.length +
      pools.excludedCounts.playback_unavailable +
      pools.excludedCounts.recording_excluded,
  };
  if (allowed.length === 0) {
    return {
      blocked: true,
      blockedReason: "BLOCKED_CATALOG",
      allowedCounts,
      excludedCounts: pools.excludedCounts,
    };
  }
  const theta =
    policy === "nearest-seed"
      ? undefined
      : policy === "greedy-bayesian-linear"
        ? posteriorMean(state.posterior)
        : sampleTheta(state.posterior, rng);
  const scored = allowed.map((candidate) => {
    const anchor =
      candidate.candidateType === "RELEVANT"
        ? chooseRelevantAnchor(candidate.track, fixture.seeds, theta)
        : candidate.anchor!;
    const context = formalContext(candidate.track.features, anchor.features);
    const score =
      policy === "nearest-seed"
        ? -l1(candidate.track.features, anchor.features)
        : dot(context, theta!);
    return { ...candidate, anchor, context, score };
  });
  const chosen = scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.generationDistance - b.generationDistance ||
      a.track.id.localeCompare(b.track.id),
  )[0];
  return {
    allowedCounts,
    excludedCounts: pools.excludedCounts,
    track: chosen.track,
    anchor: chosen.anchor,
    candidateType: chosen.candidateType,
    probeFeature: chosen.probeFeature,
    context: chosen.context,
    theta,
    score: chosen.score,
    guardrailRelaxed: relaxedProbe
      ? "PROBE_CONSECUTIVE_RELAXED_RELEVANT_EMPTY"
      : undefined,
  };
}

function expectedUtility(scenario: Scenario, track: Track, anchor: Track) {
  const context = formalContext(track.features, anchor.features);
  const visible = dot(scenario.theta, context) * scenario.utilityScale;
  if (scenario.id === "multi_modal") {
    const alpha = 1 - l1(track.features, seedBases[0]) / 7;
    const beta = 1 - l1(track.features, seedBases[1]) / 7;
    const gammaPenalty = track.prototype === "gamma" ? -0.35 : 0;
    return Math.max(alpha, beta) - 0.73 + gammaPenalty;
  }
  if (scenario.id === "hidden_feature") {
    return visible + (track.hidden - 0.55) * 1.45;
  }
  if (scenario.id === "outlier_seed") {
    return visible + (track.prototype === "gamma" ? -0.42 : 0.08);
  }
  return visible;
}

function applyResponseNoise(scenario: Scenario, utility: number, rng: Rng) {
  return utility + rng.normal() * scenario.noiseScale;
}

function ratingFromUtility(
  scenario: Scenario,
  utility: number,
  rng: Rng,
): Rating {
  if (
    Math.abs(utility) <= scenario.uncertaintyBand ||
    rng.next() < scenario.unsureRate
  )
    return "UNSURE";
  let rating: Rating =
    utility >= scenario.likeThreshold
      ? "LIKE"
      : utility <= scenario.dislikeThreshold
        ? "DISLIKE"
        : "NEUTRAL";
  if (rng.next() < scenario.responseFlipRate) {
    rating =
      rating === "LIKE" ? "NEUTRAL" : rating === "DISLIKE" ? "NEUTRAL" : "LIKE";
  }
  return rating;
}

const reward = (rating: Rating) =>
  rating === "LIKE" ? 1 : rating === "DISLIKE" ? -1 : 0;

function bestOracleUtility(
  fixture: Fixture,
  state: TrialState,
  config: ThresholdConfig,
  theta?: number[],
) {
  const pools = buildPools(fixture, state, config);
  const allowed =
    state.validInteractions === 0
      ? pools.relevant
      : [
          ...pools.relevant,
          ...(state.probeCount < 2 &&
          (state.previousCandidateType !== "PROBE" ||
            pools.relevant.length === 0)
            ? pools.probe
            : []),
        ];
  if (allowed.length === 0) return undefined;
  return Math.max(
    ...allowed.map((candidate) => {
      const anchor =
        candidate.candidateType === "RELEVANT"
          ? chooseRelevantAnchor(candidate.track, fixture.seeds, theta)
          : candidate.anchor!;
      return expectedUtility(fixture.scenario, candidate.track, anchor);
    }),
  );
}

interface TrialEvent {
  attempt: number;
  validInteractionBefore: number;
  kind:
    | "RECOMMENDATION"
    | "PLAYBACK_FAILURE"
    | "FEEDBACKLESS_SKIP"
    | "BLOCKED_CATALOG";
  trackId?: string;
  recordingKey?: string;
  anchorId?: string;
  candidateType?: CandidateType;
  probeFeature?: string;
  context?: number[];
  score?: number;
  rating?: Rating;
  rewardObserved?: boolean;
  utility?: number;
  regret?: number;
  candidateCounts: Decision["allowedCounts"];
  excludedCounts: Record<string, number>;
  guardrailRelaxed?: string;
}

interface ConstraintViolation {
  type:
    | "DUPLICATE_RECORDING"
    | "UNAVAILABLE_PLAYBACK"
    | "INVALID_FEATURE_OR_CONTEXT"
    | "PROBE_LIMIT_BREACH"
    | "SAVED_CONTEXT_MISMATCH"
    | "ILLEGAL_FALLBACK_AFTER_BLOCKED_CATALOG";
  attempt: number;
  detail: string;
}

export interface HypothesisResult {
  classifications: Record<string, string>;
  classificationRate: number;
  falseCertaintyCount: number;
  determinateCount: number;
  evaluableCount: number;
}

export interface TrialResult {
  scenarioId: ScenarioId;
  policyId: PolicyId;
  trialSeed: number;
  thresholdConfigId: string;
  validInteractions: number;
  rewardObservations: number;
  attempts: number;
  nonCountingEvents: number;
  cumulativeReward: number;
  regret: number;
  discoveries: number;
  prototypeCoverage: number;
  probeCount: number;
  blockedCatalog: boolean;
  blockedReason?: string;
  constraintViolations: ConstraintViolation[];
  hypothesis: HypothesisResult;
  meanCandidatePool: number;
  events: TrialEvent[];
}

function credibleZ(level: ThresholdConfig["credibleLevel"]) {
  if (level === 0.8) return 1.2815515655446004;
  if (level === 0.9) return 1.6448536269514722;
  return 1.959963984540054;
}

function classifyHypothesis(
  posterior: Posterior,
  scenario: Scenario,
  config: ThresholdConfig,
): HypothesisResult {
  const mu = posteriorMean(posterior);
  const diagonal = inverseDiagonal(posterior);
  const z = credibleZ(config.credibleLevel);
  const classifications: Record<string, string> = {};
  let determinateCount = 0;
  let falseCertaintyCount = 0;
  let evaluableCount = 0;
  for (let index = 0; index < features.length; index++) {
    const feature = features[index];
    const coefficientIndex = index + 1;
    const radius = z * Math.sqrt(Math.max(0, diagonal[coefficientIndex]));
    const lower = mu[coefficientIndex] - radius;
    const upper = mu[coefficientIndex] + radius;
    const truth = scenario.featureTruth[index];
    let classification = "UNDETERMINED";
    if (lower > config.rope) classification = "SIMILARITY_ASSOCIATED";
    else if (upper < -config.rope) classification = "CONTRAST_ASSOCIATED";
    else if (lower >= -config.rope && upper <= config.rope)
      classification = "LOW_RELEVANCE";
    classifications[feature] = classification;
    if (truth === "unknown") continue;
    evaluableCount++;
    if (classification !== "UNDETERMINED") {
      determinateCount++;
      const correct =
        (truth === "similarity" &&
          classification === "SIMILARITY_ASSOCIATED") ||
        (truth === "contrast" && classification === "CONTRAST_ASSOCIATED") ||
        (truth === "low" && classification === "LOW_RELEVANCE");
      if (!correct) falseCertaintyCount++;
    }
  }
  return {
    classifications,
    classificationRate:
      evaluableCount === 0 ? 0 : determinateCount / evaluableCount,
    falseCertaintyCount,
    determinateCount,
    evaluableCount,
  };
}

export function detectConstraintViolations(
  events: TrialEvent[],
  fixture: Fixture,
): ConstraintViolation[] {
  const byId = new Map(fixture.catalog.map((track) => [track.id, track]));
  const seenRecordings = new Set<string>();
  const violations: ConstraintViolation[] = [];
  let probeCount = 0;
  let blocked = false;
  for (const event of events) {
    if (event.kind === "BLOCKED_CATALOG") {
      blocked = true;
      continue;
    }
    if (!event.trackId) continue;
    if (blocked) {
      violations.push({
        type: "ILLEGAL_FALLBACK_AFTER_BLOCKED_CATALOG",
        attempt: event.attempt,
        detail: `${event.trackId} selected after BLOCKED_CATALOG`,
      });
    }
    const track = byId.get(event.trackId);
    const anchor = event.anchorId ? byId.get(event.anchorId) : undefined;
    if (
      !track ||
      !anchor ||
      !event.context ||
      event.context.length !== dimension
    ) {
      violations.push({
        type: "INVALID_FEATURE_OR_CONTEXT",
        attempt: event.attempt,
        detail: `${event.trackId} has missing track, anchor or context`,
      });
      continue;
    }
    if (
      track.features.length !== 7 ||
      anchor.features.length !== 7 ||
      !track.features.every(Number.isFinite) ||
      !anchor.features.every(Number.isFinite) ||
      !event.context.every(Number.isFinite)
    ) {
      violations.push({
        type: "INVALID_FEATURE_OR_CONTEXT",
        attempt: event.attempt,
        detail: `${event.trackId} has invalid features or context`,
      });
    }
    if (!track.playbackEligible) {
      violations.push({
        type: "UNAVAILABLE_PLAYBACK",
        attempt: event.attempt,
        detail: `${event.trackId} is not playback eligible`,
      });
    }
    if (seenRecordings.has(track.recordingKey)) {
      violations.push({
        type: "DUPLICATE_RECORDING",
        attempt: event.attempt,
        detail: `${event.recordingKey} selected more than once`,
      });
    }
    seenRecordings.add(track.recordingKey);
    if (event.kind === "RECOMMENDATION" && event.candidateType === "PROBE") {
      probeCount++;
      if (probeCount > 2) {
        violations.push({
          type: "PROBE_LIMIT_BREACH",
          attempt: event.attempt,
          detail: `probe count ${probeCount} exceeds checkpoint limit`,
        });
      }
    }
    const expected = formalContext(track.features, anchor.features);
    if (
      expected.some(
        (value, index) => Math.abs(value - event.context![index]) > 1e-9,
      )
    ) {
      violations.push({
        type: "SAVED_CONTEXT_MISMATCH",
        attempt: event.attempt,
        detail: `${event.trackId} context does not match saved anchor ${anchor.id}`,
      });
    }
  }
  return violations;
}

function runTrial(
  fixture: Fixture,
  policyId: PolicyId,
  config: ThresholdConfig,
  trialSeed: number,
): TrialResult {
  const policyRng = makeRng(
    hashSeed(`${fixture.scenario.id}:${policyId}:policy:${trialSeed}`),
  );
  const userRng = makeRng(hashSeed(`${fixture.scenario.id}:user:${trialSeed}`));
  const state: TrialState = {
    posterior: prior(),
    validInteractions: 0,
    rewardObservations: 0,
    attempts: 0,
    probeCount: 0,
    selectedRecordingKeys: new Set(),
    attemptedRecordingKeys: new Set(
      fixture.seeds.map((seed) => seed.recordingKey),
    ),
  };
  const events: TrialEvent[] = [];
  let cumulativeReward = 0;
  let totalRegret = 0;
  const discoveredPrototypes = new Set<string>();
  let discoveries = 0;
  while (state.validInteractions < 5 && state.attempts < 12) {
    state.attempts++;
    const decision = selectDecision(
      fixture,
      state,
      config,
      policyId,
      policyRng,
    );
    if (
      decision.blocked ||
      !decision.track ||
      !decision.anchor ||
      !decision.context
    ) {
      events.push({
        attempt: state.attempts,
        validInteractionBefore: state.validInteractions,
        kind: "BLOCKED_CATALOG",
        candidateCounts: decision.allowedCounts,
        excludedCounts: decision.excludedCounts,
      });
      break;
    }
    const oracleUtility = bestOracleUtility(
      fixture,
      state,
      config,
      decision.theta,
    );
    state.attemptedRecordingKeys.add(decision.track.recordingKey);
    const utility = expectedUtility(
      fixture.scenario,
      decision.track,
      decision.anchor,
    );
    const regret =
      oracleUtility === undefined ? 0 : Math.max(0, oracleUtility - utility);
    const baseEvent: TrialEvent = {
      attempt: state.attempts,
      validInteractionBefore: state.validInteractions,
      kind: "RECOMMENDATION",
      trackId: decision.track.id,
      recordingKey: decision.track.recordingKey,
      anchorId: decision.anchor.id,
      candidateType: decision.candidateType,
      probeFeature:
        decision.probeFeature === undefined
          ? undefined
          : features[decision.probeFeature],
      context: decision.context,
      score: decision.score,
      utility,
      regret,
      candidateCounts: decision.allowedCounts,
      excludedCounts: decision.excludedCounts,
      guardrailRelaxed: decision.guardrailRelaxed,
    };
    if (userRng.next() < fixture.scenario.playbackFailureRate) {
      events.push({ ...baseEvent, kind: "PLAYBACK_FAILURE" });
      continue;
    }
    if (userRng.next() < fixture.scenario.feedbacklessSkipRate) {
      events.push({ ...baseEvent, kind: "FEEDBACKLESS_SKIP" });
      continue;
    }
    const observedUtility = applyResponseNoise(
      fixture.scenario,
      utility,
      userRng,
    );
    const rating = ratingFromUtility(
      fixture.scenario,
      observedUtility,
      userRng,
    );
    const rewardObserved = rating !== "UNSURE";
    state.validInteractions++;
    state.previousCandidateType = decision.candidateType;
    if (decision.candidateType === "PROBE") state.probeCount++;
    state.selectedRecordingKeys.add(decision.track.recordingKey);
    if (rewardObserved) {
      state.rewardObservations++;
      const r = reward(rating);
      cumulativeReward += r;
      updatePosterior(state.posterior, decision.context, r);
    }
    if (rating === "LIKE" && utility >= 0.12) {
      discoveries++;
      discoveredPrototypes.add(decision.track.prototype);
    }
    totalRegret += regret;
    events.push({
      ...baseEvent,
      rating,
      rewardObserved,
    });
  }
  const violations = detectConstraintViolations(events, fixture);
  const poolSizes = events
    .filter((event) => event.kind !== "BLOCKED_CATALOG")
    .map((event) => event.candidateCounts.allowed);
  return {
    scenarioId: fixture.scenario.id,
    policyId,
    trialSeed,
    thresholdConfigId: config.id,
    validInteractions: state.validInteractions,
    rewardObservations: state.rewardObservations,
    attempts: state.attempts,
    nonCountingEvents: events.filter(
      (event) =>
        event.kind === "PLAYBACK_FAILURE" || event.kind === "FEEDBACKLESS_SKIP",
    ).length,
    cumulativeReward,
    regret: totalRegret,
    discoveries,
    prototypeCoverage: discoveredPrototypes.size,
    probeCount: state.probeCount,
    blockedCatalog: events.some((event) => event.kind === "BLOCKED_CATALOG"),
    blockedReason: events.some((event) => event.kind === "BLOCKED_CATALOG")
      ? "BLOCKED_CATALOG"
      : undefined,
    constraintViolations: violations,
    hypothesis: classifyHypothesis(state.posterior, fixture.scenario, config),
    meanCandidatePool: mean(poolSizes),
    events,
  };
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * p)),
  );
  return sorted[index];
}

function distribution(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    n: sorted.length,
    min: sorted[0] ?? 0,
    p10: percentile(sorted, 0.1),
    median: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    max: sorted[sorted.length - 1] ?? 0,
    mean: mean(sorted),
  };
}

function violationCounts(trials: TrialResult[]) {
  const counts: Record<string, number> = {};
  for (const trial of trials) {
    for (const violation of trial.constraintViolations) {
      counts[violation.type] = (counts[violation.type] ?? 0) + 1;
    }
  }
  return counts;
}

function compactEvent(event: TrialEvent) {
  return {
    attempt: event.attempt,
    kind: event.kind,
    trackId: event.trackId,
    anchorId: event.anchorId,
    candidateType: event.candidateType,
    probeFeature: event.probeFeature,
    rating: event.rating,
    rewardObserved: event.rewardObserved,
    utility:
      event.utility === undefined ? undefined : +event.utility.toFixed(4),
    regret: event.regret === undefined ? undefined : +event.regret.toFixed(4),
    candidateCounts: event.candidateCounts,
    guardrailRelaxed: event.guardrailRelaxed,
  };
}

function examples(trials: TrialResult[]) {
  const blocked = trials.find((trial) => trial.blockedCatalog);
  const falseCertainty = trials.find(
    (trial) => trial.hypothesis.falseCertaintyCount > 0,
  );
  const lowDiscovery = [...trials]
    .sort((a, b) => a.discoveries - b.discoveries || b.regret - a.regret)
    .at(0);
  const sparseReward = [...trials]
    .sort((a, b) => a.rewardObservations - b.rewardObservations)
    .at(0);
  return {
    blockedCatalog: blocked
      ? {
          scenarioId: blocked.scenarioId,
          policyId: blocked.policyId,
          trialSeed: blocked.trialSeed,
          lastEvents: blocked.events.slice(-3).map(compactEvent),
        }
      : null,
    falseCertainty: falseCertainty
      ? {
          scenarioId: falseCertainty.scenarioId,
          policyId: falseCertainty.policyId,
          trialSeed: falseCertainty.trialSeed,
          hypothesis: falseCertainty.hypothesis,
          lastEvents: falseCertainty.events.slice(-3).map(compactEvent),
        }
      : null,
    lowDiscovery: lowDiscovery
      ? {
          scenarioId: lowDiscovery.scenarioId,
          policyId: lowDiscovery.policyId,
          trialSeed: lowDiscovery.trialSeed,
          discoveries: lowDiscovery.discoveries,
          regret: +lowDiscovery.regret.toFixed(4),
          lastEvents: lowDiscovery.events.slice(-3).map(compactEvent),
        }
      : null,
    sparseReward: sparseReward
      ? {
          scenarioId: sparseReward.scenarioId,
          policyId: sparseReward.policyId,
          trialSeed: sparseReward.trialSeed,
          validInteractions: sparseReward.validInteractions,
          rewardObservations: sparseReward.rewardObservations,
          lastEvents: sparseReward.events.slice(-3).map(compactEvent),
        }
      : null,
  };
}

function summarizeTrials(trials: TrialResult[]) {
  const falseCertaintyCount = sum(
    trials.map((trial) => trial.hypothesis.falseCertaintyCount),
  );
  const determinateCount = sum(
    trials.map((trial) => trial.hypothesis.determinateCount),
  );
  const evaluableCount = sum(
    trials.map((trial) => trial.hypothesis.evaluableCount),
  );
  return {
    trials: trials.length,
    validInteractions: distribution(
      trials.map((trial) => trial.validInteractions),
    ),
    rewardObservations: distribution(
      trials.map((trial) => trial.rewardObservations),
    ),
    nonCountingEvents: distribution(
      trials.map((trial) => trial.nonCountingEvents),
    ),
    cumulativeReward: distribution(
      trials.map((trial) => trial.cumulativeReward),
    ),
    regret: distribution(trials.map((trial) => trial.regret)),
    discoveries: distribution(trials.map((trial) => trial.discoveries)),
    prototypeCoverage: distribution(
      trials.map((trial) => trial.prototypeCoverage),
    ),
    probeCount: distribution(trials.map((trial) => trial.probeCount)),
    meanCandidatePool: distribution(
      trials.map((trial) => trial.meanCandidatePool),
    ),
    blockedCatalogCount: trials.filter((trial) => trial.blockedCatalog).length,
    blockedCatalogRate:
      trials.length === 0
        ? 0
        : trials.filter((trial) => trial.blockedCatalog).length / trials.length,
    completedFiveValidRate:
      trials.length === 0
        ? 0
        : trials.filter((trial) => trial.validInteractions === 5).length /
          trials.length,
    multiplePrototypeCoverageRate:
      trials.length === 0
        ? 0
        : trials.filter((trial) => trial.prototypeCoverage >= 2).length /
          trials.length,
    hardConstraintViolationCounts: violationCounts(trials),
    falseCertaintyCount,
    determinateCount,
    evaluableCount,
    falseCertaintyRate:
      determinateCount === 0 ? 0 : falseCertaintyCount / determinateCount,
    classificationRate:
      evaluableCount === 0 ? 0 : determinateCount / evaluableCount,
    hypothesisClassificationsExample:
      trials[0]?.hypothesis.classifications ??
      Object.fromEntries(features.map((name) => [name, "UNDETERMINED"])),
    examples: examples(trials),
  };
}

export function runBatch(
  config: ThresholdConfig,
  trialSeeds: number[],
  phase: "calibration" | "final",
) {
  const trials: TrialResult[] = [];
  for (const scenario of scenarios) {
    for (const seed of trialSeeds) {
      const fixture = createFixture(scenario, seed);
      for (const policy of policies) {
        trials.push(runTrial(fixture, policy, config, seed));
      }
    }
  }
  return {
    phase,
    thresholdConfig: config,
    trialSeeds,
    trials,
  };
}

function scenarioPolicySummaries(trials: TrialResult[]) {
  const rows = [];
  for (const scenario of scenarios) {
    for (const policy of policies) {
      rows.push({
        scenarioId: scenario.id,
        policyId: policy,
        ...summarizeTrials(
          trials.filter(
            (trial) =>
              trial.scenarioId === scenario.id && trial.policyId === policy,
          ),
        ),
      });
    }
  }
  return rows;
}

function calibrationSensitivity(batches: ReturnType<typeof runBatch>[]) {
  return batches.map((batch) => {
    const summary = summarizeTrials(batch.trials);
    return {
      thresholdConfigId: batch.thresholdConfig.id,
      thresholdConfig: batch.thresholdConfig,
      trials: summary.trials,
      blockedCatalogRate: summary.blockedCatalogRate,
      completedFiveValidRate: summary.completedFiveValidRate,
      rewardObservationsMedian: summary.rewardObservations.median,
      discoveryMean: summary.discoveries.mean,
      regretMedian: summary.regret.median,
      multiplePrototypeCoverageRate: summary.multiplePrototypeCoverageRate,
      classificationRate: summary.classificationRate,
      falseCertaintyRate: summary.falseCertaintyRate,
      meanCandidatePool: summary.meanCandidatePool.mean,
      hardConstraintViolationCounts: summary.hardConstraintViolationCounts,
    };
  });
}

function constraintDetectionFixture() {
  const fixture = createFixture(scenarios[0], 12345);
  const valid = fixture.catalog.find(
    (track) => !track.isSeed && track.playbackEligible,
  )!;
  const unavailable = fixture.catalog.find(
    (track) => !track.isSeed && !track.playbackEligible,
  );
  const anchor = fixture.seeds[0];
  const base: TrialEvent = {
    attempt: 1,
    validInteractionBefore: 0,
    kind: "RECOMMENDATION",
    trackId: valid.id,
    recordingKey: valid.recordingKey,
    anchorId: anchor.id,
    candidateType: "RELEVANT",
    context: formalContext(valid.features, anchor.features),
    candidateCounts: { relevant: 1, probe: 0, allowed: 1, eligible: 1 },
    excludedCounts: {},
  };
  const events: TrialEvent[] = [
    base,
    { ...base, attempt: 2 },
    {
      ...base,
      attempt: 3,
      trackId: unavailable?.id ?? valid.id,
      recordingKey: unavailable?.recordingKey ?? valid.recordingKey,
      context: unavailable
        ? formalContext(unavailable.features, anchor.features)
        : base.context,
    },
    {
      ...base,
      attempt: 4,
      candidateType: "PROBE",
      trackId: valid.id,
      context: base.context!.map((value, index) =>
        index === 1 ? value + 0.2 : value,
      ),
    },
    {
      attempt: 5,
      validInteractionBefore: 1,
      kind: "BLOCKED_CATALOG",
      candidateCounts: { relevant: 0, probe: 0, allowed: 0, eligible: 0 },
      excludedCounts: {},
    },
    { ...base, attempt: 6 },
  ];
  return detectConstraintViolations(events, fixture);
}

const defaultCalibrationSeeds = Array.from(
  { length: 10 },
  (_, index) => 41001 + index,
);
const defaultFinalSeeds = Array.from(
  { length: 36 },
  (_, index) => 91001 + index,
);

export function runSyntheticEvaluation(options: EvaluationOptions = {}) {
  const calibrationSeeds =
    options.calibrationSeeds ??
    defaultCalibrationSeeds.slice(
      0,
      options.calibrationTrialsPerScenario ?? 10,
    );
  const finalSeeds =
    options.finalSeeds ??
    defaultFinalSeeds.slice(0, options.finalTrialsPerScenario ?? 36);
  const calibrationBatches = thresholdCandidates.map((config) =>
    runBatch(config, calibrationSeeds, "calibration"),
  );
  const finalBatch = runBatch(finalThreshold, finalSeeds, "final");
  const finalSummary = summarizeTrials(finalBatch.trials);
  return {
    label: "Supporting Artifact / Not a Source of Truth",
    issue: "#40",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    commit: options.commit ?? "UNKNOWN",
    command: "npm.cmd --prefix experiments/stack-bakeoff run ml:simulate",
    scope:
      "Synthetic fixtures only. Does not change Product/Architecture decisions, production algorithm, API/DB contracts, acceptance thresholds, real catalog, real playback, or user-demand claims.",
    versions,
    formula: {
      context:
        "phi(c,s) = [1, -abs(q1(c)-q1(s)), ..., -abs(q7(c)-q7(s))] / sqrt(8)",
      prior: "B0 = I, f0 = 0",
      posterior:
        "B_t = B_(t-1) + phi_t phi_t^T, f_t = f_(t-1) + phi_t r_t, mu = solve(B,f), covariance = B^-1",
      noiseScale: 1,
      rewards:
        "LIKE=+1, NEUTRAL=0, DISLIKE=-1. UNSURE, playback failure and feedback-less skip are not reward observations.",
    },
    runPlan: {
      calibrationVsFinalSeedSplit:
        "Calibration sensitivity uses 41001+ seeds. Final descriptive evaluation uses 91001+ seeds.",
      calibrationSeeds,
      finalSeeds,
      calibrationTrialsPerScenario: calibrationSeeds.length,
      finalTrialsPerScenario: finalSeeds.length,
      policies,
      scenarios: scenarios.map((scenario) => ({
        id: scenario.id,
        name: scenario.name,
        description: scenario.description,
      })),
      exclusionAndStopCriteria: [
        "Seeds are excluded from recommendation candidates.",
        "Duplicate recording keys are deduped and previously attempted recordings are excluded.",
        "Playback-ineligible and invalid-feature tracks are hard-filtered.",
        "Track 1 requires a Relevant candidate.",
        "Probe count is capped at two valid interactions per checkpoint.",
        "Playback failure, pre-start exit and feedback-less skip are non-counting events.",
        "A trial stops at five valid interactions, BLOCKED_CATALOG, or 12 attempts.",
      ],
    },
    calibration: {
      note: "Sensitivity only. These values are candidates for human review and are not accepted thresholds.",
      sensitivity: calibrationSensitivity(calibrationBatches),
    },
    final: {
      thresholdConfig: finalThreshold,
      summary: finalSummary,
      byScenarioPolicy: scenarioPolicySummaries(finalBatch.trials),
    },
    hardConstraintDetection: {
      finalPolicyRunViolationCounts: finalSummary.hardConstraintViolationCounts,
      injectedFixtureDetectedTypes: constraintDetectionFixture().map(
        (violation) => violation.type,
      ),
      note: "Injected fixture is a harness self-check, not part of the policy comparison.",
    },
    limits: [
      "Synthetic utility does not prove real user demand, real discovery value, or target-user fit.",
      "Synthetic recordings do not verify ReccoBeats coverage, YouTube playback, rights, regional availability, or human mapping review.",
      "Thresholds, ROPE, credible interval level and pass/fail gates remain human decisions.",
      "Hidden-feature and multi-modal truth are simplified stress tests, not a claim about actual listener psychology.",
      "No production API, DB schema, UI, authentication, deployment or external service was exercised.",
    ],
    humanReviewNeeded: [
      "Relevant/Probe threshold choice and candidate pool size.",
      "ROPE width and credible interval level for hypothesis display.",
      "Pass/fail gates for false certainty, BLOCKED_CATALOG and discovery metrics.",
      "Whether additional final seeds or scenario parameters are needed before adopting calibration values.",
    ],
  };
}

function markdownReport(result: ReturnType<typeof runSyntheticEvaluation>) {
  const lines = [
    "# Issue #40 Synthetic ML Evaluation",
    "",
    "**Supporting Artifact / Not a Source of Truth**. This report records synthetic calibration evidence only.",
    "",
    `- Code commit: \`${result.commit}\``,
    `- Command: \`${result.command}\``,
    `- Catalog / context / model / policy versions: \`${Object.values(result.versions).join("`, `")}\``,
    `- Calibration seeds: ${result.runPlan.calibrationSeeds.join(", ")}`,
    `- Final seeds: ${result.runPlan.finalSeeds.join(", ")}`,
    "",
    "## Final Summary",
    "",
    "| Scenario | Policy | Completed 5-valid | Reward obs median | Discovery mean | Multi-prototype coverage | BLOCKED_CATALOG | False certainty | Classification | Constraint violations |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const row of result.final.byScenarioPolicy) {
    lines.push(
      `| ${row.scenarioId} | ${row.policyId} | ${row.completedFiveValidRate.toFixed(2)} | ${row.rewardObservations.median.toFixed(0)} | ${row.discoveries.mean.toFixed(2)} | ${row.multiplePrototypeCoverageRate.toFixed(2)} | ${row.blockedCatalogRate.toFixed(2)} | ${row.falseCertaintyRate.toFixed(2)} | ${row.classificationRate.toFixed(2)} | ${JSON.stringify(row.hardConstraintViolationCounts)} |`,
    );
  }
  lines.push(
    "",
    "## Calibration Sensitivity",
    "",
    "| Candidate | BLOCKED_CATALOG | Completed 5-valid | Reward obs median | Discovery mean | Regret median | Candidate pool mean | False certainty | Classification |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  );
  for (const row of result.calibration.sensitivity) {
    lines.push(
      `| ${row.thresholdConfigId} | ${row.blockedCatalogRate.toFixed(2)} | ${row.completedFiveValidRate.toFixed(2)} | ${row.rewardObservationsMedian.toFixed(0)} | ${row.discoveryMean.toFixed(2)} | ${row.regretMedian.toFixed(2)} | ${row.meanCandidatePool.toFixed(2)} | ${row.falseCertaintyRate.toFixed(2)} | ${row.classificationRate.toFixed(2)} |`,
    );
  }
  const examples = result.final.summary.examples;
  lines.push(
    "",
    "## Representative Examples",
    "",
    "- BLOCKED_CATALOG: " +
      (examples.blockedCatalog
        ? `\`${JSON.stringify(examples.blockedCatalog)}\``
        : "none in final policy runs; candidate shortage is still reported through pool-size distributions."),
    "- False certainty: " +
      (examples.falseCertainty
        ? `\`${JSON.stringify(examples.falseCertainty)}\``
        : "none in final policy runs because the interval+ROPE classifier produced no determinate feature hypotheses at the 5-valid-interaction checkpoint."),
    "- Low discovery / regret example: `" +
      JSON.stringify(examples.lowDiscovery) +
      "`",
    "- Sparse reward observation example: `" +
      JSON.stringify(examples.sparseReward) +
      "`",
  );
  lines.push(
    "",
    "## Boundary",
    "",
    "- No threshold in this file is accepted. Values are candidates for team review.",
    "- Simulation success is not real-user validation, real recording quality validation, ReccoBeats/YouTube rights validation, playback coverage, or production readiness.",
    "- Final policy runs had these hard-constraint violations: `" +
      JSON.stringify(
        result.hardConstraintDetection.finalPolicyRunViolationCounts,
      ) +
      "`.",
    "- Constraint checker self-test detected: `" +
      result.hardConstraintDetection.injectedFixtureDetectedTypes.join(", ") +
      "`.",
    "",
  );
  return `${lines.join("\n").trimEnd()}\n`;
}

function currentCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "UNKNOWN";
  }
}

function writeResults() {
  const result = runSyntheticEvaluation({ commit: currentCommit() });
  const jsonPath = "results/ml-synthetic-evaluation.json";
  const mdPath = "results/ml-synthetic-evaluation.md";
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(result, null, 2) + "\n");
  writeFileSync(mdPath, markdownReport(result));
  console.log(
    JSON.stringify(
      {
        result: jsonPath,
        report: mdPath,
        commit: result.commit,
        finalTrials: result.final.summary.trials,
        blockedCatalogRate: result.final.summary.blockedCatalogRate,
        falseCertaintyRate: result.final.summary.falseCertaintyRate,
        classificationRate: result.final.summary.classificationRate,
        hardConstraintViolations:
          result.final.summary.hardConstraintViolationCounts,
      },
      null,
      2,
    ),
  );
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (invokedPath === import.meta.url) {
  writeResults();
}
