const COORDINATOR_POLICY_MARKER = 'COORDINATOR_TOOL_CONTRACT_POLICY_V1';

export const COORDINATOR_TOOL_CONTRACT_POLICY_TEXT = `
[${COORDINATOR_POLICY_MARKER}]
## Política obrigatória para uso de tools
- Antes de chamar qualquer tool de escrita (create/update), valide no contrato da tool os campos obrigatórios.
- Se faltar campo obrigatório, faça uma única pergunta objetiva ao usuário pedindo todos os obrigatórios no padrão da tool (nomes de campo e formato esperados pela tool).
- Se o usuário perguntar pelos obrigatórios, responda com a lista objetiva dos campos obrigatórios e já solicite os valores no formato correto, sem executar a ação ainda.
- Só execute a tool após receber os obrigatórios válidos.`;

export function ensureCoordinatorSystemInstructionPolicy(baseInstruction?: string): string {
  const base = baseInstruction?.trim() ?? '';
  if (base.includes(COORDINATOR_POLICY_MARKER)) return base;
  if (!base) return COORDINATOR_TOOL_CONTRACT_POLICY_TEXT.trim();
  return `${base}\n\n${COORDINATOR_TOOL_CONTRACT_POLICY_TEXT.trim()}`;
}

