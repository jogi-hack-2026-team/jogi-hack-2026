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

## 2026-10-09の同一owner入力消失の訂正と限定修正

上の正常focusでも入力を破棄する説明はHEAD `6b3cf98d7db500c1ad23f03bfbb0f6bfe32ffdae` 時点の制約。固定HEADで実SDK/実router/APIと制御イベントによる15操作を測定し、可視復帰/onlineの5秒抑制を越えた再確認、同path/search navigationで入力中の作成/編集値と履歴月の消失を確認した。visibleのままwindow focus、hidden/offlineだけ、直前の自動確認から5秒未満の復帰では作成入力を保持した。OS native focus/NIC切断・実人頻度は未測定。

2026-10-09 08:10 UTCにユーザーが、入力消失の限定修正と#175回復処理との合成環境での整合検証を承認した。後回しの大規模整理と分け、正常同一ownerの未送信draftだけをメモリへ退避する。私的DOM除去とquery消去は維持する。session atomの確認開始・owner/error/認証変更を追い、query世代は毎確認で、draft連続性は失敗/logout/owner変更/認証通知で無効化する。正常同一ownerだけsnapshotを戻す。中間B/errorをReactが同じ描画へまとめても安全境界を維持する。

編集の元baselineと最新の編集値・revision・記録有無を照合し、変更がある場合は復元を止めて理由を表示する。送信中のmutationは別に追い、同じowner/画面の送信終了まで再作成フォームを開かず、古いcallbackで移動しない。作成結果不明attemptと#175の回復処理はsnapshotへ含めず、既存責務へ委ねる。localStorage永続化・認証設定・API/DB変更は追加しない。

新しい[実router/hook回帰](../../apps/web/tests/session-draft.browser.tsx)は15操作を保持し、正常復帰、失敗→A、高速A→B→A/正常確認/429/null、認証通知、編集のanswer/settings revision、保存中と明示保存を検査する。合成HTTPテスト、実認証、#175との隔離統合は異なる証拠であり、最終HEAD・実施結果・残る制約はPRの最新記録から確認する。既存の旧失敗と未検証事項を保全し、正式Decision・Scope・製品完成の状態は変更しない。

追加レビューで、validation 422の確定拒否後に訂正した入力もmutation errorにより通常draftから除外される経路を実hookで再現した。契約検査の422 VALIDATION_ERRORだけ、訂正開始時にmutation errorを解除して未送信入力へ戻す。通信失敗/500/409や削除errorは解除しない。回帰に422→訂正→正常確認、通信結果不明→訂正→正常確認、送信中→確認→通信失敗を追加し、15操作＋14安全性ケース・明示mock書込5件として検証する。確定拒否の訂正前、通信結果不明、競合、削除失敗の入力保持は通常draft復帰の対象外であり、全idle入力保持の保証ではない。
