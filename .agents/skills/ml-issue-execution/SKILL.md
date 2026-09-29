---
name: ml-issue-execution
description: 旧音楽探索案のML Issue実行手順を参照するときに、当時のGoal contractと人間判断境界を確認する。
---

# ML Issue実行

> 音楽探索案は2026-09-29に廃止された。このSkill内のSeed・推薦・ML評価の条件は旧案の履歴であり、次のProductへ自動適用しない。[現行Product状態](../../../docs/product-spec.md#現行状態2026-09-29)と[引き継ぎの棚卸し](../../../docs/operations/reuse-handoff.md)を先に確認する。

このSkillはIssue単位のML作業に使用する。GitHub/Project操作とPR作成は[issue-to-pr](../issue-to-pr/SKILL.md)、文書同期は[documentation-sync](../documentation-sync/SKILL.md)、PR前のセルフレビューは[review-gate](../review-gate/SKILL.md)に従う。

## Goal contract

実装前にIssueの目的・完了条件・Scope・Assignee・依存関係と、[Product Spec](../../../docs/product-spec.md)、[Architecture](../../../docs/architecture.md)、[ML Design Intent](../../../docs/ML/design-intent.md)、[Evaluation](../../../docs/ML/evaluation.md)を照合する。変更する責務、不変条件、境界値、失敗時、評価方法、変更しない領域を短く記録する。OPENやRECOMMENDEDを決定済みにしない。

現行PoCと本番実装を区別する。Seed/Recording/Mapping、推薦時のAnchor/Context/版、Feedbackのcanonical観測、Hypothesis/Traceの整合を関連するIssueで確認する。データ権利・実Playback・Product価値は合成fixture成功から推定しない。

## 実装と評価

Issue達成に必要な最小変更を行う。既存テストに加え、Issueに該当するcorrectness、regression、cold start、sparse feedback、exploration/exploitation、personalization、diversity、determinism、numerical stability、data leakage、latency、explainabilityの評価を選ぶ。評価条件、分母、乱数seed、版、失敗例と未検証範囲を残す。評価スクリプトがなければ必要なものだけ追加する。実行していない評価は成功と書かない。

Product仕様、推薦方式・Algorithm、API/DB契約、Architecture、Scope、合格閾値を変更する必要が生じたら実装を止め、Problem、Evidence、Options、Recommendation、Trade-offs、Required decisionをIssueに記録して人間判断を待つ。

## 完了

変更を仕様、Design Intent、Evidence、Tests、変更対応表と照合する。別のCodex実行によるread-onlyレビューの指摘を確認し、必要な修正と再検証を行う。レビューPASSは人間のApproveや実User/実Catalog検証の代わりにならない。
