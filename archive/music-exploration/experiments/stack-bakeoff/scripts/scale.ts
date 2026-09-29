import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { migrate, pool, transaction } from "../backend/shared/database.ts";
import { Service } from "../backend/shared/service.ts";
import { prior, update } from "../backend/shared/lints.ts";
const children: ChildProcess[] = [];
async function start(kind: string): Promise<string> {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "scripts/scale-instance.ts", kind],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  children.push(child);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("server startup timeout")),
      15000,
    );
    let out = "";
    child.stdout!.on("data", (chunk) => {
      out += chunk.toString();
      const m = out.match(/READY (http:\/\/127\.0\.0\.1:\d+)/);
      if (m) {
        clearTimeout(timeout);
        resolve(m[1]);
      }
    });
    child.once("error", (e) => {
      clearTimeout(timeout);
      reject(e);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      if (!out.includes("READY")) reject(new Error(`server exited ${code}`));
    });
  });
}
const service = new Service();
const seeds = ["fixture-0", "fixture-1", "fixture-2"];
type Work = { id: string; token: string; rating: string; revision: number };
async function batch(urls: string[], work: Work[]) {
  const begin = performance.now();
  const rows = await Promise.all(
    work.map(async (w, i) => {
      const t = performance.now();
      const r = await fetch(
        `${urls[i % urls.length]}/interactions/${w.id}/feedback`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Guest-Token": w.token,
          },
          body: JSON.stringify({
            rating: w.rating,
            expectedRevision: w.revision,
          }),
        },
      );
      const b = await r.json();
      assert.equal(r.status, 200, JSON.stringify(b));
      return performance.now() - t;
    }),
  );
  const sorted = [...rows].sort((a, b) => a - b);
  return {
    requests: rows.length,
    totalMs: performance.now() - begin,
    medianMs: sorted[Math.floor(sorted.length / 2)],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    rawMs: rows,
  };
}
const result: {
  label: string;
  at: string;
  conditions: string;
  scenarios: unknown[];
} = {
  label: "Supporting Artifact / Not a Source of Truth",
  at: new Date().toISOString(),
  conditions:
    "Windows localhost, PostgreSQL tmpfs, legacy Node-focused slice unchanged. Two actual OS app processes per framework, pool max 12 each, driver pool max 12. Hono then Fastify fixed order. Single burst, no sustained load/SLO conclusion. Pool sampled every 2ms. History inserted directly beyond five-commit controller solely to measure canonical rebuild.",
  scenarios: [],
};
try {
  await migrate();
  for (const kind of ["hono", "fastify"]) {
    const urls = [await start(kind), await start(kind)];
    const duplicate = await service.createSession({ seeds });
    const interaction = await service.recommend(
      duplicate.id,
      duplicate.token,
      randomUUID(),
    );
    const same = await batch(
      urls,
      Array.from({ length: 100 }, () => ({
        id: interaction.interactionId,
        token: duplicate.token,
        rating: "LIKE",
        revision: 0,
      })),
    );
    const state = await service.summary(duplicate.id, duplicate.token);
    assert.equal(state.posterior.evidenceCount, 1);
    assert.equal(state.preferenceVersion, 1);
    const independent: Work[] = [];
    for (let n = 0; n < 100; n++) {
      const s = await service.createSession({ seeds });
      const i = await service.recommend(s.id, s.token, randomUUID());
      independent.push({
        id: i.interactionId,
        token: s.token,
        rating: "NEUTRAL",
        revision: 0,
      });
    }
    const many = await batch(urls, independent);
    const canonical = await pool.query(
      "SELECT count(*)::int n FROM feedback WHERE interaction_id = ANY($1::uuid[])",
      [independent.map((w) => w.id)],
    );
    assert.equal(canonical.rows[0].n, 100);
    const histories = [];
    for (const n of [100, 1000, 10000]) {
      const s = await service.createSession({ seeds });
      const ids = Array.from({ length: n }, () => randomUUID());
      const x = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 1];
      const p = prior();
      for (let j = 0; j < n; j++) update(p, x, 0);
      await transaction(async (c) => {
        await c.query(
          `INSERT INTO interactions SELECT id,$2::uuid,ord::integer,'fixture-3','fixture-0','RELEVANT' FROM unnest($1::uuid[]) WITH ORDINALITY AS u(id,ord)`,
          [ids, s.id],
        );
        await c.query(
          `INSERT INTO traces SELECT id,$2::jsonb FROM unnest($1::uuid[]) AS u(id)`,
          [
            ids,
            JSON.stringify({ context: x, policy: "injected-history-fixture" }),
          ],
        );
        await c.query(
          `INSERT INTO feedback SELECT id,'NEUTRAL',1 FROM unnest($1::uuid[]) AS u(id)`,
          [ids],
        );
        await c.query("UPDATE sessions SET posterior=$2 WHERE id=$1", [
          s.id,
          JSON.stringify(p),
        ]);
      });
      const measured = await batch(urls, [
        { id: ids[0], token: s.token, rating: "DISLIKE", revision: 1 },
      ]);
      const rebuilt = await service.summary(s.id, s.token);
      assert.equal(rebuilt.posterior.evidenceCount, n);
      assert.equal(rebuilt.preferenceVersion, 1);
      const expected = prior();
      for (let j = 0; j < n; j++) update(expected, x, j === 0 ? -1 : 0);
      assert.deepEqual(rebuilt.posterior, expected);
      histories.push({
        history: n,
        ...measured,
        canonicalRebuildMatches: true,
      });
    }
    const metrics = await Promise.all(
      urls.map(async (u) => (await fetch(u + "/__metrics")).json()),
    );
    for (const m of metrics) assert.ok(m.maxConnections <= 12);
    result.scenarios.push({
      kind,
      instances: 2,
      duplicate100: same,
      duplicateEvidence: state.posterior.evidenceCount,
      independent100: many,
      independentSaved: canonical.rows[0].n,
      histories,
      pools: metrics,
    });
    for (const child of children.splice(0)) child.kill();
  }
  writeFileSync(
    "results/scale-metrics.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        ...result,
        scenarios: result.scenarios.map((s: any) => ({
          ...s,
          duplicate100: { ...s.duplicate100, rawMs: undefined },
          independent100: { ...s.independent100, rawMs: undefined },
        })),
      },
      null,
      2,
    ),
  );
} finally {
  for (const child of children) child.kill();
  await pool.end();
}
