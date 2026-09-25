# FE Implementation Guide

**Supporting Artifact / Not a Source of Truth**。正式仕様は[Product Spec](../product-spec.md)と[Architecture](../architecture.md)。以下は2026-09-25の実装準備であり、本番実装済みという意味ではない。

## 開発の入口

[D-09の詳細](decision-log.md)、[DI-FE-01〜03](design-intent.md)、[全体P0〜P4](../BE/implementation-guide.md#全体の実装順序)を確認する。React / TypeScript / Vite / TanStack Routerは採択済み。本番app、公開API、state/query library、UI library、フォーム方式、package managerは実装Issueで必要性から決める。

## 画面と状態

Userは3〜5曲のSeedを選び、推薦の理由を見て聴き、LIKE / NEUTRAL / DISLIKE / UNSUREを選ぶ。5有効InteractionでSummaryを確認し、発見曲を保存して探索を続けられる。GuestでCoreを完結し、Accountは必須にしない。詳しい操作条件は[User Flow](../product-spec.md#user-experience)を正本とする。

RouterはURLのpage/searchなど、componentは編集中の選択や表示、API Adapterはserver snapshot・pending/error・revisionを扱う。Preference更新・5曲計数・Probe配分・所有権はBEが決める。API成功と保存完了を確認するまでは「学習済み」と表示しない。

画面ごとにloading / empty / invalid / pending / retryable error / conflict / savedを区別する。候補不足は通常のDomain結果として説明し、UNDETERMINEDのSummaryも正常表示する。再送で画面を進め過ぎず、古い応答が新Stateを上書きしないようInteraction/State版を照合する。

## Player Adapter

YouTubeの準備完了と実際のPLAYINGを区別し、再生イベントをInteraction/Mappingへ紐付ける。autoplay拒否はUserの再生操作へ誘導する。失敗・未再生離脱・SkipからDISLIKEを生成しない。自動10〜15秒停止をCoreへ導入しない。遅延eventや動画切替時の処理はProduct O-01の決定と合わせる。実端末・地域・Referer・player表示は[EV-BE-08](../BE/evidence.md#ev-be-08)と実再生で確認する。

## 既存Code / Test Map

| 既存PoC | 役割 | 実装時の差分 |
| --- | --- | --- |
| [tanstack/main.tsx](../../experiments/stack-bakeoff/frontend/tanstack/main.tsx) | route tree、search validation、画面内error境界 | deep link/back/forwardと本番API integration |
| [shared/Screens.tsx](../../experiments/stack-bakeoff/frontend/shared/Screens.tsx) | 共通探索画面、error/retry表示 | 実Player、4値評価/正式計数、Summary、Save/継続のUI |
| [shared/api.ts](../../experiments/stack-bakeoff/frontend/shared/api.ts) | Mock/Live Adapter、localStorage Guest | Cookie資格情報・期限/CSRF方針、再取得/応答順序、正しい本番origin |
| [frontend.spec.ts](../../experiments/stack-bakeoff/tests/frontend.spec.ts) | 3候補共通E2E＋1pair integration | TanStack/Fastify実HTTP試験は未実施。旧skipを成功として扱わない |

## 優先する受入試験

- Seed 2/3/5/6件、同一録音、Feature欠損、検索empty/429/timeout。
- 連打、保存前失敗、commit後応答消失、reload、複数タブ、期限切れGuest、revision conflict。
- PLAYING / onReady / autoplay blocked / error / 遅延event、UNSURE計数、SaveでState不変。
- keyboard/focus、非色依存の評価・エラー表現、読み上げ可能なpending状態、mobile playerとSummary。最終端末/ブラウザmatrixはOPEN。

実装時のPlaywright導入状態・コマンドは[AI tools](../../AI_DEVELOPMENT_TOOLS.md)と対象packageで確認する。今あるPoC E2Eを製品のE2Eとして報告しない。UI変更はR-ID / Intentと対応させて試験し、外部Playerなど未確認範囲を残す。
