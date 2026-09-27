# Issue #40 Synthetic ML Evaluation

**Supporting Artifact / Not a Source of Truth**. This report records synthetic calibration evidence only.

- Commit: `4e108f1dce9e1fa808f67426403019427b05e147`
- Command: `npm.cmd --prefix experiments/stack-bakeoff run ml:simulate`
- Catalog / context / model / policy versions: `synthetic-catalog-v1.issue-40`, `percentile-7d-synthetic-v1`, `formal-negative-distance-v1`, `gaussian-lints-b0-i-f0-0-noise1-v1`, `issue-40-policy-comparison-v1`, `issue-40-six-scenarios-v1`
- Calibration seeds: 41001, 41002, 41003, 41004, 41005, 41006, 41007, 41008, 41009, 41010
- Final seeds: 91001, 91002, 91003, 91004, 91005, 91006, 91007, 91008, 91009, 91010, 91011, 91012, 91013, 91014, 91015, 91016, 91017, 91018, 91019, 91020, 91021, 91022, 91023, 91024, 91025, 91026, 91027, 91028, 91029, 91030, 91031, 91032, 91033, 91034, 91035, 91036

## Final Summary

| Scenario | Policy | Completed 5-valid | Reward obs median | Discovery mean | Multi-prototype coverage | BLOCKED_CATALOG | False certainty | Classification | Constraint violations |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| model_matched_linear | nearest-seed | 1.00 | 4 | 0.17 | 0.00 | 0.00 | 0.00 | 0.00 | {} |
| model_matched_linear | greedy-bayesian-linear | 1.00 | 4 | 0.44 | 0.11 | 0.00 | 0.00 | 0.00 | {} |
| model_matched_linear | gaussian-lints | 1.00 | 5 | 0.36 | 0.06 | 0.00 | 0.00 | 0.00 | {} |
| noisy_ordinal | nearest-seed | 1.00 | 3 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | {} |
| noisy_ordinal | greedy-bayesian-linear | 1.00 | 3 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | {} |
| noisy_ordinal | gaussian-lints | 1.00 | 4 | 0.08 | 0.00 | 0.00 | 0.00 | 0.00 | {} |
| multi_modal | nearest-seed | 1.00 | 5 | 2.31 | 0.64 | 0.00 | 0.00 | 0.00 | {} |
| multi_modal | greedy-bayesian-linear | 1.00 | 5 | 2.47 | 0.61 | 0.00 | 0.00 | 0.00 | {} |
| multi_modal | gaussian-lints | 1.00 | 5 | 2.50 | 0.56 | 0.00 | 0.00 | 0.00 | {} |
| hidden_feature | nearest-seed | 1.00 | 4 | 0.83 | 0.11 | 0.00 | 0.00 | 0.00 | {} |
| hidden_feature | greedy-bayesian-linear | 1.00 | 4 | 0.69 | 0.11 | 0.00 | 0.00 | 0.00 | {} |
| hidden_feature | gaussian-lints | 1.00 | 4 | 0.92 | 0.19 | 0.00 | 0.00 | 0.00 | {} |
| outlier_seed | nearest-seed | 1.00 | 4 | 0.14 | 0.00 | 0.00 | 0.00 | 0.00 | {} |
| outlier_seed | greedy-bayesian-linear | 1.00 | 4 | 0.11 | 0.03 | 0.00 | 0.00 | 0.00 | {} |
| outlier_seed | gaussian-lints | 1.00 | 5 | 0.31 | 0.00 | 0.00 | 0.00 | 0.00 | {} |
| unsure_heavy | nearest-seed | 1.00 | 2 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | {} |
| unsure_heavy | greedy-bayesian-linear | 1.00 | 2 | 0.06 | 0.00 | 0.00 | 0.00 | 0.00 | {} |
| unsure_heavy | gaussian-lints | 1.00 | 2 | 0.06 | 0.00 | 0.00 | 0.00 | 0.00 | {} |

## Calibration Sensitivity

| Candidate | BLOCKED_CATALOG | Completed 5-valid | Reward obs median | Discovery mean | Regret median | Candidate pool mean | False certainty | Classification |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| strict-candidate | 0.00 | 1.00 | 4 | 0.68 | 1.64 | 17.38 | 0.00 | 0.00 |
| balanced-candidate | 0.00 | 1.00 | 4 | 0.69 | 1.68 | 25.28 | 0.00 | 0.00 |
| loose-candidate | 0.00 | 1.00 | 4 | 0.69 | 1.69 | 37.75 | 0.00 | 0.00 |

## Representative Examples

- BLOCKED_CATALOG: none in final policy runs; candidate shortage is still reported through pool-size distributions.
- False certainty: none in final policy runs because the interval+ROPE classifier produced no determinate feature hypotheses at the 5-valid-interaction checkpoint.
- Low discovery / regret example: `{"scenarioId":"hidden_feature","policyId":"greedy-bayesian-linear","trialSeed":91034,"discoveries":0,"regret":5.0623,"lastEvents":[{"attempt":3,"kind":"RECOMMENDATION","trackId":"hidden_feature-gamma-probe-2","anchorId":"seed-alpha","candidateType":"RELEVANT","rating":"DISLIKE","rewardObserved":true,"utility":-0.7284,"regret":1.2496,"candidateCounts":{"relevant":20,"probe":8,"allowed":20,"eligible":32}},{"attempt":4,"kind":"RECOMMENDATION","trackId":"hidden_feature-gamma-probe-6","anchorId":"seed-gamma","candidateType":"RELEVANT","rating":"DISLIKE","rewardObserved":true,"utility":-0.59,"regret":1.1112,"candidateCounts":{"relevant":20,"probe":8,"allowed":28,"eligible":33}},{"attempt":5,"kind":"RECOMMENDATION","trackId":"hidden_feature-gamma-near-8","anchorId":"seed-gamma","candidateType":"RELEVANT","rating":"DISLIKE","rewardObserved":true,"utility":-0.6446,"regret":1.1658,"candidateCounts":{"relevant":20,"probe":8,"allowed":28,"eligible":34}}]}`
- Sparse reward observation example: `{"scenarioId":"unsure_heavy","policyId":"greedy-bayesian-linear","trialSeed":91005,"validInteractions":5,"rewardObservations":0,"lastEvents":[{"attempt":3,"kind":"RECOMMENDATION","trackId":"unsure_heavy-gamma-probe-6","anchorId":"seed-alpha","candidateType":"RELEVANT","rating":"UNSURE","rewardObserved":false,"utility":-0.4234,"regret":0.5134,"candidateCounts":{"relevant":20,"probe":8,"allowed":20,"eligible":35}},{"attempt":4,"kind":"RECOMMENDATION","trackId":"unsure_heavy-gamma-probe-0","anchorId":"seed-gamma","candidateType":"PROBE","probeFeature":"danceability","rating":"UNSURE","rewardObserved":false,"utility":-0.2322,"regret":0.2682,"candidateCounts":{"relevant":20,"probe":8,"allowed":28,"eligible":36}},{"attempt":5,"kind":"RECOMMENDATION","trackId":"unsure_heavy-beta-near-0","anchorId":"seed-alpha","candidateType":"RELEVANT","rating":"UNSURE","rewardObserved":false,"utility":-0.3786,"regret":0.4685,"candidateCounts":{"relevant":20,"probe":0,"allowed":20,"eligible":29}}]}`

## Boundary

- No threshold in this file is accepted. Values are candidates for team review.
- Simulation success is not real-user validation, real recording quality validation, ReccoBeats/YouTube rights validation, playback coverage, or production readiness.
- Final policy runs had these hard-constraint violations: `{}`.
- Constraint checker self-test detected: `DUPLICATE_RECORDING, UNAVAILABLE_PLAYBACK, DUPLICATE_RECORDING, SAVED_CONTEXT_MISMATCH, ILLEGAL_FALLBACK_AFTER_BLOCKED_CATALOG, DUPLICATE_RECORDING`.
