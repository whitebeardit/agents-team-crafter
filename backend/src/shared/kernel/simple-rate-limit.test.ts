import { describe, expect, it } from '@jest/globals';
import { takeSimpleRateLimit } from './simple-rate-limit.js';

describe('takeSimpleRateLimit', () => {
  it('allows requests under the cap', () => {
    const k = `t-${Date.now()}-a`;
    expect(takeSimpleRateLimit({ key: k, max: 2, windowMs: 60_000 }).ok).toBe(true);
    expect(takeSimpleRateLimit({ key: k, max: 2, windowMs: 60_000 }).ok).toBe(true);
  });

  it('rejects when cap exceeded', () => {
    const k = `t-${Date.now()}-b`;
    expect(takeSimpleRateLimit({ key: k, max: 1, windowMs: 60_000 }).ok).toBe(true);
    const second = takeSimpleRateLimit({ key: k, max: 1, windowMs: 60_000 });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.retryAfterMs).toBeGreaterThan(0);
  });
});
