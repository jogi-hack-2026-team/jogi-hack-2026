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
export const views: Readonly<Record<string,ForecastPresentation>> = {
  partial,
  missing:{...partial,core:{kind:"insufficient"}},
  completed:{kind:"completed",progress:{done:100,total:100,unit:"minutes"}},
  recorded:{kind:"today-recorded",progress:partial.progress,resumed:partial.resumed,completion:conditional},
  refresh:{kind:"saved-refresh-failed"},unknown:{kind:"save-unknown"},loading:{kind:"loading"},
  error:{kind:"error",message:"見通しを取得できませんでした（表示確認用）。"},
};
