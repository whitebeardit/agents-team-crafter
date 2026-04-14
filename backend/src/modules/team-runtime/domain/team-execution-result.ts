import type { IExternalResponse } from './external-response.js';
import type { ISpecialistResult } from './specialist-result.js';

export interface ITeamExecutionEvent {
  type: string;
  value?: string;
  tool?: string;
  status?: string;
  errorCode?: string;
  agentId?: string;
  phase?: string;
  detail?: string;
  /** Raw `instruction` from the coordinator tool call (full string). */
  toolInstruction?: string;
  /** Exact user message passed to specialist `runStep` after merge with user invocation (full string). */
  runtimeMessage?: string;
  /** Structured stop reason (Loop 110) when cancellation is explicit. */
  stopReason?: string;
  /** Suggested follow-up command/intent to resume flow after stop. */
  resumeHint?: string;
}

export interface ITeamExecutionResult {
  runId: string;
  teamId: string;
  coordinatorAgentId: string;
  externalResponse: IExternalResponse;
  specialistResults: ISpecialistResult[];
  events: ITeamExecutionEvent[];
}
