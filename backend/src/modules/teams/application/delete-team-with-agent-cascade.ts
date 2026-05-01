import { AppError } from '../../../shared/errors/app-error.js';
import type { IAgentRepository } from '../../agents/domain/ports/agent-repository.port.js';
import type { ITeamRepository } from '../domain/ports/team-repository.port.js';

type TDeleteCascadeDeps = {
  teamRepo: Pick<ITeamRepository, 'findById' | 'findTeamsReferencingAgent' | 'delete'>;
  agentRepo: Pick<IAgentRepository, 'softDelete'>;
};

function uniqueAgentIds(team: Record<string, unknown>): string[] {
  const coordinatorId = typeof team['coordinatorId'] === 'string' ? team['coordinatorId'] : '';
  const specialistIds = Array.isArray(team['agentIds'])
    ? (team['agentIds'] as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  return [...new Set([coordinatorId, ...specialistIds].filter(Boolean))];
}

export async function deleteTeamWithAgentCascade(
  deps: TDeleteCascadeDeps,
  workspaceId: string,
  teamId: string,
): Promise<{ deletedAgentIds: string[] }> {
  const team = await deps.teamRepo.findById(workspaceId, teamId);
  if (!team) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);
  const row = team as Record<string, unknown>;
  const agentIds = uniqueAgentIds(row);

  for (const agentId of agentIds) {
    const refs = await deps.teamRepo.findTeamsReferencingAgent(workspaceId, agentId);
    const conflict = refs.find((r) => r.id !== teamId);
    if (conflict) {
      throw new AppError(
        'TEAM_AGENT_IN_USE',
        `Agente em uso em outro time. Remova do time ${conflict.name} primeiro.`,
        400,
        { conflictTeamId: conflict.id, conflictTeamName: conflict.name, agentId },
      );
    }
  }

  await deps.teamRepo.delete(workspaceId, teamId);
  for (const agentId of agentIds) {
    await deps.agentRepo.softDelete(workspaceId, agentId);
  }

  return { deletedAgentIds: agentIds };
}
