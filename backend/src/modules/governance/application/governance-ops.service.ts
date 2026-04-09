import type { RunRepository } from '../../runs/infra/run.repository.js';
import type { AgentOverlapReviewRepository } from '../../agent-governance/infra/agent-overlap-review.repository.js';
import type { GovernanceAuditEventRepository } from '../infra/governance-audit-event.repository.js';

export async function buildGovernanceOpsSummary(
  workspaceId: string,
  deps: {
    runRepo: RunRepository;
    agentOverlapReviewRepo: AgentOverlapReviewRepository;
    governanceAuditRepo: GovernanceAuditEventRepository;
  },
) {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [
    runsFailed,
    runsCompleted,
    runsRunning,
    runsFailed30d,
    runsCompleted30d,
    overlapBlocks30d,
    recentAudit,
    auditEvents30d,
  ] = await Promise.all([
    deps.runRepo.countByStatus(workspaceId, 'failed'),
    deps.runRepo.countByStatus(workspaceId, 'completed'),
    deps.runRepo.countByStatus(workspaceId, 'running'),
    deps.runRepo.countByStatusSince(workspaceId, 'failed', since30d),
    deps.runRepo.countByStatusSince(workspaceId, 'completed', since30d),
    deps.agentOverlapReviewRepo.countByDecisionSince(workspaceId, 'block', since30d),
    deps.governanceAuditRepo.list(workspaceId, { limit: 15 }),
    deps.governanceAuditRepo.countSince(workspaceId, since30d),
  ]);
  const terminal30d = runsFailed30d + runsCompleted30d;
  const runsFailureRateLast30d: number | null =
    terminal30d === 0 ? null : runsFailed30d / terminal30d;
  return {
    runsFailedTotal: runsFailed,
    runsCompletedTotal: runsCompleted,
    runsRunningTotal: runsRunning,
    runsFailedLast30d: runsFailed30d,
    runsCompletedLast30d: runsCompleted30d,
    runsFailureRateLast30d,
    overlapReviewsBlockedLast30d: overlapBlocks30d,
    governanceAuditEventsLast30d: auditEvents30d,
    recentGovernanceEvents: recentAudit,
  };
}
