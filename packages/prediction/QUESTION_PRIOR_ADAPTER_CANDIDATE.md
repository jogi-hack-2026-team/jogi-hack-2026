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

[5 adapterテスト](tests/question-prior-adapter-candidate.test.mjs)で18共通例、13件の状態／不足理由の具体期待値、材料判定、raw／mapping不正、未来日付、訂正／解除、凍結入力、出力コピー、seed再実行を確認する。従来56テストとadapter 5件を保持し、下記handoff 3件を加えてpackage全体は64テスト。独立CDFオラクル3テストと[再現手順](../../experiments/question-prior-engine-candidate/README.md)は別に実行する。9例のDP goldenと全200サンプル、閾値前後CDFは従来実験と同一。候補CIの結果はPRの同HEAD Actionsで別に確認する。

候補内の13接続差とshape分類は具体実装で解消した。残る判断はD-26の写像・強度・補完・gate・共有enum／versionの正式採択、保存context／revision／訂正責任、公開Engine/API DTOとエラー／HTTP変換、採用workspace／runtime／runnerとの整合。保存・HTTP・UIの10統合仕様は実行していない。任意の非対称shapeの性能や校正精度へこの結果を一般化しない。具体契約の採択と別メンバーのレビュー前にMergeしない。

## 条件付き計画とFE／BEへの責任境界

adapterは実績の残量から`conditionalPlan = { remainingAmount, remainingSessions, lastSessionAmount }`を返す。残量は`max(0, totalRequired − actualDone)`、回数は残量÷sessionAmountの切り上げ、最後の量は残量−(回数−1)×sessionAmount（回数0なら0）。100／60済み／1回15なら40・3・10。今日の仮実行は引かず、DONE実量はactualDoneへ一度だけ含める。達成済みは0・0・0、F17は日数0でも残回数1。これは設定量で続ける場合の量と回数で、予測日数ではない。

[PR118の調整案](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/118#issuecomment-5997839152)と[PR120の候補Plan型](https://github.com/jogi-hack-2026-team/jogi-hack-2026/blob/0d99ae7b5e2a16ca143efdab205bc5fd06e15bf8/experiments/question-prior-ui-candidate/src/presentation-types.ts)に対する受け渡し案を次の表に固定する。PR120の型をこのpackageへimport／コピーせず、正式共有DTOにも採択しない。

| Engine／同じGoal snapshotの値 | PR120 Plan | 責任 |
| --- | --- | --- |
| conditionalPlan.remainingAmount | remainingAmount | Engineが実進捗から計算済み。BE／FEはコピー |
| conditionalPlan.remainingSessions | sessions | FEのview生成で名前を変えるだけ |
| conditionalPlan.lastSessionAmount | lastAmount | FEのview生成で名前を変えるだけ |
| Engine入力goal.sessionAmountと同じ設定量 | sessionAmount | BEが同じ計算snapshotの値を付加。最新量を別取得して混ぜない |
| Engineにはunit入力・出力なし | unit | BEが同じGoal snapshotの単位を付加。FEは採択する共有単位から候補Unitへ対応 |

Engineが数値を一度計算し、BEが同じGoal・ログ・設定量・単位のsnapshotにまとめた応答を渡し、FEが名称とviewへ対応させる案。BE／FEで残量の差し引き・ceil・最後の量を再計算しない。新しいsnapshot ID／revision／API項目の形式はここでは決めない。PR120の候補Unitはminutes／sessionsだが、BEの共有enumからの変換と表示ラベルはD-26の確認対象で、Engineにunitを増やす判断ではない。

例として残量40・回数3・最後10のEngine結果には、BEが同じsnapshotのsessionAmount=15とunitを付加し、FEが`{ remainingAmount: 40, sessions: 3, lastAmount: 10, sessionAmount: 15, unit }`へ値を移す。FEはエラー／再取得待ち・達成済み・今日記録済みの優先を先に解決する。達成済みの計画0／0／0を条件付き表示へ無理に渡さずcompleted viewへ進む。F15でも値を返すが、どの状態で描画するか、既存Goal不足表示を置換するかはPR118／D-26の採択待ち。公開predictへconditionalPlanを追加しない。候補文書の式と共通固定例に合わせた接続であり、Product正本の未採択表示規則を確定しない。

## レビュー質問・Optionalの扱い

- 候補の`NO_*_ORIGIN_TRANSITION`は回答も実遷移もない不足を表す。FEは`evidenceSource`と併せて候補文言を選ぶ想定とするが、正式reason／文言はD-26で合意する。
- `eligible`は毎回source≠NONEから導出し、保存・編集しない。VMが確定したとき冗長な項目を落とすかをFE／BEで揃える。
- 構造破損・数値shape不正・旧数値入口の3例外は互換性と修正箇所を区別するため候補では保持する。公開reason/path／HTTP変換は採択時に整合し、旧RangeErrorを今回変更しない。
- `PR118:`は提案の出所タグ。採択時に共有source/versionと保存mappingの移行責任を確認して置換する。乱数seedへタグを混ぜない。
- 固定例はc3bd5efをbaselineとして保持。最新PR118の入力・数学・状態が変わったら、変更理由とgolden差をレビューして別commitで追従する。文言／API／UIだけの提案変更ではEngine fixtureを黙って変更しない。
- 正式入口への昇格／置換は今は決めない。D-26と#70の採択契約に合わせ、公開legacy互換・保存snapshot・workerでのerror受け渡しを確認して別の統合変更にする。候補成功だけで昇格しない。
- [候補benchmark](scripts/benchmark-goal-prior-candidate.mjs)に質問だけでDPへ入る120／400／1095回の情報用ケースを追加した。全入力・強度の性能保証や新ゲートにはしない。

## BEレビューの追加確認と入口・mappingの提案

[BEレビュー](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/119#pullrequestreview-5417166192)は2bea188に対するCOMMENTEDで、候補範囲のBlockingなしとFE修正3件の確認を記録した。正式Approve、D-26採択、最終HEADの受入とは区別する。

**入口の提案（未採択）：** 候補の接続では、有効回答の有無でEngine入口を分岐せず、解決済みraw＋mappingを常にadapterへ一度渡す案を推奨する。全18入力×null／UNKNOWNでprogress・todayStatus・observations・posterior・coreMetric・completionが公開predictと一致する回帰を追加した。未回答でも出所とconditionalPlanを同じ候補結果から返せるため、BEの予測呼出しを二度に増やす必要がない。公開predictは既存利用者の互換入口として維持する。

PR118 HEAD `b7400757f1ee7c7beeb37640f7ad9582d770b121`の7節3も常時adapterの接続案へ同期済みであり、現時点では両PRとも未採択の提案として扱う。常時adapterへ渡すための有効なmapping snapshotの解決はBEの責任案。既存Goalに保存mappingがない場合のversion付与・互換解決は採択時に明記し、testsの写像をProductionから読み込んだり、現行versionへ黙って差し替えたりしない。正式なAPIレスポンスの形は未採択で、常時呼出し案だけでは統合済みにならない。

**現行mappingの共有案（未採択）：** D-26採択後、version付きの選択肢→Beta値を純粋な共有定義の一か所へ置き、BEの初回保存とEngineのsnapshot検証が同じ定義を参照する案を推奨する。配置候補はprediction package内の独立moduleだが、正式export・enum・数値・強度・version更新方法はBE／Engineの採択で決める。BEは採択済みの現行定義からGoalへsnapshotを保存し、Engineは保存された値を使う。既存snapshotを最新定義で上書きしない。現候補にProduction定数を追加せず、fixtureは再現用だけに保つ。

**worker受け渡し：** BE実測ではpostMessage(error)で候補kind/reason/pathが落ち、未捕捉errorイベントでもinstanceof分類を維持できない。worker内でname／kind／reason／pathをplain objectへ詰め替える対応はBE #77へ引き継ぐ。候補classを今回変更せず、正式wire形式・HTTP変換はBE側で採択する。Engineのメッセージ文字列を解析して分類する方式にしない。

## 解決済みsnapshotとworkerの接続テスト例

[3 handoffテスト](tests/question-prior-handoff.test.mjs)は、[保存snapshotの固定例](tests/examples/question-prior-handoff.mjs)と[一回限りのworker例](tests/examples/question-prior-worker-copy.mjs)を使い、実候補adapterを呼ぶ。通常のpackage testコマンドに含まれ、Node matrixとDockerでも実行する。

- F09／F15で保存raw＋初期mappingを選び、別の現行mappingや前回posteriorを変更しても結果が変わらないことを確認する。同じ解決済みsnapshotのunit／sessionAmountを付加し、conditionalPlanを値のコピーと名称変更だけでPlanへ渡す固定例も確認する。
- worker内で既知classを判別し、name／reason／pathと候補classのkindをplain objectへコピーする。回答不足、mapping選択肢不足、非正shape、未来ログの4例で分類が維持され、生のError転送ではkind／reason／pathが失われることを確認する。コピーにはmessage／stackを含めない。
- 未知のTypeErrorはworker失敗として呼出し側へ伝わり、入力不正や成功値へ変換しない。

固定例はBEがcontextを解決済みで、設定量がPredictionInputと一致するという前提を置く。recordStartDateは例の付帯値で、Engineへ渡さず、日付意味や開始日policyを決めない。context／revision／所有権の検証、保存resolver、API route、worker poolは実装していない。rawErrorとsourcePathFrozenは比較用テスト診断だけで実API項目ではない。plain objectの形も正式wire DTOとして採択せず、BE #77の実装・HTTP変換へ引き継ぐ。PR118の保存・HTTP・UIの10統合仕様を実行済みとは扱わない。
