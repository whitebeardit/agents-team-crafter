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

export interface ICoordinatorExecuteOptions {
  onProgress?: (e: ITeamProgressEvent) => void;
  streamCoordinatorText?: boolean;
  onCoordinatorTextDelta?: (text: string) => void;
}

function mapRuntimeEventToTeamEvent(e: TRuntimeEvent, rosterSpecialistIds: string[]): ITeamExecutionEvent {
  if (e.type === 'taskType') return { type: e.type, value: e.value };
  const agentId =
    e.tool !== undefined ? resolveSpecialistAgentIdFromToolName(e.tool, rosterSpecialistIds) : undefined;
  return {
    type: e.type,
    tool: e.tool,
    status: e.status,
    errorCode: e.errorCode,
    ...(e.detail ? { detail: e.detail } : {}),
    ...(agentId ? { agentId } : {}),
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
      const text = [
        'Execução interrompida por pedido do utilizador. Não realizei novas ações.',
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
          },
        ],
      };
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
      const runtimeMessage = buildSpecialistRuntimeMessage(instruction, invocation.message);
      specialistSidecarEvents.push({
        type: 'specialistStarted',
        agentId: specialistAgentId,
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
      specialistSidecarEvents.push({
        type: 'specialistFinished',
        agentId: specialistAgentId,
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
      { type: 'coordinatorStarted', agentId: teamRow.coordinatorId, phase: 'invoke' },
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

    emitProgress({
      agentId: teamRow.coordinatorId,
      status: 'idle',
      phase: 'coordinator',
    });

    const coordinatorMapped = result.events.map((e) => mapRuntimeEventToTeamEvent(e, specialistIds));
    timeline.push(...coordinatorMapped, ...specialistSidecarEvents, {
      type: 'coordinatorFinished',
      agentId: teamRow.coordinatorId,
      phase: 'done',
    });

    return {
      runId,
      teamId: teamRow.id,
      coordinatorAgentId: teamRow.coordinatorId,
      externalResponse: composeExternalResponseFromModelText(result.finalOutput),
      specialistResults,
      events: timeline,
    };
  }
}
