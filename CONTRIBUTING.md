# Contributing

## 開発フロー

1. Issueを作成する
2. Issueの内容・完了条件を確認する
3. Issueを `Ready` にする
4. mainからブランチを作成する
5. 作業開始時に `In Progress` にする
6. 実装・動作確認を行う
7. Pull Requestを作成する
8. `In review` にする
9. レビューを受ける
10. 指摘がある場合は修正する
11. 承認後、Squash Mergeする
12. Issue / Projectを `Done` にする

## ブランチ命名

以下の形式を使用する。

- `feat/<issue番号>-<概要>`
- `fix/<issue番号>-<概要>`
- `refactor/<issue番号>-<概要>`
- `docs/<issue番号>-<概要>`
- `chore/<issue番号>-<概要>`

例：

`feat/12-document-upload`

## Issue

Issueは以下の4種類を使用する。

- Feature
- Bug
- Task
- Investigation

各Issueには可能な限り、目的・背景・完了条件を記載する。

## Pull Request

- 原則としてIssueと紐付ける
- `main` へ直接pushしない
- レビュー後にマージする
- マージ方式はSquash Mergeを使用する
- レビューコメントは解決してからマージする

## Scope

GitHub Projectsの `Scope` を使用する。

- `Must`: コードフリーズまでに必ず完成させる
- `Should`: Must完成後に取り組む
- `Could`: 余力がある場合のみ取り組む

## Commit

コミットメッセージは変更内容が分かる形にする。

例：

- `feat: ファイルアップロード機能を追加`
- `fix: 保存時のエラーを修正`
- `refactor: パーサーの責務を整理`
- `docs: READMEを更新`
- `chore: Issueテンプレートを追加`
