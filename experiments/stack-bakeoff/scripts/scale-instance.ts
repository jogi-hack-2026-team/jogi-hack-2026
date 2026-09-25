import { serve } from "@hono/node-server";
import { once } from "node:events";
import { createApp as hono } from "../backend/hono/app.ts";
import { createApp as fastify } from "../backend/fastify/app.ts";
import { pool } from "../backend/shared/database.ts";
const metrics = {
  maxConnections: 0,
  maxWaiting: 0,
  poolLimit: 12,
  sampleIntervalMs: 2,
};
const timer = setInterval(() => {
  metrics.maxConnections = Math.max(metrics.maxConnections, pool.totalCount);
  metrics.maxWaiting = Math.max(metrics.maxWaiting, pool.waitingCount);
}, 2);
timer.unref();
if (process.argv[2] === "hono") {
  const app = hono();
  app.get("/__metrics", (c) => c.json(metrics));
  const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });
  await once(server, "listening");
  console.log(
    `READY http://127.0.0.1:${(server.address() as { port: number }).port}`,
  );
} else {
  const app = fastify();
  app.get("/__metrics", async () => metrics);
  console.log(`READY ${await app.listen({ host: "127.0.0.1", port: 0 })}`);
}
