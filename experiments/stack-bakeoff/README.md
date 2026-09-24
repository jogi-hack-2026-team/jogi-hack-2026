# Stack Bake-off

**Supporting Artifact / Not a Source of Truth**。Issue #34の比較実験。正式仕様は[Product Spec](../../docs/product-spec.md)、候補の推奨・未決事項は[Architecture](../../docs/architecture.md)。本番へ直接転用しない。

## Purpose

同じReact画面をVite＋React Router / Vite＋TanStack Router / Nextで、同じDomain・SQLをHono/Fastifyで動かし、Framework境界・build・型検査・HTTP整合性を比較する。初回Vite＋HonoのEvidenceを保持し、2026-09-25再評価はVite＋Fastifyを統合する。全組合せは作らない。

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
npm.cmd run dev:tanstack
npm.cmd run api:integration
```

- Vite: `http://127.0.0.1:4173`、Next: `http://127.0.0.1:4174`、TanStack: `http://127.0.0.1:4175`。既定は共通Mock。検索に`error`と入力すると検索エラーを再現できる。
- 実API統合: `http://127.0.0.1:4173/?mode=live`。`api:integration`はFastify 4310とDBを使う。Hono単独は`api:hono`で4310（同時起動しない）、Fastify単独は`api:fastify`で4311。未検証の全組合せへ勝手に拡張しない。
- 3〜5Seedを選び探索開始。5commitで終了するPoC仮定。Feedbackの4値・Rating変更・reload復元・Playback失敗・render errorを確認できる。
- GuestのlocalStorageはPoC専用で、公開Auth設計ではない。保存不可なら警告する。失効/DB再起動後の自動復旧は未実装なので、新しいBrowser contextで再実行する。

## TestとMeasure

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run e2e
npm.cmd run measure -- --reevaluate
npm.cmd run scale
npx.cmd tsx scripts/measure-backend.ts
```

E2Eは自分でFE3候補とFastify 4310を起動/終了する。手動起動した同portのserverは先に終了する。Chrome channelを使い、Browserの個人profileは使わない。build/scale計測中はE2E/別buildを同時に走らせない。

`measure -- --reevaluate`はwarm-up後各3build、OS/CPU/Node、source file/line数、output bytesを`results/reevaluation-build-metrics.json`へ保存する。flagなしは旧2候補用の`results/build-metrics.json`を上書きするため、初回Evidenceを保持したい場合は使わない。`measure-backend`はwarm-up5回＋30sessionの旧HTTP測定を再実行して上書きする。Next出力はcache/serverも含むためViteのnetwork bundleと直接比較しない。測定順・DB温度・OS負荷の影響があり、ベンチマークで勝敗を断定しない。

`scale`は各Frameworkを2つのOS processで起動し、各pool上限12、同一Feedback100並列、独立Session100並列、100/1k/10k履歴からのRating revisionを検証する。履歴はSQLで合成投入し、旧5commit controllerの制限を試験のために迂回する。結果は`results/scale-metrics.json`、processは終了時に停止する。短いburstと各1回の履歴試験であり、本番throughput/SLO・最新Product全体を証明しない。

旧`verification.json`/`build-metrics.json`/`backend-metrics.json`はPreliminary Evidence、再評価は`reevaluation-verification.json`/`reevaluation-build-metrics.json`/`scale-metrics.json`。`node scripts/research-releases.mjs`は公式GitHub API/npmの公開metadataを取得し、`research-releases.json`へ保存する（network使用、認証値不要）。

`results/local-*`は未追跡のログ/screenshot、共有する小さい測定JSONと検証要約はGit管理する。Secretやtokenを結果へ含めない。整形確認は`npx.cmd prettier --check "backend/**/*.ts" "frontend/**/*.{ts,tsx,css,html,json,mjs}" "shared/**/*.ts" "tests/**/*.ts" "scripts/*.{mjs,ts}" "*.json" "playwright.config.ts"`。

統合E2Eの[画面記録](results/integration.png)もSupporting Artifact / Not a Source of Truth。合成データであり、正式な画面デザインではない。

## What this proves

- 各HTTP層から同じPostgreSQL transaction / row lock / unique制約を利用できる。
- 同時Feedback再送、Rating競合、別Interaction同時更新、canonical再計算、Trace INSERT失敗時rollbackを実際に試験した。
- 8次元Gaussian線形更新がJavaScriptで実行でき、解析例と有限性を確認した。
- 共通画面・型・E2Eと1組の実HTTP/DB統合が成立する。

## What this does NOT prove

実録音の同定、ReccoBeats coverage/規約、YouTube再生、VERIFIED Mapping、推薦品質、Hypothesis分類、Aspect Feedback、Evidence Ledger全体、正式5曲計数、継続探索、公開Guest security、Account移行、Production migration、App container、クラウドPreview/費用/Cold Start。合成percentileを使い、実Catalog変換は未実装。Structured Logging運用と自動外部retryも未実装。

旧数値sliceは正距離＋末尾切片・正規化なしのContext、距離で二分したProbe、5commit進行を保持する。最新Snapshotの負距離/sqrt(8) Context、対象Feature以外を近づけるProbe、再生開始＋accepted Feedback計数の実装ではない。再評価の追加試験もこの限定slice上でFramework・整合性を比較しており、正式Productの受入完了にしない。

既定の共通コードはFramework固有の強みを比較し尽くしていない。NextのSSR/RSC/Server Functions、Fastifyのschema/logging標準化は机上評価と区別する。

## 終了

起動したterminalはCtrl+Cで止める。DBのみ停止する場合は、このディレクトリで`docker compose stop`。他プロジェクトのコンテナ・volumeへ操作しない。再起動は`docker compose up -d --wait`後にテスト/APIを起動するとschemaが作られる。

## Troubleshooting

- `EACCES` / `EPERM`: sandboxやprocess起動権限を確認。Frameworkの不具合と決めつけない。
- DB connection refused: Docker Engine、compose health、55434を確認。本番DBへ接続先を切り替えない。
- E2Eのport conflict: 4173/4174/4175/4310の手動PoC processを終了して再実行。
- TanStackのrender error: Router内の境界が先に捕捉するため、共通復旧UI用Boundaryをroute component内にも配置する。外側Boundaryだけの初回試験は失敗し、修正後に成功。
- Nextの`role=alert`重複: route announcerも存在するため、表示エラーをaccessible nameで区別する。assertionを弱めない。
- Viteの`use client`警告: 共通Client component/React Router由来。RSCをこのVite構成で使用した意味ではない。
