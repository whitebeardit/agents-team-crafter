import { describe, expect, it } from '@jest/globals';
import { buildUtcCalendarWindow, enumerateUtcDaysInclusive, startOfUtcDay } from './governance-date-range.js';

describe('governance-date-range', () => {
  it('buildUtcCalendarWindow returns consecutive day keys', () => {
    const w = buildUtcCalendarWindow(5);
    expect(w.dayKeysUtc.length).toBe(5);
    for (let i = 1; i < w.dayKeysUtc.length; i++) {
      const prev = w.dayKeysUtc[i - 1]!;
      const cur = w.dayKeysUtc[i]!;
      expect(/^\d{4}-\d{2}-\d{2}$/.test(cur)).toBe(true);
      expect(cur > prev).toBe(true);
    }
  });

  it('enumerateUtcDaysInclusive matches span', () => {
    const a = new Date(Date.UTC(2026, 0, 10));
    const b = new Date(Date.UTC(2026, 0, 12));
    expect(enumerateUtcDaysInclusive(a, b)).toEqual(['2026-01-10', '2026-01-11', '2026-01-12']);
  });

  it('startOfUtcDay normalizes to midnight UTC', () => {
    const d = new Date('2026-03-15T14:30:00.000Z');
    expect(startOfUtcDay(d).toISOString()).toBe('2026-03-15T00:00:00.000Z');
  });
});
