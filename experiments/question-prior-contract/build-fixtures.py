"""Independent exact reference for a PUBLIC, UNADOPTED D26 contract draft.

This validates proposed fixed examples, not production Engine/API/UI behavior.
No network, repository mutation, clock, DB, HTTP, or external dependencies.
"""
from copy import deepcopy
from datetime import date, timedelta
from fractions import Fraction
import json
from pathlib import Path

ROOT = Path(__file__).parent
TODAY = "2026-10-05"
MAP = {"LOW": (1, 3), "MID": (2, 2), "HIGH": (3, 1)}
DEFAULT = {"modelVersion": "behavior-persistence-m1-v1", "prior": 2,
           "samples": 200, "horizonDays": 1095, "seed": 20261012}

def log(day, status, amount=None):
    return {"localDate": f"2026-10-{day:02d}", "status": status, "amount": amount}

def make(case_id, note, a=None, b=None, logs=None, initial=60, total=100, session=15):
    return {"id": case_id, "note": note,
            "answers": {"a": a, "b": b},
            "input": {"goal": {"totalRequired": total, "initialProgress": initial,
                                "sessionAmount": session}, "logs": logs or [], "today": TODAY},
            "config": deepcopy(DEFAULT)}

def quantile(alpha, beta, denominator):
    survival = Fraction(1)
    for t in range(1, 10000):
        survival *= Fraction(beta + t - 1, alpha + beta + t - 1)
        if denominator * survival <= 1:
            return t
    raise AssertionError("Fixture quantile not reached")

def evaluate(case):
    raw = case["answers"]
    assert all(v is None or v in (*MAP, "UNKNOWN") for v in raw.values())
    i = case["input"]
    goal = i["goal"]
    logs = sorted(i["logs"], key=lambda x: x["localDate"])
    today = date.fromisoformat(i["today"])
    assert len({l["localDate"] for l in logs}) == len(logs)
    for l in logs:
        assert date.fromisoformat(l["localDate"]) <= today
        assert l["status"] in ("DONE", "SKIPPED")
        assert (isinstance(l["amount"], int) and l["amount"] > 0) if l["status"] == "DONE" else l["amount"] is None
    today_log = next((l for l in logs if l["localDate"] == i["today"]), None)
    today_status = today_log["status"] if today_log else "UNRECORDED"
    cutoff = today if today_log else today - timedelta(days=1)
    by_day = {date.fromisoformat(l["localDate"]): l for l in logs if date.fromisoformat(l["localDate"]) <= cutoff}
    counts = dict(nDD=0, nDS=0, nSD=0, nSS=0)
    for d, left in by_day.items():
        right = by_day.get(d + timedelta(days=1))
        if right:
            key = "n" + left["status"][0] + right["status"][0]
            counts[key] += 1
    actual = goal["initialProgress"] + sum(l["amount"] for l in logs if l["status"] == "DONE")
    qualified = {p: raw[p] in MAP for p in ("a", "b")}
    origin_n = {"a": counts["nDD"] + counts["nDS"], "b": counts["nSD"] + counts["nSS"]}
    beta = {p: MAP[raw[p]] if qualified[p] else (DEFAULT["prior"], DEFAULT["prior"]) for p in ("a", "b")}
    posterior = {"a": {"alpha": beta["a"][0] + counts["nDD"], "beta": beta["a"][1] + counts["nDS"]},
                 "b": {"alpha": beta["b"][0] + counts["nSD"], "beta": beta["b"][1] + counts["nSS"]}}
    source = {p: ("QUESTION_AND_RECORDS" if qualified[p] and origin_n[p] else
                  "QUESTION" if qualified[p] else "RECORDS" if origin_n[p] else "NONE") for p in ("a", "b")}
    eligible = {p: qualified[p] or origin_n[p] > 0 for p in ("a", "b")}
    completed = actual >= goal["totalRequired"]
    remaining = max(0, goal["totalRequired"] - actual)
    sessions = (remaining + goal["sessionAmount"] - 1) // goal["sessionAmount"]
    observations = {**counts, "effectiveTransitions": sum(counts.values()),
                    "observedDays": (cutoff - min(by_day)).days + 1 if by_day else 0,
                    "recordedDays": len(by_day)}
    if completed:
        core = {"status": "not_applicable", "reason": "COMPLETED"}
        completion = {"status": "completed"}
    else:
        if today_log:
            core = {"status": "not_applicable", "reason": "TODAY_RECORDED"}
        elif not eligible["b"]:
            core = {"status": "insufficient", "reason": "NO_SKIP_ORIGIN_TRANSITION"}
        else:
            b = posterior["b"]
            core = {"status": "available", "g50": quantile(b["alpha"], b["beta"], 2),
                    "g80": quantile(b["alpha"], b["beta"], 5)}
        if not eligible["a"]:
            completion = {"status": "insufficient", "reason": "NO_DONE_ORIGIN_TRANSITION"}
        elif not eligible["b"]:
            completion = {"status": "insufficient", "reason": "NO_SKIP_ORIGIN_TRANSITION"}
        else:
            projected = actual + (goal["sessionAmount"] if today_status == "UNRECORDED" else 0)
            future_count = max(0, (goal["totalRequired"] - projected + goal["sessionAmount"] - 1) // goal["sessionAmount"])
            completion = {"status": "available", "scenario": "TODAY_DONE" if today_status == "UNRECORDED" else "CURRENT_STATE",
                          "requiredFutureDone": future_count}
            if future_count == 0:
                completion.update(p50Days=0, p80Days=0)
            elif future_count > DEFAULT["horizonDays"]:
                completion.update(p50Days=None, p80Days=None)
            else:
                completion["quantileCheck"] = "Pending adopted-runtime Engine fixture: deterministic same input/config; 0<=p50<=p80<=H when finite; finite p80 implies finite p50."
    return {"mode": "QUESTION_PRIOR_CANDIDATE" if any(qualified.values()) else "LEGACY",
            "todayStatus": today_status, "progress": {"done": actual, "total": goal["totalRequired"], "completed": completed},
            "observations": observations, "posterior": posterior,
            "evidenceSource": source, "eligible": eligible, "coreMetric": core, "completion": completion,
            "conditionalPlan": {"remainingAmount": remaining, "remainingSessions": sessions,
                                "lastSessionAmount": remaining - (sessions - 1) * goal["sessionAmount"] if sessions else 0}}

cases = [
    make("F01", "未回答。共通Beta(2,2)は本人回答として表示しない。"),
    make("F02", "両方不明。欠測を50%へ変換しない。", "UNKNOWN", "UNKNOWN"),
    make("F03", "両方MID。数値がF01と同じでも明示回答の有無で表示可能条件が異なる。", "MID", "MID"),
    make("F04", "Q2だけLOW。中心は回答由来、完了は不足・あと3回分。", None, "LOW"),
    make("F05", "Q1だけHIGH。中心も完了もbの材料不足。", "HIGH", None),
    make("F06", "a LOW/b HIGH。中心はbだけを使う。", "LOW", "HIGH"),
    make("F07", "aは実績DD、bは質問LOW。回答＋実績の混在。", None, "LOW", [log(3,"DONE",15),log(4,"DONE",15)], initial=30),
    make("F08", "aは質問HIGH、bは実績SD。", "HIGH", None, [log(3,"SKIPPED"),log(4,"DONE",15)], initial=45),
    make("F09", "a HIGH/b LOWにSD1回を加える。", "HIGH", "LOW", [log(3,"SKIPPED"),log(4,"DONE",15)], initial=45),
    make("F10", "F09の当初b回答をHIGHへ訂正。実ログを2回加算しない。", "HIGH", "HIGH", [log(3,"SKIPPED"),log(4,"DONE",15)], initial=45),
    make("F11", "UNKNOWNをまたぐ2ログ。記録2件でも遷移0、出所は質問のみ。", "LOW", "HIGH", [log(1,"DONE",10),log(3,"SKIPPED")], initial=30),
    make("F12", "回答なしの実績SD1回。既存中心と不足条件を維持。", None,None,[log(3,"SKIPPED"),log(4,"DONE",15)],initial=45),
    make("F13", "不明回答＋DS/SD実績。完全にlegacyと同じ計算。", "UNKNOWN","UNKNOWN",[log(2,"DONE",15),log(3,"SKIPPED"),log(4,"DONE",15)],initial=30),
    make("F14", "今日DONE量7。sessionAmount15へ書き換えず、中心比較を出さない。", "LOW","HIGH",[log(4,"SKIPPED"),log(5,"DONE",7)],initial=0,total=22),
    make("F15", "今日SKIPPEDのみ。質問があってもTODAY_RECORDED優先。", "HIGH","UNKNOWN",[log(5,"SKIPPED")]),
    make("F16", "実績達成済み。質問・不足・今日記録状態より達成優先。", "LOW","LOW",initial=100),
    make("F17", "残量1。今日やった仮定の完了0日でも実績は15のまま。", "MID","MID",initial=15,total=16),
    make("F18", "Hを超える必要回数。片方の分位点を有限と偽らない。", "HIGH","HIGH",initial=0,total=4000,session=1),
]
for c in cases:
    c["expected"] = evaluate(c)

by_id = {c["id"]:c for c in cases}
assert by_id["F01"]["expected"]["posterior"] == by_id["F03"]["expected"]["posterior"]
assert by_id["F01"]["expected"]["coreMetric"]["status"] == "insufficient"
assert by_id["F03"]["expected"]["coreMetric"] == {"status":"available","g50":1,"g80":3}
assert by_id["F04"]["expected"]["coreMetric"] == {"status":"available","g50":3,"g80":12}
assert by_id["F09"]["expected"]["coreMetric"] == {"status":"available","g50":2,"g80":5}
assert by_id["F10"]["expected"]["coreMetric"] == {"status":"available","g50":1,"g80":1}
assert by_id["F09"]["expected"]["observations"] == by_id["F10"]["expected"]["observations"]
assert by_id["F11"]["expected"]["observations"] == dict(nDD=0,nDS=0,nSD=0,nSS=0,effectiveTransitions=0,observedDays=4,recordedDays=2)
assert by_id["F14"]["expected"]["progress"]["done"] == 7
assert by_id["F16"]["expected"]["coreMetric"]["reason"] == "COMPLETED"
assert by_id["F17"]["expected"]["completion"]["p50Days"] == 0 and not by_id["F17"]["expected"]["progress"]["completed"]
assert by_id["F18"]["expected"]["completion"]["p50Days"] is None

negative = [
    {"id":"N01","method":"PATCH","path":"/api/goals/fixture-goal-01","actor":"authenticated owner","request":{"expectedRevision":7,"questionPrior":{"a":"CERTAIN","b":"LOW"}},"expected":{"layer":"API structure validation","statusCandidate":422,"engineCalled":False,"saved":False}},
    {"id":"N02","method":"PATCH","path":"/api/goals/fixture-goal-01","actor":"authenticated owner","request":{"expectedRevision":7,"questionPrior":None},"expected":{"layer":"API structure validation","statusCandidate":422,"engineCalled":False,"saved":False},"note":"clear requires explicit {a:null,b:null}; PATCH field omitted means keep."},
    {"id":"N03","input":{**deepcopy(by_id["F03"]["input"]),"logs":[log(6,"DONE",15)]},"config":deepcopy(DEFAULT),"expected":{"layer":"Engine","errorClass":"PredictionInputError","saved":False}},
    {"id":"N04","input":deepcopy(by_id["F03"]["input"]),"resolvedPrior":{"a":{"alpha":2,"beta":2},"b":{"alpha":0,"beta":4}},"expected":{"layer":"Engine prior validation","errorClassCandidate":"PredictionConfigError","fallbackToSuccess":False},"note":"Complete numeric test material; exact snapshot metadata, signature, reason/path await Engine review."},
]
integration = [
    {"id":"I01","case":"same answer retry","given":{"currentGoalRevision":8,"answerAppliedRevision":7,"answers":{"a":"HIGH","b":"HIGH"}},"request":{"expectedRevision":7,"questionPrior":{"a":"HIGH","b":"HIGH"}},"expectedCandidate":{"result":"same-value no-op after auth/context/mapping check","revision":8,"answerAppliedRevision":7,"writes":0}},
    {"id":"I02","case":"different stale correction","given":{"currentGoalRevision":8,"answers":{"a":"HIGH","b":"HIGH"}},"request":{"expectedRevision":7,"questionPrior":{"a":"HIGH","b":"LOW"}},"expectedCandidate":{"status":409,"writes":0,"recalculate":False,"ui":"refetch; keep draft separate; explicit resubmit required"}},
    {"id":"I03","case":"valid correction","given":{"currentGoalRevision":7,"answers":{"a":"HIGH","b":"LOW"}},"request":{"expectedRevision":7,"questionPrior":{"a":"HIGH","b":"HIGH"}},"expectedCandidate":{"goalRevision":8,"answerAppliedRevision":8,"rawLogsUnchanged":True,"fixedCalculation":"F09 -> F10"}},
    {"id":"I04","case":"allowed action amount/unit edit","given":{"sessionAmount":15,"activeAnswerContext":{"sessionAmount":15}},"request":{"sessionAmount":30},"expectedCandidate":{"priorInvalidated":True,"historicalDoneAmountsUnchanged":True,"logsDeleted":False,"newAnswerRequiredForQuestionMode":True,"stateRevisionIncremented":True}},
    {"id":"I05","case":"late prediction response","given":{"acceptedRevision":9,"sessionGeneration":2},"response":{"context":{"revision":8},"sessionGeneration":2},"expectedCandidate":{"accepted":False,"newerPredictionOverwritten":False}},
    {"id":"I06","case":"logout / other user generation","given":{"sessionGeneration":3},"response":{"context":{"revision":99},"sessionGeneration":2},"expectedCandidate":{"accepted":False,"cachePopulated":False}},
    {"id":"I07","case":"save success / prediction refetch fails","expectedCandidate":{"saveStatus":"saved","forecastStatus":"refresh_failed","automaticWriteRetry":False,"oldForecastLabel":"not current","action":"refetch only"}},
    {"id":"I08","case":"network disconnect / save unknown","expectedCandidate":{"saveStatus":"unknown","automaticWriteRetry":False,"action":"read latest answers/context/revision first; if different, require explicit resubmit"}},
    {"id":"I09","case":"one captured time / local date","given":{"goalTimezone":"Asia/Tokyo","capturedUtc":"2026-10-04T14:59:59Z"},"expectedCandidate":{"today":"2026-10-04","yesterday":"2026-10-03","readAllPredictionInputsFromOneSnapshot":True,"deriveTodayAgainMidCalculation":False}},
    {"id":"I10","case":"UI ownership and priority","expectedCandidate":{"stateOwner":"FE controller","KaitoComponentFetches":False,"priority":["transport/input failure","completed","today_recorded","origin eligibility"],"mutableSharedFormFilesOwner":"FE"}},
]

payload={"status":"SUPPORTING PROPOSAL / NOT ADOPTED / NOT IMPLEMENTED","sourceMain":"725e2607198514254d42fb585d9a85e11ed7b89a","sourceAdoptionPrHead":"1c029c52646bfb8b95d6f5fecabdf599fc5efc81","mappingCandidate":{"version":"question-prior-s4-v1-candidate","strength":4,"values":{k:{"alpha":v[0],"beta":v[1]} for k,v in MAP.items()},"unknownAndMissing":"no qualifying prior; internal common Beta(2,2) is not a user answer"},"configUnchanged":DEFAULT,"calculationExamples":cases,"negativeExamples":negative,"integrationExamples":integration,"completionQuantiles":"Nontrivial DP/Monte Carlo numeric goldens intentionally pending adopted-runtime Engine verification. Status/source/posterior/core exact quantiles/zero and >H cases are specified."}
(ROOT/"common-fixtures.json").write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding="utf-8",newline="\n")
rows=["| ID | 材料 | a事後 / b事後 | 中心 | 完了 | 実績 / 実遷移 | あと何回分 |","| --- | --- | --- | --- | --- | --- | --- |"]
for c in cases:
    e=c["expected"];p=e["posterior"];core=e["coreMetric"]
    core_txt=f"g50={core['g50']}, g80={core['g80']}" if core["status"]=="available" else core.get("reason",core["status"])
    comp=e["completion"];comp_txt=comp["status"]+" "+comp.get("reason",comp.get("scenario",""))
    rows.append(f"| {c['id']} | {c['answers']['a'] or '未回答'} / {c['answers']['b'] or '未回答'} | Beta({p['a']['alpha']},{p['a']['beta']}) / Beta({p['b']['alpha']},{p['b']['beta']}) | {core_txt} | {comp_txt.strip()} | {e['progress']['done']} / {e['observations']['effectiveTransitions']} | {e['conditionalPlan']['remainingSessions']} |")
(ROOT/"fixture-summary.md").write_text("# 共通固定例（未採択案）\n\n"+"\n".join(rows)+"\n\n計算例18件、入力不正例4件、保存／UI統合例10件。実装のテスト成功件数ではありません。完了DPの非自明な日数goldenは未算出で、既存RNG・採用runtime・Engine拡張の検証で追加します。\n",encoding="utf-8",newline="\n")
report={"calculation_examples":len(cases),"negative_specifications":len(negative),"integration_specifications":len(integration),"independent_math_check":"PASS: exact Fraction Beta-Geometric quantiles, actual adjacency/counts, metadata, amount and priority invariants","production_tests_run":False,"numeric_calibration_verified":False,"completion_dp_goldens_verified":False}
(ROOT/"validation.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8",newline="\n")
print(json.dumps(report,ensure_ascii=True,indent=2))
