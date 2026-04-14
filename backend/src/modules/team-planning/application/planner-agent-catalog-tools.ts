import { normalizeCatalogToolIds } from '../../agents/domain/available-tools.js';
import type { TPlannerOutput } from './team-plan-planner-output.schema.js';

type TPlanAgent = TPlannerOutput['agents'][number];

/** Packs que justificam `calendar_access` quando não há texto explícito (Loop 84). */
const PACK_IDS_CALENDAR_HINT = new Set(['scheduling', 'reminders']);

function dedupeLowerPacks(packs: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of packs) {
    const k = raw.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

/**
 * Loop 84/86 — contexto de packs para inferência de builtins.
 * Coordenador: `requiredPacks` globais.
 * Especialista: `requiredPackIds` do agente; se o plano tiver hints por agente em qualquer especialista,
 * não herdar `requiredPacks` globais para quem não especificou (evita poluição de builtins).
 */
export function inferCatalogPackContextLower(agent: TPlanAgent, plan: TPlannerOutput): string[] {
  if (agent.role === 'coordinator') {
    return dedupeLowerPacks(plan.requiredPacks ?? []);
  }
  const hasAnyPerAgentHints = plan.agents.some(
    (a) =>
      a.role === 'specialist' &&
      ((a.requiredPackIds?.length ?? 0) > 0 || (a.requiredBusinessActionIds?.length ?? 0) > 0),
  );
  const agentPacks = dedupeLowerPacks(agent.requiredPackIds ?? []);
  if (agentPacks.length > 0) return agentPacks;
  if (hasAnyPerAgentHints) {
    return [];
  }
  return dedupeLowerPacks(plan.requiredPacks ?? []);
}

function applyPackHintsToPicked(packsLower: readonly string[], picked: Set<string>): void {
  if (packsLower.some((p) => PACK_IDS_CALENDAR_HINT.has(p))) {
    picked.add('calendar_access');
  }
  /** Loop 87: não inferir `internal_actions` (stub de catálogo); ações de negócio reais vêm de `customToolDefinitionIds` → `ws_*` / `internal_action`. */
}

function agentTextBlob(agent: TPlanAgent): string {
  const parts = [
    agent.name,
    agent.description,
    agent.objective,
    agent.category,
    agent.workflowKey,
    ...(agent.skills ?? []),
    ...(agent.responsibilities ?? []),
  ];
  return parts.join(' ').toLowerCase();
}

/**
 * Heurística quando o planner não envia `catalogTools` (fallback/template ou modelo antigo).
 * Loop 84: **sem** rotação por índice; fallback mínimo `web_search`; packs (por agente ou globais)
 * reforçam hints controlados (calendar / internal_actions).
 */
export function inferCatalogToolsForPlanAgent(
  agent: TPlanAgent,
  ctx: {
    specialistIndex: number;
    /** Packs em contexto lower-case (ver `inferCatalogPackContextLower`). */
    requiredPacksLower: readonly string[];
  },
): string[] {
  void ctx.specialistIndex;
  if (agent.role === 'coordinator') {
    const packs = ctx.requiredPacksLower;
    if (packs.some((p) => p.includes('scheduling') || p.includes('reminders'))) {
      return normalizeCatalogToolIds(['web_search', 'calendar_access']);
    }
    return normalizeCatalogToolIds(['web_search']);
  }

  const t = agentTextBlob(agent);
  const picked = new Set<string>(['web_search']);

  if (/imagem|visual|arte|dall|capa|banner|instagram|social|midia|m[ií]dia/.test(t)) picked.add('image_generation');
  if (/c[oó]digo|code|github|pull request|\bpr\b|script|pipeline|\bci\b|sandbox/.test(t)) picked.add('code_execution');
  if (/email|e-mail|smtp|notifica(c|ç)/.test(t)) picked.add('email_send');
  if (/agenda|calend[aá]rio|hor[aá]rio|agendamento|appointment|lembrete/.test(t)) picked.add('calendar_access');
  if (/documento|pdf|arquivo|pesquisa|literatura|nota t[eé]cnica/.test(t)) picked.add('file_search');

  applyPackHintsToPicked(ctx.requiredPacksLower, picked);

  return normalizeCatalogToolIds([...picked]);
}

export function resolveCatalogToolsForPlanAgent(
  agent: TPlanAgent,
  ctx: { plan: TPlannerOutput; specialistIndex: number },
): string[] {
  const normalized = normalizeCatalogToolIds(agent.catalogTools ?? []);
  if (normalized.length > 0) return normalized;
  const requiredPacksLower = inferCatalogPackContextLower(agent, ctx.plan);
  return inferCatalogToolsForPlanAgent(agent, {
    specialistIndex: ctx.specialistIndex,
    requiredPacksLower,
  });
}
