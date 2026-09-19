# AI開発ワークフローガイド

この文書は、リポジトリにあるMCPとSkillsを日常の作業で使うための手順を示します。
採択・未採択の決定、導入状況の記録は[AI開発ツールガイド](../AI_DEVELOPMENT_TOOLS.md)が正本です。共通ルールは[AGENTS.md](../AGENTS.md)、Issue・Branch・PRの運用は[CONTRIBUTING.md](../CONTRIBUTING.md)を参照してください。

## 最初に確認すること

1. 対象Issueの目的、完了条件、Assignee、Scopeを確認します。
2. `git status`と`git branch`で、作業ツリーとBranchを確認します。
3. [AGENTS.md](../AGENTS.md)と、作業に関係する文書を読みます。
4. 利用するSkillが`.agents/skills/`に実在し、利用するMCPが現在のAI環境で利用可能かを確認します。

利用できないSkillやMCPは、存在するものとして扱いません。導入や認証に失敗した場合は、その事実をIssueまたはPRに記録し、勝手に代替ツールを追加しません。

## Skillsの導入と利用

### リポジトリにあるSkills

このリポジトリのSkillsは`.agents/skills/<skill名>/SKILL.md`としてGit管理されています。リポジトリをCloneし、作業するBranchを最新の`main`から作成すれば、追加のパッケージ導入なしに内容を確認できます。

作業前に、目的に合うSkillの`SKILL.md`だけを読みます。すべてのSkillを毎回読み込む必要はありません。Skillは作業手順であり、プロダクトや技術の採択判断を置き換えるものではありません。

| 作業 | 読むSkill | 主な使い方 |
| --- | --- | --- |
| Issueを実装してPRを作る | [issue-to-pr](../.agents/skills/issue-to-pr/SKILL.md) | Issue確認、実装、検証、PR作成の流れを確認する |
| 不具合を調査・修正する | [bug-investigation](../.agents/skills/bug-investigation/SKILL.md) | 症状、再現、原因仮説、根本原因、最小修正を分けて扱う |
| 重要な技術判断を検討・記録する | [architecture-decision](../.agents/skills/architecture-decision/SKILL.md) | 選択肢、根拠、影響を比較し、必要ならADRを残す |
| 機能や優先順位を変える | [scope-guard](../.agents/skills/scope-guard/SKILL.md) | Must / Should / Couldへの影響を整理する |
| 変更後の文書を確認する | [documentation-sync](../.agents/skills/documentation-sync/SKILL.md) | 正本への影響だけを確認し、重複を増やさない |
| PR作成前にセルフレビューする | [review-gate](../.agents/skills/review-gate/SKILL.md) | Issue、変更範囲、検証、文書を照合する |
| 他メンバーのPRをレビューする | [pr-review](../.agents/skills/pr-review/SKILL.md) | 指摘をBlocking / Should Fix / Optionalに分ける |

### Skillを追加・変更する場合

Skillの追加や変更は、単にローカルへ配置して終わりにしません。必要性をIssueで説明し、既存Skillで不足する理由を確認し、レビュー可能なBranchとPRで`.agents/skills/`へ追加します。未採択のSkillをチームの標準手順として文書化しません。

## MCPの導入と利用

MCPはAI環境ごとに設定される接続です。このリポジトリにはMCPを自動設定する設定ファイルがないため、導入コマンドや認証方法をリポジトリの標準手順として固定しません。

利用する環境で次を確認します。

1. 現在のAI環境のツール一覧に、利用したいMCPが表示されることを確認します。
2. MCP固有の認証や設定が必要な場合は、各環境の設定画面または公式手順で行います。トークン、APIキー、個人設定ファイルをGitへ追加しません。
3. 小さな読み取り操作で利用可否を確認します。利用できない場合は、実行したことにせず、理由を記録します。
4. 新しい常時MCPが必要になった場合は、先にIssueで必要性と影響を検討します。

現在の方針で使うMCPと手順は次のとおりです。

| MCP | 使う場面 | 利用手順 |
| --- | --- | --- |
| Serena | コードベースの構造、Symbol、参照、影響範囲を調べるとき | 対象ファイルと目的を絞り、Symbol・参照を確認してから変更範囲を決める。小さな文字列検索や単純な編集のためだけには使わない |
| Context7 | 外部ライブラリ、フレームワーク、SDK、CLI、クラウドサービスの現在の仕様を確認するとき | まず対象ライブラリを特定し、次に確認したい概念を一つに絞って公式ドキュメントを問い合わせる。バージョン依存のAPIを記憶だけで決めない |

SerenaとContext7以外のMCPを常時追加しません。GitHub操作は原則`gh` CLIを使い、利用できない場合はGitHub Web UIで代替します。UI・E2Eの確認は、UI実装後に導入状況を確認したうえでPlaywright CLI＋Skillを使います。GitHub MCPとPlaywright MCPは常時MCPに追加しません。詳細は[AI開発ツールガイド](../AI_DEVELOPMENT_TOOLS.md)を参照してください。

## タスクごとの進め方

### 通常のIssue実装

1. [issue-to-pr](../.agents/skills/issue-to-pr/SKILL.md)を読み、Issueの完了条件を確認します。
2. コードベースの参照関係を調べる必要があればSerenaを使います。
3. 外部仕様に依存する実装ならContext7で確認します。
4. 変更後に[documentation-sync](../.agents/skills/documentation-sync/SKILL.md)で正本への影響を確認します。
5. PR前に[review-gate](../.agents/skills/review-gate/SKILL.md)でセルフレビューし、Human Reviewを依頼します。

### 調査・判断・レビュー

- 不具合は、原因未確認のまま修正せず[bug-investigation](../.agents/skills/bug-investigation/SKILL.md)から始めます。
- 技術、DB、外部API、インフラ、アーキテクチャの判断は[architecture-decision](../.agents/skills/architecture-decision/SKILL.md)で比較し、チームの明示的な判断を待ちます。
- Scopeを増減する提案は[scope-guard](../.agents/skills/scope-guard/SKILL.md)でMustへの影響を確認します。
- 他メンバーのPRを確認するときは[pr-review](../.agents/skills/pr-review/SKILL.md)を使います。AIのセルフレビューや提案はHuman Reviewの代わりになりません。

## 記録すること

IssueまたはPRには、必要に応じて次を残します。

- 使用したSkillとMCP
- 外部仕様を確認した資料
- 実行した検証と結果
- 利用できなかったツールと代替した手段
- 未確認・未決定の事項

Secret、個人用トークン、認証情報、不要な内部情報をMCPやIssue、PRに含めません。
