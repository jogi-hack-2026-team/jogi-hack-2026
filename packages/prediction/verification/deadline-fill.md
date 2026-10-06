# n=H限定の同値高速化（2026-10-06）

**Supporting Artifact / Not a Source of Truth.** [completionPmf](../src/completion.ts)の`requiredFutureDone === horizonDays && prune`だけ、毎日の2配列全体のfillを境界セルへの0書き込みへ置き換える。2026-10-06の依頼者承認に基づくPR119の性能修正であり、D22の計算方式・K200・seed20261012・H1095・分位点のepsilon・抽選／集計順序を変更しない。配列の再利用方法や公開APIも変えない。

## 採用理由と同値性

この条件では日dの`low=high=d−1`となり、読むセルは`done[d−1]`と`skipped[d−1]`だけ。日1は既存の初期状態。日d<nでは`nextDone[d]`を元の式で必ず上書きし、到達不能な`nextSkipped[d]`を0にする。交換後の次の日にはその2セルだけを読むため、古いセルを読まない。最終日は元のPMF加算を行い、範囲外のindex nへ書かない。これは到達不能状態の扱いを保つ修正であり、小さい確率の切り捨てではない。

`prune=false`と`n<h`は元のfillを実行し、n=0/n>Hは元の早期returnを維持する。追加の分岐が通常ケースにもあるため、全入力の高速化やゼロオーバーヘッドとは言わない。[境界回帰2件](../tests/completion-deadline.test.mjs)は独立な全DONE経路の積、H=1、a/bの0/1、prune無効、n=0/n>H/n=H−1を検証する。既存の[整数全経路列挙](../tests/completion.test.mjs)も保つ。

## 実行した検証

基準は修正前のPR119 HEAD `783ebb443f0d441ca17cce61109b5da12504ee34`。既存TypeScript 5.8.3とNode22.15.1を使い、実repoの最終sourceをコンパイルして検証した。結果とsource hashは[測定JSON](deadline-fill.json)に記録する。

- 型検査、package全66テスト、別コマンドの独立CDF oracle3件、固定18例と9 DP goldenがPASS。
- 修正前の実コンパイル済みDPとのfull-PMFバイト比較16,040件、分位点比較5,248件が一致。
- scratch配列の未初期化／古いセルをNaNにし、各state読み出しを「直前の日に書いた」stampで監視した4,804条件・4,994,440読み出しがPASS。prune無効・n=H−1・H1095も含む。算術式は実コンパイル済み関数のものを使う。
- 過去に保存したPR119の期待draw hash9組が一致。期待値を今回再生成していない。固定drawの回帰であり、乱数の独立性を証明したものではない。
- 完全Foundationは文書・リンク・ignore・whitespaceの検査で、Engine検証とは別に実行する。正確なHEADのNode22/24・Docker・Foundation CIは[PR119](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/119)で追跡する。

## 性能の範囲と限界

事前の隔離追試では、実predict（入力検証・観測・sampler・DPを含む）を3組×8条件×2方式の48 fresh processで逐次計測した。各processはimport後の初回＋warm5回、方式の順序を交互にした。n=1095はTODAY_DONEで41.027→8.620ms（4.76倍）、SKIPPEDで41.550→8.149ms（5.10倍）。n400 TODAY_DONEは186.012→192.271ms、約3.4%の遅化も測定した。通常ケースの遅化を誤差と断定せず記録する。

公開直前にも実repoの最終sourceで同じ48 processを再測定し、全predict結果JSON hashの一致とT-14を確認した。n=1095は32.257→5.992ms（5.38倍、TODAY_DONE）、31.625→6.169ms（5.13倍、SKIPPED）。通常ケースではn120 SKIPPEDが77.496→81.428ms（約5.1%遅化）となった。新しい結果をJSONに保存し、以前の3.4%遅化の測定を置き換えない。T-14必須3条件の各18回はすべて500ms未満、最大178.36ms。CPU固定・信頼区間・startup cold・本番配備の検証ではない。初回の公開前測定はPMF/poison検証とのCPU負荷重複があったため採用集計から除外し、検証完了後に逐次再実行した。

T-14の必須入力は既定prior2、固定30記録（a=(14,7), b=(7,9)）、n120/400/1095。n548とSKIPPEDは参考測定で新しいゲートではない。代表入力の500ms未満は、任意shape・採用runtime・API負荷時の保証ではない。

巨大なcustom priorは現行入力検証で受理されるが、この修正はn=H以外の最悪ケースを解決しない。全posterior積分やCDF認証を使う新方式は別の隔離実験であり、finiteK/goldenの置換・採択をこのPRへ含めない。#70のHard、D26の具体契約、実API/DB/UI結合、校正と採用環境の再確認は維持する。

## 文書への影響

package READMEのテスト説明、候補adapterの共通テスト数、変更対応表を66件へ同期した。API・モデル・製品の数値結果・保存／表示責務を変えないため、Product Spec／ArchitectureのDecision Logへ新しい採択を加えない。既存の性能記録は当時の測定として保持する。セルフレビューはHuman Reviewを代替しない。
