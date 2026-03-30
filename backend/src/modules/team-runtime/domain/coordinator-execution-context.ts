import type { ITeamInvocation } from './team-invocation.js';

/**
 * Coordinator-owned execution view: full invocation + resolved team snapshot fields.
 * Specialists receive a narrowed view without external routing.
 */
export interface ICoordinatorExecutionContext {
  invocation: ITeamInvocation;
  teamName: string;
  specialistAgentIds: string[];
}
