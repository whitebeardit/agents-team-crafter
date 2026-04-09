/**
 * Rate limit em memória (sliding window) por chave — adequado a um único processo.
 * Para cluster, usar Redis ou gateway.
 */
const buckets = new Map<string, number[]>();

export function takeSimpleRateLimit(opts: {
  key: string;
  max: number;
  windowMs: number;
}): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  const cut = now - opts.windowMs;
  const arr = (buckets.get(opts.key) ?? []).filter((t) => t > cut);
  if (arr.length >= opts.max) {
    const oldest = arr[0]!;
    const retryAfterMs = opts.windowMs - (now - oldest);
    return { ok: false, retryAfterMs: Math.max(0, Math.ceil(retryAfterMs)) };
  }
  arr.push(now);
  buckets.set(opts.key, arr);
  return { ok: true };
}
