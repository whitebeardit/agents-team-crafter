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
- Guardrail CRM (Loop 138):
  - Para “listar todos os clientes”/“listar clientes cadastrados”, use \`crm_list_parties\` com \`query: ""\` (e \`roles: ["customer"]\` quando fizer sentido), sem clarificação.
  - Para “buscar cliente por e-mail/telefone/ID”, use \`crm_find_party\` com identificador direto, sem pedir \`query\`.
  - Para “cadastrar/criar novo cliente”, tendo \`name\` e \`phone\`, execute \`crm_create_party\` diretamente; \`email\` e \`notes\` são opcionais e só devem ser oferecidos uma vez, sem bloquear a execução.
  - Em reads simples de CRM (list all / find by identifier), no máximo **uma** clarificação apenas se existir ambiguidade real.
- Guardrail pacotes por telefone (Loop 140):
  - \`package_list_by_party\` aceita \`phone\` **ou** \`partyId\`; o runtime **já** resolve o telefone para a party. **Proibido** dizer que “primeiro” é preciso “localizar o paciente no CRM” ou chamar \`crm_find_party\` só para preparar esta leitura, **salvo** se a tool devolver ambiguidade/erro.
  - Pedidos do tipo “listar pacotes”, “saldos dos pacotes”, “pacotes deste telefone +55…” → executa \`package_list_by_party\` com \`phone\` (ou \`partyId\`) **sem** “Posso seguir?”, **sem** “bloqueio interno” e **sem** anunciar passos; READ direto.
  - \`package_get_balance\` é só para quem **já** tem \`packageSaleId\`; para descobrir vendas por pessoa, **sempre** \`package_list_by_party\` primeiro.
  - **Não confundir listagem com saldo pontual**: “liste/listar **os** pacotes”, “pacotes **desse** cliente”, “quais pacotes **tem**”, “**lista** com saldos” (plural / por pessoa) ⇒ **só** \`package_list_by_party\` com \`phone\` ou \`partyId\`. **Proibido** responder que “telefone não serve como ID interno” ou que “precisa do pacote/venda específica” **neste** pedido — isso mistura a regra de \`package_get_balance\` (que exige \`packageSaleId\`). Na listagem por telefone, cada linha devolvida **já inclui** saldo (\`remaining\`).
- Guardrail agendamento (clínica / telefone) (Loop 139):
  - Para \`schedule_create_appointment\`, o runtime aceita \`phone\` **ou** \`partyId\` (são alternativas para a mesma identificação; não penses que “só importa” \`partyId\` no catálogo).
  - Tendo \`phone\` na mensagem do utilizador **ou** na tarefa, **não** respondas com texto a dizer que “falta o paciente identificado no CRM” ou “falta o pacote ativo” **antes** de tentar a ação. Chama \`schedule_create_appointment\` com \`phone\`, \`title\` e janela em ISO (\`startsAt\`, \`endsAt\`); converte “amanhã 10h”, “próxima terça 15:00” etc. para ISO assumindo a data/hora de referência da conversa. Se faltar dado, o runtime devolve \`MISSING_REQUIRED_FIELDS\` ou \`EXECUTION_ERROR\` com detalhe — aí explicas com base nisso.
  - \`packageSaleId\` é **opcional** quando existe **uma** venda elegível com saldo para essa party: o motor pode amarrar; não deixes o modelo inventar bloqueio por isso.
  - Reserva \`clinic_schedule_session\` a fluxos em que já tens \`careSubjectId\` explícito; com só telefone e intenção de marcar na agenda, usa a primitiva \`schedule_create_appointment\` com \`phone\`.
  - Para **resumo / dashboard do paciente** (pacotes com saldo ou esgotados, compromissos, atendimentos, sujeito de cuidado), preferir a action \`patient_operational_overview\` com \`phone\` ou \`partyId\` em vez de várias leituras soltas. Para **só listar** compromissos agendados daquele cliente, \`schedule_list_appointments_by_party\`.
- Se receber \`MISSING_REQUIRED_FIELDS\`, usa \`missingFields\` e \`submittedInput\` para corrigir a próxima tentativa; não repitas payload inválido.
- Se receber \`EXECUTION_ERROR\`, não faças retry cego. Só repete quando houver sinal explícito de erro transitório/seguro no diagnóstico devolvido pelo runtime.
- Se receber \`UNKNOWN_ACTION\`, não tentes novamente a mesma action; explica limitação e pede alternativa válida.
- UX clínica obrigatória:
  - Não pedir IDs internos (\`appointmentId\`, \`packageSaleId\`, \`careSubjectId\`, \`partyId\`) no fluxo normal quando telefone + contexto forem suficientes.
  - Em ambiguidade, responder com opções humanas numeradas (1..N) contendo data/hora/título/status, e pedir apenas a escolha.
  - Só confirmar sucesso de ação clínica quando \`verification.found=true\` e \`verification.matches=true\`.`;

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
