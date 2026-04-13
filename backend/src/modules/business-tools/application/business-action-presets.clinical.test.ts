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

    expect((openEncounter?.inputSchema as { required?: string[] }).required).toEqual([
      'partyId',
      'careSubjectId',
    ]);
    expect((closeEncounter?.inputSchema as { required?: string[] }).required).toEqual(['encounterId']);
  });
});
