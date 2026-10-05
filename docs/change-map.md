# 仕様・実装・確認方法の対応表

現行ProductはFuture ROI。要件は[Product Spec](product-spec.md)、実現方式は[Architecture](architecture.md)が正本。**Prediction純粋計算の限定先行実装はmain統合済みだが、アプリ機能は未結合。** 下表の予定パスと[基本構成の採用・次作業・残条件](architecture.md#2026-10-03の技術構成合意)は[Repository構成](architecture.md#repository構成)から確認する。実在するPredictionと未実装のアプリを分けて記載する。旧音楽案の対応表は[履歴](../archive/music-exploration/docs/change-map.md)へ保管した。

## アプリの仕様と実装

| 対象 | 仕様 | 実装・予定の場所 | 確認方法 |
| --- | --- | --- | --- |
| 認証（R-01） | [R-01](product-spec.md#requirementsmvp)、[D-24](architecture.md#d-24) | `apps/api/src/auth/`、`apps/web/src/routes/` | APIテスト（未ログイン401・他人404）、主要FlowのE2E |
| Goal（R-02） | [R-02](product-spec.md#requirementsmvp)、[Data Model](architecture.md#data-model)、[初期量と開始日の境界](architecture.md#初期進捗と日々の記録の境界) | `apps/api/src/goals/`、`apps/api/migrations/`（予定）。#76・#78、開始日の保存・共有と既存Goal互換性は未決 | APIテスト・[開始日等の受入条件](architecture.md#記録補完訂正の受入確認)（未実装・未検証） |
| 記録・前日補完・訂正（R-03・R-04） | [R-03・R-04](product-spec.md#requirementsmvp)、[P-14の理由・分担と未決事項](product-spec.md#p-14-記録のルール)、[上書きと再計算](architecture.md#記録の上書きと予測の再計算) | `apps/api/src/logs/`、`apps/web/src/routes/`（予定）。#77・#79・#80、昨日の訂正導線は調整待ち | [受入条件・固定例](architecture.md#記録補完訂正の受入確認)（API・UIは未実装・未検証）。[初期量との境界方針は承認済み、開始日保存等はOPEN](architecture.md#初期進捗と日々の記録の境界) |
| Today Decision（R-05〜R-08） | [表示仕様](product-spec.md#today-decision画面の表示仕様) | `apps/api/src/prediction/`、`apps/web/src/routes/` | APIテスト（`/today`）、E2E |
| Prediction Engine（限定先行、正式結合待ち） | [Prediction Engine](architecture.md#prediction-engine)、[承認範囲・利用条件](../packages/prediction/README.md) | [predict](../packages/prediction/src/predict.ts) → 観測・BigInt中心・RNG・DP | [T-01〜T-15の実テストと計測](../packages/prediction/README.md#ローカル検証)。[検証CI](../.github/workflows/prediction.yml)で型検査と実Engine T-14。既存47＋prior候補9＋adapter候補5＋handoff例3＝64テストと、独立CDF oracle3件を実行する。PR #119の[同HEAD CI証跡](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/119)でNode22／24・Dockerの成功を確認済み。[11境界例と30日合成2入力](../packages/prediction/examples/README.md)も同じCIで実行する。runnerはNode標準。採用基盤への整合は#70後 |
| デモデータ（R-09） | [R-09](product-spec.md#requirementsmvp) | 未定（Demo Seedスクリプト） | デモ手順の通し確認 |
| Goal別priorの内部候補（レビュー用、D-26契約待ち） | [候補の境界・残判断](../packages/prediction/GOAL_PRIOR_CANDIDATE.md)、PR #115・#71〜#73 | [goal-prior-candidate.ts](../packages/prediction/src/goal-prior-candidate.ts) → 既存の純粋計算。公開入口・UI／APIは変更しない | [9候補回帰テスト](../packages/prediction/tests/goal-prior-candidate.test.mjs)、[型負例](../packages/prediction/tests/type-contracts.ts)、[候補性能計測](../packages/prediction/scripts/benchmark-goal-prior-candidate.mjs)。写像・強度・表示gateは未採択 |
| PR118質問priorの候補adapter（未採択） | [受け渡し・エラー・残る採択](../packages/prediction/QUESTION_PRIOR_ADAPTER_CANDIDATE.md)、[独立CDF再現](../experiments/question-prior-engine-candidate/README.md)、PR #118・#71〜#73・#107 | [question-prior-adapter-candidate.ts](../packages/prediction/src/question-prior-adapter-candidate.ts)：raw回答＋保存mapping → prior・出所・材料gate・実残量のconditionalPlan。公開predict／DB／HTTP／UIへ接続しない | [5 adapterテスト](../packages/prediction/tests/question-prior-adapter-candidate.test.mjs)で18例・13接続差。[snapshot／worker接続例3件](../packages/prediction/tests/question-prior-handoff.test.mjs)も含め既存56＋5＋3＝64、独立[oracle 3件](../experiments/question-prior-engine-candidate/oracle.test.mjs)・9 DP golden。具体契約の採択とAPI／UI結合は残る |
| 公開（R-10） | [Deployment](architecture.md#deployment) | 未定 | 公開URLで主要Flow |
| 質問由来の見通し（R-11、Must採択済み） | [機能・未決事項](product-spec.md#質問から始める見通しr-11)、[質問たたき台](product-spec.md#初期質問のレビュー用たたき台)、[Scope・分担の採択P-15](product-spec.md#p-15-質問由来の見通しのmust追加方針)、[D-26](architecture.md#d-26) | 2026-10-05、PR #115でMust追加・分担を採択。追加UIは#117、Engine・BE・既存FEは既存Issueで追跡。未実装、具体値・型・保存・表示契約・判断日はOPEN | [受入・担当・判断時点の案](product-spec.md#r-11の受入条件担当判断時点の案)、[既存Issueごとの確認](#r-11の既存issueへの対応)。公開提案の計算一致を製品受入としない |
| 予測モデルの根拠 | [判断記録](prediction/decision-log.md)、[Evidence](prediction/evidence.md) | [検証スクリプト](../experiments/prediction-model-validation/README.md)（本番コードではない） | スクリプトの再実行 |
| 旧音楽案の機能・実験 | 履歴のみ | [保管場所](../archive/music-exploration/README.md) | — |

### R-11の既存Issueへの対応

[P-15](product-spec.md#p-15-質問由来の見通しのmust追加方針)で機能ScopeのMust追加と分担を採択済み。実現方式はD-26でOPEN。追加UIは[#117](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/117)（Kaito、ネイティブ親#88）、Engineは#90配下の#71〜#73、BEは#89配下の#76・#77、FEの既存画面・組み込みは#88配下の#78・#81へ追跡する。#107は提案公開・文書追跡Taskであり、追加UIの親ではない。具体契約・個別期限・Hard依存・Ready/BLOCKED・元の完了チェックは採択から自動変更しない。

| 実装Issue | 追加機能による影響 | 具体契約の採択後に確認する内容 |
| --- | --- | --- |
| [#117 初期質問UI・出所別表示](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/117) | Kaitoが追加入力・出所別表示の部品を担う | #78・#81へのprops／状態所有者、入力・訂正／表示契約、共通ファイルの編集調整と衝突解消、状態優先・共通固定例 |
| [#78 Goal UI](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/78) | 既存Goal画面とKaitoの追加質問UIの組み込み | FEの既存画面担当を維持し、回答・エラー・訂正の受け渡しを確認。質問と初期量を分け、入口・画面構成は#88で別途判断 |
| [#81 Today Decision](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/81) | 既存Today画面とKaitoの出所別表示の組み込み | FEと状態別表示・実績件数・不足状態・部分回答・記録済み／達成済みの優先を確認。既存の簡易ユーザー確認を移管しない |
| [#76 Goal API](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/76) | 回答・初期分布の保存／取得／編集、既存Goal互換性 | 所有者条件・入力検証、mapping版・revision・変更時の方針、ActionLogへ変換しないこと |
| [#77 ActionLog／Today API](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/77) | 回答snapshot＋現在の実ログのEngine入力、出所・不足状態の返却 | Engineとの一致、今日／昨日の上書き後の再計算、二重加算防止、古い応答との整合 |
| [#71 中心計算](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/71) | `a`／`b`別の初期分布と実績起点の更新、中心の不足判定 | 回答は遷移数にしない、UNKNOWN隣接除外、現行共通priorとの互換性、中心の固定例 |
| [#72 完了計算](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/72) | 初期分布を使う完了DP、中心との統合、完了の不足判定 | 現行のDP・打切り・null・今日の仮実行と実量の分離、部分回答の採択条件 |
| [#73 共有テスト](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/73) | 新しい初期分布・更新・不足状態・互換性の回帰 | 採択値の固定例と独立計算の照合、同一snapshot＋ログの再現、既存T-01〜T-15の変更点と根拠 |

#117は既存Goal CRUD・Today画面本体・日々の記録・昨日補完・#81のユーザー確認を複製しない。FEが#78〜#81を続けたうえで追加部品を組み込む。[FEのMust賛成・分担同意](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/115#pullrequestreview-5410233503)と[BE本人の引受](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/115#pullrequestreview-5409983506)を根拠にする。質問回答に伴うschema変更が必要なら#74との境界をBEへ確認し、別のschema実装を並行起票しない。

具体契約と固定例をD-26で決め、KaitoのEngine #71→#72・共有テスト#73と追加UI #117、BE #76→#77、FE #78・#81の組み込みを接続する。#117のHard #70、Integration #78・#81／#76・#77／#72とReady条件はIssue本文を確認し、既存Issueの依存・BLOCKEDを解除しない。mockによる先行は採択済み契約と承認済み範囲に限る。Scope・分担以外の具体値・契約・工数・判断日・個別期限は未採択である。

## 開発基盤と作業手順

| 対象 | 状態・説明先 | 実装・確認方法 |
| --- | --- | --- |
| Issue・Branch・PR・レビュー | [CONTRIBUTING](../CONTRIBUTING.md)、[Future ROIのIssue運用](DEVELOPMENT_GUIDE.md#future-roiのissue運用) | GitHubで階層、最新Issue・PR、着手条件と完了証拠を確認。AIの入口は[AGENTS](../AGENTS.md#16-issue)・[Claude向け指示](../CLAUDE.md) |
| 文書・設定チェック | [開発ガイド](DEVELOPMENT_GUIDE.md#文書チェックで起きること) | [mise設定](../mise.toml) → [check-foundation.ps1](../scripts/check-foundation.ps1)。`pwsh -NoProfile -File scripts/check-foundation.ps1` |
| アプリの起動構成（workspace・Compose・Application CI） | [D-23](architecture.md#d-23)の基本構成はFE側の依頼者報告とBE本人の了承記録に基づく採用記録。版・追加ツール・復元と動作確認はI-01の着手条件に従う | 復元前は[旧構成](../archive/music-exploration/package.json)・[旧Compose](../archive/music-exploration/compose.yaml)が履歴として残る |
| 公開先と外部設定 | [D-25](architecture.md#d-25)、[基盤状態](operations/development-foundation-status.md) | アカウント・課金の作成は承認後 |
| 再利用資産 | [再利用資産](operations/reuse-handoff.md) | 実装Issueで採否を記録 |
| 技術選定の最小検証・選定理由（[Issue #84](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/84)） | Supporting Artifact。第一候補を採択前に実測した記録で、採択・Productの実装ではない。[検証報告](../experiments/architecture-verification/REPORT.md)、[比較記録と技術ごとの理由・弱点・残条件](../experiments/architecture-verification/SELECTION-v3.1.md#9-技術を選ぶ理由と残る判断2026-10-02)。正式な状態と要約は[Technology Stack](architecture.md#technology-stack)、実装時の対策は[検証状況](architecture.md#第一候補の検証状況84--85) | [検証コードと再実行手順](../experiments/architecture-verification/README.md)。専用のpackageで `npm run verify:*`。#85ではT-14未実施。その後の[予測試作の単体計測](prediction/evidence.md#dpとmonte-carloの比較)と、上表の純粋Engine検証を区別する。候補の追加検証は[2026-10-02追加報告](../experiments/architecture-verification/FOLLOWUP-2026-10-02.md)・[候補の再実行手順](../experiments/architecture-verification/candidate-1.7.7/README.md)・[Linux試験記録](../experiments/architecture-verification/LINUX-2026-10-02.md)。保存済みLinux記録ではbuild/認証成功、修正前SIGTERM失敗・承認済み最小hook後v6/v7正常終了。採用環境のT-14・候補コンテナ内の実Engine混合負荷・実クラウド・費用は未実測 |

## 未採択の追加提案

ここはレビュー用のSupporting Docsへの入口であり、上の仕様・実装予定やMustの追加ではない。機能の採否は技術選定Issue #84から分け、[文書分離のIssue #94](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/94)・[提案PR #95](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/95)で提案と根拠を確認する。機能の採用・Scope・時期・実装Issueは未決定。採用しない・保留する場合の資料と入口の扱いも、採否と合わせて判断する。

| 提案 | 説明先 | 状態・確認範囲 |
| --- | --- | --- |
| 数日間の「やる／休む」を仮置きして比べる | [目的・例・現行Mustとの差・画面・計算・分担・受入条件案](prediction/action-scenarios-proposal.md) | 未採択。定型3例の既存DPへの還元、g50との前提差、表示の再検討案とレビュー報告を記録。実装・ユーザー検証・性能測定なし。Product/API/Prediction仕様・既存Issue依存・Ready/BLOCKEDは変更しない |
| 同じ行動の経験質問からのa/b初期分布・条件付き計画 | [PROPOSAL詳細](prediction/question-prior-proposal.md)、[判断理由](prediction/decision-log.md#proposalgoal作成時の質問由来priorと条件付き計画)、[Evidence](prediction/evidence.md#質問由来priorの局所検証2026-10-04) | 未採択。純粋[試作・再現手順](../experiments/question-prior-proposal/README.md)と局所テストのみ。R-02/R-06/P-12/D-20/API/T-11/T-15の採択後差分を記載。正式Product/Architecture・本番FE/BE/Engine・既存Issue依存は変更しない |

## 確認記録と残課題

業務API・昨日補完・Engine集計／エラー・表示の判断事項は[契約の判断事項](contract-review-proposal.md)へまとめる。Supporting Docであり、上表の上書きやPoCの動作から成功DTOを決めない。#101の記録境界・昨日補完／訂正方針、#103のmetadata・公開エラー契約と純粋Engineはmain統合済み。未決の具体保存・DTO・再送／競合方式や表示案とは分ける。正式仕様の記載済み範囲は[ArchitectureのAPI契約](architecture.md#api契約)から確認する。

表の実装予定は2026-09-30の仕様に基づく。Product機能、DB接続、外部Service、公開配置は未実装・未確認。

#71〜#73の限定先行承認に沿った純粋Engineとテストを追加した。型・入口は[src](../packages/prediction/src/index.ts)、固定例は[fixtures.ts](../packages/prediction/tests/fixtures.ts)、補完・訂正の実行例は[再計算例](../packages/prediction/README.md#補完訂正後の再計算例)。[検証手順・残条件](../packages/prediction/README.md#70後に合わせる点と残条件)を確認する。predictは必須metadataを持つPredictionResultを返し、依頼者承認済みの日数集計と公開例外の[契約](../packages/prediction/README.md#metadata公開エラーの契約)を反映した。API結合や正式受入は未完了。純粋Engineの型検査・数値テストCIを追加した。合意反映案PR #97の統合、#70の基盤・採用runtime・runner・統一CIへの整合は残る。
