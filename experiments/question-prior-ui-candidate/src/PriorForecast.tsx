// LOCAL REACT CANDIDATE. The FE passes the resolved state and display labels.
// No eligibility, quantile, conditional-count, API, persistence or priority calculation.
import type { ActualProgress, Counts, Source, SufficientSource, CompletionPresentation, PriorForecastProps } from "./presentation-types";

const labels: Readonly<Record<Source, string>> = {
  QUESTION: "回答", QUESTION_AND_RECORDS: "回答＋実績", RECORDS: "実績", NONE: "不足",
};
function sourceLabel(source: Source): string {
  if (!Object.hasOwn(labels, source)) throw new TypeError("Invalid presentation source.");
  return labels[source];
}
function sourceNote(source: SufficientSource): string {
  switch (source) {
    case "QUESTION": return "回答に基づく仮の見通しです。将来を保証するものではありません。";
    case "RECORDS": return "記録に基づく見通しです。将来を保証するものではありません。";
    case "QUESTION_AND_RECORDS": return "回答と記録に基づく見通しです。初期の回答は仮定です。将来を保証するものではありません。";
    default: throw new TypeError("A displayed estimate needs resolved provenance.");
  }
}
function ActualProgressText({ progress }: { progress: ActualProgress }) {
  if (!Number.isFinite(progress.done) || progress.done < 0 || !Number.isFinite(progress.total) || progress.total <= 0 || !["minutes", "sessions"].includes(progress.unit)) throw new TypeError("Invalid actual progress.");
  return <p>実際に完了した量：{progress.done}／{progress.total}{progress.unit === "minutes" ? "分" : "回"}</p>;
}
function ResumeRecords({ counts }: { counts: Counts }) {
  if (!Number.isSafeInteger(counts.success) || !Number.isSafeInteger(counts.total) || counts.success < 0 || counts.total < counts.success) throw new TypeError("Invalid observed counts.");
  return <section data-r11-aux="records"><h3>休んだ翌日の実績</h3><p>{counts.total === 0 ? "休んだ翌日の実際の記録はまだありません。" : `休んだ翌日にやれたのは ${counts.total}回中${counts.success}回`}</p></section>;
}
function Completion({ completion }: { completion: CompletionPresentation }) {
  if (completion.kind === "conditional") {
    const p = completion.plan;
    if (!Number.isSafeInteger(p.sessions) || p.sessions <= 0 || !Number.isFinite(p.remainingAmount) || p.remainingAmount <= 0 || !Number.isFinite(p.sessionAmount) || p.sessionAmount <= 0 || !Number.isFinite(p.lastAmount) || p.lastAmount <= 0 || p.lastAmount > p.sessionAmount || !["minutes", "sessions"].includes(p.unit)) throw new TypeError("Invalid conditional plan.");
    const unit = p.unit === "minutes" ? "分" : "回";
    return <section data-r11-aux="completion"><h3>設定量で行う場合の残り</h3><p className="r11-qp-value">あと{p.sessions}回分</p><p>残り{p.remainingAmount}{unit}。1回{p.sessionAmount}{unit}の設定量で行う場合。最後に必要な量は{p.lastAmount}{unit}です。これは日数の予測ではありません。</p><p>{completion.reason}</p></section>;
  }
  if (completion.kind !== "estimate" || !(completion.scenario === "TODAY_DONE" || completion.scenario === "CURRENT_STATE")) throw new TypeError("Invalid completion presentation.");
  sourceNote(completion.sources.a); sourceNote(completion.sources.b);
  if (!(completion.p50Label === null || typeof completion.p50Label === "string") || !(completion.p80Label === null || typeof completion.p80Label === "string")) throw new TypeError("Invalid completion labels.");
  if (completion.p50Label === null && completion.p80Label !== null) throw new TypeError("A finite p80 needs a finite p50.");
  const hasQuestion = completion.sources.a !== "RECORDS" || completion.sources.b !== "RECORDS";
  return (
    <section data-r11-aux="completion">
      <h3>{completion.scenario === "TODAY_DONE" ? "今日やった場合の完了の目安" : "現在の状態からの完了の目安"}</h3>
      <p className="r11-qp-value">{completion.p50Label ?? "3年以上先"}</p>
      <p>{completion.p80Label === null ? "10回中8回の完了の目安も3年以上先です。" : `10回中8回の完了の目安：${completion.p80Label}`}</p>
      <p>取り組めた日の翌日：{sourceLabel(completion.sources.a)}／休んだ日の翌日：{sourceLabel(completion.sources.b)}</p>
      <p>{hasQuestion && "初期の回答は仮定です。"}将来を保証するものではありません。</p>
      {completion.scenario === "TODAY_DONE" && <p>今日やった場合の仮定です。まだ実際の記録・達成には反映されていません。</p>}
    </section>
  );
}

export function PriorForecast({ view, className }: PriorForecastProps) {
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
  if (view.kind === "forecast" && view.core.kind === "estimate") {
    if (!Number.isSafeInteger(view.core.days) || view.core.days <= 0) throw new TypeError("Invalid core estimate.");
    sourceNote(view.core.source);
  }
  if (view.kind === "today-recorded" && view.completion.kind === "estimate" && view.completion.scenario !== "CURRENT_STATE") {
    throw new TypeError("Recorded-day completion cannot compare a hypothetical Today.");
  }
  return (
    <section className={rootClass}>
      {view.kind === "today-recorded" ? <p className="r11-qp-notice">今日は記録済みです。</p> : view.core.kind === "insufficient" ?
        <section><h2>見通しの材料が不足しています</h2><p>「休んだ翌日」の回答や実際の記録をもとに見通しを出します。回答は任意です。</p></section> :
        <section><h2>ゴールが遠ざかる日数（目安）</h2><p className="r11-qp-value">約{view.core.days}日</p><p><span className="r11-qp-source">{sourceLabel(view.core.source)}</span> {sourceNote(view.core.source)}</p></section>}
      <ActualProgressText progress={view.progress} />
      <div className="r11-qp-aux"><ResumeRecords counts={view.resumed} /><Completion completion={view.completion} /></div>
    </section>
  );
}
