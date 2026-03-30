/** Emitted over SSE and optional callbacks during a team run (live UI). */
export interface ITeamProgressEvent {
  agentId: string;
  status: 'idle' | 'busy';
  phase: string;
  detail?: string;
}
