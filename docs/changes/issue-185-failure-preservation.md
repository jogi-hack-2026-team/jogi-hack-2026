# Issue #185：Goalフォームの保存失敗を正常なsession再確認で保全する

Supporting Artifact / Not a Source of Truth

対象：[Issue #185](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/185)。2026-10-10、基準main `eb1837f6039b7a451b6ca5617b9f7e99ffa48c95`で再現し、main `22aa0dab79135b0913d4056129ab28624bed38a4`を取り込んで修正した。現行契約は[Product](../product-spec.md)・[Architecture D-29](../architecture.md#d-29-量と作成操作の保全148)。Human Review・merge・公開環境の受入は未実施。

## 原因と修正

正常な同owner確認でも、Goalフォームは私的DOMを隠すため一時unmountする。従来のメモリdraftは送信時に消され、mutation失敗をdraftとして記憶しない。新しいフォームのmutation observerにも失敗は引き継がれない。このため編集409・503・通信例外・422と作成422の入力や案内が消え、作成503ではstorageの操作だけが残って案内が消えた。DB損失や本番owner漏洩を確認した結果ではない。

親に表示用の失敗snapshotを置き、既存の確定成功と同じowner連続性・訪問token・URLの条件を満たすときだけ採用する。正常確認中はDOMを隠し、確定後に入力・旧baseline・項目エラー・失敗案内を復元する。確認失敗・owner変更・認証signal／別タブ通知・実離脱では捨てる。保存operation・mutation・成功callbackは再実行しない。作成の未知結果は既存の同key／元bodyの明示回復を使う。

確認中に届いた同訪問の作成422は、ready後にowner・key・原文が一致する操作だけを終了する。K2への置換ならK1表示も終了処理も採用しない。Storage例外では原文を保全し回復エラーを表示する。422の訂正では未訂正の項目エラーを残し、全項目を訂正した入力を通常draftへ戻す。

最新Goalは引き続き取得する。GET失敗時は入力の保全を案内して取得を待ち、古いcacheでフォームを再開しない。409の旧baselineは明示reloadの成功まで保持する。新しい単位固定等で項目エラーが増えても、409の明示reload操作を隠さない。

フォーム全体のDOMを保つ案は既存の確認中表示境界を変えるため採用しない。mutationの復元は副作用・古いownerへの採用・再送の責務を混ぜるため採用しない。小さな表示snapshotは失敗内容をメモリに保持するが、owner／訪問判定と作成storageのraw照合が必要になる。API・認証設定・DB・Engineの変更はない。

## 検証条件と履歴

ENGINEERING：固定版Better Auth 1.7.7、実React／QueryClient／PrivateCacheGuard／Router／Goalフォームhook、合成HTTP、専用Chrome profileでDOMと送信を観測した。native入力を使う視覚受入や実API／DBの保存結果の検証とは区別する。

基準mainの7ケースは全件失敗を再現した。初回fixtureではGET503後にフォームの即時表示を要求していたが、私的DOMの境界に沿って「非表示を維持し、GET回復後に入力と409を復元する」へ訂正した。基準mainで訂正後も7件とも再現する。最初の修正後は7件とも成功した。

境界を拡張した検証で、fresh unitLockedによる項目エラーが409の明示reloadを隠す問題を発見し、表示条件を修正した。未編集unitを明示rebaseで最新へ合わせる既存契約に対し、fixtureが旧値の保持を誤って要求したため、未編集unitと編集済みunitの固定違反を別ケースへ訂正した。

[実hook回帰](../../apps/web/tests/issue185-failure.browser.tsx)の先行ローカル実行は34/34成功（wrapper 1 pass、0 fail、0 skip、27.365秒）。製品4ファイルとfixtureのfingerprintは実行前後とも`241d854d220c1895dad87e3c879b7ef47ba3dd1221e9b68139a22b9b07e18e11`。確認失敗503／429／通信例外、A→B→A・短いowner／logout／認証signal／storage通知、Goal／public／未commit navigation離脱、422の複数項目訂正、409の旧版保持と明示rebase、正常確認中の遅延拒否6種、K1の遅延422とK2／別owner原文の保全を含む。確認中の私的DOMは587観測で検出せず、auth writeは0、捕捉Goal送信39回は全て合成だった。

全ブラウザ回帰では18テスト中17成功、既存session-draftの未確定作成入力テストが1失敗した。disabled欄への合成変更が失敗snapshotへ入り、確認後に元bodyより表示を優先した製品回帰である。送信はoperation.bodyのまま不変だったが、表示も元bodyを優先するよう修正した。既存assertは変更していない。

この1行修正後は追加34/34（wrapper 1 pass、0 fail、0 skip、45.825秒）と全ブラウザスイート18/18（0 fail、0 skip、89.435秒）が成功した。修正後fingerprintは実行前後とも`64f93251d1955fd399d4870ac27f3584bd7c714635edb884459d00b25811ad07`。既存の#155通常draft・確定成功・owner境界、#175作成attempt、D-30 Today保持・預かり保存の回帰も含む。

正確なcommit HEADでの全体確認とCIはPRの検証欄へ記録する。先行コード・文書の独立レビューでは確認済みBlocking／Should Fix指摘なし。独立レビュー担当はブラウザを実行していない。

公開環境、人による別タブ操作・視覚受入、実DBへの保存結果は未確認。合成通知の境界テストは本番での到達性やpixel描画の証明ではない。
