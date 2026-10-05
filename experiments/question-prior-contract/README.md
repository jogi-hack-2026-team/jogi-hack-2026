# D-26 共通固定例の提案資料

**Supporting Artifact / Not a Source of Truth / 未採択**

[契約提案](../../docs/prediction/question-prior-contract-proposal.md)の計算・入力不正・保存／UI状態を同じIDで確認する資料。実Engine／HTTP／DB／UIの受入テストではない。

- [common-fixtures.json](common-fixtures.json)：計算18例、不正入力4例、保存／UI状態10例。
- [一覧](fixture-summary.md)と[数式確認結果](validation.json)。
- [build-fixtures.py](build-fixtures.py)：標準ライブラリFractionでBeta-Geometricの分位点と隣接ログを独立計算する。

Python 3がある環境で、リポジトリrootから実行する。PythonはこのSupporting資料の再現用で、製品runtimeの採択ではない。

```powershell
python experiments/question-prior-contract/build-fixtures.py
```

成功時は計算18／入力不正4／保存・UI10、independent_math_checkのPASSを表示し、このディレクトリのJSONと一覧を再生成する。失敗時は非0で終了する。Secret・DB・ネットワーク・外部packageは不要。

Pythonの再現確認はこの資料の数式整合と凍結値の読取り。非自明な完了DP9件は下記のNode再現へ分ける。revision・409・partial answer gate・DTOは未採択。質問値の校正・予測精度・UI理解は未検証。

固定例のconfigは現行Engineからの計算用参照値です。質問回答の初期BetaはmappingCandidateと各例のposteriorへ反映しており、config.prior=2を回答済み側の実際のpriorとして扱いません。新しい質問modeのmodelVersionや公開型を採択する資料ではありません。

## 完了DPの追加Evidence

[completion-goldens.json](completion-goldens.json)はPR118元HEAD `c3bd5ef`の18例から得た、非自明9件の完了日数・事後分布・draw hash・CDF境界を凍結したもの。[verify-completion.mjs](verify-completion.mjs)は公開済みEngineのsampler／DPだけを使うため、未公開のprior候補ファイルを必要としない。[completion-replay-results.json](completion-replay-results.json)に実行結果を保存した。

Node 22.15.1／Windows x64、TypeScript 5.8.3で再現を確認。コンパイラは既に導入したものを指定し、自動installしない。下の`$d26Compiler`を実在するTypeScript 5.8.3の`bin/tsc`へ置き換え、リポジトリrootから実行する（パス部分は置換が必要な例）。

```powershell
$d26Compiler = '<導入済みTypeScript 5.8.3のbin/tscのパス>'
node $d26Compiler --project packages/prediction/tsconfig.json
node experiments/question-prior-contract/verify-completion.mjs
node --test experiments/question-prior-contract/completion-oracle.test.mjs
```

コンパイラ呼出しで既存sourceからignoredなdistを生成する。再現スクリプトは共有RNGの全200drawのhashを確認し、9件のP50／P80、H=1095全日のDP／独立CDF一致、刈り込みあり／なしを確認して結果JSONを更新する。テストは独立CDF対整数重み列挙、9件の固定値、0／H超と旧入口の比較履歴の3件。失敗は非0で終了する。別runtimeのdraw hash不一致を、対応済み／同一goldenとは扱わない。

F03=3／6日、F07=3／11日、F14=2／2日。最大CDF差は約5.6e-16。独立なのは条件付き分布の計算法で、RNG／Beta samplerは共有する。参照CDF許容誤差1e-11はProductionの分位点epsilon1e-12と別で、後者は変更しない。校正・予測精度、別runtimeやT-14全条件を保証しない。

元のnumeric-snapshot候補＋実験adapterでは18例の観測・実績・事後・中心等を照合した。この元比較の材料gate13件・N04 RangeErrorは旧numeric入口の履歴としてJSONに残す。2026-10-05の最新担当ログ・manifestでは、新しい内部adapterがraw回答・保存済みmapping・a／b別出所とgateを接続し、13件を解消した。18例・完了DP9件は元の値に一致し、不正mapping形状はPredictionConfigError／INVALID_INTEGER／mapping配下のpathへ分類された。候補61＋独立CDF3テスト・型検査の成功はログ確認した担当検証で、本PRで61件を実行した件数や公開CIの成功には数えない。

最新検証記録時点のadapterは未公開・未commitで、公開`predict`・API／DB／UIは変わらない。この再現スクリプトも新adapterを呼ばず、公開済みの数学部品だけを検証する。保存context／revision、出所・version・errorの正式公開契約、保存／HTTP／UIの10統合例・409・Goal作成再送は接続前。具体契約・本番配線は未採択。
