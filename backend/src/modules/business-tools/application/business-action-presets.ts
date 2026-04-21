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
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Mensagem de teste para eco (opcional).' },
      },
    },
    examples: [{ message: 'ping do workspace' }],
  },
  platform_status_overview: {
    title: 'Platform/Admin — Status operacional',
    description: 'Retorna visão rápida do estado operacional da camada platform/admin.',
    packId: 'platform',
    inputSchema: {
      type: 'object',
      properties: {
        includeTimestamp: {
          type: 'boolean',
          description: 'Quando true, inclui timestamp ISO da resposta.',
        },
      },
    },
    examples: [{ includeTimestamp: true }],
  },
  'crm_create_party': {
    title: 'CRM — Criar parte',
    description:
      'Cria registo de pessoa/organização (party). Para “cadastrar cliente”, aceite linguagem natural de nome (name/nome/nome completo/fullName); roles incluem `customer` por omissão.',
    packId: 'crm',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome do cliente em linguagem natural.' },
        displayName: {
          type: 'string',
          description: 'Alias interno de compatibilidade para name (não usar como jargão com utilizador).',
        },
        roles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Papéis, ex.: customer, payer',
        },
        email: { type: 'string' },
        phone: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['name', 'phone'],
    },
    requiredFieldLabels: ['Nome do cliente', 'Celular (phone)'],
    examples: [{ name: 'Maria Silva', roles: ['customer'], email: 'maria@exemplo.pt' }],
    slotFillingPromptHint:
      'Se faltar algum obrigatório, peça numa única mensagem compacta no padrão da tool: name (nome) e phone (celular). Em seguida pode oferecer email e notes como opcionais.',
  },
  'crm_update_party': {
    title: 'CRM — Atualizar parte',
    description: 'Atualiza dados de uma party existente.',
    packId: 'crm',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party a ser atualizada.' },
        displayName: { type: 'string', description: 'Nome atualizado da party.' },
        roles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Papéis atualizados, ex.: customer, payer.',
        },
        status: { type: 'string', enum: ['active', 'inactive'], description: 'Estado da party no CRM.' },
        email: { type: 'string', description: 'Email (string vazia limpa o campo).' },
        phone: { type: 'string', description: 'Telefone (string vazia limpa o campo).' },
        notes: { type: 'string', description: 'Observações (string vazia limpa o campo).' },
      },
      required: ['partyId'],
    },
    requiredFieldLabels: ['ID da parte (partyId)'],
    slotFillingPromptHint:
      'Se faltar partyId, peça primeiro o identificador da party e os campos que devem ser alterados.',
  },
  'crm_find_party': {
    title: 'CRM — Procurar parte',
    description:
      'Pesquisa parties por ID, email, telefone ou texto no nome. Para listagem ampla, prefira crm_list_parties.',
    packId: 'crm',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party quando já conhecido.' },
        email: { type: 'string', description: 'Email exato da party.' },
        phone: { type: 'string', description: 'Telefone exato da party.' },
        query: {
          type: 'string',
          description: 'Texto de busca por nome; use quando não houver ID/email/telefone.',
        },
      },
    },
    slotFillingPromptHint:
      'Se houver email/telefone/partyId, execute direto sem pedir query. Para busca textual por nome, use query. Evite mais de uma clarificação.',
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
    },
    slotFillingPromptHint:
      'Para “listar todos os clientes cadastrados”, execute direto com query \"\" e roles [\"customer\"] quando aplicável; não pedir query nem IDs.',
  },
  'care_create_subject': {
    title: 'Care — Criar sujeito de cuidado',
    description: 'Cria sujeito de cuidado (paciente/cliente de cuidado).',
    packId: 'care',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party dona do sujeito.' },
        name: { type: 'string', description: 'Nome do sujeito de cuidado.' },
        subjectKind: {
          type: 'string',
          enum: ['human', 'animal', 'psych'],
          description: 'Tipo do sujeito de cuidado.',
        },
        notes: { type: 'string', description: 'Notas opcionais.' },
      },
      required: ['partyId', 'name', 'subjectKind'],
    },
    requiredFieldLabels: ['Party (partyId)', 'Nome (name)', 'Tipo (subjectKind)'],
    slotFillingPromptHint:
      'Se faltar obrigatório, peça numa mensagem única: party, nome e tipo (human/animal/psych).',
  },
  'care_create_patient': {
    title: 'Care — Cadastrar paciente (psych)',
    description:
      'Cria o paciente completo da vertical psicológica: Party no CRM + CareSubject com subjectKind=psych vinculado ao partyId.',
    packId: 'care',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome da paciente.' },
        email: { type: 'string', description: 'Email opcional para o cadastro de Party.' },
        phone: { type: 'string', description: 'Telefone opcional para o cadastro de Party.' },
        notes: { type: 'string', description: 'Observações opcionais aplicadas em Party e Subject.' },
        roles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Papéis adicionais da Party (omissão: customer + patient).',
        },
      },
      required: ['name'],
    },
    requiredFieldLabels: ['Nome (name)'],
    slotFillingPromptHint:
      'Para cadastro de paciente psych, peça numa única mensagem os faltantes: nome (obrigatório), email, telefone e observações.',
  },
  'care_update_subject': {
    title: 'Care — Atualizar sujeito',
    description: 'Atualiza dados do sujeito de cuidado.',
    packId: 'care',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: { type: 'string', description: 'ID do sujeito.' },
        name: { type: 'string', description: 'Nome atualizado.' },
        subjectKind: { type: 'string', enum: ['human', 'animal', 'psych'] },
        notes: { type: 'string' },
      },
      required: ['subjectId'],
    },
    requiredFieldLabels: ['Sujeito (subjectId)'],
  },
  'care_find_subject': {
    title: 'Care — Procurar sujeito',
    description: 'Pesquisa sujeitos de cuidado.',
    packId: 'care',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: { type: 'string', description: 'ID do sujeito para consulta.' },
      },
      required: ['subjectId'],
    },
    requiredFieldLabels: ['Sujeito (subjectId)'],
  },
  'care_get_subject_summary': {
    title: 'Care — Resumo do sujeito',
    description: 'Obtém resumo do sujeito de cuidado.',
    packId: 'care',
    inputSchema: {
      type: 'object',
      properties: {
        subjectId: { type: 'string', description: 'ID do sujeito para sumarização.' },
      },
      required: ['subjectId'],
    },
    requiredFieldLabels: ['Sujeito (subjectId)'],
  },
  'care_gold_gate': {
    title: 'Care — Gate GOLD operacional',
    description: 'Avalia critérios mínimos operacionais para aceite GOLD da vertical Care.',
    packId: 'care',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  'service_catalog_create_item': {
    title: 'Serviços — Criar item no catálogo',
    description: 'Adiciona item ao catálogo de serviços.',
    packId: 'services_sales',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome do serviço.' },
        unitPrice: { type: 'number', description: 'Preço unitário do serviço.' },
        currency: { type: 'string', description: 'Moeda do serviço (ex.: BRL).' },
      },
      required: ['name', 'unitPrice'],
    },
    requiredFieldLabels: ['Serviço (name)', 'Preço unitário (unitPrice)'],
  },
  'service_catalog_list_items': {
    title: 'Serviços — Listar catálogo',
    description: 'Lista itens do catálogo de serviços.',
    packId: 'services_sales',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  'sales_create_service_order': {
    title: 'Vendas — Criar pedido de serviço',
    description: 'Cria ordem de serviço.',
    packId: 'services_sales',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party compradora.' },
        lines: {
          type: 'array',
          description: 'Linhas do pedido (catalogItemId, quantity, unitPrice).',
        },
      },
      required: ['partyId', 'lines'],
    },
    requiredFieldLabels: ['Party (partyId)', 'Itens (lines)'],
  },
  'sales_add_service_item': {
    title: 'Vendas — Adicionar linha ao pedido',
    description: 'Adiciona linha a um pedido de serviço existente.',
    packId: 'services_sales',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'ID do pedido.' },
        line: { type: 'object', description: 'Linha (catalogItemId, quantity, unitPrice).' },
      },
      required: ['orderId', 'line'],
    },
    requiredFieldLabels: ['Pedido (orderId)', 'Linha (line)'],
  },
  'sales_mark_order_paid': {
    title: 'Vendas — Marcar pedido pago',
    description: 'Marca ordem de serviço como paga.',
    packId: 'services_sales',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'ID do pedido.' },
      },
      required: ['orderId'],
    },
    requiredFieldLabels: ['Pedido (orderId)'],
  },
  'sales_get_customer_purchase_history': {
    title: 'Vendas — Histórico de compras',
    description: 'Histórico de compras por cliente.',
    packId: 'services_sales',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party cliente.' },
      },
      required: ['partyId'],
    },
    requiredFieldLabels: ['Cliente (partyId)'],
  },
  'sales_top_services': {
    title: 'Vendas — Serviços mais vendidos',
    description: 'Ranking de serviços por volume.',
    packId: 'services_sales',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  'sales_total_paid_by_service': {
    title: 'Vendas — Total pago por serviço',
    description: 'Agregação de valores pagos por tipo de serviço.',
    packId: 'services_sales',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  'sales_gold_gate': {
    title: 'Vendas — Gate GOLD operacional',
    description: 'Avalia critérios mínimos operacionais para aceite GOLD de Services & Sales.',
    packId: 'services_sales',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  'package_sell_to_party': {
    title: 'Pacotes — Vender pacote à parte',
    description: 'Regista venda de pacote a uma party.',
    packId: 'packages_encounters',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party compradora.' },
        packageName: { type: 'string', description: 'Nome comercial do pacote.' },
        unitsTotal: { type: 'number', description: 'Quantidade total de unidades/sessões.' },
      },
      required: ['partyId', 'packageName', 'unitsTotal'],
    },
    requiredFieldLabels: ['Party (partyId)', 'Pacote (packageName)', 'Unidades (unitsTotal)'],
  },
  'package_get_balance': {
    title: 'Pacotes — Saldo do pacote',
    description: 'Consulta saldo/sessões restantes do pacote.',
    packId: 'packages_encounters',
    inputSchema: {
      type: 'object',
      properties: {
        packageSaleId: { type: 'string', description: 'ID da venda de pacote.' },
      },
      required: ['packageSaleId'],
    },
    requiredFieldLabels: ['Pacote vendido (packageSaleId)'],
  },
  'attendance_register_session': {
    title: 'Atendimentos — Registar sessão',
    description: 'Regista uma sessão de atendimento.',
    packId: 'packages_encounters',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party atendida.' },
        packageSaleId: { type: 'string', description: 'ID opcional do pacote consumido.' },
        notes: { type: 'string', description: 'Notas da sessão.' },
        durationMinutes: { type: 'number', description: 'Duração da sessão em minutos.' },
      },
      required: ['partyId'],
    },
    requiredFieldLabels: ['Party (partyId)'],
  },
  'attendance_list_by_party': {
    title: 'Atendimentos — Listar por parte',
    description: 'Lista atendimentos associados à party.',
    packId: 'packages_encounters',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party.' },
      },
      required: ['partyId'],
    },
    requiredFieldLabels: ['Party (partyId)'],
  },
  'attendance_list_by_package_sale': {
    title: 'Atendimentos — Listar por venda de pacote',
    description: 'Lista sessões ligadas à venda do pacote.',
    packId: 'packages_encounters',
    inputSchema: {
      type: 'object',
      properties: {
        packageSaleId: { type: 'string', description: 'ID da venda do pacote.' },
      },
      required: ['packageSaleId'],
    },
    requiredFieldLabels: ['Pacote vendido (packageSaleId)'],
  },
  'attendance_get_party_care_summary': {
    title: 'Atendimentos — Resumo de cuidado',
    description: 'Resumo de cuidados/atendimentos da party.',
    packId: 'packages_encounters',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party para sumarização.' },
      },
      required: ['partyId'],
    },
    requiredFieldLabels: ['Party (partyId)'],
  },
  'packages_encounters_gold_gate': {
    title: 'Pacotes/Atendimentos — Gate GOLD operacional',
    description: 'Avalia critérios mínimos operacionais para aceite GOLD de Packages & Encounters.',
    packId: 'packages_encounters',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  'clinical_create_anamnesis': {
    title: 'Clínico — Criar anamnese',
    description: 'Cria registo de anamnese para o sujeito de cuidado.',
    packId: 'clinical',
    inputSchema: {
      type: 'object',
      properties: {
        careSubjectId: { type: 'string', description: 'ID do sujeito de cuidado.' },
        template: { type: 'string', description: 'Template opcional de anamnese.' },
        content: {
          type: 'object',
          description: 'Conteúdo estruturado opcional da anamnese.',
          properties: {
            chiefComplaint: { type: 'string', description: 'Queixa principal.' },
            history: { type: 'string', description: 'Histórico relevante.' },
            assessment: { type: 'string', description: 'Avaliação clínica.' },
            plan: { type: 'string', description: 'Plano terapêutico.' },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Etiquetas clínicas opcionais.',
            },
          },
        },
      },
      required: ['careSubjectId'],
    },
    requiredFieldLabels: ['Sujeito (careSubjectId)'],
    slotFillingPromptHint:
      'Se faltar o sujeito, peça primeiro o careSubjectId; o conteúdo estruturado pode vir em campos clínicos curtos.',
  },
  'clinical_add_evolution_note': {
    title: 'Clínico — Adicionar nota de evolução',
    description: 'Adiciona nota de evolução clínica.',
    packId: 'clinical',
    inputSchema: {
      type: 'object',
      properties: {
        careSubjectId: { type: 'string', description: 'ID do sujeito de cuidado.' },
        body: { type: 'string', description: 'Texto da nota de evolução.' },
      },
      required: ['careSubjectId', 'body'],
    },
    requiredFieldLabels: ['Sujeito (careSubjectId)', 'Nota (body)'],
  },
  'clinical_list_subject_history': {
    title: 'Clínico — Histórico do sujeito',
    description: 'Lista anamneses e evoluções do sujeito.',
    packId: 'clinical',
    inputSchema: {
      type: 'object',
      properties: {
        careSubjectId: { type: 'string', description: 'ID do sujeito de cuidado.' },
      },
      required: ['careSubjectId'],
    },
    requiredFieldLabels: ['Sujeito (careSubjectId)'],
  },
  'clinical_get_latest_evolution': {
    title: 'Clínico — Última evolução',
    description: 'Obtém a evolução mais recente.',
    packId: 'clinical',
    inputSchema: {
      type: 'object',
      properties: {
        careSubjectId: { type: 'string', description: 'ID do sujeito de cuidado.' },
      },
      required: ['careSubjectId'],
    },
    requiredFieldLabels: ['Sujeito (careSubjectId)'],
  },
  'clinical_open_encounter': {
    title: 'Clínico — Abrir encontro',
    description: 'Abre encontro clínico.',
    packId: 'clinical',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party responsável.' },
        careSubjectId: { type: 'string', description: 'ID do sujeito de cuidado.' },
        notes: { type: 'string', description: 'Notas clínicas opcionais.' },
      },
      required: ['partyId', 'careSubjectId'],
    },
    requiredFieldLabels: ['Party (partyId)', 'Sujeito (careSubjectId)'],
  },
  'clinical_close_encounter': {
    title: 'Clínico — Fechar encontro',
    description: 'Fecha encontro clínico.',
    packId: 'clinical',
    inputSchema: {
      type: 'object',
      properties: {
        encounterId: { type: 'string', description: 'ID do encontro clínico.' },
      },
      required: ['encounterId'],
    },
    requiredFieldLabels: ['Encontro (encounterId)'],
  },
  'clinical_gold_gate': {
    title: 'Clínico — Gate GOLD operacional',
    description: 'Avalia critérios mínimos operacionais para aceite GOLD da vertical clínica.',
    packId: 'clinical',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  'finance_create_receivable': {
    title: 'Financeiro — Criar conta a receber',
    description: 'Regista título a receber.',
    packId: 'finance',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party pagadora.' },
        amount: { type: 'number', description: 'Valor do título.' },
        dueDate: { type: 'string', description: 'Data de vencimento (ISO YYYY-MM-DD).' },
        description: { type: 'string', description: 'Descrição opcional.' },
        currency: { type: 'string', description: 'Moeda (ex.: BRL, EUR).' },
      },
      required: ['partyId', 'amount', 'dueDate'],
    },
    requiredFieldLabels: ['Pagador (partyId)', 'Valor (amount)', 'Vencimento (dueDate)'],
    slotFillingPromptHint:
      'Se faltar algum obrigatório, peça numa única mensagem: pagador, valor e data de vencimento.',
  },
  'finance_create_payable': {
    title: 'Financeiro — Criar conta a pagar',
    description: 'Regista título a pagar.',
    packId: 'finance',
    inputSchema: {
      type: 'object',
      properties: {
        destinationPartyId: { type: 'string', description: 'ID da party destinatária.' },
        amount: { type: 'number', description: 'Valor do título.' },
        dueDate: { type: 'string', description: 'Data de vencimento (ISO YYYY-MM-DD).' },
        description: { type: 'string', description: 'Descrição opcional.' },
        currency: { type: 'string', description: 'Moeda (ex.: BRL, EUR).' },
      },
      required: ['destinationPartyId', 'amount', 'dueDate'],
    },
    requiredFieldLabels: ['Destinatário (destinationPartyId)', 'Valor (amount)', 'Vencimento (dueDate)'],
    slotFillingPromptHint:
      'Se faltar algum obrigatório, peça numa única mensagem: destinatário, valor e data de vencimento.',
  },
  'finance_mark_receivable_paid': {
    title: 'Financeiro — Marcar recebível pago',
    description: 'Marca conta a receber como liquidada.',
    packId: 'finance',
    inputSchema: {
      type: 'object',
      properties: {
        receivableId: { type: 'string', description: 'ID do recebível a liquidar.' },
      },
      required: ['receivableId'],
    },
    requiredFieldLabels: ['Recebível (receivableId)'],
  },
  'finance_mark_payable_paid': {
    title: 'Financeiro — Marcar pagável pago',
    description: 'Marca conta a pagar como liquidada.',
    packId: 'finance',
    inputSchema: {
      type: 'object',
      properties: {
        payableId: { type: 'string', description: 'ID do pagável a liquidar.' },
      },
      required: ['payableId'],
    },
    requiredFieldLabels: ['Pagável (payableId)'],
  },
  'finance_list_overdue_receivables': {
    title: 'Financeiro — Recebíveis em atraso',
    description: 'Lista contas a receber vencidas.',
    packId: 'finance',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  'finance_list_overdue_payables': {
    title: 'Financeiro — Pagáveis em atraso',
    description: 'Lista contas a pagar vencidas.',
    packId: 'finance',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  'finance_total_receivable_by_payer': {
    title: 'Financeiro — Total a receber por pagador',
    description: 'Agregação de valores a receber por pagador.',
    packId: 'finance',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  'finance_total_payable_by_destination': {
    title: 'Financeiro — Total a pagar por destino',
    description: 'Agregação de valores a pagar por destino.',
    packId: 'finance',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  'finance_customer_financial_summary': {
    title: 'Financeiro — Resumo financeiro do cliente',
    description: 'Resumo financeiro consolidado por cliente/party.',
    packId: 'finance',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party para sumarização.' },
      },
      required: ['partyId'],
    },
    requiredFieldLabels: ['Cliente (partyId)'],
  },
  'finance_gold_gate': {
    title: 'Financeiro — Gate GOLD operacional',
    description: 'Avalia critérios mínimos operacionais para aceite GOLD da vertical financeira.',
    packId: 'finance',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  'schedule_create_reminder': {
    title: 'Lembretes — Criar lembrete',
    description: 'Cria lembrete com data/hora.',
    packId: 'reminders',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título curto do lembrete.' },
        at: { type: 'string', description: 'Data/hora ISO do lembrete.' },
      },
      required: ['title', 'at'],
    },
    requiredFieldLabels: ['Título (title)', 'Data/hora (at)'],
  },
  'schedule_list_reminders_by_date': {
    title: 'Lembretes — Listar por dia',
    description: 'Lista lembretes num dia (UTC).',
    packId: 'reminders',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Dia ISO (YYYY-MM-DD).' },
      },
      required: ['date'],
    },
    requiredFieldLabels: ['Dia (date)'],
  },
  'schedule_mark_reminder_done': {
    title: 'Lembretes — Marcar concluído',
    description: 'Marca lembrete como feito.',
    packId: 'reminders',
    inputSchema: {
      type: 'object',
      properties: {
        reminderId: { type: 'string', description: 'ID do lembrete.' },
      },
      required: ['reminderId'],
    },
    requiredFieldLabels: ['Lembrete (reminderId)'],
  },
  'schedule_cancel_reminder': {
    title: 'Lembretes — Cancelar',
    description: 'Cancela um lembrete.',
    packId: 'reminders',
    inputSchema: {
      type: 'object',
      properties: {
        reminderId: { type: 'string', description: 'ID do lembrete.' },
      },
      required: ['reminderId'],
    },
    requiredFieldLabels: ['Lembrete (reminderId)'],
  },
  'reminders_gold_gate': {
    title: 'Lembretes — Gate GOLD operacional',
    description: 'Avalia critérios mínimos operacionais para aceite GOLD da vertical de lembretes.',
    packId: 'reminders',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  'github_read_pr': {
    title: 'GitHub — Ler PR',
    description: 'Lê detalhes de pull request (integração GitHub).',
    packId: 'github_ops',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Owner da organização/repositório.' },
        repo: { type: 'string', description: 'Nome do repositório.' },
        pullNumber: { type: 'number', description: 'Número do pull request.' },
      },
      required: ['owner', 'repo', 'pullNumber'],
    },
    requiredFieldLabels: ['Owner (owner)', 'Repo (repo)', 'PR (pullNumber)'],
  },
  'github_read_diff': {
    title: 'GitHub — Ler diff',
    description: 'Obtém diff de ficheiros do PR.',
    packId: 'github_ops',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Owner da organização/repositório.' },
        repo: { type: 'string', description: 'Nome do repositório.' },
        pullNumber: { type: 'number', description: 'Número do pull request.' },
      },
      required: ['owner', 'repo', 'pullNumber'],
    },
    requiredFieldLabels: ['Owner (owner)', 'Repo (repo)', 'PR (pullNumber)'],
  },
  'github_comment_pr': {
    title: 'GitHub — Comentar PR',
    description: 'Adiciona comentário ao PR.',
    packId: 'github_ops',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Owner da organização/repositório.' },
        repo: { type: 'string', description: 'Nome do repositório.' },
        pullNumber: { type: 'number', description: 'Número do pull request.' },
        body: { type: 'string', description: 'Comentário a publicar no PR.' },
      },
      required: ['owner', 'repo', 'pullNumber', 'body'],
    },
    requiredFieldLabels: ['Owner (owner)', 'Repo (repo)', 'PR (pullNumber)', 'Comentário (body)'],
  },
  'github_list_changed_files': {
    title: 'GitHub — Ficheiros alterados',
    description: 'Lista ficheiros alterados no PR.',
    packId: 'github_ops',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Owner da organização/repositório.' },
        repo: { type: 'string', description: 'Nome do repositório.' },
        pullNumber: { type: 'number', description: 'Número do pull request.' },
      },
      required: ['owner', 'repo', 'pullNumber'],
    },
    requiredFieldLabels: ['Owner (owner)', 'Repo (repo)', 'PR (pullNumber)'],
  },
  'github_get_issue': {
    title: 'GitHub — Ler issue',
    description: 'Obtém detalhes de issue.',
    packId: 'github_ops',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Owner da organização/repositório.' },
        repo: { type: 'string', description: 'Nome do repositório.' },
        issueNumber: { type: 'number', description: 'Número da issue.' },
      },
      required: ['owner', 'repo', 'issueNumber'],
    },
    requiredFieldLabels: ['Owner (owner)', 'Repo (repo)', 'Issue (issueNumber)'],
  },
  'github_ops_gold_gate': {
    title: 'GitHub Ops — Gate GOLD operacional',
    description: 'Avalia critérios mínimos operacionais para aceite GOLD da vertical GitHub Ops.',
    packId: 'github_ops',
    inputSchema: {
      type: 'object',
      properties: {
        checkConnectivity: {
          type: 'boolean',
          description: 'Se true, valida conectividade com GitHub API via rate limit endpoint.',
        },
      },
      required: [],
    },
  },
  'schedule_set_availability': {
    title: 'Agenda — Definir disponibilidade',
    description: 'Define janelas de disponibilidade para agendamento.',
    packId: 'scheduling',
    inputSchema: {
      type: 'object',
      properties: {
        startsAt: { type: 'string', description: 'Início ISO da janela.' },
        endsAt: { type: 'string', description: 'Fim ISO da janela.' },
        slotMinutes: { type: 'number', description: 'Duração de cada slot (mínimo 5).' },
        label: { type: 'string', description: 'Rótulo opcional da disponibilidade.' },
      },
      required: ['startsAt', 'endsAt', 'slotMinutes'],
    },
    requiredFieldLabels: ['Início (startsAt)', 'Fim (endsAt)', 'Duração do slot (slotMinutes)'],
  },
  'schedule_create_appointment': {
    title: 'Agenda — Criar compromisso',
    description: 'Cria compromisso na agenda.',
    packId: 'scheduling',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party titular do compromisso.' },
        title: { type: 'string', description: 'Título do compromisso.' },
        startsAt: { type: 'string', description: 'Início ISO do compromisso.' },
        endsAt: { type: 'string', description: 'Fim ISO do compromisso.' },
        careSubjectId: { type: 'string' },
        serviceOrderId: { type: 'string' },
        packageSaleId: { type: 'string' },
        encounterId: { type: 'string' },
        remindAt: { type: 'string', description: 'ISO opcional para gerar lembrete automático.' },
        notes: { type: 'string' },
      },
      required: ['partyId', 'title', 'startsAt', 'endsAt'],
    },
    requiredFieldLabels: ['Party (partyId)', 'Título (title)', 'Início (startsAt)', 'Fim (endsAt)'],
    slotFillingPromptHint:
      'Se faltar obrigatório, peça numa mensagem única: party, título, início e fim (ISO).',
  },
  'schedule_reschedule_appointment': {
    title: 'Agenda — Reagendar',
    description: 'Altera data/hora de compromisso.',
    packId: 'scheduling',
    inputSchema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string', description: 'ID do compromisso.' },
        startsAt: { type: 'string', description: 'Novo início ISO.' },
        endsAt: { type: 'string', description: 'Novo fim ISO.' },
        remindAt: { type: 'string', description: 'ISO opcional para novo lembrete.' },
        notes: { type: 'string' },
      },
      required: ['appointmentId', 'startsAt', 'endsAt'],
    },
    requiredFieldLabels: ['Compromisso (appointmentId)', 'Início (startsAt)', 'Fim (endsAt)'],
  },
  'schedule_cancel_appointment': {
    title: 'Agenda — Cancelar compromisso',
    description: 'Cancela compromisso (soft).',
    packId: 'scheduling',
    inputSchema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string', description: 'ID do compromisso.' },
      },
      required: ['appointmentId'],
    },
    requiredFieldLabels: ['Compromisso (appointmentId)'],
  },
  'schedule_delete_appointment': {
    title: 'Agenda — Remover compromisso',
    description: 'Remove compromisso da base (admin).',
    packId: 'scheduling',
    inputSchema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string', description: 'ID do compromisso.' },
      },
      required: ['appointmentId'],
    },
    requiredFieldLabels: ['Compromisso (appointmentId)'],
  },
  'schedule_confirm_appointment': {
    title: 'Agenda — Confirmar compromisso',
    description: 'Marca compromisso como confirmado.',
    packId: 'scheduling',
    inputSchema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string', description: 'ID do compromisso.' },
      },
      required: ['appointmentId'],
    },
    requiredFieldLabels: ['Compromisso (appointmentId)'],
  },
  'schedule_mark_no_show': {
    title: 'Agenda — Marcar falta',
    description: 'Regista não comparência.',
    packId: 'scheduling',
    inputSchema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string', description: 'ID do compromisso.' },
      },
      required: ['appointmentId'],
    },
    requiredFieldLabels: ['Compromisso (appointmentId)'],
  },
  'schedule_complete_appointment': {
    title: 'Agenda — Concluir compromisso',
    description: 'Marca compromisso como realizado.',
    packId: 'scheduling',
    inputSchema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string', description: 'ID do compromisso.' },
        notes: { type: 'string', description: 'Notas finais opcionais.' },
        durationMinutes: { type: 'number', description: 'Duração em minutos para encounter criado.' },
      },
      required: ['appointmentId'],
    },
    requiredFieldLabels: ['Compromisso (appointmentId)'],
  },
  'schedule_list_agenda_by_date': {
    title: 'Agenda — Listar por dia',
    description: 'Lista compromissos num dia.',
    packId: 'scheduling',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Dia ISO (YYYY-MM-DD).' },
      },
      required: ['date'],
    },
    requiredFieldLabels: ['Dia (date)'],
  },
  'schedule_get_availability': {
    title: 'Agenda — Consultar disponibilidade',
    description: 'Obtém slots disponíveis para agendar.',
    packId: 'scheduling',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Dia ISO (YYYY-MM-DD).' },
        includeCancelled: {
          type: 'boolean',
          description: 'Se false, exclui compromissos cancelados da agenda retornada.',
        },
      },
      required: ['date'],
    },
    requiredFieldLabels: ['Dia (date)'],
  },
};

export function getBusinessActionPreset(actionId: string): TBusinessActionPreset | undefined {
  return PRESETS[actionId.trim()];
}
