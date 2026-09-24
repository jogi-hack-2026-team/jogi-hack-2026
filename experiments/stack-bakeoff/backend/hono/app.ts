import { Hono } from "hono";
import { cors } from "hono/cors";
import { ApiError, Service } from "../shared/service.ts";
export function createApp(service = new Service()) {
  const app = new Hono();
  app.use(
    "*",
    cors({
      origin: ["http://127.0.0.1:4173", "http://127.0.0.1:4174"],
      allowHeaders: ["Content-Type", "X-Guest-Token"],
      allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
    }),
  );
  app.onError((error, c) => {
    const status =
      error instanceof ApiError
        ? error.status
        : error instanceof SyntaxError
          ? 400
          : 500;
    return c.json(
      {
        error:
          error instanceof ApiError
            ? error.code
            : status === 400
              ? "INVALID_JSON"
              : "INTERNAL_ERROR",
      },
      status as 400,
    );
  });
  app.get("/tracks", async (c) => c.json(await service.external()));
  app.post("/sessions", async (c) =>
    c.json(await service.createSession(await c.req.json()), 201),
  );
  app.post("/interactions", async (c) => {
    const b = await c.req.json();
    return c.json(
      await service.recommend(
        b?.sessionId,
        c.req.header("X-Guest-Token") ?? "",
        b?.interactionId,
      ),
      201,
    );
  });
  app.post("/sessions/:id/next", async (c) => {
    const b = await c.req.json();
    return c.json(
      await service.recommend(
        c.req.param("id"),
        c.req.header("X-Guest-Token") ?? "",
        b?.interactionId,
      ),
      201,
    );
  });
  app.put("/interactions/:id/feedback", async (c) =>
    c.json(
      await service.feedback(
        c.req.param("id"),
        c.req.header("X-Guest-Token") ?? "",
        await c.req.json(),
      ),
    ),
  );
  app.get("/sessions/:id/summary", async (c) =>
    c.json(
      await service.summary(
        c.req.param("id"),
        c.req.header("X-Guest-Token") ?? "",
      ),
    ),
  );
  return app;
}
