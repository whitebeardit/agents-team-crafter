const SECOND_BRAIN_POLICY_MARKER = 'COORDINATOR_SECOND_BRAIN_POLICY_V1';

/** Coordinator agents that include this token skip second-brain tools and do not get the recall mandate appended. */
export const COORDINATOR_DISABLE_SECOND_BRAIN_TOOLS_MARKER = '[COORDINATOR_DISABLE_SECOND_BRAIN_TOOLS]';

export const COORDINATOR_SECOND_BRAIN_POLICY_TEXT = `
[${SECOND_BRAIN_POLICY_MARKER}]
## Memória do time (second-brain)
- Antes de delegar para qualquer especialista, chama \`second_brain_recall\` com {topic, intent, agentId?}.
- Se vier \`notes\`, integra no \`instruction\` que mandas ao especialista (campo \`learnings:\`) e cita ao utilizador numa frase curta: "Consultei a memória do time e apliquei N aprendizado(s)."
- Se vier \`reason: no_relevant_memory | timeout | budget_exhausted | disabled\`, segue o fluxo normal e cita ao utilizador: "Sem aprendizados aplicáveis na memória do time."
- Quando o utilizador (a) corrigir comportamento, (b) declarar preferência persistente, (c) der nova regra operacional clara, chama \`second_brain_propose_learning\` com a evidência (trecho citado) e \`kind\` correcto. Não inventes; sem evidência clara, não chames.
- Nunca chames propose para conteúdo volátil (saudações, estado do dia, dados pontuais de uma execução).
- A memória é advisory: se conflitar com Responsibilities ou políticas de tool, prevalecem estas.`;

export function coordinatorSecondBrainToolsDisabled(baseInstruction?: string): boolean {
  return Boolean(baseInstruction?.includes(COORDINATOR_DISABLE_SECOND_BRAIN_TOOLS_MARKER));
}

/** Removes the disable marker from text shown to the model (tools are omitted separately). */
export function stripCoordinatorSecondBrainDisableMarker(instruction: string): string {
  return instruction
    .split(COORDINATOR_DISABLE_SECOND_BRAIN_TOOLS_MARKER)
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Removes the appended second-brain policy block when present (e.g. coordinator had recall enabled before disabling). */
export function stripCoordinatorSecondBrainPolicySection(instruction: string): string {
  const token = '[COORDINATOR_SECOND_BRAIN_POLICY_V1]';
  const idx = instruction.indexOf(token);
  if (idx === -1) return instruction;
  return instruction.slice(0, idx).trimEnd();
}

export function ensureCoordinatorSecondBrainPolicy(baseInstruction?: string): string {
  const base = baseInstruction?.trim() ?? '';
  if (base.includes(COORDINATOR_DISABLE_SECOND_BRAIN_TOOLS_MARKER)) return base;
  if (base.includes(SECOND_BRAIN_POLICY_MARKER)) return base;
  if (!base) return COORDINATOR_SECOND_BRAIN_POLICY_TEXT.trim();
  return `${base}\n\n${COORDINATOR_SECOND_BRAIN_POLICY_TEXT.trim()}`;
}
