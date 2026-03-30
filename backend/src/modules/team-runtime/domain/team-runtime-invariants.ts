import { AppError } from '../../../shared/errors/app-error.js';

export interface ITeamInvariantTeam {
  coordinatorId: string;
  agentIds: string[];
}

/** Ensures the team's coordinatorId points to an agent with role coordinator. */
export function assertTeamCoordinatorBinding(coordinatorRow: Record<string, unknown>, coordinatorId: string): void {
  const id = String(coordinatorRow['id'] ?? '');
  if (id !== coordinatorId) {
    throw new AppError('TEAM_RUNTIME_INVARIANT', 'Coordinator row id mismatch', 500);
  }
  assertCoordinatorAgentRow(coordinatorRow);
}

export function assertCoordinatorAgentRow(agent: Record<string, unknown>): void {
  if (agent['role'] !== 'coordinator') {
    throw new AppError(
      'TEAM_RUNTIME_INVARIANT',
      'Runtime coordinator agent must have role coordinator',
      400,
    );
  }
}

export function assertSpecialistAgentRow(agent: Record<string, unknown>): void {
  if (agent['role'] === 'coordinator') {
    throw new AppError(
      'TEAM_RUNTIME_INVARIANT',
      'Specialist tool targets must not be coordinator agents',
      500,
    );
  }
}

export function listSpecialistIds(team: ITeamInvariantTeam): string[] {
  return team.agentIds.filter((id) => id !== team.coordinatorId);
}
