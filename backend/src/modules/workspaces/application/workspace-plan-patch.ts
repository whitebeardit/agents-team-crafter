import { AppError } from '../../../shared/errors/app-error.js';
import { resolveEffectiveMaxLimits } from './workspace-plan-limits.js';

export type QuotaOverridesInput = {
  maxTeams?: number;
  maxAgents?: number;
  maxChannels?: number;
};

/**
 * Remove maxTeams/maxAgents/maxChannels e aplica opcionalmente novos overrides
 * (apenas chaves presentes em `quotaOverrides`).
 */
export function mergeLimitsRecordAfterPlanPatch(
  currentLimits: Record<string, unknown>,
  quotaOverrides?: QuotaOverridesInput,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...currentLimits };
  delete next.maxTeams;
  delete next.maxAgents;
  delete next.maxChannels;
  if (quotaOverrides) {
    if (quotaOverrides.maxTeams !== undefined) next.maxTeams = quotaOverrides.maxTeams;
    if (quotaOverrides.maxAgents !== undefined) next.maxAgents = quotaOverrides.maxAgents;
    if (quotaOverrides.maxChannels !== undefined) next.maxChannels = quotaOverrides.maxChannels;
  }
  return next;
}

export function assertUsageWithinEffectivePlanLimits(
  plan: 'free' | 'pro' | 'enterprise',
  mergedLimits: Record<string, unknown>,
  used: { usedTeams: number; usedAgents: number; usedChannels: number },
): void {
  const effective = resolveEffectiveMaxLimits(plan, mergedLimits);
  const conflicts: Array<{ resource: string; used: number; max: number }> = [];
  if (effective.maxTeams !== -1 && used.usedTeams > effective.maxTeams) {
    conflicts.push({ resource: 'teams', used: used.usedTeams, max: effective.maxTeams });
  }
  if (effective.maxAgents !== -1 && used.usedAgents > effective.maxAgents) {
    conflicts.push({ resource: 'agents', used: used.usedAgents, max: effective.maxAgents });
  }
  if (effective.maxChannels !== -1 && used.usedChannels > effective.maxChannels) {
    conflicts.push({ resource: 'channels', used: used.usedChannels, max: effective.maxChannels });
  }
  if (conflicts.length > 0) {
    throw new AppError(
      'QUOTA_CONFLICT',
      'Uso actual excede os limites do plano solicitado. Reduza recursos antes de efectuar o downgrade.',
      409,
      { conflicts },
    );
  }
}
