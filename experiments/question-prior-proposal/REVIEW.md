> 元のオフライン成果物の報告（2026-10-04 UTC）。未公開・旧HEAD等は当時の記録。今回の公開準備と再実行結果は[検証記録](results/VERIFICATION.md)、現行案は[提案本文](../../docs/prediction/question-prior-proposal.md)。リンクだけを移設先へ合わせた。

# 独立レビュー記録

2026-10-04 UTC。著者とは別のgpt-6.1-solレビュアーとrootによる、repo外成果物のレビュー。正式なGitHub Approve、仕様採択、本番・CIの検証ではない。

## 対象と結論

対象は提案本文、Issue/PRの未投稿案、既存文書への追加断片、一次資料台帳、純粋TypeScript試作と型・数値テスト、感度スクリプト、原580の保全・再現結果、短い報告。a/b更新、S起点だけのb更新、UNKNOWN、量と今日仮定、raw訂正、version境界、α=1分位点、baseline R06/P12にBlockingの欠陥は見つからなかった。

rootは14テスト群を再実行し、別の解析式・全経路列挙・rawケースで27チェックを実行した。結果は[ROOT_REVIEW_RESULTS.json](ROOT_REVIEW_RESULTS.json)、再現用コードは[ROOT_REVIEW_CHECKS.mjs](ROOT_REVIEW_CHECKS.mjs)。著者側の型・既存回帰・580再実行は[検証記録](./results/VERIFICATION.md)。件数は合算しない。

最終独立レビューはBlocking／未解決のShould Fixなし。rootによる局所成果物チェックもexit0（14 text files＋3つの仮想追記、109相対リンク、改行・conflict marker）。元repoの最終HEADはaf001c6e797b9833a63234bd1646171ac8e8c542、statusは開始時と同じ既存`?? .vscode/`のみ。

## 指摘と対応

| 指摘 | 対応 |
|---|---|
| 回答訂正と、蓄積ログに基づく再質問を混同すると同じ証拠をpriorと観測で重ねて使う可能性 | 提案の訂正節と実験READMEに追記。初期回答の入力訂正と再elicitationを区別し、rawを1回数えるだけでは独立性を保証しないと明記。 |
| 一次資料台帳がrepo候補へ移した場合に追えない | 変更せず実験フォルダへコピーし、提案・追加断片から相対リンク。支持範囲と未校正性を維持。 |
| SHORT_REPORTの処理時間対象を中立候補と誤記 | a/bともBeta(1,3)、同平均Beta(2,6)へ修正。analysis.mjsとanalysis.jsonの対象に一致。数値の再計算不要。 |
| 成功時無出力の型検証ログへのリンク先が未生成 | tsc再実行exit0、空のtypecheck.outを明示保存。verify.ps1も無出力時にファイルを作るよう修正。 |
| 原本を移設したhistorical/reference READMEの4相対リンクは元repo内の場所を前提にしている | 原本SHAを優先して変更しない。移設後の参照制限として説明し、現行成果物のリンクとは区別する。 |

レビュアーは原本REPORT/README/run/raw/summary/run.out/DPコピーのSHA一致を確認した。文献の取得・内容確認はrootの一次資料調査に基づき、独立レビュアーはネットワークで再取得していない。

## 実用上の限界

質問対応表・強度4/8は未校正。実ユーザー精度、表示理解、動機づけ、非daily、本番API/DB/serializer/権限/timezone/競合、実EngineやCloud性能は未検証。ログ後のprior更新方針とa/b独立性にもモデル上の仮定が残る。採択するowner判断と通常のPRレビューが必要。

ユーザーrepoの最新remote・Issue/PR・同じheadのCIは確認できていない。認証／通信停止を迂回せず、repo外準備のみ。既存Mustや#81/#88の人を集める確認条件を自動テストで満たしたとは扱わない。
