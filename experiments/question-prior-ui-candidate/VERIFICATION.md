# #117 React候補の検証記録

**Supporting Artifact / Not a Source of Truth。2026-10-05〜06の独立候補の検証。**

対象はこのディレクトリのTSX、slot例、固定状態のReact previewと、別checkoutの候補Engineからのローカル表示接続。正式FE画面・API・本番Engine・保存revision・D-26採択の検証ではない。表示例は予測精度の根拠にしない。

## p50有限／p80期間外のレビュー修正（2026-10-06）

[Naokiレビュー5430680820](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/120#pullrequestreview-5430680820)のShould Fixを、`e9599f2`へ追加した回帰テストの失敗で再現しました。原因はp80のnullだけで「も3年以上先」と決めていたことです。p50有限／p80=nullではp50のラベルを残して「目安は3年以上先」、両方nullでは「目安も3年以上先」と表示します。有効な一部期間外の入力を拒否する修正にはしていません。Optionalの空文字・空白だけの`conditional.reason`も既存guardで拒否します。

| 今回実行した確認 | 結果・範囲 |
| --- | --- |
| strict・exact optional・型負例11件／React SSR 24件／Vite build | 成功。旧20件を維持し、p50有限／p80=null（TODAY_DONE・CURRENT_STATE）、仮定0日、不足と条件付き回数、非空の理由を4件追加。両方nullの既存assertionも強化 |
| 固定Engine接続24件 | 成功。Engine pin `f7a6c02`とLF正規化fixture hash `ba7820…4ac47`を維持。mainの新しいEngineの検証へ読み替えない |
| 敵対的セルフレビュー | 正常6状態は値を変更せず表示。不正16入力は共有guardと参照rendererの両方で拒否。NaN／Infinity／負数／小数／unsafe integer／quantile逆転／null・label不整合／出所不足／scenario逆転／空理由を含む |
| Chrome154.0.8037.98での今回の表示確認 | 専用headless／CDPで実部品のSSR HTMLの6状態を1280／320pxで確認。横はみ出しなし、console警告・error／未捕捉例外なし。Playwright CLIは利用できず、React mountや操作・B renderer・正式FE／API／DBは今回の確認対象外 |
| Foundation・差分空白検査 | 112 text files／1241 local links／7 ignore casesで成功。候補の型・SSR・buildとは別に確認 |

B rendererへの意味の引き継ぎをREADMEに記載しました。正式FEの表示形式はProduct SpecのP-12が正で、候補の文言を正式仕様へ昇格させません。参照rendererの全文コピーや図・補助指標の追加、API／Engine／表示型の拡張、D-26採択は行っていません。差分は表示・SSR・README・本記録の4ファイルです。正式仕様・配置・参照先を変更していないため、Product Spec／Architecture／change-mapの更新は不要です。

この候補修正で未解決のBlocking／Should Fixはありません。Human Review、正式B rendererの検証、R-11の保存・結合、D-26と#70／#117／#88の条件は残ります。以下の(c)対応の実DOM操作や画像は`e9599f2`時点の履歴で、今回の新しい操作結果として扱いません。

## (c)対応の再検証（2026-10-06）

FE相談6016619430と依頼者の(c)＋必要な部品調整の承認に基づき、PR120 `6f08c52`から候補を更新しました。共通表示型のR-06不足・元の完了日数、公開source helper／共有guard、外部見出しID、scoped CSS変数を確認する変更です。P-12の実績、R-07／R-08、未保存draft・実績への非加算を維持しています。候補5ファイルはすべて変更され、旧`7b0debd`と同一ではありません。取得HEADは変更後のPR返信で固定します。

| 今回実行した確認 | 結果・範囲 |
| --- | --- |
| strict・exact optional・型負例11件 | 成功。既存8例に、NONE注釈禁止・Planなし不足・ラベルだけの完了estimate禁止を追加 |
| React SSR 20／20 | 成功。既存15件を継承し、helper公開、外部見出し参照、R-06不足、rendererから独立したguard、0/null日数とラベルの整合を追加 |
| 固定Engine接続24／24 | 成功。pin `f7a6c02`と同じLF正規化fixture hashを維持。元のp50Days／p80Daysをそのまま渡すassertionを追加。nullではformatterを呼ばず、仮0日は実績達成へ加算しない |
| 独立previewのVite build | 成功。依存・root workspaceの新設なし。Windows x64／Node22.15.1、TypeScript5.8.3／React・React DOM19.3.0／Vite8.3.1 |
| 実DOM・Chrome154.0.8037.98 | 専用headless Chrome／CDPで8確認が成功。Playwright CLIが利用できず既存Chromeを使用。実API／DB・保存・FEのB rendererは起動していない |
| 現行Resultの直接渡しの型負例 | compilerのみでTS2345を確認。最新main `3166e14`とローカルの`PredictionResult`型blob同一を照合し、候補inputの`evidenceSource`／`conditionalPlan`欠落を拒否。実行・SSR件数へ合算しない |
| Foundation・差分空白検査 | 112 text files／1241 local links／7 ignore casesで成功。アプリ全体のbuild・E2E成功ではない |

実DOMで、マウス・矢印・Space・Tab／Shift+Tab、保存中disabled／失敗後のdraft保持、可視の外部summary見出しと折りたたみ、2インスタンスのID/name/error/help参照を確認しました。fallback色と検証用の別tokenでaccent／source／error／focusのcomputed styleも確認しました。検証用tokenはFEの実値ではありません。

R-06の両不足文言、中心だけ表示可能な状態と実観測2回中1回、記録済みの非比較不足、達成、保存結果不明／再取得失敗を確認しました。不正countsのguard例外は予測用のQA Boundaryだけをfallbackし、外の質問操作は継続でき、表示状態変更によるBoundary再作成で復帰しました。意図的なguard例外に由来するconsole error 1件を観測し、他のRuntime console警告／errorや未捕捉例外はありませんでした。正式FEのGoal切替／再取得controllerの確認ではありません。

1280／390／320pxで横はみ出しなし、選択labelは48px以上でした。[今回のdesktop](screenshots/fe-seam-desktop.png)と[今回の320px](screenshots/fe-seam-mobile.png)はR-06中心のみ表示と外部見出しを描く独立QAです。左の未保存回答から右を計算・保存した画像ではなく、B案の図やデザインとの一致も示しません。検証ブラウザは終了し、previewのlisten終了も確認しました。

残条件はB rendererへの引き継ぎ、FE実tokenの照合、実週ラベル、正式API／回答保存／同一snapshotのcontext／freshness、NVDA・タッチ端末、#81ユーザー確認、D-26採択と#70／#117の着手・完了条件です。Product Spec／Architecture／change-mapの正本は更新不要：正式仕様・配置・APIを変更せず、既存候補の参照先を維持したためです。READMEと本記録をコード・テストに合わせて更新しました。

## 2026-10-05の自動検証（履歴）

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

## 6f08c52でのoptional propsとBE境界の再確認（履歴）

PR122 `54b59e3`の`exactOptionalPropertyTypes: true`で、旧`GoalQuestionSlotExample`が`disabled?: boolean`へ明示的な`undefined`を渡し得るTS2375を再現しました。`saving || questionProps.disabled === true`でbooleanへ正規化する1式修正と、候補の検証設定への同flag追加を行いました。propsの語彙、5コピー対象、保存処理、API／Engine出力型は変更しません。

Windows x64／Node22.15.1、既存lockのTypeScript5.8.3／React・React DOM19.3.0／Vite8.3.1で、変更後の`check.mjs`（exact optional＋型負例8件、SSR15／15、Vite build）と固定`f7a6c02`への接続24／24が成功しました。compilerのみの別負例でも、mainの`PredictionResult`を`engineViewExample`へ直接渡すと`evidenceSource`／`conditionalPlan`欠落のTS2345となることを確認しました。この負例は実行しておらず、24件へ合算しません。5コピー対象は`7b0debd`とbyte同一です。ブラウザの再操作は行っておらず、過去の実DOM確認を新しい実行結果として扱いません。

main `dc668fb`の`PredictionResult`とBEの暫定方針を読み合わせ、candidate変換へ直接渡せないこと、不足・RECORDS出所・Goal context・未保存draft／revisionの境界を[README](README.md#現行実績モードとの接続境界2026-10-06)に記録しました。HTTP／DB／回答保存やR-11の完成を示す確認ではありません。#88の基点・限定先行の承認も未決です。

上の`783ebb4`時点の計算source同一という記録は当時の確認です。現在のPR119 `918d10e`は共有DPのsource変更を含み、同じ記述を最新HEADへ適用しません。この候補CIのEngine pinは既検証の`f7a6c02`のまま保持し、別PRの変更やテストを今回の検証件数へ合算しません。

## 2026-10-05の実DOMで確認した範囲（履歴）

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

## 2026-10-05のセルフレビューと残り（履歴）

候補の担当境界、read-only表示、任意回答、出所、実績を増やさないこと、未採択の扱い、アクセシビリティ、依存変更の有無を確認した。JavaScript側から型を回避した場合も、記録済みにTODAY_DONE完了比較を渡すと拒否する実行時guardを追加し、SSRで確認した。この候補の範囲で未解決のBlocking/Should-Fixはない。

NVDA等による読み上げ、タッチ端末、本番FEでの親draft/save/error/freshness/優先resolver、422契約、API保存・再取得、実snapshotのcontext整合、週ラベル、D-26/PR118採択は未確認。#70 Hard、#117 DoR/blockedとClose条件は解消していない。FEレビューと契約採択後に正式配置・統合を別途判断し、この候補だけでmergeや本番配線をしない。
