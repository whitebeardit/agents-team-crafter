import type { Redis } from 'ioredis';
import type { RunRepository } from '../../runs/infra/run.repository.js';
import type { GovernanceAuditEventRepository } from '../infra/governance-audit-event.repository.js';
import type { TeamRepository } from '../../teams/infra/team.repository.js';
import { buildUtcCalendarWindow } from './governance-date-range.js';
import { computeLatencyPercentilesMs, type ILatencyPercentilesMs } from './governance-latency.util.js';
import { emitSloBreachAuditEventsIfNeeded } from './slo-breach-alerts.service.js';

export async function buildGovernanceRunsTrend(
  workspaceId: string,
  runRepo: RunRepository,
  days: number,
) {
  const { sinceStartOfFirstDayUtc, until, dayKeysUtc } = buildUtcCalendarWindow(days);
  const series = await runRepo.aggregateRunsTrendByDay(
    workspaceId,
    sinceStartOfFirstDayUtc,
    until,
    dayKeysUtc,
  );
  return {
    kind: 'runs' as const,
    days,
    since: sinceStartOfFirstDayUtc.toISOString(),
    until: until.toISOString(),
    series,
  };
}

export async function buildGovernanceAuditTrend(
  workspaceId: string,
  governanceAuditRepo: GovernanceAuditEventRepository,
  days: number,
) {
  const { sinceStartOfFirstDayUtc, until, dayKeysUtc } = buildUtcCalendarWindow(days);
  const series = await governanceAuditRepo.aggregateAuditCountByDay(
    workspaceId,
    sinceStartOfFirstDayUtc,
    until,
    dayKeysUtc,
  );
  return {
    kind: 'audit' as const,
    days,
    since: sinceStartOfFirstDayUtc.toISOString(),
    until: until.toISOString(),
    series,
  };
}

function latencyPublic(p: ILatencyPercentilesMs | null): {
  p50Ms: number | null;
  p90Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
  sampleCount: number;
} | null {
  if (!p || p.sampleCount === 0) return null;
  return {
    p50Ms: p.p50Ms,
    p90Ms: p.p90Ms,
    p95Ms: p.p95Ms,
    p99Ms: p.p99Ms,
    sampleCount: p.sampleCount,
  };
}

export async function buildGovernanceTeamSlos(
  workspaceId: string,
  deps: {
    runRepo: RunRepository;
    teamRepo: TeamRepository;
    governanceAuditRepo: GovernanceAuditEventRepository;
    redis: Redis | null;
    emitSloBreaches: boolean;
    sloWebhookUrl?: string;
  },
  days: number,
  sloTargetPercent: number,
) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [stats, { workspaceMs, byTeam }] = await Promise.all([
    deps.runRepo.aggregateTeamTerminalStats(workspaceId, since),
    deps.runRepo.collectTerminalDurationMsSamples(workspaceId, since),
  ]);
  const teamIds = stats.map((s) => s.teamId);
  const names = await deps.teamRepo.findNamesByIds(workspaceId, teamIds);
  const workspaceLatency = latencyPublic(computeLatencyPercentilesMs(workspaceMs));

  const teams = stats
    .map((s) => {
      const terminal = s.completed + s.failed;
      const successRate = terminal === 0 ? null : s.completed / terminal;
      const meetsSlo =
        successRate === null ? null : successRate * 100 >= sloTargetPercent;
      const teamMs = byTeam.get(s.teamId) ?? [];
      const latencyMsPercentiles = latencyPublic(computeLatencyPercentilesMs(teamMs));
      return {
        teamId: s.teamId,
        teamName: names.get(s.teamId) ?? s.teamId,
        completed: s.completed,
        failed: s.failed,
        terminalRuns: terminal,
        successRate,
        meetsSlo,
        latencyMsPercentiles,
      };
    })
    .sort((a, b) => a.teamName.localeCompare(b.teamName, 'pt-BR'));

  let sloBreachesEmitted = 0;
  if (deps.emitSloBreaches) {
    const r = await emitSloBreachAuditEventsIfNeeded({
      workspaceId,
      teams,
      windowDays: days,
      sloTargetPercent,
      governanceAuditRepo: deps.governanceAuditRepo,
      redis: deps.redis,
      sloWebhookUrl: deps.sloWebhookUrl,
    });
    sloBreachesEmitted = r.emitted;
  }

  return {
    windowDays: days,
    sloTargetPercent,
    since: since.toISOString(),
    workspaceLatencyMsPercentiles: workspaceLatency,
    teams,
    sloBreachesEmitted,
  };
}
