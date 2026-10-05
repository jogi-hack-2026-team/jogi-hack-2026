# PR118質問priorの候補adapter

**Supporting Artifact / Not a Source of Truth / 未採択。** [PR118](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/118) HEAD `c3bd5efd2e447fb7a021ad7c27a61de2127dd33a`の提案に対する候補接続実装。Refs #71・#72・#73・#117。D-26の正式契約、#70のBLOCKED、Hard、Ready、Issue受入の変更ではない。

[question-prior-adapter-candidate.ts](src/question-prior-adapter-candidate.ts)の`evaluateQuestionPriorAdapterCandidate`へ、既存`PredictionInput`、raw回答a/b、呼び出し側が渡す保存済みmapping snapshotをまとめて渡す。結果は計算結果と`priorSnapshot`、コピーした`rawAnswers`、`mappingVersion`、a/b別`evidenceSource`／`eligible`、`conditionalPlan`を持つ。indexからexportせず、公開predict・公開型・DEFAULT_CONFIG・旧数値snapshot入口を維持する。

## 呼び出し側との受け渡し

```ts
import { evaluateQuestionPriorAdapterCandidate } from './src/question-prior-adapter-candidate.js';

const result = evaluateQuestionPriorAdapterCandidate({
  prediction, // Goalのtodayと実ログ全量を持つ既存PredictionInput
  answers: { a: savedRawA, b: savedRawB }, // 両キー必須。LOW/MID/HIGH/UNKNOWN/null
  mapping: savedMappingSnapshot, // { version, values: { LOW, MID, HIGH } }
}, config); // modelVersion/samples/horizonDays/seed。省略時は既存既定値
```

mappingの各値は`{ alpha, beta }`。LOW/MID/HIGHの具体値を本体に固定せず、固定例では提案の(1,3)/(2,2)/(3,1)を渡す。保存済みsnapshotの取得と検証、APIでキーが省略された場合の正規化、context／revision／mappingVersionの永続化は呼び出し側の未採択境界。clientから来た数値を無条件に信頼してよいというAPI設計ではない。

UNKNOWN/nullは内部Beta(2,2)へ補完するが質問材料にはしない。MIDとfallbackは同じ数値でもraw／sourceが異なる。aは実nDD+nDS、bは実nSD+nSSが正なら記録材料を持つ。sourceは候補enum NONE/QUESTION/RECORDS/QUESTION_AND_RECORDS。質問をログ件数・実績へ足さず、UNKNOWNを跨ぐ遷移は作らない。

中心はb材料、完了はa/b両材料を要求する。達成済みと中心の今日記録済みの優先を保ち、未記録の今日だけ仮sessionを引く。今日のDONE実量を二度加算しない。必要0回は0日、必要回数>Hはnull。元数値入口で既にavailableならその結果を再利用し、重複DPを避ける。日数計算は内部[completion-scenario.ts](src/completion-scenario.ts)を公開predictと共有し、BigInt中心、K=200/H=1095、既存sampler／DPは維持する。

## 候補エラー分類

| 入力 | 候補で返す例外 | reason / path |
| --- | --- | --- |
| 回答blockなし／構造不正 | QuestionPriorAdapterCandidateError、kind=input | INVALID_ANSWERS / answers |
| a/bキーなし・未定義・未対応選択肢 | 同class、kind=input | INVALID_ANSWER / answers,aまたはb |
| mappingなし・空version・選択肢snapshotなし | 同class、kind=config | INVALID_MAPPING / mapping以下 |
| alpha/betaが非正・小数・NaN・無限・unsafe | 既存PredictionConfigError | INVALID_INTEGER / mapping,values,選択肢,shape |
| 不正な実日付・重複・未来・量 | 既存PredictionInputError | 元Engineのreason/pathを維持 |

pathはコピーしてfreezeする。全3選択肢のsnapshotを検証し、未使用の破損もfallbackで成功させない。未知の例外は握りつぶさない。候補class・reason/pathは公開採択済みDTOではなく、HTTP statusCode／response codeを決めない。構造の整ったPredictionInputの意味検証は既存Engineへ渡す。

## 確認済みと残る採択

[5 adapterテスト](tests/question-prior-adapter-candidate.test.mjs)で18共通例、13件の状態／不足理由の具体期待値、材料判定、raw／mapping不正、未来日付、訂正／解除、凍結入力、出力コピー、seed再実行を確認する。従来56テストを保持し、package全体は61テスト。独立CDFオラクル3テストと[再現手順](../../experiments/question-prior-engine-candidate/README.md)は別に実行する。9例のDP goldenと全200サンプル、閾値前後CDFは従来実験と同一。候補CIの結果はPRの同HEAD Actionsで別に確認する。

候補内の13接続差とshape分類は具体実装で解消した。残る判断はD-26の写像・強度・補完・gate・共有enum／versionの正式採択、保存context／revision／訂正責任、公開Engine/API DTOとエラー／HTTP変換、採用workspace／runtime／runnerとの整合。保存・HTTP・UIの10統合仕様は実行していない。任意の非対称shapeの性能や校正精度へこの結果を一般化しない。具体契約の採択と別メンバーのレビュー前にMergeしない。

## 条件付き計画とFE／BEへの責任境界

adapterは実績の残量から`conditionalPlan = { remainingAmount, remainingSessions, lastSessionAmount }`を返す。残量は`max(0, totalRequired − actualDone)`、回数は残量÷sessionAmountの切り上げ、最後の量は残量−(回数−1)×sessionAmount（回数0なら0）。100／60済み／1回15なら40・3・10。今日の仮実行は引かず、DONE実量はactualDoneへ一度だけ含める。達成済みは0・0・0、F17は日数0でも残回数1。これは設定量で続ける場合の量と回数で、予測日数ではない。

Engineが数値を計算し、BEが採択するDTOへ渡し、FEがGoalの単位・文言・表示優先に合わせて描画する案。FEによる独自再計算を必要としない。F15でも値を返すが、どの状態で描画するか、既存Goal不足表示を置換するかはPR118／D-26の採択待ち。公開predictへconditionalPlanを追加しない。候補文書の式と共通固定例に合わせた接続であり、Product正本の未採択表示規則を確定しない。

## レビュー質問・Optionalの扱い

- 候補の`NO_*_ORIGIN_TRANSITION`は回答も実遷移もない不足を表す。FEは`evidenceSource`と併せて候補文言を選ぶ想定とするが、正式reason／文言はD-26で合意する。
- `eligible`は毎回source≠NONEから導出し、保存・編集しない。VMが確定したとき冗長な項目を落とすかをFE／BEで揃える。
- 構造破損・数値shape不正・旧数値入口の3例外は互換性と修正箇所を区別するため候補では保持する。公開reason/path／HTTP変換は採択時に整合し、旧RangeErrorを今回変更しない。
- `PR118:`は提案の出所タグ。採択時に共有source/versionと保存mappingの移行責任を確認して置換する。乱数seedへタグを混ぜない。
- 固定例はc3bd5efをbaselineとして保持。最新PR118の入力・数学・状態が変わったら、変更理由とgolden差をレビューして別commitで追従する。文言／API／UIだけの提案変更ではEngine fixtureを黙って変更しない。
- 正式入口への昇格／置換は今は決めない。D-26と#70の採択契約に合わせ、公開legacy互換・保存snapshot・workerでのerror受け渡しを確認して別の統合変更にする。候補成功だけで昇格しない。
- [候補benchmark](scripts/benchmark-goal-prior-candidate.mjs)に質問だけでDPへ入る120／400／1095回の情報用ケースを追加した。全入力・強度の性能保証や新ゲートにはしない。
