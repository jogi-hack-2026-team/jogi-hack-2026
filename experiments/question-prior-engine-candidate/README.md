# PR118共通例とEngine候補の数値接続確認

**Supporting Artifact / Not a Source of Truth / 未採択・ローカル実験のみ。** Refs #71・#72・#73・#107・#117、[PR118](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/118) HEAD `c3bd5efd2e447fb7a021ad7c27a61de2127dd33a`。質問写像・強度・材料判定を正式採択した成果ではない。

既存[内部prior候補](../../packages/prediction/GOAL_PRIOR_CANDIDATE.md)はa/b別の数値snapshotを受け取るが、raw回答・部分回答・質問由来の表示gateを持たない。この実験はPR118の18共通計算例を別の[型付き候補adapter](../../packages/prediction/QUESTION_PRIOR_ADAPTER_CANDIDATE.md)へ渡し、元の数値入口との差分を明示する。公開predict・公開型・config・元の数値入口の状態判定は維持する。

## 実験の境界

[固定例](../../packages/prediction/tests/fixtures-pr118.json)は指定PR HEADのJSONを変更せず保管したもの。[verify.mjs](verify.mjs)は固定例の`mappingCandidate`を保存済みsnapshotとして型付き候補adapterへ渡す。提案のLOW/MID/HIGHを数値へ変換し、UNKNOWN/nullは共通Beta(2,2)へ補っても有効回答にはしない。a/bの質問・実遷移の材料と出所を独立に導出する。出所enumはこの実験での照合値であり、正式APIやUIラベルではない。

実際の`evaluateQuestionPriorAdapterCandidate`を使い、raw回答から観測・実績・posterior・出所・材料gate・中心・完了・conditionalPlanまでの出力を確認する。実験内へgate実装を複製しない。中心は既存BigInt、完了は既存の事後抽選とDPを呼ぶ。質問回答をログ件数・実績量へ足さず、今日DONE量や達成／記録済み優先を保つ。13例で元の数値入口の状態／不足理由と提案が異なる。候補adapterの5テスト内で13例の具体的な期待値を固定し、差を解消した。これは候補adapterの接続確認であり、正式入口の提案対応や採択完了ではない。

## 独立オラクルと支持範囲

完了日分布を日々の状態DPでなく、DONEから次のDONEまでの待ち時間の和で表す。DONE開始でN回必要なら、翌日に成功しない回数MをBinomial(N,1−a)として、到達日はN＋NegativeBinomial(M,b)。SKIPPED開始なら最初のGeometric(b)を追加してN−1回のDONE待ちを足す。負の二項CDFはBinomial(t,b)の尾確率で計算する。

この独立な閉形式を、四分の一刻みのa/b・両初期状態・0/1境界について全経路の整数重み列挙でも確認する。PR例は同じseedのK=200事後サンプルを既存Engine samplerから共有し、各サンプル条件付きのDPと独立CDFをH=1095の全日で比較する。非自明な9例のgoldenと閾値前後CDFを保存し、DPの刈り込みあり／なしは全PMFで一致した。

独立なのは完了分布の計算法であり、RNG・Beta samplerを別言語で独立再実装した検証ではない。CDF照合の許容誤差1e-11は浮動小数点の参照比較用で、Productionの分位点閾値epsilon=1e-12は変更しない。取得した9例は最大CDF差約5.6e-16で、同じ最小日を返した。真のBayes積分やユーザーの校正・精度、異なる採用runtimeでの同一goldenを保証しない。

## 固定した完了日数（P50 / P80）

| 例 | 日数 | 例 | 日数 |
| --- | --- | --- | --- |
| F03 | 3 / 6 | F06 | 4 / 5 |
| F07 | 3 / 11 | F08 | 2 / 4 |
| F09 | 2 / 4 | F10 | 2 / 3 |
| F11 | 6 / 7 | F13 | 4 / 5 |
| F14 | 2 / 2 | F17 | 0 / 0 |
| F18 | null / null | — | — |

Node 22.15.1、Windows、seed=20261012、K=200/H=1095で確認した。F17は今日の仮実行で届く0日、F18は必要3999回>Hのnullで、非自明DP9例の件数には含めない。保存／HTTP／UIの10統合仕様は実行していない。N03の未来日付は候補adapterからも既存PredictionInputErrorで拒否される。N04の不正shapeは旧数値入口のRangeErrorを保持し、候補adapterではPredictionConfigError／INVALID_INTEGER／mapping以下のpathへ分類した。raw構造不正とmapping構造不正は候補専用classで分類する。正式公開のreason/pathやHTTP変換は未採択。

## 再現

導入済みNode・TypeScriptでpackageのdistを生成後、repoルートで実行する。新install・ネットワーク・DB・Secretは不要。

```powershell
node packages/prediction/scripts/check.mjs test --tsc '<existing-compiler>'
node --test experiments/question-prior-engine-candidate/oracle.test.mjs
node experiments/question-prior-engine-candidate/verify.mjs packages/prediction/tests/fixtures-pr118.json
pwsh -NoProfile -File scripts/check-foundation.ps1
```

CLIはinput・posterior・出所・状態差分・日数golden・全200サンプル／hash・閾値前後CDF・実環境をJSONで出す。オラクルとの差や固定例の不一致は非0で終了する。候補adapterのraw→snapshot・部分回答補完・材料gate・source/version・エラー分類はローカル接続済み。正式採択後に保存context／mappingVersionの生成責任、公開DTO・エラー／HTTP変換と正式Engine入口を人間の合意に沿って整合する。

PR118の追加Evidence HEAD `c120eb12b773a02db8332f0fd26e3fb7d29fe0f4`では、同じ9例の日数goldenが共通例へ追記された。入力・写像・状態契約は変わっていないことを差分で確認した。このbranchの固定例は元HEADを保持し、goldenはoracle.test.mjsの明示期待値でも確認する。固定例はpackage単独のDocker検証でも読めるようtests配下へ一度だけ置く。

conditionalPlanの照合は入力から作り直さず、実adapterの結果を固定例と比較する。計画には今日の仮sessionを足し引きしない。候補エラーやVM、正式入口への統合方針は[責任境界とレビュー回答](../../packages/prediction/QUESTION_PRIOR_ADAPTER_CANDIDATE.md#レビュー質問optionalの扱い)へ集約する。

FEレビュー対応時にPR118 HEAD `6f1e40fc4861d238ecd63bcfd25c3acd77ffe16b`も読み取り、18例の入力・写像・中心／材料状態・conditionalPlanがbaselineと同じことを確認した。固定例の採択・追従は候補説明の手順で行う。
