# ArchitectureとTechnology Stack

## 現行状態（2026-09-29）

音楽探索案は[Product P-10](product-spec.md#p-10-音楽探索案の廃止)で廃止した。**次のProductに適用するArchitecture、Framework、Database、認証、外部Service、推薦方式、Deployment先は未決定。** 旧案のD-08〜D-14・D-16、A-01〜A-07、比較結果は[旧Architecture](../archive/music-exploration/docs/architecture.md)へ保管した。新案の採択根拠にはしない。

### D-17 音楽案に依存したArchitectureの適用終了

2026-09-29 / **DECIDED（依頼者判断に伴う適用範囲変更）** / 旧案のD-08〜D-14・D-16、A-01〜A-07を次のProductへ自動適用しない。新しい課題と必要機能が未定のため。旧判断、実験、未検証事項は[履歴](../archive/music-exploration/docs/architecture.md#architecture-decision-log)として保持し、次案の要件が決まってから必要性を再評価する。[整理Issue #67](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/67)。

## 開発用Toolchain

### D-15

2026-09-27 / **DECIDED** / Node 24 LTSとnpmをこのリポジトリの開発Toolchainに採用した。miseでNode 24.21.0を固定している。これは次のProduct向けFramework・DB・配置先の採択ではない。[当時の判断理由](../archive/music-exploration/docs/architecture.md#d-15) / [Issue #49](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/49)。

React / ViteのWeb、FastifyのAPI、開発用PostgreSQLの起動構成は存在するが、次のProductへの再利用は未決定。[基盤の状態](operations/development-foundation-status.md)と[引き継ぎ](operations/reuse-handoff.md)に実装・検証済みの範囲を分けて記録する。

## Architecture Decision Log

| ID | 日付 | 状態 | 判断 |
| --- | --- | --- | --- |
| D-15 | 2026-09-27 | DECIDED（開発用Toolchain） | [Node 24 LTS / npm](#d-15)を継続 |
| D-17 | 2026-09-29 | DECIDED | [旧音楽案向け設計の適用終了](#d-17-音楽案に依存したarchitectureの適用終了) |

旧D-01〜D-14・D-16と比較・代替案は[旧Architecture Decision Log](../archive/music-exploration/docs/architecture.md#architecture-decision-log)に保管する。次案で重要な技術判断が必要になった場合は、対象要件とEvidenceを確認し、ここに新しいDecisionを記録する。
