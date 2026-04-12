/**
 * Loop 82 — ownership de workflow por agente no team plan: `workflowKey` estável por especialista,
 * sem duplicar o mesmo domínio entre dois especialistas no mesmo plano (comparação case-insensitive).
 */

export type TPlannerAgentWorkflowInput = {
  role: 'coordinator' | 'specialist';
  category: string;
  workflowKey: string;
};

/**
 * Normaliza `workflowKey` por agente: coordenador usa `coordination` se vazio;
 * especialistas recebem chave derivada de `category` se vazia; colisões entre especialistas
 * são resolvidas com sufixos `__1`, `__2`, … (comparação case-insensitive).
 */
export function ensurePlannerAgentWorkflowKeys<T extends TPlannerAgentWorkflowInput>(agents: T[]): T[] {
  const specialistKeysLower = new Set<string>();
  return agents.map((agent) => {
    if (agent.role === 'coordinator') {
      const key = agent.workflowKey.trim() || 'coordination';
      return { ...agent, workflowKey: key };
    }
    let key = agent.workflowKey.trim();
    if (!key) {
      key = slugifyPlannerCategory(agent.category);
    }
    let candidate = key;
    let n = 0;
    while (specialistKeysLower.has(candidate.toLowerCase())) {
      n += 1;
      candidate = `${key}__${n}`;
    }
    specialistKeysLower.add(candidate.toLowerCase());
    return { ...agent, workflowKey: candidate };
  });
}

export function slugifyPlannerCategory(category: string): string {
  const s = category
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s || 'domain';
}
