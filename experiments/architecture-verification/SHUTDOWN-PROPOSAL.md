# SIGTERM の原因切り分けと最小修正案

Supporting Artifact / Not a Source of Truth。終了処理の新規変更案は**未適用・未承認・未検証**。

通常の Linux worker800ms＋keep-alive 条件で、SIGTERM後の要求は200になるが HTTP server のcloseが終わらず10秒後exit137。非秘密traceはsignal受信→`app-close-start`→`pre-close`、接続数21。`http-server-closed`もworkerの`onClose`も到達せず、poolの終了はその後なので未到達。

同じ image と独立した app/auth pool の対照条件を比較した。各回は新しいtmpfs DB、合成2人だけ。

| 条件 | 終了 | 分かること |
| --- | --- | --- |
| worker800ms、通常keep-alive | FAIL、要求200後exit137 | HTTP close待ちが残る。通常条件の失敗を維持 |
| inline800ms、通常keep-alive | PASS、exit0 | workerによる非同期応答の時機と関連。inlineはevent loopを塞ぐので同じsignal時機の性能証拠ではない |
| worker800ms、client側Connection: close | PASS、約1.4秒、要求200、exit0 | HTTP close→worker close→app pool end→auth pool end→shutdown-completeを確認。pool追加やworker terminate自体が停止しないという仮説はこの条件で否定 |

証拠は[通常worker trace](results/2026-10-02/history/linux-resource-worker.json)、[inline対照](results/2026-10-02/history/linux-inline-control.json)、[Connection close対照](results/2026-10-02/history/linux-connection-close-control.json)。Nodeはimageの直接CMDでPID1、npm wrapperなし。signal受信はログで確認しており、PID1/npm/signal未伝達による停止ではない。3点修正による直接的なpool停止回帰は観測されていない。旧1.7.6 imageとのLinux比較までは実施していないため、全旧版との差分を原因なしと断定しない。

**原因分類は、非同期処理中のHTTP接続が応答後も持続し、HTTP closeの完了を妨げる条件。**正確なNode/Fastify内部の不具合位置は未確定。[Node24 HTTP close](https://nodejs.org/docs/latest-v24.x/api/http.html#serverclosecallback) と [Fastify close](https://fastify.dev/docs/latest/Reference/Server/#close) の既定動作では、idle接続を閉じ処理中要求を待つ。今回の観測ではその完了条件を満たさない。worker終了や両poolの解放を先に強制すると要求の途中切断やDB処理失敗になりうるので、その順序は維持する。

最小案は `candidate-1.7.7/src/app.ts` の Fastify instance に、HTTP listenerが停止した後の処理中応答へ `Connection: close` を付けるhookを追加すること。**以下は差分案のみで、実装していない。**

```diff
 const app = Fastify(options).withTypeProvider<TypeBoxTypeProvider>();
+app.addHook('onSend', async (_request, reply, payload) => {
+  if (!app.server.listening) reply.header('connection', 'close');
+  return payload;
+});
```

必要性は処理中HTTPの200完了と10秒以内の正常終了を両立するため。全接続の強制destroyやtimeout延長はしない。`onSend`登録範囲・HTTP/1.1応答・Fastify listener stateの時機は適用後に検証が必要。応答header送出後や別protocolの一般的対策を保証しない。別案はshutdown中の`onResponse`からidle接続のみを閉じることだが、Nodeのidle判定とhook時機を別途確認する必要があり、現時点で広げない。

最小承認は、この隔離candidateだけへの終了hookの変更と同じ合成Linux回帰の再実行。3点のauth修正、Product仕様、クラウド設定・deploy・課金の変更を含まない。承認後は通常keep-alive worker条件を少なくとも3回、処理前/中/後のSIGTERM、複数の処理中要求、Cookie/複数Set-Cookie・認証/DB/rate-limit回帰、timeout10秒の維持を確認する。成功までは採用ブロッカーを解除しない。
