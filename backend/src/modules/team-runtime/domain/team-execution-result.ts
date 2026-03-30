import type { IExternalResponse } from './external-response.js';
import type { ISpecialistResult } from './specialist-result.js';

export interface ITeamExecutionEvent {
  type: string;
  value?: string;
  tool?: string;
  status?: string;
  errorCode?: string;
}

export interface ITeamExecutionResult {
  runId: string;
  teamId: string;
  coordinatorAgentId: string;
  externalResponse: IExternalResponse;
  specialistResults: ISpecialistResult[];
  events: ITeamExecutionEvent[];
}
