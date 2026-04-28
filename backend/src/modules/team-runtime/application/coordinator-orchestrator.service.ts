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
  buildCoordinatorTeamRosterAppendix,
  extractExampleUserPhrasesFromAgentDomain,
} from './build-coordinator-team-roster-appendix.js';
import {
  resolveSpecialistAgentIdFromToolName,
  SpecialistRegistry,
} from '../infra/registries/specialist-registry.js';
import type { WorkspaceIntegrationsService } from '../../settings/application/workspace-integrations.service.js';
import {
  buildExecutionInterruptionDescriptor,
  type TInterruptionReasonCode,
} from '../domain/execution-interruption.js';

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
export const COORDINATOR_SPECIALIST_TOOL_GUIDANCE = `

## Ferramentas de especialistas
Cada chamada recebe o parâmetro \`instruction\`. O sistema repassa automaticamente a **mensagem completa do utilizador** ao especialista quando ainda não estiver incluída nessa instrução; podes focar a \`instruction\` na tarefa e confiar nesse reenvio para código ou texto longo.

## Desambiguação e roster
Se a intenção do utilizador for vaga ou puder caber em mais do que um especialista, usa primeiro a secção **"## Equipa / especialistas"** acima (nome, domínio, exemplos) e faz **uma** pergunta objetiva para escolher o rumo — **sem** chamar tool de especialista só para listar opções. Quando o catálogo ou schema da ação de negócio já definir campos obrigatórios, **não** uses o especialista apenas para repetir essa lista; responde tu com base no contrato ou pede ao utilizador o que falta.

## Ações de negócio (internal_action / ws_*)
Para criar ou alterar dados, **não invoques** a tool enquanto faltarem campos obrigatórios do contrato. Identifica o que falta e faz **uma** pergunta compacta com todos os itens em falta; depois executa a tool. Se o runtime devolver erro de campos em falta, usa essa lista na próxima resposta em vez de repetir a chamada vazia.
Antes de acionar qualquer especialista para WRITE/UPDATE, confirma no catálogo da própria tool quais são os obrigatórios e só então pergunta ao utilizador no **mesmo padrão esperado pela tool** (nomes de campos e formato).
Se o utilizador perguntar "quais campos obrigatórios", responde com a lista objetiva dos obrigatórios da tool escolhida e já peça os valores no formato correto, sem executar a ação ainda.
Para leituras simples, evita confirmações redundantes e executa direto quando a intenção estiver clara.
Para ações **não destrutivas** (ex.: criação/edição administrativa), evita ritual de "responda confirmo"; se a intenção estiver clara e os obrigatórios completos, executa diretamente.
Para cadastro CRM com \`crm_create_party\`: tendo \`name\` e \`phone\`, aciona a tool imediatamente; \`email\` e \`notes\` são opcionais e nunca devem bloquear o cadastro nem gerar uma segunda confirmação.
Ao delegar para especialista de CRM, inclui na \`instruction\` os campos já coletados em formato chave/valor (\`name\`, \`phone\`, \`email\`, \`notes\`) para evitar nova coleta do que já foi informado.
No fluxo clínico com pacotes, após uma operação de criação/escrita de pacote, executa validação imediata de leitura para o mesmo paciente (\`partyId\` ou \`phone\` / celular no CRM) (\`read-after-write\`) antes de liberar agendamento.
O utilizador identifica pacientes pelo **telefone/celular** na conversa sempre que possível; nas ações internas que pedem \`partyId\`, também pode enviar \`phone\` quando o número corresponder a um único cadastro CRM — preserva e reenvia esses dados nas instruções aos especialistas para não voltar a pedir IDs internos.

### Fluxo clínico só com telefone (evitar loop)
- **Nunca** peças \`partyId\`, \`patientId\`, \`packageSaleId\` ao utilizador se ele já deu um **telefone único** nesta conversa para esse paciente — copia esse número explicitamente na \`instruction\` ao especialista seguinte (\`phone: ...\`).
- Para **listar pacotes/saldos por paciente**, a ação certa é \`package_list_by_party\` com \`phone\` ou \`partyId\`. O runtime localiza a party a partir do telefone — **não** exijas um passo de “encontrar no CRM” ao utilizador nem perguntes “posso seguir?”: com o número dito, a tool já resolve. **Não** uses \`package_get_balance\` para identificar paciente (\`package_get_balance\` só aceita \`packageSaleId\`, já obtido na listagem ou na venda). “Listar os pacotes do cliente” por telefone **não** é \`package_get_balance\`; devolve várias linhas com saldo cada uma — não digas que telefone “não é ID” para essa listagem.
- Para **agendar após criar pacote**, se não houver \`packageSaleId\` na mensagem mas existir **uma** venda elegível para aquela party, o runtime pode amarrar automaticamente — inclui mesmo assim \`phone\` no payload da \`schedule_create_appointment\`.
- Se o especialista responder que “falta ID interno”, **corrige tu**: repete o telefone na instrução e pede uso das tools com \`phone\`; não devolves ao utilizador um segundo pedido de IDs se o CRM já foi identificado pelo número.

Quando uma tool falhar, distingue explicitamente: indisponibilidade técnica temporária vs bloqueio de regra de negócio vs falta de dado obrigatório.
No domínio \`care\`, \`phone\` é apenas lookup de entrada: antes da execução final, delega com \`partyId\` canónico resolvido. Para \`care_update_subject\`, inclui \`subjectId\` e, quando houver contexto de cliente, envia também \`partyId\` para validação de ownership.
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

/** Removes jargon like `party-id` so `\bparty\b` does not false-trigger CRM mention detection. */
function stripPartyIdJargonForCrmMention(text: string): string {
  return text
    .replace(/\bparty[-_ ]?id\b/gi, ' ')
    .replace(/\bpartyid\b/gi, ' ')
    .replace(/\bparty_id\b/gi, ' ');
}

/**
 * Messages that mix CRM identifiers with operational domains (packages, scheduling, billing)
 * must go through the coordinator — the CRM direct-read shortcut would end the turn too early.
 */
export function isCompositeOperationalMessage(lower: string): boolean {
  if (/\bnota\s+fiscal\b/i.test(lower)) return true;
  const compositeWord = new RegExp(
    [
      'agendar',
      'reagendar',
      'remarcar',
      'agendamento',
      'agendamentos',
      '\\bagenda\\b',
      'marcar',
      'marque',
      'encaixe',
      'consulta',
      'consultas',
      'sess[aã]o',
      'sess[oô]es',
      'atendimento',
      'atendimentos',
      'venda',
      'vendas',
      'vender',
      'registrar',
      'registra',
      'registro',
      'pacote',
      'pacotes',
      'saldo',
      'saldos',
      'financeiro',
      'financeira',
      'pagamento',
      'pagamentos',
      'pagar',
      'cobrar',
      'cobran[cç]a',
      'fatura',
      'faturas',
      'faturamento',
      'boleto',
      'boletos',
      'or[cç]amento',
      'recarga',
      'recargas',
      'cancelar',
      'pix',
    ].join('|'),
    'i',
  );
  return compositeWord.test(lower);
}

/**
 * Phrases that ask to *create* or *register* a person in the CRM are not a direct read
 * of `crm_find_party` — routing there would return "not found" before the coordenador
 * can run the cadastro tool.
 */
export function isCrmCreateOrRegistrationMessage(lower: string): boolean {
  if (
    /\b(cadastre|cadastrar|cadastrando|cadastra|cadastram|cadastramos|incluir|incluindo|adicionar|adiciona|inscrever|inscrevendo|inscreva|inscreveu)\b/.test(
      lower,
    )
  ) {
    return true;
  }
  if (/\bcri(ação|ar|amos|ando)\b/.test(lower)) return true;
  if (/\b(nov[oa]\s+)(paciente|cliente|customer|contato)\b/.test(lower)) return true;
  if (/\b(crie|cria)\b/.test(lower) && /\b(paciente|cliente|customer)\b/.test(lower)) return true;
  return false;
}

export function parseCrmDirectReadIntent(message: string): TCrmDirectReadIntent | null {
  const raw = message.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  if (isCompositeOperationalMessage(lower)) return null;
  if (isCrmCreateOrRegistrationMessage(lower)) return null;

  const forCustomerMention = stripPartyIdJargonForCrmMention(lower);
  const mentionsCustomer =
    /\b(cliente|clientes|customer|customers|party|parties|paciente|pacientes)\b/.test(forCustomerMention);
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
    const specialists: Array<{
      id: string;
      name: string;
      description?: string;
      category?: string;
      exampleUserPhrases?: string[];
    }> = [];
    const rosterInputs: Array<{
      name: string;
      category?: string;
      goal?: string;
      description?: string;
      exampleUserPhrases?: string[];
    }> = [];
    for (const sid of specialistIds) {
      const a = await this.agentRepo.findById(ws, sid);
      if (!a) continue;
      const row = a as Record<string, unknown>;
      assertSpecialistAgentRow(row);
      const name = String(row['name'] ?? 'Specialist');
      const description = String(row['description'] ?? '');
      const category = String(row['category'] ?? '');
      const goal = typeof row['goal'] === 'string' ? row['goal'] : '';
      const exampleUserPhrases = extractExampleUserPhrasesFromAgentDomain(row['domain']);
      specialists.push({
        id: String(row['id']),
        name,
        description,
        ...(category.trim() ? { category } : {}),
        ...(exampleUserPhrases.length ? { exampleUserPhrases } : {}),
      });
      rosterInputs.push({
        name,
        category,
        goal,
        description,
        exampleUserPhrases,
      });
    }
    const rosterAppendix = buildCoordinatorTeamRosterAppendix(rosterInputs);

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

      const specialistRuntimeModel = await this.workspaceIntegrationsService.resolveAgentsRuntimeModel(
        ws,
        typeof srow['openaiRuntimeModel'] === 'string' ? srow['openaiRuntimeModel'] : null,
      );

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
        openaiRuntimeModel: specialistRuntimeModel,
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
    const coordinatorRuntimeModel = await this.workspaceIntegrationsService.resolveAgentsRuntimeModel(
      ws,
      typeof crow['openaiRuntimeModel'] === 'string' ? crow['openaiRuntimeModel'] : null,
    );
    const baseCoordinatorSystem = (crow['systemInstruction'] as string | undefined)?.trim();
    const coordinatorCore = baseCoordinatorSystem?.length
      ? baseCoordinatorSystem
      : 'Voce e o coordenador do time de agentes.';
    const coordinatorSystemInstruction = `${coordinatorCore}${rosterAppendix}${COORDINATOR_SPECIALIST_TOOL_GUIDANCE}`;

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
      openaiRuntimeModel: coordinatorRuntimeModel,
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

    const coordinatorMapped = result.events.map((e) => mapRuntimeEventToTeamEvent(e, specialistIds));
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
