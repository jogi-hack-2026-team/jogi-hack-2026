# 画面・操作案の比較（Issue #45）

**Supporting Artifact / Not a Source of Truth**。[Issue #45](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/45)で、音楽探索のCore体験について2〜3の画面・操作案を同じ条件で比較するための資料。どの案も採択していない。正式仕様は[Product Spec](../../docs/product-spec.md)と[Architecture](../../docs/architecture.md)。

## 中身

| ファイル | 内容 |
| --- | --- |
| [comparison.md](comparison.md) | 共通条件、3案の比較、推奨案・弱点・未確認事項、FE/BE間で決める項目、チームへの判断依頼 |
| [mockups.html](mockups.html) | 比較用ワイヤーフレーム。案・操作ステップ・失敗状態・画面幅を切り替えて見られる |
| [screenshots/](screenshots/) | mockups.htmlから書き出した画像。`plan-{a,b,c}-flow.png`（7ステップ）、`-failures.png`（失敗状態）、`-desktop.png`（PC幅の評価画面） |

## 見方

`mockups.html` をブラウザで直接開く。build・通信・外部ファイルは不要。

URLの `#` 以降で表示を指定できる。

- `#plan=A&step=rate&fail=none&device=mobile`: 1画面（`plan`: A/B/C、`step`: seed/recommend/play/rate/checkpoint/summary/save、`fail`: none/seed-short/play-fail/save-fail/bookmark-fail/shortage/no-hyp）
- `#view=flow&plan=A`: 7ステップの一覧
- `#view=fail&plan=A`: 失敗状態の一覧

画像はMicrosoft Edgeのheadlessモードで書き出した。

```bash
msedge --headless=new --hide-scrollbars --window-size=1560,1900 --screenshot=plan-a-flow.png "file:///<このフォルダの絶対パス>/mockups.html#view=flow&plan=A"
```

## 注意

- 曲名・アーティスト名は架空。文言・色・レイアウトはすべて仮で、製品名・最終UXは[O-05](../../docs/product-spec.md#open-questions)でOPEN。
- YouTubeの実再生、ユーザーテスト、支援技術での操作は行っていない。
- 製品コード（`apps/web`）には組み込まない。
