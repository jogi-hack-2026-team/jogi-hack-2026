# アカウント切替時のFE cache・draft境界（#155）

Supporting Artifact / Not a Source of Truth

対象は [Issue #155](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/155) / [PR #159](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/159)。2026-10-09の記録。基準mainは `48b5f4270c855bb015f8b7b91ca7a7ae4b0bf891`（#147・#176・#181・#164統合後）、FE修正を確認したHEADは `a9b839a062370ffa04e53160b407614571a240a9`。現行の説明は [認証実装](../architecture.md#2026-10-06の認証実装75)、実装・テストの入口は [変更対応表](../change-map.md#アプリの仕様と実装) と [browser回帰の手順](../DEVELOPMENT_GUIDE.md#アプリを起動検証する)。この記録は正式Decisionや製品完成を追加採択しない。

## 確認した原因と修正

共有Query cacheをeffectで消すだけでは、owner変更を認識した描画で旧Goalやdraftを使えた。描画時のowner照合、旧取得cancel→cache reset→epoch開放、切替ごとの識別、private childのowner別再生成で境界を作る。#147のHistoryPageにもGoal詳細とlogsのfreshness・選択月resetを適用した。

旧HEAD `94683727dd8bb3cafdc7bbec4b97dc972aaf4303` の実Router/通常UI/実認証を使う追加検証で、次の不足を確認した。

- Better Auth 1.7.7は再取得中も旧dataを保持し、isPending=false / isRefetching=trueになる。再確認中も画面を閉じ、同じownerで回復してもその間のcacheを破棄する。
- routeの独立getSessionは新Cookieを確認してもuseSession storeを更新しない。routeをhookと同じstoreの最新確認へ統一し、並行確認をまとめ、置換された確認も待つ。
- AccountMenuのnull→取得中→nullで再取得が続いた。同じ欠落につき各インスタンス1回へ制限する。

API guardのrequest.userIdとGoalの相関ではAPIは実Cookieの所有者へ正しく認可していた。FEの表示境界として修正し、API/DB・auth設定・依存版は変更しない。#164のHTTP保存禁止はmainからそのまま統合、#175のdirect GETは別担当で編集しない。

## 実施結果と旧記録の訂正

FE修正HEAD a9b839aで全workspace typecheck/build、通常Web test64成功・browser入口skip1、実Chrome回帰2件（所有者境界12シナリオ/170 DOM・layout・MutationObserver観測、固定版Better Auth client4シナリオ/read8/Goal書込0）が成功した。exactHEAD Application/ Foundation全3job成功、CIのWeb66成功・skip0、migration checker5・空service DB適用/再適用no-opも成功した。

専用DB・合成A/B・専用Chrome profileの実認証は、通常UI切替4件、SDK signinの遅延session応答2件、履歴/編集/作成/logout受入6件が成功。各実行の観測でsettled hook storeと確認中のowner/Goal混在0件、auth429 0件、ブラウザGoal書込0件、app/auth pool/専用DBのcleanupを確認した。Cookie/tokenは保存していない。#181/#164統合後の結果はPRの最終HEAD・CIリンクで追跡する。

初期main `25f473fe` の限定DOM/rAF観測、旧HEAD9468372の `real-auth-result-run-6.json` の429による失敗を保全した。旧記録のAccountMenu B表示は有効session Bの証明ではなく、commit時isRefetching/request IDがなかったため個別429の発生源を断定しない。旧最小routerはroute checkSessionを呼ばず、明示再確認はhook refetchだった。最新の相関付き実Router検証と分類を分ける。旧schema警告・ハーネス初期化/待機/保留制御の失敗も成功へ読み替えない。

## 制約・未実施

正常focus再確認でも未保存入力・履歴選択月を破棄し、同じownerでも復元しない。実ユーザーでの頻度・UX受入は人間のレビュー対象。通知のない直接Cookie置換＋手動query/明示session確認は補助実験であり、通常UI/SDKや認識前の一般的保証に含めない。DTOにresponse ownerがなく、owner付きquery keyだけでも実Cookieと応答ownerを証明できない。

瞬間のpixel描画、公開環境、実ユーザー、共有回線のrate制限受入は未検証。既存build chunk警告とCIのrateLimit lastRequest型警告が残る。#148の回復契約には触れず、auth資格情報/権限/保護設定変更・Approve・merge・deployは実施しない。通常checkoutの未コミットEngine2/.vscode、既存worktree/container・ユーザーデータを保全する。
