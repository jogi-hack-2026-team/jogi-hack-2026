# PR131 再レビュー対応（2026-10-08）

**Supporting Artifact / Not a Source of Truth。Refs #84 / PR #131。性能の再測定報告ではない。**

レビュー `5449897156`（対象HEAD `0d59f22`）への対応。[前回の実測](REAL-ENGINE-2026-10-07.md)と生JSONは保持する。前回の28条件・25PASS/1FAIL・overallExitCode=1、旧predict inline4rpsの計算最大546.83msによるE4 FAIL、inline10rpsのCRUD遅延は解消したと扱わない。

## 変更と検証範囲

- 参照EngineのURL比較を `fileURLToPath(engineUrl)` と `resolve(SPIKE_ENGINE_ROOT, 'dist/src/index.js')` の比較へ修正。POSIX絶対パスを `file:///` に連結していた旧テストは `file:////private/...` となった。小文字化も除き、パスの大文字・小文字とURLエスケープを保持する。
- 空白・日本語・`#`・`%` を含むnative絶対パスのfixtureを別Nodeプロセスで読み込み、参照Engineの選択と公開R11の引数境界を確認。POSIX/WindowsのURLデコードもNodeの明示的な `windows: false/true` で確認する。Windows上の検証であり、macOS実機での実行完了を意味しない。
- `runReal` は `questionPrior` を分離してから公開R11の `prediction` に渡す。既存strength-4 mapping（LOW 1/3、MID 2/2、HIGH 3/1）とHIGH/LOW回答は変更しない。現在の参照Engineを直接呼ぶ結果とinline/workerのmodelVersion・status・未来DONE件数を照合する。実アプリのsaveSnapshot HTTP経路の測定は引き続き未実施。
- build不足時の案内を、参照checkoutのroot `npm ci` → `npm run build:prediction`、候補内の独立 `npm ci` へ揃える。
- 次回v8実測は `*.candidate.diff` に `git diff HEAD` のstdoutをそのまま保存し、同じbytesをSHA256へ渡す。末尾改行をtrimしない。JSONにファイル名・byte数・hash・scope・未追跡ファイル一覧を記録し、runnerはhash/byte数を確認して実測folderへコピーする。同名payloadを上書きしない。`candidateDiffFile` はJSONと同じfolderに対する相対ファイル名。payloadはtracked候補差分であり、ignored/untrackedファイルの本文を含まない。測定する候補src/verifyはcommitまたはstageしてから実行する。clean候補はHEADと0-byteのdiff payload（SHA256 `e3b0c442…`）で識別する。

## 旧hashの再現

旧4runの `candidateDiffSha256=c7b029bc…` と、レビューのREADME差分hash `054fefa4…` は、末尾改行の処理で区別できた。[再構成payloadとhash記録](results/2026-10-08/real-engine-review/README-diff-reconstruction.json)を追加した。

```sh
git diff 93a4efd 0d59f22 -- experiments/architecture-verification/candidate-1.7.7/README.md
```

上記stdoutのUTF-8 bytesは `054fefa4c2cde97773eb80ef18401b0c09b3451f94e4bb02b700e34fd1e60bfb`、当時の `gitAt(...).trim()` と同じ文字列処理をしたbytesは `c7b029bc4adb336f800a3c69cd4f4474c1591227d8ba2d2ed42f2c5828d32644` となる。`b7fb21c` を起点とするREADME差分でも一致する。この再構成一致は、本文を保存していなかった実測時の全working treeを完全に復元した証明ではない。旧JSONを書き換えない。

## worker停止時の限界

予期せぬworker死亡ではpool全体をfail closedにし、running/queued/以降のjobをrejectする。**自動でworkerを再生成しないため、processを再起動するまで予測は503を返す。** 通常のjob例外はenvelopeでrejectし、workerを維持する。

この候補の `/api/health` はDB疎通の確認で、予測poolの状態を反映せず、DBが応答すれば200となる。従ってこのendpointだけでpool障害を検出して再起動することはできない。現時点の候補の限界として明記し、Cloudのprobe/自動復旧方針はこのspikeから採択しない。

## 今回の検証

Windows x64、固定Node24.21.0/npm11.19.0。独立した参照main checkoutを `9ee0d1a40b879bd6ac6f5210e8881b97102dff41` へ更新してbuildした。Engine source treeは前回と同じ `5fb64f192b965b22b4597c9ace473e0e7bbe150f`。本体Engine/DTO/採択には変更がない。

候補typecheck・回帰14件、Engine既存70件、PowerShellのFAIL集計回帰とdiff証拠移送回帰はすべてPASS。[今回のログと検証ledger](results/2026-10-08/real-engine-review/)を参照。diff移送はUTF-8/CRLF/末尾改行の保持と、上書き・path・missing・hash・byte数不一致の拒否、コピー先のhash/byte数を確認した。

Foundationは最終117 text files / 1211 local linksでPASS。初回のdiff本文への末尾空白検出はledgerとlogに保持した。hash対象のdiff payloadはresults配下のGit `binary` 属性により改行変換を防ぎ、本文bytesを変更していない。今回の表示用ログはcheckout pathを置換し、行末空白を整えている。

敵対的セルフレビューと別agentによる独立した静的レビューでBlocking/Should Fixはない。独立担当は通常read-only環境の起動エラーのため、提供した差分・テスト・文書テキストを確認した。独立したファイル読取・テスト実行は未実施であり、上記の実行結果は作業担当による検証である。

URLテスト・引数境界・証拠保存の変更影響は回帰で確認するため、前回の混合負荷28条件を再実行しない。今回の回帰の実行時間を性能値として報告しない。DB新規作成やCloud課金も行わない。macOSでの回帰実行、実アプリのsaveSnapshot HTTP経路、実Cloud 1vCPUは未検証。

```powershell
# 参照main checkoutのroot、固定Node24/npm11
npm run build:prediction
npm run test --workspace=@futureroi/prediction
# 独立候補checkout
$env:SPIKE_ENGINE_ROOT = '<main checkout>/packages/prediction'
npm run typecheck
npm run verify:real-regression
pwsh -NoProfile -File verify/measurement-ledger.test.ps1
pwsh -NoProfile -File verify/diff-evidence.test.ps1
```
