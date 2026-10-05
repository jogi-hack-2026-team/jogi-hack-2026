// SLOT EXAMPLES ONLY. These are not pages, routes, a Goal type or an API controller.
import { QuestionPriorFields } from "../src/QuestionPriorFields";
import { PriorForecast } from "../src/PriorForecast";
import type { QuestionPriorFieldsProps, PriorForecastProps, SavePresentation } from "../src/presentation-types";

// #78: the existing FE draft, disabled decision and error adapter supply these props.
export function GoalQuestionSlotExample(props: QuestionPriorFieldsProps & { readonly saveState: SavePresentation }) {
  const { saveState, ...questionProps } = props;
  const status = saveState.kind === "saving" ? "回答を保存しています。" :
    saveState.kind === "saved" ? "回答を保存しました。" :
    saveState.kind === "saved-refresh-failed" ? "回答は保存済みです。見通しの再取得が必要です。" :
    saveState.kind === "save-unknown" ? "保存できたか未確認です。現在の回答を先に確認してください。" : null;
  return <><QuestionPriorFields {...questionProps} disabled={saveState.kind === "saving" || questionProps.disabled} />
    {status && <p role="status">{status}</p>}
    {saveState.kind === "failed" && <p role="alert">{saveState.message}</p>}
  </>;
}

// #81: FE resolves freshness/errors, R-08, R-07, then eligibility into view.
// The component has no access to the editable draft or HTTP response.
export function TodayQuestionForecastSlotExample(props: PriorForecastProps) {
  return <PriorForecast {...props} />;
}
