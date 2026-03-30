import { AppError } from '../../../shared/errors/app-error.js';
import type { ITeamInvocation } from '../domain/team-invocation.js';

export function assertInvocationMatchesTeam(
  invocation: ITeamInvocation,
  team: { id: string; coordinatorId: string },
): void {
  if (invocation.teamId !== team.id) {
    throw new AppError('TEAM_RUNTIME_GUARD', 'Invocation teamId mismatch', 400);
  }
  if (invocation.coordinatorId !== team.coordinatorId) {
    throw new AppError('TEAM_RUNTIME_GUARD', 'Invocation coordinatorId mismatch', 400);
  }
}
