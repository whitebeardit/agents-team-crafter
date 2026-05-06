/**
 * Mapeia identificadores de pack (campo `requiredPacks` do planner) para actionIds registados no BusinessToolRegistry.
 * Extensível: novos packs entram aqui e no prompt do planner (`TEAM_PLANNER_SYSTEM_PROMPT`).
 */
export const PLANNER_PACK_TO_ACTION_IDS: Readonly<Record<string, readonly string[]>> = {
  crm: [
    'crm_create_party',
    'crm_update_party',
    'crm_delete_party',
    'crm_find_party',
    'crm_get_party_summary',
  ],
  care: [
    'care_create_subject',
    'care_update_subject',
    'care_find_subject',
    'care_get_subject_summary',
  ],
  services_sales: [
    'service_catalog_create_item',
    'service_catalog_list_items',
    'sales_create_service_order',
    'sales_mark_order_paid',
  ],
  packages_encounters: [
    'package_sell_to_party',
    'package_catalog_upsert',
    'package_catalog_list',
    'package_get_balance',
    'package_list_by_party',
    'attendance_register_session',
    'attendance_list_by_party',
    'attendance_get_party_care_summary',
  ],
  clinical: [
    'clinical_create_anamnesis',
    'clinical_add_evolution_note',
    'clinical_list_subject_history',
    'clinical_open_encounter',
  ],
  finance: [
    'finance_create_receivable',
    'finance_create_payable',
    'finance_mark_receivable_paid',
    'finance_list_overdue_receivables',
  ],
  reminders: [
    'schedule_create_reminder',
    'schedule_list_reminders_by_date',
    'schedule_mark_reminder_done',
  ],
  scheduling: [
    'schedule_create_appointment',
    'schedule_complete_appointment',
    'schedule_reschedule_appointment',
    'schedule_list_agenda_by_date',
    'schedule_get_availability',
    'schedule_list_appointments_by_party',
    'patient_operational_overview',
  ],
  github_ops: [
    'github_read_pr',
    'github_list_changed_files',
    'github_get_issue',
  ],
  clinic_ops: [
    'clinic_context_get_current_patient',
    'clinic_context_update_current_patient',
    'team_delegate_to_patient_specialist',
    'team_delegate_to_package_specialist',
    'team_delegate_to_scheduling_specialist',
    'team_delegate_to_attendance_specialist',
    'team_delegate_to_finance_specialist',
    'team_delegate_to_admin_audit_specialist',
    'clinic_create_patient',
    'clinic_sell_default_package',
    'clinic_list_patient_packages',
    'clinic_get_eligible_package',
    'clinic_schedule_session_by_phone',
    'clinic_reschedule_session_by_context',
    'clinic_cancel_session_by_context',
    'clinic_list_patient_sessions',
    'clinic_list_sessions_by_local_date',
    'clinic_register_attendance_by_phone_and_time',
    'clinic_add_evolution_to_existing_attendance',
    'clinic_get_patient_full_snapshot',
    'clinic_create_receivable_for_session',
    'clinic_get_patient_financial_summary',
    'clinic_audit_patient_integrity',
    'clinic_audit_appointments_integrity',
    'clinic_repair_patient_links',
  ],
};

/** Chaves canónicas de pack (mesma ordem que `PLANNER_PACK_TO_ACTION_IDS` para prompts e docs). */
export const PLANNER_PACK_IDS: readonly string[] = Object.freeze(Object.keys(PLANNER_PACK_TO_ACTION_IDS));

export function collectPlannerActionIds(
  requiredTools: string[] | undefined,
  requiredPacks: string[] | undefined,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    const t = id.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  for (const t of requiredTools ?? []) push(t);
  for (const pack of requiredPacks ?? []) {
    const key = pack.trim().toLowerCase();
    const actions = PLANNER_PACK_TO_ACTION_IDS[key];
    if (actions) for (const a of actions) push(a);
  }
  return out;
}

/** Loop 83 — há pelo menos um agente com listas de negócio por agente (não só globais). */
export function hasPerAgentBindHints(
  agents: ReadonlyArray<{ requiredBusinessActionIds?: string[]; requiredPackIds?: string[] }>,
): boolean {
  return agents.some(
    (a) => (a.requiredBusinessActionIds?.length ?? 0) > 0 || (a.requiredPackIds?.length ?? 0) > 0,
  );
}

export type TPlannerAgentBindSlice = {
  role: 'coordinator' | 'specialist';
  requiredBusinessActionIds: string[];
  requiredPackIds: string[];
};

/**
 * Loop 83 — candidatos de `actionId` para bind deste agente.
 * Sem hints por agente: todos herdam o conjunto global (comportamento legado).
 * Com hints: cada agente usa apenas as suas listas (podem ser vazias — ex.: coordenador sem tools de negócio).
 */
export function collectAgentBindActionCandidates(
  agent: TPlannerAgentBindSlice,
  globalRequiredTools: string[] | undefined,
  globalRequiredPacks: string[] | undefined,
  usePerAgentMode: boolean,
): string[] {
  if (!usePerAgentMode) {
    return collectPlannerActionIds(globalRequiredTools, globalRequiredPacks);
  }
  return collectPlannerActionIds(agent.requiredBusinessActionIds, agent.requiredPackIds);
}

function mergeOrderedUniqueActionIds(lists: ReadonlyArray<readonly string[]>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const id of list) {
      const t = id.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/** Pack ids globais + por agente (dedupe, lower-case canónico para lookup em presets). */
export function mergePlannerPackIdsForBind(
  agents: ReadonlyArray<{ requiredPackIds?: string[] }>,
  globalRequiredPacks: string[] | undefined,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string) => {
    const k = raw.trim().toLowerCase();
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(k);
  };
  for (const p of globalRequiredPacks ?? []) push(p);
  for (const a of agents) {
    for (const p of a.requiredPackIds ?? []) push(p);
  }
  return out;
}

export interface IPlannerBindActionUniverse {
  usePerAgentMode: boolean;
  /** União de todos os candidatos (antes do teto). */
  actionIdsFull: string[];
  /** União após teto `maxActions`. */
  actionIds: string[];
  actionIdsTruncated: boolean;
  /** Por agente, intersecção com `actionIds` (pós-teto). */
  perAgentActionIds: string[][];
}

/**
 * Loop 83 — universo de actionIds para preview/execute: legado = lista global repetida por agente;
 * per-agent = união das listas por agente + teto global.
 */
export function computePlannerBindActionUniverse(
  agents: readonly TPlannerAgentBindSlice[],
  globalRequiredTools: string[] | undefined,
  globalRequiredPacks: string[] | undefined,
  maxActions: number,
): IPlannerBindActionUniverse {
  const usePerAgentMode = hasPerAgentBindHints(agents);
  const perAgentRaw = agents.map((a) =>
    collectAgentBindActionCandidates(a, globalRequiredTools, globalRequiredPacks, usePerAgentMode),
  );
  const actionIdsFull = mergeOrderedUniqueActionIds(perAgentRaw);
  const actionIdsTruncated = actionIdsFull.length > maxActions;
  const capped = actionIdsFull.slice(0, maxActions);
  const capSet = new Set(capped);
  const perAgentActionIds = perAgentRaw.map((ids) => ids.filter((id) => capSet.has(id)));
  return {
    usePerAgentMode,
    actionIdsFull,
    actionIds: capped,
    actionIdsTruncated,
    perAgentActionIds,
  };
}

export function actionIdToToolSlug(actionId: string): string {
  const s = actionId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = s ? `ba-${s}` : 'ba-tool';
  return base.slice(0, 80);
}
