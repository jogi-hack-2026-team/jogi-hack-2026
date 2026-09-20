---
name: issue-to-pr
description: GitHub Issueをもとに、ブランチ作成、実装、検証、Pull Request作成まで進めるときに使用する。
---

# IssueからPull Requestまでの開発フロー

## 開始前

1. `AGENTS.md` を読む。
2. `CONTRIBUTING.md` を読む。
3. 必要であれば `docs/DEVELOPMENT_GUIDE.md` を読む。
4. [採択済み方針](../../../AI_DEVELOPMENT_TOOLS.md#採択済みの運用方針)に従い、基本は`gh` CLIで対象Issueを確認する。利用できない場合はGitHub Web UIで代替する。対応Issueがなければ、[チケット作成の着手条件](../../../CONTRIBUTING.md#チケット作成を着手条件にする)に従って作成し、実在する番号・URLを確認する。取得・作成できない場合や作成承認待ちの場合は、未確認と記録するだけで変更を先行せず、同条件に定めた読み取り調査・本文案の準備までに留める。
5. Issueの目的・完了条件と、実際の作業担当者がAssigneeに設定されていることを確認する。設定方法は [CONTRIBUTINGのAssignee](../../../CONTRIBUTING.md#assignee) に従う。担当者が不明な場合は推測して割り当てない。
6. 不明な仕様を勝手に補完しない。
7. [documentation-syncの変更前確認](../documentation-sync/SKILL.md#変更前)に沿い、関連仕様・変更対応表とコードを照合して影響範囲を調べる。

## 実装

- Issueのスコープ外の変更を行わない。
- Branchを作成して作業を開始した時点で、IssueカードのGitHub Projects Statusを `In Progress` に更新する。PR作成後は、存在するPRカードも同じ進捗に更新する。更新タイミングの正本は [CONTRIBUTINGのGitHub Projects](../../../CONTRIBUTING.md#github-projects) を参照する。
- Branch作成後にIssue本文の「開発情報」へBranch名を記載し、Push後にBranchのリンクを追記する。記載形式は [CONTRIBUTINGの紐付けルール](../../../CONTRIBUTING.md#issueとbranch--pull-requestの紐付け) に従う。
- コードの参照関係を調べる必要がある場合はSerenaを利用する。
- ライブラリやフレームワークの仕様確認が必要な場合はContext7を利用する。
- リポジトリで定義済みのformatter、lint、typecheck、testのうち変更に必要な検証を実行する。未定義のコマンドは創作せず、未検証の理由を記録する。
- UI変更は必要な実ブラウザ検証を行う。Playwright CLI＋Skillの利用方針と導入状況は [AI開発ツールガイド](../../../AI_DEVELOPMENT_TOOLS.md#採択済みの運用方針) を確認する。

## ドキュメント

[documentation-sync](../documentation-sync/SKILL.md)で、変更による正本への影響を確認し、更新が必要な文書だけを実装と同じタスク内で更新する。

## Pull Request作成前

1. `git diff`を確認する。
2. Issueの完了条件をすべて満たしているか確認する。
3. 不要な変更が含まれていないか確認する。
4. ドキュメントとの整合性を確認する。
5. [review-gate](../review-gate/SKILL.md)でセルフレビューを行う。
6. `CONTRIBUTING.md` に従ってPull Requestを作成する。
7. PR本文に `Closes #<Issue番号>` を記載し、作成後にIssue本文の「開発情報」へPRのURLまたは番号を追記する。Branchの記載とAssigneeも確認する。
8. PRを作成してレビューを依頼した時点で、Issueカードと自動追加されたPRカードのGitHub Projects Statusを `In Review` に更新する。修正対応では両方を `In Progress` に戻し、再レビュー依頼後に `In Review` に戻す。

`main` を対象とするPRは、書き込み権限を持つ別メンバーのApproveが最低1件必要です。ユーザーから明示的な指示がない限り、Pull Requestを自動でMergeしません。指示がある場合も、保護ルールをbypassしません。
