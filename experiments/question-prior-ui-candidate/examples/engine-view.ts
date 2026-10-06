// Supporting example only: FE owns this mapping after contract/placement review.
// This projection is not an HTTP DTO, Engine export or production state resolver.
import type { CompletionPresentation, ForecastPresentation, Source, SufficientSource, Unit } from "../src/presentation-types";

export interface EngineDisplayCandidate {
  readonly todayStatus: "DONE" | "SKIPPED" | "UNRECORDED";
  readonly progress: { readonly done: number; readonly total: number; readonly completed: boolean };
  readonly observations: { readonly nSD: number; readonly nSS: number };
  readonly evidenceSource: Readonly<Record<"a" | "b", Source>>;
  readonly coreMetric:
    | { readonly status: "available"; readonly g50: number }
    | { readonly status: "insufficient"; readonly reason: string }
    | { readonly status: "not_applicable"; readonly reason: string };
  readonly completion:
    | { readonly status: "available"; readonly scenario: "TODAY_DONE" | "CURRENT_STATE";
        readonly p50Days: number | null; readonly p80Days: number | null }
    | { readonly status: "insufficient"; readonly reason: "NO_DONE_ORIGIN_TRANSITION" | "NO_SKIP_ORIGIN_TRANSITION" }
    | { readonly status: "completed" };
  readonly conditionalPlan: {
    readonly remainingAmount: number; readonly remainingSessions: number; readonly lastSessionAmount: number;
  };
}
export interface DisplayContextCandidate {
  // BE must supply these from the same snapshot as the Engine input. No DB here.
  readonly unit: Unit;
  readonly sessionAmount: number;
  // FE owns timezone/week formatting. Tests supply explicitly labelled fixture text.
  readonly formatCompletionDays: (days: number, scenario: "TODAY_DONE" | "CURRENT_STATE") => string;
}
function sufficient(source: Source): SufficientSource {
  if (source !== "QUESTION" && source !== "QUESTION_AND_RECORDS" && source !== "RECORDS") {
    throw new TypeError("An available Engine estimate needs resolved provenance.");
  }
  return source;
}

// Call only for a validated, current Engine result. FE resolves errors/freshness first.
export function engineViewExample(result: EngineDisplayCandidate, context: DisplayContextCandidate): ForecastPresentation {
  if (!["minutes", "sessions"].includes(context.unit) || !Number.isSafeInteger(context.sessionAmount) || context.sessionAmount <= 0) {
    throw new TypeError("Invalid same-snapshot display context.");
  }
  const progress = { done: result.progress.done, total: result.progress.total, unit: context.unit };
  // Actual achievement takes priority over a hypothetical completion at 0 days.
  if (result.progress.completed) return { kind: "completed", progress };
  const resumed = { success: result.observations.nSD, total: result.observations.nSD + result.observations.nSS };
  let completion: CompletionPresentation;
  switch (result.completion.status) {
    case "insufficient": {
      const plan = result.conditionalPlan;
      const reason = result.completion.reason === "NO_DONE_ORIGIN_TRANSITION"
        ? "「取り組めた翌日」の材料が不足しています。" : "「休んだ翌日」の材料が不足しています。";
      // Rename only: never ceil, subtract Today or convert remaining sessions to days.
      completion = { kind: "conditional", reason, plan: {
        remainingAmount: plan.remainingAmount, sessions: plan.remainingSessions,
        lastAmount: plan.lastSessionAmount, sessionAmount: context.sessionAmount, unit: context.unit,
      } };
      break;
    }
    case "available": {
      const value = result.completion;
      const label = (days: number | null) => days === null ? null : context.formatCompletionDays(days, value.scenario);
      completion = { kind: "estimate", scenario: value.scenario,
        sources: { a: sufficient(result.evidenceSource.a), b: sufficient(result.evidenceSource.b) },
        p50Days: value.p50Days, p80Days: value.p80Days,
        p50Label: label(value.p50Days), p80Label: label(value.p80Days) };
      break;
    }
    default: throw new TypeError("Unachieved progress cannot have completed Engine output.");
  }
  if (result.todayStatus === "DONE" || result.todayStatus === "SKIPPED") {
    if (completion.kind === "estimate") {
      if (completion.scenario !== "CURRENT_STATE") throw new TypeError("Recorded-day estimate must use CURRENT_STATE.");
      return { kind: "today-recorded", progress, resumed, completion: { ...completion, scenario: "CURRENT_STATE" } };
    }
    return { kind: "today-recorded", progress, resumed, completion };
  }
  if (result.todayStatus !== "UNRECORDED" || result.coreMetric.status === "not_applicable") {
    throw new TypeError("Invalid current Engine applicability.");
  }
  if (completion.kind === "estimate" && completion.scenario !== "TODAY_DONE") {
    throw new TypeError("Unrecorded-day estimate must use TODAY_DONE.");
  }
  return { kind: "forecast", progress, resumed, completion,
    core: result.coreMetric.status === "available"
      ? { kind: "estimate", days: result.coreMetric.g50, source: sufficient(result.evidenceSource.b) }
      : { kind: "insufficient" } };
}
