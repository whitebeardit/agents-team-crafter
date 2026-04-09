/** Início do dia UTC correspondente ao instante `d`. */
export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Janela de `days` dias corridos em UTC terminando no dia de `until` (inclusive).
 * Ex.: days=14 → 14 chaves YYYY-MM-DD desde (hoje UTC - 13 dias) até hoje UTC.
 */
export function buildUtcCalendarWindow(days: number): {
  sinceStartOfFirstDayUtc: Date;
  until: Date;
  dayKeysUtc: string[];
} {
  const until = new Date();
  const endDay = startOfUtcDay(until);
  const sinceStartOfFirstDayUtc = new Date(endDay);
  sinceStartOfFirstDayUtc.setUTCDate(sinceStartOfFirstDayUtc.getUTCDate() - (days - 1));
  const dayKeysUtc = enumerateUtcDaysInclusive(sinceStartOfFirstDayUtc, endDay);
  return { sinceStartOfFirstDayUtc, until, dayKeysUtc };
}

export function enumerateUtcDaysInclusive(fromStartOfDayUtc: Date, toStartOfDayUtc: Date): string[] {
  const start = startOfUtcDay(fromStartOfDayUtc);
  const end = startOfUtcDay(toStartOfDayUtc);
  const out: string[] = [];
  const d = new Date(start);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
