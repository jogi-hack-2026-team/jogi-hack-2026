# Today 朝焼け・山並み案の実装QA（#199）

**Final result: passed** — 初回プレビュー用の実装QA。人間による最終UX受入・製品完成の判定ではない。

## 参照と比較

依頼者が選択した[Claude案](https://claude.ai/artifact/KQDeWMput5bt77NEj4J4Kb#artboard-eb122470b18c)のHTML、上部390×600、下部390×640の画像を実際に読み、390px実装と同幅の並列画像で比較した。原本のLibrary識別情報を保つ取込原本は作業環境に保管し、背景の出典・加工・書体ライセンスは[assets](apps/web/src/features/today/assets/README.md)に記録した。

空と山の背景は提供HTMLから文字を除いて抽出した同じラスター。淡い朝焼け、森色の説明、明朝の数字、白カード、余白・丸みを確認。実装の問いは既存copyを使うため、参照HTMLのwbrと折返し位置は多少異なる。実際の日付・曜日、記録状態、約1日・25%などは専用合成ユーザーに対する実API/Engine値であり、参照の約2日などをハードコードしていない。曜日は既存の記録情報を残した。

参照のtop704px固定操作帯、空のグラフ、Claudeのログイン通知は採用していない。スマホは記録→操作→見通し→積み上げの通常フローで本文を遮蔽しない。デスクトップは今日の判断・操作を左、見通し・累計実グラフを右に置く。320〜1440pxでカード内の本文・実図・操作が読める。

## 実ブラウザと回帰

2026-10-10、専用の新規Chrome context、実ログインフォーム・実API・専用一時PostgreSQLを使用。通常checkout、Docker、既存DB、ユーザーデータは未操作。通常撮影はAPI mockなし。独立レビューの503警告確認だけroute.fulfillで通信障害を注入した（実API障害の受入確認とは別）。認証設定の緩和は行っていない。IAB/ChromeのCUA surfaceは利用不可だったため、既存Playwrightから別Chromeを起動した。

- 未記録予測を320/390/640/960/1024/1280/1440px、記録済み・記録不足・達成済みを390/960/1440px、計16ケースで撮影。横溢れ0、HTTP400以上0、pageerror0。字体読み込み・実グラフ・進捗バーを確認。
- 独立レビューは960/1024/1200/1440px×4状態も測定。960pxの余白加算をbox-sizingで修正し溢れ0、暗色OSの503警告はTodayのライト色へ修正して確認。
- スマホ操作帯の初回表示の重なりを通常フロー化で解消。390/960/1440pxで操作帯×見通しの重なり面積0、量の編集中も重なり0。
- Enter/ArrowDown/Escapeのメニュー操作とfocus返却、昨日の量37の開閉保持、今日の量49の取消、昨日と根拠の開閉を確認。独立UI確認のGoal/Log書込0。
- 別の合成Goalで実UIの「やった」→実API PUT200→記録済み表示を確認。DONE20分が保存され、保存後の見出しへfocusが戻る。専用環境への書込はGoal作成1件・Log保存1件のみ。通常の4プレビュー状態は維持。
- Web単体テスト102 pass / 1 skip（ブラウザ検証の別入口）、専用Chrome回帰6 pass / 0 skip。owner切替、同一人再確認、Today保存日付、昨日の日跨ぎ入力境界を含む。
- Web型チェックと本番Vite buildが成功。既存JSチャンクの500kB警告が出るが、ビルド失敗はない。依存追加・lock更新なし。

ローカル証跡名: reference-comparison-390.png、forecast-unrecorded-390-viewport.png、forecast-unrecorded-1280-viewport.png、visual-qa.json、typecheck-final.log、web-tests.log、browser-regressions.log、build.log。専用タスクのdawn-ui-evidenceに保管。資格情報・ランタイムファイルはPRに含めない。

## 範囲と残る確認

独立レビューのBlocking/Should Fixは修正済み。初回プレビューについて依頼者の見た目・操作感のフィードバックを待つ。自然の日跨ぎ・本番・iOS/Safari・実端末は未検証（実hook/Chromeの日付回帰は実施）。API、Engine、権限、owner/answerRevision/settingsRevision/保存判定をこのUI差分で変更していない。PR197とPR195を指定ベースへ通常mergeしたため、main向けDraftでは未merge依存の差分も含まれ得る。UI固有差分は統合ベースf20da95から区別する。
