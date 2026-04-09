import { describe, expect, it } from '@jest/globals';
import { computeLatencyPercentilesMs, percentileLinear } from './governance-latency.util.js';

describe('governance-latency.util', () => {
  it('percentileLinear matches sorted array', () => {
    const s = [10, 20, 30, 40, 50];
    expect(percentileLinear(s, 0)).toBe(10);
    expect(percentileLinear(s, 1)).toBe(50);
    expect(percentileLinear(s, 0.5)).toBe(30);
  });

  it('computeLatencyPercentilesMs returns zero samples when empty', () => {
    const p = computeLatencyPercentilesMs([]);
    expect(p!.sampleCount).toBe(0);
  });

  it('computeLatencyPercentilesMs for known set', () => {
    const ms = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    const p = computeLatencyPercentilesMs(ms);
    expect(p?.sampleCount).toBe(10);
    expect(p?.p50Ms).toBeGreaterThan(0);
    expect(p?.p99Ms).toBeGreaterThanOrEqual(p!.p95Ms!);
    expect(p?.p95Ms).toBeGreaterThanOrEqual(p!.p90Ms!);
  });
});
