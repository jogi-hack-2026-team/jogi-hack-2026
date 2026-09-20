# JOGI HACK 2026

3人チームで JOGI HACK 2026 に参加するためのWebアプリケーション開発リポジトリです。
「なぜその技術が必要なのか説明できるプロダクト」を目指します。

## 現在の状態

| 区分 | 内容 |
| --- | --- |
| 確定 | 大会：JOGI HACK 2026 / 対象：Webアプリケーション / チーム：3人 |
| 確定 | 開発期間：2026-09-19 ～ 2026-10-12 / コードフリーズ：2026-10-12 |
| 未定 | 解決する課題、ターゲットユーザー、プロダクト名、コア価値、機能 |
| 未定 | 技術スタック、フレームワーク、DB、認証、AI利用、外部API、インフラ、デプロイ構成、アーキテクチャ、非同期・リアルタイム・検索方式、テスト基盤 |

コードフリーズ後は、原則としてソースコードと事前提出資料を編集できません。
過去の案・会話・実験コードは採用済みの仕様ではありません。

情報には次の区分を明記します。

- **確定**：チームで明示的に決定済み。
- **候補**：現在検討している選択肢。
- **仮説**：検証が必要な推測。
- **未定**：まだ議論・決定されていない事項。

現時点では文書、4種類のIssue Forms、PRテンプレート、AI向けSkills、Serena設定、miseの共通タスク、文書・設定検証用のGitHub Actionsがあります。
アプリ本体、パッケージ定義、アプリの起動・build・lint・typecheck・testは未実装です。
採用方針と接続・動作確認済みの状態は[開発基盤の状態と引き継ぎ](docs/operations/development-foundation-status.md)で区別しています。
実装の棚卸し・調査基準・関連する判断Issueは[仕様・実装・確認方法の対応表](docs/change-map.md)を参照してください。

## 開発基盤のセットアップと確認

Git、PowerShell 7、miseを使います。CLIの導入と基盤整備時の検証用配置は[開発ガイド](docs/DEVELOPMENT_GUIDE.md#13-初回セットアップ)を参照してください。

導入済みの環境では、リポジトリのルートで `mise run --skip-tools check` を実行します。文書・設定を検査し、成功時は `PASS:` が表示されます。
miseがない場合は、PowerShell 7で `pwsh -NoProfile -File scripts/check-foundation.ps1` を実行すると同じ検証ができます。
Hook（コミット前に走る処理）の導入はローカル設定を変更するため、[初回セットアップ](docs/DEVELOPMENT_GUIDE.md#13-初回セットアップ)を読んで別に行います。

`check`は文書・設定の検証です。Secret・DB・アプリRuntimeは不要です。
Formatter・Linter・テストの追加は技術スタックと実装の決定後に行います。

## 最初に読む順番

1. このREADME：前提、現在の状態、情報の置き場所。
2. [CONTRIBUTING.md](CONTRIBUTING.md)：チーム共通の開発ルール。
3. [開発ガイド](docs/DEVELOPMENT_GUIDE.md)：環境準備からIssue・ブランチ・PR・マージ後までの操作。
4. [AGENTS.md](AGENTS.md)：AIへ作業を依頼する際の共通ルール。
5. [AI開発ツールガイド](AI_DEVELOPMENT_TOOLS.md)：MCPとSkillsの使い分け、利用状況。

機能の仕様を知りたい・変更したい場合は、[対応表](docs/change-map.md#アプリの仕様と実装)から「目的・操作・入力や表示の条件・失敗時の動作」を説明する機能文書へ進み、内部処理、関連コード、確認方法をたどります。
現時点ではアプリ未実装のため、[開発基盤と作業手順](docs/change-map.md#開発基盤と作業手順)へ進んでください。機能実装時の文書の追加先は[配置ルール](CONTRIBUTING.md#仕様文書の配置)で定めています。

AIは最初にAGENTS.mdを読み、必要な文書とSkillを参照してください。

## 情報の正本

| 情報 | 正本 |
| --- | --- |
| プロジェクト概要、日程、現在の確定・未定事項、文書の入口 | このREADME |
| Issue / ブランチ / コミット / PR / レビュー / マージ / Ready・Done / Scopeの運用ルール | [CONTRIBUTING.md](CONTRIBUTING.md) |
| 共通ルールを実行する具体的な操作手順 | [開発ガイド](docs/DEVELOPMENT_GUIDE.md) |
| AIの判断範囲、安全性、実装・検証原則 | [AGENTS.md](AGENTS.md) |
| ツールの利用方針、環境依存情報、Skill一覧 | [AI開発ツールガイド](AI_DEVELOPMENT_TOOLS.md) |
| 作業別のAIワークフロー | [.agents/skills/](.agents/skills/) の各SKILL.md |
| 機能・ページ・基盤から仕様、実装、確認方法への対応と棚卸し | [仕様・実装・確認方法の対応表](docs/change-map.md) |
| 個別タスクの背景・目的・範囲・完了条件 | [GitHub Issue](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues) |
| 現在のStatus・Scope | [GitHub Projects](https://github.com/orgs/jogi-hack-2026-team/projects/1)（アクセス権が必要） |
| 採用した重要な技術・設計判断 | [開発基盤ADR](docs/decisions/0001-development-foundation.md)から参照 |
| 基盤の個別設定、未確認事項、手動作業 | [開発基盤の状態と引き継ぎ](docs/operations/development-foundation-status.md) |
| リリース・提出・デモ | [リリースとデモの手順](docs/operations/release-demo.md) |

仕様・設計・資料の追加先は[ドキュメント運用](CONTRIBUTING.md#ドキュメントと技術判断)を参照してください。
同じ説明をコピーせず、正本へリンクします。
