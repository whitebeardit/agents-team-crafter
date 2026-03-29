import type { TeamRepository } from '../infra/team.repository.js';
import { AppError } from '../../../shared/errors/app-error.js';

/**
 * Garante que nenhum channelId em `channelIds` já esteja vinculado a outro time ativo
 * no mesmo workspace (regra MVP 1:1 canal instância ↔ time ativo).
 */
export async function assertActiveChannelBindingUnique(
  teamRepo: TeamRepository,
  workspaceId: string,
  channelIds: string[],
  excludeTeamId: string | undefined,
): Promise<void> {
  if (channelIds.length === 0) return;
  const conflicts = await teamRepo.findActiveTeamsConflictingChannelIds(
    workspaceId,
    channelIds,
    excludeTeamId,
  );
  if (conflicts.length === 0) return;
  const names = conflicts.map((c) => `"${c.name}" (${c.id})`).join(', ');
  throw new AppError(
    'VALIDATION_ERROR',
    `Um ou mais canais ja estao associados a outro time ativo neste workspace: ${names}`,
    400,
  );
}
