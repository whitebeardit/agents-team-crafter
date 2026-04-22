type TActionFieldNormalizationRule = {
  /** Chave canónica esperada pelo schema da action. */
  targetKey: string;
  /** Aliases aceites para o mesmo campo. */
  aliases: readonly string[];
  /** Mapa opcional para normalizar valores (ex.: humano -> human). */
  valueAliases?: Readonly<Record<string, string>>;
};

export type TActionNormalizationSafetyClass = 'A' | 'B' | 'C';

type TActionNormalizationConfig = {
  safetyClass: TActionNormalizationSafetyClass;
  rules: readonly TActionFieldNormalizationRule[];
};

const DISPLAY_NAME_ALIASES = [
  'displayName',
  'name',
  'nome',
  'nomeCompleto',
  'nome_completo',
  'nome completo',
  'fullName',
  'full_name',
] as const;

const EMAIL_ALIASES = ['email', 'e-mail', 'mail'] as const;

const PHONE_ALIASES = ['phone', 'telefone', 'celular'] as const;

const CARE_SUBJECT_KIND_VALUE_ALIASES: Readonly<Record<string, string>> = {
  human: 'human',
  humano: 'human',
  pessoa: 'human',
  animal: 'animal',
  pet: 'animal',
  psych: 'psych',
  psiquico: 'psych',
  psicológico: 'psych',
  psicologico: 'psych',
};

/**
 * Biblioteca de normalização controlada por actionId (Loop 98.6).
 * Regras explícitas, auditáveis e testáveis; sem heurística genérica.
 */
const ACTION_NORMALIZATION_CONFIGS: Readonly<Record<string, TActionNormalizationConfig>> = {
  'business.ping': {
    safetyClass: 'A',
    rules: [{ targetKey: 'message', aliases: ['message', 'mensagem', 'texto'] }],
  },
  platform_status_overview: {
    safetyClass: 'A',
    rules: [{ targetKey: 'includeTimestamp', aliases: ['includeTimestamp', 'include_time', 'comHorario'] }],
  },
  crm_create_party: {
    safetyClass: 'A',
    rules: [
      { targetKey: 'name', aliases: DISPLAY_NAME_ALIASES },
      { targetKey: 'email', aliases: EMAIL_ALIASES },
      { targetKey: 'phone', aliases: PHONE_ALIASES },
    ],
  },
  crm_update_party: {
    safetyClass: 'A',
    rules: [{ targetKey: 'displayName', aliases: DISPLAY_NAME_ALIASES }],
  },
  crm_delete_party: {
    safetyClass: 'A',
    rules: [{ targetKey: 'partyId', aliases: ['partyId', 'id', 'party_id', 'clienteId', 'customerId', 'clientId'] }],
  },
  crm_find_party: {
    safetyClass: 'B',
    rules: [
      { targetKey: 'partyId', aliases: ['partyId', 'id', 'party_id', 'clienteId', 'customerId', 'clientId'] },
      { targetKey: 'email', aliases: EMAIL_ALIASES },
      { targetKey: 'phone', aliases: PHONE_ALIASES },
      { targetKey: 'query', aliases: ['query', 'termo', 'search', 'nome', 'name'] },
    ],
  },
  finance_create_receivable: {
    safetyClass: 'A',
    rules: [
      { targetKey: 'partyId', aliases: ['partyId', 'customerId', 'clientId', 'payerId'] },
      { targetKey: 'amount', aliases: ['amount', 'valor'] },
      { targetKey: 'dueDate', aliases: ['dueDate', 'due_date', 'vencimento', 'dataVencimento'] },
    ],
  },
  finance_create_payable: {
    safetyClass: 'A',
    rules: [
      {
        targetKey: 'destinationPartyId',
        aliases: ['destinationPartyId', 'supplierId', 'vendorId', 'beneficiaryPartyId'],
      },
      { targetKey: 'amount', aliases: ['amount', 'valor'] },
      { targetKey: 'dueDate', aliases: ['dueDate', 'due_date', 'vencimento', 'dataVencimento'] },
    ],
  },
  finance_mark_receivable_paid: {
    safetyClass: 'A',
    rules: [{ targetKey: 'receivableId', aliases: ['receivableId', 'id', 'tituloId'] }],
  },
  finance_mark_payable_paid: {
    safetyClass: 'A',
    rules: [{ targetKey: 'payableId', aliases: ['payableId', 'id', 'tituloId'] }],
  },
  finance_customer_financial_summary: {
    safetyClass: 'A',
    rules: [{ targetKey: 'partyId', aliases: ['partyId', 'customerId', 'clientId'] }],
  },
  care_create_subject: {
    safetyClass: 'A',
    rules: [
      { targetKey: 'partyId', aliases: ['partyId', 'customerId', 'clientId', 'ownerPartyId'] },
      { targetKey: 'phone', aliases: PHONE_ALIASES },
      { targetKey: 'name', aliases: ['name', 'nome', 'subjectName', 'nomeCompleto'] },
      {
        targetKey: 'subjectKind',
        aliases: ['subjectKind', 'kind', 'tipo'],
        valueAliases: CARE_SUBJECT_KIND_VALUE_ALIASES,
      },
    ],
  },
  care_create_patient: {
    safetyClass: 'A',
    rules: [
      { targetKey: 'name', aliases: ['name', 'nome', 'fullName', 'nomeCompleto'] },
      { targetKey: 'email', aliases: EMAIL_ALIASES },
      { targetKey: 'phone', aliases: PHONE_ALIASES },
    ],
  },
  care_update_subject: {
    safetyClass: 'A',
    rules: [
      { targetKey: 'subjectId', aliases: ['subjectId', 'careSubjectId', 'idSujeito', 'id'] },
      { targetKey: 'partyId', aliases: ['partyId', 'customerId', 'clientId', 'ownerPartyId'] },
      { targetKey: 'phone', aliases: PHONE_ALIASES },
      {
        targetKey: 'subjectKind',
        aliases: ['subjectKind', 'kind', 'tipo'],
        valueAliases: CARE_SUBJECT_KIND_VALUE_ALIASES,
      },
    ],
  },
  care_find_subject: {
    safetyClass: 'A',
    rules: [{ targetKey: 'subjectId', aliases: ['subjectId', 'careSubjectId', 'idSujeito', 'id'] }],
  },
  care_get_subject_summary: {
    safetyClass: 'A',
    rules: [{ targetKey: 'subjectId', aliases: ['subjectId', 'careSubjectId', 'idSujeito', 'id'] }],
  },
  clinical_create_anamnesis: {
    safetyClass: 'A',
    rules: [{ targetKey: 'careSubjectId', aliases: ['careSubjectId', 'subjectId', 'idSujeito'] }],
  },
  clinical_add_evolution_note: {
    safetyClass: 'A',
    rules: [
      { targetKey: 'careSubjectId', aliases: ['careSubjectId', 'subjectId', 'idSujeito'] },
      { targetKey: 'body', aliases: ['body', 'note', 'evolutionNote', 'observacao'] },
    ],
  },
  clinical_list_subject_history: {
    safetyClass: 'A',
    rules: [{ targetKey: 'careSubjectId', aliases: ['careSubjectId', 'subjectId', 'idSujeito'] }],
  },
  clinical_get_latest_evolution: {
    safetyClass: 'A',
    rules: [{ targetKey: 'careSubjectId', aliases: ['careSubjectId', 'subjectId', 'idSujeito'] }],
  },
  clinical_open_encounter: {
    safetyClass: 'A',
    rules: [
      { targetKey: 'partyId', aliases: ['partyId', 'customerId', 'clientId'] },
      { targetKey: 'careSubjectId', aliases: ['careSubjectId', 'subjectId', 'idSujeito'] },
    ],
  },
  clinical_close_encounter: {
    safetyClass: 'A',
    rules: [{ targetKey: 'encounterId', aliases: ['encounterId', 'idEncontro', 'id'] }],
  },
  package_sell_to_party: {
    safetyClass: 'A',
    rules: [
      { targetKey: 'partyId', aliases: ['partyId', 'customerId', 'clientId'] },
      { targetKey: 'packageName', aliases: ['packageName', 'packName', 'nomePacote'] },
    ],
  },
  package_get_balance: {
    safetyClass: 'A',
    rules: [{ targetKey: 'packageSaleId', aliases: ['packageSaleId', 'saleId', 'idVendaPacote'] }],
  },
  attendance_register_session: {
    safetyClass: 'A',
    rules: [
      { targetKey: 'partyId', aliases: ['partyId', 'customerId', 'clientId'] },
      { targetKey: 'packageSaleId', aliases: ['packageSaleId', 'saleId', 'idVendaPacote'] },
    ],
  },
  attendance_list_by_party: {
    safetyClass: 'A',
    rules: [{ targetKey: 'partyId', aliases: ['partyId', 'customerId', 'clientId'] }],
  },
  attendance_list_by_package_sale: {
    safetyClass: 'A',
    rules: [{ targetKey: 'packageSaleId', aliases: ['packageSaleId', 'saleId', 'idVendaPacote'] }],
  },
  attendance_get_party_care_summary: {
    safetyClass: 'A',
    rules: [{ targetKey: 'partyId', aliases: ['partyId', 'customerId', 'clientId'] }],
  },
  service_catalog_create_item: {
    safetyClass: 'A',
    rules: [{ targetKey: 'name', aliases: ['name', 'serviceName', 'nomeServico'] }],
  },
  sales_create_service_order: {
    safetyClass: 'A',
    rules: [{ targetKey: 'partyId', aliases: ['partyId', 'customerId', 'clientId'] }],
  },
  sales_add_service_item: {
    safetyClass: 'A',
    rules: [{ targetKey: 'orderId', aliases: ['orderId', 'serviceOrderId', 'idPedido'] }],
  },
  sales_mark_order_paid: {
    safetyClass: 'A',
    rules: [{ targetKey: 'orderId', aliases: ['orderId', 'serviceOrderId', 'idPedido'] }],
  },
  sales_get_customer_purchase_history: {
    safetyClass: 'A',
    rules: [{ targetKey: 'partyId', aliases: ['partyId', 'customerId', 'clientId'] }],
  },
  github_read_pr: {
    safetyClass: 'A',
    rules: [
      { targetKey: 'owner', aliases: ['owner', 'repoOwner', 'org'] },
      { targetKey: 'repo', aliases: ['repo', 'repository', 'repoName'] },
    ],
  },
  github_read_diff: {
    safetyClass: 'A',
    rules: [
      { targetKey: 'owner', aliases: ['owner', 'repoOwner', 'org'] },
      { targetKey: 'repo', aliases: ['repo', 'repository', 'repoName'] },
    ],
  },
  github_comment_pr: {
    safetyClass: 'A',
    rules: [
      { targetKey: 'owner', aliases: ['owner', 'repoOwner', 'org'] },
      { targetKey: 'repo', aliases: ['repo', 'repository', 'repoName'] },
      { targetKey: 'body', aliases: ['body', 'comment', 'mensagem'] },
    ],
  },
  github_list_changed_files: {
    safetyClass: 'A',
    rules: [
      { targetKey: 'owner', aliases: ['owner', 'repoOwner', 'org'] },
      { targetKey: 'repo', aliases: ['repo', 'repository', 'repoName'] },
    ],
  },
  github_get_issue: {
    safetyClass: 'A',
    rules: [
      { targetKey: 'owner', aliases: ['owner', 'repoOwner', 'org'] },
      { targetKey: 'repo', aliases: ['repo', 'repository', 'repoName'] },
    ],
  },
  schedule_set_availability: {
    safetyClass: 'A',
    rules: [
      { targetKey: 'startsAt', aliases: ['startsAt', 'startAt', 'inicio', 'inicioEm'] },
      { targetKey: 'endsAt', aliases: ['endsAt', 'endAt', 'fim', 'fimEm'] },
    ],
  },
  schedule_create_appointment: {
    safetyClass: 'A',
    rules: [
      { targetKey: 'partyId', aliases: ['partyId', 'customerId', 'clientId'] },
      { targetKey: 'startsAt', aliases: ['startsAt', 'startAt', 'inicio', 'inicioEm'] },
      { targetKey: 'endsAt', aliases: ['endsAt', 'endAt', 'fim', 'fimEm'] },
      { targetKey: 'remindAt', aliases: ['remindAt', 'reminderAt', 'lembrarEm'] },
    ],
  },
  schedule_reschedule_appointment: {
    safetyClass: 'A',
    rules: [
      { targetKey: 'appointmentId', aliases: ['appointmentId', 'agendamentoId', 'id'] },
      { targetKey: 'startsAt', aliases: ['startsAt', 'startAt', 'inicio', 'inicioEm'] },
      { targetKey: 'endsAt', aliases: ['endsAt', 'endAt', 'fim', 'fimEm'] },
      { targetKey: 'remindAt', aliases: ['remindAt', 'reminderAt', 'lembrarEm'] },
    ],
  },
  schedule_list_agenda_by_date: {
    safetyClass: 'A',
    rules: [{ targetKey: 'date', aliases: ['date', 'day', 'dia'] }],
  },
  schedule_get_availability: {
    safetyClass: 'A',
    rules: [{ targetKey: 'date', aliases: ['date', 'day', 'dia'] }],
  },
};

function firstNonEmptyString(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function normalizeRuleValue(rule: TActionFieldNormalizationRule, rawValue: string): string {
  if (!rule.valueAliases) return rawValue;
  const mapped = rule.valueAliases[rawValue.toLowerCase()];
  return mapped ?? rawValue;
}

function normalizeByActionRules(actionId: string, input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const cfg = ACTION_NORMALIZATION_CONFIGS[actionId];
  if (!cfg || cfg.rules.length === 0) return input;
  /**
   * Loop 98.7 — matriz de segurança:
   * Classe A: normalização automática permitida.
   * Classe B/C: sem auto-normalização por omissão (exige política explícita futura).
   */
  if (cfg.safetyClass !== 'A') return input;

  const record = input as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...record };

  for (const rule of cfg.rules) {
    const value = firstNonEmptyString(record, rule.aliases);
    if (value) {
      normalized[rule.targetKey] = normalizeRuleValue(rule, value);
    }
  }
  return normalized;
}

export function normalizeBusinessActionInput(actionId: string, input: unknown): unknown {
  return normalizeByActionRules(actionId, input);
}

export function getActionNormalizationSafetyClass(actionId: string): TActionNormalizationSafetyClass {
  return ACTION_NORMALIZATION_CONFIGS[actionId]?.safetyClass ?? 'C';
}
