import type { FastifyReply, FastifyRequest } from 'fastify';
import type { IEnv } from '../../config/env.js';

/**
 * Rotas que fazem `reply.raw.flushHeaders()` antes do ciclo normal do Fastify
 * não recebem cabeçalhos do `@fastify/cors`. Espelha a mesma política de `app.ts`.
 *
 * Com `CORS_ORIGIN` explícito (lista separada por vírgulas), inclua o origin do front,
 * por exemplo `https://myteams.whitebeard.dev`.
 */
export function applyCorsHeaders(req: FastifyRequest, reply: FastifyReply, env: IEnv): void {
  const requestOrigin = req.headers.origin;
  if (env.CORS_ORIGIN === '*') {
    if (requestOrigin) {
      reply.header('Access-Control-Allow-Origin', requestOrigin);
      reply.header('Access-Control-Allow-Credentials', 'true');
      reply.header('Vary', 'Origin');
    } else {
      reply.header('Access-Control-Allow-Origin', '*');
    }
    return;
  }
  const allowed = env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
  if (requestOrigin && allowed.includes(requestOrigin)) {
    reply.header('Access-Control-Allow-Origin', requestOrigin);
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Vary', 'Origin');
  }
}
