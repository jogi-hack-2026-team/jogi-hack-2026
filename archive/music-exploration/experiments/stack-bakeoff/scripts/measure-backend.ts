import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { serve } from "@hono/node-server";
import { createApp as hono } from "../backend/hono/app.ts";
import { createApp as fastify } from "../backend/fastify/app.ts";
import { migrate, pool } from "../backend/shared/database.ts";
import { prior, update, sample } from "../backend/shared/lints.ts";
await migrate();
const stats = (xs: number[]) => {
  const a = [...xs].sort((x, y) => x - y);
  return {
    n: a.length,
    medianMs: a[Math.floor(a.length / 2)],
    p95Ms: a[Math.ceil(a.length * 0.95) - 1],
    rawMs: xs,
  };
};
const results: Record<string, unknown> = {
  label: "Supporting Artifact / Not a Source of Truth",
  at: new Date().toISOString(),
  node: process.version,
  conditions:
    "Local HTTP + PostgreSQL. Sequential Hono then Fastify, 5 warm-up sessions and 30 measured sessions each. Module imports excluded from startup. Not serverless cold start, load test or statistical superiority.",
};
for (const name of ["hono", "fastify"]) {
  const started = performance.now();
  let url: string;
  let close: () => Promise<void>;
  if (name === "hono") {
    const server = serve({
      fetch: hono().fetch,
      hostname: "127.0.0.1",
      port: 0,
    });
    await once(server, "listening");
    url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    close = () =>
      new Promise((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
  } else {
    const app = fastify();
    url = await app.listen({ host: "127.0.0.1", port: 0 });
    close = () => app.close();
  }
  const readyMs = performance.now() - started,
    recommend: number[] = [],
    feedback: number[] = [];
  async function post(method: string, path: string, body: unknown, token = "") {
    const r = await fetch(url + path, {
      method,
      headers: { "Content-Type": "application/json", "X-Guest-Token": token },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${name}: ${r.status}`);
    return r.json();
  }
  try {
    for (let n = 0; n < 35; n++) {
      const s = await post("POST", "/sessions", {
        seeds: ["fixture-0", "fixture-1", "fixture-2"],
      });
      const begin = performance.now();
      const i = await post(
        "POST",
        `/sessions/${s.id}/next`,
        { interactionId: randomUUID() },
        s.token,
      );
      const recMs = performance.now() - begin;
      const f = performance.now();
      await post(
        "PUT",
        `/interactions/${i.interactionId}/feedback`,
        { rating: "LIKE", expectedRevision: 0 },
        s.token,
      );
      const feedbackMs = performance.now() - f;
      if (n >= 5) {
        recommend.push(recMs);
        feedback.push(feedbackMs);
      }
    }
  } finally {
    await close();
  }
  results[name] = {
    readyMs,
    recommendationCommit: stats(recommend),
    feedbackRebuild: stats(feedback),
  };
}
const p = prior();
for (let n = 0; n < 100; n++)
  update(
    p,
    Array.from({ length: 8 }, (_, j) => Math.sin(n + j)),
    (n % 3) - 1,
  );
const start = performance.now();
for (let n = 0; n < 10000; n++) sample(p);
results.numeric = {
  dimension: 8,
  samples: 10000,
  totalMs: performance.now() - start,
};
results.database = (await pool.query("SELECT version()")).rows[0].version;
await pool.end();
writeFileSync(
  "results/backend-metrics.json",
  JSON.stringify(results, null, 2) + "\n",
);
console.log(JSON.stringify(results, null, 2));
