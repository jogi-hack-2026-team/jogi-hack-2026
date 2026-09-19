# AI開発ツールガイド

この文書は、Issue #10で整理したツール利用方針の正本です。共通の開発ルールは [CONTRIBUTING](CONTRIBUTING.md) を参照してください。日常的な導入・利用手順は[AI開発ワークフローガイド](docs/AI_WORKFLOW_GUIDE.md)を参照してください。

## 採択済みの運用方針

2026-09-19、以下の3点はユーザーの明示承認により **ADOPTED（採択済み）** とし、該当するDecision Conflictを解消しました。
採択方針と各環境への導入・設定状況は分けて管理します。

| 対象 | 決定 | 理由・適用範囲 |
| --- | --- | --- |
| GitHub CLI（gh） | GitHub操作の基本手段とする。未導入・認証不可などで利用できない場合はGitHub Web UIで代替する | 操作手段を揃えつつ、環境差で作業が止まることを避ける。ローカルのブランチ・コミット操作は引き続きgitを使う |
| Playwright | ブラウザ操作・E2E確認に **CLI＋Skill** を利用する。Playwright MCPは常時MCPに追加しない | 検証方法の方針を明確にする。CLI・対応Skillの導入、設定、E2E整備はUI実装時に行い、変更に応じて実ブラウザで確認する |
| documentation-sync | 既存Skillを今回正式に採択する | 変更に関係する文書の整合を確認し、必要な正本だけ更新する。毎回すべての文書の更新を要求しない |

`gh`やPlaywrightの未導入は採択保留を意味しません。PlaywrightのCLI・対応Skillの導入状況は利用前に確認し、未配置のSkillを存在するものとして扱わないでください。
documentation-syncは既存ファイルと利用ルールを確認したうえで、今回の承認を正式採択の根拠とします。


## リポジトリで確認できる導入状況

- `gh`：利用前に各環境で導入・認証状況を確認する。未導入でも採択保留にはしない。
- Playwright：この変更ではCLIやSkillの導入・設定、E2E整備を行わない。リポジトリ内にPlaywright専用Skill・設定はなく、各環境の導入状況は利用前に確認する。
- [documentation-sync](.agents/skills/documentation-sync/SKILL.md)：既存Skillを確認済み。今回の正式採択を記録し、変更に関係する正本への影響だけを確認する。

関連Issue：[採択方針と文書の整合 #10](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/10)
