# 開発運用ガイド

このドキュメントでは、このリポジトリで開発するときの基本的な進め方を説明します。

GitHub、Issue、Branch、Pull Requestなどを使った開発に慣れていない人でも、
「今何をしていて、次に何をすればいいのか」が分かることを目的としています。

詳細なルールだけ確認したい場合は、ルートにある
[CONTRIBUTING.md](../CONTRIBUTING.md)
を参照してください。

AIエージェントによるIssue・Projects・PRの操作はGitHub MCPを基本とし、接続できない場合はこのガイドのGitHub Web UI手順を使います。
人間が使う操作手段は強制しません。ローカルのBranch・Commit・Pushは`git`を使います。
Playwright CLI＋Skillとdocumentation-syncを含む採択方針・導入状況は
[AI開発ツールガイド](../AI_DEVELOPMENT_TOOLS.md#採択済みの運用方針)を参照してください。

機能の内容を知りたい場合は[仕様・実装・確認方法の対応表](change-map.md)から正式なProduct Spec・Architectureへ進んでください。本番アプリは未実装で、比較PoCは別の起動・検証手順を持ちます。[初回セットアップ](#13-初回セットアップ)は文書・設定の確認です。
本ガイドの検索機能やIssue番号・Branch名は操作を説明する例です。実装済み機能や実在する対応Issueを示すものではありません。

---

# 1. 最初に覚える開発の流れ

このプロジェクトでは、基本的に次の流れで開発します。

```text
Issue
↓
Ready
↓
Branch作成
↓
In Progress
↓
実装
↓
Commit / Push
↓
Pull Request
↓
In Review
↓
Review
↓
Squash Merge
↓
Done
```

最初からすべてのGitコマンドやGitHub機能を覚える必要はありません。

まずは、

```text
Issue
↓
Branch
↓
実装
↓
Pull Request
↓
Review
↓
Merge
```

を理解してください。

---

# 2. このリポジトリで使うもの

主に以下を使用します。

| 用語            | 意味                                   |
| --------------- | -------------------------------------- |
| Issue           | やることを管理するチケット             |
| GitHub Projects | Issueの進捗を管理するKanban            |
| Branch          | mainに影響を与えず作業する場所         |
| Commit          | 変更内容をGitの履歴として保存したもの  |
| Push            | ローカルのCommitをGitHubへ送ること     |
| Pull Request    | Branchの変更をmainへ取り込むための申請 |
| Review          | 他のメンバーが変更内容を確認すること   |
| Merge           | Branchの変更をmainへ取り込むこと       |

---

# 3. main Branchについて

`main` は、レビュー済みの変更が統合されたBranchです。

このプロジェクトでは、main上で直接開発しません。

```text
main
↑
Pull Request
↑
作業Branch
```

という形で変更を取り込みます。

mainへの直接Pushは行いません。

---

# 4. Issueとは

Issueは、

「これから行う作業を記録するチケット」

です。

変更作業を始める前に、対応する既存Issueを確認し、なければIssueを作ります。
小さな修正や文書更新も対象です。作成承認やログインを待っている間は、変更を先行せず読み取り調査とIssue本文案の準備までに留めます。
詳細は[チケット作成の着手条件](../CONTRIBUTING.md#チケット作成を着手条件にする)を参照してください。

例えば、

- 新しい機能を追加する
- バグを修正する
- READMEを更新する
- 技術を調査する
- 開発環境を整備する

といった作業をIssueとして登録します。

---

# 5. Issueの種類

このリポジトリでは、4種類のIssue Templateを使用します。

実装は`.github/ISSUE_TEMPLATE/`のYAML Issue Formsです。背景・完了条件などの必須欄を入力します。
既存のFeature / Bug / Task / Investigationの区分とラベルを維持しています。

## Feature

新しい機能の追加や、既存機能の拡張に使用します。

例：

```text
[Feature] 検索機能を追加
```

## Bug

想定した動作になっていない不具合の修正に使用します。

例：

```text
[Bug] 保存ボタンを押しても保存されない
```

## Task

機能追加やバグ修正以外の開発作業に使用します。

例：

```text
[Task] READMEを更新
[Task] CIを構築
[Task] 開発環境を整備
```

## Investigation

技術・仕様・実現可能性などを調査するときに使用します。

例：

```text
[Investigation] SSEとWebSocketを比較
```

Investigationでは、

「何を調べるか」

だけではなく、

「何を判断するために調査するのか」

まで書きます。

---

# 6. Issueには何を書くのか

最低限、

- なぜ必要なのか
- 何をするのか
- どこまでできれば完了なのか

を明確にします。

特に重要なのが「完了条件」です。

悪い例：

```text
検索機能を作る
```

これだけでは、どこまで実装すれば終了なのか分かりません。

良い例：

```md
## 完了条件

- [ ] キーワードを入力できる
- [ ] 検索結果が表示される
- [ ] 検索結果が0件の場合の表示がある
```

---

# 7. Assignee

Assigneeは、

「そのIssueを担当する人」

です。

作業を始める本人が、着手前に自分をAssigneeとして設定します。

1. Issue作成画面の `Select assignees` を開きます。
2. 自分のGitHubアカウントを選択します。
3. 作成済みのIssueでは、右側の `Assignees` の編集、または `Assign yourself` で設定します。

Issueを作った人ではなく、実際に作業する人を設定してください。担当が変わったらAssigneeも更新します。
運用ルールの正本は [CONTRIBUTINGのAssignee](../CONTRIBUTING.md#assignee) を参照してください。

担当者が決まっていないIssueを誰かが勝手に実装し始めることは避けます。

---

# 8. Scope

GitHub Projectsでは、IssueにScopeを設定します。

このプロジェクトでは、

| Scope  | 意味                               |
| ------ | ---------------------------------- |
| Must   | コードフリーズまでに必ず完成させる |
| Should | Must完成後に取り組む               |
| Could  | 余力がある場合のみ取り組む         |

Mustの完成度を犠牲にしてShouldやCouldを実装しません。

---

# 9. Label

LabelはIssueやPRの性質を補足するために使用します。

主に以下を使用します。

| Label              | 用途                             |
| ------------------ | -------------------------------- |
| `feature`          | 新機能・機能拡張                 |
| `bug`              | 不具合                           |
| `refactor`         | 挙動を変えない内部改善           |
| `docs`             | ドキュメント                     |
| `chore`            | 開発環境・設定・依存関係など     |
| `investigation`    | 技術・仕様などの調査             |
| `blocked`          | 他の作業や判断待ちで進められない |
| `needs-discussion` | チーム内で相談が必要             |

---

# 10. GitHub ProjectsのStatus

IssueやPull RequestはGitHub Projectsで管理します。

```text
Backlog
↓
Ready
↓
In Progress
↓
In Review
↓
Done
```

## Backlog

まだ着手できる状態になっていないIssueです。

例えば、

- 仕様が決まっていない
- やるか判断していない
- 調査が必要
- Scopeが決まっていない

場合です。

## Ready

実装を始められる状態です。

## In Progress

現在作業中です。

## In Review

Pull Requestを作成し、レビューを待っている状態です。

## Done

Pull RequestがmainへMergeされ、作業が完了した状態です。

コードを書き終わっただけではDoneではありません。

---

# 11. Definition of Ready

Issueを`Ready`にするには、最低限以下を満たしている必要があります。

- [ ] 目的・背景が分かる
- [ ] やることが分かる
- [ ] 完了条件が分かる
- [ ] Scopeが設定されている
- [ ] Assigneeが決まっている
- [ ] 大きすぎるIssueになっていない
- [ ] 必要な前提作業が完了している

条件を満たしていないIssueは、原則として実装を開始しません。

---

# 12. Issueの粒度

原則として、

```text
1 Issue
=
1 Branch
=
1 Pull Request
```

とします。

例えば、

```text
検索機能追加
README更新
ログインバグ修正
```

の3つを1つのIssueやBranchにまとめないようにします。

変更を小さくすることで、

- レビューしやすい
- 問題の原因を特定しやすい
- 変更を戻しやすい

というメリットがあります。

---

# 13. 初回セットアップ

現時点のアプリRuntime・DB・Package Managerは未定です。以下は文書・設定の検証用セットアップです。
Runtimeはアプリの実行環境、Package Managerは依存ライブラリの管理ツールです。現在利用するPowerShell 7は補助スクリプト用で、アプリの技術選定ではありません。
GitとPowerShell 7を使える端末で操作します。以下のcloneだけはリポジトリを置きたい親ディレクトリ、それ以降はcloneしたリポジトリのルートで実行します。

初めてこのRepositoryで作業する場合、RepositoryをローカルへCloneします。

```bash
git clone https://github.com/jogi-hack-2026-team/jogi-hack-2026.git
```

Repositoryへ移動します。

```bash
cd jogi-hack-2026
```

接続先を確認します。

```bash
git remote -v
```

現在の状態を確認します。

```bash
git status
```

GitとPowerShell 7が必要です。miseは[公式の導入手順](https://mise.jdx.dev/getting-started.html)を利用してください。
miseは開発ツールの版と共通コマンドを管理するCLI（端末から使うツール）です。OS・グローバル設定の変更は本人が確認して行います。
基盤整備時の検証版はmise `2026.9.11`です。当時のPCでは検証用バイナリを`.tools/mise/mise/bin/mise.exe`に配置し、PATHには追加していませんでした。Git管理外なので、他のcloneや作業コピーに同じファイルがあるとは限りません。
miseの導入前でも、下記のPowerShell直接実行で検証できます。
`mise.toml`と`scripts/`を読んでから、リポジトリを信頼する操作を行います。

```sh
mise trust
mise run --skip-tools check
mise run --skip-tools hooks:install
```

`--skip-tools`は文書検証のためにDopplerをインストールする必要がないことを明示します。
miseがまだない場合、同じ検証を`pwsh -NoProfile -File scripts/check-foundation.ps1`で実行できます。
Hookの導入はこのリポジトリの`core.hooksPath`のみを設定し、既存Hookがあれば上書きせず停止します。
各メンバーのCloneで一度実行してください。pre-commitはステージ済み差分の空白検査、CIは文書・設定の全体検査を行います。

| コマンド | 意味・成功時に確認すること |
| --- | --- |
| `git clone https://github.com/jogi-hack-2026-team/jogi-hack-2026.git` | リポジトリを取得する。`jogi-hack-2026`ディレクトリが作成される。すでにclone済みなら繰り返さない |
| `cd jogi-hack-2026` | 作業ディレクトリをリポジトリのルートへ移す |
| `git remote -v` | 取得・送信先を表示する。`origin`がこのチームのリポジトリか確認する |
| `git status` | 現在のBranchと変更を表示する。既存変更があれば内容を確認し、破棄しない |
| `mise trust` | 読んだ設定を信頼する操作。実行するタスクと設定を確認してから行う。ソフトウェアの安全性を検証するコマンドではない |
| `mise run --skip-tools check` | ツールの自動インストールを省略して文書・設定検証を実行する。成功時は`PASS:`と検査範囲が表示される |
| `pwsh -NoProfile -File scripts/check-foundation.ps1` | PowerShell 7で、個人のプロファイルを読み込まず同じ検証スクリプトを実行する。miseなしで使える |
| `mise run --skip-tools hooks:install` | ローカルの`core.hooksPath`を`.githooks`に設定する。成功時は設定完了が表示される。既存Hookとの衝突時は停止する |

上記はアプリコードの例ではなく、ルートで使う操作コマンドです。Windowsでは`pwsh`がPowerShell 7を指すことを確認します。Windows PowerShell 5.1を起動する`powershell`とは異なります。
今回の文書整備ではWindows上のPowerShell 7による全体チェックを確認対象にします。過去のCIはUbuntu上で成功した記録がありますが、WSL・Docker内・全メンバー端末でのセットアップ成功を意味しません。結果と対象環境は[確認記録の入口](change-map.md#確認記録と残課題)を参照してください。

## 文書チェックで起きること

`mise.toml`の`check`は`pwsh -NoProfile -File scripts/check-foundation.ps1`を呼びます。直接実行も同じ処理です。

1. スクリプト自身の位置からリポジトリのルートへ移動し、Gitの追跡ファイルと、無視されていない未追跡ファイルを列挙します。
2. Markdown・YAML・TOML・PowerShellスクリプトと一部の設定ファイルについて、UTF-8として読めるか、競合マーカーや末尾改行の欠落がないかを検査します。ローカルの認証情報・Secretは読み取り対象にしません。
3. Markdownの通常のインラインリンクについて、相対パスの参照先とMarkdown見出しを確認します。コードブロックの例や外部URLは対象外です。コード中の関数名、参照形式リンク、文書内容の意味までは検証しません。
4. `.env.example`が説明と空の変数例だけであること、指定した7ケースのGit除外設定、未ステージ・ステージ済み差分の空白を確認します。
5. 問題があれば`ERROR:`で対象を示し、失敗として終了します。問題がなければ`PASS:`でファイル数・内部リンク数等を表示します。アプリのbuild・lint・型検査・テストは実行しません。

CI（変更時に自動で行う検証）は[foundation.yml](../.github/workflows/foundation.yml)が定義します。PR、mainへのpush、手動実行を入口として、Ubuntuのrunner（実行用マシン）で同じスクリプトを実行します。SecretやDBを必要とせず、実行結果は対象PRのChecksで別に確認します。
Git Hookはコミット前に[pre-commit](../.githooks/pre-commit)から`git diff --cached --check`だけを実行します。Hookが成功しても全体の文書チェックを実行したことにはなりません。

## 文書チェックで困ったとき

| 表示・症状 | 原因と修正箇所 | 修正後の確認 |
| --- | --- | --- |
| `mise`が見つからない | 未導入またはPATH未設定。PowerShell 7が使えるなら上記の直接実行を利用する | 直接実行で`PASS:`と終了成功を確認する |
| `pwsh`が見つからない | PowerShell 7未導入またはPATH未設定。端末の導入状況を確認する。5.1で代用しない | `pwsh --version`で7系を確認し、全体チェックを再実行する |
| miseが設定の信頼確認で止まる | 新しいclone等で設定が未信頼。`mise.toml`と呼び出すスクリプトを読み、信頼できる場合にのみ`mise trust`を実行する | 同じ`check`を再実行する。信頼操作なしで確認する場合はスクリプトを読んで直接実行する |
| `missing link target` / `missing heading` | 文書の移動・見出し変更に参照元が追従していない | 表示されたMarkdownのリンクと実ファイル・見出しを照合して直し、全体チェックを再実行する |
| `invalid UTF-8` / `missing final newline` | 対象ファイルの文字コード・末尾改行が規約と違う | 対象だけをUTF-8・末尾改行ありで保存し、差分と全体チェックを確認する |
| `merge conflict marker` | 未解決の競合がある | 正しい内容を関係者と確認して競合を解消し、差分と全体チェックを確認する。マーカーだけを消して済ませない |
| 環境変数例・除外設定・差分空白で失敗 | 対象の例や設定・差分がチェック条件に反する | Secretをログへ出さず原因箇所を確認する。現在のIssue外の設定修正なら別作業として記録し、チェックを緩めない |
| Hook導入が既存設定との衝突で止まる | 別の`core.hooksPath`または既存Hookがある | 上書きせず担当者と統合方法を確認する。解決までは全体チェック・ステージ差分確認を手動で行う |

`pwsh --version`は利用するPowerShellの版を表示する確認コマンドです。これは想定されるエラーへの案内であり、この表の全エラーを今回再現済みという意味ではありません。
CLIの仕様は[Gitのチュートリアル](https://git-scm.com/docs/gittutorial)と[mise run](https://mise.jdx.dev/cli/run.html)、[mise trust](https://mise.jdx.dev/cli/trust.html)を参照できます。設定・スクリプトが何をするかは、このリポジトリの実ファイルを優先して確認します。

Doppler CLIを使う段階では`mise install`を実行し、固定版の導入後に[接続手順](operations/development-foundation-status.md#dopplerの引き継ぎ)へ進みます。
DB・アプリ未確定の間は、Compose起動・migration・seed・アプリ起動を行う手順はありません。
技術決定後に各コマンドの実体を追加し、miseから呼ぶ入口とCIを揃えます。

---

# 14. 作業を始める前に

自分がIssueのAssigneeに設定されていることを確認します。
Branch作成後はIssue本文の「開発情報」にBranch名を記載し、Push後にBranchのリンクを追記します。
記載形式は [CONTRIBUTINGの紐付けルール](../CONTRIBUTING.md#issueとbranch--pull-requestの紐付け) を参照してください。

新しい作業を始める前に、mainを最新状態にします。

```bash
git switch main
git pull origin main
```

その後、Issue用のBranchを作成します。

可能であれば、GitHubのIssue画面にある、

```text
Development
→ Create a branch
```

からBranchを作成します。

GitHub側ですでにBranchを作成した場合：

```bash
git fetch origin
git switch docs/6-development-guide
```

---

# 15. Branchとは

Branchは、

「mainに影響を与えずに作業するための場所」

です。

main上で直接コードを書かず、Issueごとに作業Branchを使用します。

---

# 16. Branch命名規則

Branch名は、

```text
種類/Issue番号-概要
```

とします。

例：

```text
feat/12-search
fix/23-save-error
refactor/31-parser
docs/6-development-guide
chore/8-ci
```

使用する接頭辞は、

| Prefix     | 用途               |
| ---------- | ------------------ |
| `feat`     | 新機能             |
| `fix`      | バグ修正           |
| `refactor` | リファクタリング   |
| `docs`     | ドキュメント       |
| `chore`    | 開発環境・設定など |

---

# 17. 作業開始

Branchへ移動したら、GitHub ProjectsのStatusを、

```text
Ready
↓
In Progress
```

へ変更します。

現在のBranchは、

```bash
git branch
```

で確認できます。

例えば、

```text
* docs/6-development-guide
  main
```

となっていれば、`docs/6-development-guide`で作業しています。

## 仕様を調べて変更するには

正式設計の入口は[Product Spec](product-spec.md)（何を保証するか）と[Architecture](architecture.md)（どう実現するか）の2本です。要件・Scope・技術選定・Deployment・Decision Logを別の正式文書へ分散させず、調査資料やPoCは補助成果物として区別します。

1. [対応表](change-map.md)から対象の機能・ページ・基盤を探し、仕様を読みます。どんな目的・操作・条件・状態を持つかを確認してから、関連コード・設定・テストを読みます。
2. 呼び出し元・参照元も検索し、影響する範囲、実際に変更する範囲、確認だけの範囲を分けます。文書と実装が違えば、現在の動作を無条件に仕様へ転記せず、不一致として記録します。
3. [文書の執筆・保守手順](../.agents/skills/documentation-sync/SKILL.md)に沿って、変更した仕様・説明・対応表・参照を同じ作業で更新します。初心者向けとAI向けに仕様を別々に複製しません。
4. 対象の検証を行い、PRに文書への影響と更新内容、更新不要ならその理由を記載します。必要な文書更新が残っている間は完了にしません。

AIへ依頼する場合は、Issue番号、変えたい挙動、関連仕様、完了条件、変更しない範囲を渡します。例えば「対象Issueの仕様を確認し、対応表とコードから影響を調べ、必要な仕様文書・関連参照も同じ作業で更新し、検証結果と未確認事項を報告してください」と依頼できます。
AIは[AGENTS.md](../AGENTS.md)から共通ルールを確認します。人間も、必要な詳しい手順は上記Skillを参照できます。

---

# 18. Commitとは

Commitは、

「変更内容をGitの履歴として保存すること」

です。

変更内容が分かる単位でCommitします。

例：

```text
feat: 検索フォームを追加
fix: 保存時のエラーを修正
refactor: パーサーの責務を整理
docs: 開発運用ガイドを追加
chore: Issueテンプレートを追加
```

---

# 19. Commitする手順

リポジトリのルート、対象Issueの作業Branchで実行します。以下はREADMEを変更した場合の操作例です。ファイル名・コミット文・Branch名は実際の作業に合わせます。
まず変更を確認します。

```bash
git status
git diff
```

変更内容をCommit対象へ追加します。

```bash
git add README.md
```

`git status`は変更一覧、`git diff`は未ステージの差分を表示します。`git add README.md`は指定したファイルだけを次のコミット対象（ステージ）へ入れます。無関係な変更を混ぜないよう、対象ファイルを明示してください。
ステージした後にファイルを編集した場合は、追加の差分を確認してから必要なものを再度ステージします。

コミットされる内容と空白エラーを確認します。

```bash
git diff --staged
git diff --cached --check
```

1行目はステージ済みの内容を表示します。2行目はその差分の空白エラーを検査し、成功時は何も表示せず終了します。`--staged`と`--cached`は同じ比較対象を指します。新しいファイルの内容も1行目で確認できます。

Commitします。

```bash
git commit -m "docs: 初心者向け開発運用ガイドを追加"
```

これはステージした内容を説明付きで履歴へ保存します。成功時はコミットIDと変更概要が表示されます。Hookで失敗した場合は対象差分を直して確認し、Hookを無効化して通さないでください。

GitHubへ送ります。

```bash
git push
```

初回Push時に設定を求められた場合：

```bash
git push -u origin docs/6-development-guide
```

`git push`はコミットを送信先へ送り、初回の`-u origin <Branch名>`は対応する送信先Branchも設定します。対象Branchと送信範囲を確認してください。送信に失敗した場合は[Gitで困ったとき](#35-gitで困ったとき)も参照し、force pushで解消しないでください。

---

# 20. Pull Requestとは

Pull Request、略してPRは、

「作業Branchの変更をmainへ取り込んでもらうための申請」

です。

PRでは、

- 何を変更したか
- なぜ変更したか
- どのように確認したか
- どこをレビューしてほしいか

を共有します。

---

# 21. Pull Requestを作る

実装と動作確認が終わったらPRを作成します。

PR Templateに沿って、

- 概要
- 関連Issue
- 変更内容
- 動作確認
- レビューしてほしい点
- スクリーンショット
- 補足

を記載します。

PRを作成したらProjectを、

```text
In Progress
↓
In Review
```

に変更します。

---

# 22. IssueとPRを紐付ける

担当者はPR作成後、Issue本文の「開発情報」にPRのURLまたは `#<PR番号>` を追記します。
Branch名・リンクも記載済みか確認してください。未作成の間は「未作成」としておきます。
記載例は [CONTRIBUTINGの紐付けルール](../CONTRIBUTING.md#issueとbranch--pull-requestの紐付け) を参照してください。

PRには、

```text
Closes #12
```

のように記載します。

Issue #12を解決するPRの場合：

```text
Closes #12
```

とします。

PRがmainへMergeされると、対応するIssueもCloseされます。

---

# 23. Reviewとは

Reviewは、

「変更内容を他のメンバーが確認すること」

です。

Reviewerは主に、

- Issueの目的を満たしているか
- 完了条件を満たしているか
- バグがないか
- コードが理解しやすいか
- 設計に問題がないか
- 不要な変更が混ざっていないか

を確認します。

---

# 24. Reviewの結果

## Comment

質問・提案・補足などです。

必ずしも修正必須とは限りません。

## Approve

問題なし。

Mergeしてよい状態です。

## Request changes

修正が必要です。

---

# 25. Request changesされた場合

```text
In Review
↓
Request changes
↓
In Progress
↓
修正
↓
Commit
↓
Push
↓
Re-request review
↓
In Review
```

という流れになります。

`Re-request review`は、

「修正したので、もう一度確認してください」

という意味です。

---

# 26. レビューコメントへの対応

レビューコメントに対応したら、

```text
Resolve conversation
```

で会話を解決します。

指摘内容が理解できない場合は、推測で修正せずReviewerへ確認します。

---

# 27. Merge Conflict

Merge Conflictとは、

複数のBranchで同じ部分が変更され、
Gitが自動でどちらの変更を採用すべきか判断できない状態です。

Conflictが発生したら、まず、

```bash
git status
```

で対象ファイルを確認します。

分からない状態で、

- Conflict markerを適当に削除する
- 相手の変更を全部消す
- force pushする

といった対応はしないでください。

解決方法が分からない場合は、チーム内で確認します。

---

# 28. 作業中にmainが更新された場合

他のメンバーのPRがmainへMergeされることがあります。

自分のBranchへ最新mainを取り込む必要がある場合は、

```bash
git switch main
git pull origin main
```

でmainを最新化します。

その後、自分のBranchへ戻ります。

```bash
git switch feat/12-search
```

mainを取り込みます。

```bash
git merge main
```

Conflictが発生した場合は、内容を確認して解決します。

分からない場合はチーム内で相談します。

---

# 29. Squash Merge

このリポジトリでは、PRをmainへ取り込むときに、

```text
Squash Merge
```

を使用します。

Squash Mergeは、

PR内にある複数のCommitを1つにまとめてmainへ取り込む方法です。

例えば、

```text
fix
fix typo
review fix
```

というCommitがあっても、mainには、

```text
feat: 検索機能を追加
```

という1つのCommitとして残せます。

mainの履歴を読みやすくするために使用します。

---

# 30. Definition of Done

以下を満たした状態をDoneとします。

- [ ] Issueの完了条件を満たしている
- [ ] 必要な動作確認が完了している
- [ ] Pull Requestが作成されている
- [ ] Reviewが完了している
- [ ] 未解決のレビューコメントがない
- [ ] mainへSquash Mergeされている
- [ ] IssueがCloseされている
- [ ] ProjectがDoneになっている

「実装が終わった」だけではDoneではありません。

---

# 31. Merge後

PRがMergeされたら、

```text
PR
→ Merged

Issue
→ Closed

Project
→ Done
```

になっていることを確認します。

---

# 32. Merge済みBranch

PRがMergeされた作業Branchは、原則として削除します。

対象：

```text
feat/*
fix/*
refactor/*
docs/*
chore/*
```

Merge済みBranchを次のIssueで再利用しません。

次のIssueでは、最新のmainから新しいBranchを作成します。

---

# 33. 秘密情報をCommitしない

このRepositoryはPublicです。

以下のような情報は絶対にCommitしないでください。

- APIキー
- アクセストークン
- パスワード
- DB接続情報
- 秘密鍵
- Webhook URL
- `.env`の実値

秘密情報は環境変数などで管理します。

`.env`などは`.gitignore`でGit管理対象から除外します。

GitHubのSecret ProtectionやPush Protectionも有効にしていますが、
これらは最後の防御です。

秘密情報をCommitしてよいという意味ではありません。

誤ってSecretを公開した場合は、
Commitを削除するだけではなく、そのSecret自体を無効化・再発行します。

---

# 34. Branch運用でやってはいけないこと

以下は行わないでください。

```text
mainへ直接Pushする

main上で直接実装する

1つのBranchに無関係な複数Issueを混ぜる

Merge済みBranchを使い回す

Review前にMergeする

Review指摘を無視してMergeする

理由なくforce pushする

秘密情報をCommitする
```

---

# 35. Gitで困ったとき

まず以下を確認します。

現在の状態：

```bash
git status
```

現在のBranch：

```bash
git branch
```

最近のCommit：

```bash
git log --oneline
```

接続しているGitHub Repository：

```bash
git remote -v
```

分からないまま、

```text
reset
rebase
force push
```

などを実行しないようにしてください。

特に、

```bash
git push --force
```

は、他人の変更を壊す可能性があります。

---

# 36. 開発の基本サイクル

基本的には毎回この流れです。

```text
Issueを作る
↓
目的・完了条件を整理
↓
Assignee設定
↓
Scope設定
↓
Ready
↓
最新mainからBranch作成
↓
In Progress
↓
実装
↓
Commit
↓
Push
↓
Pull Request
↓
Closes #Issue番号
↓
In Review
↓
Review
↓
必要なら修正
↓
Approve
↓
Squash Merge
↓
Issue Close
↓
Done
↓
Branch削除
```

---

# 37. 具体例

「検索機能を追加する」というIssue #12を例にします。

## Issue作成

```text
[Feature] 検索機能を追加
```

完了条件：

```text
- キーワードを入力できる
- 検索結果が表示される
- 結果が0件の場合の表示がある
```

Scope：

```text
Must
```

Assignee：

```text
自分
```

## Ready

仕様・完了条件が決まったら、

```text
Backlog
↓
Ready
```

にします。

## Branch

作業を開始するとき、

```text
Ready
↓
In Progress
```

にします。

Branch：

```text
feat/12-search
```

## 実装

Commit例：

```text
feat: 検索フォームを追加

feat: 検索処理を実装

fix: 検索結果0件時の表示を修正
```

## Pull Request

関連Issue：

```text
Closes #12
```

Project：

```text
In Progress
↓
In Review
```

## Review

修正が必要：

```text
Request changes
↓
修正
↓
Re-request review
```

問題なし：

```text
Approve
```

## Merge

```text
Squash and merge
```

その後、

```text
PR → Merged
Issue #12 → Closed
Project → Done
```

を確認します。

---

# 38. 最低限覚えておくこと

全部を一度に覚える必要はありません。

まず、

```text
Issue
↓
Branch
↓
実装
↓
Pull Request
↓
Review
↓
Merge
```

を覚えてください。

Issueは、

「何をするか」

Branchは、

「作業場所」

Commitは、

「変更履歴」

Pull Requestは、

「mainへ変更を取り込むための申請」

Reviewは、

「変更内容の確認」

Mergeは、

「変更をmainへ取り込むこと」

です。

迷った場合は勝手に進めず、チーム内で確認してください。
