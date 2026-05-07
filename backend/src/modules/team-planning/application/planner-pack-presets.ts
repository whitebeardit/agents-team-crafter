import { DOMAIN_CAPABILITY_DEFINITIONS, resolveDomainCapabilitySelection } from '../../business-tools/application/domain-capability-registry.js';

/**
 * Mapeia identificadores de pack (campo `requiredPacks` do planner) para actionIds registados no BusinessToolRegistry.
 * A fonte canónica dos domínios e dependências é `domain-capability-registry`.
 */
export const PLANNER_PACK_TO_ACTION_IDS: Readonly<Record<string, readonly string[]>> = Object.freeze(
  Object.fromEntries(DOMAIN_CAPABILITY_DEFINITIONS.map((domain) => [domain.id, domain.actionIds])),
);

/** Chaves canónicas de pack (mesma ordem que `PLANNER_PACK_TO_ACTION_IDS` para prompts e docs). */
export const PLANNER_PACK_IDS: readonly string[] = Object.freeze(Object.keys(PLANNER_PACK_TO_ACTION_IDS));

export function collectPlannerActionIds(
  requiredTools: string[] | undefined,
  requiredPacks: string[] | undefined,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    const t = id.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  for (const t of requiredTools ?? []) push(t);
  for (const a of resolveDomainCapabilitySelection(requiredPacks ?? []).actionIds) push(a);
  return out;
}

/** Loop 83 — há pelo menos um agente com listas de negócio por agente (não só globais). */
export function hasPerAgentBindHints(
  agents: ReadonlyArray<{ requiredBusinessActionIds?: string[]; requiredPackIds?: string[] }>,
): boolean {
  return agents.some(
    (a) => (a.requiredBusinessActionIds?.length ?? 0) > 0 || (a.requiredPackIds?.length ?? 0) > 0,
  );
}

export type TPlannerAgentBindSlice = {
  role: 'coordinator' | 'specialist';
  requiredBusinessActionIds: string[];
  requiredPackIds: string[];
};

/**
 * Loop 83 — candidatos de `actionId` para bind deste agente.
 * Sem hints por agente: todos herdam o conjunto global (comportamento legado).
 * Com hints: cada agente usa apenas as suas listas (podem ser vazias — ex.: coordenador sem tools de negócio).
 */
export function collectAgentBindActionCandidates(
  agent: TPlannerAgentBindSlice,
  globalRequiredTools: string[] | undefined,
  globalRequiredPacks: string[] | undefined,
  usePerAgentMode: boolean,
): string[] {
  if (!usePerAgentMode) {
    return collectPlannerActionIds(globalRequiredTools, globalRequiredPacks);
  }
  return collectPlannerActionIds(agent.requiredBusinessActionIds, agent.requiredPackIds);
}

function mergeOrderedUniqueActionIds(lists: ReadonlyArray<readonly string[]>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const id of list) {
      const t = id.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/** Pack ids globais + por agente (dedupe, lower-case canónico para lookup em presets). */
export function mergePlannerPackIdsForBind(
  agents: ReadonlyArray<{ requiredPackIds?: string[] }>,
  globalRequiredPacks: string[] | undefined,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string) => {
    const k = raw.trim().toLowerCase();
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(k);
  };
  for (const p of globalRequiredPacks ?? []) push(p);
  for (const a of agents) {
    for (const p of a.requiredPackIds ?? []) push(p);
  }
  return out;
}

export interface IPlannerBindActionUniverse {
  usePerAgentMode: boolean;
  /** União de todos os candidatos (antes do teto). */
  actionIdsFull: string[];
  /** União após teto `maxActions`. */
  actionIds: string[];
  actionIdsTruncated: boolean;
  /** Por agente, intersecção com `actionIds` (pós-teto). */
  perAgentActionIds: string[][];
}

/**
 * Loop 83 — universo de actionIds para preview/execute: legado = lista global repetida por agente;
 * per-agent = união das listas por agente + teto global.
 */
export function computePlannerBindActionUniverse(
  agents: readonly TPlannerAgentBindSlice[],
  globalRequiredTools: string[] | undefined,
  globalRequiredPacks: string[] | undefined,
  maxActions: number,
): IPlannerBindActionUniverse {
  const usePerAgentMode = hasPerAgentBindHints(agents);
  const perAgentRaw = agents.map((a) =>
    collectAgentBindActionCandidates(a, globalRequiredTools, globalRequiredPacks, usePerAgentMode),
  );
  const actionIdsFull = mergeOrderedUniqueActionIds(perAgentRaw);
  const actionIdsTruncated = actionIdsFull.length > maxActions;
  const capped = actionIdsFull.slice(0, maxActions);
  const capSet = new Set(capped);
  const perAgentActionIds = perAgentRaw.map((ids) => ids.filter((id) => capSet.has(id)));
  return {
    usePerAgentMode,
    actionIdsFull,
    actionIds: capped,
    actionIdsTruncated,
    perAgentActionIds,
  };
}

export function actionIdToToolSlug(actionId: string): string {
  const s = actionId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = s ? `ba-${s}` : 'ba-tool';
  return base.slice(0, 80);
}
