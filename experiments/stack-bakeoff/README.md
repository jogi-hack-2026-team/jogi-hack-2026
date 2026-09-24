# Stack Bake-off

**Supporting Artifact / Not a Source of Truth**。Issue #34の比較実験。正式仕様は[Product Spec](../../docs/product-spec.md)、候補の推奨・未決事項は[Architecture](../../docs/architecture.md)。本番へ直接転用しない。

## Purpose

同じReact画面をVite/Nextで、同じDomain・SQLをHono/Fastifyで動かし、Framework境界・build・型検査・HTTP整合性を比較する。全組合せを作らずVite＋Honoだけ接続する。

## Setup

検証環境: Windows PowerShell、Node 22.15.1、npm、Docker Desktop Engine 29.6.1、インストール済みGoogle Chrome。PoC専用package/lockfileなのでrepoルートに本番dependencyは追加しない。

```powershell
cd experiments/stack-bakeoff
npm.cmd ci
docker compose up -d --wait
```

DBは`jogi-stack-bakeoff-34`プロジェクトのPostgreSQL、localhost:55434のみ、bakeoff DB/user、tmpfs。**ローカル実験限定のtrust認証**でパスワードはない。同じPCの他プロセスは接続できるため、合成データだけを使う。Productionの環境変数/Secretは読まない。port占有時は既存コンテナを消さず、競合を解消してから起動する。

composeで検証したimageはPostgreSQL 18.6。digestは結果ファイルに記録する。停止すると一時DB内容が失われるので、必要な実験結果は先にファイルへ保存する。

## Run

次のコマンドは別terminalで起動する。

```powershell
npm.cmd run dev:vite
npm.cmd run dev:next
npm.cmd run api:hono
```

- Vite: `http://127.0.0.1:4173`、Next: `http://127.0.0.1:4174`。既定は共通Mock。検索に`error`と入力すると検索エラーを再現できる。
- 実API統合: `http://127.0.0.1:4173/?mode=live`。Hono 4310とDBを使う。Fastify単独起動は`npm.cmd run api:fastify`で4311。未検証の全組合せへ勝手に拡張しない。
- 3〜5Seedを選び探索開始。5commitで終了するPoC仮定。Feedbackの4値・Rating変更・reload復元・Playback失敗・render errorを確認できる。
- GuestのlocalStorageはPoC専用で、公開Auth設計ではない。保存不可なら警告する。失効/DB再起動後の自動復旧は未実装なので、新しいBrowser contextで再実行する。

## TestとMeasure

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run e2e
npm.cmd run measure
npx.cmd tsx scripts/measure-backend.ts
```

E2Eは自分でFE2候補とHonoを起動/終了する。手動起動した同portのserverは先に終了する。Chrome channelを使い、Browserの個人profileは使わない。build計測中はE2E/別buildを同時に走らせない。

`measure`はwarm-up後各3build、OS/CPU/Node、source file/line数、output bytesを`results/build-metrics.json`へ保存する。`measure-backend`はwarm-up5回＋30sessionでHTTP/DB時間を保存する。Next出力はcache/serverも含むためViteのnetwork bundleと直接比較しない。測定順・DB温度・OS負荷の影響があり、ベンチマークで勝敗を断定しない。

`results/local-*`は未追跡のログ/screenshot、共有する小さい測定JSONと検証要約はGit管理する。Secretやtokenを結果へ含めない。整形確認は`npx.cmd prettier --check "backend/**/*.ts" "frontend/**/*.{ts,tsx,css,html,json,mjs}" "shared/**/*.ts" "tests/**/*.ts" "scripts/*.{mjs,ts}" "*.json" "playwright.config.ts"`。

統合E2Eの[画面記録](results/integration.png)もSupporting Artifact / Not a Source of Truth。合成データであり、正式な画面デザインではない。

## What this proves

- 各HTTP層から同じPostgreSQL transaction / row lock / unique制約を利用できる。
- 同時Feedback再送、Rating競合、別Interaction同時更新、canonical再計算、Trace INSERT失敗時rollbackを実際に試験した。
- 8次元Gaussian線形更新がJavaScriptで実行でき、解析例と有限性を確認した。
- 共通画面・型・E2Eと1組の実HTTP/DB統合が成立する。

## What this does NOT prove

実録音の同定、ReccoBeats coverage/規約、YouTube再生、VERIFIED Mapping、推薦品質、Hypothesis分類、Aspect Feedback、Evidence Ledger全体、正式5曲計数、継続探索、公開Guest security、Account移行、Production migration、App container、クラウドPreview/費用/Cold Start。合成percentileを使い、実Catalog変換は未実装。Structured Logging運用と自動外部retryも未実装。

既定の共通コードはFramework固有の強みを比較し尽くしていない。NextのSSR/RSC/Server Functions、Fastifyのschema/logging標準化は机上評価と区別する。

## 終了

起動したterminalはCtrl+Cで止める。DBのみ停止する場合は、このディレクトリで`docker compose stop`。他プロジェクトのコンテナ・volumeへ操作しない。再起動は`docker compose up -d --wait`後にテスト/APIを起動するとschemaが作られる。

## Troubleshooting

- `EACCES` / `EPERM`: sandboxやprocess起動権限を確認。Frameworkの不具合と決めつけない。
- DB connection refused: Docker Engine、compose health、55434を確認。本番DBへ接続先を切り替えない。
- E2Eのport conflict: 4173/4174/4310の手動PoC processを終了して再実行。
- Nextの`role=alert`重複: route announcerも存在するため、表示エラーをaccessible nameで区別する。assertionを弱めない。
- Viteの`use client`警告: 共通Client component/React Router由来。RSCをこのVite構成で使用した意味ではない。
