# JOGI HACK 2026

3人チームで JOGI HACK 2026 に参加するためのWebアプリケーション開発リポジトリです。
「なぜその技術が必要なのか説明できるプロダクト」を目指します。

## 現在の状態

| 区分 | 内容 |
| --- | --- |
| 確定 | 大会：JOGI HACK 2026 / 対象：Webアプリケーション / チーム：3人 |
| 確定 | 開発期間：2026-09-19 ～ 2026-10-12 / コードフリーズ：2026-10-12 |
| DECIDED | 2026-09-29に音楽探索案を廃止した。旧案の要件・Scopeは現行計画ではない。[Product Spec P-10](docs/product-spec.md#p-10-音楽探索案の廃止) |
| DECIDED | 2026-09-30にProductを「Future ROI」（今日サボると、ゴールは何日遠ざかる？）に決定し、要件・MVP Scopeを確定した。[Product Spec](docs/product-spec.md#現行状態2026-09-30) |
| DECIDED | 予測モデル（2状態Bayesian Markov、Beta(2,2)、中心指標はBeta-Geometric分布の中央値）、Data Model、API契約。[Architecture](docs/architecture.md#現行状態2026-09-30) |
| 候補（技術選定確定待ち） | 技術スタック（TypeScript、React＋Vite、Fastify、PostgreSQL、Better Auth）と公開先（Cloud Run＋Neon）。Issue #84（PR #85）で第一候補を最小検証済み（条件付きで採用可能）で、チームの採択待ち。[Architecture D-23](docs/architecture.md#d-23)、[検証状況](docs/architecture.md#第一候補の検証状況84--85) |
| 未実装 | Product機能・Prediction Engine・DB・公開環境のコードはまだない。旧Web/API・Compose構成の復元は実装Issueで行う |
| 履歴 | 音楽案向けの要件・設計・比較結果は新案に自動適用しない。[旧案の保管場所](archive/music-exploration/README.md) |

コードフリーズ後は、原則としてソースコードと事前提出資料を編集できません。
過去の案・会話・実験コードは採用済みの仕様ではありません。

情報には次の区分を明記します。

- **確定**：チームで明示的に決定済み。
- **候補**：現在検討している選択肢。
- **仮説**：検証が必要な推測。
- **未定**：まだ議論・決定されていない事項。

現時点では文書、4種類のIssue Forms、PRテンプレート、AI向けSkills、Serena設定、miseの共通タスク、文書・設定検証用のGitHub Actionsがあります。
旧Web/API・開発用DBの起動構成、旧案の文書と比較PoCは[保管場所](archive/music-exploration/README.md)へ移しました。現行のアプリ起動構成はありません。
現行の未決定事項と当時の検証記録への入口は[開発基盤の状態](docs/operations/development-foundation-status.md)で区別しています。
次の案で使える資産と再評価が必要な条件は[引き継ぎの棚卸し](docs/operations/reuse-handoff.md)にまとめています。
実装の棚卸し・調査基準・関連する判断Issueは[仕様・実装・確認方法の対応表](docs/change-map.md)を参照してください。
旧音楽案のML Issue向けCodex Harnessは通常の実行タスクとCIから外しました。再利用前の確認事項は[引き継ぎ](docs/operations/reuse-handoff.md)を参照してください。

## 開発基盤のセットアップと確認

GitとPowerShell 7を使います。文書・設定チェックの手順は[開発ガイド](docs/DEVELOPMENT_GUIDE.md#13-初回セットアップ)を参照してください。アプリの技術スタックは[Architecture](docs/architecture.md#technology-stack)に候補を記録しています（技術選定確定待ち）。起動構成は確定後に復元します。

導入済みの環境では、リポジトリのルートで `mise run --skip-tools check` を実行します。文書・設定を検査し、成功時は `PASS:` が表示されます。
miseがない場合は、PowerShell 7で `pwsh -NoProfile -File scripts/check-foundation.ps1` を実行すると同じ検証ができます。
Hook（コミット前に走る処理）の導入はローカル設定を変更するため、[初回セットアップ](docs/DEVELOPMENT_GUIDE.md#13-初回セットアップ)を読んで別に行います。

`check`は文書・設定の検証です。Secret・DB・アプリRuntimeは不要です。旧アプリを調べる場合だけ[履歴内の手順](archive/music-exploration/docs/DEVELOPMENT_GUIDE.md#composeでwebapipostgresqlを起動する)を参照してください。次のProduct向け起動・型検査・ビルド・テストは技術採択後に定めます。

## 最初に読む順番

1. このREADME：前提、現在の状態、情報の置き場所。
2. [CONTRIBUTING.md](CONTRIBUTING.md)：チーム共通の開発ルール。
3. [開発ガイド](docs/DEVELOPMENT_GUIDE.md)：環境準備からIssue・ブランチ・PR・マージ後までの操作。
4. [AGENTS.md](AGENTS.md)：AIへ作業を依頼する際の共通ルール。
5. [AI開発ツールガイド](AI_DEVELOPMENT_TOOLS.md)：MCPとSkillsの使い分け、利用状況。

機能の仕様を知りたい・変更したい場合は、[対応表](docs/change-map.md#アプリの仕様と実装)から「目的・操作・入力や表示の条件・失敗時の動作」を説明する機能文書へ進み、内部処理、関連コード、確認方法をたどります。
正式な設計文書は[Product Spec](docs/product-spec.md)と[Architecture](docs/architecture.md)の2本です。アプリの起動構成とProduct機能の実装状況、比較結果と未検証範囲はArchitectureからたどれます。[開発基盤と作業手順](docs/change-map.md#開発基盤と作業手順)と[配置ルール](CONTRIBUTING.md#仕様文書の配置)も参照してください。

旧音楽案の領域別記録は[保管場所](archive/music-exploration/README.md)からたどれます。現在の実装指示ではありません。

AIは最初にAGENTS.mdを読み、必要な文書とSkillを参照してください。

## 情報の正本

| 情報 | 正本 |
| --- | --- |
| プロジェクト概要、日程、文書の入口 | このREADME。Product・Architectureの状態は下記2正本を参照 |
| Issue / ブランチ / コミット / PR / レビュー / マージ / Ready・Done / Scopeの運用ルール | [CONTRIBUTING.md](CONTRIBUTING.md) |
| 共通ルールを実行する具体的な操作手順 | [開発ガイド](docs/DEVELOPMENT_GUIDE.md) |
| AIの判断範囲、安全性、実装・検証原則 | [AGENTS.md](AGENTS.md) |
| ツールの利用方針、環境依存情報、Skill一覧 | [AI開発ツールガイド](AI_DEVELOPMENT_TOOLS.md) |
| 作業別のAIワークフロー | [.agents/skills/](.agents/skills/) の各SKILL.md |
| 機能・ページ・基盤から仕様、実装、確認方法への対応と棚卸し | [仕様・実装・確認方法の対応表](docs/change-map.md) |
| 個別タスクの背景・目的・範囲・完了条件 | [GitHub Issue](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues) |
| 現在のStatus・Scope | [GitHub Projects](https://github.com/orgs/jogi-hack-2026-team/projects/1)（アクセス権が必要） |
| 正式Product仕様・要件・Scope・Product Decision Log | [Product Spec](docs/product-spec.md) |
| 正式Architecture・技術候補・DB・Deployment・Architecture Decision Log | [Architecture](docs/architecture.md) |
| 過去の開発基盤の判断履歴 | [開発基盤ADR](archive/music-exploration/docs/decisions/0001-development-foundation.md)。新規Product設計の正本を増やさない |
| 現行基盤の状態と旧設定・検証記録への入口 | [開発基盤の状態](docs/operations/development-foundation-status.md) |
| リリース・提出・デモ | [リリースとデモの手順](docs/operations/release-demo.md) |

仕様・設計・資料の追加先は[ドキュメント運用](CONTRIBUTING.md#ドキュメントと技術判断)を参照してください。
同じ説明をコピーせず、正本へリンクします。
