/**
 * Metadados PT-BR para ações internas registadas no BusinessToolRegistry.
 * Usado pelo catálogo HTTP, UI de tool definitions e nomes em ensureInternalActionDefinitions.
 */
export type TBusinessActionPreset = {
  title: string;
  description: string;
  /** Alinhado a packs do planner quando aplicável */
  packId?: string;
  /** JSON Schema do corpo esperado pela ação (campos obrigatórios em `required`). */
  inputSchema?: Record<string, unknown>;
  /** Rótulos humanos dos obrigatórios (UI / prompts). */
  requiredFieldLabels?: string[];
  /** Exemplos de payload válido. */
  examples?: Array<Record<string, unknown>>;
  /** Texto curto para o modelo pedir dados em falta de uma vez. */
  slotFillingPromptHint?: string;
};

const PRESETS: Readonly<Record<string, TBusinessActionPreset>> = {
  'business.ping': {
    title: 'Ping de diagnóstico',
    description: 'Ecoa uma mensagem para validar o runtime de ações internas.',
    packId: 'platform',
  },
  'crm_create_party': {
    title: 'CRM — Criar parte',
    description:
      'Cria registo de pessoa/organização (party). Para “cadastrar cliente”, usa roles que incluam `customer` (omissão: só customer).',
    packId: 'crm',
    inputSchema: {
      type: 'object',
      properties: {
        displayName: { type: 'string', description: 'Nome de exibição do cliente' },
        roles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Papéis, ex.: customer, payer',
        },
        email: { type: 'string' },
        phone: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['displayName'],
    },
    requiredFieldLabels: ['Nome (displayName)'],
    examples: [{ displayName: 'Maria Silva', roles: ['customer'], email: 'maria@exemplo.pt' }],
    slotFillingPromptHint:
      'Se faltar o nome, pergunta numa única mensagem: nome, email, telefone e observações opcionais.',
  },
  'crm_update_party': {
    title: 'CRM — Atualizar parte',
    description: 'Atualiza dados de uma party existente.',
    packId: 'crm',
  },
  'crm_find_party': {
    title: 'CRM — Procurar parte',
    description: 'Pesquisa parties por texto no nome.',
    packId: 'crm',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto de busca; use string vazia só se quiseres listagem geral (prefere crm_list_parties).' },
      },
      required: ['query'],
    },
  },
  'crm_get_party_summary': {
    title: 'CRM — Resumo da parte',
    description: 'Obtém resumo agregado de uma party.',
    packId: 'crm',
  },
  'crm_list_parties_by_role': {
    title: 'CRM — Listar por papel',
    description: 'Lista parties filtradas por um único papel.',
    packId: 'crm',
    inputSchema: {
      type: 'object',
      properties: {
        role: { type: 'string', description: 'Papel, ex.: customer' },
      },
      required: ['role'],
    },
  },
  'crm_list_parties': {
    title: 'CRM — Listar parties',
    description:
      'Lista parties com filtros opcionais: texto, papéis, estado ativo/inativo. Use query vazia para “todos os clientes cadastrados”; status active + roles customer para “clientes ativos”.',
    packId: 'crm',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Filtro por nome; string vazia lista sem filtro de texto.',
        },
        roles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filtrar por papéis (ex.: ["customer"]).',
        },
        status: { type: 'string', enum: ['active', 'inactive'], description: 'Estado da party no CRM.' },
        limit: { type: 'number', description: 'Máximo de registos (cap no servidor).' },
      },
      required: ['query'],
    },
    slotFillingPromptHint:
      'Não é necessário pedir IDs ao utilizador para listar; usa query \"\" e roles/status conforme o pedido.',
  },
  'care_create_subject': {
    title: 'Care — Criar sujeito de cuidado',
    description: 'Cria sujeito de cuidado (paciente/cliente de cuidado).',
    packId: 'care',
  },
  'care_update_subject': {
    title: 'Care — Atualizar sujeito',
    description: 'Atualiza dados do sujeito de cuidado.',
    packId: 'care',
  },
  'care_find_subject': {
    title: 'Care — Procurar sujeito',
    description: 'Pesquisa sujeitos de cuidado.',
    packId: 'care',
  },
  'care_get_subject_summary': {
    title: 'Care — Resumo do sujeito',
    description: 'Obtém resumo do sujeito de cuidado.',
    packId: 'care',
  },
  'service_catalog_create_item': {
    title: 'Serviços — Criar item no catálogo',
    description: 'Adiciona item ao catálogo de serviços.',
    packId: 'services_sales',
  },
  'service_catalog_list_items': {
    title: 'Serviços — Listar catálogo',
    description: 'Lista itens do catálogo de serviços.',
    packId: 'services_sales',
  },
  'sales_create_service_order': {
    title: 'Vendas — Criar pedido de serviço',
    description: 'Cria ordem de serviço.',
    packId: 'services_sales',
  },
  'sales_add_service_item': {
    title: 'Vendas — Adicionar linha ao pedido',
    description: 'Adiciona linha a um pedido de serviço existente.',
    packId: 'services_sales',
  },
  'sales_mark_order_paid': {
    title: 'Vendas — Marcar pedido pago',
    description: 'Marca ordem de serviço como paga.',
    packId: 'services_sales',
  },
  'sales_get_customer_purchase_history': {
    title: 'Vendas — Histórico de compras',
    description: 'Histórico de compras por cliente.',
    packId: 'services_sales',
  },
  'sales_top_services': {
    title: 'Vendas — Serviços mais vendidos',
    description: 'Ranking de serviços por volume.',
    packId: 'services_sales',
  },
  'sales_total_paid_by_service': {
    title: 'Vendas — Total pago por serviço',
    description: 'Agregação de valores pagos por tipo de serviço.',
    packId: 'services_sales',
  },
  'package_sell_to_party': {
    title: 'Pacotes — Vender pacote à parte',
    description: 'Regista venda de pacote a uma party.',
    packId: 'packages_encounters',
  },
  'package_get_balance': {
    title: 'Pacotes — Saldo do pacote',
    description: 'Consulta saldo/sessões restantes do pacote.',
    packId: 'packages_encounters',
  },
  'attendance_register_session': {
    title: 'Atendimentos — Registar sessão',
    description: 'Regista uma sessão de atendimento.',
    packId: 'packages_encounters',
  },
  'attendance_list_by_party': {
    title: 'Atendimentos — Listar por parte',
    description: 'Lista atendimentos associados à party.',
    packId: 'packages_encounters',
  },
  'attendance_list_by_package_sale': {
    title: 'Atendimentos — Listar por venda de pacote',
    description: 'Lista sessões ligadas à venda do pacote.',
    packId: 'packages_encounters',
  },
  'attendance_get_party_care_summary': {
    title: 'Atendimentos — Resumo de cuidado',
    description: 'Resumo de cuidados/atendimentos da party.',
    packId: 'packages_encounters',
  },
  'clinical_create_anamnesis': {
    title: 'Clínico — Criar anamnese',
    description: 'Cria registo de anamnese para o sujeito de cuidado.',
    packId: 'clinical',
  },
  'clinical_add_evolution_note': {
    title: 'Clínico — Adicionar nota de evolução',
    description: 'Adiciona nota de evolução clínica.',
    packId: 'clinical',
  },
  'clinical_list_subject_history': {
    title: 'Clínico — Histórico do sujeito',
    description: 'Lista anamneses e evoluções do sujeito.',
    packId: 'clinical',
  },
  'clinical_get_latest_evolution': {
    title: 'Clínico — Última evolução',
    description: 'Obtém a evolução mais recente.',
    packId: 'clinical',
  },
  'clinical_open_encounter': {
    title: 'Clínico — Abrir encontro',
    description: 'Abre encontro clínico.',
    packId: 'clinical',
  },
  'clinical_close_encounter': {
    title: 'Clínico — Fechar encontro',
    description: 'Fecha encontro clínico.',
    packId: 'clinical',
  },
  'finance_create_receivable': {
    title: 'Financeiro — Criar conta a receber',
    description: 'Regista título a receber.',
    packId: 'finance',
  },
  'finance_create_payable': {
    title: 'Financeiro — Criar conta a pagar',
    description: 'Regista título a pagar.',
    packId: 'finance',
  },
  'finance_mark_receivable_paid': {
    title: 'Financeiro — Marcar recebível pago',
    description: 'Marca conta a receber como liquidada.',
    packId: 'finance',
  },
  'finance_mark_payable_paid': {
    title: 'Financeiro — Marcar pagável pago',
    description: 'Marca conta a pagar como liquidada.',
    packId: 'finance',
  },
  'finance_list_overdue_receivables': {
    title: 'Financeiro — Recebíveis em atraso',
    description: 'Lista contas a receber vencidas.',
    packId: 'finance',
  },
  'finance_list_overdue_payables': {
    title: 'Financeiro — Pagáveis em atraso',
    description: 'Lista contas a pagar vencidas.',
    packId: 'finance',
  },
  'finance_total_receivable_by_payer': {
    title: 'Financeiro — Total a receber por pagador',
    description: 'Agregação de valores a receber por pagador.',
    packId: 'finance',
  },
  'finance_total_payable_by_destination': {
    title: 'Financeiro — Total a pagar por destino',
    description: 'Agregação de valores a pagar por destino.',
    packId: 'finance',
  },
  'finance_customer_financial_summary': {
    title: 'Financeiro — Resumo financeiro do cliente',
    description: 'Resumo financeiro consolidado por cliente/party.',
    packId: 'finance',
  },
  'schedule_create_reminder': {
    title: 'Lembretes — Criar lembrete',
    description: 'Cria lembrete com data/hora.',
    packId: 'reminders',
  },
  'schedule_list_reminders_by_date': {
    title: 'Lembretes — Listar por dia',
    description: 'Lista lembretes num dia (UTC).',
    packId: 'reminders',
  },
  'schedule_mark_reminder_done': {
    title: 'Lembretes — Marcar concluído',
    description: 'Marca lembrete como feito.',
    packId: 'reminders',
  },
  'schedule_cancel_reminder': {
    title: 'Lembretes — Cancelar',
    description: 'Cancela um lembrete.',
    packId: 'reminders',
  },
  'github_read_pr': {
    title: 'GitHub — Ler PR',
    description: 'Lê detalhes de pull request (integração GitHub).',
    packId: 'github_ops',
  },
  'github_read_diff': {
    title: 'GitHub — Ler diff',
    description: 'Obtém diff de ficheiros do PR.',
    packId: 'github_ops',
  },
  'github_comment_pr': {
    title: 'GitHub — Comentar PR',
    description: 'Adiciona comentário ao PR.',
    packId: 'github_ops',
  },
  'github_list_changed_files': {
    title: 'GitHub — Ficheiros alterados',
    description: 'Lista ficheiros alterados no PR.',
    packId: 'github_ops',
  },
  'github_get_issue': {
    title: 'GitHub — Ler issue',
    description: 'Obtém detalhes de issue.',
    packId: 'github_ops',
  },
  'schedule_set_availability': {
    title: 'Agenda — Definir disponibilidade',
    description: 'Define janelas de disponibilidade para agendamento.',
    packId: 'scheduling',
  },
  'schedule_create_appointment': {
    title: 'Agenda — Criar compromisso',
    description: 'Cria compromisso na agenda.',
    packId: 'scheduling',
  },
  'schedule_reschedule_appointment': {
    title: 'Agenda — Reagendar',
    description: 'Altera data/hora de compromisso.',
    packId: 'scheduling',
  },
  'schedule_cancel_appointment': {
    title: 'Agenda — Cancelar compromisso',
    description: 'Cancela compromisso (soft).',
    packId: 'scheduling',
  },
  'schedule_delete_appointment': {
    title: 'Agenda — Remover compromisso',
    description: 'Remove compromisso da base (admin).',
    packId: 'scheduling',
  },
  'schedule_confirm_appointment': {
    title: 'Agenda — Confirmar compromisso',
    description: 'Marca compromisso como confirmado.',
    packId: 'scheduling',
  },
  'schedule_mark_no_show': {
    title: 'Agenda — Marcar falta',
    description: 'Regista não comparência.',
    packId: 'scheduling',
  },
  'schedule_complete_appointment': {
    title: 'Agenda — Concluir compromisso',
    description: 'Marca compromisso como realizado.',
    packId: 'scheduling',
  },
  'schedule_list_agenda_by_date': {
    title: 'Agenda — Listar por dia',
    description: 'Lista compromissos num dia.',
    packId: 'scheduling',
  },
  'schedule_get_availability': {
    title: 'Agenda — Consultar disponibilidade',
    description: 'Obtém slots disponíveis para agendar.',
    packId: 'scheduling',
  },
};

export function getBusinessActionPreset(actionId: string): TBusinessActionPreset | undefined {
  return PRESETS[actionId.trim()];
}
