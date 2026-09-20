# Contributing

> GitHubやIssue、Branch、Pull Requestを使った開発に慣れていない場合は、
> [初心者向け開発運用ガイド](./docs/DEVELOPMENT_GUIDE.md) を先に確認してください。

## 開発フロー

基本的に以下の流れで開発します。

1. 対応する既存Issueを確認し、なければ変更着手前にIssueを作成する
2. Issueの目的・内容・完了条件を確認する
3. 担当者が自分をAssigneeに設定し、Scopeを設定する
4. Issueを `Ready` にする
5. 最新の `main` から作業Branchを作成する
6. Issue本文の「開発情報」に作業Branchを記載し、Push後にリンクを追記する
7. 作業開始時に `In Progress` にする
8. 実装・動作確認を行う
9. 変更内容を確認してCommitする
10. Pushする
11. Pull Requestを作成する
12. PRに対応Issueを `Closes #<Issue番号>` で記載する
13. Issue本文の「開発情報」にPull Requestのリンクを記載する
14. `In Review` にする
15. レビューを受ける
16. 指摘がある場合は修正し、再レビューを依頼する
17. 承認後、Squash Mergeする
18. Issue / Projectが `Done` になったことを確認する
19. Merge済みの作業Branchを削除する

担当者は、各操作を完了した時点でGitHub ProjectsのStatusも更新します。実装中・レビュー待ち・Merge済みを同じStatusのまま放置しません。

---

## Branch運用

`main` はレビュー済みの変更が統合されたBranchです。

`main` 上では直接開発しません。

基本構成は以下です。

    main
    ↑
    Pull Request
    ↑
    feat/* / fix/* / refactor/* / docs/* / chore/*

原則として、

`1 Issue = 1 Branch = 1 Pull Request`

とします。

複数の無関係なIssueを同じBranchで扱わないでください。

---

## ブランチ命名

以下の形式を使用します。

- `feat/<Issue番号>-<概要>`
- `fix/<Issue番号>-<概要>`
- `refactor/<Issue番号>-<概要>`
- `docs/<Issue番号>-<概要>`
- `chore/<Issue番号>-<概要>`

例：

`feat/12-document-upload`

`fix/23-save-error`

`docs/6-development-guide`

### Prefixの意味

| Prefix     | 用途                         |
| ---------- | ---------------------------- |
| `feat`     | 新機能・機能追加             |
| `fix`      | バグ修正                     |
| `refactor` | 外部の動作を変えない内部改善 |
| `docs`     | ドキュメント                 |
| `chore`    | 開発環境・設定・依存関係など |

---

## Issue

### チケット作成を着手条件にする

実装・修正・設定変更・ドキュメント更新は、変更着手前にGitHub Issueへ紐付けます。
小さな変更やローカルだけの作業でも、チケットを省略しません。

1. 既存Issueを検索し、目的・範囲が一致する未完了Issueがあれば利用します。追加修正も同じ範囲なら同じIssueに記録し、重複作成しません。
2. 対応するIssueがなければ、目的・範囲・完了条件を記載して作成します。投稿案をローカルに用意しただけでは作成完了ではありません。
3. Issue番号・URL、Assignee、Scope、Definition of Readyを確認してから、番号付きBranchで変更を開始します。

Issue作成に承認が必要な依頼では、投稿する内容を示し、**変更着手前に**承認を求めます。
ログイン・権限不足や承認待ちの場合も、チケット未作成のまま実装・設定・文書編集を先行しません。
その間に行えるのは、既存状態の読み取り調査とIssue本文案・判断材料の準備までです。
すでにチケットなしで着手していた場合は、既存変更を消さずに状況を報告し、紐付けを整えてから対象作業を再開します。

Issueは以下の4種類を使用します。

- Feature
- Bug
- Task
- Investigation

### Feature

新しい機能や既存機能の拡張に使用します。

### Bug

想定した動作になっていない不具合の修正に使用します。

### Task

機能追加・バグ修正以外の開発作業に使用します。

例：

- ドキュメント作成
- CI構築
- 開発環境整備
- リファクタリング

### Investigation

技術・仕様・実現可能性などを調査するときに使用します。

単に調査するだけではなく、

「何を判断するための調査なのか」

を明確にしてください。

---

## Issueに書く内容

各Issueには可能な限り以下を記載します。

- 目的・背景
- やること
- 完了条件
- 開発情報

特に「完了条件」を明確にします。

悪い例：

`検索機能を作る`

良い例：

- [ ] キーワードを入力できる
- [ ] 検索結果が表示される
- [ ] 検索結果が0件の場合の表示がある

「どこまでできればIssueを完了できるのか」が分からない状態で実装を開始しないでください。

---

## IssueとBranch / Pull Requestの紐付け

担当者は、Issue本文の「開発情報」に対応するBranchとPull Requestを記載します。
Branchを作成した時点で名前を記載し、GitHub上に作成・PushしたらBranchのリンクを追記してください。
PR作成後はPRのリンクも追記します。IssueのDevelopment欄で関連付けた場合も、本文の開発情報を更新してください。

Issue本文の末尾などに、以下の形式で記載してください。

    ## 開発情報

    - Branch: [feat/12-search](https://github.com/jogi-hack-2026-team/jogi-hack-2026/tree/feat/12-search)
    - Pull Request: #18（またはPRのURL）

Pull Requestをまだ作成していない場合：

    ## 開発情報

    - Branch: `feat/12-search`
    - Pull Request: 未作成

上記のBranch名・Issue番号・PR番号は記載例です。実際に作成したものに置き換えてください。
同じリポジトリのPRは `#18` のように番号を書いてもリンクになります。未作成のBranch・PRは「未作成」とし、存在しないリンクを記載しないでください。

### Branch

可能な限りIssueの右側にある、

`Development → Create a branch`

からBranchを作成してください。

GitHub上でもIssueとBranchの関係を追いやすくするためです。

### Pull Request

Pull Requestには対応するIssueを以下の形式で記載します。

`Closes #12`

これにより、

- Issue
- Branch
- Pull Request

の関係を追いやすくします。

PRが `main` へMergeされると、対応Issueも自動的にCloseされます。

---

## Assignee

Assigneeは、そのIssueを担当する人です。

チケットに着手する本人が、作業開始前に自分をAssigneeとして設定してください。
Issue作成時は `Select assignees` から自分のGitHubアカウントを選択します。
作成後はIssue右側の `Assignees` の編集、または `Assign yourself` で設定できます。
Issue作成者と作業担当者が異なる場合も、実際に作業する人を設定します。担当が変わったらAssigneeも更新してください。

担当者が分からない状態のIssueを勝手に実装し始めないようにします。

---

## Scope

### StatusとScope

Statusは作業の進捗、Scopeは完成の優先範囲です。両者を別々に設定します。
Statusの値・更新方法は[GitHub Projects](#github-projects)を参照してください。

GitHub Projectsの `Scope` を使用します。

- `Must`: コードフリーズまでに必ず完成させる
- `Should`: Must完成後に取り組む
- `Could`: 余力がある場合のみ取り組む

Mustの完成度を犠牲にしてShouldやCouldを実装しないでください。

---

## GitHub Projects

原則1人1Issueとし、レビューが滞っている場合は新規着手よりレビューを優先します。
BoardのWIP上限と資料との差分は[開発基盤の状態](docs/operations/development-foundation-status.md#資料との相違点)を参照し、列や上限を無断で置換しません。

Statusは以下を使用します。

    Backlog
    ↓
    Ready
    ↓
    In Progress
    ↓
    In Review
    ↓
    Done

ProjectにはIssueとPull Requestのカードが自動追加されることがあります。担当者は、存在する関連カードを同じ進捗のStatusに更新します。

| 対象 | タイミング | Status |
| --- | --- | --- |
| Issue | Issueを作成し、まだ着手条件を満たしていない | Backlog |
| Issue | 目的・完了条件・Assignee・Scopeが決まり、着手できる | Ready |
| Issue | Branchを作成して作業を開始する | In Progress |
| Issue・作成済みPRカード | Pull Requestを作成してレビューを依頼する | In Review |
| Issue・PRカード | `Request changes`を受けて修正する | In Progress |
| Issue・PRカード | 修正後に再レビューを依頼する | In Review |
| Issue・PRカード | PRが `main` へMergeされ、IssueがCloseされたことを確認する | Done |

自動追加されたPRカードも、PRの状態に合わせて更新します。

### Backlog

まだ着手できる状態になっていないIssueです。

例：

- 仕様が未確定
- やるか判断していない
- 調査が必要
- Scopeが決まっていない

### Ready

すぐに作業を開始できる状態です。

### In Progress

現在作業中です。

### In Review

Pull Requestを作成し、レビューを待っている状態です。

### Done

PRが `main` へMergeされ、作業が完了した状態です。

実装が終わっただけではDoneではありません。

---

## Definition of Ready

Issueを `Ready` にするには、最低限以下を満たしている必要があります。

- [ ] 目的・背景が分かる
- [ ] やることが分かる
- [ ] 完了条件が分かる
- [ ] Scopeが設定されている
- [ ] 実際の作業担当者がAssigneeに設定されている
- [ ] 大きすぎるIssueになっていない
- [ ] 必要な前提作業が完了している

条件を満たしていないIssueは、原則として実装を開始しません。

---

## 作業開始前

新しい作業を始める前に、ローカルの `main` を最新状態にします。

    git switch main
    git pull origin main

その後、Issue用のBranchで作業します。

GitHub上ですでにBranchを作成している場合：

    git fetch origin
    git switch feat/12-example

ローカルでBranchを作成する場合：

    git switch -c feat/12-example

古い `main` を元に新しいBranchを作らないようにしてください。

現在のBranchは以下で確認できます。

    git branch

---

## Commit

コミットメッセージは変更内容が分かる形にします。

例：

- `feat: ファイルアップロード機能を追加`
- `fix: 保存時のエラーを修正`
- `refactor: パーサーの責務を整理`
- `docs: READMEを更新`
- `chore: Issueテンプレートを追加`

---

## Commitする前に確認する

まず現在の変更状態を確認します。

    git status

変更差分を確認します。

    git diff

---

## `git add .` は原則使用しない

このプロジェクトでは、意図していないファイルをCommitする事故を防ぐため、

`git add .`

は原則使用しません。

変更したファイルを確認して、必要なファイルだけStageします。

例：

    git add src/example.ts
    git add README.md

変更の一部分だけStageしたい場合：

    git add -p

`git add -p` は、変更を部分ごとに確認しながらStageするコマンドです。

Stageした内容はCommit前に必ず確認します。

    git diff --staged

意図していない変更が含まれている場合は、そのままCommitしないでください。

---

## 1つのCommitに無関係な変更を混ぜない

例えば、

- 検索機能の実装
- READMEの修正
- 別画面のバグ修正

を1つのCommitにまとめないでください。

できるだけ、

「このCommitは何を変更したのか」

を説明できる単位に分けます。

ただし、Commitを細かく分割すること自体を目的にはしません。

---

## Pull Request

Pull Requestでは以下を守ります。

- 対応Issueと紐付ける
- `main` へ直接pushしない
- `main` を対象とするPRは、書き込み権限を持つ別メンバーのApproveが最低1件付くまでMergeしない
- 保護ルールのbypassや、承認待ちのままのMergeを行わない
- Merge方式はSquash Mergeを使用する
- レビューコメントは解決してからMergeする
- 無関係な変更を同じPRに含めない
- PRを必要以上に大きくしない

関連Issueには、

`Closes #12`

のように記載します。

---

## Pull Requestを作る前のセルフレビュー

PRを作成する前に、自分で変更内容を確認します。

最低限以下を確認してください。

- [ ] Issueの完了条件を満たしている
- [ ] 意図していないファイルを変更していない
- [ ] デバッグ用コードを残していない
- [ ] 不要なコメントアウトを残していない
- [ ] APIキーやパスワードなどの秘密情報を含んでいない
- [ ] 関係のないフォーマット変更を含んでいない
- [ ] 必要な動作確認を行った
- [ ] PRの説明だけで変更内容を理解できる

可能であれば、GitHub上のPRの `Files changed` も自分で一度確認してください。

---

## レビューしやすいPRにする

Reviewerが、

「何が変わったのか」

を短時間で理解できるPRを目指します。

### 変更理由を書く

PRには以下を記載します。

- なぜ変更したのか
- 何を変更したのか
- どのように確認したのか
- 特にレビューしてほしい箇所

コードをすべて読まないと目的が分からないPRにしないでください。

### 変更範囲を小さくする

1つのPRに大量の無関係な変更を入れないでください。

PRが大きくなりすぎた場合は、IssueやPRを分割できないか検討します。

### 不要な変更を入れない

例えば機能追加PRで以下のような変更を同時に行わないでください。

- 関係のない変数名変更
- 関係のないファイルの整形
- README修正
- 別機能のリファクタリング
- 別Issueのバグ修正

必要であれば別Issue・別PRに分けます。

---

## UI変更がある場合

UIを変更した場合は、可能な限りPRにスクリーンショットを添付してください。

Before / Afterがある場合は、両方載せます。

Reviewerがローカル環境を起動しなくても、変更内容を把握できる状態を目指します。

---

## 動作確認

PRには、

「確認しました」

だけではなく、

「何を、どのように確認したか」

を書きます。

例：

- Chromeでファイルアップロード成功を確認
- 未入力時にエラーが表示されることを確認
- 既存の一覧表示に影響がないことを確認

---

## Review

Reviewでは主に以下を確認します。

- Issueの目的を満たしているか
- 完了条件を満たしているか
- 想定外の変更が含まれていないか
- バグにつながる処理がないか
- コードの意図を理解できるか
- 責務の置き場所が不自然ではないか
- 不必要に複雑になっていないか
- セキュリティ上の問題がないか

Reviewは、

「書き方の好みを押し付ける場」

ではなく、

「変更を安全にmainへ入れられるか確認する場」

として扱います。

---

## Reviewの種類

### Comment

質問・提案・補足です。

必ずしも修正必須ではありません。

### Approve

問題なし。

Mergeしてよい状態です。

### Request changes

Merge前に修正が必要な状態です。

Request changesされた場合は、修正後に `Re-request review` を行います。

---

## Request changesされた場合

基本的な流れは以下です。

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

---

## レビューコメントへの対応

レビューコメントに対応した場合は、必要に応じて返信します。

例：

- `修正しました。`
- `この理由から現状の実装を維持しています。`
- `確認したところ、こちらの実装に問題があったため修正しました。`

対応が完了したConversationはResolveします。

指摘の意味が分からない場合は、推測して修正せず質問してください。

---

## Review開始後の大きな変更

Review開始後に大規模な変更を追加すると、Reviewerが確認済みの内容と差分が大きく変わります。

そのため、Review開始後に以下の変更を追加しないでください。

- 大規模なリファクタリング
- 新しい機能追加
- PRの目的と関係のない変更

必要な場合はReviewerへ共有するか、別PRに分けます。

---

## Merge Conflict

Merge Conflictとは、複数のBranchで同じ箇所が変更され、Gitが自動でどちらの変更を採用すればよいか判断できない状態です。

Conflictが発生した場合は、まず以下で状態を確認します。

    git status

内容を理解せずに、

- Conflict markerを削除する
- 相手の変更を削除する
- とりあえず自分の変更だけ残す

といった対応をしないでください。

解決方法が分からない場合は、チーム内で相談してください。

---

## 作業中にmainが更新された場合

他のメンバーのPRが `main` へMergeされることがあります。

必要に応じて最新の `main` を自分のBranchへ取り込みます。

まず `main` を最新状態にします。

    git switch main
    git pull origin main

自分のBranchへ戻ります。

    git switch feat/12-example

最新の `main` を取り込みます。

    git merge main

Conflictが発生した場合は、内容を確認して解決してください。

---

## Force Push

理由なくForce Pushしないでください。

特に以下は原則として使用しません。

    git push --force

Force PushはGitの履歴を書き換えるため、他のメンバーの変更や作業に影響する可能性があります。

必要な場合はチーム内で確認してから行います。

---

## 秘密情報

以下の情報はCommitしないでください。

- APIキー
- アクセストークン
- パスワード
- DB接続情報
- 秘密鍵
- Webhook URL
- `.env` の実値

Secret実値の正本はDopplerです。接続先Project・Configは管理者の確認後に選びます。
ローカル起動・CIへの受け渡しと未完了の設定は[開発基盤の状態と手順](docs/operations/development-foundation-status.md#dopplerの引き継ぎ)を参照してください。

`.env` などは `.gitignore` でGitの管理対象から除外します。

GitHubのSecret ProtectionやPush Protectionも有効にしていますが、これらは最後の防御です。

秘密情報をCommitしてよいという意味ではありません。

誤って秘密情報を公開した場合は、Commitを削除するだけではなく、そのSecret自体を無効化・再発行してください。

---

## Merge

書き込み権限を持つ別メンバーのApproveが最低1件付き、Reviewが完了したらSquash Mergeします。保護ルールのbypassは使用しません。

Merge前に以下を確認してください。

- [ ] 書き込み権限を持つ別メンバーのApproveが最低1件ある
- [ ] 未解決のレビューコメントがない
- [ ] Issueの完了条件を満たしている
- [ ] 必要な動作確認が完了している
- [ ] 関係のない変更が混ざっていない

導入済みCIが失敗している場合は原因を修正してからMergeします。
現在の`Foundation / Repository checks`は文書・設定の検証であり、アプリのテスト成功を意味しません。
アプリ実装後は採用したFormatter・Linter・テスト・buildを実行し、未実装のコマンドはCIへ追加しません。

## ドキュメントと技術判断

| 情報 | 正本・扱い |
| --- | --- |
| 議事録、ブレスト、発表原稿の下書き | Google Docs。議論中の内容を確定事項として扱わない |
| UI、Wireframe、操作の流れ | Figma / FigJam。共有URLと権限は管理者が確認してから案内する |
| 確定仕様、Architecture、Data Model、運用 | GitHubの`docs/`。仕様変更と同じPRまたは関連PRで更新する |
| 重要な設計・運用判断 | `docs/decisions/`。Context / Decision / Alternatives / Reason / Consequencesを記録する |
| Git管理できる構成図・Sequence図 | 必要な仕様文書内のMermaid。実装前に架空の図を作らない |

採用方針・導入条件の記録は[開発基盤ADR](docs/decisions/0001-development-foundation.md)、
項目ごとの導入・検証結果、外部変更の承認待ちは[開発基盤の状態](docs/operations/development-foundation-status.md)を参照してください。
過去のADRを黙って書き換えず、判断変更時は新しいADRから旧ADRを参照し、旧決定をSupersededとして扱います。
リリース・提出前は[リリースとデモの手順](docs/operations/release-demo.md)を使います。

---

## Definition of Done

以下を満たした状態をDoneとします。

- [ ] Issueの完了条件を満たしている
- [ ] 必要な動作確認が完了している
- [ ] Pull Requestが作成されている
- [ ] Reviewが完了している
- [ ] 未解決のレビューコメントがない
- [ ] `main` へSquash Mergeされている
- [ ] IssueがCloseされている
- [ ] ProjectがDoneになっている

「実装が終わった」だけではDoneではありません。

---

## Merge後

Merge後は以下を確認します。

- PRがMergedになっている
- IssueがClosedになっている
- ProjectがDoneになっている
- 作業Branchが不要になっている

Merge済みの作業Branchは原則削除します。

次のIssueでは、最新の `main` から新しいBranchを作成してください。

---

## やってはいけないこと

- `main` へ直接pushする
- `main` 上で直接実装する
- `git add .` で内容を確認せず全変更をStageする
- 無関係な変更を1つのIssue・PRに混ぜる
- 完了条件が不明なまま実装を開始する
- Review前にMergeする
- Review指摘を無視する
- Merge済みBranchを使い回す
- 理由なくForce Pushする
- 秘密情報をCommitする
- 分からないGit操作を適当に実行する

---

## Gitで困ったとき

まず現在の状態を確認します。

    git status

現在のBranchを確認します。

    git branch

最近のCommitを確認します。

    git log --oneline

接続しているGitHub Repositoryを確認します。

    git remote -v

分からない状態で、

- `reset`
- `rebase`
- `force push`

などを実行しないでください。

必要であればチーム内で確認します。
