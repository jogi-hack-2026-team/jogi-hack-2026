# Future ROIの契約の判断事項

Supporting Doc / Not a Source of Truth。契約の不足、未採択の選択肢、関連PRの承認記録と確認案。正式仕様は[Product Spec](product-spec.md)と[Architecture](architecture.md)、技術採択は[#84](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/84)で確認する。本書を保存・レビューしてもAPI・Product・予測Decisionを採択変更しない。以下のテストは提案で、未実行。

2026-10-04時点のmain（`e449b6c`）との差分を整理する。[#101](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/101)の記録境界・昨日訂正方針と、[#103](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/103)の日数metadata・公開エラー契約には依頼者承認の記録があるが、いずれもmain未統合。本書では再び未採択へ戻さず、正本への反映待ちと残る判断を区別する。これらのPR統合時には下記の差分も同期する。

## 現行規則と候補の境界

- R-01のメール・パスワード登録／ログイン／ログアウト、本人だけの操作と、業務APIの401・他人404・入力422は現行規則。Better Auth・Cookie・認証経路・DBセッションはD-24の候補。
- 単位は`minutes` / `sessions`、量はinteger、タイトル上限は100。PoCの`count` / numeric / 120は未採択差分。[既存差分表](architecture.md#検証コードとの差分変更案未合意)を参照し、本書で重ねて採択しない。
- DONE入力はamount省略可、APIが`sessionAmount`で補う。SKIPPED入力はamount禁止、DBはNULL。入力で省略することと、DBやEngine・応答のNULLを同じ規則として扱わない。
- EngineのD-19〜D-22、状態判定順、今日の実績の二重加算禁止、微小確率の打ち切り禁止、T-14の500ms未満を維持する。
- [技術説明PR #93](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/93)、[検証報告](../experiments/architecture-verification/REPORT.md)、[旧音楽案](../archive/music-exploration/README.md)を、それぞれ未mergeの説明・PoC・履歴として区別する。ここでは技術候補の比較理由を再記載しない。

## APIの未定義部分

Architectureの記載済み規則は実装の基準だが、完全なHTTP契約を定めた記載ではない。採択後に成功DTO・status・入力細則を正本と共有契約へ反映し、FE・BEが同じfixtureで確認できるようにする案。

| 対象 | 不足している判断 | 最小の案・代替案（未採択） | 確認案 |
| --- | --- | --- | --- |
| `GET /api/goals` | 配列かwrapperか、並び順、今日状態の項目名・値・日付基準 | 200＋Goal配列、各Goalにtimezoneから導出した日付とDONE / SKIPPED / UNRECORDEDを含める案。wrapperも選択肢。記録行なしをSKIPPEDにしない | 空一覧、Goalごとに異なるtimezone、日跨ぎ、今日未記録 |
| `POST /api/goals` | 成功DTO・status、初期量の入力形式、サーバーの既定値とブラウザのtimezone既定値の境界 | 201＋Goal DTO案。#101は初期量の既定0・固定記録開始日の前日までの量を承認済み方針として持つ。省略・nullの入力細則、開始日の保存・DTO共有は未決。timezoneは明示送信案（ブラウザ既定値はUIの責務） | 省略・null・0、開始日前の重複加算、無効IANA名、DTOに所有者・認証情報が混ざらない |
| `GET /api/goals/:goalId` | DTOの項目・時刻列・進捗を含むか | 200＋作成と共通のGoal DTO案。DB列をそのまま公開しない | 存在しない／他人404、型とserialization一致 |
| `PATCH /api/goals/:goalId` | 変更可能項目、省略・null・空object・bodyなし、同値変更と競合、成功DTO・status | 省略は維持、null拒否、空object／bodyなし拒否、200＋Goal DTO案。同値のtimezone／初期量を更新禁止の「変更」に含めるかを判断 | 記録あり／なし、同値再送、同時記録とtimezone変更、未知項目、全違反の返却 |
| `DELETE /api/goals/:goalId` | 成功body・status、削除済み再送 | 204＋bodyなし案、200＋結果DTOも候補。削除済み再送の404／成功は判断待ち | 記録の連鎖削除、他人404、再送、応答bodyとstatus整合 |
| `PUT /api/goals/:goalId/logs/:localDate` | 成功DTO・status、既存日と新規日の区別、記録境界方針の正本反映 | 200＋Log DTOで統一する案、作成201／更新200も候補。昨日の訂正は#101の承認済み方針、main反映待ち。再送・競合の方式は下節 | DONE省略補完、SKIPPEDにamount=null／0／正数は拒否、再送・競合・日付境界 |
| `GET /api/goals/:goalId/logs?from&to` | DTO、範囲の省略・包含・順序・逆転・上限、UNKNOWNの表現 | 200＋記録済みLog配列案。UNKNOWNの合成行は返さずUIで補う案。期間の既定と上限は別途判断 | 範囲端、片側省略、逆転・無効日付、空履歴、日付の昇順／降順 |
| `GET /api/goals/:goalId/today` | 成功status、todayLogの完全DTO、未記録の表現、エラー境界 | 200＋既存の5項目を維持、todayLogは未記録時null、Log.amountはSKIPPED時nullとする案。Goal・logs・時計のsnapshot案は既存差分表で採択待ち | `yesterdayMissing`、Engineと応答一致、日跨ぎ、所有者確認、失敗時に古い予測を成功として返さない |

Goal / Logの応答項目は上の案から正式に一覧化する必要がある。成功DTOのSKIPPED amountをnullにする案はEngine入力と合わせやすいが、応答で省略する案との比較も必要。応答にNULLがあるからSKIPPED入力にamount=nullを許容してよい、とはしない。

業務APIの共通error envelopeは[既存差分表](architecture.md#検証コードとの差分変更案未合意)にある未採択案。401 / 404 / 422、認証の429、ライブラリ固有の登録・ログイン失敗、Origin拒否、JSON構文不正・body欠落・Content-Type不正・DB障害を、どの層がどのstatus／bodyへ変換するかは判断待ち。認証libraryのbodyをそのまま返す案とadapterで共通化する案を比較し、FEがライブラリ内部形式に依存する範囲と、認証情報を漏らさない保証を契約試験で確認する。PoCのerror形式や失敗statusだけで規則を補完しない。

## 昨日補完と再送・競合

[R-03・R-04・P-14](product-spec.md#requirementsmvp)のmain記述には昨日未記録の補完と上書きの範囲の曖昧さが残る。#101では依頼者承認に基づき、固定記録開始日以降かつGoal timezoneの今日・昨日だけを対象とし、昨日も補完・訂正可能、正規の保存済み履歴から実績・遷移・予測を全量再計算する方針を記載している。main未統合であり、開始日の保存・API共有・既存Goal互換性・訂正UIは未実装／未決。以下のA/Bは監査時の比較履歴で、Bの方向性を改めて採択待ちにはしない。

| 選択肢 | 動作案 | 利点・影響 |
| --- | --- | --- |
| A：昨日は未記録補完だけ | 昨日が空のとき作成。保存値と同値の再送は成功扱い、異なる値は拒否する案（拒否statusは未定） | Productの補完目的に近い。原子的な作成と、既存行との比較が必要。DONE省略は補完後の値で比較するか、sessionAmount変更後の再送をどう扱うかも決める |
| B：昨日も変更可（#101の承認済み方針、main反映待ち） | 記録開始日以降の今日・昨日とも同日上書き。正規履歴から再計算する。同時更新をlast-write-winsとするかversion等で競合検出するかは未決 | #101のProduct・Architecture変更を反映し、保存方式・DTO・互換性・前日の訂正UIを実装時に確認する |

追加する確認案：①今日の同値／異値再送で1行のみ、②昨日の補完後の同値／異値再送、③2端末の同値／異値の同時補完、④再送間のsessionAmount変更、⑤Goal timezoneの23:59→00:00で昨日／一昨日へ変わる要求、⑥画面を開いた後の日跨ぎによる再取得と拒否の表示。Aなら異値の後着要求が保存値を変更しないこと、Bなら合意した競合規則に一致することを検証する。日付境界の時刻をいつ読むかとsnapshot取得順は#84の未採択事項と合わせて判断する。ここで再送のHTTP statusや更新時刻の扱いは確定しない。

## Engineと表示の不足

| 判断事項 | 現行で明記済みの範囲 | 提案・確認案（未採択） |
| --- | --- | --- |
| `observedDays` / `recordedDays` | mainは出力項目と観測窓のみ。#103は依頼者承認済みの集計契約・純粋Engine実装を持ち、main反映待ち | #103の契約はobservedDays＝最古ログから今日記録済みなら今日／未記録なら昨日までのUNKNOWN込み暦日数、recordedDays＝窓内の一意な明示DONE／SKIPPED数、空logsは両方0。初期量や固定記録開始日から推測せず、有効遷移起点の不足判定を維持。統合時に正本と同期する |
| 入力・設定エラー | mainの個別入力規則に加え、#103は依頼者承認済みの`PredictionInputError`／`PredictionConfigError`・`reason`・変更できない`path`を持ち、main反映待ち | Engine例外分類を再採択待ちにせず、#103の契約・テストへ参照を寄せる。HTTP status・応答JSON・DB例外変換・画面表示と、外部JSONの構造検証は呼び出し側の未決事項。DEFAULT_CONFIGは変えない |
| `CURRENT_STATE`の文言 | 今日記録済みなら中心比較を出さず、現在の状態から完了の目安を返す | Product表示表の「今日やった場合」をCURRENT_STATEへ流用せず「現在の記録からの完了の目安」とする案。今日DONE／SKIPPED、未達成／達成／不足を照合 |
| P50／P80の片側nullと週表示 | 月曜始まりの週、H日以内に届かない分位点はnull | P50は週・P80は「3年以上先」を個別に表す案。「p50=null、p80有限」は順序に反するため正常値にしない。0日、日曜／月曜、うるう日、年跨ぎ、両null、異なるtimezoneで確認。週の日付は暦日で計算する案 |

これらはD-19〜D-22の変更提案ではなく、明記不足と反映待ちを区別する判断材料。週表示・CURRENT_STATE文言の採択はProduct、#103の承認済みEngine契約の統合と未決のAPI mappingはArchitectureへ反映する。既存T-01〜T-15の期待値や不足条件を弱めない。

## 採択後の反映先

API・記録規則の不足は既存[#76](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/76)・[#77](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/77)、認証の境界は[#75](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/75)、保存・migrationは[#74](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/74)、Engineは[#71](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/71)〜[#73](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/73)、表示は[#81](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/81)から確認する。新規実装Issueを重複作成せず、正式文書反映の追跡先はチームで決める（仕様整理[#69](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/69)はclosedのため、再open／後続Taskを自動決定しない）。

採択時は項目ごとに「現行維持／変更／保留」、理由、担当、反映先と未実行の確認条件を記録する。既存IssueのScope・依存・Ready/BLOCKED・完了状態は本資料で変更しない。[行動比較案](prediction/action-scenarios-proposal.md)は独立した未採択機能で、契約不足の補完と同時にMustへ追加しない。
