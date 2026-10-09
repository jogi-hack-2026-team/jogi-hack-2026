# #180 文書構成と履歴保存の整理記録

Supporting Artifact / Not a Source of Truth

対象は[#180](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/180)。基準mainは2026-10-09の`10c1df734b6a8a2ba031a45f6c7b70af16e4c38e`（#176統合済み）。製品仕様・API・型・DB・予測・migration・workflowの挙動は変更しない。

## 内容の棚卸しと移動対応

| 元の範囲 | 保存・整理先 | 保存する内容と残す境界 |
| --- | --- | --- |
| Productの[初期質問のレビュー用たたき台](../product-spec.md#初期質問のレビュー用たたき台)の本文 | [#107の保存記録](issue-107-initial-question-draft.md#移動した記録) | 導入文・質問と選択肢・弱い観測という限界・追加経験分岐の未採択・負担軽減案・未回答Plan案・6つのレビュー観点を全文保存。R-11の現行契約・受入案・P番号は元の正本に残す |
| Architectureの[2026-10-03の技術構成合意](../architecture.md#2026-10-03の技術構成合意)の冒頭〜条件付き候補表 | [#84の保存記録](issue-84-stack-agreement.md#移動した記録) | 採用構成と理由、当時の残件・着手制約、Better Auth／Cloud Run＋Neonの当時の条件を全文保存。後日のVercel更新・API契約境界・合意の出所は元の節に残す |
| documentation-syncの変更前〜報告項目 | [CONTRIBUTINGの執筆・保守手順](../../CONTRIBUTING.md#文書を書く手順) | 記載項目、例・コマンド、状態・例外・権限・実装経路、理由・Evidence、同期、完了前確認、原則、報告内容を移動。Skillの旧見出しは共通手順への入口として維持する |
| change-mapの履歴・実測結果・コードtrace・用語・確認方法 | 元の[change-map](../change-map.md) | 一括移動しない。保存と表示・409再取得・UNKNOWN/SKIP・計算境界の説明、既存の検証成功／失敗／未実施を維持。現在地の基準SHAと#147の統合済み表記を訂正する |
| README・AGENTS・開発ガイド・PR template・CONTRIBUTING | 元の各入口 | 文書運用の参照先をCONTRIBUTINGへ統一。READMEの基本構成合意当時の未確定事項と、後日の版固定を区別する |

Product／Architectureの旧見出し・P/D IDと順序を保持した。詳細を要約して削除せず、元の実見出しから全文へ案内する。外部参照・同一文書内リンクを含む相対リンクは、元と同じ対象を指すよう移動先からの相対パスへ変換する。

P-14の当時の「担当不足・未実装・契約未決」は原文を残し、基準mainの`recordStartDate`返却とフォーム参照を上段で区別した。Architectureの#76時点のDTO表も残し、後日の`progressDone`追加を現契約のコード・API節へつないだ。保存した古い説明を現在の未実装・未採択と誤読させないための注記で、仕様の再採択ではない。

## 今回分割するもの・分割しないもの

Productは目的・Scope、Goal／記録／画面、R-11の読む・更新する単位を表に整理した。Architectureは構成／起動、Auth／Goal／記録、予測／テスト、公開／デモの順路を整理した。正式仕様は従来どおり2正本で、今回の新しいファイルはSupporting記録。

機能別の現行契約本文を別ファイルへ出すことは今回見送る。#159・#164はAuth、#163はGoal／時間量、#175は量・設定版・API／DB契約、#173は予測runtimeとD-28を編集中で、移動により進行中の契約変更との競合が広がるため。これらの変更がmainに統合され、各節の反復編集がなお課題となった時に、R/P/D ID・旧見出し・全文対応を維持する機能単位の分割と、2正本の配置規則の変更を一緒にレビューする。履歴分離だけで現在の誤説明を放置する判断ではない。

## 開いているPRとの境界

確認時の文書差分は#159（`d1e34ec`）、#163（`0e8e617`）、#164（`a782756`）、#172（`afab1a6`）、#173（`041bd61`、baseは#172のbranch）、#175（`ffe7604`）。#172の実測追記と#173の採択案を自動で履歴扱いにせず、既存PRは変更しない。#175が編集するArchitectureのAPI契約境界段落と前後の文脈を保持した。#176の動的migration検査も変更しない。

最終の取得時には#159が`9468372`へ進んでいたため、初回確認との差分も精査した。#178（`0bc5a30`）はPredictionのコメント変更だけで文書差分はない。実際の競合検査対象SHAと結果はIssue/PRへ記録する。

将来の追加実測・草稿・移行結果は[履歴の配置規則](../../CONTRIBUTING.md#履歴の配置と移動)に従い、Issue単位で追加できる。現行のAuth・API契約・コード経路が変わる場合は正本・対応表の該当箇所を更新する。競合が皆無になる保証ではない。

## 機械確認と読む経路

移動の原文範囲・移動先・見出し変換は[manifest](issue-180-documentation-layout.migration.json)。リポジトリrootで次を実行する。基準commitがローカルに必要で、Secret・DB・ネットワークは不要。

```powershell
pwsh -NoProfile -File scripts/check-doc-migration.ps1 -Manifest docs/changes/issue-180-documentation-layout.migration.json
pwsh -NoProfile -File scripts/test-doc-migration.ps1
pwsh -NoProfile -File scripts/check-foundation.ps1
```

最初のコマンドは3つの移動範囲の全文・リンク変換、旧見出しの識別と順、Product／Architectureの移動しない非空行の保持を検査する。2つ目は独立した一時Git fixtureで全文欠落・誤リンク先・現行本文欠落・重複見出し順変更・HTML別名への置換を拒否し、復元後の成功を確認する。最後は既存方式でローカルリンク先・見出し・文書形式を検査する。manifestはこの移動時点の証明で、将来の本文更新を禁止する常設CIゲートではない。

変更依頼からは[change-mapの機能表](../change-map.md#アプリの仕様と実装) → ProductのR番号／Architectureの契約 → 同表の実コード → テスト入口へ進む。過去の質問案はProductの旧見出しから#107、基本構成の理由・残件はArchitectureの旧見出しから#84へ進む。既存のAPI／Prediction／起動の実測は各節のoperations・experimentsへの参照を保ち、今回の記録へ複製しない。

実行結果・失敗ケース・差分レビュー・最終HEADとCIは対象Issue/PRへ記録する。実人の読解試験・理解速度の評価、今回のローカルアプリ・実DB・ブラウザ/E2E・公開受入は未実施。文書とリンクの検査成功をそれらの完了とは扱わない。
