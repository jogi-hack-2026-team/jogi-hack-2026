// Supporting Artifact / Not a Source of Truth (Issue #84).
import fastifyStatic from '@fastify/static';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { fromNodeHeaders } from 'better-auth/node';
import Fastify, { type FastifyReply, type FastifyRequest, type FastifyServerOptions } from 'fastify';
import { createHistogram, monitorEventLoopDelay, performance } from 'node:perf_hooks';
import type { Pool, PoolClient } from 'pg';
import type { Auth } from './auth.ts';
import { ErrorBody, Goal, GoalCreate, GoalParams, Log, LogParams, LogPut, Today } from './contracts.ts';
import { burnCpu } from './predict-placeholder.ts';
import { PredictPool } from './predict-pool.ts';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

export const TRUSTED_IP_HEADER = 'x-spike-client-ip';

export type AppConfig = {
  pool: Pool;
  auth: Auth;
  baseURL: string;
  /** 'docs' = handler exactly as in the Better Auth Fastify guide. 'hardened' = fixes found in this spike. */
  bridge: 'docs' | 'hardened';
  /** 'default' = Fastify's default Ajv options. 'strict' = removeAdditional/coerceTypes off. */
  ajvMode: 'default' | 'strict';
  trustProxyHops: number;
  predict: { burnMs: number; mode: 'inline' | 'worker'; workers: number };
  metrics: boolean;
  webDist?: string;
  logger: boolean;
  /** Verification-only server receipt trace; do not record credentials or body. */
  observeRequest?: (r: { method: string; path: string; cookiePresent: boolean }) => void;
};

const nsToMs = (n: number) => Math.round((n / 1e6) * 100) / 100;

export async function buildApp(c: AppConfig) {
  const options: FastifyServerOptions = {
    logger: c.logger
      ? { level: 'info', redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'] }
      : false,
    // Trust exactly N proxy hops (same semantics as Fastify's numeric trustProxy).
    trustProxy: c.trustProxyHops > 0 ? (_address: string, hop: number) => hop < c.trustProxyHops : false,
    // strict: reject unknown properties instead of dropping them, no type coercion, report every error.
    ajv: c.ajvMode === 'strict' ? { customOptions: { removeAdditional: false, coerceTypes: false, allErrors: true } } : undefined,
  };
  const app = Fastify(options).withTypeProvider<TypeBoxTypeProvider>();

  const predictPool = c.predict.mode === 'worker' ? new PredictPool(c.predict.workers) : null;

  // --- metrics (spike only) ---------------------------------------------------------
  const loop = monitorEventLoopDelay({ resolution: 10 });
  const dbWait = createHistogram();
  const workerWait = createHistogram();
  let poolMaxWaiting = 0;
  let cpuStart = process.cpuUsage();
  let wallStart = performance.now();
  let sampler: NodeJS.Timeout | undefined;
  if (c.metrics) {
    loop.enable();
    sampler = setInterval(() => {
      if (c.pool.waitingCount > poolMaxWaiting) poolMaxWaiting = c.pool.waitingCount;
    }, 5);
    sampler.unref();
  }

  async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const t0 = performance.now();
    const client = await c.pool.connect();
    dbWait.record(Math.max(1, Math.round((performance.now() - t0) * 1e6)));
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }

  // --- errors: one wire format, 422 for contract violations ------------------------------
  const err = (code: string, message: string, fields?: { path: string; message: string }[]) => ({
    error: fields ? { code, message, fields } : { code, message },
  });
  // Verification-only provisional policy, NOT an adopted Product contract.
  // Compare exact Origin (scheme/host/port), independently of SameSite and Host/XFF.
  // Run before body parsing so foreign form requests cannot reach mutation handlers.
  // Auth remains under Better Auth's existing protections; do not weaken/replace them.
  const allowedMutationOrigin = new URL(c.baseURL).origin;
  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0];
    c.observeRequest?.({ method: request.method, path, cookiePresent: !!request.headers.cookie });
    if (!path.startsWith('/api/') || path.startsWith('/api/auth/') ||
        ['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
    if (request.headers.origin !== allowedMutationOrigin) {
      return reply.code(403).send(err('ORIGIN_REJECTED', 'Same-origin mutation required.'));
    }
  });
  app.setErrorHandler((error: any, request, reply) => {
    if (error.validation) {
      return reply.code(422).send(
        err(
          'VALIDATION_ERROR',
          'Request does not match the contract.',
          error.validation.map((v: any) => {
            const extra = v.params?.additionalProperty ?? v.params?.missingProperty;
            return {
              path: `${error.validationContext ?? 'body'}${v.instancePath ?? ''}${extra ? `/${extra}` : ''}`,
              message: v.message ?? 'invalid',
            };
          }),
        ),
      );
    }
    if (error.code === '23514' || error.code === '23505') {
      return reply.code(422).send(err('CONSTRAINT_VIOLATION', 'Rejected by a database constraint.'));
    }
    if (typeof error.statusCode === 'number' && error.statusCode < 500) {
      return reply.code(error.statusCode).send(err('BAD_REQUEST', error.message));
    }
    request.log.error(error);
    return reply.code(500).send(err('INTERNAL', 'Internal error.'));
  });

  // --- public: health ------------------------------------------------------------------
  app.get('/api/health', async () => {
    const r = await withClient((cl) => cl.query('select 1 as ok'));
    return { ok: r.rows[0].ok === 1, node: process.version };
  });

  // --- public: Better Auth bridge --------------------------------------------------------
  async function bridgeDocs(request: FastifyRequest, reply: FastifyReply) {
    // Verbatim shape of https://github.com/better-auth/better-auth .../integrations/fastify.mdx
    const url = new URL(request.url, `http://${request.headers.host}`);
    const headers = fromNodeHeaders(request.headers);
    const req = new Request(url.toString(), {
      method: request.method,
      headers,
      ...(request.body ? { body: JSON.stringify(request.body) } : {}),
    });
    const response = await c.auth.handler(req);
    reply.status(response.status);
    response.headers.forEach((value, key) => reply.header(key, value));
    return reply.send(response.body ? await response.text() : null);
  }

  async function bridgeHardened(request: FastifyRequest, reply: FastifyReply) {
    // 1) Build the URL from the configured base URL, not from the client-controlled Host header.
    const url = new URL(request.url, c.baseURL);
    const headers = fromNodeHeaders(request.headers);
    // 2) Give Better Auth one trusted client-IP header derived from Fastify's trustProxy logic.
    headers.delete(TRUSTED_IP_HEADER);
    headers.set(TRUSTED_IP_HEADER, request.ip);
    // 3) The body is re-serialized, so the original content-length no longer applies.
    headers.delete('content-length');
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD' && request.body != null;
    const req = new Request(url, {
      method: request.method,
      headers,
      body: hasBody ? JSON.stringify(request.body) : undefined,
    });
    const response = await c.auth.handler(req);
    reply.status(response.status);
    for (const [key, value] of response.headers) {
      if (key.toLowerCase() !== 'set-cookie') reply.header(key, value);
    }
    // 4) Forward every Set-Cookie as its own header line.
    const cookies = response.headers.getSetCookie();
    if (cookies.length) reply.header('set-cookie', cookies);
    return reply.send(response.body ? Buffer.from(await response.arrayBuffer()) : null);
  }

  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    handler: c.bridge === 'docs' ? bridgeDocs : bridgeHardened,
  });

  // --- protected: everything registered inside this plugin requires a session ------------
  await app.register(
    async (scope) => {
      // The type provider is scoped: it has to be re-applied inside every encapsulated plugin.
      const api = scope.withTypeProvider<TypeBoxTypeProvider>();
      api.decorateRequest('userId', '');
      api.addHook('preHandler', async (request, reply) => {
        const session = await c.auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
        if (!session) return reply.code(401).send(err('UNAUTHENTICATED', 'Sign in required.'));
        request.userId = session.user.id;
      });

      const toGoal = (r: any) => ({
        // The row also contains user_id / created_at. They must never reach the wire; the
        // response schema (additionalProperties: false) is what enforces that.
        ...r,
        id: r.id,
        title: r.title,
        unit: r.unit,
        totalRequired: Number(r.total_required),
        sessionAmount: Number(r.session_amount),
        initialProgress: Number(r.initial_progress),
        timezone: r.timezone,
      });

      api.get('/goals', { schema: { response: { 200: Type.Array(Goal) } } }, async (request) => {
        const r = await withClient((cl) =>
          cl.query('select * from goal where user_id = $1 order by created_at', [request.userId]),
        );
        return r.rows.map(toGoal);
      });

      api.post(
        '/goals',
        { schema: { body: GoalCreate, response: { 201: Goal, 422: ErrorBody } } },
        async (request, reply) => {
          const b = request.body;
          const r = await withClient((cl) =>
            cl.query(
              `insert into goal (user_id, title, unit, total_required, session_amount, initial_progress, timezone)
               values ($1,$2,$3,$4,$5,$6,$7) returning *`,
              [request.userId, b.title, b.unit, b.totalRequired, b.sessionAmount, b.initialProgress, b.timezone],
            ),
          );
          return reply.code(201).send(toGoal(r.rows[0]));
        },
      );

      api.get(
        '/goals/:goalId',
        { schema: { params: GoalParams, response: { 200: Goal, 404: ErrorBody } } },
        async (request, reply) => {
          const r = await withClient((cl) =>
            cl.query('select * from goal where id = $1 and user_id = $2', [request.params.goalId, request.userId]),
          );
          if (!r.rowCount) return reply.code(404).send(err('NOT_FOUND', 'Goal not found.'));
          return toGoal(r.rows[0]);
        },
      );

      api.delete(
        '/goals/:goalId',
        { schema: { params: GoalParams, response: { 204: Type.Null(), 404: ErrorBody } } },
        async (request, reply) => {
          const r = await withClient((cl) =>
            cl.query('delete from goal where id = $1 and user_id = $2', [request.params.goalId, request.userId]),
          );
          if (!r.rowCount) return reply.code(404).send(err('NOT_FOUND', 'Goal not found.'));
          return reply.code(204).send(null);
        },
      );

      api.put(
        '/goals/:goalId/logs/:localDate',
        { schema: { params: LogParams, body: LogPut, response: { 200: Log, 404: ErrorBody, 422: ErrorBody } } },
        async (request, reply) => {
          const { goalId, localDate } = request.params;
          const b = request.body;
          const amount = b.status === 'DONE' ? b.amount : null;
          // Ownership and upsert in one statement: no row is written for someone else's goal.
          const r = await withClient((cl) =>
            cl.query(
              `insert into action_log (goal_id, local_date, status, amount)
               select g.id, $3::date, $4, $5 from goal g where g.id = $1 and g.user_id = $2
               on conflict (goal_id, local_date)
               do update set status = excluded.status, amount = excluded.amount, recorded_at = now()
               returning to_char(local_date, 'YYYY-MM-DD') as "localDate", status, amount`,
              [goalId, request.userId, localDate, b.status, amount],
            ),
          );
          if (!r.rowCount) return reply.code(404).send(err('NOT_FOUND', 'Goal not found.'));
          const row = r.rows[0];
          return { localDate: row.localDate, status: row.status, amount: row.amount === null ? null : Number(row.amount) };
        },
      );

      api.get(
        '/goals/:goalId/today',
        { schema: { params: GoalParams, response: { 200: Today, 404: ErrorBody } } },
        async (request, reply) => {
          // One statement = one snapshot: the goal (incl. timezone) and its logs are consistent.
          const r = await withClient((cl) =>
            cl.query(
              `select g.timezone,
                      coalesce((select json_agg(json_build_object(
                                  'localDate', to_char(l.local_date, 'YYYY-MM-DD'),
                                  'status', l.status, 'amount', l.amount) order by l.local_date)
                                from action_log l where l.goal_id = g.id), '[]'::json) as logs
                 from goal g where g.id = $1 and g.user_id = $2`,
              [request.params.goalId, request.userId],
            ),
          );
          if (!r.rowCount) return reply.code(404).send(err('NOT_FOUND', 'Goal not found.'));
          // The DB connection is already released here. The clock is read once.
          const { timezone, logs } = r.rows[0] as { timezone: string; logs: any[] };
          const now = new Date();
          const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
          const today = fmt.format(now);
          const [y, m, d] = today.split('-').map(Number);
          const yesterday = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
          const byDate = new Map(logs.map((l) => [l.localDate, l]));
          const tl = byDate.get(today);

          if (predictPool) workerWait.record(Math.max(1, Math.round((await predictPool.run(c.predict.burnMs)) * 1e6)));
          else burnCpu(c.predict.burnMs);

          return {
            today,
            yesterday,
            todayLog: tl ? { localDate: tl.localDate, status: tl.status, amount: tl.amount === null ? null : Number(tl.amount) } : null,
            yesterdayMissing: !byDate.has(yesterday),
            prediction: {
              placeholder: true as const,
              observedDays: logs.length,
              computeMode: c.predict.mode,
              requestedBurnMs: c.predict.burnMs,
            },
          };
        },
      );
    },
    { prefix: '/api' },
  );

  // --- spike-only metrics ---------------------------------------------------------------
  if (c.metrics) {
    const hist = (h: { mean: number; max: number; percentile: (p: number) => number; count?: number }) => ({
      meanMs: nsToMs(h.mean || 0),
      p50Ms: nsToMs(h.percentile(50)),
      p95Ms: nsToMs(h.percentile(95)),
      p99Ms: nsToMs(h.percentile(99)),
      maxMs: nsToMs(h.max || 0),
    });
    app.get('/api/spike/metrics', async () => {
      const cpu = process.cpuUsage(cpuStart);
      return {
        wallMs: Math.round(performance.now() - wallStart),
        cpuUserMs: Math.round(cpu.user / 1000),
        cpuSystemMs: Math.round(cpu.system / 1000),
        rssMb: Math.round(process.memoryUsage().rss / 1048576),
        eventLoopDelay: hist(loop),
        dbAcquireWait: { count: dbWait.count, ...hist(dbWait) },
        workerQueueWait: { count: workerWait.count, ...hist(workerWait) },
        poolMaxWaiting,
        pool: { total: c.pool.totalCount, idle: c.pool.idleCount },
      };
    });
    app.post('/api/spike/metrics/reset', async () => {
      loop.reset();
      dbWait.reset();
      workerWait.reset();
      poolMaxWaiting = 0;
      cpuStart = process.cpuUsage();
      wallStart = performance.now();
      return { ok: true };
    });
  }

  // --- static SPA from the same origin; API misses must stay JSON 404 -------------------
  if (c.webDist) {
    await app.register(fastifyStatic, { root: c.webDist, wildcard: false });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/') || request.method !== 'GET') {
        return reply.code(404).send(err('NOT_FOUND', 'No such API route.'));
      }
      return reply.sendFile('index.html');
    });
  } else {
    app.setNotFoundHandler((_request, reply) => reply.code(404).send(err('NOT_FOUND', 'No such route.')));
  }

  const shutdownTrace = (phase: string) => {
    if (process.env.SPIKE_SHUTDOWN_TRACE === '1') console.log(JSON.stringify({ event: 'shutdown-resource', phase }));
  };
  app.addHook('preClose', async () => { shutdownTrace('pre-close'); });
  app.server.once('close', () => { shutdownTrace('http-server-closed'); });
  app.addHook('onClose', async () => {
    shutdownTrace('on-close-start');
    if (sampler) clearInterval(sampler);
    loop.disable();
    if (predictPool) {
      shutdownTrace('worker-close-start');
      await predictPool.close();
      shutdownTrace('worker-close-done');
    }
    shutdownTrace('on-close-done');
  });

  return app;
}
