import type { ITeamInvocation } from '../domain/team-invocation.js';
import type { ICoordinatorExecutionContext } from '../domain/coordinator-execution-context.js';
import { listSpecialistIds, type ITeamInvariantTeam } from '../domain/team-runtime-invariants.js';

export function buildCoordinatorExecutionContext(
  invocation: ITeamInvocation,
  team: { name: string } & ITeamInvariantTeam,
): ICoordinatorExecutionContext {
  return {
    invocation,
    teamName: team.name,
    specialistAgentIds: listSpecialistIds(team),
  };
}
