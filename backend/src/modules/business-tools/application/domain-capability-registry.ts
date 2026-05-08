import { getBusinessActionPreset } from './business-action-presets.js';

export interface IDomainCapabilityDefinition {
  id: string;
  label: string;
  description: string;
  actionIds: string[];
  dependsOnDomainIds?: string[];
  dependsOnActionIds?: string[];
  dependsOnCatalogTools?: string[];
}

export interface IDomainCapabilitySummary extends IDomainCapabilityDefinition {
  directActionCount: number;
}

export interface IDomainCapabilityResolution {
  requestedDomainIds: string[];
  domainIds: string[];
  actionIds: string[];
  catalogTools: string[];
  dependencies: {
    domainIds: string[];
    actionIds: string[];
    catalogTools: string[];
  };
  actionIdsByDomainId: Record<string, string[]>;
  domainIdsByActionId: Record<string, string[]>;
}

function uniqueOrdered(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export const DOMAIN_CAPABILITY_DEFINITIONS: readonly IDomainCapabilityDefinition[] = Object.freeze([
  {
    id: 'crm',
    label: 'CRM',
    description: 'Cadastros e consulta de pessoas, clientes, pagadores e organizações.',
    actionIds: [
      'crm_create_party',
      'crm_update_party',
      'crm_delete_party',
      'crm_find_party',
      'crm_get_party_summary',
    ],
  },
  {
    id: 'care',
    label: 'Care',
    description: 'Sujeitos de cuidado e histórico operacional de atendimento.',
    actionIds: [
      'care_create_subject',
      'care_update_subject',
      'care_find_subject',
      'care_get_subject_summary',
    ],
    dependsOnDomainIds: ['crm'],
  },
  {
    id: 'services_sales',
    label: 'Serviços e vendas',
    description: 'Catálogo de serviços, ordens de serviço e baixa de vendas.',
    actionIds: [
      'service_catalog_create_item',
      'service_catalog_list_items',
      'sales_create_service_order',
      'sales_mark_order_paid',
    ],
    dependsOnDomainIds: ['crm'],
  },
  {
    id: 'packages_encounters',
    label: 'Pacotes e atendimentos',
    description: 'Venda de pacotes, saldo, sessões e resumo de atendimento.',
    actionIds: [
      'package_sell_to_party',
      'package_catalog_upsert',
      'package_catalog_list',
      'package_get_balance',
      'package_list_by_party',
      'attendance_register_session',
      'attendance_list_by_party',
      'attendance_get_party_care_summary',
    ],
    dependsOnDomainIds: ['crm', 'care'],
  },
  {
    id: 'clinical',
    label: 'Clinical',
    description: 'Prontuário clínico, anamnese, evolução e encontros clínicos.',
    actionIds: [
      'clinical_create_anamnesis',
      'clinical_add_evolution_note',
      'clinical_list_subject_history',
      'clinical_open_encounter',
    ],
    dependsOnDomainIds: ['crm', 'care', 'scheduling'],
  },
  {
    id: 'finance',
    label: 'Finance',
    description: 'Contas a receber, contas a pagar, baixa e inadimplência.',
    actionIds: [
      'finance_create_receivable',
      'finance_create_payable',
      'finance_mark_receivable_paid',
      'finance_find_receivable_by_appointment',
      'finance_list_overdue_receivables',
    ],
    dependsOnDomainIds: ['crm'],
  },
  {
    id: 'reminders',
    label: 'Lembretes',
    description: 'Criação, listagem e conclusão de lembretes operacionais.',
    actionIds: [
      'schedule_create_reminder',
      'schedule_list_reminders_by_date',
      'schedule_mark_reminder_done',
    ],
  },
  {
    id: 'scheduling',
    label: 'Agenda',
    description: 'Compromissos, disponibilidade, reagendamento e visão operacional do paciente.',
    actionIds: [
      'schedule_create_appointment',
      'schedule_complete_appointment',
      'schedule_reschedule_appointment',
      'schedule_list_agenda_by_date',
      'schedule_get_availability',
      'schedule_list_appointments_by_party',
      'patient_operational_overview',
    ],
    dependsOnDomainIds: ['crm'],
    dependsOnCatalogTools: ['calendar_access'],
  },
  {
    id: 'github_ops',
    label: 'GitHub Ops',
    description: 'Leitura de PRs, arquivos alterados e issues do GitHub.',
    actionIds: [
      'github_read_pr',
      'github_list_changed_files',
      'github_get_issue',
    ],
  },
  {
    id: 'clinic_ops',
    label: 'Clínica Gold',
    description: 'Workflow clínico completo com paciente, pacotes, agenda, presença, financeiro e auditoria.',
    actionIds: [
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
    dependsOnDomainIds: ['crm', 'care', 'packages_encounters', 'clinical', 'finance', 'scheduling'],
    dependsOnCatalogTools: ['calendar_access'],
  },
]);

const definitionsById = new Map(DOMAIN_CAPABILITY_DEFINITIONS.map((domain) => [domain.id, domain]));

export function listDomainCapabilities(): IDomainCapabilitySummary[] {
  return DOMAIN_CAPABILITY_DEFINITIONS.map((domain) => ({
    ...domain,
    actionIds: [...domain.actionIds],
    dependsOnDomainIds: [...(domain.dependsOnDomainIds ?? [])],
    dependsOnActionIds: [...(domain.dependsOnActionIds ?? [])],
    dependsOnCatalogTools: [...(domain.dependsOnCatalogTools ?? [])],
    directActionCount: domain.actionIds.length,
  }));
}

export function getDomainCapabilityDefinition(domainId: string): IDomainCapabilityDefinition | undefined {
  return definitionsById.get(domainId.trim().toLowerCase());
}

export function getDomainIdsForActionId(actionId: string): string[] {
  const id = actionId.trim();
  return DOMAIN_CAPABILITY_DEFINITIONS
    .filter((domain) => domain.actionIds.includes(id))
    .map((domain) => domain.id);
}

export function inferDomainIdsFromActionIds(actionIds: readonly string[]): string[] {
  return uniqueOrdered(actionIds.flatMap((actionId) => getDomainIdsForActionId(actionId)));
}

export function resolveDomainCapabilitySelection(domainIds: readonly string[]): IDomainCapabilityResolution {
  const requestedDomainIds = uniqueOrdered(domainIds.map((domainId) => domainId.trim().toLowerCase()));
  const resolvedDomainIds: string[] = [];
  const actionIds: string[] = [];
  const actionDeps: string[] = [];
  const catalogTools: string[] = [];
  const dependencyDomainIds: string[] = [];
  const actionIdsByDomainId: Record<string, string[]> = {};
  const domainIdsByActionId: Record<string, string[]> = {};

  const pushAction = (actionId: string, domainId?: string, dependency = false) => {
    const id = actionId.trim();
    if (!id) return;
    if (!actionIds.includes(id)) actionIds.push(id);
    if (dependency && !actionDeps.includes(id)) actionDeps.push(id);
    if (domainId) {
      actionIdsByDomainId[domainId] = uniqueOrdered([...(actionIdsByDomainId[domainId] ?? []), id]);
      domainIdsByActionId[id] = uniqueOrdered([...(domainIdsByActionId[id] ?? []), domainId]);
    }
    const preset = getBusinessActionPreset(id);
    for (const depActionId of preset?.dependsOnActionIds ?? []) {
      pushAction(depActionId, domainId, true);
    }
    for (const depCatalogTool of preset?.dependsOnCatalogTools ?? []) {
      if (!catalogTools.includes(depCatalogTool)) catalogTools.push(depCatalogTool);
    }
  };

  const visitDomain = (domainId: string, stack: string[] = []) => {
    const id = domainId.trim().toLowerCase();
    if (!id || resolvedDomainIds.includes(id)) return;
    const definition = definitionsById.get(id);
    if (!definition) return;
    if (stack.includes(id)) return;

    resolvedDomainIds.push(id);
    if (!requestedDomainIds.includes(id) && !dependencyDomainIds.includes(id)) dependencyDomainIds.push(id);
    for (const depDomainId of definition.dependsOnDomainIds ?? []) {
      visitDomain(depDomainId, [...stack, id]);
    }
    for (const actionId of definition.actionIds) pushAction(actionId, id);
    for (const depActionId of definition.dependsOnActionIds ?? []) pushAction(depActionId, id, true);
    for (const depCatalogTool of definition.dependsOnCatalogTools ?? []) {
      if (!catalogTools.includes(depCatalogTool)) catalogTools.push(depCatalogTool);
    }
  };

  for (const domainId of requestedDomainIds) visitDomain(domainId);
  if (actionIds.length > 0 && !catalogTools.includes('internal_actions')) catalogTools.unshift('internal_actions');

  return {
    requestedDomainIds,
    domainIds: resolvedDomainIds,
    actionIds,
    catalogTools,
    dependencies: {
      domainIds: dependencyDomainIds,
      actionIds: actionDeps,
      catalogTools,
    },
    actionIdsByDomainId,
    domainIdsByActionId,
  };
}

