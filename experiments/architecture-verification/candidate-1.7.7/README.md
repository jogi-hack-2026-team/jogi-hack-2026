# Better Auth 1.7.7 隔離候補

Supporting Artifact / Not a Source of Truth。採用済みアプリではない。[追加検証報告](../FOLLOWUP-2026-10-02.md) に結果・制約・設計理由を集約する。親 package は1.7.6の履歴として保持する。

Node 24.21.0 と空の隔離合成 DB を使用し、このディレクトリ内で `npm ci --no-audit --no-fund`、`npm run typecheck`、`npm run web:build`、`npm run verify:auth-db`、`npm run verify:rate-limit`、`npm run verify:fixed` を実行する。Windows では `pwsh -NoProfile -File verify-fixed.ps1` が exit code、JSON FAIL、結果時刻を確認し、所有する合成 DB を終了する。node/npm は親 repo や system を更新しない。Windows実行は既存Chromeを新規隔離profileで使う。`SPIKE_CHROME_PATH`で既存binaryを指定でき、なければブラウザ未検証の INFO とする。ポート3290/3291/3292/3299、PG55591等が空いていることを確認する。他人の process は止めない。

`results/post-fix` は現在の再実行結果。公開した比較の生結果は [日付別結果](../results/2026-10-02/) に保存し、修正前後を上書きしない。試験は2つの合成identityだけで Secret/Cookie/password を出力しない。`.local`、node_modules、生成 env、DB、browser profile を commit しない。

Linux検証は既存のDocker Desktop Linux engineが使える場合だけ、`node verify/v6-linux-container.mjs`を実行する。公式Node24.21.0/bookworm-slimとPostgreSQL18/bookwormを使用し、実際のdigestを結果へ記録する。専用名・label、tmpfs DB、SQL非公開、API loopback3390のみ。migrationを1回だけ実行し、アプリは`SPIKE_MIGRATE=0`。今回生成したenvは試験終了後削除、所有labelを確認した今回のcontainers/imageだけ除去する。DockerDesktop新規install、system/WSL設定、既存資源の削除、クラウドdeployは行わない。

ローカルHTTP試験だけ`NODE_ENV=test`を指定する。productionのHTTPS gateは変更しない。Containerの`DATABASE_URL`/`BETTER_AUTH_SECRET`/`BASE_URL`不足は拒否し、embedded DBへfallbackしない。本番利用は未承認。[復元後session失効手順](RESTORE-PROCEDURE.md) は loopback合成DB限定で、本番復旧を代行しない。

終了回帰は `node verify/v7-shutdown-regression.mjs`。正常keep-aliveのidle/処理中/並列worker/SQL書込と反復起動9条件。専用tmpfs DB、合成2人、worker1・代用CPU2000ms・書込lock4秒、Docker猶予10秒、全応答200・終了後SQL・resource解放を確認する。実Engine/クラウド試験ではない。WindowsからDockerへはユーザー設定を読まない空の専用DOCKER_CONFIGと既存Linux endpointを指定する。Dockerへの権限がなければ停止し、新認可/設定変更をしない。
