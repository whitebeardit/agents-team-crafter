/**
 * Mapeia identificadores de pack (campo `requiredPacks` do planner) para actionIds registados no BusinessToolRegistry.
 * Extensível: novos packs entram aqui e no prompt do planner (`TEAM_PLANNER_SYSTEM_PROMPT`).
 */
export const PLANNER_PACK_TO_ACTION_IDS: Readonly<Record<string, readonly string[]>> = {
  crm: [
    'crm_create_party',
    'crm_update_party',
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
    'package_get_balance',
    'attendance_register_session',
    'attendance_list_by_party',
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
  ],
  github_ops: [
    'github_read_pr',
    'github_list_changed_files',
    'github_get_issue',
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

export function actionIdToToolSlug(actionId: string): string {
  const s = actionId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = s ? `ba-${s}` : 'ba-tool';
  return base.slice(0, 80);
}
