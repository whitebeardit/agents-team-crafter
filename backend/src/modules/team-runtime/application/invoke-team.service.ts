import type { ITeamInvocation } from '../domain/team-invocation.js';
import type { ITeamExecutionResult } from '../domain/team-execution-result.js';
import type { ICoordinatorExecuteOptions } from './coordinator-orchestrator.service.js';
import { CoordinatorOrchestratorService } from './coordinator-orchestrator.service.js';

export async function invokeTeam(
  orchestrator: CoordinatorOrchestratorService,
  invocation: ITeamInvocation,
  options?: ICoordinatorExecuteOptions,
): Promise<ITeamExecutionResult> {
  return orchestrator.execute(invocation, options);
}
