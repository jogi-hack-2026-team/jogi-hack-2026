# D-26 質問・保存・表示の最小共通契約案

**Supporting Artifact / Not a Source of Truth / PROPOSAL / 未採択・未接続**

R-11のMust追加と担当分担の公開採択記録は[PR115](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/115)で扱い、2026-10-05 15:10 UTCにmain `dc668fbae199660a22a93ec0af66a3bed0daba40`へ統合済み。本案は具体契約を選ぶためのSupporting提案。元のbranchと数式固定例はmain `725e2607198514254d42fb585d9a85e11ed7b89a`を基点とし、PR115の5文書を重複取り込まない。npm workspaces／pgの採択はPR116でmain統合済みだが、API細則・D-26はその採択に含まれない。

**当初の具体仕様の判断目標日は2026-10-05（JST）。** 依頼者側の目標であり、FE／BEの返答確約やチーム合意の期限ではない。FEレビューを受けた現在も具体契約は未採択で、新しい合意日を推測しない。以下の3群はすべて提案で、公開やレビュー依頼自体をDECIDEDへ読み替えない。

## 判断を求める3点

| 項目 | 推奨案 | 了承後にも必要な確認 |
| --- | --- | --- |
| 1. 質問と見通し | 任意2問。LOW／MID／HIGHを25／50／75%の平均、Beta(1,3)／(2,2)／(3,1)、強さ4へ対応。不明と未回答は数値回答にしない。中心はbの材料、完了はa・b両方の材料を要求。不足時は条件付きの「あと何回分」 | FEの文言・表示理解、Engineの選択値の回帰・性能。数値は暫定的なEngineering Priorで、校正・最適性は未実証 |
| 2. 保存と訂正 | 作成後の訂正・解除・後日回答を残し、BEがraw回答とmapping/context snapshotを保存。元snapshot＋実ログから全量再計算。回答専用revision比較を推奨し、Goal全体revision・LWW・POST限定と比較。同版・同内容は書き込みなし、古い版は409から始める案。量変更と再回答は分ける | BE／FEのDTO、DB snapshot方式、競合・Goal作成の通信断契約。下記の比較・同時PATCH案は未採択 |
| 3. UIの受け渡しと追跡 | PR120のKaito候補は質問入力と予測パネルの描画、FEは画面本体・フォーム／Today・API接続・状態判定とview生成。共通固定例で接続し、#107と既存実装Issueで追う | 予測パネルを受け渡す範囲・文言・共有ファイル担当、BE／Engineの共通例、各IssueのDoR。判断・実装期限を推測しない |

「1〜3で進める」という方針判断と、具体のHTTP型・FE／BE本人の採択を分ける。本案はPR115と分けたSupporting提案であり、具体値・HTTP型の採択ではない。

## 1. 既存契約として保持するもの

- 実績のみの公開`predict(input, config)`、共通Beta(2,2)、modelVersion／seed／K=200／H=1095、中央値・閉形式・抽選順・DP。任意の新しいmodelVersionをここで割り当てない。
- DONEは正の実量。1回量未満でもDONEであり、過去のDONE量を新しい`sessionAmount`へ書き換えない。SKIPPEDの保存量はNULL、入力amountは許可しない。
- 今日の仮実行・回答・初期量はActionLogや遷移件数にしない。実ログの隣接日だけを数え、UNKNOWNをまたがない。
- 所有者条件、他人／存在しないGoalの404、未認証401、不正入力422、Goal timezoneの日付、記録開始日、今日／昨日の書き込み制限。同日PUTの既存上書き規則をこの案でCASへ置き換えない。
- 達成済みのR-08、今日記録済みのR-07、補助指標2つまで。unitsは`minutes | sessions`のまま。PoCの「100問」は数量説明であり、新unit追加ではない。
- #70／#74／#75のBLOCKEDとHard／Integration依存。PR116だけで解除しない。

## 2. 質問と数値

Q1は「取り組めた日の翌日も、続けて取り組むこと」、Q2は「休んだ日の翌日に、また取り組むこと」。a／bそれぞれに対応させる。ここで取り組むとは、現行DONEに対応する正の実量であり、「設定した1回量を全部終えた日」に狭めない。

参照する経験は**記録開始日前の、今回に近い行動・量・生活状況**とする案。現在のGoalの実ログをもう一度回答に要約してpriorへ加える運用はしない。開始日前を後日正確に思い出せるかは未検証で、答えられなければ不明・スキップを選べる。経験確認の第3問や短期Goalの自動除外は加えない。

| raw値候補 | 選択肢 | 有効な回答prior | 扱い |
| --- | --- | --- | --- |
| `LOW` | 少なかった（4回に1回くらい） | Beta(1,3)、平均25% | a／b独立 |
| `MID` | 半分くらい（4回に2回くらい） | Beta(2,2)、平均50% | 共通fallbackと同じ数値でも本人の明示回答 |
| `HIGH` | 多かった（4回に3回くらい） | Beta(3,1)、平均75% | a／b独立 |
| `UNKNOWN` | 経験がない・思い出せない | なし | 本人が不明と回答 |
| `null` | 未回答・スキップ | なし | 本人の50%回答へ変換しない |

強さs=alpha+beta=4は、25／50／75%を正の整数Betaへ写すための最小共通値という実装上の選択。強さ8より早く実績が影響するが、s=4が適切・最適という研究結果ではない。`s/(s+n)`は起点別n遷移に対する数式上の重みであり、質問を「実績4回」と説明しない。記録0でも質問回答に基づく値を出す機能がR-11の対象で、fallbackだけをその回答の代用品にしない。

## 3. 起点別の更新と出所

有効なnumeric回答があればその初期分布を使い、なければ内部計算用に従来Beta(2,2)を使う。a事後=`(alpha_a+nDD, beta_a+nDS)`、b事後=`(alpha_b+nSD, beta_b+nSS)`。回答訂正時も初期分布と元の全ログから計算する。保存済み事後分布へ同じログを再加算しない。

起点別の材料は、aならnumeric回答または`nDD+nDS>0`、bならnumeric回答または`nSD+nSS>0`。明示ログがあるだけ、`hasLogs=true`、observedDays>0だけでは材料ありとしない。

| numeric回答 | その起点の実遷移 | 出所enum候補 | 表示用の材料 |
| --- | --- | --- | --- |
| なし | 0 | `NONE` | なし |
| あり | 0 | `QUESTION` | あり |
| なし | 1以上 | `RECORDS` | あり |
| あり | 1以上 | `QUESTION_AND_RECORDS` | あり |

出所はa／b別。中心にはbの出所、完了にはa／b両方の出所を使う。UIが全体を一律「あなたの記録から」と表示しない。実遷移件数はEngine observationsを使い、FEやBEで異なる数え方を作らない。

注釈の候補は、QUESTIONなら「回答に基づく仮の見通し」、RECORDSなら「記録に基づく見通し」、QUESTION_AND_RECORDSなら「回答と記録に基づく見通し。初期の回答は仮定」です。a／bで出所が異なる完了値は混在を説明する。NONEは必要な材料と任意回答／記録への案内を表示し、数字を埋めない。文言の理解はFEの簡易ユーザー確認で確かめる。

## 4. 部分回答と表示可能条件

以下は未達成・今日未記録の場合。達成済み／今日記録済みは後述の優先順位を先に適用する。

| aの材料 | bの材料 | 中心g50 | 完了p50／p80 | 完了欄の代わりの候補 |
| --- | --- | --- | --- | --- |
| なし | なし | 不足 | 不足 | あと何回分 |
| あり | なし | 不足 | 不足 | あと何回分 |
| なし | あり | 表示可能 | 不足 | あと何回分 |
| あり | あり | 表示可能 | 表示可能、H内で得られない分位点はnull | 不足欄を同時に追加しない |

中心はbのBeta-Geometric中央値のまま。g80は既存の内部値で、3つ目の補助表示に自動追加しない。「休んだ翌日にやれた回数」は実際の`nSD`／休み起点の実遷移だけで、質問由来priorを成功回数へ加えない。

条件付き回数は`remaining=max(0,totalRequired−actualDone)`、`ceil(remaining/sessionAmount)`。現行unitで残量40・1回15なら「あと3回分」、最後10。日数予測でも1日複数記録の仕様でもない。完了の目安を出せない場合にその欄を置き換え、補助表示を3つへ増やさない。

`TODAY_DONE`で完了0日となっても実際のprogressを達成済みにしない。今日DONEの保存量7／sessionAmount15は実績7を使い、R-07で中心比較を出さず、完了は従来の`CURRENT_STATE`で扱う。

[FEレビュー5416592203](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/118#pullrequestreview-5416592203)を受けた表示の具体案は次のとおり。**以下も未採択**で、採択後にP-12／R-07と受入条件へ反映する。

- 今日記録済みで完了の材料が足りないF15でも、完了欄を条件付き回数に置き換える。中心比較は出さず、実際の残量40・設定量15からあと3回分・最後10を使う。今日未記録の仮DONEを加算しない。
- 文言候補は「設定量で続けた場合、ゴールまであと3回分（最後は10分）」。表示unitは現行の分・回を使う。日数や、予測を出すために必要な記録回数という意味ではないことを同じ欄で伝える。
- 回答なしの既存Goalにもこの置換を適用する案なら、**P-12の不足文言の変更**が必要。legacy Engineの不足判定・事前分布・出力を変える案ではなく、UIの不足欄だけが対象。既存Goalを含める採否・互換性はFE／BE確認待ちで、現在の画面へ適用済みとはしない。
- 質問だけで中心を出し、休み起点の実遷移が0件なら「0回中0回」を出さず、PR120候補と同じ「休んだ翌日の実際の記録はまだありません」とする案。質問priorを実回数へ足さず、実遷移が得られた後は従来の実回数を表示する。FEが実件数をviewへ渡し、Kaito候補が描画する。欄ごと隠す代案もFEの判断対象で、現候補は欄を残す。
- 中心注釈はbの出所を使う。完了注釈はa／b両方を見て、例えば「続いた日の翌日については回答、休んだ日の翌日については回答と記録に基づく仮の見通し」と混在を明記する。具体文言の候補・描画部品はKaito、採択と理解確認・組み込みはFEと合わせる。

## 5. 保存・訂正の最小案

既存Goal POST／GET／PATCHへ任意の`questionPrior`を追加する候補。新endpointは作らない。requestにはrawだけを含め、clientにalpha／beta／strength／mappingVersionを決めさせない。

```json
{
  "questionPrior": {"a": "HIGH", "b": "LOW"}
}
```

- POSTでblock省略：回答なし。PATCHでblock省略：現在の回答を保持。
- blockを送る場合はa／b両キー必須、各値は上記enumまたはnull。`questionPrior:null`は422候補。明示解除は`{a:null,b:null}`。blockを一体で更新し、片方のキー省略を曖昧なPATCHにしない。
- BEがraw、固定mappingVersionとLOW／MID／HIGH全3選択肢のBeta、回答時のunit／sessionAmount／recordStartDateを内部snapshotへ同時保存する。adapterが使うa／b初期Betaはこのrawと保存mappingから解決し、別の事後分布を保存しない。競合tokenは採択する方式に合わせる。mappingを将来変更しても保存済み回答を黙って新mappingへ置き換えない。継続的な履歴テーブルやEvent Sourcingは本案に追加しない。
- 古いGoalの回答なしはlegacy。missing schemaから回答や過去ActionLogを捏造しない。recordStartDateの取得／保存自体が未定義のため、既存Goalへの補完規則は#76の確認対象。createdAtを勝手に代用しない。
- 許可済みのsessionAmount変更は既存の回答priorを解除し、新しい量では任意再回答。unit編集が採択された場合も同じ。unitの編集可否をこの案で新たに許可しない。実ログ・過去DONE量は保持。
- 単なるtitle／totalRequired編集で確率を再推定しない。取り組む行動そのものを変えた際の黙った流用を避ける説明・手動解除が必要。同じ回答のまま別Goalへ自動コピーしない。
- 後日の訂正は当初の経験に対する回答訂正。新たな実ログからpriorを繰り返し作り直さない。

**量変更と回答を同じPATCHに含める場合の追加案（未採択）**：sessionAmountが実際に変わるときは、`questionPrior`省略または`{a:null,b:null}`だけを許し、旧回答を解除する。LOW／MID／HIGH／UNKNOWNのいずれかを同時に送ったら422候補で、量も回答も書かない。黙って新回答を捨てず、新しい量への回答は量の保存・最新Goalの再取得後に別PATCHで行う。変更されないsessionAmountを再送しただけなら、この解除規則は発動しない。

FEの編集フォームに「1回の量を変えると、初期質問の回答がリセットされます。保存後に任意で答え直せます」という警告を置く案。FEが警告と解除後のdraftを管理し、Kaito部品は渡された値とdisabledだけを描画する。確認ダイアログや新endpointは増やさない。

[BEレビュー5417166527](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/118#pullrequestreview-5417166527)を受け、**比較・解除・保存は1つのtransactionで行う案**を明記する。所有者条件を含むGoal行を固定して現在の量とtokenを読み、全入力・実際の量変更・同時回答・競合を検証してから、量・回答snapshot・回答用tokenを同じ更新で確定する。422／409候補では他のGoal項目も含め書き込みなし。検証とUPDATEの間に別PATCHが入る構成にはしない。行ロックまたは条件付きUPDATE、具体SQL・分離レベルはBEが実装時に選び、並列PATCHのDB検証を行う。

**recordStartDateの先行依存（未採択）**：#74／#76で、作成時timezoneから算出した固定暦日をGoalへ1項目保持し、GETと記録検証へ共有する方式を先に具体化する案。これは[既存の開始日OPEN事項](../architecture.md#初期進捗と日々の記録の境界)の実装案で、回答snapshotを保存する前提となる。列名・migration・DTOは未採択で、timezone変更後も開始日を動かさない。既存Goalは作成時timezoneの復元可否・既存ログとの互換方針を先に確認し、現在timezoneや最古ログから黙って補完しない。

## 6. revisionと再送

**競合方式はOPEN。** 元のGoal state revision案を以下の比較用に残す。FEレビューの指摘どおり、ログPUTでもstate revisionが増えるので、回答を変えていなくても古い編集は409になる。FEの#88のLWW提案を採択済みとして変更せず、回答専用revision案とも比較する。

**A案だけの比較例**として、BEがGoalにstate revisionを持ち、保存が確定したGoal／ログ／回答変更ごとに原子的に更新する候補を残す。ログPUTの既存置換規則は維持する。回答snapshotの`appliedRevision`は最後に回答を変更した時点のrevisionなので、その後のログ変更で現在revisionより古くなることは正常。以下のJSON・I01〜I03はA案であり、C案にstate revisionを必須追加する要求ではない。

```json
{
  "expectedRevision": 7,
  "questionPrior": {"a": "HIGH", "b": "HIGH"}
}
```

所有者・validationを先に確認する。**送られた全変更内容**が現在保存済み内容と一致し、mappingと行動文脈も一致する再送なら、古いexpectedRevisionでも書き込みなしで現在値を返す候補。priorだけが同じでも、他のGoal項目が違えばこのno-opにしない。

異なる変更でexpectedRevisionが古ければ409候補・書き込みなし。FEは最新を再取得し、編集draftを別に保ち、本人の再保存を待つ。正しいrevisionの訂正はsnapshotを置換して一度だけversion更新し、同じ実ログから再計算する。

I01の再送例は、Goal revision **6**で送った回答が保存されて`appliedRevision=7`になり、その後のログ保存でGoal revision **8**になった状況。再送は最初と同じ`expectedRevision=6`を保持し、同じ全変更内容・mapping・contextならno-opでrevision 8を返す。保存後の7へ書き換えたrequestを「同じrequestの再送」と呼ばない。I03は別の訂正例で、7から8へ更新する。これらは元のGoal revision案の仕様例で、HTTPの実行結果ではない。

| 比較案 | ログ追加だけが起きたとき | 代償・未確認 |
| --- | --- | --- |
| A. 元のGoal state revision比較 | 異なる回答を古い編集画面から送ると409 | 全体snapshotの変更を検知できるが、回答と関係しない記録でも競合する |
| B. FE提案のLWW＋保存後再取得 | 記録だけでは回答保存を拒否しない | 別タブの回答訂正を後の保存で上書きする。通信断・量変更との競合を別に確認する |
| C. 回答専用revision比較（推奨候補） | ログだけでは回答のtokenを変えず、訂正を許す | Goal上の回答用tokenをraw訂正・解除・量変更で更新。MVPではstate revisionを別に持たず、取得の新旧はFEで管理する案。型・HTTP・atomic処理は未採択 |

### 推奨をC案に保つ理由（2026-10-06、未採択）

依頼者の指示に基づき、**質問を後から訂正・解除できる範囲を残し、回答文脈専用revision＋DBでの原子的な版比較を推奨する**。[FE再レビュー5422067095](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/118#pullrequestreview-5422067095)のPOST限定／LWW案との比較記録であり、FE／BE双方によるC案の採択や実測工数の報告ではない。

- LWW＋保存後再取得では、2つの編集画面が同じ版を読み、先の訂正を古い後着PATCHが上書きしてから再取得できてしまう。再取得は表示の更新であり、失われた訂正を復元しない。C案はその古い書き込み自体を拒否する。
- POST限定は誤回答の修正・解除、未回答Goalへの後日追加、量変更後の再回答を失う。訂正UIを省いても、許可済み量変更時に古い回答priorを無効化する処理は残る。今回は機能を作成時だけへ縮める推奨に変更しない。
- C案は回答／量の文脈だけを守るので、ログPUTはtokenを変えず、A案のように記録のたびGoal全体revisionを更新しない。別instanceの要求も同じDB行で判定する。全体state revision、アプリ側の分散lock、履歴テーブル、自動mergeを回答競合のために追加しない。
- 必要な追加処理は回答用tokenの保持・GETへの受け渡し・PATCH時の版比較と更新、409時のdraft保持と本人の再保存。量変更時のprior解除・同時PATCHのtransaction・所有者検査・FE取得世代管理はそれぞれ保持する。DB並列試験・API接続の実装量や所要時間は未実測で、今日中の完成を保証しない。

Cの最小案は**回答用tokenだけをGoalに持ち、state revisionと別のappliedRevisionを追加しない**。回答なし・解除後にもtokenを保持し、`questionSnapshot=null`をtoken 0へ戻して古い編集を再び通すことはしない。raw訂正・解除・sessionAmountの実変更（回答なしの場合も文脈変更）で単調に更新し、ログPUT・title／totalRequiredだけの編集・全項目一致のno-opでは更新しない。

回答blockまたはsessionAmountを送るPATCHは、Goal GETで得た回答用tokenをJSONの`expectedAnswerRevision`で添え、不一致は409・PATCH全体を書き込みなしとする案を推奨する。次はC案のrequest例で、型・初期値・安全な上限・共通error envelopeは採択待ち。

```json
{
  "expectedAnswerRevision": 7,
  "questionPrior": {"a": "HIGH", "b": "HIGH"}
}
```

所有者・入力を検査した上で、同じtransaction内の版比較を先に行う保守的な案。**古いtokenは同内容でも409**とし、tokenが一致して送った全変更内容・保存mapping・contextも一致する場合だけno-opにする。no-opでは保存済みmappingを保持し、最新定義の再適用で新しい書き込みに変えない。異なる内容なら5節の量変更・解除を一度だけ保存する。古い同内容再送を成功扱いにする最適化は、通信断・途中の訂正／解除・量変更を区別する方針が決まるまで入れない。上のI01〜I03はA案の比較履歴であり、このC案の再送規則とは別。unit編集を別途採択した場合も同じ文脈変更として扱う。回答に関係しないGoal編集全体の競合方式を、このtokenで採択しない。

**公式根拠と適用範囲（2026-10-06に確認）**：[PostgreSQL 18のRead Committed](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-READ-COMMITTED)では、通常SELECTと後続SELECTの間に他transactionのcommitが見える一方、競合UPDATEは待機後に更新済み行へWHERE条件を再評価する。これを根拠に、所有者条件付きの行lock下で比較・検証・保存するか、owner・id・回答revisionを条件にしたUPDATEで原子的に判定する案とする。単にtransactionへ入れたSELECT→無条件UPDATEでは版比較を守れない。量・snapshot・tokenの同時確定、0行更新の404／競合の区別、分離レベルはBEが具体化・並列検証する。

[RFC 9110 §13.1.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1)はIf-Matchで選択representationの強いETag比較を行い、失敗時に変更を適用しない仕組みを定義する。[§15.5.10の409](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.10)と[§15.5.13の412](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.13)を区別し、今回のJSON業務tokenは409候補、将来If-Matchを採用するなら不一致は412とする案。回答tokenをGoal全体のETagに流用せず、対象representationとその全変更を正しく定義する。[Google AIP-154](https://google.aip.dev/154)も更新前の鮮度比較と不一致拒否を示すが、Googleのetag／ABORTED規則を本案がそのまま実装したとはしない。これらはC案を推す設計上の根拠で、当アプリの競合処理の実測ではない。

**編集フォームの取得元はGoal GETを推奨する案。** FEは最新raw・unit／sessionAmount／recordStartDate・採択する回答用tokenを同じ応答から受け取る。内部mapping／初期Betaを編集フォームへ返す必要は現候補にはなく、/todayを編集tokenの取得元にしない。正確なGoal DTOはBE／FE確認待ち。

確定保存後の予測再取得失敗は「保存済み／再取得失敗」で、再保存しない。回答PATCHの通信断で保存結果不明ならGETを先に行い、同内容・contextを確認する。現在値の一致やtokenだけを自分の書き込み成功証拠にせず、別の回答なら本人の明示再送を待つ。

Goal作成POSTの通信断は、Goal IDが返っていない場合の再取得／重複作成対策が既存#76でOPEN。上の既存Goal PATCHのno-opをPOSTの冪等性と主張しない。操作IDや成功DTOを追加採択せず、初回Goal＋回答保存の接続前にBE／FEが具体化する必要がある。成功status／共通error envelopeも未採択。

**エラー形式と409の判断先**：共通error envelope・項目path・POST／PATCHの成功statusは[#84の既存契約差分](../architecture.md#検証コードとの差分変更案未合意)と#76／#77でまとめて採択する。C案では競合409・全体書き込みなしを候補にし、FEはdraftを保持してGoal GETを再取得する。409を422のfieldErrorsへ混ぜず、勝手に最新tokenへ差し替えて再送しない。保存済みmapping破損はclientの回答不正と区別し、Engineのname／kind／reason／pathをBEで扱う。messageの文章から分類せず、HTTPへの変換は採択待ち。8節の仮fieldErrorsは共通envelopeではない。

## 7. APIとEngineの責任分界

1. BEが所有者条件の下で、Goal・回答snapshot・全実ログを同じ整合したDB snapshotから読む。C案ではstate revisionを追加しない。実際のtransaction／分離レベル／SQLはBE確認事項で、tokenの有無に関係なく読取り途中の混在を許さない。
2. 時刻を一度捕捉し、そのGoal timezoneでtoday／yesterdayを一度計算。recordStartDateでログを絞る。Engine内に時計・timezone・DB・HTTPを渡さない。
3. **採択後の接続では、回答の有無によらず候補adapterを一度呼ぶ案を推奨する。** BEがraw両キー（未回答ならnull）と有効な保存mappingを解決して渡す。質問なしの計算はlegacyと同じで、出所とconditionalPlanも同じ候補結果から得る。公開`predict`は従来利用者の互換入口として保持し、HTTP tokenはEngineへ渡さない。
4. Engineがobservations、prior＋全ログによるposterior、progress、中心／完了の状態を返す。質問modeの材料gateを採択した経路で判定し、FEが数字を無条件表示する方式にしない。
5. BEがEngineの出所・conditionalPlanと同じsnapshotの表示contextをDTOへ結ぶ。rawと回答用tokenは編集用Goal GETへ渡し、APIが同じDTOの中で別時点のGoal／予測を混ぜない。

**条件付き回数の受け渡し案（未採択）**：[FEのPR119レビュー](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/119#pullrequestreview-5416882638)の対象HEAD `32a76cf`には出力がなかったが、[現在のPR119候補](https://github.com/jogi-hack-2026-team/jogi-hack-2026/blob/f7a6c02ec402d3c74fae953cac769de06b31050b/packages/prediction/QUESTION_PRIOR_ADAPTER_CANDIDATE.md#条件付き計画とfebeへの責任境界)は`conditionalPlan={remainingAmount,remainingSessions,lastSessionAmount}`を実際のprogressから一度返す。BEは同じsnapshotのunit／sessionAmountを付加し、FEは残量÷設定量を再計算せずPR120の`Plan`へ名前を合わせる（remainingSessions→sessions、lastSessionAmount→lastAmount）。candidateの実装と正式DTO／API／UI接続の採択は分ける。

FE再レビューのnull質問について、[PR119 `783ebb4`のEngine候補](https://github.com/jogi-hack-2026-team/jogi-hack-2026/blob/783ebb443f0d441ca17cce61109b5da12504ee34/packages/prediction/src/question-prior-adapter-candidate.ts)は全状態で非nullのconditionalPlanを返し、実績達成時は残量／回数／最後量が0。[PR120 `7b0debd`の接続例](https://github.com/jogi-hack-2026-team/jogi-hack-2026/blob/7b0debd483e1a4f26953c9dd5df69a63f29ef3cd/experiments/question-prior-ui-candidate/examples/engine-view.ts)は`progress.completed`を先に分岐し、達成viewへ0回Planを渡さない。未達成の`completion.status=insufficient`だけをconditional viewへコピーし、availableでは完了estimateを表示する。表示専用HTTP blockは**不足時だけ非null、それ以外null**を候補にするが、HTTP DTOの採択・実API接続は未完了であり、Engineの全状態非null型を変更する記録ではない。

常時adapter案は[PR119のBE対応案](https://github.com/jogi-hack-2026-team/jogi-hack-2026/blob/f7a6c02ec402d3c74fae953cac769de06b31050b/packages/prediction/QUESTION_PRIOR_ADAPTER_CANDIDATE.md#beレビューの追加確認と入口mappingの提案)と同じ方向。保存済みmappingはその値・versionを使い、現行版へ黙って置き換えない。保存snapshotがない未回答Goalには、採択済み現行mappingを計算呼出しだけに使い、過去の回答・snapshot・versionの保存履歴を捏造しない案を確認する。この未回答時の解決規則と既存Goal互換性は採択条件。採択後にversion付きmappingを純粋な共有定義1か所へ置き、BE初回保存とEngineが参照する案で、現候補にProduction定数はなく、testsのfixtureを本番から読まない。

内部Engine入口名・export・validation reason/pathは担当レビューで揃える。candidate modeの結果で従来の`config.prior:2`を「今回使った初期分布」として返さず、実際のa／b初期Beta・versionを追跡できる形にする。公開legacyのconfig/resultは保持する。

元の追加Evidenceでは、PR118の元HEAD `c3bd5ef`の18計算例を、Engine担当のローカルnumeric-snapshot候補＋実験adapterで照合した。入力・実績・隣接ログ・事後分布・出所・中心の固定値が一致し、非自明な完了DP9例は共有samplerと独立な条件付きCDFで一致した。この時点の質問材料gateは実験adapterで補っていた。

その元比較で、旧numeric-snapshot入口と提案には材料gateの状態／不足理由の差が13例（F03／04／05／06／07／08／09／10／11／14／15／17／18）あった。N03の未来日付はPredictionInputErrorで一致し、N04の不正priorは旧入口のRangeErrorと提案のPredictionConfigError候補に差があった。凍結Evidenceの13件・RangeErrorはこの旧入口の比較履歴であり、以下の新adapterの未解消件数ではない。

新しい内部`evaluateQuestionPriorAdapterCandidate`は[PR119](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/119)のHEAD `32a76cfefc193d7ddb82c74a764588a8cd04848e`で公開された。[候補説明](https://github.com/jogi-hack-2026-team/jogi-hack-2026/blob/32a76cfefc193d7ddb82c74a764588a8cd04848e/packages/prediction/QUESTION_PRIOR_ADAPTER_CANDIDATE.md)の入口がraw回答とcallerの保存済みmappingを受け、a／b別出所・材料gateを接続して13件の差を解消した。18例と完了DP9件は元の数値・draw hash・CDF境界に一致した。不正なmapping形状はPredictionConfigError／INVALID_INTEGER／mapping配下のpathへ分類され、旧numeric入口のRangeErrorは維持される。同HEADの[Node 22／24 CI](https://github.com/jogi-hack-2026-team/jogi-hack-2026/actions/runs/37323944883)は各61テスト＋独立CDF3テスト・型検査、[Docker CI](https://github.com/jogi-hack-2026-team/jogi-hack-2026/actions/runs/37323944974)は61テスト、[Foundation CI](https://github.com/jogi-hack-2026-team/jogi-hack-2026/actions/runs/37323945326)もsuccessを実ログで確認した。候補側のCIであり、本PR側で61件を再実行した結果ではない。FE／BEへレビュー依頼済みで、候補は未統合・具体契約は未採択。

公開`predict`の既存契約は維持され、API／DB／UIへの正式接続、保存context／revision、正式な出所・version・error reason/pathとHTTPへの受け渡し、具体契約の採択は残る。保存／HTTP／UIの10統合例は未実行。任意の極端なBetaをAPIから渡さず、選択mappingと長いSKIPPED列の計算予算を正式接続前に確認する。

**BEレビューを受けた最小公開block案**：保存mappingVersion・initialPriors・raw snapshotはBE内部の再計算／訂正用に保持し、現在のPR120表示では使わないため`/today`へ追加しない。内部Resultに含まれることはHTTPへ全項目をコピーする理由にはならない。下記は表示に必要なcontext・出所・条件付き回数の責務例で、既存`/today`項目との整合、正確な名前・required/nullable・成功DTO・schema versionはBE／FE確認前である。

```ts
type TodayR11AdditionsCandidate = {
  predictionContext: {
    recordStartDate: string;
    unit: "minutes" | "sessions";
    sessionAmount: number;
  };
  predictionProvenance: {
    a: Source; b: Source; // NONE / QUESTION / RECORDS / QUESTION_AND_RECORDS
  };
  conditionalPlan: {
    remainingAmount: number; remainingSessions: number; lastSessionAmount: number;
  } | null; // 表示専用HTTP blockの未採択案。内部Engine結果とは別。
};
// Sourceは表示用enum候補。内部modeやmapping版を製品versionとして公開しない。
```

既存`PredictionResult`全体の型をFEだけで上書きする案ではない。新modeの表現・現行不足reasonの維持／置換は#71〜#73と#77で具体型と回帰を確認する。HTTP 409、revision、上記追加blockは今回まだ採択しない。

## 8. UI部品と状態の所有者

| 部分 | Kaito #117 | FE #78／#81 |
| --- | --- | --- |
| 質問入力 | `QuestionPriorFields`候補。`value:{a,b}`、`onChange`、`disabled`、`fieldErrors`のcontrolled部品。内部はfocus等の表示状態だけ | Goal draft・初期値・変更判定・保存・サーバerror変換を所有 |
| 出所別表示 | PR120の`PriorForecast`候補。親が解決した予測パネル全体を描画し、出所別注釈を持つ。直接fetch／Engine／mappingを持たない | API adapter、Today取得、状態優先とview生成、既存画面・記録操作とパネルの組み込みを所有 |
| 未保存の回答 | 入力だけ | 既存forecastは最後に保存した回答の値。未保存draftに合わせたlive予測／新preview APIは加えない |
| 保存・失敗 | 渡されたbusy/errorを表示 | 保存中は再送を抑止。保存失敗／保存済み再取得失敗／保存不明を別状態として管理 |

実在する[PR120](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/120) HEAD `0d99ae7b5e2a16ca143efdab205bc5fd06e15bf8`の[候補props](https://github.com/jogi-hack-2026-team/jogi-hack-2026/blob/0d99ae7b5e2a16ca143efdab205bc5fd06e15bf8/experiments/question-prior-ui-candidate/src/presentation-types.ts)と[slot例](https://github.com/jogi-hack-2026-team/jogi-hack-2026/blob/0d99ae7b5e2a16ca143efdab205bc5fd06e15bf8/experiments/question-prior-ui-candidate/examples/slots.tsx)を受け渡しの比較基準にする。現候補は注釈だけではなく、中心・実進捗・補助指標2つ・不足／記録済み／達成済み等の予測パネル全体を描画する。候補公開はこの範囲の最終了承ではなく、FE確認後に#81の描画と二重に置かない形へ合わせる。

| 実在する候補 | 親FEから受け取るもの | Kaito候補が行うこと |
| --- | --- | --- |
| QuestionPriorFieldsProps | readonlyのvalue、onChange、disabled、fieldErrors、任意className | 2問・選択肢・errorの描画と変更通知。draft／保存は持たない |
| GoalQuestionSlotExample | 上のprops＋SavePresentation | saving／saved／failed／saved-refresh-failed／save-unknownの表示。HTTPや再送はしない |
| PriorForecastProps | `view: ForecastPresentation`、任意className | 解決済みviewのvariantを描画。中心days、実進捗、実回数、完了ラベル・出所別文言・条件付き回数を表示 |
| TodayQuestionForecastSlotExample | 上のPriorForecastProps | PriorForecastを配置する最小slot。既存Todayページ・記録ボタン・routeではない |

FEがfreshness／エラー→達成済み→今日記録済み→材料判定を一度解決し、`ForecastPresentation`のkind（loading、error、saved-refresh-failed、save-unknown、completed、forecast、today-recorded）へ写す。Kaito候補のswitchは渡されたvariantの描画で、answers・logsから優先順位を再計算しない。FEはdays／週ラベル・実件数・出所・Planを正規化して渡し、保存・取得・cache・Goal draftを持つ。Kaitoはreadonlyの表示型、出所別文言と描画の責任を持つ案。

today-recordedではcoreを渡さず、完了estimateのscenarioはCURRENT_STATEだけ。F15はcompletionのkindをconditionalにし、Planと不足理由を渡す。completedでは候補が達成と実進捗だけを描画するので、親が同じ達成欄や指標を重複表示しない。この表示slotの引受範囲・配置はFE確認待ち。正式組み込み、API／Engine接続はPR120でも未実施。

質問入力では、nullに「回答しない／未回答」、UNKNOWNに「経験がない・思い出せない」を別の選択肢として表示する案。各問をnullへ戻せる操作は`onChange`でdraftだけを更新し、保存前の予測は変えない。両方の解除を保存する際はrawの`{a:null,b:null}`をFEが送る。

fieldErrorsは部品内だけの仮props `{a?:string,b?:string}`で候補を検証する案。FEがAPIのpathから変換し、通信・認証・form全体のエラーはcontrollerで扱う。このpropsを共通422 envelopeとして採択せず、本接続時はBEの正式形式と合わせる。

Kaitoの新規部品の配置案は`apps/web/src/features/question-prior/*`。まだ実在するファイルではない。既存Goal／Today controller・routeへのimportと配置はFEが行う。`packages/contract`の新packageやrunnerをここで作らず、共通型の実際の置き場は#70で確認する。

共通ファイルを変更する前に対象・担当・順番をFEと記録する。通常はKaitoの新規部品＋FEの既存画面組み込みに分ける。同じファイルの変更が必要なら双方の意図と固定例を保って通常three-way解消し、双方が差分を再確認する。別担当の変更を上書き・forcepushしない。

**C案のMVPではサーバstate revisionを必須にしない取得管理案**。FEはuser／session generation／goalを取得keyに含め、keyごとの取得世代とrequest順を持つ。mutation開始時に世代を進め、保存前のGETを取消または結果不採用にする。保存確定後は新世代でGoal／todayを再取得し、現在のkey・世代・最新requestに一致する応答だけを表示へ採用する。取消が間に合わず旧応答が後着しても表示を戻さない。保存不明／再取得失敗は別状態に保ち、Goal切替・logout時は無効化とcache解除を行う。

日付はserver todayを使い、focus復帰時に再取得する。サーバの同一DB snapshotは別途必要で、FEの取得世代で代替しない。別タブでまだ観測していない書き込みの全順序を検知する方式ではない。保存後の後着GET・連続訂正・Goal切替の受入条件をこの管理で満たせない場合は、state revisionを追加する必要性をFE／BEが再検討する。実際のquery実装と受入は未確認で、取得管理案の採択をFEに求める。

表示優先は、入力／通信エラー・最新取得待ちを扱う → 実績達成 → 今日記録済み → 起点別の材料判定。保存済み再取得失敗や保存不明時に古い予測を現在の値として見せない。Today記録済みは中心を出さず、完了のCURRENT_STATEは既存契約に従う。

## 9. 共通固定例と確認の範囲

- [common-fixtures.json](../../experiments/question-prior-contract/common-fixtures.json)：計算18例、不正入力4例、保存／UI状態10例。ID F01〜F18、N01〜N04、I01〜I10を担当共通の確認対象にする候補。
- [fixture-summary.md](../../experiments/question-prior-contract/fixture-summary.md)：起点別Beta・中心値・不足・実績・回数の比較。
- [build-fixtures.py](../../experiments/question-prior-contract/build-fixtures.py)：標準ライブラリFractionを使う独立した厳密Beta-Geometric参照。隣接ログ・件数・実量・状態を照合した。
- [validation.json](../../experiments/question-prior-contract/validation.json)：Pythonの独立した数式確認PASS。完了DPの再現結果は下記へ分け、DB／API／UIの成功や校正・理解・精度の確認にはしない。
- [completion-goldens.json](../../experiments/question-prior-contract/completion-goldens.json)、[再現スクリプト](../../experiments/question-prior-contract/verify-completion.mjs)、[再現結果](../../experiments/question-prior-contract/completion-replay-results.json)：公開済みの数学部品から同じ事後drawを生成し、9件のDPと独立な条件付きCDFを照合。[再現手順](../../experiments/question-prior-contract/README.md#完了dpの追加evidence)と[oracleテスト](../../experiments/question-prior-contract/completion-oracle.test.mjs)を参照。

重点例はF01対F03（同じBeta、回答有無による表示差）、F04／F05（部分回答）、F09→F10（訂正・実遷移不変）、F11（UNKNOWNをまたがない）、F14（今日実量7）、F16（達成優先）、F17（仮実行0日と実績未達の分離）、F18（H超）。I01〜I03は同一再送／古い異なる訂正／有効訂正、I05〜I09は古い応答・logout・保存状態・日付snapshot。

完了DPの固定値は次の9件で確認済み。Node 22.15.1／Windows x64、seed=20261012、K=200、H=1095の範囲。F17の0／0とF18のnull／nullは非自明9件へ含めない。

| ID | 必要な将来DONE回数 | P50／P80（未来日数） |
| --- | --- | --- |
| F03 | 2 | 3／6 |
| F06 | 2 | 4／5 |
| F07 | 2 | 3／11 |
| F08 | 2 | 2／4 |
| F09 | 2 | 2／4 |
| F10 | 2 | 2／3 |
| F11 | 3 | 6／7 |
| F13 | 2 | 4／5 |
| F14 | 1 | 2／2 |

独立なのは、同じa／b drawに条件付けた完了分布の計算法。状態DPとrenewal＋Binomial-tail CDFをHの全日で比較し、最大CDF差は`5.551115123125783e-16`、刈り込みあり／なしのPMF差は0、最小のP50／P80到達日が一致した。閾値前後のCDF・draw hashを保存。0／1確率・DONE／SKIPPED開始を全経路の整数重み列挙でも照合した。参照CDF許容誤差1e-11と、従来の分位点epsilon1e-12は別で、後者は変更しない。

RNG／Beta samplerは既存Engineと共有しており、別sampler・厳密な事後積分・校正・予測精度の独立検証ではない。Engine担当の元候補56テスト＋実験3テスト・型検査は担当ログ、新adapterの61テスト＋実験3テストはPR119の公開CIログで確認し、重複件数を合算しない。本PR側では、公開数学sourceをTypeScript 5.8.3で生成し、9件を再現する独立CDF実験3テストを実行した。候補の56／61件をここで再実行したとは数えない。API／DB／UI接続、採用環境や選択priorの性能・混合負荷、質問理解は未検証であり、具体契約は未採択。

数学参照は時刻・DB操作を検証しない。不正例N03は担当実験でPredictionInputErrorを確認。N04は上記の旧入口と新adapterを区別し、snapshot metadata・公開呼出し型・具体error reason/path／HTTPは採択後に合わせる。API不正例は認証済み所有者という前提を明示した仕様例で、実際のHTTP呼出しではない。

## 10. Issue／PRと着手条件

#107は提案・判断追跡・正本文書反映、#117は追加UI、#71〜#73／#76〜#77／#78〜#81は既存の実装先。本案のために新しい実装Issueを重複作成せず、#107へ紐づける。

本提案はmainを基点にSupporting文書・固定例・対応表の入口だけを追加する。R-11のMust／分担採択記録はPR115からmainへ統合済みで、本PRへ重複取り込みしない。Scope記録の反映とD-26具体契約の人間判断を区別する。正式Product／Architecture Decisionと実装は、このSupporting PRで更新しない。

| Issue | 保持する境界 |
| --- | --- |
| #74／#76 → 回答snapshot／#77 | 固定recordStartDateの保持・migration・Goal GET共有と既存Goal互換性を先に採択し、その値を回答snapshotとログ境界へ接続。#74のHard #70・#76のHard #75は維持 |
| #71 | Hard #70。既存の純粋計算の限定先行範囲と、新contractの正式採択を区別 |
| #72／#73 | Hard #71／#71・#72。Integration #70。候補のテストだけで正式受入としない |
| #76／#77 | Hard #75／#76、#77はIntegration #72。Goal DTO・初回保存・訂正・snapshotと接続をBE確認 |
| #78／#81 | Hard #70、Integration #75・#76／#72・#77。mock先行の許可を一般化しない |
| #117 | Hard #70。D-26・props・状態所有者・共有ファイルのDoR未確定。Integration #78／#81／#76／#77／#72 |

依頼者から**FEのモック先行は許可済み**との指示を受けている。これは依頼者による先行許可の記録で、C案・HTTP DTOのチーム採択や他Issueの依存変更ではない。本PRでは別IssueのHard／Statusを変更せず、本API接続後の保存・競合・取得管理・表示の確認を残す。

具体契約・FE／BE／Engine本人のレビュー後、承認範囲だけを正式文書と実装Issueへ反映する。Ready／BLOCKED／Hard・実装期限を自動変更しない。判断目標日2026-10-05（JST）は依頼者側の目標であり、他担当の返答確約ではない。

## 公開根拠

- [Scope記録反映後のmain Architecture](https://github.com/jogi-hack-2026-team/jogi-hack-2026/blob/dc668fbae199660a22a93ec0af66a3bed0daba40/docs/architecture.md)、[Product Spec](https://github.com/jogi-hack-2026-team/jogi-hack-2026/blob/dc668fbae199660a22a93ec0af66a3bed0daba40/docs/product-spec.md)。
- [PR115のP-15](https://github.com/jogi-hack-2026-team/jogi-hack-2026/blob/1c029c52646bfb8b95d6f5fecabdf599fc5efc81/docs/product-spec.md#p-15-質問由来の見通しのmust追加方針)、[D-26と依頼者側の判断目標日](https://github.com/jogi-hack-2026-team/jogi-hack-2026/blob/1c029c52646bfb8b95d6f5fecabdf599fc5efc81/docs/architecture.md#d-26)。PR115のScope記録と本契約案は別の変更。
- [FEのMust・分担同意](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/115#pullrequestreview-5410233503)、[BEのMust・API引受](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/115#pullrequestreview-5409983506)。具体数値・API全体の同意ではない。
- [FE #88のAPI／LWW提案](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/88#issuecomment-5986523851)。LWW・追加field・error DTO・mock方針は未採択として比較。
- [BEレビュー5417166527](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/118#pullrequestreview-5417166527)。方向への賛成と、開始日・revision・transaction・公開項目・入口・エラーの確認要求であり、D-26の採択やApproveではない。
- [既存の質問prior提案](question-prior-proposal.md)。強さ4／8等の比較・実績と回答の分離を保持。本案も校正・予測精度の採択ではない。
