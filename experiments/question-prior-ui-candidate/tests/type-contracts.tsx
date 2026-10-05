// Candidate contract checks; negative examples are never mounted or executed.
import { QuestionPriorFields } from "../src/QuestionPriorFields";
import { PriorForecast } from "../src/PriorForecast";
import { GoalQuestionSlotExample, TodayQuestionForecastSlotExample } from "../examples/slots";
import type { Answers, ForecastPresentation, QuestionPriorFieldsProps } from "../src/presentation-types";
const value: Answers = { a: null, b: "UNKNOWN" };
const props: QuestionPriorFieldsProps = { value, onChange: next => { const pair: Answers = next; void pair; } };
const fields = <QuestionPriorFields {...props} />;
const goalSlot = <GoalQuestionSlotExample {...props} saveState={{kind:"saving"}} />;
const completed: ForecastPresentation = { kind:"completed",progress:{done:100,total:100,unit:"minutes"} };
const forecast = <PriorForecast view={completed} />;
const todaySlot = <TodayQuestionForecastSlotExample view={completed} />;
// @ts-expect-error Both origins are required even when one answer is missing.
const missingOrigin = <QuestionPriorFields value={{a:null}} onChange={() => {}} />;
// @ts-expect-error Unknown and missing cannot silently become a new numeric enum.
const invalidAnswer = <QuestionPriorFields value={{a:"MIDDLE",b:null}} onChange={() => {}} />;
// @ts-expect-error This input must notify the owner; an uncontrolled default is not supported.
const uncontrolled = <QuestionPriorFields value={value} />;
// @ts-expect-error Local uncomputed golden state is not a React production candidate state.
const pending: ForecastPresentation = {kind:"forecast",progress:{done:60,total:100,unit:"minutes"},core:{kind:"estimate",days:1,source:"QUESTION"},resumed:{success:0,total:0},completion:{kind:"fixture-pending",scenario:"TODAY_DONE",sources:{a:"QUESTION",b:"QUESTION"}}};
// @ts-expect-error Recorded-day display cannot retain the core comparison.
const retainedCore: ForecastPresentation = {kind:"today-recorded",progress:{done:7,total:22,unit:"minutes"},core:{kind:"estimate",days:1,source:"QUESTION"},resumed:{success:1,total:1},completion:{kind:"conditional",plan:{remainingAmount:15,sessions:1,sessionAmount:15,lastAmount:15,unit:"minutes"},reason:"不足"}};
// @ts-expect-error Recorded-day completion uses CURRENT_STATE, never TODAY_DONE.
const wrongScenario: ForecastPresentation = {kind:"today-recorded",progress:{done:7,total:22,unit:"minutes"},resumed:{success:1,total:1},completion:{kind:"estimate",scenario:"TODAY_DONE",sources:{a:"QUESTION",b:"QUESTION_AND_RECORDS"},p50Label:"検証用",p80Label:"検証用"}};
// @ts-expect-error Missing origin is not a sufficient source for completion.
const invalidSource: ForecastPresentation = {kind:"forecast",progress:{done:15,total:16,unit:"minutes"},core:{kind:"estimate",days:1,source:"QUESTION"},resumed:{success:0,total:0},completion:{kind:"estimate",scenario:"TODAY_DONE",sources:{a:"NONE",b:"QUESTION"},p50Label:"今日",p80Label:"今日"}};
// @ts-expect-error Save-unknown carries no stale achieved state or previous numbers.
const stale: ForecastPresentation = {kind:"save-unknown",progress:{done:100,total:100,unit:"minutes"}};
void [fields,goalSlot,forecast,todaySlot,missingOrigin,invalidAnswer,uncontrolled,pending,retainedCore,wrongScenario,invalidSource,stale];
