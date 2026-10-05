// Temporary real-DOM QA harness only. No production controller/API/route implementation.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QuestionPriorFields } from "../src/QuestionPriorFields";
import { PriorForecast } from "../src/PriorForecast";
import { GoalQuestionSlotExample } from "./slots";
import type { Answers, SavePresentation } from "../src/presentation-types";

import { views } from "./views";
function QaHarness(){
  const [answers,setAnswers]=useState<Answers>({a:null,b:"LOW"});
  const [save,setSave]=useState<SavePresentation>({kind:"idle"});
  const [invalid,setInvalid]=useState(false);
  const [showSecond,setShowSecond]=useState(false);
  const [events,setEvents]=useState(0);
  const [scenario,setScenario]=useState("partial");
  return <main>
    <h1>#117 React実DOM検証用ハーネス</h1>
    <p className="qa-banner">LOCAL CANDIDATE / 未採択・未接続。実際のTSXをReactでmountしています。保存状態は手動の固定例です。通信・保存・予測計算は行いません。</p>
    <div className="qa-controls">
      <button type="button" onClick={()=>setAnswers({a:null,b:null})} disabled={save.kind==="saving"}>2問とも解除</button>
      <button type="button" aria-pressed={invalid} onClick={()=>setInvalid(x=>!x)}>項目エラー切替</button>
      <button type="button" aria-pressed={showSecond} onClick={()=>setShowSecond(x=>!x)}>2つ目のGoal表示</button>
      <label>保存状態<select value={save.kind} onChange={event=>{const kind=event.currentTarget.value as SavePresentation['kind'];setSave(kind==='failed'?{kind,message:'回答を保存できませんでした（検証用の固定状態）。'}:{kind});}}>
        <option value="idle">未保存</option><option value="saving">保存中</option><option value="failed">保存失敗</option><option value="saved">保存済み</option><option value="saved-refresh-failed">保存済み・再取得失敗</option><option value="save-unknown">保存結果不明</option>
      </select></label>
      <label>表示状態<select value={scenario} onChange={event=>setScenario(event.currentTarget.value)}>
        <option value="partial">F04 片方回答</option><option value="missing">F01 未回答</option><option value="completed">F16 達成済み</option><option value="recorded">F15 今日休みを記録済み</option><option value="refresh">I07 再取得失敗</option><option value="unknown">I08 保存不明</option>
      </select></label>
    </div>
    <p id="qa-draft" role="status" aria-live="polite">未保存draft: a={answers.a??"null"}, b={answers.b??"null"} / 変更通知={events}</p>
    <div className="qa-grid"><section className="qa-card" aria-label="React質問入力">
      <GoalQuestionSlotExample value={answers} onChange={next=>{setAnswers(next);setEvents(n=>n+1);}} fieldErrors={invalid?{b:'回答を確認してください（検証用）。'}:{}} saveState={save}/>
    </section><section className="qa-card" aria-label="React出所表示"><PriorForecast view={views[scenario]}/></section></div>
    {showSecond&&<section className="qa-card"><h2>別Goalの入力（固定値）</h2><QuestionPriorFields value={{a:"MID",b:"UNKNOWN"}} onChange={()=>{}}/></section>}
    <p className="qa-small">このQAのsave/scenario操作はFEの本番保存・状態優先resolverではありません。入力による右側の再計算も行いません。</p>
  </main>;
}
const container=document.getElementById("root");
if(!container)throw new Error("QA root is missing.");
createRoot(container).render(<QaHarness/>);
