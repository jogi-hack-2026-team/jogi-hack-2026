// Resolved display examples only. No Engine/HTTP adapter or computed quantiles.
import type { CompletionPresentation, ForecastPresentation } from "../src/presentation-types";
export const conditional: Extract<CompletionPresentation,{kind:"conditional"}> = {
  kind:"conditional",plan:{remainingAmount:40,sessions:3,sessionAmount:15,lastAmount:10,unit:"minutes"},
  reason:"「取り組めた翌日」の材料が不足しています。",
};
// F04's fully specified display derivative: a missing, b LOW, actual progress 60/100.
export const partial: Extract<ForecastPresentation,{kind:"forecast"}> = {
  kind:"forecast",progress:{done:60,total:100,unit:"minutes"},
  core:{kind:"estimate",days:3,source:"QUESTION"},resumed:{success:0,total:0},completion:conditional,
};
// FE-resolved record-only R-06 fixtures: no prior adapter, inferred source or Plan.
const recordsMissing = {
  kind:"forecast",progress:partial.progress,resumed:{success:0,total:0},
  core:{kind:"insufficient",message:"まだ「休んだ翌日」の記録がありません。記録がたまると、あなたの再開傾向から推定します。"},
  completion:{kind:"insufficient",message:"「やった翌日」と「休んだ翌日」の記録がそれぞれたまると、完了の目安を表示します。"},
} satisfies Extract<ForecastPresentation,{kind:"forecast"}>;
export const views: Readonly<Record<string,ForecastPresentation>> = {
  partial,
  missing:{...partial,core:{kind:"insufficient"}},
  completed:{kind:"completed",progress:{done:100,total:100,unit:"minutes"}},
  recorded:{kind:"today-recorded",progress:partial.progress,resumed:partial.resumed,completion:conditional},
  "records-missing":recordsMissing,
  "records-partial":{...recordsMissing,core:{kind:"estimate",days:3,source:"RECORDS"},resumed:{success:1,total:2}},
  "records-recorded":{kind:"today-recorded",progress:recordsMissing.progress,resumed:recordsMissing.resumed,completion:recordsMissing.completion},
  refresh:{kind:"saved-refresh-failed"},unknown:{kind:"save-unknown"},loading:{kind:"loading"},
  error:{kind:"error",message:"見通しを取得できませんでした（表示確認用）。"},
};
