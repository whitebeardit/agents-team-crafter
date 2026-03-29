import type { TeamRepository } from '../../teams/infra/team.repository.js';
import { AppError } from '../../../shared/errors/app-error.js';

export type TInboundResolveResult =
  | { kind: 'ok'; coordinatorId: string; teamId: string; teamName: string }
  | { kind: 'no_team' }
  | { kind: 'ambiguous_team'; teamIds: string[] };

/**
 * Resolve o coordenador a partir do documento Channel (instância) e times ativos que o referenciam.
 * Regra MVP: exatamente um time ativo com esse channelId em channelIds.
 */
export async function resolveCoordinatorForChannelInstance(
  teamRepo: TeamRepository,
  workspaceId: string,
  channelDocumentId: string,
): Promise<TInboundResolveResult> {
  const teams = await teamRepo.findActiveTeamsWithChannelId(workspaceId, channelDocumentId);
  if (teams.length === 0) return { kind: 'no_team' };
  if (teams.length > 1) {
    return { kind: 'ambiguous_team', teamIds: teams.map((t) => t.id) };
  }
  const t = teams[0];
  return {
    kind: 'ok',
    coordinatorId: t.coordinatorId,
    teamId: t.id,
    teamName: t.name,
  };
}

/** Lança AppError quando não há exatamente um time ativo. */
export async function requireCoordinatorForChannelInstance(
  teamRepo: TeamRepository,
  workspaceId: string,
  channelDocumentId: string,
): Promise<{ coordinatorId: string; teamId: string }> {
  const r = await resolveCoordinatorForChannelInstance(teamRepo, workspaceId, channelDocumentId);
  if (r.kind === 'no_team') {
    throw new AppError(
      'CHAT_ROUTING_ERROR',
      'Canal nao associado a nenhum time ativo (adicione o canal em channelIds do time).',
      409,
    );
  }
  if (r.kind === 'ambiguous_team') {
    throw new AppError(
      'CHAT_ROUTING_ERROR',
      'Canal associado a mais de um time ativo; corrija channelIds para respeitar vinculo 1:1.',
      409,
      { teamIds: r.teamIds },
    );
  }
  return { coordinatorId: r.coordinatorId, teamId: r.teamId };
}
