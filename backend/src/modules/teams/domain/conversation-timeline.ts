import { randomUUID } from 'node:crypto';
import type { ITeamExecutionEvent } from '../../team-runtime/domain/team-execution-result.js';

export type TConversationActor = 'user' | 'coordinator' | 'specialist' | 'system' | 'tool';
export type TConversationItemKind =
  | 'input'
  | 'output'
  | 'thinking'
  | 'activity'
  | 'tool_call'
  | 'tool_result'
  | 'handoff'
  | 'status'
  | 'error'
  | 'memory';

export interface IConversationTimelineItem {
  id: string;
  workspaceId: string;
  teamId: string;
  runId: string;
  seq: number;
  timestamp: string;
  actor: TConversationActor;
  actorId?: string;
  kind: TConversationItemKind;
  content: string;
  meta?: Record<string, unknown>;
  correlation?: { spanId?: string; parentSpanId?: string };
}

export function buildThinkingSummaryFromProgress(phase: string, detail?: string): string {
  const normalized = phase.trim().toLowerCase();
  if (normalized === 'coordinator') return detail?.trim() || 'Analisando contexto e planejando resposta';
  if (normalized === 'specialist') return detail?.trim() || 'Delegando e executando com especialista';
  if (normalized === 'invoke') return 'Iniciando execução do coordenador';
  if (normalized === 'done') return 'Consolidando resposta final';
  if (normalized === 'interrupted') return detail?.trim() || 'Execução interrompida por regra de segurança';
  if (normalized === 'memory.recall') return detail?.trim() || 'A consultar memória do time';
  if (normalized === 'memory.write') return detail?.trim() || 'A atualizar memória do time';
  if (normalized === 'memory.disabled') return detail?.trim() || 'Memória do time indisponível neste momento';
  return detail?.trim() || `Processando fase ${phase}`;
}

export function inferKindFromExecutionEvent(event: ITeamExecutionEvent): TConversationItemKind {
  if (event.type === 'secondBrainVaultCommit') return 'memory';
  if (event.type === 'coordinatorSpecialistHandoff') return 'handoff';
  if (event.type === 'toolCall') return 'tool_call';
  if (event.type === 'toolResult') return 'tool_result';
  if (event.type === 'executionInterrupted' || event.type === 'runCancelled') return 'error';
  if (event.type.endsWith('Started') || event.type.endsWith('Finished')) return 'activity';
  return 'thinking';
}

export function createTimelineItem(
  base: Omit<IConversationTimelineItem, 'id' | 'timestamp'> & { timestamp?: string; id?: string },
): IConversationTimelineItem {
  return {
    ...base,
    id: base.id ?? randomUUID(),
    timestamp: base.timestamp ?? new Date().toISOString(),
  };
}
