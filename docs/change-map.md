# 仕様・実装・確認方法の対応表

機能が「誰のために、どの条件で、どう動くか」は各仕様文書で説明します。この表は、その説明と実装・確認方法を探す入口です。ページの棚卸しもここにまとめ、別の一覧へ同じ対応情報を複製しません。
調査対象の呼び出し元・参照元も検索してください。表に載っているファイルだけで影響範囲が完結するとは限りません。

## 調査範囲と根拠

- 初回棚卸し: 2026-09-21 JST、[Issue #26](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/26)。基準は取得した `origin/main` の `779ee30d2bed8e9ac7fde179cd3c4def77a4cb95`、整備ブランチは `docs/26-documentation`。
- 対象: Git管理された文書、Skills（AI向け作業手順）、Issue Forms、PRテンプレート、設定、`scripts/`、`.githooks/`。無視対象のローカル認証情報・Secret・検証用ツールは仕様の根拠にしません。
- [プロダクト決定 #20](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/20)、[MVP要件 #21](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/21)、[技術選定 #22](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/22)を確認。採択済みのアプリ仕様・技術構成は確認できず、リポジトリにアプリ本体もありません。ProjectのReady表示を採択・完了の証拠にはしません。
- 大会の日程と変更制限は[README](../README.md#現在の状態)の共有済み前提です。[大会・提出要件 #19](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/19)の結論と大会公式資料の確認は未完了です。開発基盤の参照HTMLを大会規約とみなさず、締切時刻等を補いません。
- 外部設定・接続の過去の確認結果は[基盤の状態記録](operations/development-foundation-status.md)を参照します。この棚卸しで外部サービスや全メンバーの環境を再検証したとは扱いません。

以降の機能追加・仕様変更では、影響する行も同じ作業で更新します。上記は初回調査の範囲であり、全行の最新動作を保証する日付ではありません。変更後の根拠・実行結果は対象Issue／PRへ残します。

## アプリの仕様と実装

| 項目 | 現在の状態・説明先 | 実装・関連処理 | 確認方法・今後の更新先 |
| --- | --- | --- | --- |
| 対象ユーザー、課題、主要機能 | 未定。[現在の状態](../README.md#現在の状態)、#20・#21が判断の入口 | アプリ実装なし | 採択記録を確認後、[文書の配置ルール](../CONTRIBUTING.md#仕様文書の配置)に沿って `docs/product/` に仕様を記載 |
| 全ページ・URL・画面操作 | 未実装のため対象なし。承認済み画面仕様も未確認 | ルート定義・画面・コンポーネントなし | 追加時にURLパターン単位で対応行を追加。機能の仕様、実装ファイル、画面遷移の確認先へリンク |
| API・サーバー処理・DB | 未実装のため対象なし。APIは処理やデータをやり取りする窓口、DBはデータベース | API定義・スキーマ・移行処理・開発／テストDBなし | 採用・実装後に機能仕様から処理・保存先・入力制約を追えるよう更新 |
| 認証・認可、外部連携、非同期処理 | 採用未定・未実装。認証は本人確認、認可は操作の許可 | 所有権確認、外部API・AI処理、リアルタイム通信、バックグラウンド処理なし | 実装後に利用条件、状態、失敗・再試行・同期、他ユーザーのデータに対する制約を記載 |
| アプリ起動・build・lint・typecheck・test | 未実装。アプリテストは未整備 | パッケージ定義・テストコード・実行設定なし | アプリの手動確認手順も現時点では対象なし。コマンドは採用スタックと実装確定後に追加 |

## 開発基盤と作業手順

状態欄の「実装あり」はファイルの存在と処理を読み取ったことを示します。実行結果は[確認記録](#確認記録と残課題)およびリンク先で別に扱います。

| 項目 | 状態・仕様や手順の説明先 | 調査を始める実装・設定・関連処理 | 確認方法 |
| --- | --- | --- | --- |
| 文書の入口・配置 | [README](../README.md#最初に読む順番)、[配置ルール](../CONTRIBUTING.md#仕様文書の配置) | [AGENTS.md](../AGENTS.md)、この対応表 | 読む順番から対象の仕様と処理をたどる。文書リンクは全体チェックで確認 |
| 文書・設定チェック | 実装あり。[実行手順と処理の流れ](DEVELOPMENT_GUIDE.md#文書チェックで起きること) | [mise.toml](../mise.toml) の `tasks.check` → [check-foundation.ps1](../scripts/check-foundation.ps1) | ルートで `pwsh -NoProfile -File scripts/check-foundation.ps1`。対象範囲と失敗時の対応は手順参照 |
| ステージ済み差分・Git Hook | 実装あり。[初回セットアップ](DEVELOPMENT_GUIDE.md#13-初回セットアップ)、[Commit手順](DEVELOPMENT_GUIDE.md#19-commitする手順) | [mise.toml](../mise.toml) の `check:staged`・`hooks:install`、[install-hooks.ps1](../scripts/install-hooks.ps1)、[pre-commit](../.githooks/pre-commit) | `git diff --cached --check`。導入処理はローカル設定を変えるため、文書確認だけで再実行しない。既存Hook拒否等の過去の結果は[基盤の検証記録](operations/development-foundation-status.md#検証記録) |
| CI（変更時の自動検証） | workflow実装あり。[検証手順](DEVELOPMENT_GUIDE.md#文書チェックで起きること) | [foundation.yml](../.github/workflows/foundation.yml) → `scripts/check-foundation.ps1` | 対象PRのChecksで `Foundation / Repository checks` を確認。ローカル成功とCI成功を分ける。アプリのテストではない |
| Issue・Branch・PR・レビュー | 運用ルールあり。[CONTRIBUTING](../CONTRIBUTING.md)、[初心者向け操作](DEVELOPMENT_GUIDE.md) | [Task](../.github/ISSUE_TEMPLATE/task.yml)、[Feature](../.github/ISSUE_TEMPLATE/feature.yml)、[Bug](../.github/ISSUE_TEMPLATE/bug.yml)、[Investigation](../.github/ISSUE_TEMPLATE/investigation.yml)、[PRテンプレート](../.github/pull_request_template.md) | Issueの目的・完了条件・担当・Scope・開発情報、PRの変更と検証、承認を確認。Formsの存在とGitHub上の投稿確認を分ける |
| Projects・保護設定 | 文書と外部設定を区別。[状態表](operations/development-foundation-status.md#資料との相違点) | [Statusのルール](../CONTRIBUTING.md#github-projects)。ボード・保護設定自体はGit管理外 | 権限のある担当者が対象のGitHub画面で確認。文書整備を理由にカード削除・設定変更しない |
| 文書保守・AIへの依頼 | [依頼方法](DEVELOPMENT_GUIDE.md#仕様を調べて変更するには)、[詳細な執筆・保守手順](../.agents/skills/documentation-sync/SKILL.md) | [issue-to-pr](../.agents/skills/issue-to-pr/SKILL.md)、[bug-investigation](../.agents/skills/bug-investigation/SKILL.md)、[review-gate](../.agents/skills/review-gate/SKILL.md)、[CLAUDE.md](../CLAUDE.md) → [AGENTS.md](../AGENTS.md) | 変更前・変更時・完了前の導線とPRの文書影響欄を確認。文書更新不要の場合も理由を記録 |
| AIツール・Serena | [採択方針・導入状況](../AI_DEVELOPMENT_TOOLS.md)。アプリ用の言語サーバーは未設定 | [.serena/project.yml](../.serena/project.yml) の `language_servers: []`、[Skill一覧](../AI_DEVELOPMENT_TOOLS.md#リポジトリに配置されたskills) | ファイルの設定と実際の接続・シンボル探索を区別。利用時の確認はツールガイドに従う |
| Secret・環境変数・Doppler | 採用方針と接続完了は別。[引き継ぎ](operations/development-foundation-status.md#dopplerの引き継ぎ) | [mise.toml](../mise.toml)、[.env.example](../.env.example)、[.gitignore](../.gitignore) | 文書チェックは空の環境変数例・除外設定のみ検証。接続先や注入は前提待ち。アプリAPI・DBなし、Secret不要のチェックへ実値を渡さない |
| 文字コード・改行・除外 | 設定あり | [.editorconfig](../.editorconfig)、[.gitattributes](../.gitattributes)、[.gitignore](../.gitignore)、[check-foundation.ps1](../scripts/check-foundation.ps1) | 全体チェックと `git diff --check`。エディタで設定が適用されたことはファイル存在だけでは保証しない |
| 設計判断・参考資料 | [ADR-0001](decisions/0001-development-foundation.md)（ADRは判断の理由と経緯の記録）、[提供HTML](references/jogi_hack_2026_dev_foundation_guide.html) | 判断と導入結果の対応は[基盤の状態](operations/development-foundation-status.md) | HTML内の例を採用済みと解釈しない。古い判断を変更する場合は新しいADRから参照 |
| リリース・提出・デモ | 手順あり。アプリ・公開先・デモ操作は未定 | [release-demo.md](operations/release-demo.md)、[大会要件 #19](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/19) | 決定済みの提出条件・対象commit・検証結果を照合。公開・DB操作はこの文書整備では実施しない |

## 確認記録と残課題

### 代表的な変更依頼からの導線

以下は文書・コードを読み合わせる確認です。例示した機能追加・ファイル移動・設定変更そのものは実行しません。

| 依頼の例 | たどる経路 | 確認すること |
| --- | --- | --- |
| 文書チェックの説明を直す | README → 開発ガイドの初回セットアップ → この表の文書チェック行 → `mise.toml` → `check-foundation.ps1` | 説明が実処理・成功／失敗表示と一致するか。説明変更ならガイドを更新し、入口・対応表は参照が変わる場合に更新。実行設定の変更が必要なら今回の対象外 |
| 文書を移動する | この表 → 正本の文書 → リポジトリ内の旧パス・見出し参照を検索 → documentation-sync | README・対応表・Skills等の参照元を更新し、全体チェックとリンクの読み合わせを行う。対応表だけでは漏れがないと判断しない |
| 初めて機能を追加する | #20・#21の承認内容 → 配置ルール → documentation-syncの仕様記載項目 → 対象実装・テスト → この表 | 機能単位の仕様を `docs/product/` に作り、操作・条件・状態・内部処理を説明。関連コード・テストと対応行を追加し、未実装部分を分ける。現時点では実装・テストへのリンクは作れない |

### 未確認・対象外の扱い

- 大会公式資料、採択済みアプリ仕様、全メンバーの環境・外部サービスの接続は未確認。担当者が各判断Issueまたは基盤の状態記録へ根拠を追記します。
- 既存PRカードとIssueのみの自動追加、Board列・WIP等の相違は[既存の相違点記録](operations/development-foundation-status.md#資料との相違点)を維持します。新たな運用決定や外部設定変更はしません。
- 文書チェックは内容の正しさ、すべてのコード参照、外部URLの到達性、サービスの安全性・法的妥当性を保証しません。対象実装・決定記録との照合、必要な外部確認を別に扱います。
- この整備の実行コマンド・結果、未実施事項、レビュー・マージ状態は[Issue #26](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/26)の開発情報と関連PRに残します。過去の基盤検証結果を今回の実行結果として転記しません。
