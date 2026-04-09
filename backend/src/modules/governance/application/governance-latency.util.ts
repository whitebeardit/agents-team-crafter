/** Percentil linear (tipo Excel `PERCENTILE.INC`) sobre array ordenado. */
export function percentileLinear(sortedAsc: number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  if (p <= 0) return sortedAsc[0]!;
  if (p >= 1) return sortedAsc[sortedAsc.length - 1]!;
  const n = sortedAsc.length;
  if (n === 1) return sortedAsc[0]!;
  const pos = (n - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo]!;
  const w = pos - lo;
  return sortedAsc[lo]! * (1 - w) + sortedAsc[hi]! * w;
}

export interface ILatencyPercentilesMs {
  p50Ms: number | null;
  p90Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
  sampleCount: number;
}

export function computeLatencyPercentilesMs(ms: number[]): ILatencyPercentilesMs | null {
  if (ms.length === 0) {
    return { p50Ms: null, p90Ms: null, p95Ms: null, p99Ms: null, sampleCount: 0 };
  }
  const sorted = [...ms].sort((a, b) => a - b);
  return {
    p50Ms: percentileLinear(sorted, 0.5),
    p90Ms: percentileLinear(sorted, 0.9),
    p95Ms: percentileLinear(sorted, 0.95),
    p99Ms: percentileLinear(sorted, 0.99),
    sampleCount: sorted.length,
  };
}
