/**
 * Rótulos PT-BR para `requiredPacks` do team planner.
 * Manter chaves alinhadas a `PLANNER_PACK_IDS` em
 * `backend/src/modules/team-planning/application/planner-pack-presets.ts`.
 */
export const PLANNER_PACK_LABELS_PT: Readonly<Record<string, string>> = {
  crm: "CRM — partes e relacionamentos",
  care: "Care — sujeitos de cuidado",
  services_sales: "Serviços e vendas",
  packages_encounters: "Pacotes e atendimentos",
  clinical: "Registros clínicos",
  finance: "Financeiro",
  reminders: "Lembretes e agenda",
  scheduling: "Agenda e agendamentos",
  github_ops: "GitHub — PRs e issues",
  clinic_ops: "Clínica — operações conversacionais",
}

export function plannerPackLabelPt(packId: string): string {
  const k = packId.trim().toLowerCase()
  return PLANNER_PACK_LABELS_PT[k] ?? packId
}
