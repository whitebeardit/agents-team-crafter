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
  /** Classificação semântica para UX/planner (Ralph Loop 120+). */
  capabilityKind?: 'business_action' | 'primitive_like' | 'gold_gate';
  /** Exposição padrão na UI. */
  uiExposureMode?: 'primary' | 'advanced' | 'hidden';
  /** Domínio principal da ação (ex.: crm, scheduling, care). */
  domainScope?: string;
  /** Dependência explícita de builtins de catálogo (quando aplicável). */
  dependsOnCatalogTools?: string[];
  /** Dependência explícita de outras actions (composite). */
  dependsOnActionIds?: string[];
  /** Primeira camada de policy incremental (guard profile). */
  guardProfileId?: string;
  toolKind?: 'coordination' | 'primitive' | 'composite_workflow' | 'read_model' | 'admin_diagnostic';
  riskLevel?: 'low' | 'medium' | 'high';
  requiresConfirmation?: boolean;
  readAfterWriteRequired?: boolean;
  updatesConversationState?: boolean;
  ownerAgent?: string;
  allowedDirectAgents?: string[];
  allowedIndirectAgents?: string[];
  replacesPrimitiveActions?: string[];
  internallyUses?: string[];
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
  'crm_delete_party': {
    title: 'CRM — Excluir parte',
    description:
      'Remove definitivamente uma party por ID quando não houver agendamentos, sujeitos de cuidado, pedidos, pacotes, sessões ou títulos vinculados.',
    packId: 'crm',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party a remover.' },
      },
      required: ['partyId'],
    },
    requiredFieldLabels: ['ID da parte (partyId)'],
    slotFillingPromptHint:
      'Execute apenas com partyId confirmado; se existirem vínculos operacionais, o sistema recusa e descreve o que bloqueou.',
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
    description:
      'Obtém resumo agregado de uma party. Aceita `partyId` ou `phone` (celular) para identificar o mesmo cadastro.',
    packId: 'crm',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party no CRM.' },
        phone: {
          type: 'string',
          description: 'Celular do paciente no CRM; substitui partyId quando único.',
        },
      },
      required: ['partyId'],
    },
    requiredFieldLabels: ['ID da parte (partyId) ou celular (phone)'],
    slotFillingPromptHint:
      'Execute com partyId ou phone (celular) para lookup único no CRM; não peça IDs internos ao utilizador se ele já deu o número.',
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
      'Para “listar todos os clientes cadastrados”, execute direto com query "" e roles ["customer"] quando aplicável; não pedir query nem IDs.',
  },
  'care_create_subject': {
    title: 'Care — Criar sujeito de cuidado',
    description: 'Cria sujeito de cuidado (paciente/cliente de cuidado).',
    packId: 'care',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party dona do sujeito.' },
        phone: {
          type: 'string',
          description: 'Telefone apenas para lookup de entrada; runtime resolve para partyId antes da execução.',
        },
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
        partyId: {
          type: 'string',
          description: 'ID da party para validação opcional de ownership do sujeito.',
        },
        phone: {
          type: 'string',
          description: 'Telefone opcional apenas para validar ownership via resolução para partyId.',
        },
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
    description:
      'Regista venda de pacote. Identifique a party com `partyId` ou `phone`. Use `productSlug` (catálogo, ex.: standard) **ou** `packageName` + `unitsTotal` manualmente.',
    packId: 'packages_encounters',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party compradora.' },
        phone: { type: 'string', description: 'Celular do paciente; alternativa a partyId.' },
        packageName: { type: 'string', description: 'Nome comercial do pacote (se não usar productSlug).' },
        unitsTotal: { type: 'number', description: 'Unidades/sessões (se não usar productSlug).' },
        productSlug: {
          type: 'string',
          description: 'Slug do produto no catálogo (`package_catalog_list`); preenche nome e unidades.',
        },
      },
      required: ['partyId'],
    },
    requiredFieldLabels: [
      'Party (partyId) ou phone',
      'Catálogo (productSlug) ou pacote manual (packageName + unitsTotal)',
    ],
  },
  'package_catalog_upsert': {
    title: 'Pacotes — Catálogo (criar/atualizar)',
    description: 'Define produto de pacote por slug (ex.: standard), unidades e preço opcional em centavos.',
    packId: 'packages_encounters',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Identificador estável (ex.: standard).' },
        displayName: { type: 'string', description: 'Nome comercial.' },
        units: { type: 'number', description: 'Sessões incluídas no pacote.' },
        priceCents: { type: 'number', description: 'Preço em centavos (BRL); opcional.' },
      },
      required: ['slug', 'displayName', 'units'],
    },
    requiredFieldLabels: ['Slug', 'Nome (displayName)', 'Unidades (units)'],
  },
  'package_catalog_list': {
    title: 'Pacotes — Listar catálogo',
    description: 'Lista produtos de pacote do workspace (slug, unidades, preço).',
    packId: 'packages_encounters',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  'package_get_balance': {
    title: 'Pacotes — Saldo do pacote',
    description:
      'Consulta saldo por **packageSaleId** da venda. Para descobrir vendas/saldos por paciente ou celular, use antes `package_list_by_party` com `phone` ou `partyId`.',
    packId: 'packages_encounters',
    inputSchema: {
      type: 'object',
      properties: {
        packageSaleId: { type: 'string', description: 'ID da venda de pacote.' },
      },
      required: ['packageSaleId'],
    },
    requiredFieldLabels: ['Pacote vendido (packageSaleId)'],
    slotFillingPromptHint:
      'Não serve para lookup por telefone. Obtenha packageSaleId via package_list_by_party (phone ou partyId) ou contexto da venda.',
  },
  'package_list_by_party': {
    title: 'Pacotes — Listar por parte',
    description:
      'Lista vendas de pacote e saldos. Aceita `phone` ou `partyId` (o **runtime** resolve o telefone para a party; não exige procura prévia com crm_find_party). Cada venda traz `unitsTotal`, `unitsUsed`, `remaining` (0 = esgotado).',
    packId: 'packages_encounters',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party para consulta de pacotes.' },
        phone: { type: 'string', description: 'Celular; alternativa a partyId.' },
      },
      required: ['partyId'],
    },
    requiredFieldLabels: ['Party (partyId) ou phone'],
    slotFillingPromptHint:
      'Com telefone na frase, execute imediato com `phone` (sem pergunta “posso localizar no CRM”). Lista com phone OU partyId; devolve packageSales. Não use package_get_balance para isso; não confundir com package_get_balance (só packageSaleId).',
  },
  'attendance_register_session': {
    title: 'Atendimentos — Registar sessão',
    description:
      'Regista uma sessão de atendimento. Identifique o paciente com `partyId` ou `phone`.',
    packId: 'packages_encounters',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party atendida.' },
        phone: { type: 'string', description: 'Celular do paciente; alternativa a partyId.' },
        packageSaleId: { type: 'string', description: 'ID opcional do pacote consumido.' },
        notes: { type: 'string', description: 'Notas da sessão.' },
        durationMinutes: { type: 'number', description: 'Duração da sessão em minutos.' },
      },
      required: ['partyId'],
    },
    requiredFieldLabels: ['Party (partyId) ou phone'],
  },
  'attendance_list_by_party': {
    title: 'Atendimentos — Listar por parte',
    description: 'Lista atendimentos. Use `partyId` ou `phone` do paciente.',
    packId: 'packages_encounters',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party.' },
        phone: { type: 'string', description: 'Celular; alternativa a partyId.' },
      },
      required: ['partyId'],
    },
    requiredFieldLabels: ['Party (partyId) ou phone'],
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
    description: 'Resumo de cuidados/atendimentos. Identifique com `partyId` ou `phone`.',
    packId: 'packages_encounters',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party para sumarização.' },
        phone: { type: 'string', description: 'Celular; alternativa a partyId.' },
      },
      required: ['partyId'],
    },
    requiredFieldLabels: ['Party (partyId) ou phone'],
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
  'package_consume_unit_once': {
    title: 'Pacotes — Consumir 1 unidade (idempotente)',
    description:
      'Consome uma unidade do pacote de forma idempotente por encounter (não consome duas vezes para o mesmo encounter).',
    packId: 'packages_encounters',
    inputSchema: {
      type: 'object',
      properties: {
        packageSaleId: { type: 'string' },
        encounterId: { type: 'string' },
        appointmentId: { type: 'string' },
      },
      required: ['packageSaleId', 'encounterId'],
    },
    requiredFieldLabels: ['Pacote vendido (packageSaleId)', 'Encontro (encounterId)'],
    capabilityKind: 'business_action',
    uiExposureMode: 'advanced',
    domainScope: 'packages_encounters',
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
    description:
      'Abre encontro clínico. Identifique a party com `partyId` ou `phone` (celular do CRM).',
    packId: 'clinical',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party responsável.' },
        phone: { type: 'string', description: 'Celular do paciente; alternativa a partyId.' },
        careSubjectId: { type: 'string', description: 'ID do sujeito de cuidado.' },
        notes: { type: 'string', description: 'Notas clínicas opcionais.' },
      },
      required: ['partyId', 'careSubjectId'],
    },
    requiredFieldLabels: ['Party (partyId) ou phone', 'Sujeito (careSubjectId)'],
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
    description:
      'Regista título a receber. O pagador pode ser identificado por `partyId` ou `phone` (celular no CRM).',
    packId: 'finance',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party pagadora.' },
        phone: { type: 'string', description: 'Celular do pagador; alternativa a partyId.' },
        amount: { type: 'number', description: 'Valor do título.' },
        dueDate: { type: 'string', description: 'Data de vencimento (ISO YYYY-MM-DD).' },
        description: { type: 'string', description: 'Descrição opcional.' },
        currency: { type: 'string', description: 'Moeda (ex.: BRL, EUR).' },
      },
      required: ['partyId', 'amount', 'dueDate'],
    },
    requiredFieldLabels: ['Pagador (partyId) ou phone', 'Valor (amount)', 'Vencimento (dueDate)'],
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
    description:
      'Resumo financeiro consolidado. Identifique o cliente com `partyId` ou `phone` (celular).',
    packId: 'finance',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party para sumarização.' },
        phone: { type: 'string', description: 'Celular; alternativa a partyId.' },
      },
      required: ['partyId'],
    },
    requiredFieldLabels: ['Cliente (partyId) ou phone'],
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
    description:
      'Cria compromisso na agenda. O paciente pode ser identificado por `partyId` ou `phone` (celular no CRM).',
    packId: 'scheduling',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party titular do compromisso.' },
        phone: { type: 'string', description: 'Celular do paciente; alternativa a partyId.' },
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
    requiredFieldLabels: ['Party (partyId) ou phone', 'Título (title)', 'Início (startsAt)', 'Fim (endsAt)'],
    slotFillingPromptHint:
      'Se faltar obrigatório, peça numa mensagem única: celular ou partyId, título, início e fim (ISO). Com um único pacote elegível para o paciente, pode omitir packageSaleId.',
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
  'schedule_list_appointments_by_party': {
    title: 'Agenda — Listar compromissos do paciente',
    description:
      'Lista compromissos (agendamentos) de um paciente, identificado por `partyId` ou `phone`. Ordenação: mais recentes por data de início.',
    packId: 'scheduling',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string', description: 'ID da party no CRM.' },
        phone: { type: 'string', description: 'Celular do paciente; alternativa a partyId.' },
        limit: { type: 'number', description: 'Máximo de linhas (default 100, cap 200).' },
      },
      required: ['partyId'],
    },
    requiredFieldLabels: ['Party (partyId) ou phone'],
    slotFillingPromptHint:
      'Use phone ou partyId. Devolve compromissos com status (scheduled, confirmed, completed, etc.).',
  },
  'patient_operational_overview': {
    title: 'Painel — Resumo operacional do paciente (dashboard)',
    description:
      'Uma leitura agregada: ficha CRM (`party`), todas as vendas de pacote com unidades e saldo (`packageSales` + resumo com/sem saldo), compromissos de agenda do paciente (`appointments`, mais recentes primeiro), atendimentos/sessões (`encounters`), sujeitos de cuidado (`careSubjects`). Identificação por `phone` ou `partyId`.',
    packId: 'scheduling',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string' },
        phone: { type: 'string', description: 'Celular; alternativa a partyId.' },
        appointmentLimit: { type: 'number', description: 'Máx. compromissos (default 100).' },
        encounterLimit: { type: 'number', description: 'Máx. atendimentos (default 100).' },
      },
      required: ['partyId'],
    },
    requiredFieldLabels: ['Party (partyId) ou phone'],
    slotFillingPromptHint:
      'Preferir para “resumo do paciente / dashboard / o que ela tem agendado e de pacote”. Não exige packageSaleId individual.',
  },
  'clinic_create_patient': {
    title: 'Clínica — Cadastrar paciente (Party + Care psych)',
    description:
      'Cria ou localiza paciente por telefone e garante prontuário preparado: Party no CRM + CareSubject com subjectKind=psych. Idempotente por telefone.',
    packId: 'clinic',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome da paciente.' },
        phone: { type: 'string', description: 'Celular/telefone da paciente (identificador primário humano).' },
        email: { type: ['string', 'null'], description: 'Email opcional.' },
        notes: { type: ['string', 'null'], description: 'Observações opcionais.' },
      },
      required: ['name', 'phone'],
    },
    requiredFieldLabels: ['Nome (name)', 'Celular (phone)'],
    examples: [{ name: 'Liana Rehem', phone: '+55 79 988222222' }],
    slotFillingPromptHint:
      'Peça numa única mensagem os obrigatórios em falta: name e phone. Não peça IDs internos.',
    capabilityKind: 'business_action',
    uiExposureMode: 'primary',
    domainScope: 'clinic.patient',
    toolKind: 'composite_workflow',
    riskLevel: 'medium',
    requiresConfirmation: false,
    readAfterWriteRequired: true,
    updatesConversationState: true,
    ownerAgent: 'clinic_patient_crm_specialist',
    allowedDirectAgents: ['clinic_patient_crm_specialist'],
    allowedIndirectAgents: ['clinic_coordinator'],
  },
  'clinic_find_or_create_patient_by_phone': {
    title: 'Clínica — Resolver paciente por telefone (helper)',
    description:
      'Helper interno: resolve telefone para partyId e careSubjectId (psych), criando o CareSubject quando faltar. Útil como bloco de workflows clínicos.',
    packId: 'clinic',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Celular/telefone da paciente.' },
        name: { type: 'string', description: 'Nome opcional (usado apenas se precisar criar party).' },
        email: { type: ['string', 'null'], description: 'Email opcional.' },
        notes: { type: ['string', 'null'], description: 'Notas opcionais.' },
      },
      required: ['phone'],
    },
    requiredFieldLabels: ['Celular (phone)'],
    examples: [{ phone: '+55 79 988222222' }],
    capabilityKind: 'business_action',
    uiExposureMode: 'hidden',
    domainScope: 'clinic.patient',
  },
  'clinic_sell_default_package': {
    title: 'Clínica — Vender pacote padrão',
    description:
      'Vende um pacote para a paciente por telefone e confirma a persistência com read-after-write (listagem de pacotes por paciente).',
    packId: 'clinic',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Celular/telefone da paciente.' },
        packageName: { type: 'string', description: 'Nome do pacote (default: Pacote padrão).' },
        unitsTotal: { type: 'number', description: 'Total de sessões/unidades.' },
      },
      required: ['phone'],
    },
    requiredFieldLabels: ['Celular (phone)'],
    examples: [{ phone: '+55 79 988222222', packageName: 'Pacote padrão', unitsTotal: 1 }],
    capabilityKind: 'business_action',
    uiExposureMode: 'primary',
    domainScope: 'clinic.packages',
    toolKind: 'composite_workflow',
    riskLevel: 'medium',
    readAfterWriteRequired: true,
    updatesConversationState: true,
    ownerAgent: 'clinic_package_specialist',
    allowedDirectAgents: ['clinic_package_specialist'],
    allowedIndirectAgents: ['clinic_coordinator'],
  },
  'clinic_list_patient_packages': {
    title: 'Clínica — Ver pacotes e saldo',
    description: 'Lista pacotes e saldos por paciente (telefone).',
    packId: 'clinic',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Celular/telefone da paciente.' },
      },
      required: ['phone'],
    },
    requiredFieldLabels: ['Celular (phone)'],
    examples: [{ phone: '+55 79 988222222' }],
    capabilityKind: 'business_action',
    uiExposureMode: 'primary',
    domainScope: 'clinic.packages',
  },
  'clinic_get_eligible_package': {
    title: 'Clínica — Resolver pacote elegível (helper)',
    description:
      'Aplica a política de elegibilidade de pacote (saldo e regras do workspace) para agendamento/atendimento.',
    packId: 'clinic',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Celular/telefone da paciente.' },
      },
      required: ['phone'],
    },
    requiredFieldLabels: ['Celular (phone)'],
    examples: [{ phone: '+55 79 988222222' }],
    capabilityKind: 'business_action',
    uiExposureMode: 'hidden',
    domainScope: 'clinic.packages',
  },
  'clinic_schedule_session_by_phone': {
    title: 'Clínica — Agendar sessão',
    description:
      'Agenda uma sessão por telefone e linguagem natural de data/hora, validando paciente, pacote elegível, timezone e conflito; confirma persistência com read-after-write.',
    packId: 'clinic',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Celular/telefone da paciente.' },
        dateExpression: { type: 'string', description: 'Ex.: hoje, amanhã, 2026-04-28.' },
        timeExpression: { type: 'string', description: 'Ex.: 17h, 22:30.' },
        durationMinutes: { type: 'number', description: 'Duração (min). Default do workspace quando omitido.' },
        title: { type: 'string', description: 'Título da sessão.' },
      },
      required: ['phone', 'dateExpression', 'timeExpression'],
    },
    requiredFieldLabels: ['Celular (phone)', 'Data (dateExpression)', 'Hora (timeExpression)'],
    examples: [{ phone: '+55 79 988222222', dateExpression: 'amanhã', timeExpression: '17h', durationMinutes: 50 }],
    capabilityKind: 'business_action',
    uiExposureMode: 'primary',
    domainScope: 'clinic.scheduling',
    toolKind: 'composite_workflow',
    riskLevel: 'medium',
    readAfterWriteRequired: true,
    updatesConversationState: true,
    ownerAgent: 'clinic_scheduling_specialist',
    allowedDirectAgents: ['clinic_scheduling_specialist'],
    allowedIndirectAgents: ['clinic_coordinator'],
    replacesPrimitiveActions: ['schedule_create_appointment'],
  },
  'clinic_reschedule_session_by_context': {
    title: 'Clínica — Remarcar sessão',
    description:
      'Remarca sessão por contexto humano (telefone + horário anterior ou appointmentId), sem pedir ID interno como primeira opção; confirma persistência.',
    packId: 'clinic',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Celular/telefone da paciente.' },
        appointmentId: { type: ['string', 'null'], description: 'Opcional; quando ausente, resolve por contexto.' },
        previousDateExpression: { type: 'string' },
        previousTimeExpression: { type: 'string' },
        newDateExpression: { type: 'string' },
        newTimeExpression: { type: 'string' },
      },
      required: ['phone', 'previousDateExpression', 'previousTimeExpression', 'newDateExpression', 'newTimeExpression'],
    },
    requiredFieldLabels: ['Celular (phone)', 'Data anterior', 'Hora anterior', 'Nova data', 'Nova hora'],
    examples: [
      {
        phone: '+55 79 988222222',
        appointmentId: null,
        previousDateExpression: 'amanhã',
        previousTimeExpression: '17h',
        newDateExpression: 'hoje',
        newTimeExpression: '22h',
      },
    ],
    capabilityKind: 'business_action',
    uiExposureMode: 'primary',
    domainScope: 'clinic.scheduling',
  },
  'clinic_cancel_session_by_context': {
    title: 'Clínica — Cancelar sessão',
    description: 'Cancela sessão por contexto (telefone + estado conversacional) com fallback para appointmentId.',
    packId: 'clinic',
    inputSchema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string' },
        phone: { type: 'string' },
        dateExpression: { type: 'string' },
        timeExpression: { type: 'string' },
      },
    },
    requiredFieldLabels: ['Paciente (phone) ou Compromisso (appointmentId)'],
    capabilityKind: 'business_action',
    uiExposureMode: 'advanced',
    domainScope: 'clinic.scheduling',
    toolKind: 'composite_workflow',
    riskLevel: 'high',
    requiresConfirmation: true,
    readAfterWriteRequired: true,
    updatesConversationState: true,
    ownerAgent: 'clinic_scheduling_specialist',
    allowedDirectAgents: ['clinic_scheduling_specialist'],
    allowedIndirectAgents: ['clinic_coordinator'],
    replacesPrimitiveActions: ['schedule_cancel_appointment'],
  },
  'clinic_list_patient_sessions': {
    title: 'Clínica — Ver sessões da paciente',
    description: 'Lista sessões por paciente (telefone) com horários formatados no timezone da clínica.',
    packId: 'clinic',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['phone'],
    },
    requiredFieldLabels: ['Celular (phone)'],
    capabilityKind: 'business_action',
    uiExposureMode: 'primary',
    domainScope: 'clinic.scheduling',
  },
  'clinic_list_sessions_by_local_date': {
    title: 'Clínica — Listar agenda (dia local)',
    description:
      'Lista compromissos de um dia na perspectiva do timezone da clínica, aceitando hoje/amanhã e datas explícitas.',
    packId: 'clinic',
    inputSchema: {
      type: 'object',
      properties: {
        dateExpression: { type: 'string' },
        timezone: { type: 'string' },
      },
      required: ['dateExpression'],
    },
    requiredFieldLabels: ['Dia (dateExpression)'],
    capabilityKind: 'business_action',
    uiExposureMode: 'primary',
    domainScope: 'clinic.scheduling',
  },
  'clinic_register_attendance_by_phone_and_time': {
    title: 'Clínica — Registrar atendimento',
    description:
      'Registra atendimento clínico por telefone + data/hora local: encontra agendamento, conclui (encounter), registra evolução e consome pacote com idempotência; confirma persistência.',
    packId: 'clinic',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string' },
        dateExpression: { type: 'string' },
        timeExpression: { type: 'string' },
        durationMinutes: { type: 'number' },
        chiefComplaint: { type: 'string' },
        evolutionNote: { type: 'string' },
      },
      required: ['phone', 'dateExpression', 'timeExpression'],
    },
    requiredFieldLabels: ['Celular (phone)', 'Data (dateExpression)', 'Hora (timeExpression)'],
    examples: [
      {
        phone: '+55 79 988222222',
        dateExpression: 'hoje',
        timeExpression: '22:30',
        chiefComplaint: 'ansiedade',
        evolutionNote: 'Paciente desenvolvendo sintomas de síndrome do pânico',
        durationMinutes: 50,
      },
    ],
    capabilityKind: 'business_action',
    uiExposureMode: 'primary',
    domainScope: 'clinic.attendance',
    toolKind: 'composite_workflow',
    riskLevel: 'high',
    readAfterWriteRequired: true,
    updatesConversationState: true,
    ownerAgent: 'clinic_attendance_specialist',
    allowedDirectAgents: ['clinic_attendance_specialist'],
    allowedIndirectAgents: ['clinic_coordinator'],
  },
  'clinic_get_patient_full_snapshot': {
    title: 'Clínica — Resumo completo da paciente',
    description:
      'Snapshot único: une CRM/Care, pacotes, agenda, atendimentos, histórico clínico e financeiro (quando disponível), com warnings de inconsistência.',
    packId: 'clinic',
    inputSchema: {
      type: 'object',
      properties: { phone: { type: 'string' } },
      required: ['phone'],
    },
    requiredFieldLabels: ['Celular (phone)'],
    examples: [{ phone: '+55 79 988222222' }],
    capabilityKind: 'business_action',
    uiExposureMode: 'primary',
    domainScope: 'clinic.snapshot',
    toolKind: 'read_model',
    riskLevel: 'low',
    requiresConfirmation: false,
    readAfterWriteRequired: false,
    updatesConversationState: false,
    ownerAgent: 'clinic_audit_specialist',
    allowedDirectAgents: ['clinic_audit_specialist', 'clinic_coordinator'],
    allowedIndirectAgents: ['clinic_coordinator'],
  },
  'clinic_context_get_current_patient': {
    title: 'Clínica — Ler paciente do contexto',
    description: 'Tool de coordenação para obter a paciente atual do estado conversacional da clínica.',
    packId: 'clinic',
    inputSchema: { type: 'object', properties: {}, required: [] },
    capabilityKind: 'business_action',
    uiExposureMode: 'hidden',
    domainScope: 'clinic.coordination',
    toolKind: 'coordination',
    riskLevel: 'low',
    ownerAgent: 'clinic_coordinator',
    allowedDirectAgents: ['clinic_coordinator'],
    allowedIndirectAgents: [],
  },
  'clinic_context_update_current_patient': {
    title: 'Clínica — Atualizar paciente do contexto',
    description: 'Tool de coordenação para fixar paciente atual no contexto operacional da conversa.',
    packId: 'clinic',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string' },
        careSubjectId: { type: 'string' },
        name: { type: 'string' },
        phone: { type: 'string' },
      },
      required: ['partyId', 'name'],
    },
    capabilityKind: 'business_action',
    uiExposureMode: 'hidden',
    domainScope: 'clinic.coordination',
    toolKind: 'coordination',
    riskLevel: 'low',
    ownerAgent: 'clinic_coordinator',
    allowedDirectAgents: ['clinic_coordinator'],
    allowedIndirectAgents: [],
  },
  'team_delegate_to_patient_specialist': {
    title: 'Time — Delegar para especialista de paciente',
    description: 'Tool de coordenação para delegar execução ao especialista de paciente/CRM.',
    packId: 'clinic',
    inputSchema: { type: 'object', properties: { instruction: { type: 'string' } }, required: ['instruction'] },
    capabilityKind: 'business_action',
    uiExposureMode: 'hidden',
    domainScope: 'clinic.coordination',
    toolKind: 'coordination',
    riskLevel: 'low',
    ownerAgent: 'clinic_coordinator',
    allowedDirectAgents: ['clinic_coordinator'],
  },
  'team_delegate_to_package_specialist': {
    title: 'Time — Delegar para especialista de pacotes',
    description: 'Tool de coordenação para delegar execução ao especialista de pacotes.',
    packId: 'clinic',
    inputSchema: { type: 'object', properties: { instruction: { type: 'string' } }, required: ['instruction'] },
    capabilityKind: 'business_action',
    uiExposureMode: 'hidden',
    domainScope: 'clinic.coordination',
    toolKind: 'coordination',
    riskLevel: 'low',
    ownerAgent: 'clinic_coordinator',
    allowedDirectAgents: ['clinic_coordinator'],
  },
  'team_delegate_to_scheduling_specialist': {
    title: 'Time — Delegar para especialista de agenda',
    description: 'Tool de coordenação para delegar execução ao especialista de agenda clínica.',
    packId: 'clinic',
    inputSchema: { type: 'object', properties: { instruction: { type: 'string' } }, required: ['instruction'] },
    capabilityKind: 'business_action',
    uiExposureMode: 'hidden',
    domainScope: 'clinic.coordination',
    toolKind: 'coordination',
    riskLevel: 'low',
    ownerAgent: 'clinic_coordinator',
    allowedDirectAgents: ['clinic_coordinator'],
  },
  'team_delegate_to_attendance_specialist': {
    title: 'Time — Delegar para especialista de atendimento',
    description: 'Tool de coordenação para delegar execução ao especialista de atendimento/prontuário.',
    packId: 'clinic',
    inputSchema: { type: 'object', properties: { instruction: { type: 'string' } }, required: ['instruction'] },
    capabilityKind: 'business_action',
    uiExposureMode: 'hidden',
    domainScope: 'clinic.coordination',
    toolKind: 'coordination',
    riskLevel: 'low',
    ownerAgent: 'clinic_coordinator',
    allowedDirectAgents: ['clinic_coordinator'],
  },
  'team_delegate_to_finance_specialist': {
    title: 'Time — Delegar para especialista financeiro',
    description: 'Tool de coordenação para delegar execução ao especialista financeiro.',
    packId: 'clinic',
    inputSchema: { type: 'object', properties: { instruction: { type: 'string' } }, required: ['instruction'] },
    capabilityKind: 'business_action',
    uiExposureMode: 'hidden',
    domainScope: 'clinic.coordination',
    toolKind: 'coordination',
    riskLevel: 'low',
    ownerAgent: 'clinic_coordinator',
    allowedDirectAgents: ['clinic_coordinator'],
  },
  'team_delegate_to_admin_audit_specialist': {
    title: 'Time — Delegar para especialista de auditoria/admin',
    description: 'Tool de coordenação para delegar execução ao especialista de auditoria e diagnóstico.',
    packId: 'clinic',
    inputSchema: { type: 'object', properties: { instruction: { type: 'string' } }, required: ['instruction'] },
    capabilityKind: 'business_action',
    uiExposureMode: 'hidden',
    domainScope: 'clinic.coordination',
    toolKind: 'coordination',
    riskLevel: 'low',
    ownerAgent: 'clinic_coordinator',
    allowedDirectAgents: ['clinic_coordinator'],
  },
  'clinic_add_evolution_to_existing_attendance': {
    title: 'Clínica — Adicionar evolução em atendimento existente',
    description:
      'Adiciona evolução clínica vinculada ao último atendimento da paciente, sem evolução solta por ID interno.',
    packId: 'clinic',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string' },
        evolutionNote: { type: 'string' },
      },
      required: ['phone', 'evolutionNote'],
    },
    requiredFieldLabels: ['Celular (phone)', 'Evolução (evolutionNote)'],
    capabilityKind: 'business_action',
    uiExposureMode: 'primary',
    domainScope: 'clinic.attendance',
    toolKind: 'composite_workflow',
    riskLevel: 'medium',
    readAfterWriteRequired: true,
    ownerAgent: 'clinic_attendance_specialist',
    allowedDirectAgents: ['clinic_attendance_specialist'],
    allowedIndirectAgents: ['clinic_coordinator'],
  },
  'clinic_create_receivable_for_session': {
    title: 'Clínica — Criar cobrança de sessão',
    description: 'Cria um recebível financeiro vinculado à paciente/sessão via telefone.',
    packId: 'clinic',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string' },
        amount: { type: 'number' },
        dueDate: { type: 'string' },
        description: { type: 'string' },
        currency: { type: 'string' },
      },
      required: ['phone', 'amount', 'dueDate'],
    },
    requiredFieldLabels: ['Celular (phone)', 'Valor (amount)', 'Vencimento (dueDate)'],
    capabilityKind: 'business_action',
    uiExposureMode: 'primary',
    domainScope: 'clinic.finance',
    toolKind: 'composite_workflow',
    riskLevel: 'high',
    requiresConfirmation: true,
    readAfterWriteRequired: true,
    ownerAgent: 'clinic_finance_specialist',
    allowedDirectAgents: ['clinic_finance_specialist'],
    allowedIndirectAgents: ['clinic_coordinator'],
  },
  'clinic_get_patient_financial_summary': {
    title: 'Clínica — Resumo financeiro da paciente',
    description: 'Consolida resumo e pendências financeiras da paciente por telefone.',
    packId: 'clinic',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string' },
      },
      required: ['phone'],
    },
    requiredFieldLabels: ['Celular (phone)'],
    capabilityKind: 'business_action',
    uiExposureMode: 'primary',
    domainScope: 'clinic.finance',
    toolKind: 'read_model',
    riskLevel: 'low',
    ownerAgent: 'clinic_finance_specialist',
    allowedDirectAgents: ['clinic_finance_specialist', 'clinic_coordinator'],
    allowedIndirectAgents: ['clinic_coordinator'],
  },
  'clinic_audit_patient_integrity': {
    title: 'Clínica — Auditoria de integridade de paciente',
    description: 'Audita vínculo Party/CareSubject da paciente por telefone para uso administrativo.',
    packId: 'clinic',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string' },
      },
      required: ['phone'],
    },
    requiredFieldLabels: ['Celular (phone)'],
    capabilityKind: 'business_action',
    uiExposureMode: 'advanced',
    domainScope: 'clinic.admin',
    toolKind: 'admin_diagnostic',
    riskLevel: 'medium',
    ownerAgent: 'clinic_admin_audit_specialist',
    allowedDirectAgents: ['clinic_admin_audit_specialist'],
    allowedIndirectAgents: ['clinic_coordinator'],
  },
  'clinic_audit_appointments_integrity': {
    title: 'Clínica — Auditoria de integridade de sessões',
    description: 'Audita inconsistências de sessões (links e encounter) por telefone ou data local.',
    packId: 'clinic',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string' },
        date: { type: 'string' },
      },
    },
    capabilityKind: 'business_action',
    uiExposureMode: 'advanced',
    domainScope: 'clinic.admin',
    toolKind: 'admin_diagnostic',
    riskLevel: 'medium',
    ownerAgent: 'clinic_admin_audit_specialist',
    allowedDirectAgents: ['clinic_admin_audit_specialist'],
    allowedIndirectAgents: ['clinic_coordinator'],
  },
  'clinic_repair_patient_links': {
    title: 'Clínica — Reparar vínculos de paciente',
    description: 'Repara vínculo clínico Party/CareSubject para paciente informada.',
    packId: 'clinic',
    inputSchema: {
      type: 'object',
      properties: {
        phone: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['phone'],
    },
    requiredFieldLabels: ['Celular (phone)'],
    capabilityKind: 'business_action',
    uiExposureMode: 'hidden',
    domainScope: 'clinic.admin',
    toolKind: 'admin_diagnostic',
    riskLevel: 'high',
    requiresConfirmation: true,
    readAfterWriteRequired: true,
    ownerAgent: 'clinic_admin_audit_specialist',
    allowedDirectAgents: ['clinic_admin_audit_specialist'],
    allowedIndirectAgents: ['clinic_coordinator'],
  },
  'clinic_schedule_session': {
    title: 'Clínica — Agendar sessão (composite)',
    description:
      'Composite action clínica: valida pré-condições de domínio e delega no scheduling universal.',
    packId: 'scheduling',
    inputSchema: {
      type: 'object',
      properties: {
        partyId: { type: 'string' },
        careSubjectId: { type: 'string' },
        packageSaleId: { type: 'string' },
        title: { type: 'string' },
        startsAt: { type: 'string' },
        endsAt: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['partyId', 'careSubjectId', 'title', 'startsAt', 'endsAt'],
    },
    requiredFieldLabels: ['Party (partyId)', 'Sujeito (careSubjectId)', 'Título (title)', 'Início (startsAt)', 'Fim (endsAt)'],
    domainScope: 'clinical_scheduling',
    dependsOnActionIds: ['schedule_create_appointment'],
    guardProfileId: 'care_subject_context_guard',
  },
  'clinic_reschedule_session': {
    title: 'Clínica — Reagendar sessão (composite)',
    description:
      'Composite action clínica: aplica policy/guard e delega no reagendamento universal de scheduling.',
    packId: 'scheduling',
    inputSchema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string' },
        startsAt: { type: 'string' },
        endsAt: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['appointmentId', 'startsAt', 'endsAt'],
    },
    requiredFieldLabels: ['Compromisso (appointmentId)', 'Início (startsAt)', 'Fim (endsAt)'],
    domainScope: 'clinical_scheduling',
    dependsOnActionIds: ['schedule_reschedule_appointment'],
    guardProfileId: 'care_subject_context_guard',
  },
  'clinic_cancel_session': {
    title: 'Clínica — Cancelar sessão (composite)',
    description:
      'Composite action clínica: aplica policy/guard e delega no cancelamento universal de scheduling.',
    packId: 'scheduling',
    inputSchema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string' },
      },
      required: ['appointmentId'],
    },
    requiredFieldLabels: ['Compromisso (appointmentId)'],
    domainScope: 'clinical_scheduling',
    dependsOnActionIds: ['schedule_cancel_appointment'],
    guardProfileId: 'care_subject_context_guard',
  },
};

function inferCapabilityKind(actionId: string): 'business_action' | 'primitive_like' | 'gold_gate' {
  if (actionId.endsWith('_gold_gate')) return 'gold_gate';
  if (actionId.startsWith('schedule_')) return 'primitive_like';
  return 'business_action';
}

function inferUiExposureMode(
  actionId: string,
  kind: 'business_action' | 'primitive_like' | 'gold_gate',
): 'primary' | 'advanced' | 'hidden' {
  if (kind === 'gold_gate') return 'advanced';
  if (actionId === 'business.ping') return 'hidden';
  if (kind === 'primitive_like') return 'advanced';
    if (
    actionId === 'crm_create_party' ||
    actionId === 'crm_update_party' ||
    actionId === 'crm_find_party' ||
    actionId === 'crm_list_parties' ||
    actionId === 'crm_get_party_summary' ||
    actionId === 'clinic_schedule_session' ||
    actionId === 'patient_operational_overview'
  ) {
    return 'primary';
  }
  return 'advanced';
}

function inferDomainScope(actionId: string): string | undefined {
  const [prefix] = actionId.split('_');
  if (!prefix) return undefined;
  if (actionId === 'business.ping' || actionId.startsWith('platform_')) return 'platform';
  if (prefix === 'schedule') return 'scheduling';
  return prefix;
}

function withSemanticDefaults(actionId: string, preset: TBusinessActionPreset): TBusinessActionPreset {
  const capabilityKind = preset.capabilityKind ?? inferCapabilityKind(actionId);
  return {
    ...preset,
    capabilityKind,
    uiExposureMode: preset.uiExposureMode ?? inferUiExposureMode(actionId, capabilityKind),
    domainScope: preset.domainScope ?? inferDomainScope(actionId),
  };
}

export function getBusinessActionPreset(actionId: string): TBusinessActionPreset | undefined {
  const id = actionId.trim();
  const preset = PRESETS[id];
  if (!preset) return undefined;
  return withSemanticDefaults(id, preset);
}
