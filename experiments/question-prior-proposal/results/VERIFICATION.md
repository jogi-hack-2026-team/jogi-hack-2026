# 公開版の検証とセルフレビュー

Supporting Artifact / Not a Source of Truth。2026-10-05 JST、Task #107の専用worktree。基点mainは `c0e289d06762dc35336421cee574fab5d4a90da1`（PR #103統合済み）。元成果物は読み取りのみ。型検査のcompilerは既存TypeScript 7.0.2、実行Node 24.21.0、Windows／Core i7-1360P。

## 再実行した結果

実験フォルダで `node verify.mjs <既存typescript/bin/tsc>` を実行した。元フォルダが存在する環境では `node provenance-check.mjs <原調査dir>` も実行した。追加install・Secret・DB・外部APIは使わない。

| 確認 | 結果と出力 |
| --- | --- |
| 試作のnode:test | 14テスト群成功、fail／skip 0。[出力](prototype-test.out) |
| strict型検査 | exit 0。[出力](typecheck.out)は成功時無出力の0 byte。TS実行だけでは型検査としない |
| 感度・seed・参照DP | 18候補、48起点別感度、20seedケース。[raw](analysis.json)、[出力](analysis.out)。最大184.07msはこのローカル参照DPの測定で、本番性能の保証ではない |
| Beta-Geometric境界 | 独立境界4件＋α=2閉形式398件成功。[出力](bgq-boundary.out) |
| DP回帰 | 微小確率例P50=3、独立式4000件、刈り込み600件成功。[出力](dp-regression.out) |
| 元ハーネス再現 | 580チェック成功。[出力](historical580-reproduced.out)、[raw](reproduced-580/results/raw.json)。同じ580の再実行で、1160の異なる検証とは数えない |
| 原本保全／全数値比較 | 原調査15ファイルのSHA一致。README原文は名前だけ`README.original.txt`へ保全。580のchecksと、日時・時間・RAM測定値を除くraw全内容が一致。[manifest](provenance.json)、[出力](provenance.out) |
| 元独立オラクルの再実行 | 27チェック成功、DP最大差8.67e-19。[出力](root-review.out)、[コード](../ROOT_REVIEW_CHECKS.mjs)。今回のセルフレビューで実行したもので、新たな別担当レビューとは呼ばない |
| 最新mainの既存Engine回帰 | `packages/prediction`で`node scripts/check.mjs test --tsc <既存compiler>`：型検査と46テスト成功、fail／skip 0。コード・共通prior／seed／設定は変更なし |

移設時の初回再現では、追加したREADME原文保管ファイルが参照SHA一覧に混入して全raw比較が失敗した。一時フォルダを元の5参照ファイルだけに直し、元名を復元して全体を再実行した。assertion／数値比較を弱めていない。元のオフライン検証記録は[原文](VERIFICATION.original.txt)、元短報・独立レビューは[READMEから](../README.md)辿れる。元analysisは[原結果](offline-analysis.json)として保全した。

## Foundationと差分

適用後のFoundationはPASS（95 text files／1025 local links／7 ignore cases／working・staged whitespace）。Git改行変換で原本SHAが変わらないよう、新しい実験フォルダ内だけに`.gitattributes`の`-text`を置く。既存設定ファイルは変更せず、stage後に各実験ファイルのGit blobと実ファイルのバイト一致を確認する。正式Product／Architecture、本番Engine、既存CI・依存・runtime・認証設定を変更しない。公開HEAD・CI・PR実表示は公開後にIssue／PRへ記録し、このローカル結果だけで公開できたとしない。

## セルフレビュー

`review-gate`に沿ってTask完了条件と最終差分を照合した。Blocking／未解決Should Fixなし。移設で切れた原READMEのリンクは原文をバイト保全し案内READMEを置いて修正、change-mapの追加行も既存の表へ接続した。元proto／テスト／数値核は元成果物と同一。初期回答・実記録・initialProgress・今日DONE仮定を分離し、UNKNOWN、両起点、訂正、version、α=1、BigInt、DPの微小確率／H超を既存テストで確認した。

正式仕様と本番ソースへの変更がないため、Product Spec／Architecture／本番Engine／既存AGENTS／運用設定の更新は不要。Supporting Docのdecision-log／evidence／change-mapを更新し、提案→一次資料・原本・再現・型／テスト結果の導線を確認する。AIレビューをHuman Reviewの代替にしない。

## 未検証・残る判断

質問mappingの.25/.5/.75と強度4／8は未校正。実ユーザー予測精度・継続意欲・表示理解、本番FE／BE／DB／HTTP／serializer・権限・timezone変換・編集競合・正式結合・Cloud性能は未検証。本Taskでは実Engine T-14を新たに測定せず、過去CIや参照DPの処理時間を今回の本番性能へ読み替えない。UI変更がないため実ブラウザのアプリ検証は対象外。

ownerが、現行維持／条件付き計画のみ／質問priorまで試すか、回答・表示・強度・出所、保存訂正／移行・API契約・評価条件を判断する。PR #105の競合解消、Merge・force push・デプロイ・課金・認証変更は行わない。10/6は依頼者本人の目標でチーム合意ではない。
