import fastifyStatic from '@fastify/static';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { resolve, sep } from 'node:path';
import type { Pool } from 'pg';
import { Health } from './contracts/index.ts';
import { errorBody } from './http/errors.ts';

export type AppOptions = {
  pool: Pool;
  /** ビルド済みSPAのディレクトリ。指定時は同一originで配信する。 */
  webDist?: string | undefined;
  /** false でログを止める（テスト用）。 */
  logger?: boolean;
  logLevel?: string;
};

type PgError = FastifyError & { code?: string };

const JSON_404 = errorBody('NOT_FOUND', 'No such route.');

export async function buildApp(o: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      o.logger === false
        ? false
        : {
            level: o.logLevel ?? 'info',
            // 認証情報・Cookieはログへ出さない（障害調査に必要な最小ログに留める）。
            redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
          },
    // 契約違反を黙って受理しない: 未知の項目を削らず、型を変換せず、違反をすべて報告する。
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false, allErrors: true } },
  });

  // 終了処理中に完了した応答がkeep-alive接続を維持しないようにし、処理中の要求を完了させてから閉じる。
  app.addHook('onSend', async (_request, reply, payload) => {
    if (!app.server.listening) reply.header('connection', 'close');
    return payload;
  });

  app.setErrorHandler((error: PgError, request, reply) => {
    if (error.validation) {
      return reply.code(422).send(
        errorBody(
          'VALIDATION_ERROR',
          'Request does not match the contract.',
          error.validation.map((v) => {
            const params = v.params as { additionalProperty?: string; missingProperty?: string };
            const extra = params.additionalProperty ?? params.missingProperty;
            return {
              path: `${error.validationContext ?? 'body'}${v.instancePath}${extra ? `/${extra}` : ''}`,
              message: v.message ?? 'invalid',
            };
          }),
        ),
      );
    }
    // PostgreSQLの制約違反（一意: 23505、CHECK: 23514）も契約違反として422で返す。
    if (error.code === '23505' || error.code === '23514') {
      return reply.code(422).send(errorBody('CONSTRAINT_VIOLATION', 'Rejected by a database constraint.'));
    }
    if (typeof error.statusCode === 'number' && error.statusCode < 500) {
      return reply.code(error.statusCode).send(errorBody('BAD_REQUEST', error.message));
    }
    request.log.error(error);
    return reply.code(500).send(errorBody('INTERNAL', 'Internal error.'));
  });

  // Type Providerはpluginごとに適用する（Fastifyのカプセル化により外側の指定は継承されない）。
  await app.register(async (instance) => {
    const api = instance.withTypeProvider<TypeBoxTypeProvider>();
    api.get('/api/health', { schema: { response: { 200: Health, 503: Health } } }, async (request, reply) => {
      try {
        await o.pool.query('select 1');
        return { status: 'ok', database: 'ok' } as const;
      } catch (error) {
        request.log.warn({ err: error }, 'health: database unreachable');
        return reply.code(503).send({ status: 'error', database: 'unreachable' });
      }
    });
  });

  if (o.webDist) {
    const root = resolve(o.webDist);
    await app.register(fastifyStatic, {
      root,
      wildcard: false,
      cacheControl: false,
      setHeaders(reply, pathName) {
        // Viteのassetsはファイル名にhashを含むため長期キャッシュ、index.htmlは毎回再検証する。
        reply.header('cache-control', pathName.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
      },
    });
    app.setNotFoundHandler((request, reply) => {
      const path = request.url.split('?')[0] ?? '';
      const lastSegment = path.slice(path.lastIndexOf('/') + 1);
      // 存在しないAPI、対象外のmethod、拡張子付きのファイル要求にはSPAのHTMLを返さない。
      if (path.startsWith('/api/') || (request.method !== 'GET' && request.method !== 'HEAD') || lastSegment.includes('.')) {
        return reply.code(404).send(JSON_404);
      }
      return reply.header('cache-control', 'no-cache').sendFile('index.html');
    });
  } else {
    app.setNotFoundHandler((_request, reply) => reply.code(404).send(JSON_404));
  }

  return app;
}
