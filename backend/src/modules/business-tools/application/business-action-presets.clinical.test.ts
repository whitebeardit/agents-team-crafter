import { describe, expect, it } from '@jest/globals';
import { getBusinessActionPreset } from './business-action-presets.js';

describe('business-action-presets clinical (Loop 102)', () => {
  it('defines explicit schema for clinical subject-based actions', () => {
    const createAnamnesis = getBusinessActionPreset('clinical_create_anamnesis');
    const addEvolution = getBusinessActionPreset('clinical_add_evolution_note');
    const listHistory = getBusinessActionPreset('clinical_list_subject_history');
    const latestEvolution = getBusinessActionPreset('clinical_get_latest_evolution');

    expect((createAnamnesis?.inputSchema as { required?: string[] }).required).toEqual(['careSubjectId']);
    expect((addEvolution?.inputSchema as { required?: string[] }).required).toEqual([
      'careSubjectId',
      'body',
    ]);
    expect((listHistory?.inputSchema as { required?: string[] }).required).toEqual(['careSubjectId']);
    expect((latestEvolution?.inputSchema as { required?: string[] }).required).toEqual(['careSubjectId']);
    expect((createAnamnesis?.inputSchema as { properties?: Record<string, unknown> }).properties).toHaveProperty(
      'content',
    );
    expect(createAnamnesis?.slotFillingPromptHint).toContain('careSubjectId');
  });

  it('defines explicit schema for encounter lifecycle actions', () => {
    const openEncounter = getBusinessActionPreset('clinical_open_encounter');
    const closeEncounter = getBusinessActionPreset('clinical_close_encounter');
    const goldGate = getBusinessActionPreset('clinical_gold_gate');

    expect((openEncounter?.inputSchema as { required?: string[] }).required).toEqual([
      'partyId',
      'careSubjectId',
    ]);
    expect((closeEncounter?.inputSchema as { required?: string[] }).required).toEqual(['encounterId']);
    expect((goldGate?.inputSchema as { required?: string[] }).required).toEqual([]);
  });

  it('publishes clinic admin diagnostics actions with restricted exposure', () => {
    const auditPatient = getBusinessActionPreset('clinic_audit_patient_integrity');
    const auditAppointments = getBusinessActionPreset('clinic_audit_appointments_integrity');
    const repairPatient = getBusinessActionPreset('clinic_repair_patient_links');

    expect(auditPatient?.toolKind).toBe('admin_diagnostic');
    expect(auditPatient?.uiExposureMode).toBe('advanced');
    expect((auditPatient?.inputSchema as { required?: string[] }).required).toEqual(['phone']);

    expect(auditAppointments?.toolKind).toBe('admin_diagnostic');
    expect(auditAppointments?.uiExposureMode).toBe('advanced');

    expect(repairPatient?.toolKind).toBe('admin_diagnostic');
    expect(repairPatient?.uiExposureMode).toBe('hidden');
    expect(repairPatient?.requiresConfirmation).toBe(true);
  });
});
