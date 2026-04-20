import type { IExternalResponse } from './external-response.js';
import type { ISpecialistResult } from './specialist-result.js';
import type { TInterruptionReasonCode } from './execution-interruption.js';

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
  /** Product-level interruption flag (Loop 139A). */
  interrupted?: boolean;
  /** Structured taxonomy code for interruption reason. */
  interruptReasonCode?: TInterruptionReasonCode;
  /** Human readable interruption message. */
  interruptReasonMessage?: string;
  /** Step marker where interruption happened. */
  interruptStep?: string;
  /** Tool that triggered interruption (when applicable). */
  interruptTool?: string;
  /** Policy marker used by interruption guard. */
  interruptPolicy?: string;
  /** Optional progress snapshot when interrupted. */
  progressState?: string;
  /** Suggested UX next action after interruption. */
  nextStep?: string;
}

export interface ITeamExecutionResult {
  runId: string;
  teamId: string;
  coordinatorAgentId: string;
  externalResponse: IExternalResponse;
  specialistResults: ISpecialistResult[];
  events: ITeamExecutionEvent[];
}
