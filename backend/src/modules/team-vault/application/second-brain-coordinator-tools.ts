import { tool } from '@openai/agents';
import { z } from 'zod';
import type { IEnv } from '../../../config/env.js';
import type { ITeamProgressEvent } from '../../team-runtime/domain/team-progress-event.js';
import { SecondBrainRecallService } from './second-brain-recall.service.js';
import { SecondBrainCuratorService } from './second-brain-curator.service.js';
import { vaultNoteKindSchema } from '../domain/vault-note-frontmatter.schema.js';

type TEmit = (e: Omit<ITeamProgressEvent, 'runId'>) => void;

const breakerState = new Map<string, { consecutiveFailures: number; openUntil: number }>();
const recallCache = new Map<string, { expires: number; json: string }>();

function isBreakerOpen(workspaceId: string): boolean {
  const st = breakerState.get(workspaceId);
  if (!st) return false;
  return Date.now() < st.openUntil;
}

function recordFailure(workspaceId: string, env: IEnv): void {
  const th = env.SECOND_BRAIN_BREAKER_THRESHOLD ?? 5;
  const openMs = env.SECOND_BRAIN_BREAKER_OPEN_MS ?? 300_000;
  const st = breakerState.get(workspaceId) ?? { consecutiveFailures: 0, openUntil: 0 };
  if (Date.now() >= st.openUntil && st.openUntil > 0) {
    st.consecutiveFailures = 0;
  }
  st.consecutiveFailures += 1;
  if (st.consecutiveFailures >= th) {
    st.openUntil = Date.now() + openMs;
    st.consecutiveFailures = 0;
  }
  breakerState.set(workspaceId, st);
}

function recordSuccess(workspaceId: string): void {
  breakerState.delete(workspaceId);
}

function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(onTimeout()), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(onTimeout());
      },
    );
  });
}

export function buildSecondBrainCoordinatorTools(ctx: {
  env: IEnv;
  recallService: SecondBrainRecallService;
  curatorService: SecondBrainCuratorService;
  workspaceId: string;
  coordinatorAgentId: string;
  runId: string;
  emitProgress?: TEmit;
  /** Party CRM actual (ex.: contexto clinico) — usado como fallback se a tool nao enviar partyId. */
  defaultPartyId?: string;
}): unknown[] {
  const recallSchema = z.object({
    topic: z.string().min(1).describe('Topico curto para procurar na memoria do time'),
    intent: z.string().min(1).describe('Intencao do utilizador neste turno'),
    agentId: z.string().optional().describe('Filtrar aprendizados de um especialista (ObjectId)'),
    partyId: z.string().optional().describe('Filtrar aprendizados do cliente/party (ObjectId CRM)'),
    kind: z.enum(['do', 'dont', 'preference', 'correction', 'fact']).optional(),
    limit: z.number().int().min(1).max(20).optional(),
  });

  const proposeSchema = z.object({
    topic: z.string().min(1),
    kind: vaultNoteKindSchema,
    content: z.string().min(1).describe('Regra ou preferencia a persistir como proposta'),
    evidenceQuote: z.string().min(1).describe('Trecho da conversa que sustenta a regra'),
    agentId: z.string().min(1).describe('Especialista alvo (ObjectId)'),
    partyId: z.string().optional().describe('Cliente/party CRM (ObjectId) — nota em parties/<id>/'),
    confidence: z.number().min(0).max(1).optional(),
  });

  return [
    tool({
      name: 'second_brain_recall',
      description:
        'Consulta a memoria persistente do time (second-brain). Usar antes de delegar a um especialista. Devolve notas active relevantes em JSON.',
      parameters: recallSchema,
      execute: async (input) => {
        if (isBreakerOpen(ctx.workspaceId)) {
          ctx.emitProgress?.({
            agentId: ctx.coordinatorAgentId,
            status: 'busy',
            phase: 'memory.disabled',
            detail: 'Memoria do time temporariamente indisponivel (circuit breaker).',
          });
          return JSON.stringify({ notes: [], applied: 0, reason: 'disabled' });
        }
        const partyKey = (input.partyId?.trim() || ctx.defaultPartyId?.trim() || '').toLowerCase();
        const cacheKey = `${ctx.workspaceId}:${input.agentId ?? ''}:${partyKey}:${input.topic}:${input.intent}`.toLowerCase();
        const ttl = ctx.env.SECOND_BRAIN_RECALL_CACHE_TTL_MS ?? 60_000;
        const cached = recallCache.get(cacheKey);
        if (cached && Date.now() < cached.expires) {
          return cached.json;
        }
        ctx.emitProgress?.({
          agentId: ctx.coordinatorAgentId,
          status: 'busy',
          phase: 'memory.recall',
          detail: 'A consultar memoria do time...',
        });
        const timeoutMs = ctx.env.SECOND_BRAIN_RECALL_TIMEOUT_MS ?? 1500;
        const partyId = input.partyId?.trim() || ctx.defaultPartyId?.trim();
        const result = await withTimeout(
          ctx.recallService.recall({
            workspaceId: ctx.workspaceId,
            topic: input.topic,
            intent: input.intent,
            agentId: input.agentId,
            partyId: partyId || undefined,
            kind: input.kind,
            limit: input.limit,
          }),
          timeoutMs,
          () => ({ notes: [], applied: 0, reason: 'timeout' as const }),
        );
        if (result.reason === 'timeout') {
          recordFailure(ctx.workspaceId, ctx.env);
        } else {
          recordSuccess(ctx.workspaceId);
        }
        const detail =
          result.reason === 'ok'
            ? `${result.applied} aprendizado(s) da memoria do time`
            : result.reason === 'no_relevant_memory'
              ? 'Sem aprendizados relevantes na memoria do time'
              : result.reason === 'timeout'
                ? 'Timeout ao consultar memoria do time'
                : result.reason === 'budget_exhausted'
                  ? 'Budget de memoria excedido'
                  : 'Memoria do time indisponivel';
        ctx.emitProgress?.({
          agentId: ctx.coordinatorAgentId,
          status: 'busy',
          phase: 'memory.recall',
          detail,
        });
        const json = JSON.stringify(result);
        recallCache.set(cacheKey, { expires: Date.now() + ttl, json });
        return json;
      },
    }),
    tool({
      name: 'second_brain_propose_learning',
      description:
        'Propoe um aprendizado para revisao humana no second-brain (nao ativa ate aprovacao). Usar quando o utilizador corrigir comportamento ou der regra persistente com evidencia.',
      parameters: proposeSchema,
      execute: async (input) => {
        if (isBreakerOpen(ctx.workspaceId)) {
          ctx.emitProgress?.({
            agentId: ctx.coordinatorAgentId,
            status: 'busy',
            phase: 'memory.disabled',
            detail: 'Proposta de memoria temporariamente indisponivel.',
          });
          return JSON.stringify({ stored: false, reason: 'disabled' });
        }
        ctx.emitProgress?.({
          agentId: ctx.coordinatorAgentId,
          status: 'busy',
          phase: 'memory.write',
          detail: 'A registar proposta na memoria do time...',
        });
        try {
          const r = await ctx.curatorService.proposeLearning({
            workspaceId: ctx.workspaceId,
            agentId: input.agentId,
            kind: input.kind,
            topic: input.topic,
            content: input.content,
            evidenceQuote: input.evidenceQuote,
            runId: ctx.runId,
            confidence: input.confidence,
            partyId: input.partyId?.trim() || ctx.defaultPartyId?.trim(),
          });
          const detail = r.stored
            ? 'Proposta enviada para revisao na memoria do time'
            : `Proposta nao guardada: ${r.reason ?? 'unknown'}`;
          ctx.emitProgress?.({
            agentId: ctx.coordinatorAgentId,
            status: 'busy',
            phase: 'memory.write',
            detail,
          });
          if (r.stored) recordSuccess(ctx.workspaceId);
          return JSON.stringify(r);
        } catch (e) {
          recordFailure(ctx.workspaceId, ctx.env);
          const msg = e instanceof Error ? e.message : String(e);
          ctx.emitProgress?.({
            agentId: ctx.coordinatorAgentId,
            status: 'busy',
            phase: 'memory.write',
            detail: `Erro ao propor memoria: ${msg}`,
          });
          return JSON.stringify({ stored: false, reason: msg });
        }
      },
    }),
  ];
}
