// LOCAL REACT CANDIDATE. The FE passes the resolved state and display labels.
// No eligibility, quantile, conditional-count, API, persistence or priority calculation.
import type { ActualProgress, Counts, Source, SufficientSource, CompletionPresentation, ForecastPresentation, PriorForecastProps } from "./presentation-types";

const labels: Readonly<Record<Source, string>> = {
  QUESTION: "回答", QUESTION_AND_RECORDS: "回答＋実績", RECORDS: "実績", NONE: "不足",
};
export function sourceLabel(source: Source): string {
  if (!Object.hasOwn(labels, source)) throw new TypeError("Invalid presentation source.");
  return labels[source];
}
export function sourceNote(source: SufficientSource): string {
  switch (source) {
    case "QUESTION": return "回答に基づく仮の見通しです。将来を保証するものではありません。";
    case "RECORDS": return "記録に基づく見通しです。将来を保証するものではありません。";
    case "QUESTION_AND_RECORDS": return "回答と記録に基づく見通しです。初期の回答は仮定です。将来を保証するものではありません。";
    default: throw new TypeError("A displayed estimate needs resolved provenance.");
  }
}
function assertObject(value: unknown): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Invalid presentation object.");
}
function finite(value: unknown, minimum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum;
}
function integer(value: unknown, minimum: number): value is number {
  return finite(value, minimum) && Number.isSafeInteger(value);
}
function assertSource(source: unknown): asserts source is SufficientSource {
  if (source !== "QUESTION" && source !== "QUESTION_AND_RECORDS" && source !== "RECORDS") throw new TypeError("A displayed estimate needs resolved provenance.");
}
function assertProgress(progress: unknown, completed: boolean): asserts progress is ActualProgress {
  assertObject(progress);
  if (!finite(progress.done, 0) || !finite(progress.total, 0) || progress.total <= 0 || (progress.unit !== "minutes" && progress.unit !== "sessions")) throw new TypeError("Invalid actual progress.");
  // R-02 preserves accumulated actual amount; R-08 permits overrun only in completed.
  if ((progress.done >= progress.total) !== completed) throw new TypeError("Actual progress must match the resolved completion state.");
}
function assertCounts(counts: unknown): asserts counts is Counts {
  assertObject(counts);
  if (!integer(counts.success, 0) || !integer(counts.total, 0) || counts.total < counts.success) throw new TypeError("Invalid observed counts.");
}
function assertCompletion(completion: unknown): asserts completion is CompletionPresentation {
  assertObject(completion);
  if (completion.kind === "insufficient") {
    if (typeof completion.message !== "string" || !completion.message.trim()) throw new TypeError("Insufficient completion needs resolved text.");
    return;
  }
  if (completion.kind === "conditional") {
    const p = completion.plan;
    assertObject(p);
    if (!integer(p.sessions, 1) || !finite(p.remainingAmount, 0) || p.remainingAmount <= 0 || !finite(p.sessionAmount, 0) || p.sessionAmount <= 0 || !finite(p.lastAmount, 0) || p.lastAmount <= 0 || p.lastAmount > p.sessionAmount || (p.unit !== "minutes" && p.unit !== "sessions") || typeof completion.reason !== "string" || !completion.reason.trim()) throw new TypeError("Invalid conditional plan.");
    return;
  }
  if (completion.kind !== "estimate" || (completion.scenario !== "TODAY_DONE" && completion.scenario !== "CURRENT_STATE")) throw new TypeError("Invalid completion presentation.");
  assertObject(completion.sources);
  assertSource(completion.sources.a); assertSource(completion.sources.b);
  if (!(completion.p50Label === null || typeof completion.p50Label === "string") || !(completion.p80Label === null || typeof completion.p80Label === "string")) throw new TypeError("Invalid completion labels.");
  if (!(completion.p50Days === null || integer(completion.p50Days, 0)) || !(completion.p80Days === null || integer(completion.p80Days, 0))) throw new TypeError("Invalid completion days.");
  if ((completion.p50Label === null) !== (completion.p50Days === null) || (completion.p80Label === null) !== (completion.p80Days === null)) throw new TypeError("Completion labels must preserve null horizons.");
  if (completion.p50Days === null && completion.p80Days !== null) throw new TypeError("A finite p80 needs a finite p50.");
  if (completion.p50Days !== null && completion.p80Days !== null && completion.p80Days < completion.p50Days) throw new TypeError("Completion quantiles must be ordered.");
}

// Also call this inside the FE prediction Boundary before its B renderer.
// Validates display values only; never resolves eligibility, freshness or API provenance.
export function assertForecastPresentation(view: unknown): asserts view is ForecastPresentation {
  assertObject(view);
  switch (view.kind) {
    case "loading": case "saved-refresh-failed": case "save-unknown": return;
    case "error":
      if (typeof view.message !== "string") throw new TypeError("Invalid forecast error text.");
      return;
    case "completed": assertProgress(view.progress, true); return;
    case "forecast": case "today-recorded": break;
    default: throw new TypeError("Invalid forecast presentation.");
  }
  assertProgress(view.progress, false); assertCounts(view.resumed); assertCompletion(view.completion);
  if (view.kind === "forecast") {
    assertObject(view.core);
    if (view.core.kind === "estimate") {
      if (!integer(view.core.days, 1)) throw new TypeError("Invalid core estimate.");
      assertSource(view.core.source);
    } else if (view.core.kind === "insufficient") {
      if (view.core.message !== undefined && (typeof view.core.message !== "string" || !view.core.message.trim())) throw new TypeError("Invalid core insufficiency text.");
    } else throw new TypeError("Invalid core presentation.");
  }
  const completion = view.completion;
  if (completion.kind === "estimate" && completion.scenario !== (view.kind === "today-recorded" ? "CURRENT_STATE" : "TODAY_DONE")) {
    throw new TypeError("Completion scenario must match the resolved Today state.");
  }
}
function ActualProgressText({ progress }: { progress: ActualProgress }) {
  return <p>実際に完了した量：{progress.done}／{progress.total}{progress.unit === "minutes" ? "分" : "回"}</p>;
}
function ResumeRecords({ counts }: { counts: Counts }) {
  return <section data-r11-aux="records"><h3>休んだ翌日の実績</h3><p>{counts.total === 0 ? "休んだ翌日の実際の記録はまだありません。" : `休んだ翌日にやれたのは ${counts.total}回中${counts.success}回`}</p></section>;
}
function Completion({ completion }: { completion: CompletionPresentation }) {
  if (completion.kind === "insufficient") {
    return <section data-r11-aux="completion"><h3>完了の目安</h3><p>{completion.message}</p></section>;
  }
  if (completion.kind === "conditional") {
    const p = completion.plan;
    const unit = p.unit === "minutes" ? "分" : "回";
    return <section data-r11-aux="completion"><h3>設定量で行う場合の残り</h3><p className="r11-qp-value">あと{p.sessions}回分</p><p>残り{p.remainingAmount}{unit}。1回{p.sessionAmount}{unit}の設定量で行う場合。最後に必要な量は{p.lastAmount}{unit}です。これは日数の予測ではありません。</p><p>{completion.reason}</p></section>;
  }
  const hasQuestion = completion.sources.a !== "RECORDS" || completion.sources.b !== "RECORDS";
  const p80Text = completion.p80Label === null
    ? completion.p50Label === null
      ? "10回中8回の完了の目安も3年以上先です。"
      : "10回中8回の完了の目安は3年以上先です。"
    : `10回中8回の完了の目安：${completion.p80Label}`;
  return (
    <section data-r11-aux="completion">
      <h3>{completion.scenario === "TODAY_DONE" ? "今日やった場合の完了の目安" : "現在の状態からの完了の目安"}</h3>
      <p className="r11-qp-value">{completion.p50Label ?? "3年以上先"}</p>
      <p>{p80Text}</p>
      <p>取り組めた日の翌日：{sourceLabel(completion.sources.a)}／休んだ日の翌日：{sourceLabel(completion.sources.b)}</p>
      <p>{hasQuestion && "初期の回答は仮定です。"}将来を保証するものではありません。</p>
      {completion.scenario === "TODAY_DONE" && <p>今日やった場合の仮定です。まだ実際の記録・達成には反映されていません。</p>}
    </section>
  );
}

export function PriorForecast({ view, className }: PriorForecastProps) {
  assertForecastPresentation(view);
  const rootClass = ["r11-qp", className].filter(Boolean).join(" ");
  // Priority is represented by the parent's union; never inspect answers or logs here.
  switch (view.kind) {
    case "loading": return <div className={rootClass} role="status">最新の見通しを確認しています。</div>;
    case "saved-refresh-failed": return <div className={rootClass} role="status">回答は保存されました。見通しの更新に失敗しました。最新の見通しを再取得してください。</div>;
    case "save-unknown": return <div className={rootClass} role="status">保存できたか確認できていません。現在の回答を確認してから、保存するかを判断してください。</div>;
    case "error": return <div className={`${rootClass} r11-qp-error`} role="alert">{view.message}</div>;
    case "completed": return <section className={rootClass}><h2>目標を達成しました</h2><ActualProgressText progress={view.progress} /></section>;
    case "forecast":
    case "today-recorded": break;
    default: throw new TypeError("Invalid forecast presentation.");
  }
  return (
    <section className={rootClass}>
      {view.kind === "today-recorded" ? <p className="r11-qp-notice">今日は記録済みです。</p> : view.core.kind === "insufficient" ?
        <section><h2>見通しの材料が不足しています</h2><p>{view.core.message ?? "見通しを出すための材料がまだ足りません。"}</p></section> :
        <section><h2>ゴールが遠ざかる日数（目安）</h2><p className="r11-qp-value">約{view.core.days}日</p><p><span className="r11-qp-source">{sourceLabel(view.core.source)}</span> {sourceNote(view.core.source)}</p></section>}
      <ActualProgressText progress={view.progress} />
      <div className="r11-qp-aux"><ResumeRecords counts={view.resumed} /><Completion completion={view.completion} /></div>
    </section>
  );
}
