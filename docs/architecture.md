# ArchitectureとTechnology Stack

## 現行状態（2026-09-30）

音楽探索案は[Product P-10](product-spec.md#p-10-音楽探索案の廃止)で廃止した。**次のProductに適用するArchitecture、開発用Toolchain、Framework、Database、認証、Secret管理、外部Service、推薦方式、Deployment先は未決定。** 旧案の設計・比較結果と旧起動構成は[保管場所](../archive/music-exploration/README.md)へ移した。新案の採択根拠にはしない。

### D-17 音楽案に依存したArchitectureの適用終了

2026-09-29 / **DECIDED（依頼者判断に伴う適用範囲変更）** / 旧案のD-08〜D-14・D-16、A-01〜A-07を次のProductへ自動適用しない。新しい課題と必要機能が未定のため。旧判断、実験、未検証事項は[履歴](../archive/music-exploration/docs/architecture.md#architecture-decision-log)として保持し、次案の要件が決まってから必要性を再評価する。[整理Issue #67](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/67)。

## 旧開発用Toolchainの扱い

### D-15

2026-09-27 / **SUPERSEDED by D-18** / Node 24 LTSとnpmを当時の開発Toolchainに採用した。[当時の判断理由](../archive/music-exploration/docs/architecture.md#d-15) / [Issue #49](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/49)。

### D-18 旧開発スタックの一時退避

2026-09-30 / **DECIDED（依頼者判断）** / [整理Issue #67](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/67)。

- **Context:** 音楽案の廃止後、次のProductの課題・要件が未定のまま旧Web/API・DB・Toolchainを現行の起動構成として案内していた。
- **Decision:** Node/npm・React/Vite・Fastify・PostgreSQLの旧起動構成、Compose、Application CI、当時の設定と手順を[履歴](../archive/music-exploration/README.md)へ一時退避する。共通の文書チェックとGit運用は現行のまま維持する。次の技術スタックは別途検討する。
- **Alternatives:** 旧構成を現行のまま残す、直ちに削除する、履歴として退避する。
- **Reason:** 旧構成を新案へ暗黙に適用せず、再利用価値と過去の検証範囲を後から確認できるようにするため。削除の要否は新案の技術判断後に決める。
- **Consequences:** ルートからアプリ起動・型検査・ビルドのコマンドとApplication CIがなくなる。履歴内の構成は新案の仕様・採択・現在のCI保証ではない。再採用時は要件、代替案、保守・運用・検証コストを別Issueで判断する。

## Architecture Decision Log

| ID | 日付 | 状態 | 判断 |
| --- | --- | --- | --- |
| D-15 | 2026-09-27 | SUPERSEDED by D-18 | 当時の[Node 24 LTS / npm](#d-15)採択 |
| D-17 | 2026-09-29 | DECIDED | [旧音楽案向け設計の適用終了](#d-17-音楽案に依存したarchitectureの適用終了) |
| D-18 | 2026-09-30 | DECIDED | [旧開発スタックを一時退避](#d-18-旧開発スタックの一時退避)し、次の採択を未定にする |

旧D-01〜D-14・D-16と比較・代替案は[旧Architecture Decision Log](../archive/music-exploration/docs/architecture.md#architecture-decision-log)に保管する。次案で重要な技術判断が必要になった場合は、対象要件とEvidenceを確認し、ここに新しいDecisionを記録する。
