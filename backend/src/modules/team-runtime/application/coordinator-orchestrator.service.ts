import { randomUUID } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import type { AgentRepository } from '../../agents/infra/agent.repository.js';
import type { TeamRepository } from '../../teams/infra/team.repository.js';
import type { AgentMcpBindingRepository } from '../../agents/infra/agent-mcp-binding.repository.js';
import type { McpConnectionRepository } from '../../mcps/infra/mcp-connection.repository.js';
import type { KnowledgeSourceRepository } from '../../knowledge/infra/knowledge-source.repository.js';
import type {
  IAgentRuntimeProvider,
  IWorkspaceCustomToolDefinition,
  TRuntimeEvent,
} from '../../runtime/ports/agent-runtime.provider.js';
import type { IBusinessToolRuntime } from '../../business-tools/application/business-tool-runtime.js';
import type { WorkspaceToolDefinitionRepository } from '../../tool-definitions/infra/workspace-tool-definition.repository.js';
import { composeExecutableAgentConfig } from '../../runtime/application/compose-executable-config.js';
import { buildSpecialistSystemInstruction } from '../../runtime/application/build-specialist-system-instruction.js';
import { buildKnowledgeAppendixForAgent } from '../../runtime/application/build-knowledge-appendix.js';
import { loadMcpToolSpecsForAgent } from '../../runtime/application/load-mcp-tool-specs.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { ITeamInvocation } from '../domain/team-invocation.js';
import type { ISpecialistResult } from '../domain/specialist-result.js';
import type { ITeamExecutionEvent, ITeamExecutionResult } from '../domain/team-execution-result.js';
import type { ITeamProgressEvent } from '../domain/team-progress-event.js';
import {
  assertSpecialistAgentRow,
  assertTeamCoordinatorBinding,
  listSpecialistIds,
} from '../domain/team-runtime-invariants.js';
import { assertInvocationMatchesTeam } from './team-runtime-guards.service.js';
import { composeExternalResponseFromModelText } from './response-composer.service.js';
import { formatCoordinatorUserMessage } from './format-coordinator-user-message.js';
import { buildSpecialistRuntimeMessage } from './build-specialist-runtime-message.js';
import {
  resolveSpecialistAgentIdFromToolName,
  SpecialistRegistry,
} from '../infra/registries/specialist-registry.js';
import type { WorkspaceIntegrationsService } from '../../settings/application/workspace-integrations.service.js';
import {
  buildExecutionInterruptionDescriptor,
  type TInterruptionReasonCode,
} from '../domain/execution-interruption.js';
import {
  buildCrmCreatePartyDraft,
} from '../../crm/application/crm-conversation-context.js';

const ACTIVITY_MAX = 200;
type TPendingDestructiveConfirmation = {
  key: string;
  createdAt: number;
  targetHints: string[];
};
const DESTRUCTIVE_CONFIRMATION_MEMORY = new Map<string, TPendingDestructiveConfirmation>();
const DESTRUCTIVE_CONFIRMATION_TTL_MS = 10 * 60 * 1000;
const DESTRUCTIVE_CONFIRMATION_MAX_ENTRIES = 1_000;
const DESTRUCTIVE_AUDIT_MEMORY = new Map<string, Array<{ at: number; stage: string; note: string }>>();
const DESTRUCTIVE_AUDIT_MAX_ENTRIES_PER_CONVERSATION = 5;

export interface IDestructiveAuditEntry {
  at: number;
  stage: string;
  note: string;
  workspaceId?: string;
  memoryKey?: string;
}

export interface IDestructiveAuditHistoryQuery {
  limit?: number;
  offset?: number;
  cursorAt?: number;
  stage?: string;
  fromAt?: number;
  toAt?: number;
}

export interface IDestructiveAuditHistoryResult {
  items: IDestructiveAuditEntry[];
  total: number;
}

function destructiveAuditPersistPath(): string {
  return process.env.TEAM_RUNTIME_DESTRUCTIVE_AUDIT_FILE?.trim() ?? '';
}

/** Appended to the coordinator system instruction so tool calls stay explicit. */
const COORDINATOR_SPECIALIST_TOOL_GUIDANCE = `

## Ferramentas de especialistas
Cada chamada recebe o parâmetro \`instruction\`. O sistema repassa automaticamente a **mensagem completa do utilizador** ao especialista quando ainda não estiver incluída nessa instrução; podes focar a \`instruction\` na tarefa e confiar nesse reenvio para código ou texto longo.

## Ações de negócio (internal_action / ws_*)
Para criar ou alterar dados, **não invoques** a tool enquanto faltarem campos obrigatórios do contrato. Identifica o que falta e faz **uma** pergunta compacta com todos os itens em falta; depois executa a tool. Se o runtime devolver erro de campos em falta, usa essa lista na próxima resposta em vez de repetir a chamada vazia.
Para leituras simples, evita confirmações redundantes e executa direto quando a intenção estiver clara.
Para ações **não destrutivas** (ex.: criação/edição administrativa), evita ritual de "responda confirmo"; se a intenção estiver clara e os obrigatórios completos, executa diretamente.
Para ações destrutivas (cancelar/remover/apagar), pede confirmação explícita única antes de executar.

## Resposta final ao utilizador (imagens)
Quando um especialista devolver uma **URL HTTPS** de imagem gerada (por exemplo após usar a tool de geração de imagens) ou Markdown \`![descricao](https://...)\`, **inclui obrigatoriamente** essa linha Markdown na tua resposta final, para a interface e o Telegram mostrarem a imagem. Não substituas por apenas uma descrição textual se existir URL disponível.`;

function truncateActivity(text: string, max = ACTIVITY_MAX): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function parseRunStopCommand(
  message: string,
): { requested: boolean; stopReason?: string; resumeHint: string } {
  const m = message.trim().toLowerCase();
  if (!m) return { requested: false, resumeHint: 'Envie "continuar" com o próximo objetivo.' };
  if (m === 'cancel') {
    return {
      requested: true,
      stopReason: 'cancel',
      resumeHint: 'Envie "continuar" com o próximo objetivo.',
    };
  }
  const slashMatch = message.trim().match(/^\/(?:stop|cancel)\s*(.*)$/i);
  if (slashMatch) {
    const reason = slashMatch[1]?.trim();
    return {
      requested: true,
      ...(reason ? { stopReason: reason } : {}),
      resumeHint: 'Para retomar: envie "/resume <objetivo>" ou "continuar".',
    };
  }
  const taggedReason = message.trim().match(/\bstop_reason\s*:\s*(.+)$/i);
  if (taggedReason?.[1]?.trim()) {
    return {
      requested: true,
      stopReason: taggedReason[1].trim(),
      resumeHint: 'Para retomar: envie "continuar" com o contexto atualizado.',
    };
  }
  const asksStop = /\b(cancelar|cancela|cancelamento|interromper|interrompe|parar|pare|abortar|aborta)\b/.test(m);
  const runContext = /\b(run|execu(c|ç)(a|ã)o|processo|resposta|conversa)\b/.test(m);
  if (!asksStop || !runContext) return { requested: false, resumeHint: 'Envie "continuar" com o próximo objetivo.' };
  return {
    requested: true,
    stopReason: 'cancelamento solicitado pelo utilizador',
    resumeHint: 'Para retomar: envie "continuar" com o próximo objetivo.',
  };
}

function hasDestructiveIntent(message: string): boolean {
  const m = message.trim().toLowerCase();
  return /\b(apagar|deletar|excluir|remover|cancelar compromisso|cancelar agendamento|arquivar)\b/.test(m);
}

function hasExplicitConfirmation(message: string): boolean {
  const m = message.trim().toLowerCase();
  return /\b(confirmo|confirmar|pode prosseguir|pode apagar|sim[, ]?confirmo|yes[, ]?confirm)\b/.test(m);
}

function extractDestructiveTargetHints(message: string): string[] {
  const ids = [
    ...message.matchAll(/\b\d{2,}\b/g),
    ...message.matchAll(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi),
    ...message.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi),
  ]
    .map((m) => m[0]?.toLowerCase().trim())
    .filter((v): v is string => Boolean(v));
  return Array.from(new Set(ids));
}

function pruneDestructiveConfirmationMemory(now = Date.now()): void {
  for (const [memoryKey, pending] of DESTRUCTIVE_CONFIRMATION_MEMORY.entries()) {
    if (now - pending.createdAt > DESTRUCTIVE_CONFIRMATION_TTL_MS) {
      DESTRUCTIVE_CONFIRMATION_MEMORY.delete(memoryKey);
    }
  }
  while (DESTRUCTIVE_CONFIRMATION_MEMORY.size > DESTRUCTIVE_CONFIRMATION_MAX_ENTRIES) {
    const oldestKey = DESTRUCTIVE_CONFIRMATION_MEMORY.keys().next().value as string | undefined;
    if (!oldestKey) break;
    DESTRUCTIVE_CONFIRMATION_MEMORY.delete(oldestKey);
  }
}

function getPendingDestructiveConfirmation(
  memoryKey: string,
  now = Date.now(),
): TPendingDestructiveConfirmation | undefined {
  const pending = DESTRUCTIVE_CONFIRMATION_MEMORY.get(memoryKey);
  if (!pending) return undefined;
  if (now - pending.createdAt > DESTRUCTIVE_CONFIRMATION_TTL_MS) {
    DESTRUCTIVE_CONFIRMATION_MEMORY.delete(memoryKey);
    return undefined;
  }
  return pending;
}

function persistDestructiveAuditOutsideMemory(
  workspaceId: string,
  memoryKey: string,
  stage: string,
  note: string,
  at: number,
): void {
  const persistPath = destructiveAuditPersistPath();
  if (!persistPath) return;
  try {
    appendFileSync(
      persistPath,
      `${JSON.stringify({ workspaceId, memoryKey, stage, note: truncateActivity(note, 120), at })}\n`,
      'utf8',
    );
  } catch {
    // Optional persistence: never block runtime flow.
  }
}

function appendDestructiveAudit(
  workspaceId: string,
  memoryKey: string,
  stage: string,
  note: string,
  now = Date.now(),
): void {
  const list = DESTRUCTIVE_AUDIT_MEMORY.get(memoryKey) ?? [];
  list.push({ at: now, stage, note: truncateActivity(note, 120) });
  while (list.length > DESTRUCTIVE_AUDIT_MAX_ENTRIES_PER_CONVERSATION) list.shift();
  DESTRUCTIVE_AUDIT_MEMORY.set(memoryKey, list);
  persistDestructiveAuditOutsideMemory(workspaceId, memoryKey, stage, note, now);
}

function destructiveAuditSnapshot(memoryKey: string): string {
  const list = DESTRUCTIVE_AUDIT_MEMORY.get(memoryKey) ?? [];
  if (!list.length) return '[]';
  return JSON.stringify(list);
}

function readPersistedDestructiveAudit(
  workspaceId: string,
  memoryKey: string,
  limit: number,
): IDestructiveAuditEntry[] {
  const persistPath = destructiveAuditPersistPath();
  if (!persistPath) return [];
  try {
    const raw = readFileSync(persistPath, 'utf8');
    if (!raw.trim()) return [];
    const parsed = raw
      .trim()
      .split('\n')
      .reverse()
      .map((line) => JSON.parse(line) as IDestructiveAuditEntry)
      .filter((e) => e.workspaceId === workspaceId && e.memoryKey === memoryKey)
      .slice(0, limit);
    return parsed;
  } catch {
    return [];
  }
}

export function getDestructiveAuditHistory(
  workspaceId: string,
  conversationId: string,
  query?: IDestructiveAuditHistoryQuery,
): IDestructiveAuditHistoryResult {
  const limit = Math.max(1, Math.min(100, query?.limit ?? 20));
  const offset = Math.max(0, query?.offset ?? 0);
  const memoryKey = conversationId.trim();
  if (!memoryKey) return { items: [], total: 0 };
  const local = (DESTRUCTIVE_AUDIT_MEMORY.get(memoryKey) ?? []).map((e) => ({
    at: e.at,
    stage: e.stage,
    note: e.note,
    workspaceId,
    memoryKey,
  }));
  const persisted = readPersistedDestructiveAudit(workspaceId, memoryKey, limit);
  const filtered = [...local, ...persisted]
    .filter((e) => (query?.stage ? e.stage === query.stage : true))
    .filter((e) => (query?.fromAt !== undefined ? e.at >= query.fromAt : true))
    .filter((e) => (query?.toAt !== undefined ? e.at <= query.toAt : true))
    .filter((e) => (query?.cursorAt !== undefined ? e.at < query.cursorAt : true))
    .sort((a, b) => b.at - a.at);
  return {
    items: filtered.slice(query?.cursorAt !== undefined ? 0 : offset, (query?.cursorAt !== undefined ? 0 : offset) + limit),
    total: filtered.length,
  };
}

function computeConversationMemoryKey(invocation: ITeamInvocation): string {
  const cid =
    typeof invocation.metadata?.conversationId === 'string'
      ? invocation.metadata.conversationId.trim()
      : '';
  const corr =
    typeof invocation.metadata?.correlationId === 'string'
      ? invocation.metadata.correlationId.trim()
      : '';
  return cid || corr || `${invocation.workspaceId}:${invocation.teamId}`;
}

type TCrmDirectReadIntent =
  | {
      actionId: 'crm_list_parties';
      input: { query: string; roles: string[] };
      reason: 'list_all_customers';
    }
  | {
      actionId: 'crm_find_party';
      input: { email?: string; phone?: string; partyId?: string };
      reason: 'find_customer_by_identifier';
    };

type TCrmDirectWriteIntent = {
  actionId: 'crm_create_party';
  input: Record<string, unknown>;
  reason: 'create_customer_from_context';
  missingFields: string[];
};

function extractFirstEmail(text: string): string | undefined {
  const m = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  return m?.[0]?.trim();
}

function extractFirstPhone(text: string): string | undefined {
  const m = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
  return m?.[0]?.trim();
}

function extractPartyIdHint(text: string): string | undefined {
  const m = text.match(/\b(?:party[-_ ]?id[:= ]*|id do cliente[:= ]*|cliente[:# ]+)([a-z0-9-]{4,})\b/i);
  return m?.[1]?.trim();
}

export function parseCrmDirectReadIntent(message: string): TCrmDirectReadIntent | null {
  const raw = message.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  const mentionsCustomer = /\b(cliente|clientes|customer|customers|party|parties)\b/.test(lower);
  if (!mentionsCustomer) return null;

  const email = extractFirstEmail(raw);
  if (email) {
    return {
      actionId: 'crm_find_party',
      input: { email },
      reason: 'find_customer_by_identifier',
    };
  }

  const phone = extractFirstPhone(raw);
  if (phone && /\b(telefone|celular|phone|whatsapp)\b/.test(lower)) {
    return {
      actionId: 'crm_find_party',
      input: { phone },
      reason: 'find_customer_by_identifier',
    };
  }

  const partyId = extractPartyIdHint(raw);
  if (partyId) {
    return {
      actionId: 'crm_find_party',
      input: { partyId },
      reason: 'find_customer_by_identifier',
    };
  }

  const explicitListAll =
    /\b(liste|listar|lista|list|mostre|mostrar|me mostre|quais são|quais sao)\b/.test(lower) &&
    /\b(todos|todas|all|cadastrad|registrad)\b/.test(lower);
  const genericListCustomers = /\b(listar clientes|liste clientes|lista de clientes|list customers)\b/.test(lower);
  if (explicitListAll || genericListCustomers) {
    return {
      actionId: 'crm_list_parties',
      input: { query: '', roles: ['customer'] },
      reason: 'list_all_customers',
    };
  }

  return null;
}

function formatPartyLine(party: Record<string, unknown>, index: number): string {
  const name = typeof party.displayName === 'string' && party.displayName.trim() ? party.displayName.trim() : 'Sem nome';
  const id = typeof party.id === 'string' && party.id.trim() ? party.id.trim() : undefined;
  const email = typeof party.email === 'string' && party.email.trim() ? party.email.trim() : undefined;
  const phone = typeof party.phone === 'string' && party.phone.trim() ? party.phone.trim() : undefined;
  const parts = [name, id ? `id: ${id}` : null, email ? `email: ${email}` : null, phone ? `telefone: ${phone}` : null]
    .filter((x): x is string => Boolean(x));
  return `${index}. ${parts.join(' · ')}`;
}

export function formatCrmDirectReadResponse(
  actionId: 'crm_list_parties' | 'crm_find_party',
  result: unknown,
): string {
  const row = (result ?? {}) as { parties?: unknown };
  const parties = Array.isArray(row.parties)
    ? row.parties.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
    : [];
  if (actionId === 'crm_list_parties') {
    if (parties.length === 0) return 'Não encontrei clientes cadastrados no momento.';
    const lines = parties.slice(0, 20).map((p, i) => formatPartyLine(p, i + 1));
    const suffix = parties.length > 20 ? `\n... e mais ${parties.length - 20} cliente(s).` : '';
    return `Encontrei ${parties.length} cliente(s) cadastrados:\n${lines.join('\n')}${suffix}`;
  }
  if (parties.length === 0) return 'Não encontrei cliente com esse identificador.';
  const lines = parties.slice(0, 20).map((p, i) => formatPartyLine(p, i + 1));
  return `Encontrei ${parties.length} cliente(s):\n${lines.join('\n')}`;
}

export function formatCrmDirectWriteResponse(result: unknown): string {
  const party = (result ?? {}) as Record<string, unknown>;
  const name =
    typeof party.displayName === 'string' && party.displayName.trim()
      ? party.displayName.trim()
      : typeof party.name === 'string' && party.name.trim()
        ? party.name.trim()
        : 'Cliente';
  const details = [
    typeof party.id === 'string' && party.id.trim() ? `id: ${party.id.trim()}` : null,
    typeof party.email === 'string' && party.email.trim() ? `email: ${party.email.trim()}` : null,
    typeof party.phone === 'string' && party.phone.trim() ? `telefone: ${party.phone.trim()}` : null,
  ].filter((value): value is string => Boolean(value));
  return details.length > 0
    ? `Cliente cadastrado com sucesso: ${name} (${details.join(' · ')}).`
    : `Cliente cadastrado com sucesso: ${name}.`;
}

export function parseCrmDirectWriteIntent(invocation: ITeamInvocation): TCrmDirectWriteIntent | null {
  const userHistory = invocation.conversation?.history
    ?.filter((turn) => turn.role === 'user')
    .map((turn) => turn.content.trim())
    .filter(Boolean);
  const draft = buildCrmCreatePartyDraft(invocation.message, userHistory);
  if (!draft.intentClear) return null;
  return {
    actionId: 'crm_create_party',
    input: draft.input,
    reason: 'create_customer_from_context',
    missingFields: draft.missingFields,
  };
}

export function isMaxTurnsExceededOutput(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('max turns') && lower.includes('exceeded');
}

function composeInterruptedUserText(
  reasonCode: TInterruptionReasonCode,
  options?: { detail?: string; systemDetected?: string },
): string {
  const descriptor = buildExecutionInterruptionDescriptor(reasonCode, { detail: options?.detail });
  return [
    `Execução interrompida. ${descriptor.reasonMessage}`,
    options?.systemDetected ? `O sistema identificou: ${options.systemDetected}.` : null,
    `Próximo passo sugerido: ${descriptor.nextStep}`,
  ]
    .filter(Boolean)
    .join(' ');
}

function detectNoProgressInterruption(
  events: ITeamExecutionEvent[],
): {
  reasonCode: TInterruptionReasonCode;
  interruptTool?: string;
  interruptReasonDetail?: string;
  systemDetected: string;
  interruptPolicy: string;
  progressState: string;
} | null {
  const toolErrors = events.filter((e) => e.type === 'toolResult' && e.status === 'error');
  if (toolErrors.length < 2) return null;
  const first = toolErrors[0];
  const sameToolAndError = toolErrors.every(
    (e) => (e.tool ?? '') === (first.tool ?? '') && (e.errorCode ?? '') === (first.errorCode ?? ''),
  );
  if (!sameToolAndError) return null;
  if (first.errorCode === 'MISSING_REQUIRED_FIELDS') {
    return {
      reasonCode: 'MISSING_REQUIRED_FIELDS_REPEATED',
      interruptTool: first.tool,
      interruptReasonDetail: first.detail,
      systemDetected: 'repetição da mesma falha de campos obrigatórios sem progresso',
      interruptPolicy: 'REPEATED_TOOL_FAILURE_GUARD',
      progressState: 'missing_fields_repeated',
    };
  }
  return {
    reasonCode: 'NO_PROGRESS_DETECTED',
    interruptTool: first.tool,
    interruptReasonDetail: first.detail,
    systemDetected: 'repetição da mesma falha de tool sem progresso',
    interruptPolicy: 'NO_PROGRESS_GUARD',
    progressState: 'tool_error_repeated',
  };
}

export interface ICoordinatorExecuteOptions {
  onProgress?: (e: ITeamProgressEvent) => void;
  streamCoordinatorText?: boolean;
  onCoordinatorTextDelta?: (text: string) => void;
}

function mapRuntimeEventToTeamEvent(
  e: TRuntimeEvent,
  rosterSpecialistIds: string[],
  invokedByAgentId?: string,
): ITeamExecutionEvent {
  const base = invokedByAgentId ? { invokedByAgentId } : {};
  if (e.type === 'taskType') return { type: e.type, value: e.value, ...base };
  if (e.type === 'runtimeError') {
    return {
      type: e.type,
      message: e.message,
      ...(e.errorCode ? { errorCode: e.errorCode } : {}),
      ...(e.detail ? { detail: e.detail } : {}),
      ...(e.source ? { source: e.source } : {}),
      ...(e.agentId ? { agentId: e.agentId } : {}),
      ...base,
    };
  }
  const agentId =
    e.tool !== undefined ? resolveSpecialistAgentIdFromToolName(e.tool, rosterSpecialistIds) : undefined;
  return {
    type: e.type,
    tool: e.tool,
    ...(e.callId ? { callId: e.callId } : {}),
    ...(e.type === 'toolCall' && e.toolInput !== undefined ? { toolInput: e.toolInput } : {}),
    ...(e.type === 'toolResult' && e.toolOutput !== undefined ? { toolOutput: e.toolOutput } : {}),
    ...(e.type === 'toolResult' ? { status: e.status } : {}),
    ...(e.type === 'toolResult' && e.errorCode ? { errorCode: e.errorCode } : {}),
    ...(e.type === 'toolResult' && e.detail ? { detail: e.detail } : {}),
    ...(agentId ? { agentId } : {}),
    ...base,
  };
}

export class CoordinatorOrchestratorService {
  constructor(
    private readonly agentRepo: AgentRepository,
    private readonly teamRepo: TeamRepository,
    private readonly agentRuntime: IAgentRuntimeProvider,
    private readonly specialistRegistry: SpecialistRegistry,
    private readonly workspaceIntegrationsService: WorkspaceIntegrationsService,
    private readonly agentMcpBindingRepo: AgentMcpBindingRepository,
    private readonly mcpRepo: McpConnectionRepository,
    private readonly knowledgeSourceRepo: KnowledgeSourceRepository,
    private readonly workspaceToolDefinitionRepo: WorkspaceToolDefinitionRepository,
    private readonly businessToolRuntime: IBusinessToolRuntime,
  ) {}

  async execute(
    invocation: ITeamInvocation,
    options?: ICoordinatorExecuteOptions,
  ): Promise<ITeamExecutionResult> {
    const ws = invocation.workspaceId;
    const team = await this.teamRepo.findById(ws, invocation.teamId);
    if (!team) throw new AppError('NOT_FOUND', 'Time nao encontrado', 404);

    const t = team as Record<string, unknown>;
    const teamRow = {
      id: String(t['id']),
      coordinatorId: String(t['coordinatorId']),
      agentIds: (t['agentIds'] as string[]) ?? [],
      name: String(t['name'] ?? ''),
    };

    assertInvocationMatchesTeam(invocation, teamRow);

    const runId = randomUUID();
    const emitProgress = (partial: Omit<ITeamProgressEvent, 'runId'>) => {
      options?.onProgress?.({ ...partial, runId });
    };
    const correlationId =
      typeof invocation.metadata?.correlationId === 'string'
        ? invocation.metadata.correlationId
        : undefined;
    const executeCrmDirectRead = async (intent: TCrmDirectReadIntent) => {
      const direct = await this.businessToolRuntime.execute({
        workspaceId: ws,
        toolDefinitionId: `team-runtime-direct-${intent.actionId}`,
        actionId: intent.actionId,
        input: intent.input,
        ...(correlationId ? { correlationId } : {}),
      });
      if (!direct.ok) return null;
      return {
        text: formatCrmDirectReadResponse(intent.actionId, direct.result),
        detail: `${intent.reason}:${intent.actionId}`,
      };
    };
    const executeCrmDirectWrite = async (intent: TCrmDirectWriteIntent) => {
      if (intent.missingFields.length > 0) {
        return {
          text: 'Para cadastrar o cliente, preciso apenas do nome. Se quiser, pode enviar tambem email, telefone e observacoes.',
          detail: `${intent.reason}:missing_${intent.missingFields.join('_')}`,
          missingFields: intent.missingFields,
        };
      }
      const direct = await this.businessToolRuntime.execute({
        workspaceId: ws,
        toolDefinitionId: `team-runtime-direct-${intent.actionId}`,
        actionId: intent.actionId,
        input: intent.input,
        ...(correlationId ? { correlationId } : {}),
      });
      if (!direct.ok) {
        if (direct.errorCode === 'MISSING_REQUIRED_FIELDS') {
          const missing = ((direct.result ?? {}) as { missingFields?: unknown }).missingFields;
          const missingFields = Array.isArray(missing)
            ? missing.filter((value): value is string => typeof value === 'string')
            : [];
          return {
            text:
              missingFields.includes('name')
                ? 'Para cadastrar o cliente, preciso apenas do nome. Se quiser, pode enviar tambem email, telefone e observacoes.'
                : 'Nao consegui concluir o cadastro do cliente com os dados atuais. Reenvie nome, email e telefone em uma unica mensagem.',
            detail: `${intent.reason}:validation_failed`,
            missingFields,
          };
        }
        return {
          text: 'Nao consegui concluir o cadastro do cliente agora. Tente novamente com nome, email e telefone em uma unica mensagem.',
          detail: `${intent.reason}:execution_failed`,
          missingFields: [],
        };
      }
      return {
        text: formatCrmDirectWriteResponse(direct.result),
        detail: `${intent.reason}:${intent.actionId}`,
        missingFields: [],
      };
    };

    const now = Date.now();
    const preflightEvents: ITeamExecutionEvent[] = [];
    pruneDestructiveConfirmationMemory(now);
    const memoryKey = computeConversationMemoryKey(invocation);
    const pendingDelete = getPendingDestructiveConfirmation(memoryKey, now);
    if (pendingDelete && hasExplicitConfirmation(invocation.message)) {
      const confirmationHints = extractDestructiveTargetHints(invocation.message);
      const hasTargetMismatch =
        pendingDelete.targetHints.length > 0 &&
        confirmationHints.length > 0 &&
        !confirmationHints.some((hint) => pendingDelete.targetHints.includes(hint));
      if (hasTargetMismatch) {
        DESTRUCTIVE_CONFIRMATION_MEMORY.delete(memoryKey);
        appendDestructiveAudit(ws, memoryKey, 'target_mismatch', invocation.message, now);
        const text =
          'A confirmação chegou com alvo diferente do pedido destrutivo pendente. Reenvie a ação destrutiva com o alvo correto para confirmar novamente.';
        return {
          runId,
          teamId: teamRow.id,
          coordinatorAgentId: teamRow.coordinatorId,
          externalResponse: composeExternalResponseFromModelText(text),
          specialistResults: [],
          events: [
            {
              type: 'destructiveConfirmationTargetMismatch',
              detail: 'Confirmação destrutiva descartada por divergência de alvo.',
            },
            {
              type: 'destructiveAuditSnapshot',
              detail: destructiveAuditSnapshot(memoryKey),
            },
          ],
        };
      }
      DESTRUCTIVE_CONFIRMATION_MEMORY.delete(memoryKey);
      appendDestructiveAudit(ws, memoryKey, 'confirmed', invocation.message, now);
      preflightEvents.push({
        type: 'destructiveAuditSnapshot',
        detail: destructiveAuditSnapshot(memoryKey),
      });
      invocation = {
        ...invocation,
        message:
          invocation.message +
          `\n\n[destructive_confirmation_approved key=${pendingDelete.key}]`,
      };
    } else if (hasDestructiveIntent(invocation.message)) {
      if (!pendingDelete) {
        const key = `del-${Date.now().toString(36)}`;
        DESTRUCTIVE_CONFIRMATION_MEMORY.set(memoryKey, {
          key,
          createdAt: now,
          targetHints: extractDestructiveTargetHints(invocation.message),
        });
      }
      appendDestructiveAudit(ws, memoryKey, 'requested', invocation.message, now);
      const text =
        'Pedido destrutivo identificado. Para continuar, responda com "confirmo" (confirmação única).';
      return {
        runId,
        teamId: teamRow.id,
        coordinatorAgentId: teamRow.coordinatorId,
        externalResponse: composeExternalResponseFromModelText(text),
        specialistResults: [],
        events: [
          { type: 'destructiveConfirmationRequested', detail: 'Aguardando confirmação explícita.' },
          { type: 'destructiveAuditSnapshot', detail: destructiveAuditSnapshot(memoryKey) },
        ],
      };
    }

    const stop = parseRunStopCommand(invocation.message);
    if (stop.requested) {
      const descriptor = buildExecutionInterruptionDescriptor('USER_CANCELLED', {
        detail: stop.stopReason,
      });
      const text = [
        composeInterruptedUserText('USER_CANCELLED', {
          detail: stop.stopReason,
          systemDetected: 'cancelamento solicitado pelo utilizador',
        }),
        stop.stopReason ? `stop_reason: ${stop.stopReason}` : null,
        stop.resumeHint,
      ]
        .filter(Boolean)
        .join(' ');
      return {
        runId,
        teamId: teamRow.id,
        coordinatorAgentId: teamRow.coordinatorId,
        externalResponse: composeExternalResponseFromModelText(text),
        specialistResults: [],
        events: [
          {
            type: 'runCancelled',
            detail: 'Cancelamento solicitado pelo utilizador.',
            ...(stop.stopReason ? { stopReason: stop.stopReason } : {}),
            resumeHint: stop.resumeHint,
            interrupted: true,
            interruptReasonCode: descriptor.reasonCode,
            interruptReasonMessage: descriptor.reasonMessage,
            interruptStep: 'preflight',
            interruptPolicy: 'USER_COMMAND',
            progressState: 'preflight_stop',
            nextStep: descriptor.nextStep,
          },
          {
            type: 'executionInterrupted',
            detail: 'Execução interrompida antes de acionar coordenador.',
            interrupted: true,
            interruptReasonCode: descriptor.reasonCode,
            interruptReasonMessage: descriptor.reasonMessage,
            interruptStep: 'preflight',
            interruptPolicy: 'USER_COMMAND',
            progressState: 'preflight_stop',
            nextStep: descriptor.nextStep,
          },
        ],
      };
    }

    const crmDirectWriteIntent = parseCrmDirectWriteIntent(invocation);
    if (crmDirectWriteIntent) {
      const direct = await executeCrmDirectWrite(crmDirectWriteIntent);
      return {
        runId,
        teamId: teamRow.id,
        coordinatorAgentId: teamRow.coordinatorId,
        externalResponse: composeExternalResponseFromModelText(direct.text),
        specialistResults: [],
        events: [
          {
            type: 'crmDirectWriteRoute',
            detail: direct.detail,
          },
        ],
      };
    }
    const crmDirectIntent = parseCrmDirectReadIntent(invocation.message);
    if (crmDirectIntent) {
      const direct = await executeCrmDirectRead(crmDirectIntent);
      if (direct) {
        return {
          runId,
          teamId: teamRow.id,
          coordinatorAgentId: teamRow.coordinatorId,
          externalResponse: composeExternalResponseFromModelText(direct.text),
          specialistResults: [],
          events: [
            {
              type: 'crmDirectReadRoute',
              detail: direct.detail,
            },
          ],
        };
      }
    }

    const coordinator = await this.agentRepo.findById(ws, teamRow.coordinatorId);
    if (!coordinator) throw new AppError('NOT_FOUND', 'Coordenador nao encontrado', 404);
    assertTeamCoordinatorBinding(coordinator as Record<string, unknown>, teamRow.coordinatorId);

    const specialistIds = listSpecialistIds(teamRow);
    const specialists: Array<{ id: string; name: string; description?: string }> = [];
    for (const sid of specialistIds) {
      const a = await this.agentRepo.findById(ws, sid);
      if (!a) continue;
      const row = a as Record<string, unknown>;
      assertSpecialistAgentRow(row);
      specialists.push({
        id: String(row['id']),
        name: String(row['name'] ?? 'Specialist'),
        description: String(row['description'] ?? ''),
      });
    }

    const specialistResults: ISpecialistResult[] = [];
    const specialistSidecarEvents: ITeamExecutionEvent[] = [];

    const executeSpecialist = async (specialistAgentId: string, instruction: string) => {
      const runtimeMessage = buildSpecialistRuntimeMessage(instruction, invocation.message, invocation.conversation?.history);
      specialistSidecarEvents.push({
        type: 'specialistStarted',
        agentId: specialistAgentId,
        invokedByAgentId: specialistAgentId,
        phase: 'runStep',
        detail: truncateActivity(runtimeMessage),
        toolInstruction: instruction,
        runtimeMessage,
      });
      emitProgress({
        agentId: specialistAgentId,
        status: 'busy',
        phase: 'specialist',
        detail: truncateActivity(runtimeMessage),
      });

      const spec = await this.agentRepo.findById(ws, specialistAgentId);
      if (!spec) {
        const msg = 'Especialista nao encontrado.';
        specialistSidecarEvents.push({
          type: 'specialistFinished',
          agentId: specialistAgentId,
          phase: 'runStep',
          detail: msg,
        });
        emitProgress({
          agentId: specialistAgentId,
          status: 'idle',
          phase: 'specialist',
          detail: msg,
        });
        return msg;
      }
      assertSpecialistAgentRow(spec as Record<string, unknown>);
      const srow = spec as Record<string, unknown>;

      const knowledgeRow = srow['knowledge'] as { sources?: string[] } | undefined;
      const knowledgeSourceIds = Array.isArray(knowledgeRow?.sources)
        ? knowledgeRow.sources.filter((x): x is string => typeof x === 'string')
        : [];

      const knowledgeAppendix = await buildKnowledgeAppendixForAgent(
        ws,
        knowledgeSourceIds,
        this.knowledgeSourceRepo,
      );
      const systemInstruction = buildSpecialistSystemInstruction(srow, knowledgeAppendix);

      const mcpToolSpecs = await loadMcpToolSpecsForAgent(
        ws,
        specialistAgentId,
        this.agentMcpBindingRepo,
        this.mcpRepo,
      );
      const mcpBindingIds = [...new Set(mcpToolSpecs.map((s) => s.bindingId))];

      const toolIntegrationContext = await this.workspaceIntegrationsService.getToolIntegrationContext(ws);

      const capRow = srow['capabilities'] as
        | { tools?: string[]; customToolDefinitionIds?: string[] }
        | undefined;
      const customIds = Array.isArray(capRow?.customToolDefinitionIds)
        ? capRow.customToolDefinitionIds.filter((x): x is string => typeof x === 'string')
        : [];
      const customRows = await this.workspaceToolDefinitionRepo.listByIds(ws, customIds);
      const customToolDefinitions: IWorkspaceCustomToolDefinition[] = customRows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        kind: r.kind,
        jsonSchema: r.jsonSchema,
        config: r.config,
      }));

      const config = composeExecutableAgentConfig({
        agentId: specialistAgentId,
        workspaceId: ws,
        systemInstruction,
        tools: (capRow?.tools ?? []) as string[],
        mcpBindingIds,
        knowledgeSourceIds,
        mcpToolSpecs,
        toolIntegrationContext,
        customToolDefinitions,
        businessToolRuntime: this.businessToolRuntime,
        teamContext: { teamId: teamRow.id, teamName: teamRow.name },
      });
      await this.agentRuntime.compile(config);
      const openaiApiKey = await this.workspaceIntegrationsService.resolveOpenAiApiKey(ws);

      const ext = invocation.coordinatorExternalContext;
      const agentSec = srow['security'] as { accessLevel?: string } | undefined;
      const levelFromAgent = agentSec?.accessLevel;
      const requestedAccessLevel =
        ext.requestedAccessLevel ??
        (levelFromAgent === 'read' || levelFromAgent === 'write' || levelFromAgent === 'restricted'
          ? levelFromAgent
          : undefined);

      const correlationId =
        typeof invocation.metadata?.correlationId === 'string'
          ? invocation.metadata.correlationId
          : undefined;

      const r = await this.agentRuntime.runStep(config, {
        message: runtimeMessage,
        ...(openaiApiKey ? { openaiApiKey } : {}),
        ...(requestedAccessLevel ? { requestedAccessLevel } : {}),
        ...(correlationId ? { correlationId } : {}),
      });
      specialistResults.push({ specialistAgentId, summary: r.finalOutput });
      specialistSidecarEvents.push(
        ...r.events.map((event) => mapRuntimeEventToTeamEvent(event, specialistIds, specialistAgentId)),
      );
      specialistSidecarEvents.push({
        type: 'specialistFinished',
        agentId: specialistAgentId,
        invokedByAgentId: specialistAgentId,
        phase: 'runStep',
        detail: truncateActivity(r.finalOutput),
      });
      emitProgress({
        agentId: specialistAgentId,
        status: 'idle',
        phase: 'specialist',
        detail: truncateActivity(r.finalOutput),
      });
      return r.finalOutput;
    };

    const sdkTools = this.specialistRegistry.buildOpenAiTools({ specialists, executeSpecialist });
    const openaiApiKey = await this.workspaceIntegrationsService.resolveOpenAiApiKey(ws);
    const userMessage = formatCoordinatorUserMessage(invocation);
    const crow = coordinator as Record<string, unknown>;
    const baseCoordinatorSystem = (crow['systemInstruction'] as string | undefined)?.trim();
    const coordinatorSystemInstruction =
      (baseCoordinatorSystem ? `${baseCoordinatorSystem}${COORDINATOR_SPECIALIST_TOOL_GUIDANCE}` : undefined) ??
      `Voce e o coordenador do time de agentes.${COORDINATOR_SPECIALIST_TOOL_GUIDANCE}`;

    const streamText = Boolean(options?.streamCoordinatorText && options?.onCoordinatorTextDelta);
    const timeline: ITeamExecutionEvent[] = [
      { type: 'coordinatorStarted', agentId: teamRow.coordinatorId, invokedByAgentId: teamRow.coordinatorId, phase: 'invoke' },
      ...preflightEvents,
    ];
    emitProgress({
      agentId: teamRow.coordinatorId,
      status: 'busy',
      phase: 'coordinator',
      detail: 'A executar coordenador',
    });

    const result = await this.agentRuntime.runCoordinatorTurn({
      coordinatorAgentId: teamRow.coordinatorId,
      workspaceId: ws,
      systemInstruction: coordinatorSystemInstruction,
      userMessage,
      ...(openaiApiKey ? { openaiApiKey } : {}),
      sdkTools,
      ...(streamText && options?.onCoordinatorTextDelta
        ? { onAssistantTextDelta: options.onCoordinatorTextDelta }
        : {}),
    });
    let finalOutput = result.finalOutput;
    const recoveryIntent = parseCrmDirectReadIntent(invocation.message);
    const interruptedEvents: ITeamExecutionEvent[] = [];
    if (recoveryIntent && isMaxTurnsExceededOutput(finalOutput)) {
      const recovered = await executeCrmDirectRead(recoveryIntent);
      if (recovered) {
        finalOutput = recovered.text;
        timeline.push({
          type: 'crmDirectReadRecoveryAfterMaxTurns',
          detail: recovered.detail,
        });
      } else {
        const descriptor = buildExecutionInterruptionDescriptor('MAX_TURNS_REACHED', { detail: finalOutput });
        finalOutput = composeInterruptedUserText('MAX_TURNS_REACHED', {
          detail: finalOutput,
          systemDetected: 'limite de turns excedido sem progresso suficiente',
        });
        interruptedEvents.push({
          type: 'executionInterrupted',
          detail: 'Interrompido por limite de turns do coordenador.',
          interrupted: true,
          interruptReasonCode: descriptor.reasonCode,
          interruptReasonMessage: descriptor.reasonMessage,
          interruptStep: 'coordinator',
          interruptPolicy: 'MAX_TURNS_GUARD',
          progressState: 'coordinator_max_turns',
          nextStep: descriptor.nextStep,
        });
      }
    }

    emitProgress({
      agentId: teamRow.coordinatorId,
      status: 'idle',
      phase: 'coordinator',
    });

    const coordinatorMapped = result.events.map((e) =>
      mapRuntimeEventToTeamEvent(e, specialistIds, teamRow.coordinatorId),
    );
    if (interruptedEvents.length === 0) {
      const noProgress = detectNoProgressInterruption(coordinatorMapped);
      if (noProgress) {
        const descriptor = buildExecutionInterruptionDescriptor(noProgress.reasonCode, {
          detail: noProgress.interruptReasonDetail,
        });
        finalOutput = composeInterruptedUserText(noProgress.reasonCode, {
          detail: noProgress.interruptReasonDetail,
          systemDetected: noProgress.systemDetected,
        });
        interruptedEvents.push({
          type: 'executionInterrupted',
          detail: 'Interrompido por repetição de falha sem progresso.',
          interrupted: true,
          interruptReasonCode: descriptor.reasonCode,
          interruptReasonMessage: descriptor.reasonMessage,
          interruptStep: 'coordinator',
          interruptTool: noProgress.interruptTool,
          interruptPolicy: noProgress.interruptPolicy,
          progressState: noProgress.progressState,
          nextStep: descriptor.nextStep,
        });
      }
    }
    timeline.push(
      ...coordinatorMapped,
      ...specialistSidecarEvents,
      ...interruptedEvents,
      {
        type: 'coordinatorFinished',
        agentId: teamRow.coordinatorId,
        invokedByAgentId: teamRow.coordinatorId,
        phase: interruptedEvents.length > 0 ? 'interrupted' : 'done',
      },
    );

    return {
      runId,
      teamId: teamRow.id,
      coordinatorAgentId: teamRow.coordinatorId,
      externalResponse: composeExternalResponseFromModelText(finalOutput),
      specialistResults,
      events: timeline,
    };
  }
}
