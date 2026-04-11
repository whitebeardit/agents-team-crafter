import { AppError } from '../../../shared/errors/app-error.js';
import type { SettingsRepository } from '../../settings/infra/settings.repository.js';

export type WorkspacePlanKind = 'free' | 'pro' | 'enterprise';

/** Limites por plano quando `workspace.limits` nao fixa um valor. -1 = ilimitado. */
export const PLAN_DEFAULT_LIMITS: Record<
  WorkspacePlanKind,
  { maxTeams: number; maxAgents: number; maxChannels: number }
> = {
  free: { maxTeams: 2, maxAgents: 5, maxChannels: 10 },
  pro: { maxTeams: 10, maxAgents: 50, maxChannels: 50 },
  enterprise: { maxTeams: -1, maxAgents: -1, maxChannels: -1 },
};

export function normalizePlan(plan: string | undefined): WorkspacePlanKind {
  if (plan === 'pro' || plan === 'enterprise') return plan;
  return 'free';
}

export function resolveEffectiveMaxLimits(
  plan: string | undefined,
  storedLimits: Record<string, unknown>,
): { maxTeams: number; maxAgents: number; maxChannels: number } {
  const p = normalizePlan(plan);
  const defaults = PLAN_DEFAULT_LIMITS[p];
  const pick = (key: 'maxTeams' | 'maxAgents' | 'maxChannels'): number => {
    const v = storedLimits[key];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    return defaults[key];
  };
  return {
    maxTeams: pick('maxTeams'),
    maxAgents: pick('maxAgents'),
    maxChannels: pick('maxChannels'),
  };
}

export async function assertWorkspaceQuota(
  settingsRepo: SettingsRepository,
  workspaceId: string,
  resource: 'teams' | 'agents' | 'channels',
): Promise<void> {
  await assertWorkspaceQuotaDelta(settingsRepo, workspaceId, {
    teams: resource === 'teams' ? 1 : 0,
    agents: resource === 'agents' ? 1 : 0,
    channels: resource === 'channels' ? 1 : 0,
  });
}

/**
 * Verifica se o workspace pode criar mais recursos (delta) sem ultrapassar o maximo efetivo.
 */
export async function assertWorkspaceQuotaDelta(
  settingsRepo: SettingsRepository,
  workspaceId: string,
  delta: { teams?: number; agents?: number; channels?: number },
): Promise<void> {
  const w = await settingsRepo.getWorkspace(workspaceId);
  if (!w) throw new AppError('NOT_FOUND', 'Workspace nao encontrado', 404);
  const L = w.limits;
  const dt = delta.teams ?? 0;
  const da = delta.agents ?? 0;
  const dc = delta.channels ?? 0;

  if (dt > 0 && L.maxTeams !== -1 && L.usedTeams + dt > L.maxTeams) {
    throw new AppError(
      'QUOTA_EXCEEDED',
      `Limite de times atingido (${L.usedTeams}/${L.maxTeams}). Actualize o plano ou remova um time.`,
      403,
      { resource: 'teams', used: L.usedTeams, max: L.maxTeams },
    );
  }
  if (da > 0 && L.maxAgents !== -1 && L.usedAgents + da > L.maxAgents) {
    throw new AppError(
      'QUOTA_EXCEEDED',
      `Limite de agentes atingido (${L.usedAgents}/${L.maxAgents}). Actualize o plano ou remova um agente.`,
      403,
      { resource: 'agents', used: L.usedAgents, max: L.maxAgents },
    );
  }
  if (dc > 0 && L.maxChannels !== -1 && L.usedChannels + dc > L.maxChannels) {
    throw new AppError(
      'QUOTA_EXCEEDED',
      `Limite de canais atingido (${L.usedChannels}/${L.maxChannels}). Actualize o plano ou remova um canal.`,
      403,
      { resource: 'channels', used: L.usedChannels, max: L.maxChannels },
    );
  }
}
