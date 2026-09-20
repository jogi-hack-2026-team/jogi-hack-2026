# 開発基盤の状態と引き継ぎ

確認日: 2026-09-20 JST。対象: `jogi-hack-2026-team/jogi-hack-2026`。
開始時の作業ツリーはclean、ローカルmainは`4005208`。fetchした`origin/main`の`c41e334`を基準に整備した。
作業Issue: [#24](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/24)、担当者: Kaito-Iwase。
作業ブランチ: `chore/24-development-foundation`、[PR #25](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/25)。ユーザーの依頼に基づきpush・PR作成し、naoki820-askamiyaへレビュー依頼済み。初回CI成功。Scope分類はチーム確認待ち。最新の進捗・CIはIssueとPRを参照する。Mergeは未実施。

本作業はIssue未作成のままローカル変更を先行した手順不備がある。ユーザーの追加依頼を受け、CONTRIBUTING・AGENTS・開発ガイド・issue-to-pr Skillに変更着手前のチケット必須条件を明記した。
その後、明示的な作成依頼に基づきIssue #24を作成し、既存変更を保持して番号付きBranchへ変更した。Issue作成が編集に先行したと遡って扱わない。

## 根拠と状態の読み方

参照資料は[原本の無改変コピー](../references/jogi_hack_2026_dev_foundation_guide.html)。提供された実ファイル名は`jogi_hack_2026_dev_foundation_guide.html`で、依頼文中の`(1)`付きファイルは確認できなかった。
元ファイルはDownloadsにそのまま保持した。コピーのSHA-256は`C82AD92D05C22ABF2E0621F347DBF3720E85C9F75C93177CA7E4A017BE10A40D`。
HTMLは参照資料であり、例示コードは実行指示ではない。ADOPTEDは採用方針、CONDITIONALは条件付き、REJECTEDは見送り、UNDECIDEDは未確定。

- **確認済み**: 記載した範囲の設定または実行を今回確認。設定値の確認と動作確認は結果欄で分ける。
- **一部設定済み**: 設定はあるが適用・接続・他メンバーでの確認が残る。
- **未導入**: 調査した範囲で存在しないと確認したもの。
- **未確認**: 認証・権限・情報不足などで判断できないもの。
- **前提待ち**: 技術スタックや利用条件の決定後に実装するもの。

以下の設定はPRの作業ブランチにpush済み。mainへの反映、Issue Formsの標準導線への適用はレビュー・Merge後となる。
料金・無料枠は運用開始時に管理者が公式情報で確認する。資料の日付や人数だけで無料利用可能と判断しない。

## 設定項目ごとの照合

| 項目 | HTMLの章・採否 | 導入状況 | 確認根拠・現在の設定 | 目標の設定・不足分 | 対応内容・動作確認結果 | 導入条件 |
| --- | --- | --- | --- | --- | --- | --- |
| Git / 接続先 / ブランチ | §4–5.8 ADOPTED | 確認済み | origin URL、fetch、最新mainのSHA確認 | main上で作業しない | origin/mainから作業ブランチ作成、Issue #24の番号を反映 | 通常のPRレビュー後にMerge |
| GitHub CLI / 認証 | 既存AI_DEVELOPMENT_TOOLSのADOPTED | 未導入（当PCのPATH範囲） | Get-Commandでghなし。ブラウザは認証済みで設定画面の読み取り可能 | ghを基本手段とし、利用不可ならWeb UI | 今回は既存方針どおりWeb UIを使用。gh認証・全メンバーの権限は未確認 | CLI導入や本人ログインは各自確認 |
| Issues / 個別タスク | §5.1–5.8 ADOPTED | 一部設定済み | 作成前open 5件（#19–23）に重複なし | 重複せず本作業のIssueを追跡 | 明示依頼後に#24を作成、Kaito-Iwaseを担当に設定 | Scope決定はチーム確認待ち |
| Issue Forms | §5.1–5.8 ADOPTED | 一部設定済み | 既存4種類はMarkdownテンプレート | 必須入力可能なForms。分類・ラベル・本文の責務を維持 | 4ファイルをYAMLへ移行し旧形式との重複を解消。GitHub表示・投稿は未検証 | push・レビュー・Merge後にフォーム表示確認 |
| PR Template | §5.1–5.8 ADOPTED | 一部設定済み | 既存概要・関連Issue・検証欄あり | Issue本文のBranch / PR、完了条件、Secret・文書影響を確認 | 既存テンプレートへチェック欄を追記 | 次のPRで記入・関連付け確認 |
| Issue→Branch→PR | §4、12 ADOPTED | 確認済み（本作業） | #24と番号付きBranch、PR #25 | Closesと本文の開発情報を併用 | PR本文Closes #24、Issue本文のBranch / PR記録で追跡 | 人間レビュー後にMerge |
| Projects / Status | §4–5.8 ADOPTED | 一部設定済み | [Project #1](https://github.com/orgs/jogi-hack-2026-team/projects/1)、5列、Private、8 workflows On | HTMLは6列、既存はIn reviewを使う | 列・カードは変更せず相違を保留 | チーム判断と外部変更承認 |
| WIP | §4 ADOPTED | 一部設定済み | Board表示: Backlog 5、In progress 3、In review 5 | HTML: In Progress 3、Review 2、1人1Issue | In progressは同等。Review上限差は保留 | チーム判断と変更承認 |
| Project fields | §5.1–5.8 ADOPTED | 一部設定済み | Status / Size / Estimate / Start date / Target date / Scope。Issue側にType、Priority、Effort | HTMLのPriority / Type / Sizeの目的を既存欄で満たす | 同名フィールドを重複追加しない。Issue #22のPriority・Assignee・Scopeは未設定/未表示 | 着手前に担当者がReady条件を確認 |
| Project Auto-add | §5.1–5.8 ADOPTED | 確認済み（動作） | [workflow](https://github.com/orgs/jogi-hack-2026-team/projects/1/workflows/117741448)はOn、`is:issue is:open` | 新規Issueだけを自動追加 | #24作成時にgithub-project-automationがBacklogへ追加したことを確認。既存PRカード維持 | 文書との相違は下記参照 |
| Milestones | §5.1–5.8、16 ADOPTED | 未導入（当該Repo） | Web UIでopen 0 / closed 0 | MVP / Feature Complete / Release Candidate / Code Freeze | 作成案・完了確認を下記に記録 | 新規作成承認。Freeze以外の期日は未定 |
| Actions / 実行権限 | §5.1–5.8 ADOPTED | 確認済み（設定・実行） | Actions許可。トークン既定read、外部初回参加者は承認必須 | 現時点に合う文書検証を追加 | 権限設定維持、contents: readのPR検証成功 | 維持 |
| 文書・設定CI | §5.12–5.14 ADOPTED | 確認済み（PR実行） | 変更前はリポジトリworkflowなし | 実装済みチェックのみ実行、Secret不要 | `foundation.yml`を実装、PR #25のRepository checks初回成功（9秒） | main適用はMerge後。必須化は別途承認 |
| main保護 | §5.1–5.8、13 ADOPTED | 確認済み（設定値） | [main-protection](https://github.com/jogi-hack-2026-team/jogi-hack-2026/settings/rules/23690999) Active、Default(main)、PR必須・削除制限・force push禁止 | 既存保護を維持 | classic保護なしでもRulesetあり。解除・bypassは未実施 | 維持 |
| レビュー条件 | §13 ADOPTED | 一部設定済み | Required approvals=1、会話解決必須はOff。PR限定bypass actorあり | 別メンバー1件＋未解決会話なし | 1件維持。会話解決必須の有効化は承認待ち。bypassは運用で使用禁止 | 設定変更承認 |
| 必須CI | §13 ADOPTED | 未導入（Ruleset） | Require status checks to pass=Off | 実際に成功したチェックを必須化 | `Repository checks`の初回実行後に正確なcontextを選ぶ手順を準備 | 初回CI成功・承認。未実装test/buildは追加しない |
| Merge方式 | §4、13 ADOPTED | 確認済み（設定値） | SquashのみOn、merge/rebase/auto-merge Off、head自動削除On、linked Issue auto-close On | SquashとIssue追跡 | 同等のため維持 | 人間レビュー後に通常Merge |
| Secret / Push Protection | §10、13 ADOPTEDの安全運用 | 確認済み（設定値） | GitHub Advanced Security画面でSecret Protection / Push protection有効 | 実値をcommitしない | 維持。Secretを使った試験pushはしていない | 維持 |
| Discord Webhook | HTML記載なし・既存設定 | 確認済み（最終配信） | Webhooksに1件、対象イベントとLast delivery was successful表示 | 既存通知維持 | URL・Secretを記録せず、再配信や変更なし | 今回対象外 |
| mise CLI | §5.10 ADOPTED | 一部設定済み | 開始時PATHに存在せず | 全員が共通タスクを実行可能 | 公式2026.9.11 Windows x64をSHA-256照合して`.tools`内に展開、version/tasks実行確認 | 他メンバーは各自導入。OS/グローバル変更は本人確認 |
| mise バージョン / タスク | §5.10 ADOPTED | 確認済み（ローカル） | 変更前mise.tomlなし | 採用済みCLI固定、共通check | Doppler 3.76.5固定、check / check:staged / hooks:install。Runtimeは未固定 | アプリタスクは実装後 |
| Docker Compose | §5.9 ADOPTED | 前提待ち | Compose v5.2.0実行可、Docker engine未接続、設定ファイル権限警告。compose.yamlなし | 決定したDB/依存サービスだけversion固定 | DBを仮採用せず維持。エンジン起動変更なし | DB・サービス決定、各PC Docker稼働 |
| Doppler CLI | §5.11 ADOPTED | 一部設定済み | 開始時PATHに存在せず | 固定CLIをmiseで取得 | 隔離したmise installが成功、`doppler --version` v3.76.5確認 | PATHのグローバル変更なし |
| Doppler account / Project / Environment / Config | §5.11 ADOPTED | 未確認 | Dashboardはログイン画面。CLI認証情報を未読 | 既存の対象Projectを確認してdevとCIのConfigを選ぶ | 新規作成・招待・認証変更なし | 管理者ログイン、対象と権限の確認 |
| Doppler local / キー対応 | §5.11、10 ADOPTED | 前提待ち | 起動するアプリ・必須キーなし | Doppler runで注入、.env.exampleとEnv validationを対応 | .env.exampleは説明のみ。架空DB/APIキーを追加せず | 接続先とアプリの確定 |
| Doppler CI | §5.11 ADOPTED | 前提待ち | GitHub UIでRepository Secretsなし、利用可能なOrganization Secretsなし、表示されたEnvironmentもSecretなし。DOPPLER_TOKEN未表示 | 必要なジョブだけ専用Configを注入 | Service Token方式の手順を準備。文書CIにSecret参照なし | Secretが必要な実ジョブ・対象Config・承認 |
| .gitignore / EditorConfig | §5.15–5.20 ADOPTED | 確認済み（ローカル） | .env除外あり、EditorConfigなし | 設定差・誤commitを抑える | EditorConfig、Doppler/cache除外、HookのLF属性。ignore試験実施 | 各エディタのEditorConfig対応は各自確認 |
| Formatter / Linter / Typecheck | §5.12–5.14 ADOPTED | 前提待ち | アプリ・package・採用ツールなし | スタックに適した実チェック | PowerShell文書検証のみ追加。Husky等は例示で採用確定ではない | スタック決定。TS時のみTypecheck |
| Git Hooks | §5.12–5.14 ADOPTED | 確認済み（当PC） | 既存hooksPathなし、sampleのみ | commit前の軽量検査、CIとの整合 | .githooks/pre-commit追加、repo-local設定、実行確認。既存Hookがあれば導入スクリプトは停止 | 全メンバーのCloneで導入 |
| Unit / Integration / E2E | §5.12–5.14 ADOPTED | 前提待ち | テスト対象アプリなし | Unit=業務ルール、Integration=境界、E2E=主要デモFlow | 空の成功ジョブなし。主要Flow E2EはMVP後 | 実装・DB・UI。既存Playwright方針維持 |
| Google Docs | §5.15–5.20、8 ADOPTED | 未確認（共有先） | 連携でJOGI検索0件。資料不存在の断定はしない | 議論中文章・議事録の共同編集先 | 役割をCONTRIBUTINGへ反映。架空URLなし | 既存共有先・3人の権限を管理者確認 |
| Figma / FigJam | §5.15–5.20 ADOPTED | 未確認（共有先） | Figma連携の認証成功。対象file URLは未特定 | UI / 操作Flowの共有先 | 役割をCONTRIBUTINGへ反映。既存アカウントやPlanをチーム共有済みとは扱わない | 対象fileと権限確認 |
| ADR / Mermaid / docs | §5.15–5.20、8 ADOPTED | 確認済み（文書） | ADR方針あり、ディレクトリ未作成 | 正本の重複を避け重要判断だけ記録 | ADR-0001と正本案内を追加、既存リンク切れ3件修正。不要な空仕様・図は作らない | 新たな重要判断時に追加 |
| Tag / Release / Demo | §16–17 ADOPTED | 前提待ち | GitHubにTag 0、Releaseなし | 検証済みSHAを提出前に固定 | release-demo.mdに段階・操作・完了確認を準備 | MVP・公開先決定、Tag/Release承認 |
| OpenAPI / Bruno | §6 CONDITIONAL | 前提待ち | 独立HTTP API未確定 | 独立HTTP API採用時に契約・Collection共有 | 未導入のまま | API方式決定・初回API実装 |
| Sentry / Testcontainers / Redis | §6 CONDITIONAL | 前提待ち | MVP・DBテスト分離・cache等の要件なし | Sentry=MVP後の運用価値、Testcontainers=DB隔離価値、Redis=固有要件 | 未導入のまま | 個別条件とチーム採択 |
| Infisical等の見送り | §7 REJECTED | 確認済み（方針） | Dopplerと併用しない | 見送りを維持 | Jira / Confluence / Notion / Infisical / dotenvx / CODEOWNERS / Dev Container未追加 | 再検討は問題と理由を明示 |
| Framework / DB / ORM / Auth / Hosting / AI | §19 UNDECIDED | 前提待ち | #22本文は未調査・未定。採択記録なし | プロダクト→MVP→技術選定 | 仮のRuntime/DB/compose/packageを追加しない | #19→#20→#21→#22→#23の判断 |
| MCP / Skills | HTML記載なし・既存方針 | 一部設定済み | Context7問い合わせ成功。7 Skills実在、Serena設定あり | 既存AI_DEVELOPMENT_TOOLSを維持 | 設定変更なし。Serena実接続と意味検索は今回未実施、アプリ言語未定 | 利用時に各環境で確認 |

## 資料との相違点

| 対象 | HTML | 既存の根拠 | 今回の扱い |
| --- | --- | --- | --- |
| Board列 | Review / Verifyを分離 | CONTRIBUTINGと実ボードはIn Review / Done、Verify列なし | 5列維持。検証結果はPRに残す。列追加・改名は判断待ち |
| Review WIP | 最大2 | 実ボードIn review上限5 | 変更保留。採否を確認してから変更 |
| Issue分類 | Feature / Bug / Spike | 既存4種類とCONTRIBUTING | 区分維持でForms化。Spikeへの置換やTask削除は保留 |
| フィールド | Priority / Type / Size等 | 既存ScopeとSize、IssueのType/Priority/Effort | 既存欄維持。同等の責務を持つ欄を重複追加しない |
| ADR保存先 | 例はdocs/adr | AGENTS・Skillはdocs/decisions | 正本どおりdocs/decisions。ディレクトリ例を機械的に再現しない |
| PRカード | 詳細な追加条件なし | CONTRIBUTINGは既存PRカード連動を規定、実Auto-addはIssue-only | 両方維持。PRカード削除やAuto-add変更はしない。新規PRカード作成を要求しない |
| Ready状態 | 前提Issue完了・Blockerなし | #19–23すべてReady、#22は未定・Assigneeなし | 完了済みとは扱わず、担当者が着手可否を再確認。勝手に状態変更しない |
| Runtime / DB例 | NodeやDBサービスのプレースホルダー | 未確定 | 実行設定に転記しない |

## Dopplerの引き継ぎ

Secretの正本はDoppler。GitHub Actions SecretsはCIがDopplerへ接続するための資格情報を保持する受け渡し先であり、アプリSecretの別正本として手動で二重管理しない。

1. 管理者がDashboardへログインし、既存Workspace・Project・Environment・Configと3人のアクセスを確認する。名称を推測しない。存在しない場合は対象名・環境分離・権限・料金を提示して承認後に作成する。
2. 各メンバーは`mise install`で固定CLIを導入し、`mise exec -- doppler login`、リポジトリ内で`mise exec -- doppler setup`を実行する。対話画面で管理者が確認したProjectと開発用Configを選択する。既存の別Project設定を上書きしない。
3. アプリの必要なキーが決まったら`.env.example`へ空の`KEY=`と用途・必須/任意・server/client区分を記載し、起動時Validationを実装する。実値の登録は承認された管理者がDopplerで行う。DOPPLER_TOKENはアプリ必須キーとして追加しない。
4. 開発コマンドが実装された時点で、`doppler run --`の後にその実在コマンドを指定するmiseタスクを追加する。現在はdevタスク未作成。接続確認はアプリの正常起動と必要キーの有無だけを出すValidationで行い、一覧表示・値表示・env全量出力はしない。初回オンライン確認では`--no-fallback`を付け、古いキャッシュによる成功と区別する。
5. Secretが必要なCIジョブができたら、専用の非Production Configに読み取り範囲を限定したService Tokenを管理者が発行し、GitHub Actions Secretの`DOPPLER_TOKEN`へ登録する。発行・登録は承認が必要。CLI取得は固定版mise設定を再利用する。
6. CIでは必要なstepだけに`DOPPLER_TOKEN`を渡し、`doppler run --no-fallback --`で実装済み検証コマンドを起動する。fork PR・未信頼コードにTokenを渡すために`pull_request_target`等へ切り替えない。文書CIには一切渡さない。
7. 注入確認は実値をログに残さず、非Production環境の対象ジョブの成功と対象Configを記録する。Token無効時は失敗することも確認する。障害時は処理を停止し、実値の配布や無断のfallback運用を行わない。

`doppler.yaml`は接続先未確定のため未作成。個人認証設定を読み出して調査しない。
手順の根拠: [Doppler CLI](https://github.com/DopplerHQ/cli)、[GitHub Actions連携](https://docs.doppler.com/docs/github-actions)。接続は今回未検証。

## 外部操作の引き継ぎと承認待ち

外部リソース作成・共有・権限・保護設定変更は依頼の承認境界に従う。次の表は変更案であり、実施済みではない。

| 対象サービス / 操作する人 | 現在値→操作・入力項目 | 理由・影響 | 手順・完了確認 |
| --- | --- | --- | --- |
| GitHub / チーム | #24作成・担当者設定済み。Scope未選択→Must / Should / Could決定 | 優先度の最終判断はAIが代行しない | チーム決定後に#24のProject Scopeへ設定し、表示確認 |
| GitHub / Repo管理者 | Milestone 0→MVP / Feature Complete / Release Candidate / Code Freezeの4件。Freeze日2026-10-12、他の期日は未定 | 期日管理。Issueの自動一括割当はしない | 作成承認→既存重複再確認→Milestonesで作成→名前・期日確認 |
| GitHub / Repo管理者 | 会話解決必須Off→On | 既存の未解決コメントなしというMergeルールを機械的に補強 | 承認→既存main-protectionを編集→保存後readback。PRで未解決会話のMerge阻止を確認 |
| GitHub / Repo管理者 | 必須CI Off→Repository checksを必須化 | CI失敗Mergeを防ぐ。設定後はチェック未実行PRも待機する | push承認→PRで初回成功→実際のcontext選択→変更承認→保存・readback。未実装test/buildは選ばない |
| GitHub Project / チーム | In review上限5→2案。Verify列は未決定 | HTMLとの相違。作業量・ボード構造に影響 | チーム判断→変更内容承認→対象列のみ変更→表示確認。既存カード・列は削除しない |
| Doppler / Workspace管理者 | Workspace・Project・Config・3人のアクセス未確認 | 新規作成を先に行うと重複・過剰権限の恐れ | ログイン→既存名確認→対象・環境・権限を記録→不足のみ承認後設定→各人setupとアプリ注入確認 |
| 各PC / 各メンバー | mise / Doppler / Hookの導入状態はPCごとに異なる | 当PCの成功だけではチーム導入完了でない | 開発ガイドのセットアップ→mise check→Hook導入→固定Doppler版確認。ログインは本人が実施 |
| Google Docs / 文書管理者 | 共有先未確認→既存URL・3人の権限を確認 | 正本案内。新規作成・招待・共有変更は別途承認 | 既存文書を特定→対象URLを案内→他2人が意図した閲覧/編集操作を確認 |
| Figma / デザイン管理者 | 認証可、対象file未確認→既存URL・権限確認 | アカウント認証とチーム共有を区別 | 既存file/Project特定→URL案内→他2人がUI/Flowを参照できることを確認。新規共有は承認後 |

### 本作業の追跡

目的・スコープ・完了条件・Branch / PRの正本は[Issue #24](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/24)。レビュー待ちまでの依頼はMilestone・保護設定・共有権限・Secret操作の承認を兼ねない。

## 検証記録

### 今回の変更ファイル

| ファイル | 変更理由 |
| --- | --- |
| `.github/ISSUE_TEMPLATE/bug.yml`、`feature.yml`、`task.yml`、`investigation.yml` | 同名の既存`.md`4件をFormsへ移行。分類・ラベル・項目を維持し必須入力を追加 |
| `.github/pull_request_template.md` | 実行済み検証と未確認事項、Issue開発情報の記録を確認 |
| `.github/workflows/foundation.yml` | Secret不要の文書・設定CI。checkoutを公式v6の確認済みSHAに固定 |
| `mise.toml` | 固定Doppler版と実在する3共通タスク |
| `scripts/check-foundation.ps1` | 文書リンク・文字コード・conflict・環境変数例・ignore・差分空白を実検証 |
| `scripts/install-hooks.ps1`、`.githooks/pre-commit` | 既存Hookを守りながらrepo-localのステージ差分検査を導入 |
| `.editorconfig`、`.gitattributes`、`.gitignore`、`.env.example` | 編集規約、HookのLF、ローカルCLI/Secret除外、確認済みキーだけを扱う土台 |
| `README.md`、`docs/DEVELOPMENT_GUIDE.md` | 入口と実行可能なセットアップ手順を更新 |
| `CONTRIBUTING.md`、`AGENTS.md` | 情報の正本、Doppler境界、検証・承認条件、参照先を整理。リンク切れ修正 |
| `docs/decisions/0001-development-foundation.md` | 採用方針と前提待ちをADRとして記録 |
| `docs/operations/development-foundation-status.md` | 個別設定の差分・根拠・承認待ち・手動操作・検証結果の正本 |
| `docs/operations/release-demo.md` | MVPからFreeze・デモ・障害時までの必要最小限の運用 |
| `docs/references/jogi_hack_2026_dev_foundation_guide.html` | 提供原本を無改変で共有可能に保存 |

Git管理外の変更は当Repoの`core.hooksPath=.githooks`と無視対象`.tools/`内の検証用配置のみ。
追加修正で`.agents/skills/issue-to-pr/SKILL.md`の着手条件を更新した。
`AI_DEVELOPMENT_TOOLS.md`、その他の既存Skills、Serena/MCP設定、Discord設定は変更していない。

### 実行結果

チケット必須条件の追加修正後に`pwsh -NoProfile -File scripts/check-foundation.ps1`と`git diff --check`を再実行し、30ファイル・内部リンク69件の検証が成功した。

| 実行した検証 | 結果と範囲 |
| --- | --- |
| `mise run --skip-tools check`（検証用mise、PowerShell 7.5.1） | PASS: 文書・設定30ファイル、内部リンク66件、環境変数例、ignore 7ケース、working/staged差分の空白。既存リンク切れ3件を修正して再実行 |
| `mise run --skip-tools check:staged` / `git diff --cached --check` | 初回の空stageに加え、コミット前に対象27ファイルをstageした状態でもPASS。実commit時のHookも成功。拒否動作は下記の隔離fixtureで確認 |
| Python 3.12.4 / 既存PyYAML 6.0.2による検査 | Forms 4件のYAML読込、分類・id/label一意性・必須構造、workflow 1件のevent/permissions/実行パス、mise TOML 1件の固定版・task定義がPASS。CI依存としてPython/PyYAMLを追加していない。GitHub側の完全なschema検証・表示確認とは別 |
| 隔離したGit fixtureの正常系・異常系 | Unicodeリンク・見出し成功、リンク切れ・見出し欠落・末尾改行欠落・conflict marker・不正UTF-8・空でない環境変数例の6異常を全て拒否 |
| Hook / 導入スクリプト | 当PCでrepo-local hooksPath設定、`git hook run pre-commit`成功。隔離fixtureでclean index成功、stage済み空白異常をHookと全体checkの両方が拒否。既存hooksPathを上書きせず拒否することも確認 |
| CLI | mise 2026.9.11公式配布物のSHA-256照合成功、tasks一覧確認。隔離ディレクトリでmise install doppler成功、Doppler v3.76.5確認 |
| 原本保持 | DownloadsのHTMLとリポジトリのコピーのSHA-256一致 |
| GitHub Actions初回実行 | [run 35490671217](https://github.com/jogi-hack-2026-team/jogi-hack-2026/actions/runs/35490671217)のFoundation / Repository checks (pull_request)が成功（9秒、commit 6564f89）。以後の最新commitの結果はPR Checksを参照 |
| GitHub | 設定項目表のUI現値を確認。明示依頼後に#24を作成、担当者・Branch・Project進捗を記録。自動追加も実確認。保護設定変更・通知再配信は未実施 |

検証用CLI・fixtureは無視対象`.tools/`だけに配置し、グローバル設定・既存MCP設定は変更していない。
このCIはYAML全構文の検査や網羅的なSecret検出を実装していない。Forms/workflowの構造検査は今回ローカルで実行したもの。
LinuxでのHook導入、アプリ起動、Doppler注入、他メンバーの権限・動作は未確認。文書CIはUbuntuのGitHub-hosted runnerで初回成功。

セルフレビュー: ローカル設定のBlockingなし。Issue作成からPRレビュー待ちまでは明示依頼済み。Mergeは別メンバーのレビュー後に行う。
Board/WIPの相違、Ready条件を満たさない可能性、Doppler接続先、共有資料URLは未解決として残す。

## 公式仕様の参照

2026-09-20にContext7と公式文書を参照して設定・コマンドを確認した。

- [miseの導入と設定](https://mise.jdx.dev/getting-started.html)、[tasks](https://mise.jdx.dev/tasks/)
- [Doppler CLI固定リリース](https://github.com/DopplerHQ/cli/releases/tag/3.76.5)
- [GitHub Issue Forms構文](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)
- [GitHub Actions workflow構文](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)

これらは実装方法の根拠であり、このチームの課金・権限・接続済み状態を証明するものではない。
