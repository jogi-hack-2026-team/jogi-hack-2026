# Future ROIの契約の判断事項

Supporting Doc / Not a Source of Truth。未採択の選択肢と確認案。正式仕様は[Product Spec](product-spec.md)と[Architecture](architecture.md)、技術採択は[#84](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/84)で確認する。本書を保存・レビューしてもAPI・Product・予測Decisionを採択変更しない。以下のテストは提案で、未実行。

## 先に確認すること

- API：成功時に返すデータ項目（DTO）とHTTP status、PATCH（一部更新）の省略・null・空body、一覧の今日状態を決める必要がある。
- 記録：昨日は未記録の補完だけか、既存記録も変更できるかが文書間で一致していない。下の選択肢と再送・同時補完・日跨ぎの確認案で比べる。
- 予測・表示：観測日数の数え方、入力／設定エラー、記録済みの文言、完了目安の片側だけ未到達（null）になる表示を確認する。

いずれも未採択。基本構成の合意とは分け、チーム判断後に正本と既存Issueへ合意分だけ反映する。DONE量のサーバー補完、SKIPPED入力amount禁止／保存NULL、D-19〜D-22は維持する。

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
| `POST /api/goals` | 成功DTO・status、`initialProgress`省略、サーバーの既定値とブラウザのtimezone既定値の境界 | 201＋Goal DTO案。初期量は省略時0とするか必須か判断。timezoneは明示送信案（ブラウザ既定値はUIの責務） | 省略・null・0、無効IANA名、DTOに所有者・認証情報が混ざらない |
| `GET /api/goals/:goalId` | DTOの項目・時刻列・進捗を含むか | 200＋作成と共通のGoal DTO案。DB列をそのまま公開しない | 存在しない／他人404、型とserialization一致 |
| `PATCH /api/goals/:goalId` | 変更可能項目、省略・null・空object・bodyなし、同値変更と競合、成功DTO・status | 省略は維持、null拒否、空object／bodyなし拒否、200＋Goal DTO案。同値のtimezone／初期量を更新禁止の「変更」に含めるかを判断 | 記録あり／なし、同値再送、同時記録とtimezone変更、未知項目、全違反の返却 |
| `DELETE /api/goals/:goalId` | 成功body・status、削除済み再送 | 204＋bodyなし案、200＋結果DTOも候補。削除済み再送の404／成功は判断待ち | 記録の連鎖削除、他人404、再送、応答bodyとstatus整合 |
| `PUT /api/goals/:goalId/logs/:localDate` | 成功DTO・status、既存日と新規日の区別、昨日の変更可否 | 200＋Log DTOで統一する案、作成201／更新200も候補。昨日は下節で判断 | DONE省略補完、SKIPPEDにamount=null／0／正数は拒否、再送・競合・日付境界 |
| `GET /api/goals/:goalId/logs?from&to` | DTO、範囲の省略・包含・順序・逆転・上限、UNKNOWNの表現 | 200＋記録済みLog配列案。UNKNOWNの合成行は返さずUIで補う案。期間の既定と上限は別途判断 | 範囲端、片側省略、逆転・無効日付、空履歴、日付の昇順／降順 |
| `GET /api/goals/:goalId/today` | 成功status、todayLogの完全DTO、未記録の表現、エラー境界 | 200＋既存の5項目を維持、todayLogは未記録時null、Log.amountはSKIPPED時nullとする案。Goal・logs・時計のsnapshot案は既存差分表で採択待ち | `yesterdayMissing`、Engineと応答一致、日跨ぎ、所有者確認、失敗時に古い予測を成功として返さない |

Goal / Logの応答項目は上の案から正式に一覧化する必要がある。成功DTOのSKIPPED amountをnullにする案はEngine入力と合わせやすいが、応答で省略する案との比較も必要。応答にNULLがあるからSKIPPED入力にamount=nullを許容してよい、とはしない。

業務APIの共通error envelopeは[既存差分表](architecture.md#検証コードとの差分変更案未合意)にある未採択案。401 / 404 / 422、認証の429、ライブラリ固有の登録・ログイン失敗、Origin拒否、JSON構文不正・body欠落・Content-Type不正・DB障害を、どの層がどのstatus／bodyへ変換するかは判断待ち。認証libraryのbodyをそのまま返す案とadapterで共通化する案を比較し、FEがライブラリ内部形式に依存する範囲と、認証情報を漏らさない保証を契約試験で確認する。PoCのerror形式や失敗statusだけで規則を補完しない。

## 昨日補完と再送・競合

[R-03・R-04・P-14](product-spec.md#requirementsmvp)は今日の変更と昨日未記録の補完を示す一方、Architectureの「作成・上書き」と[#77](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/77)の「同じ日は上書き」は今日・昨日両方の変更へ広く読める。昨日の既存記録の更新可否と、同値再送の意味をチームで揃える必要がある。

| 選択肢 | 動作案 | 利点・影響 |
| --- | --- | --- |
| A：昨日は未記録補完だけ | 昨日が空のとき作成。保存値と同値の再送は成功扱い、異なる値は拒否する案（拒否statusは未定） | Productの補完目的に近い。原子的な作成と、既存行との比較が必要。DONE省略は補完後の値で比較するか、sessionAmount変更後の再送をどう扱うかも決める |
| B：昨日も変更可 | 今日・昨日とも同日上書き。同時更新をlast-write-winsとするかversion等で競合検出するか決める | API表・#77の広い読み方に近い。R-04・P-14を改訂する判断と、前日の訂正UX・実績／予測への影響確認が必要 |

追加する確認案：①今日の同値／異値再送で1行のみ、②昨日の補完後の同値／異値再送、③2端末の同値／異値の同時補完、④再送間のsessionAmount変更、⑤Goal timezoneの23:59→00:00で昨日／一昨日へ変わる要求、⑥画面を開いた後の日跨ぎによる再取得と拒否の表示。Aなら異値の後着要求が保存値を変更しないこと、Bなら合意した競合規則に一致することを検証する。日付境界の時刻をいつ読むかとsnapshot取得順は#84の未採択事項と合わせて判断する。ここで再送のHTTP statusや更新時刻の扱いは確定しない。

## Engineと表示の不足

| 判断事項 | 現行で明記済みの範囲 | 提案・確認案（未採択） |
| --- | --- | --- |
| `observedDays` / `recordedDays` | 出力項目はあるが集計式はない。観測列は最古記録から今日記録済みなら今日、未記録なら昨日まで | observedDaysはUNKNOWN込みの観測列長、recordedDaysはその範囲の実記録数、空logsは両方0とする案。空履歴・飛び日・今日のみ・今日未記録をfixtureで照合。達成済みでの算出も判断 |
| 入力・設定エラー | 未来／重複日付は入力エラー、非整数priorは設定エラー。エラーは達成判定より先 | 不正暦日、並び順、非有限数、量とstatus不整合、正の整数prior／samples／horizon、seedの範囲、modelVersionとconfigの組の許容を決める。Engineのエラー型とHTTP変換を分ける。DEFAULT_CONFIGは変えない |
| `CURRENT_STATE`の文言 | 今日記録済みなら中心比較を出さず、現在の状態から完了の目安を返す | Product表示表の「今日やった場合」をCURRENT_STATEへ流用せず「現在の記録からの完了の目安」とする案。今日DONE／SKIPPED、未達成／達成／不足を照合 |
| P50／P80の片側nullと週表示 | 月曜始まりの週、H日以内に届かない分位点はnull | P50は週・P80は「3年以上先」を個別に表す案。「p50=null、p80有限」は順序に反するため正常値にしない。0日、日曜／月曜、うるう日、年跨ぎ、両null、異なるtimezoneで確認。週の日付は暦日で計算する案 |

これらはD-19〜D-22の変更提案ではなく、明記不足を補う判断材料。週表示・CURRENT_STATE文言の採択はProduct、Engineエラー・観測数・API mappingはArchitectureへ反映する。既存T-01〜T-15の期待値や不足条件を弱めない。

## 採択後の反映先

API・記録規則の不足は既存[#76](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/76)・[#77](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/77)、認証の境界は[#75](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/75)、保存・migrationは[#74](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/74)、Engineは[#71](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/71)〜[#73](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/73)、表示は[#81](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/81)から確認する。新規実装Issueを重複作成せず、正式文書反映の追跡先はチームで決める（仕様整理[#69](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/69)はclosedのため、再open／後続Taskを自動決定しない）。

採択時は項目ごとに「現行維持／変更／保留」、理由、担当、反映先と未実行の確認条件を記録する。既存IssueのScope・依存・Ready/BLOCKED・完了状態は本資料で変更しない。[行動比較案](prediction/action-scenarios-proposal.md)は独立した未採択機能で、契約不足の補完と同時にMustへ追加しない。
