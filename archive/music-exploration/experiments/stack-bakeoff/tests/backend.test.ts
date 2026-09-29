import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { serve } from "@hono/node-server";
import { createApp as hono } from "../backend/hono/app.ts";
import { createApp as fastify } from "../backend/fastify/app.ts";
import { migrate, pool } from "../backend/shared/database.ts";
import { Service, type Hooks } from "../backend/shared/service.ts";
import type { Interaction } from "../shared/contract.ts";
import { prior, update, sample, dot } from "../backend/shared/lints.ts";

before(migrate);
after(() => pool.end());
const seeds = ["fixture-0", "fixture-1", "fixture-2"];
async function start(kind: string, hooks: Hooks = {}) {
  const service = new Service(hooks);
  if (kind === "hono") {
    const server = serve({
      fetch: hono(service).fetch,
      hostname: "127.0.0.1",
      port: 0,
    });
    await once(server, "listening");
    return {
      url: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
      close: () =>
        new Promise<void>((resolve, reject) =>
          server.close((e) => (e ? reject(e) : resolve())),
        ),
    };
  }
  const app = fastify(service);
  const url = await app.listen({ host: "127.0.0.1", port: 0 });
  return { url, close: () => app.close() };
}
for (const kind of ["hono", "fastify"])
  test(kind, async (t) => {
    const server = await start(kind, { normal: () => 0 });
    const call = async (
      method: string,
      path: string,
      body?: unknown,
      token = "",
    ) => {
      const response = await fetch(server.url + path, {
        method,
        headers: { "Content-Type": "application/json", "X-Guest-Token": token },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, body: (await response.json()) as any };
    };
    const guest = async () => {
      const r = await call("POST", "/sessions", { seeds });
      assert.equal(r.status, 201);
      return r.body;
    };
    const next = async (s: any, id = randomUUID()) =>
      call("POST", `/sessions/${s.id}/next`, { interactionId: id }, s.token);
    const rate = async (s: any, i: any, rating: string, expectedRevision = 0) =>
      call(
        "PUT",
        `/interactions/${i.interactionId}/feedback`,
        { rating, expectedRevision },
        s.token,
      );
    try {
      await t.test(
        "seed bounds, duplicates, unknown IDs, malformed JSON",
        async () => {
          for (const invalid of [
            [],
            seeds.slice(0, 2),
            [...seeds, ...seeds],
            ["missing", ...seeds],
            null,
          ])
            assert.equal(
              (await call("POST", "/sessions", { seeds: invalid })).status,
              400,
            );
          assert.equal(
            (
              await call("POST", "/sessions", {
                seeds: [
                  "fixture-0",
                  "fixture-1",
                  "fixture-2",
                  "fixture-3",
                  "fixture-4",
                ],
              })
            ).status,
            201,
          );
          const malformed = await fetch(server.url + "/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{",
          });
          assert.equal(malformed.status, 400);
        },
      );
      await t.test("atomic commit, trace equality, commit retry", async () => {
        const s = await guest(),
          id = randomUUID();
        const a = await next(s, id),
          b = await next(s, id);
        assert.equal(a.status, 201);
        assert.deepEqual(a.body, b.body);
        const rows = await pool.query(
          "SELECT decision FROM traces WHERE interaction_id=$1",
          [id],
        );
        assert.deepEqual(rows.rows[0].decision, a.body.decisionTrace);
        assert.equal(a.body.candidateType, "RELEVANT");
        assert.ok(seeds.includes(a.body.anchorId));
        assert.ok(!seeds.includes(a.body.trackId));
        assert.equal(
          a.body.decisionTrace.score,
          dot(a.body.decisionTrace.context, a.body.decisionTrace.theta),
        );
      });
      await t.test(
        "same feedback retry and 16 concurrent duplicates update once",
        async () => {
          const s = await guest(),
            i = (await next(s)).body;
          const results = await Promise.all(
            Array.from({ length: 16 }, () => rate(s, i, "LIKE")),
          );
          assert.ok(results.every((r) => r.status === 200));
          assert.ok(results.every((r) => r.body.preferenceVersion === 1));
          assert.equal((await rate(s, i, "LIKE")).body.evidenceCount, 1);
        },
      );
      await t.test(
        "competing ratings use revision conflict, canonical rebuild and stale retry",
        async () => {
          const s = await guest(),
            i = (await next(s)).body;
          const results = await Promise.all([
            rate(s, i, "LIKE"),
            rate(s, i, "DISLIKE"),
          ]);
          assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
          const changed = await rate(s, i, "NEUTRAL", 1);
          assert.equal(changed.body.preferenceVersion, 2);
          const summary = (
            await call("GET", `/sessions/${s.id}/summary`, undefined, s.token)
          ).body;
          assert.deepEqual(summary.posterior.b, Array(8).fill(0));
          assert.equal(summary.posterior.evidenceCount, 1);
          assert.equal((await rate(s, i, "LIKE", 0)).status, 409);
          await rate(s, i, "UNSURE", 2);
          const unsure = (
            await call("GET", `/sessions/${s.id}/summary`, undefined, s.token)
          ).body;
          assert.deepEqual(unsure.posterior, prior());
        },
      );
      await t.test(
        "different interactions concurrently preserve both contributions",
        async () => {
          const s = await guest(),
            a = (await next(s)).body,
            b = (await next(s)).body;
          await Promise.all([rate(s, a, "LIKE"), rate(s, b, "DISLIKE")]);
          const p = (
            await call("GET", `/sessions/${s.id}/summary`, undefined, s.token)
          ).body.posterior;
          const expected = prior();
          update(expected, a.decisionTrace.context, 1);
          update(expected, b.decisionTrace.context, -1);
          assert.deepEqual(p, expected);
        },
      );
      await t.test(
        "UNSURE contributes no learning; validation and guest isolation",
        async () => {
          const s = await guest(),
            other = await guest(),
            i = (await next(s)).body;
          assert.equal((await rate(s, i, "UNSURE")).body.evidenceCount, 0);
          assert.equal((await rate(s, i, "SKIP")).status, 400);
          assert.equal((await rate(other, i, "LIKE")).status, 404);
          assert.equal(
            (await call("GET", `/sessions/${s.id}/summary`)).status,
            401,
          );
        },
      );
      await t.test(
        "five commits, distinct tracks, at most two nonconsecutive probes",
        async () => {
          const s = await guest();
          const items: Interaction[] = [];
          for (let n = 0; n < 5; n++) {
            const i = (await next(s)).body;
            items.push(i);
            await rate(s, i, "DISLIKE");
          }
          assert.equal(new Set(items.map((i) => i.trackId)).size, 5);
          assert.equal(items[0].candidateType, "RELEVANT");
          assert.ok(
            items.filter((i) => i.candidateType === "PROBE").length <= 2,
          );
          assert.ok(
            items.every(
              (i, n) =>
                n === 0 ||
                i.candidateType !== "PROBE" ||
                items[n - 1].candidateType !== "PROBE",
            ),
          );
          assert.equal((await next(s)).status, 409);
        },
      );
      await t.test("CORS permits only tested frontend origins", async () => {
        for (const [origin, allowed] of [
          ["http://127.0.0.1:4173", true],
          ["https://untrusted.example", false],
        ] as const) {
          const r = await fetch(server.url + "/sessions", {
            method: "OPTIONS",
            headers: {
              Origin: origin,
              "Access-Control-Request-Method": "POST",
              "Access-Control-Request-Headers": "content-type,x-guest-token",
            },
          });
          assert.equal(r.status, 204);
          assert.equal(
            r.headers.get("access-control-allow-origin") === origin,
            allowed,
          );
        }
      });
    } finally {
      await server.close();
    }
    await t.test("trace INSERT failure rolls back interaction", async () => {
      const failing = await start(kind, { failTrace: true });
      const service = new Service();
      const s = await service.createSession({ seeds });
      const id = randomUUID();
      try {
        const r = await fetch(failing.url + `/sessions/${s.id}/next`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Guest-Token": s.token,
          },
          body: JSON.stringify({ interactionId: id }),
        });
        assert.equal(r.status, 500);
        assert.equal(
          (await pool.query("SELECT 1 FROM interactions WHERE id=$1", [id]))
            .rowCount,
          0,
        );
        assert.equal(
          (
            await pool.query("SELECT 1 FROM traces WHERE interaction_id=$1", [
              id,
            ])
          ).rowCount,
          0,
        );
      } finally {
        await failing.close();
      }
    });
    for (const mode of ["timeout", "429", "500", "invalid-json"])
      await t.test(`external ${mode} failure`, async () => {
        const failing = await start(kind, {
          timeoutMs: 5,
          external: async (signal) =>
            mode === "timeout"
              ? new Promise((_, reject) =>
                  signal.addEventListener(
                    "abort",
                    () => reject(signal.reason),
                    { once: true },
                  ),
                )
              : mode === "invalid-json"
                ? new Response("{broken", { status: 200 })
                : new Response("", { status: Number(mode) }),
        });
        try {
          const r = await fetch(failing.url + "/tracks");
          assert.equal(
            r.status,
            mode === "timeout" ? 504 : mode === "429" ? 503 : 502,
          );
          assert.equal(
            ((await r.json()) as { error: string }).error,
            mode === "timeout"
              ? "UPSTREAM_TIMEOUT"
              : mode === "429"
                ? "UPSTREAM_RATE_LIMIT"
                : "UPSTREAM_FAILURE",
          );
        } finally {
          await failing.close();
        }
      });
  });
test("8D Gaussian posterior analytic values, ranking change, finite simulation", () => {
  const p = prior(),
    x = [1, 0, 0, 0, 0, 0, 0, 0];
  assert.deepEqual(
    sample(p, () => 0),
    Array(8).fill(0),
  );
  update(p, x, 1);
  assert.ok(Math.abs(sample(p, () => 0)[0] - 0.5) < 1e-12);
  assert.ok(
    dot(
      sample(p, () => 0),
      x,
    ) >
      dot(
        sample(p, () => 0),
        x.map((v) => -v),
      ),
  );
  const q = prior();
  update(q, x, -1);
  assert.ok(
    dot(
      sample(q, () => 0),
      x,
    ) <
      dot(
        sample(q, () => 0),
        x.map((v) => -v),
      ),
  );
  for (let n = 0; n < 1000; n++) {
    update(
      p,
      Array.from({ length: 8 }, (_, i) => Math.sin(n + i)),
      (n % 3) - 1,
    );
    assert.ok(sample(p).every(Number.isFinite));
  }
});
