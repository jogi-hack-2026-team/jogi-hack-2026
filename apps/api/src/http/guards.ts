import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyInstance } from 'fastify';
import type { Auth } from '../auth/options.ts';
import { errorBody } from './errors.ts';

declare module 'fastify' {
  interface FastifyRequest {
    /** セッション確認済みのユーザーID。保護されたAPIのhandlerだけが参照する。 */
    userId: string;
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const PUBLIC_PATHS = new Set(['/api/health']);

export const ORIGIN_REJECTED = errorBody('ORIGIN_REJECTED', 'Same-origin request required.');
export const UNAUTHENTICATED = errorBody('UNAUTHENTICATED', 'Sign in required.');

// `/api/*`は既定で保護する（route未定義のpathも401にし、追加し忘れで公開されないようにする）。
// 例外は`/api/health`と、Better Authが自前でOrigin・セッションを扱う`/api/auth/*`だけ。
// 状態を変える要求は同一originのOriginヘッダーを必須にする（SameSite=Laxだけでは同一siteの別originを防げない。#84 F-8）。
export function registerApiGuards(app: FastifyInstance, auth: Auth, allowedOrigins: readonly string[]): void {
  app.decorateRequest('userId', '');
  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0] ?? '';
    if (!path.startsWith('/api/') || PUBLIC_PATHS.has(path) || path.startsWith('/api/auth/')) return;
    if (!SAFE_METHODS.has(request.method) && !allowedOrigins.includes(request.headers.origin ?? '')) {
      return reply.code(403).send(ORIGIN_REJECTED);
    }
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session) return reply.code(401).send(UNAUTHENTICATED);
    request.userId = session.user.id;
  });
}
