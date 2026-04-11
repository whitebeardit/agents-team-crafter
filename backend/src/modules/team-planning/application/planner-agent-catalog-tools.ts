import { normalizeCatalogToolIds } from '../../agents/domain/available-tools.js';
import type { TPlannerOutput } from './team-plan-planner-output.schema.js';

type TPlanAgent = TPlannerOutput['agents'][number];

const SPECIALIST_DEFAULT_ROTATION: readonly (readonly string[])[] = [
  ['web_search', 'file_search'],
  ['web_search', 'code_execution'],
  ['web_search', 'database_query'],
  ['web_search', 'calendar_access'],
  ['web_search', 'email_send'],
];

function agentTextBlob(agent: TPlanAgent): string {
  const parts = [
    agent.name,
    agent.description,
    agent.objective,
    agent.category,
    ...(agent.skills ?? []),
    ...(agent.responsibilities ?? []),
  ];
  return parts.join(' ').toLowerCase();
}

/**
 * Heurística quando o planner não envia `catalogTools` (fallback/template ou modelo antigo).
 * Coordenador: mínimo (`web_search`). Especialistas: keywords → subconjunto; senão rotação por índice para diferenciar.
 */
export function inferCatalogToolsForPlanAgent(
  agent: TPlanAgent,
  ctx: {
    specialistIndex: number;
    requiredPacksLower: readonly string[];
  },
): string[] {
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
  if (/sql|postgres|banco de dados|\bdados\b|relat[oó]rio|financeiro|contas|receb|pagar/.test(t)) picked.add('database_query');
  if (/c[oó]digo|code|github|pull request|\bpr\b|script|pipeline|\bci\b|sandbox/.test(t)) picked.add('code_execution');
  if (/email|e-mail|smtp|notifica(c|ç)/.test(t)) picked.add('email_send');
  if (/agenda|calend[aá]rio|hor[aá]rio|agendamento|appointment|lembrete/.test(t)) picked.add('calendar_access');
  if (/documento|pdf|arquivo|pesquisa|literatura|nota t[eé]cnica/.test(t)) picked.add('file_search');

  if (ctx.requiredPacksLower.some((p) => p === 'scheduling' || p === 'reminders') && picked.size === 1) {
    picked.add('calendar_access');
  }

  if (picked.size > 1) {
    return normalizeCatalogToolIds([...picked]);
  }

  const rot = SPECIALIST_DEFAULT_ROTATION[ctx.specialistIndex % SPECIALIST_DEFAULT_ROTATION.length]!;
  return normalizeCatalogToolIds([...rot]);
}

export function resolveCatalogToolsForPlanAgent(
  agent: TPlanAgent,
  ctx: { plan: TPlannerOutput; specialistIndex: number },
): string[] {
  const normalized = normalizeCatalogToolIds(agent.catalogTools ?? []);
  if (normalized.length > 0) return normalized;
  const requiredPacksLower = (ctx.plan.requiredPacks ?? []).map((p) => p.trim().toLowerCase());
  return inferCatalogToolsForPlanAgent(agent, {
    specialistIndex: ctx.specialistIndex,
    requiredPacksLower,
  });
}
