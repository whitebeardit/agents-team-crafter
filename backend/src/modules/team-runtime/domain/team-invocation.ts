/**
 * External entry points are normalized into a single invocation contract.
 * Specialist-facing payloads must never include external routing (thread/channel ids).
 */

export type TTeamTriggerKind = 'chat' | 'webhook' | 'schedule' | 'event' | 'manual';

/** Metadata only the coordinator may use in prompts; not forwarded to specialists. */
export interface ICoordinatorExternalContext {
  channelLabel?: string;
  locale?: string;
  taskType?: string;
  requestedAccessLevel?: 'read' | 'write' | 'restricted';
}

export interface ITeamInvocationActor {
  kind: 'user' | 'system' | 'integration';
  id?: string;
  displayName?: string;
}

export interface ITeamInvocation {
  trigger: TTeamTriggerKind;
  workspaceId: string;
  teamId: string;
  /** Must match team.coordinatorId after load; set from team record for API routes. */
  coordinatorId: string;
  message: string;
  structuredPayload?: Record<string, unknown>;
  coordinatorExternalContext: ICoordinatorExternalContext;
  actor?: ITeamInvocationActor;
  metadata?: Record<string, unknown>;
  /** Loop 87 — histórico recente reutilizado no console de debug / conversas com memória. */
  conversation?: {
    id: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
  };
}
