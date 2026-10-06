# Goal別priorの内部候補

**Supporting Artifact / Not a Source of Truth。D-26の採択済み契約ではない。** Refs #71・#72・#73・#117・PR #115。今回の指示に基づく純粋コアの限定先行であり、#70のBLOCKED・正式Hard・各Issueの完了条件は維持する。

R-11の機能Scopeと分担はPR #115でProduct正本へ反映済みだが、質問から数値への写像・強度・部分回答／不明の補完・表示条件・保存編集・APIは未採択。この候補は、外側で用意した初期分布と実ログを同じ計算経路で検証するためだけの実装で、質問回答の解釈やUI／APIの配線は行わない。

## 内部境界と互換性

[goal-prior-candidate.ts](src/goal-prior-candidate.ts)の`evaluateGoalPriorCandidate`は`PredictionInput`と、a・bそれぞれの`alpha`・`beta`・`source`・`version`を持つ元snapshotを受け取る。aはDONE起点、bはSKIPPED起点で、更新はそれぞれ`(alpha+nDD, beta+nDS)`、`(alpha+nSD, beta+nSS)`。source/versionは由来を追う候補metadataで、正式なenum・DB項目・表示ラベルではない。結果にコピーして残すが、乱数seed・実績・観測日数・遷移数へは足さない。

採択前に部分回答の意味を決めないため、この内部入口はa・bの両方を要求する。初期snapshotと全量ログから毎回再計算し、前回posteriorへ重ねて加算する更新APIは作らない。現在のBigInt厳密比較とGamma抽選に合わせて、shapeは正の安全整数だけを検証する。小数shapeの扱いは正式採択・追加実装が必要で、D-26の値や強度を整数に決定した意味ではない。

候補configは既存のmodelVersion・samples・horizonDays・seedだけを受け取り、スカラーpriorを別途指定する型にはしない。数値写像や強度の設定は外側のsnapshot生成責任が採択された後に合わせる。

[predict.ts](src/predict.ts)の内部`calculateWithPrior`で既存の観測・中心指標・事後抽選・DPを共有する。中心分位点のBigInt厳密比較、K=200・H=1095、UNKNOWN跨ぎの除外、実績量、今日のDONE二重加算禁止、達成済み／今日記録済み／実績起点の不足判定は維持する。この数値snapshot入口では回答だけの仮の値を表示するgateを変更しない。raw回答と質問由来gateを確認する別の[PR118候補adapter](QUESTION_PRIOR_ADAPTER_CANDIDATE.md)を追加したが、公開predict・この数値入口の契約は維持する。

[index.ts](src/index.ts)・`PredictionInput`・`PredictionResult`・`DEFAULT_CONFIG`は変更しない。公開`predict(input, config)`は従来の共通スカラーprior（既定2）を使い、既存の結果形状を返す。候補入口・型はindexからexportしない。候補結果のconfigから共通スカラー`prior`を除き、使用した初期値を`priorSnapshot`に残すので、非対称priorを「共通prior=2」と報告しない。正式Engine入力・結果metadata・エラー契約・modelVersionの公開方針はD-26採択後に別途合わせる。

## 検証

既存の[ローカル検証](README.md#ローカル検証)に含まれる[9候補回帰テスト](tests/goal-prior-candidate.test.mjs)で、11固定例のdefault互換、a/bの独立更新、UNKNOWN、元snapshotからの訂正／回答変更、今日の実量、分布境界、determinism、出所の分離、shape／metadataのエラーを照合する。[型テスト](tests/type-contracts.ts)は公開入口への混入、部分snapshot、既存Resultへの誤代入を拒否する。

継続時は56テストの既存構成を保ち、未回答の既存入口（共通prior=2・実績起点の不足）と不完全な候補snapshotの拒否、snapshot A→B→A／既存入口への復帰、凍結した入力・snapshot・config、seed=0/1/uint32最大の再現性、a/bのalpha/betaそれぞれの最大安全整数と遷移加算のoverflow pathを追加照合した。未回答・片方回答の自動補完や回答解除の保存/APIは採択していない。source/versionは抽選列に混ぜず、候補の入れ替え後に以前の結果・乱数状態を持ち越さないことを確認する。

`scripts/check.mjs test`でdist生成後、package内で`node scripts/benchmark-goal-prior-candidate.mjs`を実行すると、合成priorに対するrequiredFutureDone=120/400/1095・K=200・H=1095各6回の入力・出力・実環境・全測定をJSONで出す。質問材料だけでadapterのDPへ入る同3条件もadapterCasesとして情報用に測る。既存500ms基準の超過はexit 1で、判定を弱めない。既存`node scripts/benchmark.mjs`も変更せず確認する。開発機での代表入力測定であり、採用環境・混合負荷・全ての候補分布の性能保証ではない。

## 正式統合前に決めること

- 質問の数値写像・強度・部分回答／不明・回答訂正の意味とsnapshot生成責任。
- 正式なEngine入力・source/versionの共有形式、API／DB／表示契約、表示gateと状態優先の共通固定例。
- shapeの有効範囲と計算予算。安全整数でも極端に非対称な分布では現行の逐次BigInt分位点計算が長時間になるため、今回の代表入力測定を任意の強度へ一般化しない。
- #70の採用workspace／runtime／runner整合、Human Review、採用環境のT-14とAPI／FE結合。#117のHardとReadyは解除しない。

正式値の採択や表示gate変更はこの候補の成功から推定しない。正本文書へ新たな採択内容を混ぜず、候補の説明と実コードへの入口だけを[package README](README.md)と[変更対応表](../../docs/change-map.md)へ置く。
