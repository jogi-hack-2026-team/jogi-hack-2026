# Issue #188 責務整理・検証と履歴保全

Supporting Artifact / Not a Source of Truth。2026-10-09、[Issue #188](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/188)。基準mainは`77c71a5f248a4dce4ce9fb8af6619b41541be9d8`（#184統合後）。現行の責務は[Architecture](../architecture.md#責務と配置を変えるとき)、検証範囲は[開発ガイド](../DEVELOPMENT_GUIDE.md#検証)を参照する。

## 変更と保つ境界

FEは製品側の`PriorForecast`から純粋検査を抽出し、制御されたGoal入力描画、親routeの成功receipt、共有暦日関数を分けた。候補UIを本番と誤認せず、draft・attempt・owner・訪問と保存の責任を維持する。BEは純粋policy・fingerprint・IDを抽出し、DB読込を名前で明示する。lock／時計／CAS／拒否順とtransactionはstoreに維持する。Engineは公開R-11型の所有者と結果構築を明示し、数値核と既存exportを保つ。

テストhelperは補完あり／要求そのままの明示名と、獲得資源の初期化・終了失敗時の掃除を整理した。CIは既存command順・job名・required checks・権限を保ち、SHA・層別件数・未実行と安全な失敗診断を追加した。速度改善や新しい製品機能の主張ではない。

## 固定Git履歴への保全

承認された3treeだけを通常削除した。音楽案111件、旧質問prior提案57件、旧モデル比較22件の計190件。Git履歴は書き換えず、全path・mode・blob・tree IDを[保存確認](issue-188-history-preservation.json)に残した。基準commitから全blobを読め、削除差分がこの190件だけであることを検査し、GitHubの同commitのrecursive treeも190件と確認した。これは固定履歴の内容保持検査で、別文書へ本文を移したことや過去の実験を再実行したことを意味しない。

現行runtime／build／CI／dependencyに3treeへの参照はなかった。文書の必要参照は固定tree/blobへ更新し、一般入口はREADMEへ集約した。独立CDF・凍結fixture・#184の負荷harnessは保持。旧候補UIと構成比較には専用workflowの依存があり、今回除外しない。元調査・再現・provenance・raw・FAILを部分的に間引いていない。Future ROIの他の履歴・計測JSONと未tracked資料は削除していない。

## 実行済みと最終統合の残り

分担成果ではEngine 73件・独立CDF 3件と1,430入力の基準／整理後比較、BE 184件、FE一般101成功／fail0／ローカルbrowser入口skip1、別ブラウザ3成功／fail0／skip0を確認した。ブラウザ回帰は実DOM・実Router/SDKと合成transportであり、実API/DBのE2Eではない。API helper新規5件・CI診断4件・migration checker 5件は分担成果で成功。これらを最終統合HEADの成功へ読み替えない。

Draft作成前のFoundationは95 text files／1,408 local links、fail0。最終統合の全workspace型・test・build、実API/DBのブラウザ、正確なremote HEADのCI、独立レビューは実施中。結果・SHA・未実行をこの記録へ更新する。
