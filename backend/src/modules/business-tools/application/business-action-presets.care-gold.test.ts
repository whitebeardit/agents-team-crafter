import { describe, expect, it } from '@jest/globals';
import { getBusinessActionPreset } from './business-action-presets.js';

describe('business-action-presets care (Loop 126)', () => {
  it('defines explicit schema for care lifecycle actions and gold gate', () => {
    const createSubject = getBusinessActionPreset('care_create_subject');
    const createPatient = getBusinessActionPreset('care_create_patient');
    const updateSubject = getBusinessActionPreset('care_update_subject');
    const findSubject = getBusinessActionPreset('care_find_subject');
    const summary = getBusinessActionPreset('care_get_subject_summary');
    const goldGate = getBusinessActionPreset('care_gold_gate');

    expect((createSubject?.inputSchema as { required?: string[] }).required).toEqual([
      'partyId',
      'name',
      'subjectKind',
    ]);
    expect((createPatient?.inputSchema as { required?: string[] }).required).toEqual(['name']);
    expect((updateSubject?.inputSchema as { required?: string[] }).required).toEqual(['subjectId']);
    expect((findSubject?.inputSchema as { required?: string[] }).required).toEqual(['subjectId']);
    expect((summary?.inputSchema as { required?: string[] }).required).toEqual(['subjectId']);
    expect((goldGate?.inputSchema as { required?: string[] }).required).toEqual([]);
  });
});
