# ADR-0001: プロダクト未確定段階の開発基盤

状態: 採用方針を記録。導入・接続完了の宣言ではない。
根拠: 2026-09-20の整備依頼と参照HTML。既存決定との相違は[状態表](../operations/development-foundation-status.md#資料との相違点)で保留する。

## Context

3人・2026-09-19〜2026-10-12の開発で、環境差、Secret共有、仕様の重複とレビュー漏れを減らす。
アプリの技術スタックは未定であり、HTMLの例示を実行設定に転記すると未決定の技術を採用してしまう。

## Decision

- 既存GitHub Flow、Issue区分、別メンバーのApprove最低1件、Squash Mergeを維持する。
- miseで共通タスクと採用確認済みCLIを管理する。アプリのRuntime・Package Managerは選定後に追加する。
- Secretの正本はDoppler。`.env.example`は確認済みキーと説明のみ。現時点のアプリキーは0件。
- Docker ComposeはDB・依存サービス決定後、Formatter・Linter・アプリテストはスタック・実装に合わせて導入する。
- 現段階のCIは文書・設定の実検証に限定し、Secretを渡さない。Git Hookはステージ済み差分の空白検査のみ。
- 情報の役割分担は[CONTRIBUTING](../../CONTRIBUTING.md#ドキュメントと技術判断)に集約する。

## Alternatives

手動`.env`共有、Infisical、dotenvxはDopplerと責務が重複するため採用しない。
Jira / Confluence / Notion、CODEOWNERS、Dev ContainerはHTMLの見送りを維持する。
NodeやDBを仮決めして完成形CIを先に置く方法は、未決定事項の固定と動かないチェックを招くため選ばない。

## Reason

資料で採用済みの基盤を小さく実装し、アプリに依存する箇所は明示的な決定後に補うことで、導入コストと手戻りを抑える。
PowerShell 7による検証は既存PCとGitHub-hosted runnerで使える補助スクリプトであり、アプリの技術選定ではない。

## Consequences

文書リンク、文字コード、Secret例の形式、除外設定、差分の空白を再検証できる。
アプリの正しさ、全Secretの検出、外部共有権限や保護設定の適用までは保証しない。
DopplerのProject・Config確定とメンバーのログインが必要。条件付きツールは[状態表](../operations/development-foundation-status.md)の導入条件を満たすまで追加しない。
HTMLと既存運用が異なるBoard列・WIP・フィールド・Issue分類は、資料の日付だけで上書きしない。
