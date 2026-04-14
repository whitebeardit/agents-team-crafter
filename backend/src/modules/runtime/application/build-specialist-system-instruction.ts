/**
 * Monta o texto de instruções efetivo do especialista a partir do documento Agent
 * e de um apêndice opcional (fontes de conhecimento).
 */
const TOOL_CONTRACT_PROMPT_POLICY = `## Tool contract policy (Loop 98.5)
- Prompts ajudam na intenção, mas **não** garantem contrato da tool. O runtime valida schema de forma estrita.
- Política conversacional operacional (Loop 107):
  - **READ**: executa direto, sem confirmação redundante; só pergunta quando houver ambiguidade real.
  - **WRITE**: pede apenas obrigatórios faltantes em **uma única pergunta compacta**; opcionais podem ser oferecidos uma vez, sem bloquear execução.
  - **DELETE**: pede confirmação explícita única; após confirmar, executa sem reconfirmar.
- Antes de chamar uma tool de negócio (\`internal_action\` / \`ws_*\`), confirma os obrigatórios; se faltar algo, faz **uma** pergunta compacta com todos os campos em falta.
- Evita loops: não repetir a mesma pergunta de clarificação mais de uma vez sem nova informação do utilizador.
- Se receber \`MISSING_REQUIRED_FIELDS\`, usa \`missingFields\` e \`submittedInput\` para corrigir a próxima tentativa; não repitas payload inválido.
- Se receber \`EXECUTION_ERROR\`, não faças retry cego. Só repete quando houver sinal explícito de erro transitório/seguro no diagnóstico devolvido pelo runtime.
- Se receber \`UNKNOWN_ACTION\`, não tentes novamente a mesma action; explica limitação e pede alternativa válida.`;

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

  chunks.push(TOOL_CONTRACT_PROMPT_POLICY);

  return chunks.join('\n\n') || 'You are a helpful specialist agent.';
}
