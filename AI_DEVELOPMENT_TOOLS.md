# AI開発ツールガイド

この文書は、Issue #10とIssue #28で整理したツール利用方針の正本です。共通の開発ルールは [CONTRIBUTING](CONTRIBUTING.md) を参照してください。

## 採択済みの運用方針

2026-09-19に採択した3点のうち、GitHub操作の基本手段は2026-09-23の明示決定（Issue #28）でAIエージェント向けに変更しました。Playwrightとdocumentation-syncの方針は維持します。
採択方針と各環境への導入・設定状況は分けて管理します。

| 対象 | 決定 | 理由・適用範囲 |
| --- | --- | --- |
| GitHub MCP | AIエージェントによるIssue・GitHub Projects・Pull Request操作の基本手段とする。接続・認証・権限を確認し、利用できない場合はGitHub Web UIで代替する | チケットを起点にIssueとProjectの状態を直接確認・更新できる。ローカルのBranch・Commit・Pushは引き続き`git`を使う。人間の操作手段は強制しない |
| Playwright | ブラウザ操作・E2E確認に **CLI＋Skill** を利用する。Playwright MCPは常時MCPに追加しない | 検証方法の方針を明確にする。CLI・対応Skillの導入、設定、E2E整備はUI実装時に行い、変更に応じて実ブラウザで確認する |
| documentation-sync | 既存Skillを今回正式に採択する | 変更に関係する文書の整合を確認し、必要な正本だけ更新する。毎回すべての文書の更新を要求しない |

GitHub MCPの採択は全メンバーの接続完了を意味しません。接続できない環境ではGitHub Web UIを使い、Issueを確認・作成できないまま変更を始めません。個人のMCP設定や認証情報をリポジトリに含めず、同じ操作を複数の経路で重複実行しません。PlaywrightのCLI・対応Skillの導入状況は利用前に確認し、未配置のSkillを存在するものとして扱わないでください。
documentation-syncは既存ファイルと利用ルールを確認したうえで、今回の承認を正式採択の根拠とします。


## 利用前の確認

- GitHub MCP：利用前にツールの公開、認証、対象リポジトリとProjectへの権限を確認する。未接続・権限不足は未確認として扱う。
- Playwright：この変更ではCLIやSkillの導入・設定、E2E整備を行わない。リポジトリ内にPlaywright専用Skill・設定はなく、各環境の導入状況は利用前に確認する。
- [documentation-sync](.agents/skills/documentation-sync/SKILL.md)：既存Skillを確認済み。今回の正式採択を記録し、変更に関係する正本への影響だけを確認する。

関連Issue：[旧`gh`方針 #10](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/10)、[GitHub MCPへの切り替え #28](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/28)

## リポジトリで確認できる導入状況

この表は2026-09-19の監査記録を基に、GitHub MCPについて2026-09-23の確認結果を追記したものです。全メンバーのPCへの導入を保証するものではありません。

| 対象 | 確認結果 | 制約・未検証事項 |
| --- | --- | --- |
| Git | ローカルで実行可能 | GitHubへのpush・認証は環境ごとに確認する |
| GitHub MCP | 2026-09-23、KaitoのWindows CodexでIssueの読み取り・作成・更新と非公開Projectの読み取り・Status/Scope更新を確認 | 個人環境での確認。全メンバーの接続・権限と将来の稼働は未確認。Secret実値や個人設定はGit管理しない |
| GitHub CLI（gh） | 2026-09-23、この作業環境のPATH上では見つからない | Issue #10で採択した旧方針の手段。AI向けの基本手段はIssue #28でGitHub MCPに変更 |
| Context7 MCP | ライブラリ仕様を確認するための接続先として利用可能 | 接続設定は各AIクライアントで確認する |
| Serena MCP | コードベース探索用の接続先として利用可能 | 対象言語のバックエンドやシンボル探索の範囲は技術スタック決定後に確認する |
| Playwright CLI＋Skill | リポジトリ内に専用設定・Skillはまだない | 方針は採択済み。UI実装時にCLI・Skill・E2E環境を確認する |

未導入のツールを導入済みと扱いません。接続できない場合は未確認と記録し、無断でインストールやリポジトリ設定の追加を行わないでください。

## リポジトリに配置されたSkills

以下のSkillはこのリポジトリに配置されています。利用時はそれぞれのSKILL.md本文を読み、目的に合うものだけを使います。

| Skill | 主な用途 |
| --- | --- |
| [issue-to-pr](.agents/skills/issue-to-pr/SKILL.md) | Issue確認からBranch、実装、検証、Pull Request作成まで |
| [bug-investigation](.agents/skills/bug-investigation/SKILL.md) | 不具合の再現、原因検証、最小修正 |
| [documentation-sync](.agents/skills/documentation-sync/SKILL.md) | 機能仕様の執筆、変更前・変更時・完了前の正本・実装・説明の整合確認 |
| [review-gate](.agents/skills/review-gate/SKILL.md) | Pull Request作成前のセルフレビュー |
| [pr-review](.agents/skills/pr-review/SKILL.md) | 他メンバーのPull Requestレビュー |
| [architecture-decision](.agents/skills/architecture-decision/SKILL.md) | 技術・設計の比較と判断材料の整理 |
| [scope-guard](.agents/skills/scope-guard/SKILL.md) | 機能追加・削除・優先順位変更の影響整理 |

Skillの存在は、各ワークフローが実行済みであることや、技術・プロダクトの採択を意味しません。
