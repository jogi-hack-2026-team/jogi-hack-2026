# #157 到達予定日・時間量のレビュー回帰

Supporting Artifact / Not a Source of Truth

- 対象: [Issue #157](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/157) / [PR #163](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/163)
- 日付: 2026-10-09 UTC
- 検証基点: PR head a263fa923b8d140300bf1fcecf8a2b84df1ae8cd + main 74bd1ba63cf4564d51e5975e9d0b3524e09c0a2e（統合commit 4e9587818973c2018f059c2d1d099a895780c603）。修正commitとCIはPRで追跡する。
- 仕様の正本: [Product P-18](../product-spec.md#p-18-整数分を保った時間分表示)、[P-19](../product-spec.md#p-19-到達予定日b案)、[Goal API](../architecture.md#2026-10-06のgoal-api76)。この記録で未決の仕様を採択しない。

## 修正前に再現したこと

- 過去の到達予定日を入れ保存すると、日付欄にfocusが移るがエラー文言・summary件数・aria-invalidが出ない。KaitoLaptopの専用Braveタブと合成DBで確認した（2026-10-09、Asia/Tokyo、入力2026-10-08）。renderのvalidateがtoday/savedTargetDateを欠き、submitと食い違っていた。
- 実OutlookPanelのSSR: today=2026-10-05、p50Days=p80Days=177、targetDate=2027-03-31で「到達予定日より到達予定日ごろ」が2箇所に出た。追加したnear/early/late回帰のうちnearだけが修正前に失敗した。SSRはCSS・幅・ブラウザの検証と区別する。

## 修正と確認対象

表示と送信は共通のvalidateGoalFormで、選択中timezoneの今日と編集baselineの保存日を検査する。経過した保存日を維持するタイトル等の編集は止めず、別の過去日への変更は拒否する。nearは比較prefixを付けず、early/lateは維持する。

自動回帰にはnear/early/lateのP50・P80の最終表示、東京/LAの同時timezone・targetDate変更と422時の全体不変、保存済み日付の維持・削除・未来変更を含む。P-18の0/1/59/60/61/1240分、2999/3000分と残り1分は既存amount回帰を維持する。

## 検証結果

作者が追加したa0f8739069b00cd9c0ec19de3864c7bd1d054de1を統合する前のローカル確認: Node 24.21.0 / npm 11.19.0でnpm ci・npm run typecheck・npm test・npm run buildが成功。全276件（Engine70、API130、Web76）、失敗・skip0。APIは専用PostgreSQLの管理接続からテストごとの隔離DBを作成・終了時に削除した。Windowsのembedded DBを毎回起動する初回実行は準備遅延のため中断し、成功扱いには含めない。Foundationはpwsh -NoProfile -File scripts/check-foundation.ps1で成功（アプリ検証とは別）。

作者のtargetDateChecksとその回帰も保持して統合した。API境界ケースは、titleを含む全Goalの不変検査へまとめた。表示と送信で毎回その共通条件を使い、日付をまたいだ送信では現在の時計から再検査する。統合後は型検査、Web77件、到達予定日API5件、build、Foundation（140ファイル・1872リンク）が成功。専用imageを再build・reloadし、過去日で1件のsummary・日付エラー・aria-invalid=true・入力保持を実画面でも再確認した。全体の最終HEAD検証はPRのCIで追跡する。

実ブラウザはKaitoLaptopの専用Brave（PC dark）とIAB（390px light）で確認した。Braveの検証タブが途中で接続を失い閉じられたため、残る変更・削除をIABで継続した。日付の自動fillだけではReactへ変更が伝わらない操作ツールの制約があり、日付欄の実キー操作も行い、inputのvalue属性と画面を照合した。これはアプリの通常日付入力の不具合として報告しない。

| 操作・条件 | 結果 |
| --- | --- |
| 公開トップ→登録→空の一覧→作成 | UIリンクで到達。架空アカウントだけを作成 |
| 過去日を入れ保存 | 修正前は無言、修正後は1件のsummary・日付エラー・aria-invalid=true・日付欄focus。入力保持 |
| エラー後に未来日へ訂正 | エラーが消え、保存・一覧復帰・Todayの到達予定日表示まで成功 |
| 記録前の回答2問、総量3000・初期量1240・1回25分 | Todayで20時間40分 / 50時間0分、編集欄1240分を保持 |
| 到達予定日を2027-02-24へ変更 | P50の2/22の週は「到達予定日ごろ」、P80の4/12の週は「約7週遅い」。重複なし |
| 合成DBで保存日を2026-10-07にして期限経過を再現 | 日付を変えずタイトルだけ保存成功。DBの日付・1240/3000/25を保持。実際に日数を待った検証とは区別 |
| 保存日と異なる過去日2026-10-08へ変更 | 日付エラーで停止。日付を空にするとエラー消去・保存成功 |
| 材料不足 | 保存日は表示するが日数予測・ずれは出さない。削除後は到達予定日表示も消える |
| 390px light | スクロールして残り29時間20分・累計20時間40分 / 50時間0分が読めた。scrollWidth=innerWidth=390。PC darkとは別ブラウザ |

### 今回の画像

現在runで取得し、保存した画像を開いて状態を確認した。完全なWCAG適合、全UI経路・通信故障・全theme/viewportの網羅からの結論ではない。

- [修正前の無言停止](issue-157/01-before-silent-target-date.jpg)
- [修正後のsummary・日付エラー](issue-157/02-after-visible-target-date.jpg)
- [near・late・正確な時間＋分（PC dark）](issue-157/03-near-and-exact-hours.jpg)
- [390pxでの残量・累計（light）](issue-157/05-mobile-exact-remaining.jpg)


## 環境と残条件

専用Compose projectはcodex-task3-pr163-review、app port18163、DB port15663、origin http://pr163.localhost:18163。通常checkout、ユーザーの8080 app・55432 DB・volume・ログインsessionと、以前の監査環境は変更しない。作成アカウント・Goalは架空の使い捨てデータだけ。再開は専用worktreeで専用envとoverrideを指定してCompose upする。Secretはローカル検証用ファイルだけに保持し、Gitに含めない。

- 期限経過後のToday表現はP-19の未決事項のまま。
- 非常に遠い到達予定日で日付の比例軸が圧縮されるOptional指摘は今回未変更。比例関係を保つ再設計と390pxでの別検証が必要。
- #175とのtargetDate付きcreation hash・settingsRevision・recoveryBody統合は、このPR単独の成功から推論しない。両PRの統合HEADで別途検証する。
- 初見の理解・長期利用での読みやすさ・完全なアクセシビリティ適合は、この技術回帰から主張しない。
