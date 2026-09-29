import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  tracks,
  ratings,
  type Rating,
  type Interaction,
} from "../../shared/contract.ts";
import {
  context,
  dot,
  gaussian,
  prior,
  sample,
  update,
  type Posterior,
} from "./lints.ts";
import { pool, transaction } from "./database.ts";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new ApiError(400, "INVALID_INPUT");
  return v as Record<string, unknown>;
};
async function session(client: PoolClient, id: string, token: string) {
  if (!uuid(id) || !uuid(token)) throw new ApiError(401, "GUEST_REQUIRED");
  const { rows } = await client.query(
    "SELECT * FROM sessions WHERE id=$1 AND token_hash=$2 FOR UPDATE",
    [id, hash(token)],
  );
  if (!rows[0]) throw new ApiError(404, "SESSION_NOT_FOUND");
  return rows[0] as {
    id: string;
    seeds: string[];
    posterior: Posterior;
    version: number;
  };
}
export interface Hooks {
  failTrace?: boolean;
  normal?: () => number;
  external?: (signal: AbortSignal) => Promise<Response>;
  timeoutMs?: number;
}
export class Service {
  constructor(private hooks: Hooks = {}) {}
  async createSession(input: unknown) {
    const { seeds } = object(input);
    if (
      !Array.isArray(seeds) ||
      seeds.length < 3 ||
      seeds.length > 5 ||
      new Set(seeds).size !== seeds.length ||
      !seeds.every((id) => tracks.some((t) => t.id === id))
    )
      throw new ApiError(400, "INVALID_SEEDS");
    const id = randomUUID(),
      token = randomUUID();
    await pool.query(
      "INSERT INTO sessions(id, token_hash, seeds, posterior) VALUES ($1,$2,$3,$4)",
      [id, hash(token), JSON.stringify(seeds), JSON.stringify(prior())],
    );
    return { id, token };
  }
  async recommend(id: string, token: string, interactionId: unknown) {
    if (!uuid(interactionId)) throw new ApiError(400, "INVALID_INTERACTION_ID");
    return transaction(async (client) => {
      const s = await session(client, id, token);
      const existing = await client.query(
        "SELECT i.*,t.decision FROM interactions i JOIN traces t ON t.interaction_id=i.id WHERE i.id=$1",
        [interactionId],
      );
      if (existing.rows[0]) {
        const row = existing.rows[0];
        if (row.session_id !== id) throw new ApiError(409, "ID_CONFLICT");
        return this.serialize(row);
      }
      const { rows: previous } = await client.query(
        "SELECT * FROM interactions WHERE session_id=$1 ORDER BY sequence",
        [id],
      );
      if (previous.length >= 5) throw new ApiError(409, "CHECKPOINT_REACHED");
      const candidates = tracks.filter(
        (t) =>
          !s.seeds.includes(t.id) && !previous.some((p) => p.track_id === t.id),
      );
      const theta = sample(s.posterior, this.hooks.normal ?? gaussian);
      const scored = candidates.map((track) => {
        const anchors = s.seeds.map((seed) =>
          tracks.find((t) => t.id === seed)!,
        );
        const anchor = anchors.reduce((a, b) =>
          dot(
            context(track.features, a.features),
            context(track.features, a.features),
          ) <=
          dot(
            context(track.features, b.features),
            context(track.features, b.features),
          )
            ? a
            : b,
        );
        const x = context(track.features, anchor.features);
        return {
          track,
          anchor,
          x,
          score: dot(theta, x),
          distance: x.slice(0, 7).reduce((a, b) => a + b, 0),
        };
      });
      const mayProbe =
        previous.length > 0 &&
        previous.at(-1).candidate_type !== "PROBE" &&
        previous.filter((p) => p.candidate_type === "PROBE").length < 2;
      // PoC adaptive rule: a negative canonical rating enables a contrastive pool.
      const negative = await client.query(
        "SELECT 1 FROM feedback f JOIN interactions i ON i.id=f.interaction_id WHERE i.session_id=$1 AND rating='DISLIKE' LIMIT 1",
        [id],
      );
      const probe = mayProbe && negative.rowCount! > 0;
      const ordered = [...scored].sort((a, b) => a.distance - b.distance);
      const split = Math.ceil(ordered.length / 2);
      const eligible = probe ? ordered.slice(split) : ordered.slice(0, split);
      const chosen = eligible.reduce((a, b) => (a.score >= b.score ? a : b));
      const decision: Interaction["decisionTrace"] = {
        context: chosen.x,
        theta,
        score: chosen.score,
        preferenceVersion: s.version,
        policy: "poc-lints-v1-percentile-distance",
        candidates: eligible.map((c) => ({
          trackId: c.track.id,
          score: c.score,
        })),
      };
      await client.query("INSERT INTO interactions VALUES($1,$2,$3,$4,$5,$6)", [
        interactionId,
        id,
        previous.length + 1,
        chosen.track.id,
        chosen.anchor.id,
        probe ? "PROBE" : "RELEVANT",
      ]);
      await client.query("INSERT INTO traces VALUES($1,$2)", [
        interactionId,
        this.hooks.failTrace ? null : JSON.stringify(decision),
      ]);
      return {
        interactionId,
        trackId: chosen.track.id,
        anchorId: chosen.anchor.id,
        candidateType: probe ? "PROBE" : "RELEVANT",
        decisionTrace: decision,
      } as Interaction;
    });
  }
  private serialize(row: any): Interaction {
    return {
      interactionId: row.id,
      trackId: row.track_id,
      anchorId: row.anchor_id,
      candidateType: row.candidate_type,
      decisionTrace: row.decision,
    };
  }
  async feedback(interactionId: string, token: string, input: unknown) {
    const { rating, expectedRevision } = object(input);
    if (
      !uuid(interactionId) ||
      !ratings.includes(rating as Rating) ||
      !Number.isInteger(expectedRevision) ||
      (expectedRevision as number) < 0
    )
      throw new ApiError(400, "INVALID_FEEDBACK");
    return transaction(async (client) => {
      const found = await client.query(
        "SELECT session_id FROM interactions WHERE id=$1",
        [interactionId],
      );
      if (!found.rows[0]) throw new ApiError(404, "INTERACTION_NOT_FOUND");
      const s = await session(client, found.rows[0].session_id, token);
      const { rows } = await client.query(
        "SELECT * FROM feedback WHERE interaction_id=$1",
        [interactionId],
      );
      const current = rows[0],
        revision = current?.revision ?? 0;
      if (current?.rating === rating && expectedRevision === revision - 1)
        return {
          revision,
          preferenceVersion: s.version,
          evidenceCount: s.posterior.evidenceCount,
        };
      if (expectedRevision !== revision)
        throw new ApiError(409, "REVISION_CONFLICT");
      if (current?.rating === rating)
        return {
          revision,
          preferenceVersion: s.version,
          evidenceCount: s.posterior.evidenceCount,
        };
      await client.query(
        "INSERT INTO feedback VALUES($1,$2,$3) ON CONFLICT(interaction_id) DO UPDATE SET rating=EXCLUDED.rating, revision=EXCLUDED.revision",
        [interactionId, rating, revision + 1],
      );
      const canonical = await client.query(
        "SELECT f.rating,t.decision FROM feedback f JOIN interactions i ON i.id=f.interaction_id JOIN traces t ON t.interaction_id=i.id WHERE i.session_id=$1 ORDER BY i.sequence",
        [s.id],
      );
      const posterior = prior();
      for (const row of canonical.rows)
        if (row.rating !== "UNSURE")
          update(
            posterior,
            row.decision.context,
            row.rating === "LIKE" ? 1 : row.rating === "DISLIKE" ? -1 : 0,
          );
      await client.query(
        "UPDATE sessions SET posterior=$2,version=version+1 WHERE id=$1",
        [s.id, JSON.stringify(posterior)],
      );
      return {
        revision: revision + 1,
        preferenceVersion: s.version + 1,
        evidenceCount: posterior.evidenceCount,
      };
    });
  }
  async summary(id: string, token: string) {
    return transaction(async (client) => {
      const s = await session(client, id, token);
      return {
        preferenceVersion: s.version,
        posterior: s.posterior,
        seeds: s.seeds,
      };
    });
  }
  async external() {
    const request =
      this.hooks.external ??
      (async () => new Response(JSON.stringify(tracks), { status: 200 }));
    try {
      const response = await request(
        AbortSignal.timeout(this.hooks.timeoutMs ?? 50),
      );
      if (response.status === 429)
        throw new ApiError(503, "UPSTREAM_RATE_LIMIT");
      if (!response.ok) throw new ApiError(502, "UPSTREAM_FAILURE");
      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (
        error instanceof Error &&
        ["AbortError", "TimeoutError"].includes(error.name)
      )
        throw new ApiError(504, "UPSTREAM_TIMEOUT");
      throw new ApiError(502, "UPSTREAM_FAILURE");
    }
  }
}
