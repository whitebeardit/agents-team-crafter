import type { ITeamInvocation } from '../domain/team-invocation.js';
import type { ITeamExecutionResult } from '../domain/team-execution-result.js';
import { CoordinatorOrchestratorService } from './coordinator-orchestrator.service.js';

export async function invokeTeam(
  orchestrator: CoordinatorOrchestratorService,
  invocation: ITeamInvocation,
): Promise<ITeamExecutionResult> {
  return orchestrator.execute(invocation);
}
