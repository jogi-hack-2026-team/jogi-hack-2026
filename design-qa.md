# Today 朝焼け・山並み案の実装QA（#199）

**Final result: passed** — 修正後の独立視覚比較と操作回帰が成功。人間のUX受入・製品完成とは区別する。

## 最新本人フィードバックによる改善（2026-10-10）

参照への完全一致を完成条件にせず、「今日の行動判断と未来の変化が分かる」「記録しやすい」を評価基準とした。旧HEAD eff8e5bの[修正前後の実画像](docs/ui/today-dawn/ux-before-after-390.png)を保存し、以前の参照比較画像は前段の証拠として保持する。新しい期限・今日目標・入力中の量によるシミュレーション契約は追加しない。

- 対象日：底dockの外側に「今日の記録」とAPIの保存日を表示。旧日なら「記録する日」とし、内部入力をスクロールしても対象日は見える。昨日の10月9日と今日の10月10日を区別でき、短高390×300／文字200%320×568でも取消へ到達した。本文clip y56〜672.5、dock y672.5〜844。初期画面の末尾切れは内容喪失と区別し、スクロール/focusで全文を読めることを検証した。主数字・2択を縮めず、スマホ装飾余白を50px減らした。山の浅いstripと明るい数字背景は同じ提供ラスターで、desktopの山並みを保持する。
- 指標の意味：g50は休んでから最初に再開する待ち日数の中央値で、完了P50の差ではない。見出しを「今日休んだら、次に再開する目安は？」に明確化した。根拠の見出しも再開/完了/記録推移へ分ける。完了予測には今日の設定量と将来も同じ量の仮定を添え、未保存入力は再計算に使わないことを記録入力内に表示・読み上げ関連付けする。保存後の実績・未記録の仮実行・保存済み達成の優先を維持する。
- 記録：量の±を初期dockへ表示。既存の「1回の量」刻みで未保存editorを開き、直接入力も保持する。分/回とも1〜2,147,483,647の整数。空・小数・超過を0へ置換せず送信しない。休むはSKIPPED/null。自動input focusと取消後の元±（無効なら量link）のfocusを局所的に追加した。連打はfunctional update、busy/IME/repeat Enterを扱う。
- desktop：予測と積み上げの実グラフを初期展開し、mobileは要約優先。未操作だけ幅に追従し、一度行ったnative click/Enter/Space開閉はリサイズ後も保持する。右側は一つの白い補助面と区切りへまとめ、左と余白・角丸・書体・色をそろえながら主役の100px数字を保つ。desktopの実績%は40pxにして完了日と競わない階層へ調整した。累計・目標量・残りを明示し、残り0下限と超過別表示で実量を失わない。

更新画面の実API/新規Chrome context撮影16ケースは横溢れ・HTTP400+・pageerror0。320/390/640/960/1440のmobile初期折畳み/desktop初期展開、Enter、実SVG幅、末尾scroll、390×568非重複のroot QAも書込0で成功。独立担当は4状態の実API累計/目標/残り、stepper上下限・無効入力非保存、昨日入力保持、短高/文字200%、resize開閉保持、GET503故障注入から実API再取得への復帰を確認した。故障注入503は期待した1件で、実API障害の受入とは分ける。独立Goal/Log書込0、pageerror0。実画素レビューは主従改善・新P0/P1/P2なし。runtime/stepper-smoke.jsonは実APIのnative keyboard・focus・境界5観測を保持する。

Web全体105 pass / 1 skip（Chromeは別入口）、量pure4件、AmountEditor実React Chrome13ケース、ResponsiveDetails native入力とProgressSummary量境界の独立専用回帰を追加した。既存owner/確認/保存日/昨日跨日の回帰assertは保全する。rootは既存の追加QA Goalだけ再保存PUT200を1回確認し、DONE20分・2026-10-10・可視の記録済み見出しfocusを保持。4つのプレビューfixture・アカウントは作り直していない。最終Chrome統合は14/14 pass・fail/skip0（外側8組＝既存hook6＋量1＋responsive1、内側native開閉/量比較subtest6）。実績量境界は7ケース。最終型・本番build・Foundation（98 text files／1475 local links）も成功。既存の500kBチャンク警告は残る。

実APIfixtureの達成済みは100/100等号で、超過の実APIケースは未検証。超過125/100・等号・未達999/1000・minutesの正確な量は実ProgressSummaryを合成propsで描いた部品回帰として分ける。記録済み昨日Correctionのlive相互lockは専用fixtureがなく未検証、コードと既存境界回帰の確認に限定する。iOS/Safari・実端末keyboard/safe-area・自然日跨ぎ・本番・本人の最終UX受入は未確認。

Library代表2枚は同じIDのversion2へ置換し、元ファイルへ全xattrsを適用した。Brave専用Today URLはログイン画面への遷移を実観測し待機タブを保持する。利用者ブラウザでログイン後のTodayは未確認。専用runtimeのlocalhost:61813を継続稼働させ、通常checkout/Docker/既存DB/userdataを保全する。

証跡：dawn-ui-evidenceのvisual-qa.json、details-scroll-qa.json、independent-integrated-ux.json、runtime/stepper-smoke.json、web-tests-core-ux-final.log、typecheck-core-ux-final.log、build-core-ux-final.log、real-resave-postfix-qa.json、ux-responsive-details/full-browser-regression.log。コードhashを伴う独立判定と同HEAD CIを、本人受入の代用にしない。

## 前段の参照調整と比較

依頼者が選択した[Claude案](https://claude.ai/artifact/KQDeWMput5bt77NEj4J4Kb#artboard-eb122470b18c)のHTML、上部390×600、下部390×640を実際に読み、同幅の画像で比較した。取込原本のLibrary識別情報を保ち、背景の出典・加工・書体ライセンスは[assets](apps/web/src/features/today/assets/README.md)へ記録した。

かけ合わせ3を土台にする。参照への完全一致は採択基準ではなく、今日の判断と記録を見落とさず行えることを優先する。本文を遮る固定top、常時長い説明、使う前の大きなグラフは操作目的に合わないため、実高さを確保するdockと詳細の開閉へ変えた。API/Engine契約を横断する提案はこの変更へ入れない。

373bb4bの初回版は色・山並み・主数字を合わせたが、操作帯が見通しより前、7日の曜日が余分な段、下半分の長い説明と常時グラフが密になり、選択案の構成から離れていた。ユーザーの指摘を受け、機能テスト成功だけを視覚一致の証拠として扱わず修正した。旧版の独立比較はタスクのindependent-visual-review-373bb4b.mdに保存した。

修正後は問い・主数字→直近7日/昨日→到達見通し→積み上げ。問いは同じcopyにwbrを入れ、遠ざかるの途中の改行を避ける。7日は32pxの丸と12pxの日付だけとし、曜日は読み上げ名に残す。390pxのカード高は137.2px（参照約138px）。進捗は25%全体を明朝56pxとした。長い補足とAxisChart、累計グラフはキーボードでも開閉できる第二階層へ移し、予測不能理由・出所・予定日差は見通しの本文に残した。

空と山は提供HTMLから抽出した同じラスター。淡い朝焼け、森色の説明、右寄せの明朝主数字、白カードを保持。参照の約2日などを固定せず、実日付・約1日・25%は専用合成ユーザーの実API/Engine値を表示する。参照の固定top704px、空グラフ、Claude通知は含めない。

スマホは本文だけを底の操作dockの上でスクロールし、dockは白面・上角28px・上向き影・実高さとsafe-areaを確保する。390×844では本文clipがy56〜696、dockがy696〜844。本文のDOMrectが下へ延びてもclip後の可視面はdockに重ならない。デスクトップは左に問い・昨日・操作、右に見通し・積み上げを配置する。

## 修正後の機能回帰

2026-10-10、専用の新規Chrome context、既存の専用アカウントでの実ログイン、実APIと専用一時PostgreSQLを使用。通常checkout、Docker、既存DB、ユーザーデータは未操作。通常撮影はAPI mockなし、認証設定の緩和なし。

- 未記録予測を320/390/640/960/1024/1280/1440px、記録済み・記録不足・達成済みを390/960/1440px、計16ケースで撮影。横溢れ0、HTTP400以上0、pageerror0。Maru900/Mincho900読み込みと実進捗を確認。
- 320/390/640/960/1440pxで閉じた初期表示・Enterによる2つのdetails開閉・展開した実SVG幅を確認。本文末尾へスクロールでき、390×568でも本文clipとdockの非重複を確認。追加確認のGoal/Log書込0。
- Web型チェック、本番Vite build、Webテスト103 pass / 1 skip（別入口のブラウザ検証）、実hook Chrome回帰6 pass / 0 skipが成功。owner切替・同一人再確認・保存日付・昨日の日跨ぎ境界を含む。既存JSチャンク500kB警告は残る。依存追加・lock更新なし。
- 修正後、既存の追加QA Goalだけで「記録を変更」→「やった」→実PUT200を1回確認。DONE20分と対象日を保ち、dockが閉じて記録済み見出しへfocusが戻り、見出しが可視となる。新Goal/アカウントは作らず、4つの状態fixtureを変更していない。初回版の新規保存証拠は別に保持する。

## 独立レビュー

修正前のP1/P2指摘に基づく変更を、実装担当の回帰とは別に確認した。独立担当はsource upper/lowerと390×1100の同幅・同位置の並列画像、390内部末尾、1440実画像を実際に閲覧し、視覚P0/P1/P2なしと判定。旧r2の誤ったcropは判定から除外した。back矢印の青は元のアプリのリンク色を使う任意P3として残す。

独立操作確認は320/390/960/1440のEnter開閉・実SVG幅、今日の量49取消、昨日37の開閉保持、320×568/390×568/390×430の入力・無効Enter非保存・キーボード取消・resize draft保持が成功。横溢れ/可視面の非重複、HTTP400+/pageerror/GoalLog書込はいずれも0。作業環境のindependent-visual-review-r3.md、independent-review-state-r3.jsonは検証時のコードhashを保持し、rootのテストやCI結果と区別する。

追加の敵対的確認で320px・文字200%の「この量で記録」がnowrapの2列内で切れるP2を再現した。Today内の量保存/再試行ボタンだけnormal/anywhereで折り返し、32px文字の全文が2行で読めること、dock内部スクロールでボタンに届くこと、通常/拡大のkeyboard取消を再確認して解消した。最小高さ、保存・取消の判定は変えない。専用contextでeditor表示後のcomputed font-sizeを一度だけ2倍にする再現で、実ブラウザのtoolbar zoomやOS設定変更は行っていない。independent-review-state-final.jsonが確認時のコードhashを保持する。[修正前](docs/ui/today-dawn/text-enlargement-before-320.png)と[修正後](docs/ui/today-dawn/text-enlargement-after-320.png)は実画素確認済み。追加確認も書込/error/HTTP400+0。

## 代表画像と証跡

[390px初期表示](docs/ui/today-dawn/preview-mobile-390.png)、[390px本文末尾](docs/ui/today-dawn/preview-mobile-scroll-end-390.png)、[1440pxデスクトップ](docs/ui/today-dawn/preview-desktop-1440.png)、[390px参照比較](docs/ui/today-dawn/reference-comparison-390.png)。未記録・予測availableの実API画像。内部スクロール採用後のfullPage画像はviewportと同高になるため、末尾はスクロール後の別画像を用意した。

タスクのdawn-ui-evidenceにvisual-qa.json、details-scroll-qa.json、typecheck-postfix.log、web-tests-postfix.log、browser-regressions-postfix.log、build-postfix.log、real-resave-postfix-qa.jsonを保管。資格情報・runtimeファイルはPRに含めない。Library代表2枚は旧ファイルと同じ識別子のversion1へ置換し、元ファイルへ版のxattrsを適用した。

## 範囲と未確認

本人による修正後の見た目・操作感の受入、自然の日跨ぎ、本番、iOS/Safari/実端末は未確認。実hook/Chromeの日付回帰は実施済み。BraveのCUA接続は復帰し、専用Today URLの新規タブがログイン画面へ遷移したことを観測した。ログイン待ちタブを保持し、利用者ブラウザでログイン後のToday表示は未確認。新規アカウント作成・資格情報/権限設定変更は行っていない。

API・Engine・owner/answerRevision/settingsRevision/保存判定はUI差分で変更していない。PR197、PR195（bd9288de）、PR201（cefecf62）を指定ベースへ通常mergeした。最終事前確認でmain041f24cへの3PRのmergeを確認し、同mainとのtree比較でAPI/Engine/Testsの差分0を確認した。UI固有の初回差分はf20da95→970e5b5、373bb4bは旧画像/QA。PR201の履歴競合3件は指定PR197の境界回帰を保全し、統合固有差分がcopy・回帰・仕様・対応表の4ファイルだけであることを確認した。今回の参照一致修正はこの上のToday4ファイルと必要文書/画像に限定する。merge/deployは行わない。
