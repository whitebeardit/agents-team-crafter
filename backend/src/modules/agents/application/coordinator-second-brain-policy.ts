const SECOND_BRAIN_POLICY_MARKER = 'COORDINATOR_SECOND_BRAIN_POLICY_V1';

export const COORDINATOR_SECOND_BRAIN_POLICY_TEXT = `
[${SECOND_BRAIN_POLICY_MARKER}]
## Memória do time (second-brain)
- Antes de delegar para qualquer especialista, chama \`second_brain_recall\` com {topic, intent, agentId?}.
- Se vier \`notes\`, integra no \`instruction\` que mandas ao especialista (campo \`learnings:\`) e cita ao utilizador numa frase curta: "Consultei a memória do time e apliquei N aprendizado(s)."
- Se vier \`reason: no_relevant_memory | timeout | budget_exhausted | disabled\`, segue o fluxo normal e cita ao utilizador: "Sem aprendizados aplicáveis na memória do time."
- Quando o utilizador (a) corrigir comportamento, (b) declarar preferência persistente, (c) der nova regra operacional clara, chama \`second_brain_propose_learning\` com a evidência (trecho citado) e \`kind\` correcto. Não inventes; sem evidência clara, não chames.
- Nunca chames propose para conteúdo volátil (saudações, estado do dia, dados pontuais de uma execução).
- A memória é advisory: se conflitar com Responsibilities ou políticas de tool, prevalecem estas.`;

export function ensureCoordinatorSecondBrainPolicy(baseInstruction?: string): string {
  const base = baseInstruction?.trim() ?? '';
  if (base.includes(SECOND_BRAIN_POLICY_MARKER)) return base;
  if (!base) return COORDINATOR_SECOND_BRAIN_POLICY_TEXT.trim();
  return `${base}\n\n${COORDINATOR_SECOND_BRAIN_POLICY_TEXT.trim()}`;
}
