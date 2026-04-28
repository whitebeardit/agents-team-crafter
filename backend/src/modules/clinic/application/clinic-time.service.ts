import { DateTime } from 'luxon';
import type { WorkspaceRepository } from '../../workspaces/infra/workspace.repository.js';
import { recordClinicTimezoneResolution } from '../../../app/metrics.js';

export type ClinicLocalNow = {
  /** ISO datetime in clinic timezone, e.g. 2026-04-27T22:49:00.000-03:00 */
  localNowIso: string;
  /** ISO date in clinic timezone, e.g. 2026-04-27 */
  localDate: string;
  /** IANA timezone, e.g. America/Sao_Paulo */
  timezone: string;
};

export interface IClinicTimeService {
  resolveClinicTimezone(workspaceId: string): Promise<string>;
  nowLocal(workspaceId: string): Promise<ClinicLocalNow>;
  resolveLocalDateExpression(input: string, reference: Date, timezone: string): string;
  parseLocalTimeExpression(input: string): { hour: number; minute: number };
  buildAppointmentRange(input: {
    localDate: string;
    localTime: string;
    durationMinutes: number;
    timezone: string;
  }): { startsAt: string; endsAt: string };
  localDayRangeUtc(input: { date: string; timezone: string }): { startUtc: Date; endUtc: Date };
}

export class ClinicTimeService implements IClinicTimeService {
  static readonly DEFAULT_TIMEZONE = 'America/Sao_Paulo';
  static readonly DEFAULT_SESSION_DURATION_MINUTES = 50;

  constructor(private readonly workspaces: WorkspaceRepository) {}

  async resolveClinicTimezone(workspaceId: string): Promise<string> {
    const ws = await this.workspaces.findById(workspaceId);
    const settings = (ws?.settings ?? {}) as Record<string, unknown>;
    const tz = typeof settings.clinicTimezone === 'string' ? settings.clinicTimezone.trim() : '';
    if (tz) {
      recordClinicTimezoneResolution('workspace_setting');
      return tz;
    }
    recordClinicTimezoneResolution('default');
    return ClinicTimeService.DEFAULT_TIMEZONE;
  }

  async nowLocal(workspaceId: string): Promise<ClinicLocalNow> {
    const timezone = await this.resolveClinicTimezone(workspaceId);
    const now = DateTime.fromMillis(Date.now(), { zone: timezone });
    return {
      localNowIso: now.toISO() ?? now.toString(),
      localDate: now.toISODate() ?? now.toFormat('yyyy-LL-dd'),
      timezone,
    };
  }

  resolveLocalDateExpression(input: string, reference: Date, timezone: string): string {
    const raw = (input ?? '').toString().trim().toLowerCase();
    const ref = DateTime.fromJSDate(reference, { zone: timezone });

    if (!raw || raw === 'hoje' || raw === 'today') return ref.toISODate()!;
    if (raw === 'amanhã' || raw === 'amanha' || raw === 'tomorrow') return ref.plus({ days: 1 }).toISODate()!;
    if (raw === 'ontem' || raw === 'yesterday') return ref.minus({ days: 1 }).toISODate()!;

    // Accept ISO date (YYYY-MM-DD) and common BR date (DD/MM/YYYY).
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) {
      const [, dd, mm, yyyy] = br;
      return `${yyyy}-${mm}-${dd}`;
    }

    // Fallback: try luxon parsing in clinic zone.
    const parsed = DateTime.fromISO(raw, { zone: timezone });
    if (parsed.isValid) return parsed.toISODate()!;
    throw new Error(`dateExpression invalida: ${input}`);
  }

  parseLocalTimeExpression(input: string): { hour: number; minute: number } {
    const raw = (input ?? '').toString().trim().toLowerCase();
    if (!raw) throw new Error('timeExpression obrigatorio');

    // Formats: "17h", "17:30", "17h30", "22:30"
    const m1 = raw.match(/^(\d{1,2})\s*h(?:\s*(\d{1,2}))?$/);
    const m2 = raw.match(/^(\d{1,2}):(\d{2})$/);
    const hour = Number((m1?.[1] ?? m2?.[1]) ?? NaN);
    const minute = Number((m1?.[2] ?? m2?.[2] ?? '0') ?? NaN);

    if (!Number.isFinite(hour) || hour < 0 || hour > 23) throw new Error(`hora invalida: ${input}`);
    if (!Number.isFinite(minute) || minute < 0 || minute > 59) throw new Error(`minuto invalido: ${input}`);
    return { hour, minute };
  }

  buildAppointmentRange(input: {
    localDate: string;
    localTime: string;
    durationMinutes: number;
    timezone: string;
  }): { startsAt: string; endsAt: string } {
    const durationMinutes =
      Number.isFinite(input.durationMinutes) && input.durationMinutes > 0
        ? Math.floor(input.durationMinutes)
        : ClinicTimeService.DEFAULT_SESSION_DURATION_MINUTES;

    const { hour, minute } = this.parseLocalTimeExpression(input.localTime);
    const startLocal = DateTime.fromISO(`${input.localDate}T00:00:00`, { zone: input.timezone })
      .set({ hour, minute, second: 0, millisecond: 0 });
    if (!startLocal.isValid) throw new Error('data/hora local invalida');
    const endLocal = startLocal.plus({ minutes: durationMinutes });
    return { startsAt: startLocal.toUTC().toISO()!, endsAt: endLocal.toUTC().toISO()! };
  }

  localDayRangeUtc(input: { date: string; timezone: string }): { startUtc: Date; endUtc: Date } {
    const day = DateTime.fromISO(`${input.date}T00:00:00`, { zone: input.timezone });
    if (!day.isValid) throw new Error(`data invalida: ${input.date}`);
    const startLocal = day.startOf('day');
    const endLocal = day.endOf('day');
    return { startUtc: startLocal.toUTC().toJSDate(), endUtc: endLocal.toUTC().toJSDate() };
  }
}

