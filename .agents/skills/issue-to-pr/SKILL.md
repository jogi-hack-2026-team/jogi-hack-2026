---
name: issue-to-pr
description: GitHub Issueをもとに、ブランチ作成、実装、検証、Pull Request作成まで進めるときに使用する。
---

# IssueからPull Requestまでの開発フロー

## 開始前

1. `AGENTS.md` を読む。
2. `CONTRIBUTING.md` を読む。
3. 必要であれば `docs/DEVELOPMENT_GUIDE.md` を読む。
4. [採択済み方針](../../../AI_DEVELOPMENT_TOOLS.md#採択済みの運用方針)に従い、基本は`gh` CLIで対象Issueを確認する。利用できない場合はGitHub Web UIで代替する。どちらでも取得できない場合は未確認と明記し、ユーザーが明示した範囲で進める。
5. Issueの目的・完了条件と、実際の作業担当者がAssigneeに設定されていることを確認する。設定方法は [CONTRIBUTINGのAssignee](../../../CONTRIBUTING.md#assignee) に従う。担当者が不明な場合は推測して割り当てない。
6. 不明な仕様を勝手に補完しない。

## 実装

- Issueのスコープ外の変更を行わない。
- Branch作成後にIssue本文の「開発情報」へBranch名を記載し、Push後にBranchのリンクを追記する。記載形式は [CONTRIBUTINGの紐付けルール](../../../CONTRIBUTING.md#issueとbranch--pull-requestの紐付け) に従う。
- コードの参照関係を調べる必要がある場合はSerenaを利用する。
- ライブラリやフレームワークの仕様確認が必要な場合はContext7を利用する。
- リポジトリで定義されたformatter、lint、typecheck、testを実行する。
- UI変更は必要な実ブラウザ検証を行う。Playwright CLI＋Skillの利用方針と導入状況は[採択済み方針](../../../AI_DEVELOPMENT_TOOLS.md#採択済みの運用方針)を確認する。

## ドキュメント

[documentation-sync](../documentation-sync/SKILL.md)で、変更に関係する文書への影響を確認し、必要な正本だけ更新する。以下は確認対象の例。

- `README.md`
- `CONTRIBUTING.md`
- `docs/DEVELOPMENT_GUIDE.md`
- `docs/architecture/`
- `docs/decisions/`

ドキュメントが古くなる変更を行った場合は、実装と同じタスク内で更新する。

## Pull Request作成前

1. `git diff`を確認する。
2. Issueの完了条件をすべて満たしているか確認する。
3. 不要な変更が含まれていないか確認する。
4. ドキュメントとの整合性を確認する。
5. セルフレビューを行う。
6. `CONTRIBUTING.md` に従ってPull Requestを作成する。
7. PR本文に `Closes #<Issue番号>` を記載し、作成後にIssue本文の「開発情報」へPRのURLまたは番号を追記する。Branchの記載とAssigneeも確認する。

ユーザーから明示的な指示がない限り、Pull Requestを自動でMergeしない。
