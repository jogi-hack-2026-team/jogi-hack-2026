import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { TRUSTED_IP_HEADER, type Auth } from './options.ts';

// FastifyのrequestをFetch APIのRequestへ変換してBetter Authへ渡す。公式ガイドの形に#84で見つけた3点を足す。
// 1) URLは設定済みbaseURLから作る（client制御のHost headerを使わない）
// 2) 回数制限の鍵になるclient IPはFastifyのtrustProxy判定の結果だけを渡す（X-Forwarded-Forの偽装で回避させない）
// 3) Set-Cookieは複数行をそのまま転送する（sign-outは複数のCookieを消す）
export function registerAuthBridge(app: FastifyInstance, auth: Auth, baseURL: string): void {
  async function bridge(request: FastifyRequest, reply: FastifyReply) {
    const url = new URL(request.url, baseURL);
    const headers = fromNodeHeaders(request.headers);
    headers.delete(TRUSTED_IP_HEADER);
    headers.set(TRUSTED_IP_HEADER, request.ip);
    headers.delete('content-length'); // bodyを再直列化するため元の長さは使えない
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD' && request.body != null;
    const response = await auth.handler(
      new Request(url, { method: request.method, headers, ...(hasBody ? { body: JSON.stringify(request.body) } : {}) }),
    );
    reply.status(response.status);
    for (const [key, value] of response.headers) {
      if (key.toLowerCase() !== 'set-cookie') reply.header(key, value);
    }
    const cookies = response.headers.getSetCookie();
    if (cookies.length) reply.header('set-cookie', cookies);
    return reply.send(response.body ? Buffer.from(await response.arrayBuffer()) : null);
  }
  app.route({ method: ['GET', 'POST'], url: '/api/auth/*', handler: bridge });
}
