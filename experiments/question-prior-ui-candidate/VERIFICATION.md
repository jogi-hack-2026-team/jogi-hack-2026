# #117 React候補の検証記録

**Supporting Artifact / Not a Source of Truth。2026-10-05の独立候補の検証。**

対象はこのディレクトリのTSX、slot例、固定状態のReact preview。正式FE画面・API・Engine・保存revision・D-26採択の検証ではない。数値例は表示用で、予測精度や計算goldenの根拠にしない。

## 自動検証

READMEの `scripts/check.mjs` をWindows x64、Node22.15.1で実行し、strict型検証、15/15のReact SSRテスト、Vite preview buildが成功した。既存lockのTypeScript5.8.3、React/React DOMと型19.3.0、Vite8.3.1を使用した。既存experimentのNode24.21.0指定に対するNode22のinstall警告は発生したが、候補のcheckは成功した。追加CIはNode24.21.0で同じcheckを実行する。

| 検証 | 結果と意味 |
| --- | --- |
| strict + 8つの型拒否例 | 任意回答の語彙、出所不足のestimate禁止、記録済みcore比較禁止、CURRENT_STATE制約、slot propsを検証 |
| React SSR 15件 | 全25組の回答、任意fieldset、instance間のID/name分離、error参照、save状態、4種の出所、条件付き回数、実績、達成済み、再取得失敗・保存不明、無効payload拒否を検証 |
| Vite build | 実際のTSXと最小previewをbundle。生成物はignored `.qa/` のみ |

## 実DOMで確認した範囲

公開配置と同じTSXをビルドし、通常の127.0.0.1 HTTPでReact mountした。以下はブラウザ操作とDOM観測による確認で、自動SSRテストとは区別する。

| 確認項目 | 観測結果 |
| --- | --- |
| 任意・片方回答 | 初期a=null/b=LOW。片方変更で他方を保持。両問をnullへ解除可能。UNKNOWNとnullが別値 |
| マウス・矢印・Space | checkedと親draft、変更通知が同期。UNKNOWNへの矢印移動、Space選択、モバイルでの往復も成功 |
| Tab/Shift+Tab | aの選択済みradioとbの選択済みradioの間を移動。選択値は変化しない |
| 保存中 | disabled fieldsetによる実効 `:disabled` とradioの操作不可、解除ボタンdisabledを確認。input自身のdisabled属性ではなくfieldset継承を確認した |
| 保存失敗・項目エラー | a=LOW/b=MIDを保持し、bをHIGHへ再編集可能。保存失敗と項目エラーのalert、b全5radioのerror/help参照が存在 |
| 2つのGoal | 全IDが一意、radio nameが4組、全labelがinputを参照。選択はLOW/HIGHとMID/UNKNOWNで分離 |
| 再取得失敗・保存不明 | 状態文のみとなり、古いcoreや完了見通しを表示しない |
| 記録済み・達成済み | 前者は実績60/100と条件付き回数、core比較なし。後者は達成と実績100/100のみ |
| 材料不足 | 不足説明、実績、条件付き3回分と「日数の予測ではありません」を表示。日数estimateを作らない |
| 1280/390/320px | desktop2列、mobile1列。文書幅はそれぞれ1265/375/305pxで横はみ出しなし。390/320pxの選択labelは最低48px高 |
| console | このpreviewでwarn/errorを観測しなかった |

スクリーンショットは[desktop](screenshots/desktop.jpg)と[mobile](screenshots/mobile.jpg)の2枚のみ。desktopは全体、mobileはキーボードfocusを含む選択欄と出所表示の一部を示す。未保存draftと右側の固定例が一致する保存・計算結果であるとは扱わない。検証用serverは終了し、ブラウザのviewport変更を解除した。

## セルフレビューと残り

候補の担当境界、read-only表示、任意回答、出所、実績を増やさないこと、未採択の扱い、アクセシビリティ、依存変更の有無を確認した。JavaScript側から型を回避した場合も、記録済みにTODAY_DONE完了比較を渡すと拒否する実行時guardを追加し、SSRで確認した。この候補の範囲で未解決のBlocking/Should-Fixはない。

NVDA等による読み上げ、タッチ端末、本番FEでの親draft/save/error/freshness/優先resolver、422契約、API保存・再取得、Engine/PR119との数値整合、D-26/PR118採択は未確認。#70 Hard、#117 DoR/blockedとClose条件は解消していない。FEレビューと契約採択後に正式配置・統合を別途判断し、この候補だけでmergeや本番配線をしない。
