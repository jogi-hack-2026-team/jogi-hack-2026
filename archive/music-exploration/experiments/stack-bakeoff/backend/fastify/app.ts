import Fastify from "fastify";
import { ApiError, Service } from "../shared/service.ts";
export function createApp(service = new Service()) {
  const app = Fastify({ logger: false }); // Harness records status/timing only; no guest tokens or bodies.
  app.addHook("onRequest", async (request, reply) => {
    if (
      ["http://127.0.0.1:4173", "http://127.0.0.1:4174"].includes(
        request.headers.origin ?? "",
      )
    )
      reply
        .header("Access-Control-Allow-Origin", request.headers.origin)
        .header("Vary", "Origin");
    reply
      .header("Access-Control-Allow-Headers", "Content-Type,X-Guest-Token")
      .header("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
    if (request.method === "OPTIONS") return reply.status(204).send();
  });
  app.setErrorHandler((error, request, reply) => {
    const status =
      error instanceof ApiError
        ? error.status
        : (error as { statusCode?: number }).statusCode === 400
          ? 400
          : 500;
    reply.status(status).send({
      error:
        error instanceof ApiError
          ? error.code
          : status === 400
            ? "INVALID_JSON"
            : "INTERNAL_ERROR",
    });
  });
  app.get("/tracks", async () => await service.external());
  app.post("/sessions", async (request, reply) =>
    reply.status(201).send(await service.createSession(request.body)),
  );
  app.post<{ Body: { sessionId: string; interactionId: string } }>(
    "/interactions",
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await service.recommend(
            request.body?.sessionId,
            String(request.headers["x-guest-token"] ?? ""),
            request.body?.interactionId,
          ),
        ),
  );
  app.post<{ Params: { id: string }; Body: { interactionId: string } }>(
    "/sessions/:id/next",
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await service.recommend(
            request.params.id,
            String(request.headers["x-guest-token"] ?? ""),
            request.body?.interactionId,
          ),
        ),
  );
  app.put<{ Params: { id: string } }>(
    "/interactions/:id/feedback",
    async (request) =>
      await service.feedback(
        request.params.id,
        String(request.headers["x-guest-token"] ?? ""),
        request.body,
      ),
  );
  app.get<{ Params: { id: string } }>(
    "/sessions/:id/summary",
    async (request) =>
      await service.summary(
        request.params.id,
        String(request.headers["x-guest-token"] ?? ""),
      ),
  );
  return app;
}
