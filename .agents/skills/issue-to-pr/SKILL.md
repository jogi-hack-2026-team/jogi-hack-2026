---
name: issue-to-pr
description: GitHub Issueをもとに、ブランチ作成、実装、検証、Pull Request作成まで進めるときに使用する。
---

# IssueからPull Requestまでの開発フロー

## 開始前

1. `AGENTS.md` を読む。
2. `CONTRIBUTING.md` を読む。
3. 必要であれば `docs/DEVELOPMENT_GUIDE.md` を読む。
4. `gh` CLIを使用して対象Issueを確認する。
5. Issueの目的と完了条件を確認する。
6. 不明な仕様を勝手に補完しない。

## 実装

- Issueのスコープ外の変更を行わない。
- コードの参照関係を調べる必要がある場合はSerenaを利用する。
- ライブラリやフレームワークの仕様確認が必要な場合はContext7を利用する。
- リポジトリで定義されたformatter、lint、typecheck、testを実行する。
- UI変更がある場合はPlaywrightを利用して実ブラウザで確認する。

## ドキュメント

変更によって以下へ影響がないか確認する。

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
7. Issue、Branch、Pull Requestをリポジトリのルールに従って関連付ける。

ユーザーから明示的な指示がない限り、Pull Requestを自動でMergeしない。
