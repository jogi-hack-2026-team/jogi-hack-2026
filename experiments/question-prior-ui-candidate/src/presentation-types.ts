// Supporting Artifact / Not a Source of Truth. No adopted API/Engine DTO or props.
export type Answer = "LOW" | "MID" | "HIGH" | "UNKNOWN" | null;
export type Origin = "a" | "b";
export type Answers = Readonly<Record<Origin, Answer>>;
export type Source = "NONE" | "QUESTION" | "QUESTION_AND_RECORDS" | "RECORDS";
export type SufficientSource = Exclude<Source, "NONE">;
export type Unit = "minutes" | "sessions";
export interface ActualProgress { readonly done: number; readonly total: number; readonly unit: Unit }
export interface Counts { readonly success: number; readonly total: number }
export interface Plan {
  readonly remainingAmount: number; readonly sessions: number;
  readonly sessionAmount: number; readonly lastAmount: number; readonly unit: Unit;
}
export type CorePresentation =
  | { readonly kind: "insufficient" }
  | { readonly kind: "estimate"; readonly days: number; readonly source: SufficientSource };
export type CompletionPresentation =
  | { readonly kind: "conditional"; readonly plan: Plan; readonly reason: string }
  | { readonly kind: "estimate"; readonly scenario: "TODAY_DONE" | "CURRENT_STATE";
      readonly sources: Readonly<Record<Origin, SufficientSource>>;
      readonly p50Label: string | null; readonly p80Label: string | null };
export type CurrentStateCompletionPresentation =
  | Extract<CompletionPresentation, { kind: "conditional" }>
  | (Omit<Extract<CompletionPresentation, { kind: "estimate" }>, "scenario"> & { readonly scenario: "CURRENT_STATE" });
export type ForecastPresentation =
  | { readonly kind: "loading" | "saved-refresh-failed" | "save-unknown" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "completed"; readonly progress: ActualProgress }
  | { readonly kind: "forecast"; readonly progress: ActualProgress; readonly core: CorePresentation;
      readonly resumed: Counts; readonly completion: CompletionPresentation }
  | { readonly kind: "today-recorded"; readonly progress: ActualProgress;
      readonly resumed: Counts; readonly completion: CurrentStateCompletionPresentation };
export interface QuestionPriorFieldsProps {
  readonly value: Answers;
  readonly onChange: (next: Answers) => void;
  readonly disabled?: boolean;
  readonly fieldErrors?: Readonly<Partial<Record<Origin, string>>>;
  readonly className?: string;
}
export interface PriorForecastProps { readonly view: ForecastPresentation; readonly className?: string }
// Example FE-owned state, never a mutation implementation.
export type SavePresentation =
  | { readonly kind: "idle" | "saving" | "saved" | "saved-refresh-failed" | "save-unknown" }
  | { readonly kind: "failed"; readonly message: string };
