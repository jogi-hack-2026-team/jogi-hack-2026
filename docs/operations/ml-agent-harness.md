# ML Issue向けCodex Agent Harness

**開発補助 / Product・Architectureの正本ではない。** [Issue #47](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/47)の範囲。Code Freezeは2026-10-12。Harnessの整備をMust実装より優先しない。

## 2026-09-27の棚卸し

Issue #47起票前にGitHub MCPでopen Issue全14件、ProjectのStatus/Scope、ラベル8種類を確認した。ML Issueはタイトルの `[ML]` で識別できる。既存の `investigation`、`blocked`、`needs-discussion` を使い、新ラベルは追加しない。ProjectにPriority列はなく、優先範囲はScope列のMust / Should / Couldを使う。親Issue #23は作業を束ねるもので、完了を全子Issueの着手条件とはしない。

| Issue | Project Status / Scope | 明示された前提・判断 | 現時点の実行 |
| --- | --- | --- | --- |
| [#38](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/38) 利用条件 | In progress / Must | 権利・保存・ML用途の確認 | 既に作業中 |
| [#39](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/39) 実Catalog | Ready / Must | #38、測定条件の人間設定 | Blocked |
| [#40](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/40) 合成評価 | In progress / Must | 校正値の最終判断は人間 | 既に作業中 |
| [#41](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/41) Feature Reference | Ready / Must | #38、tie規約・版移行の着手前Decision | Blocked |
| [#42](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/42) LinTS更新 | Ready / Must | #41 | Blocked |
| [#43](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/43) 候補選択 | Ready / Must | #41、#42、実録音受入#39、校正#40 | Blocked |
| [#44](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/44) 仮説・理由 | Ready / Must | #40、#42、#43、ROPE等の校正判断 | Blocked |

本文に「合成fixtureなら先行可能」とある場合も、Issue全体のPRをDoneへ進めるには未決の受入条件を解消する。部分的な作業の切り出しは人間がIssueを分ける。ProjectのReady表示だけでは着手しない。現時点でHarnessが自動選択すべきIssueは0件。

## 選択と停止の規則

`node scripts/run-ml-agent.mjs` は毎回GitHubからIssue、Project、PR、Issue dependencies、sub-issuesを取得する。openかつ `[ML]` または `ml` ラベルのIssueに限り、PRを除外する。本文の「前提」「依存」、GitHubのblocked-by、未完了sub-issueを依存辺として合成する。親Issueは依存辺にしない。不明な参照先や取得失敗は通過させない。

StatusがReady、Scopeが設定済み、現在のGitHub利用者がAssignee、前提Issueが完了、既存PRがないことを要求する。`blocked` / `needs-discussion` と明確な着手前Decisionは除外する。Must → Should → Could、同Scope内は依存グラフ上の下流Issue数が多い順、最後はIssue番号の昇順で決める。番号順を主規則にしない。毎PR後と判断待ち停止後に再取得する。

人間判断が必要な場合、IssueへProblem / Evidence / Options / Recommendation / Trade-offs / Required decisionを記録し、既存の `needs-discussion` とProject Backlogで止める。独立IssueがReadyならキューを続ける。自動Mergeは行わない。ML Issueがすべてcloseした場合だけread-onlyの統合監査を実行し、発見事項はIssue候補として出す。

## 構成と操作

Node.js標準機能の[runner](../../scripts/run-ml-agent.mjs)と[選択規則](../../scripts/ml-agent-core.mjs)、[ML Skill](../../.agents/skills/ml-issue-execution/SKILL.md)を使用する。Codex SDK、独自サーバー、常駐サービス、新しいProduct dependencyは使わない。通常のAI操作ではGitHub MCP優先とし、このHarnessのバッチ処理ではユーザー指定の `gh` を使う。

前提はNode.js、認証済みGitHub CLI（Issue・Project・PRの読み書き権限）、認証済みCodex CLI、Git、PowerShell、対象packageの既存依存をインストール済みであること。SecretをHarnessへ渡さない。通常実行はmainのcheckoutから行い、Code Freeze開始後は自動編集を拒否する。`mise run ml-agent` はこのTask専用に固定したGitHub CLIをPATHへ追加する。初回は以下のコマンドでTask専用ツールを導入し、GitHub CLIを認証する。GitHub Projectの読み書きには`project` scopeが必要。このWindows環境では2026-09-27に`gh` 2.101.0とCodex CLI、Nodeを確認し、実GitHubキューの`--dry-run`を実行した。ReadyなML Issueは0件であり、Issue実装からPR作成までの通し実行は未検証。

Codex CLIはこの環境で実行できた`gpt-5.5`を既定で指定する。利用可能なモデルが異なる場合は実行前に`ML_AGENT_CODEX_MODEL`環境変数で上書きする。

```powershell
mise install --include-task-tools
mise exec gh@2.101.0 -- gh auth login --hostname github.com --git-protocol https --web --scopes project
mise exec gh@2.101.0 -- gh auth status

mise run ml-agent --dry-run
mise run ml-agent
```

`--dry-run` は候補と除外理由を表示する。通常実行はReady Issueのキューを連続処理する。`--once` は1件で停止する。初期同時実行数は1。Issueごとに `.worktrees/ml-<number>` と番号付き `feat/` または `chore/` Branchを分離し、後から2並列のスケジューラへ拡張できる。現時点で2並列は有効化しない。

各Issueはread-only Goal contract → 実装 → Foundation・HarnessのNodeテスト・変更packageの既存test/lint/typecheck/build/eval → 別Codex実行のread-only構造化Review → 最大3回のRepair/再検証 → 日本語タイトルのPRを進める。Harness本体に変更があればrunnerの構文も検査する。検証前とPR作成前に最新の`origin/main`を取得し、更新があれば作業Branchへ取り込んで検証とReviewをやり直す。競合や未Commit変更があれば停止する。Issue固有のML評価はGoal contractと実装報告に記録し、Reviewerが妥当性を検査する。未実行の評価をPASSにしない。PR本文には実施結果、未検証項目、文書への影響、レビュー観点、リポジトリのチェックリストを記載する。CIは既存Foundation workflowがPRで実行される。アプリ本体と正式な評価スクリプトはまだ整備中であり、存在しないcommandを成功扱いにしない。

## 実行状態と復旧

状態、Codex最終応答、PR本文はGit管理外の `.codex/ml-agent/` に保存する。段階はselected / planned / implemented / reviewed / pr_created / decision。既存worktreeとBranchを再利用する。PRの有無は再起動時にGitHubを正として再照合する。実行中の二重起動はlockファイルで拒否する。

失敗時は原因を直して同じコマンドを再実行する。通信・権限・CLI欠落は変更を進めず停止する。Codexまたは検証の失敗時は保存段階から再開する。lockが残った場合、対象PIDのプロセス停止を確認してから `.codex/ml-agent/lock` だけを手動で取り除く。worktreeとBranchは自動削除しない。PR作成前にpush済みとなっても再実行時のPR照合で重複を避ける。判断待ちが解消されたIssueはラベルを外してReadyへ戻し、次回のGoal contractから再確認する。

Project/Issue更新が失敗した場合は先へ進めない。レビューPASSは人間のPR承認や実Catalog・実Playback・実Userの検証を代替しない。詳細な設計判断は[AI開発ツールガイド](../../AI_DEVELOPMENT_TOOLS.md)と対象Issue/PRへ残す。
