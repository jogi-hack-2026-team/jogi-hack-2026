# #84 基本構成合意の記録部分の保存

Supporting Artifact / Not a Source of Truth

基準main `10c1df734b6a8a2ba031a45f6c7b70af16e4c38e` の[2026-10-03の技術構成合意](../architecture.md#2026-10-03の技術構成合意)から、構成・理由の表、当時の残る作業、条件付き候補の表を全文移動した。移動整理は[#180](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/180)。元の節には後日の更新も含まれるため、全段落を2026-10-03当日の記述とは扱わない。以下の残件表記は保存した基準版の記録であり、現在の実装状況は[対応表](../change-map.md#現在地の読み方)、有効な採択は[D-23](../architecture.md#d-23)・[Technology Stack](../architecture.md#technology-stack)を参照する。

現行契約と合意の出所の段落は元の節に残した。クラウド候補の現在の条件は[D-25](../architecture.md#d-25)で確認する。

## 移動した記録

採用する基本構成と理由は次のとおり。版・追加ツールは今回の合意では確定していない。追加ツールのうちworkspace管理とDB接続ライブラリは[2026-10-05の追加採択](../architecture.md#2026-10-05の追加採択)を参照する。

| 作る部分 | 採用する構成 | この構成にする理由 |
| --- | --- | --- |
| 共通の言語と実行環境 | TypeScript／Node | 画面・API・計算の型を共有し、実行環境を分散させない |
| 画面 | React＋Vite＋TanStack Router／Query | Reactは画面、Viteはビルド、Routerは画面遷移、Queryは取得・更新後の再取得を担当する |
| APIと共有契約 | Fastify＋TypeBox | 画面とAPIで同じデータ定義を使い、入力を実行時にも検証する |
| データ保存 | PostgreSQL | 記録の一意性と関連データの整合をDBの制約で守る |
| 配信 | 単一SPA／APIコンテナ | 画面とAPIを同じorigin（URLのスキーム・ホスト・ポート）で配信し、配備対象を少なくする |
| 予測 | 独立した純粋計算コア | 入力だけから同じ結果を返し、画面・DB・HTTPと分けて検証する |

**残る作業：** [#71](https://github.com/jogi-hack-2026-team/jogi-hack-2026/issues/71)〜#73の純粋Engineは[#103](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/103)でmain統合済みで、#77でToday APIへ結合した。#70の基盤に対するローカル一式起動は#130で補完する。業務画面・公開配置・製品としての正式受入は未完了。FE担当は#78〜#81の具体的な先行範囲・依存変更を各Issueで確認する（[PR #92の確認](https://github.com/jogi-hack-2026-team/jogi-hack-2026/pull/92#issuecomment-5944800922)）。合意だけでHard依存・BLOCKEDを解除せず、[着手前の確認](../DEVELOPMENT_GUIDE.md#着手前に読み直す)と対象Issueの承認済み範囲に従う。担当者氏名・ProjectsのStatusは推測しない。

| 2026-10-03時点の条件付き第一候補 | 当時から引き続き残る条件 |
| --- | --- |
| Better Auth（D-24） | 採用版、認証更新／DB復旧担当、CSRF／Origin細則・回数制限、復元後の削除user／password／account巻戻し対処、公開HTTPSの確認 |
| Cloud Run＋Neon（D-25） | 最終受入、regionの組合せ、予算・利用前提・運用担当、実Cloud／proxy／1 vCPU／休止後応答の確認。アカウント・課金・リソース作成と一般公開は別承認 |
