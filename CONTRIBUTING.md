# Contributing

> GitHubやIssue、Branch、Pull Requestを使った開発に慣れていない場合は、
> [初心者向け開発運用ガイド](./docs/DEVELOPMENT_GUIDE.md) を先に確認してください。

## 開発フロー

1. Issueを作成する
2. Issueの目的・内容・完了条件を確認する
3. AssigneeとScopeを設定する
4. Issueを `Ready` にする
5. 最新の `main` から作業Branchを作成する
6. 作業開始時に `In Progress` にする
7. 実装・動作確認を行う
8. 変更内容を確認してCommitする
9. Pull Requestを作成する
10. `In Review` にする
11. レビューを受ける
12. 指摘がある場合は修正し、再レビューを依頼する
13. 承認後、Squash Mergeする
14. Issue / Projectが `Done` になったことを確認する
15. Merge済みの作業Branchを削除する

---

## ブランチ命名

以下の形式を使用する。

- `feat/<issue番号>-<概要>`
- `fix/<issue番号>-<概要>`
- `refactor/<issue番号>-<概要>`
- `docs/<issue番号>-<概要>`
- `chore/<issue番号>-<概要>`

例：

`feat/12-document-upload`

原則として、

`1 Issue = 1 Branch = 1 Pull Request`

とする。

複数の無関係なIssueを同じBranchで同時に扱わない。

---

## Issue

Issueは以下の4種類を使用する。

- Feature
- Bug
- Task
- Investigation

各Issueには可能な限り、以下を記載する。

- 目的・背景
- やること
- 完了条件

完了条件が分からない状態で実装を開始しない。

---

## Scope

GitHub Projectsの `Scope` を使用する。

- `Must`: コードフリーズまでに必ず完成させる
- `Should`: Must完成後に取り組む
- `Could`: 余力がある場合のみ取り組む

Mustの完成度を犠牲にしてShouldやCouldを実装しない。

---

## 作業開始前

新しい作業を始める前に、ローカルの `main` を最新状態にする。

    git switch main
    git pull origin main

その後、Issue用のBranchで作業する。

GitHub上ですでにBranchを作成している場合：

    git fetch origin
    git switch feat/12-example

ローカルでBranchを作成する場合：

    git switch -c feat/12-example

古い `main` を元に新しいBranchを作らないようにする。

---

## Commit

コミットメッセージは変更内容が分かる形にする。

例：

- `feat: ファイルアップロード機能を追加`
- `fix: 保存時のエラーを修正`
- `refactor: パーサーの責務を整理`
- `docs: READMEを更新`
- `chore: Issueテンプレートを追加`

### Commitする前に確認する

まず変更されているファイルを確認する。

    git status

変更内容を確認する。

    git diff

### `git add .` は原則使用しない

このプロジェクトでは、意図しないファイルをCommitする事故を防ぐため、
`git add .` は原則使用しない。

変更したファイルを確認したうえで、必要なファイルだけStageする。

例：

    git add src/example.ts
    git add README.md

変更の一部分だけStageしたい場合は、以下も使用できる。

    git add -p

`git add -p` は、変更を部分ごとに確認しながらStageするコマンド。

Stageした内容はCommit前に確認する。

    git diff --staged

意図していない変更が含まれている場合は、そのままCommitしない。

### 1つのCommitに無関係な変更を混ぜない

例えば、

- 検索機能の実装
- READMEの修正
- 別画面のバグ修正

を1つのCommitにまとめない。

できるだけ、

「このCommitは何を変更したのか」

を説明できる単位に分ける。

ただし、Commitを細かく分割すること自体を目的にしない。

---

## Pull Request

- 原則としてIssueと紐付ける
- `main` へ直接pushしない
- レビュー後にMergeする
- Merge方式はSquash Mergeを使用する
- レビューコメントは解決してからMergeする
- 無関係な変更を同じPRに含めない
- PRを必要以上に大きくしない

関連Issueには、以下のように記載する。

`Closes #12`

PRが `main` へMergeされると、対応するIssueもCloseされる。

---

## Pull Requestを作る前のセルフレビュー

PRを作成する前に、自分で変更内容を確認する。

最低限、以下を確認する。

- [ ] Issueの完了条件を満たしている
- [ ] 意図していないファイルを変更していない
- [ ] デバッグ用コードを残していない
- [ ] 不要なコメントアウトを残していない
- [ ] APIキーやパスワードなどの秘密情報を含んでいない
- [ ] 関係のないフォーマット変更を含んでいない
- [ ] 必要な動作確認を行った
- [ ] PRの説明だけで変更内容を理解できる

可能であれば、GitHub上のPRの `Files changed` も自分で一度確認する。

---

## レビューしやすいPRにする

レビューする人が、

「何が変わったのか」

を短時間で理解できる状態を目指す。

### 変更理由を書く

PRには、以下を記載する。

- なぜ変更したのか
- 何を変更したのか
- どのように確認したのか
- 特にレビューしてほしい箇所

コードをすべて読まないと目的が分からないPRにしない。

### 変更範囲を小さくする

1つのPRに大量の無関係な変更を入れない。

PRが大きくなりすぎた場合は、
IssueやPRを分割できないか検討する。

### 不要な変更を入れない

例えば機能追加PRで、以下のような無関係な変更を同時に行わない。

- 関係のない変数名変更
- 関係のないファイルの整形
- README修正
- 別機能のリファクタリング
- 別Issueのバグ修正

必要であれば別Issue・別PRに分ける。

---

## UI変更がある場合

UIを変更した場合は、可能な限りPRにスクリーンショットを添付する。

Before / Afterがある場合は両方載せる。

レビューする側がローカル環境を起動しなくても、
変更内容を把握できる状態を目指す。

---

## 動作確認

PRには、

「確認しました」

だけではなく、

「何を、どのように確認したか」

を書く。

例：

- Chromeでファイルアップロード成功を確認
- 未入力時にエラーが表示されることを確認
- 既存の一覧表示に影響がないことを確認

---

## Review

レビューでは主に以下を確認する。

- Issueの目的を満たしているか
- 完了条件を満たしているか
- 想定外の変更が含まれていないか
- バグにつながる処理がないか
- コードの意図を理解できるか
- 責務の置き場所が不自然ではないか
- 不必要に複雑になっていないか
- セキュリティ上の問題がないか

レビューは、

「書き方の好みを押し付ける場」

ではなく、

「変更を安全にmainへ入れられるか確認する場」

として扱う。

---

## Reviewの種類

### Comment

質問・提案・補足。

必ずしも修正必須ではない。

### Approve

問題なし。

Mergeしてよい状態。

### Request changes

Merge前に修正が必要。

Request changesされた場合は、修正後に `Re-request review` を行う。

---

## レビューコメントへの対応

レビューコメントに対応した場合は、必要に応じて返信する。

例：

- `修正しました。`
- `この理由から現状の実装を維持しています。`
- `確認したところ、こちらの実装に問題があったため修正しました。`

対応が完了したConversationはResolveする。

指摘の意味が分からない場合は、推測して修正せず質問する。

---

## Review開始後の大きな変更

レビュー開始後に大規模な変更を追加すると、
Reviewerが確認済みの内容と差分が大きく変わる。

そのため、レビュー開始後に以下の変更を追加しない。

- 大規模なリファクタリング
- 新しい機能追加
- PRの目的と関係のない変更

必要な場合はReviewerへ共有するか、別PRに分ける。

---

## Merge Conflict

Merge Conflictとは、複数のBranchで同じ箇所が変更され、
Gitが自動でどちらの変更を採用すればよいか判断できない状態。

Conflictが発生した場合は、まず以下で状態を確認する。

    git status

内容を理解せずにConflict markerを削除したり、
相手の変更を消したりしない。

解決方法が分からない場合は、チーム内で相談する。

---

## 作業中にmainが更新された場合

他のメンバーのPRが `main` へMergeされた場合、
必要に応じて最新の `main` を自分のBranchへ取り込む。

まず `main` を最新状態にする。

    git switch main
    git pull origin main

自分のBranchへ戻る。

    git switch feat/12-example

最新の `main` を取り込む。

    git merge main

Conflictが発生した場合は、内容を確認して解決する。

---

## Force Push

理由なくForce Pushしない。

特に以下は、原則として使用しない。

    git push --force

Force PushはGitの履歴を書き換えるため、
他のメンバーの変更や作業に影響する可能性がある。

必要な場合は、チーム内で確認してから行う。

---

## 秘密情報

以下の情報はCommitしない。

- APIキー
- アクセストークン
- パスワード
- DB接続情報
- 秘密鍵
- Webhook URL
- `.env` の実値

秘密情報は環境変数などで管理する。

`.env` などは `.gitignore` でGitの管理対象から除外する。

GitHubのSecret ProtectionやPush Protectionも有効にしているが、
これらは最後の防御であり、秘密情報をCommitしてよいという意味ではない。

誤って秘密情報を公開した場合は、
Commitを削除するだけではなく、そのSecret自体を無効化・再発行する。

---

## Merge

レビューが完了したらSquash Mergeする。

Merge前に以下を確認する。

- [ ] 必要なApproveがある
- [ ] 未解決のレビューコメントがない
- [ ] Issueの完了条件を満たしている
- [ ] 必要な動作確認が完了している
- [ ] 関係のない変更が混ざっていない

---

## Definition of Done

以下を満たした状態をDoneとする。

- [ ] Issueの完了条件を満たしている
- [ ] 必要な動作確認が完了している
- [ ] Pull Requestが作成されている
- [ ] Reviewが完了している
- [ ] 未解決のレビューコメントがない
- [ ] mainへSquash Mergeされている
- [ ] IssueがCloseされている
- [ ] ProjectがDoneになっている

「実装が終わった」だけではDoneではない。

---

## Merge後

Merge後は以下を確認する。

- PRがMergedになっている
- IssueがClosedになっている
- ProjectがDoneになっている
- 作業Branchが不要になっている

Merge済みの作業Branchは原則削除する。

次のIssueでは、最新の `main` から新しいBranchを作成する。

---

## やってはいけないこと

- `main` へ直接pushする
- `main` 上で直接実装する
- `git add .` で内容を確認せず全変更をStageする
- 無関係な変更を1つのIssue・PRに混ぜる
- 完了条件が不明なまま実装を開始する
- レビュー前にMergeする
- レビュー指摘を無視する
- Merge済みBranchを使い回す
- 理由なくForce Pushする
- 秘密情報をCommitする
- 分からないGit操作を適当に実行する

---

## Gitで困ったとき

まず現在の状態を確認する。

    git status

現在のBranchを確認する。

    git branch

最近のCommitを確認する。

    git log --oneline

接続しているRepositoryを確認する。

    git remote -v

分からない状態で `reset`、`rebase`、`force push` などを実行しない。

必要であればチーム内で確認する。
