export type TBusinessActionGuardProfile = {
  guardProfileId: string;
  title: string;
  description: string;
  appliesToActionIds: string[];
  rulesSummary: string[];
};

const GUARD_PROFILES: Readonly<Record<string, TBusinessActionGuardProfile>> = {
  crm_identity_required_for_subject_operations: {
    guardProfileId: 'crm_identity_required_for_subject_operations',
    title: 'CRM identity required',
    description:
      'Primeira camada de policy: operações sobre sujeitos exigem vínculo CRM (partyId) explícito e coerente.',
    appliesToActionIds: ['care_create_subject', 'care_update_subject', 'clinic_schedule_session'],
    rulesSummary: [
      'Exigir partyId válido antes de operar no sujeito.',
      'Bloquear quando sujeito e partyId não pertencem ao mesmo contexto.',
    ],
  },
  care_subject_context_guard: {
    guardProfileId: 'care_subject_context_guard',
    title: 'Care subject context guard',
    description:
      'Primeira camada de policy para scheduling clínico composto: sessão clínica exige contexto de sujeito e vínculo consistente.',
    appliesToActionIds: ['clinic_schedule_session', 'clinic_reschedule_session', 'clinic_cancel_session'],
    rulesSummary: [
      'Agendamento clínico exige careSubjectId quando aplicável.',
      'Ação composta valida contexto antes de delegar para primitive universal.',
    ],
  },
};

export function getBusinessActionGuardProfile(
  guardProfileId: string,
): TBusinessActionGuardProfile | undefined {
  return GUARD_PROFILES[guardProfileId.trim()];
}

export function listBusinessActionGuardProfiles(): TBusinessActionGuardProfile[] {
  return Object.values(GUARD_PROFILES);
}
