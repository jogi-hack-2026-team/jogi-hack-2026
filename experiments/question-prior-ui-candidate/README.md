# R-11追加質問・出所表示のReact候補（#117）

**Supporting Artifact / Not a Source of Truth。具体契約は未採択、本番画面・API・Engineへの組込は未確認。**

[#117](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/117)の追加UI担当分を、FEが部品と状態所有者をレビューできるように隔離した候補です。現在mainに正式な`apps/web`とroot workspaceはなく、[D-23の採択構成](../../docs/architecture.md#repository構成)に置く前の部品確認です。Goal作成・一覧やToday画面全体、認証・DB・HTTP、計算Engineを複製していません。

[PR115](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/115)はR-11のMust・分担の採択記録で、mainへ反映済みです。[PR118](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/118)は具体質問・数値・保存・表示契約の提案、[PR119](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/119)は質問prior計算adapterの候補です。本候補は最新mainから分けたSupporting Artifactで、PR118/119の変更は取り込んでいません。#70 Hardと#117のDoR/blocked/Close条件は維持します。

## 部品の動作と受け渡し案

[QuestionPriorFields](src/QuestionPriorFields.tsx)はGoalごとの任意2問です。経験確認は説明文にまとめ、数値に影響する3問目を追加しません。

- a：「取り組めた日の翌日も、続けて取り組むことはどのくらいありましたか？」
- b：「休みをとった日の翌日に、また取り組むことはどのくらいありましたか？」
- LOW/MID/HIGH、UNKNOWN（経験なし・思い出せない）、null（回答しない）を区別。4回中1/2/3回の表現はPR118の候補です。UIは確率・Beta・重さへ変換しません。

記録開始前の、今回と近い行動・量・生活状況、少量でも取り組めた日を含む過去の経験を答える説明を置きます。`value`はa/b両方を含み、選択・解除ごとに`onChange(nextPair)`へ新しいpairを返します。片方を編集しても他方を保持し、内部に回答stateや保存処理を持ちません。回答・UNKNOWN・スキップからActionLog、進捗、実績件数を作りません。

[PriorForecast](src/PriorForecast.tsx)は、親が解決済みの`view`だけを表示します。出所は回答／回答＋実績／実績／不足に分け、a/b別の出所と実際の観測件数を別に扱います。回答を含む見通しには仮定である説明を付けます。材料不足時は供給された残量・設定量での条件付き回数を表示し、日数の予測でないことを明示します。回数の切上げ、gate、quantile、週の月曜日やtimezoneの計算は行いません。

`completed`は実績達成、`today-recorded`は今日の記録後の表示で、core比較を受け取りません。記録済みの完了はCURRENT_STATEだけを型と実行時で許可します。未記録のTODAY_DONE完了は仮定と明示し、実績・達成への反映をしません。p50/p80のラベルはFEから受け取り、nullは「3年以上先」とする候補です。未計算quantileを推測した固定値で埋めません。loading/error、保存成功後の再取得失敗、保存結果不明は数値viewと別unionです。

| 所有者 | 接続点・責務 |
| --- | --- |
| Kaito/#117 | 質問・出所表示、候補の表示型、scoped CSS、部品テスト |
| FE/#78 | draft初期値・編集、保存中disabled、422のfieldErrors、global保存状態。Goalの既存フォームへ[slot例](examples/slots.tsx)で追加 |
| FE/#81 | APIの実行時検証と変換、最新応答の判定、R-08→R-07→材料gate等の採択済み優先順位、週ラベル。解決したviewをTodayの既存領域へ渡す |
| BE/#76/#77・Engine/#71〜73 | 保存・取得・snapshot/全実ログ、revisionと競合、計算・出所/gate。正式契約はPR118/119で別途採択・結合 |

[presentation-types.ts](src/presentation-types.ts)はローカル表示候補で、共有API/Engine DTOの採択ではありません。[slots.tsx](examples/slots.tsx)はrenderのみの最小接続例です。form/route/query/mutationや保存ボタンを作っていません。採択後にFEが既存controllerへ接続し、共有ファイルをFEが所有、部品内の変更をKaitoが担当する案です。実際の配置・変更順・競合解消手順はFEレビューで合意してから統合します。

## 設計意図と残る条件

目的は、既存画面と競合せずに任意入力・出所の誤読を確認することです。controlled入力とresolved表示に分けた理由は、保存/応答の新旧判定とEngineの数値計算をUIへ重複実装しないためです。native fieldset/legend/radio、instanceごとのuseId、label、error説明IDを使い、任意入力とキーボード操作を保ちます。CSSは`.r11-qp`内に限定します。

画面の複製、新しいchart、共通schema、フォームframework、状態管理libraryを追加する代案は、FEの既存担当や未採択契約と重なるため採りません。別の固定HTML版も増やさず、唯一のindex.htmlはReact mount用です。大きな固定例JSONや内部引き継ぎ資料は追加しません。

trade-offとして親の正しいstate/値・API validationに依存します。失敗・古い結果を新しい結果として渡さない責任はFEです。部品の確認は実API、権限、再送、保存revision、本番Engine結合、#81の3〜5人確認の代替になりません。正式props/DTO・質問文・数値・出所version・不足条件が採択された時と、FE基盤ができた時に本候補を照合し、必要な差分だけを正式配置します。仕様の正本は[Product Spec](../../docs/product-spec.md)と[Architecture](../../docs/architecture.md)で、今回変更しません。

## 再現手順

repo rootを作業ディレクトリにし、Node/npm、既存lockを使います。新しいpackage manifestやroot依存はありません。検証依存として既存experimentのReact/React DOM/Viteと既存predictionのTypeScriptを再利用するため、以下の2回のinstallは必要です。experimentのAPI/auth/DB/embedded Postgresやinstall scriptは起動しません。

```sh
npm ci --prefix packages/prediction --include=dev --ignore-scripts --no-audit --no-fund
npm ci --prefix experiments/architecture-verification --include=dev --ignore-scripts --no-audit --no-fund
node experiments/question-prior-ui-candidate/scripts/check.mjs
node experiments/question-prior-ui-candidate/scripts/serve.mjs
```

checkはstrict型検証（[8つの型負例](tests/type-contracts.tsx)を含む）、[15件のReact SSRテスト](tests/presentation.test.cjs)、隔離previewのVite buildを順に実行します。成功時は最後に`PASS: strict candidate types, SSR tests and isolated React preview build.`と表示します。生成物とホストごとの型参照は`.qa/`に置き、Git管理しません。個人パスをソースへ固定しません。

serveが出す`http://127.0.0.1:<port>/`を通常ブラウザで開きます。候補previewの静的GET/HEADだけを配信し、directory listing/APIはありません。外部公開・auth・DB・API接続はなく、CSPのconnect-srcはnoneです。終える時は通常interactive terminalで`stop`、またはCtrl+Cを使います。ブラウザのfile URLはこのpreview手順では使いません。

Missing existing verification dependenciesは上記install不足、型検証失敗は候補/負例の不一致、Vite build失敗はその出力を確認します。依存manifestやrootを変更して回避せず、修正後に同じcheckを再実行します。

確認環境はWindows x64/Node22.15.1/npm10.9.2、既存lockのTypeScript5.8.3、React/React DOMと型19.3.0、Vite8.3.1です。既存experimentのenginesは24.21.0のためNode22 installではEBADENGINE warningがあります。候補CIはNode24.21.0を使います。これらの版は本番runtime採択を示しません。

## Engine候補からのローカル接続確認

[engine-view.ts](examples/engine-view.ts)は、別checkoutのPR119実Engine出力から表示候補へ渡すFE所有の接続例です。`conditionalPlan`の値をそのまま表示用`Plan`へ改名し、BEが同じsnapshotから付ける案の`unit`/`sessionAmount`をcontextとして受けます。UIで切上げや予測日数を再計算しません。週・timezoneのラベルはFEのcallbackに委ねます。保存済みGoalや採択済みHTTP DTOとして扱わず、正式なfreshness/error resolverも追加しません。

既存依存を準備して上のcheckを実行後、独立したPR119・PR118 checkoutのパスを指定します。照合したcommitとfixture hashは[検証記録](VERIFICATION.md)に記載しています。

```sh
node experiments/question-prior-ui-candidate/scripts/check-connection.mjs --engine-root "../engine-pr119" --fixtures "../contract-pr118/experiments/question-prior-contract/common-fixtures.json"
```

[接続check](scripts/check-connection.mjs)は既存compilerでEngineの元の型設定を検証し、ignored `.qa/connection/`へだけemitします。実Engine型と表示例のstrictな受け渡し、[共有18例と追加状態のReact SSRテスト](tests/engine-connection.test.cjs)を実行し、Nodeの版に依存しないTAP reporterを明示します。成功時はTAP結果と要約、同ディレクトリの`report.json`へ実出力・view・HTMLを記録します。Engine HEAD/fixture hashが変わった場合は停止するため、新しい提案を確認してから固定対象を更新します。Engine checkoutへの書込、依存追加、HTTP、DB、保存のfixtureはありません。

候補CIはNode24.21.0で部品checkと接続checkを実行します。PR119 `f7a6c02`とPR118 `b740075`をcommit SHAでcheckoutし、Engine HEADとLF正規化後fixture hashを照合します。成功時の`report.json`は14日間のActions artifactです。ここでのSSRラベルは`表示fixture:N日`で、実際の週ラベル・ブラウザmount・予測精度の検証ではありません。正式配置と保存・取得はFE/BEとの契約合意後に結合します。

## ブラウザでの再現チェック

[preview.tsx](examples/preview.tsx)のsave/scenarioは手動の表示固定例です。F04は回答a=null/b=LOW、実績60/100・実観測0、core約3日、残り40を1回15で行う条件付き3回の表示派生です。未保存draftを編集しても右の固定viewは変化しません。missingはF01の不足表示、recordedはF15、completedはF16、再取得失敗/保存不明はI07/I08に対応する表示例です。PR118の18入力やDP goldensを複製・再計算せず、全Engine例との正式結合を確認したものではありません。SSRの週ラベルはsyntheticな表示確認用で、quantile goldenではありません。

1. a/bの選択・「回答しない」・UNKNOWNを試し、上部draftと変更通知を確認。片方が他方を消さないことを確認する。
2. 選択済みradioの矢印/Space、Tab/Shift+Tabを操作し、親再render後のcheckedとフォーカスを見る。
3. 保存中を選んで2群と解除ボタンのdisabledを確認。保存失敗へ切り替え、draftを保持して再編集する。項目エラーを付けたbのlabel/説明対応を確認する。
4. 2つ目のGoalを出し、groupの選択が干渉しないことを見る。2つ目は固定値の例で、別Goalの保存controllerではない。
5. 再取得失敗・保存不明・不足・今日記録済み・達成へ切り替え、古い推定値、条件付き回数と日数の混同、実績の偽加算がないことを確認する。
6. desktop1280px、mobile390px/320pxで配置・横はみ出し・labelとfocus枠を確認する。

実ブラウザの観察・assertion、console、スクリーンショットとセルフレビュー結果は[検証記録](VERIFICATION.md)にまとめます。SSRはDOM変更通知の検証ではありません。NVDA読上げと本番FE/API/Engine結合は残ります。
