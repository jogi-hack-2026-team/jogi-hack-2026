# #117 React候補の検証記録

**Supporting Artifact / Not a Source of Truth。2026-10-05の独立候補の検証。**

対象はこのディレクトリのTSX、slot例、固定状態のReact previewと、別checkoutの候補Engineからのローカル表示接続。正式FE画面・API・本番Engine・保存revision・D-26採択の検証ではない。表示例は予測精度の根拠にしない。

## 自動検証

READMEの `scripts/check.mjs` をWindows x64、Node22.15.1で実行し、strict型検証、15/15のReact SSRテスト、Vite preview buildが成功した。既存lockのTypeScript5.8.3、React/React DOMと型19.3.0、Vite8.3.1を使用した。既存experimentのNode24.21.0指定に対するNode22のinstall警告は発生したが、候補のcheckは成功した。追加CIはNode24.21.0で同じcheckを実行する。

| 検証 | 結果と意味 |
| --- | --- |
| strict + 8つの型拒否例 | 任意回答の語彙、出所不足のestimate禁止、記録済みcore比較禁止、CURRENT_STATE制約、slot propsを検証 |
| React SSR 15件 | 全25組の回答、任意fieldset、instance間のID/name分離、error参照、save状態、4種の出所、条件付き回数、実績、達成済み、再取得失敗・保存不明、無効payload拒否を検証 |
| Vite build | 実際のTSXと最小previewをbundle。生成物はignored `.qa/` のみ |

## 実Engineからのローカル接続

PR120候補`0d99ae7`を基点に、PR119の`f7a6c02ec402d3c74fae953cac769de06b31050b`とPR118の`c73efae7697df8d0d9d62c99c8b115766ee5f293`を独立したdetached checkoutで参照した。共有`common-fixtures.json`のSHA-256（Git blobと同じLFへ正規化）は`ba7820aeee75d6c2e02fa8c3510fc63c9cef2a524918c5e6077abd6921b4ac47`。候補コードや共有18例を本ディレクトリへ複製していない。

終了前に最新PR118 `b7400757f1ee7c7beeb37640f7ad9582d770b121`の差分と本文を再確認した。変更は保存・取得のSupporting文書3ファイルだけで、公開共有fixtureは上のcheckoutとLF正規化後byte一致。conditionalPlanの改名・同じsnapshotのcontext付加という接続案とも整合する。回答用token・FE取得世代管理・最小HTTP blockの更新案は採択や今回の実装へ含めない。

READMEの接続checkをWindows x64/Node22.15.1と上記既存lockで実行し、Engineの元のNodeNext型検証、実Engine型→表示型のstrict受け渡し、24/24テストが成功した。18例は実Engineを毎回実行し、PR118の期待値と照合してから表示view・実React SSRへ渡した。部品checkもstrict・15/15 SSR・Vite buildが成功した。Node24.21.0の候補CIにも固定checkoutの接続checkと結果artifactを追加した。対象HEADのActions結果はPRで確認し、設定の追加だけを実行成功とは扱わない。

公開前にPR119最新`783ebb443f0d441ca17cce61109b5da12504ee34`も確認した。追加はsnapshot／workerのテスト例と文書で、計算sourceは変更なし。この接続CIは上で検証した`f7a6c02`を維持し、別PRのhandoffテストやworker検証を今回の24件へ合算しない。

| 接続の確認 | 結果 |
| --- | --- |
| 未回答・UNKNOWN・片方回答・MID | 同じprior数値でも材料gateを区別。条件付き回数は実Engine値を改名し、日数として表示しない |
| 回答訂正・解除 | 同じ全実ログから再計算し、core・出所が変わっても実績量と実観測件数は増えない |
| 達成・今日記録済み | 実績達成を優先。記録済みはcore比較なし。F14の実績7/22、F15の記録済み材料不足を表示 |
| 仮実行0日・長いhorizon | F17は実績15/16のまま仮定0日を表示。F18はnullを保ち、formatterを呼ばず、条件付き回数を第三の指標へ追加しない |
| 接続の境界 | `unit`/設定量はローカルcontext。週ラベルは明示したsynthetic formatter。保存・HTTP・DB・revision/freshnessは実行しない |

生成された`.qa/connection/report.json`は実Engine出力、表示view、HTMLと検証対象hashを含むローカル証跡。保存成功、正式API契約、ブラウザでの数値更新を示すものではない。型を回避したTODAY_DONE/CURRENT_STATEの逆転、出所不足、無効context、未達成にcompletedを渡す場合は接続例でも拒否する。

## 基盤のoptional propsとBE境界の再確認（2026-10-06）

PR122 `54b59e3`の`exactOptionalPropertyTypes: true`で、旧`GoalQuestionSlotExample`が`disabled?: boolean`へ明示的な`undefined`を渡し得るTS2375を再現しました。`saving || questionProps.disabled === true`でbooleanへ正規化する1式修正と、候補の検証設定への同flag追加を行いました。propsの語彙、5コピー対象、保存処理、API／Engine出力型は変更しません。

Windows x64／Node22.15.1、既存lockのTypeScript5.8.3／React・React DOM19.3.0／Vite8.3.1で、変更後の`check.mjs`（exact optional＋型負例8件、SSR15／15、Vite build）と固定`f7a6c02`への接続24／24が成功しました。compilerのみの別負例でも、mainの`PredictionResult`を`engineViewExample`へ直接渡すと`evidenceSource`／`conditionalPlan`欠落のTS2345となることを確認しました。この負例は実行しておらず、24件へ合算しません。5コピー対象は`7b0debd`とbyte同一です。ブラウザの再操作は行っておらず、過去の実DOM確認を新しい実行結果として扱いません。

main `dc668fb`の`PredictionResult`とBEの暫定方針を読み合わせ、candidate変換へ直接渡せないこと、不足・RECORDS出所・Goal context・未保存draft／revisionの境界を[README](README.md#現行実績モードとの接続境界2026-10-06)に記録しました。HTTP／DB／回答保存やR-11の完成を示す確認ではありません。#88の基点・限定先行の承認も未決です。

上の`783ebb4`時点の計算source同一という記録は当時の確認です。現在のPR119 `918d10e`は共有DPのsource変更を含み、同じ記述を最新HEADへ適用しません。この候補CIのEngine pinは既検証の`f7a6c02`のまま保持し、別PRの変更やテストを今回の検証件数へ合算しません。

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

NVDA等による読み上げ、タッチ端末、本番FEでの親draft/save/error/freshness/優先resolver、422契約、API保存・再取得、実snapshotのcontext整合、週ラベル、D-26/PR118採択は未確認。#70 Hard、#117 DoR/blockedとClose条件は解消していない。FEレビューと契約採択後に正式配置・統合を別途判断し、この候補だけでmergeや本番配線をしない。
