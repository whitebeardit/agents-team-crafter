import type { Redis } from 'ioredis';

/**
 * Janela fixa com INCR + EXPIRE (compatível com várias instâncias quando Redis está disponível).
 * O cliente Redis vem de `createRedisAppClient` (partilhado com pub/sub do team live).
 */
export async function takeRedisFixedWindowRateLimit(
  redis: Redis,
  key: string,
  max: number,
  windowSec: number,
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const k = `ratelimit:${key}`;
  const n = await redis.incr(k);
  if (n === 1) {
    await redis.expire(k, windowSec);
  }
  if (n > max) {
    const ttl = await redis.ttl(k);
    const retryAfterSec = ttl > 0 ? ttl : windowSec;
    return { ok: false, retryAfterSec };
  }
  return { ok: true };
}
