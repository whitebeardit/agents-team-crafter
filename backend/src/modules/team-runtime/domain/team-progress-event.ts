/** Emitted over SSE and optional callbacks during a team run (live UI). */
export interface ITeamProgressEvent {
  /** Correlates progress with `runComplete` and team live broadcast. */
  runId: string;
  agentId: string;
  status: 'idle' | 'busy';
  phase: string;
  detail?: string;
}
