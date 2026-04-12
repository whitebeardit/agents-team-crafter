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
 * especialistas recebem chave derivada de `category` se vazia.
 * Loop 86: **não** desambigua duplicatas com sufixo — conflitos são validados / reparados pelo pipeline.
 */
export function ensurePlannerAgentWorkflowKeys<T extends TPlannerAgentWorkflowInput>(agents: T[]): T[] {
  return agents.map((agent) => {
    if (agent.role === 'coordinator') {
      const key = agent.workflowKey.trim() || 'coordination';
      return { ...agent, workflowKey: key };
    }
    let key = agent.workflowKey.trim();
    if (!key) {
      key = slugifyPlannerCategory(agent.category);
    }
    return { ...agent, workflowKey: key };
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
