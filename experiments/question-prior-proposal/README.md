# 質問由来priorと条件付き計画の局所試作

Supporting Artifact / Not a Source of Truth。未採択・合成数値のみ。自己申告の経験回答は実ActionLogへ加算しない。DB・HTTP・画面・本番Engineは実装していない。

実行前提はNode24.21.0と既存TypeScript compiler。ネットワーク、追加package、token、DB不要。NodeのTypeScript実行は型検査ではないため、別途strict tscを実行する。

このディレクトリでPowerShell7から実行する：

```powershell
$taskNode = 'node' # Node 24.21.0を検証。既存nodeへのパスを指定してもよい
$taskTsc = '<既存のtypescript/bin/tscへのパス>' # 追加install不要
& $taskNode --test test/prototype.test.mjs
& $taskNode $taskTsc --noEmit -p tsconfig.json
& $taskNode analyze.mjs
& $taskNode historical/reference/bgq-boundary-check.mjs
& $taskNode historical/reference/dp-truncation-check.mjs
```

別環境では既存node/tscのパスを置き換える。全体確認と出力保存は `& $taskNode verify.mjs $taskTsc`。`pwsh -NoProfile -File verify.ps1 -NodePath $taskNode -TscPath $taskTsc`も同じNode runnerを呼ぶ。Node runnerがstdout/stderrのUTF-8 bytesを直接保存し、型検証が無出力でもゼロbyteのログを作る。失敗時はexit/errorで停止し、未成功のチェックを成功扱いにしない。runnerはresults内の生成物だけを更新する。

| ファイル | 役割 |
| --- | --- |
| [src/prototype.ts](src/prototype.ts) | pure adapter。v1 mapping・a/b source・初期snapshot、raw日付・量・起点、posterior、exact g、baseline／未採択表示案 |
| [test/prototype.test.mjs](test/prototype.test.mjs) | state・data integrity・数値境界・独立全経路オラクル・provenance回帰 |
| [test/type-contract.ts](test/type-contract.ts) | strict type契約。ActionLogに回答や性格分類を入れない型の境界 |
| [reference/completion-dp.mjs](reference/completion-dp.mjs) | 原調査のDPの無変更コピー。SHAをrawと照合 |
| [analyze.mjs](analyze.mjs) | 18候補・起点別0/1/4/12感度・5seed・reference DP計測、保存JSON例 |
| [results/analysis.json](results/analysis.json) | 新しい算術比較raw。ストレス入力を実観測や共同chronologyと扱わない |
| [historical/REPORT.md](historical/REPORT.md) | 2026-10-03の元結論。10/7の記述は歴史的記録 |
| [historical/run.mjs](historical/run.mjs)／[historical/results/raw.json](historical/results/raw.json) | 元580ハーネスと3.1MBの完全raw。元artifactを加工・上書きしない |
| [SOURCES.md](SOURCES.md) | 一次研究の支持範囲。mappingやstrength4/8の校正証拠ではない |
| [results/VERIFICATION.md](results/VERIFICATION.md) | 実行済みと未検証の結果 |

580の再現は`verify.mjs`がrun.mjs/referenceを一時フォルダへコピーし、元README名を復元して実行する。raw／summaryをresults/reproduced-580へ保存する。元raw/summary/sourceは保存したまま。数値はfixed seedで再現するが日時・性能は変わる。checks.lengthとassertionsの一致、元rawとコピーSHA一致を確認する。[独立レビューcheck](ROOT_REVIEW_CHECKS.mjs)を同じrunnerで再実行し、[出力](results/root-review.out)へ保存する。元レビューは[記録](REVIEW.md)と[元結果](ROOT_REVIEW_RESULTS.json)に残す。

移設前のreference READMEは`historical/reference/README.original.txt`へバイト一致で保全し、README.mdは移設先の案内にした。再実行時に一時フォルダ内で元名へ戻すため、元ハーネス／rawのsource SHAも保持する。[provenance-check](provenance-check.mjs)は保存済み原本manifestのSHAと再現raw全数値を確認する。原調査フォルダがある場合は`node provenance-check.mjs <原調査dir>`で原ファイルも照合できる。Foundationから原文の切れた相対リンクを除外する設定変更は行わない。

再現可能な算術と実ユーザー予測精度は別。α=1のbは平均待ちが無限でも有限g50/g80を持つため、中央値・分位点に限定する。DPは変更せず、到達不能状態のみ刈り込み、H超null、微小確率を捨てない。性能はローカルreference DPだけで、実EngineのT-14やAPI負荷・Cloudの1vCPUを検証していない。

入力はinteger量・有効localDate・daily文脈の限定された局所契約。timezoneからtodayを導く処理、実APIの権限・serializer、永続化、編集競合、model/policyVersion付きDTOは未実装。訂正は初回回答の入力誤り修正という提案であり、蓄積ログからpriorを再推定しない。rawを1回数えたことは統計的独立性の保証ではない。


公開版の採否判断は[提案本文](../../docs/prediction/question-prior-proposal.md)、一次資料は[SOURCES](SOURCES.md)、最新実行とセルフレビューは[検証記録](results/VERIFICATION.md)。元短報は[SHORT_REPORT](SHORT_REPORT.md)として当時の限界を保持する。元フォルダは読み取りのみで、正式2文書・本番Engine・既存設定には変更を加えない。
