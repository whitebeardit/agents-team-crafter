import type { FastifyReply, FastifyRequest } from 'fastify';
import type { IEnv } from '../../config/env.js';

/**
 * Cabeçalhos que o front envia em `fetch` (JWT, JSON, tenant). Deve bater com `app.ts` → `@fastify/cors` `allowedHeaders`.
 */
export const CORS_ALLOWED_REQUEST_HEADERS = [
  'Authorization',
  'Content-Type',
  'X-Workspace-Id',
  'If-Match',
] as const;

/**
 * Normaliza o header `Origin` (e entradas de `CORS_ORIGIN`) para comparação estável:
 * trim e remove barra final (ex.: `https://app.example/` vs `https://app.example`).
 */
export function normalizeCorsOrigin(raw: string): string {
  let s = raw.trim();
  while (s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

/**
 * Rotas SSE mantêm o corpo aberto por mais tempo e precisam dos mesmos cabeçalhos
 * CORS do `@fastify/cors` antes do primeiro chunk do stream.
 *
 * Com `CORS_ORIGIN` explícito (lista separada por vírgulas), inclua o origin exato do browser
 * (ex.: `https://myteams.whitebeard.dev` — sem barra final; a comparação normaliza barra final).
 * Com front em outro host e API em `api.*`, o preflight (OPTIONS) e o stream precisam desse origin na lista.
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
  const allowed = env.CORS_ORIGIN
    .split(',')
    .map((s) => normalizeCorsOrigin(s))
    .filter(Boolean);
  const normalizedRequest = requestOrigin ? normalizeCorsOrigin(requestOrigin) : undefined;
  if (normalizedRequest && allowed.includes(normalizedRequest)) {
    reply.header('Access-Control-Allow-Origin', requestOrigin!);
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Vary', 'Origin');
  }
}
