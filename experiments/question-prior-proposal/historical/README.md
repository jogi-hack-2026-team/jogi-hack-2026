# 独立調査の再現

Supporting Artifact / Not a Source of Truth。既存repoを変更せずコピーした参照実装を使う。外部依存・network・実ユーザーデータなし。

PowerShellで次を実行する。Node 24.21.0はこの環境に既存のRuntime。別環境では同じ版のnode.exeに置換する。

```powershell
Set-Location 'C:\Users\kaito\Documents\Codex\2026-10-03\task-5\prior-investigation'
$taskNode = 'C:\Users\kaito\AppData\Local\mise\installs\node\24.21.0\node.exe'
& $taskNode run.mjs
& $taskNode reference/bgq-boundary-check.mjs
& $taskNode reference/dp-truncation-check.mjs
```

`run.mjs`は約10秒で完了し、`results/raw.json`と`summary.json`を再生成する。数値は固定seedで再現、実行日時と処理時間は変わる。失敗したassertionはexit 1で停止する。標準出力の保存例：

```powershell
& $taskNode run.mjs | Set-Content -Encoding utf8 results/run.out
& $taskNode reference/bgq-boundary-check.mjs | Set-Content -Encoding utf8 results/bgq-boundary-check.out
& $taskNode reference/dp-truncation-check.mjs | Set-Content -Encoding utf8 results/dp-truncation-check.out
```

`reference/`は本番コードではなく`experiments/prediction-model-validation/`の無変更コピー。原本HEADと参照SHA256はrawの`environment`、Issueの最新読み取りsnapshotは`results/issue-reference.json`。

rawの`initial`は18組の事前分布、draws、完了PMF、g50/g80。`adaptation`は起点別更新、`oracle`は独立経路列挙・Beta積分、`scenarios`は合成rawログ・状態、`amountCases`/`correction`は量・訂正、`adversarial`は初期設定を意図的に外した固定条件、`recovery`は起点別ストレス入力、`seedSensitivity`は5seed、`timings`は3回の測定値。`recovery`は共同で実現可能な時系列を意味しない。パターン例は質問回答者の観測へ流用しない。

結論と制約は[REPORT.md](REPORT.md)。全Mustや実Engine/APIの完了証拠として使わない。
