# FE Design Intent

**Supporting Artifact / Not a Source of Truth**。正式決定は[Product Spec](../product-spec.md)と[Architecture](../architecture.md)。本書は2026-09-25、Issue #36の判断理由・実装支援を記録する。本番実装済みを意味しない。

以下はレビュー可能な設計理由であり、AIのprivate chain-of-thoughtではない。

## DI-FE-01

**Server Preference StateをFEの正本にしない**

- ID / Title: DI-FE-01 / Server Preference StateをFEの正本にしない
- Context: reload、複数タブ、応答消失で表示と保存状態がずれる。
- Intent: 最後に保存が確認できた状態を示す。
- Design: API応答のState版と確定Interactionを表示用snapshotとして保持し、再取得で照合。入力中/送信中/失敗/保存済みを分ける。
- Why: Browser側の独自Posterior更新はserverと異なる履歴を作る。
- Invariants: commit成功前に推薦確定・学習完了と表示しない。SaveでPosteriorを変えない。
- Non-Goals: offline学習、client authoritative state。
- Alternatives Considered: 楽観的確定表示、localStorageを唯一のDBにする方式。
- Trade-offs: 再取得とpending表示が必要。
- Failure / Risk: 古い応答が新しい表示を上書きする、期限切れGuestを復元済みと誤表示。
- Change Guidance: APIのrevision/版契約とGuest復旧方針を先に確認。PoCのlocalStorage tokenは公開構成へ持ち込まない。
- Related Requirements: R-05 / R-07 / R-10 / R-16 / R-17
- Related Decisions: D-09 / D-13 / P-08
- Evidence: [EV-FE-01](evidence.md#ev-fe-01) / [EV-BE-01](../BE/evidence.md#ev-be-01)
- Code Map: [Screens](../../experiments/stack-bakeoff/frontend/shared/Screens.tsx)、[API](../../experiments/stack-bakeoff/frontend/shared/api.ts)。本番未実装。
- Tests: [frontend.spec.ts](../../experiments/stack-bakeoff/tests/frontend.spec.ts)のreload/破損GuestはPoC。応答逆転・Cookie expiry・Save/継続は本番受入試験待ち。

## DI-FE-02

**Router StateとDomain Stateの境界**

- ID / Title: DI-FE-02 / Router StateとDomain Stateの境界
- Context: 検索条件やnavigationが画面に散らばり得る。
- Intent: 共有可能なURL状態を検証付きで扱う。
- Design: Routerはpage/search/filter等の表現、APIは所有権/Feedback/Preferenceの正本。route contextに依存を渡しても認可判断はBEへ残す。
- Why: URLを変更できることとDomainを書き換えられることを分ける。
- Invariants: URLにGuest secret・Posterior・未検証入力を永続契約として載せない。
- Non-Goals: Routerへ推薦ロジックを組み込む。
- Alternatives Considered: 手動URL parsing、すべてcomponent state。
- Trade-offs: route型・validation・error境界の保守が必要。
- Failure / Risk: invalid search、deep link、back/forwardで古い結果が残る。
- Change Guidance: 型の変更に加えてruntime validationと履歴操作、error復旧を確認する。
- Related Requirements: R-01 / R-10 / E-05
- Related Decisions: D-09
- Evidence: [EV-FE-02](evidence.md#ev-fe-02) / [EV-FE-01](evidence.md#ev-fe-01)
- Code Map: [TanStack main](../../experiments/stack-bakeoff/frontend/tanstack/main.tsx)のvalidateSearchとroute内Boundary。
- Tests: 共通E2Eのrender-error。typed search複雑ケース・deep linkは未整備。

## DI-FE-03

**PlaybackとRatingを別イベントにする**

- ID / Title: DI-FE-03 / PlaybackとRatingを別イベントにする
- Context: Player errorとユーザーの嫌いを混同すると学習が壊れる。
- Intent: 再生の事実と明示意思を独立して伝える。
- Design: Player AdapterがInteraction/Mappingに紐づく開始・失敗を渡す。評価受付とcheckpoint判定はBE。1曲ごとの送信状態を表示する。
- Why: UNSURE、Skip、失敗は異なる意味を持つ。
- Invariants: 失敗からDISLIKEを生成しない。再生開始＋受理済み評価のみ計数。
- Non-Goals: 自動短時間停止、YouTube音声抽出。
- Alternatives Considered: errorを低評価、onReadyをPLAYBACK_STARTEDとみなす方式。
- Trade-offs: 遅延イベントと復旧のUIが必要。
- Failure / Risk: 別動画/前Interactionのイベント、autoplay拒否。
- Change Guidance: 再生event識別、遅延failureのO-01、Mapping失効をBEと合意。Player controls/Referer要件を確認。
- Related Requirements: R-04 / R-08 / R-15
- Related Decisions: P-04 / P-06 / D-09
- Evidence: [EV-BE-08](../BE/evidence.md#ev-be-08) / [EV-FE-01](evidence.md#ev-fe-01)
- Code Map: [Screens](../../experiments/stack-bakeoff/frontend/shared/Screens.tsx)はMockのみ。実IFrame Adapterなし。
- Tests: PoCはfailure表示。実IFrame PLAYING/error/autoplay/遅延/端末試験は未実施。
