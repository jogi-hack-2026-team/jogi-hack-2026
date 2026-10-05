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
| 依頼者のMUST追加方針／チーム採択待ち | 質問から初期確率を置く → 仮の見通し → 実績更新の[R-11・P-15](docs/product-spec.md#p-15-質問由来の見通しのmust追加方針)について、[PR #115](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/115)でチーム採択を求める。現行MustはR-01〜R-10。依頼者方針を撤回せず、別の事前合意を着手条件にしない。具体値・表示・保存／API／Engine契約は[D-26でOPEN](docs/architecture.md#d-26)、未実装 |
| DECIDED | 現行の実績由来の予測モデル（2状態Bayesian Markov、Beta(2,2)、中心指標はBeta-Geometric分布の中央値）、Data Modelと記載済みの業務API規則。契約の未定義部分・解釈の判断待ちは[Architecture](docs/architecture.md#現行状態2026-09-30)から確認する |
| DECIDED（基本構成） | 2026-10-03のD-23基本構成採用は、FE側のDiscord上の了承についての依頼者報告とBE本人の了承記録に基づく。[採用構成・理由・次の作業](docs/architecture.md#2026-10-03の技術構成合意)。版・追加ツール・API細則は未確定 |
| 条件付き第一候補 | Better Auth＋Cloud Run＋Neonは検証・運用条件付き。[D-24](docs/architecture.md#d-24)／[D-25](docs/architecture.md#d-25)。最終採択・公開受入、一般公開、アカウント・課金作成の許可ではない |
| 限定先行／結合待ち | #71〜#73の承認範囲の[Prediction計算本体・テスト](packages/prediction/README.md)は[#103](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/103)でmain統合済み。日数metadata・公開例外の契約も依頼者承認を反映。[純粋Engine検証CI](packages/prediction/README.md#検証ci)を追加。アプリ結合・採用基盤への整合・正式受入は未完了。Product画面・API・DB・公開環境は未実装。#70のBLOCKEDと正式Hard依存を維持する |
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

GitとPowerShell 7を使います。文書・設定チェックの手順は[開発ガイド](docs/DEVELOPMENT_GUIDE.md#13-初回セットアップ)を参照してください。基本構成の採用と認証・公開先の残条件は[Architecture](docs/architecture.md#technology-stack)で確認します。起動構成の復元・版固定・動作確認は実装Issueで行い、まだ完了していません。

導入済みの環境では、リポジトリのルートで `mise run --skip-tools check` を実行します。文書・設定を検査し、成功時は `PASS:` が表示されます。
miseがない場合は、PowerShell 7で `pwsh -NoProfile -File scripts/check-foundation.ps1` を実行すると同じ検証ができます。
Hook（コミット前に走る処理）の導入はローカル設定を変更するため、[初回セットアップ](docs/DEVELOPMENT_GUIDE.md#13-初回セットアップ)を読んで別に行います。

Prediction単体は[Docker検証手順](packages/prediction/DOCKER.md)で、hostにNodeを追加せず型検査・テスト・接続例・T-14を実行できます。Secret・DBは不要です。製品全体の起動構成やruntimeの採択とは分けます。

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
