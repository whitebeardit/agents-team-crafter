import { Redis } from 'ioredis';

/** Opções alinhadas ao uso anterior (pub/sub + comandos). */
const defaultOptions = { maxRetriesPerRequest: 2 } as const;

/**
 * Cliente Redis partilhado pela aplicação quando `REDIS_URL` está definido:
 * - pub/sub do team live (`TeamLiveBroadcaster` usa este cliente para `publish` e `duplicate()` para `subscribe`)
 * - rate limit de governança (`INCR` / `EXPIRE` / `TTL`)
 *
 * Uma única conexão TCP evita duplicar pools e facilita operação em cluster.
 */
export function createRedisAppClient(redisUrl: string | undefined): Redis | null {
  if (!redisUrl?.trim()) return null;
  return new Redis(redisUrl, defaultOptions);
}

export function disconnectRedisAppClient(client: Redis | null | undefined): void {
  if (client) client.disconnect();
}
