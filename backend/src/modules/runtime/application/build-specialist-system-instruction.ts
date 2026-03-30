/**
 * Monta o texto de instruções efetivo do especialista a partir do documento Agent
 * e de um apêndice opcional (fontes de conhecimento).
 */
export function buildSpecialistSystemInstruction(
  row: Record<string, unknown>,
  knowledgeAppendix?: string,
): string {
  const chunks: string[] = [];

  const base = typeof row.systemInstruction === 'string' ? row.systemInstruction.trim() : '';
  if (base) chunks.push(base);

  const goal = typeof row.goal === 'string' ? row.goal.trim() : '';
  if (goal) chunks.push(`## Objective\n${goal}`);

  const responsibilities = Array.isArray(row.responsibilities)
    ? (row.responsibilities as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : [];
  if (responsibilities.length > 0) {
    chunks.push(`## Responsibilities\n${responsibilities.map((r) => `- ${r}`).join('\n')}`);
  }

  const skills = Array.isArray(row.skills)
    ? (row.skills as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : [];
  if (skills.length > 0) {
    chunks.push(`## Skills tags\n${skills.join(', ')}`);
  }

  const sec = row.security as { accessLevel?: string; requiresApproval?: boolean } | undefined;
  if (sec?.accessLevel) {
    chunks.push(`## Data access level\n${sec.accessLevel}`);
  }
  if (sec?.requiresApproval) {
    chunks.push(`## Policy\nCritical actions require human approval before execution when applicable.`);
  }

  const kn = row.knowledge as
    | {
        useSessionMemory?: boolean;
        usePersistentMemory?: boolean;
        fixedContext?: string;
      }
    | undefined;
  if (kn?.fixedContext && typeof kn.fixedContext === 'string' && kn.fixedContext.trim()) {
    chunks.push(`## Fixed context\n${kn.fixedContext.trim()}`);
  }
  if (kn?.useSessionMemory) {
    chunks.push(`## Memory\nMaintain relevant context within this conversation turn.`);
  }
  if (kn?.usePersistentMemory) {
    chunks.push(
      `## Memory\nPersistent memory is enabled in configuration; treat long-term user preferences as hints when relevant (storage backend not implied).`,
    );
  }

  if (knowledgeAppendix?.trim()) {
    chunks.push(knowledgeAppendix.trim());
  }

  return chunks.join('\n\n') || 'You are a helpful specialist agent.';
}
