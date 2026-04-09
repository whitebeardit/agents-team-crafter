import type { Redis } from 'ioredis';
import type { GovernanceAuditEventRepository } from '../infra/governance-audit-event.repository.js';
import { startOfUtcDay } from './governance-date-range.js';
import { deliverSloBreachWebhook } from './slo-webhook-delivery.js';

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface ISloBreachTeamInput {
  teamId: string;
  teamName: string;
  successRate: number | null;
  meetsSlo: boolean | null;
}

/**
 * Regista no máximo um evento `governance.slo_breached` por time e dia UTC (dedupe Redis ou Mongo).
 */
export async function emitSloBreachAuditEventsIfNeeded(opts: {
  workspaceId: string;
  teams: ISloBreachTeamInput[];
  windowDays: number;
  sloTargetPercent: number;
  governanceAuditRepo: GovernanceAuditEventRepository;
  redis: Redis | null;
  sloWebhookUrl?: string;
}): Promise<{ emitted: number }> {
  const breached = opts.teams.filter((t) => t.meetsSlo === false && t.successRate !== null);
  if (breached.length === 0) return { emitted: 0 };

  const dayStart = startOfUtcDay(new Date());
  const dayKey = utcDayKey(dayStart);
  let emitted = 0;

  for (const t of breached) {
    const shouldEmit = await tryAcquireSloBreachSlot({
      workspaceId: opts.workspaceId,
      teamId: t.teamId,
      dayKey,
      redis: opts.redis,
      governanceAuditRepo: opts.governanceAuditRepo,
      dayStart,
    });
    if (!shouldEmit) continue;

    await opts.governanceAuditRepo.append({
      workspaceId: opts.workspaceId,
      eventType: 'governance.slo_breached',
      payload: {
        teamId: t.teamId,
        teamName: t.teamName,
        successRate: t.successRate,
        sloTargetPercent: opts.sloTargetPercent,
        windowDays: opts.windowDays,
      },
    });
    emitted += 1;
    if (opts.sloWebhookUrl && t.successRate != null) {
      const payload = {
        schema: 'whitebeard.governance.slo_breached' as const,
        version: 1 as const,
        workspaceId: opts.workspaceId,
        teamId: t.teamId,
        teamName: t.teamName,
        successRate: t.successRate,
        sloTargetPercent: opts.sloTargetPercent,
        windowDays: opts.windowDays,
        occurredAt: new Date().toISOString(),
      };
      void deliverSloBreachWebhook(opts.sloWebhookUrl, payload);
    }
  }

  return { emitted };
}

async function tryAcquireSloBreachSlot(opts: {
  workspaceId: string;
  teamId: string;
  dayKey: string;
  redis: Redis | null;
  governanceAuditRepo: GovernanceAuditEventRepository;
  dayStart: Date;
}): Promise<boolean> {
  if (opts.redis) {
    try {
      const key = `gov:slo-alert:${opts.workspaceId}:${opts.teamId}:${opts.dayKey}`;
      const res = await opts.redis.set(key, '1', 'EX', 86400, 'NX');
      return res === 'OK';
    } catch {
      /* fallback Mongo */
    }
  }
  const exists = await opts.governanceAuditRepo.existsSloBreachForTeamSince(
    opts.workspaceId,
    opts.teamId,
    opts.dayStart,
  );
  return !exists;
}
