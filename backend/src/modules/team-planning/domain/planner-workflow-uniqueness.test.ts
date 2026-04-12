import { describe, expect, it } from '@jest/globals';
import {
  assertSpecialistWorkflowOwnership,
  formatWorkflowConflictsForMessage,
  getSpecialistWorkflowConflicts,
} from './planner-workflow-uniqueness.js';

describe('planner-workflow-uniqueness (Loop 86)', () => {
  it('lista conflitos case-insensitive e ignora coordenador', () => {
    const c = getSpecialistWorkflowConflicts([
      { role: 'coordinator', name: 'C', workflowKey: 'coordination' },
      { role: 'specialist', name: 'A', workflowKey: 'CRM' },
      { role: 'specialist', name: 'B', workflowKey: 'crm' },
    ]);
    expect(c).toHaveLength(1);
    expect(c[0]!.workflowKey).toBe('CRM');
    expect(c[0]!.specialistNames.sort()).toEqual(['A', 'B']);
  });

  it('sem duplicata retorna lista vazia', () => {
    expect(
      getSpecialistWorkflowConflicts([
        { role: 'specialist', name: 'A', workflowKey: 'a' },
        { role: 'specialist', name: 'B', workflowKey: 'b' },
      ]),
    ).toHaveLength(0);
  });

  it('formatWorkflowConflictsForMessage', () => {
    expect(
      formatWorkflowConflictsForMessage([{ workflowKey: 'x', specialistNames: ['A', 'B'] }]),
    ).toBe('x (A e B)');
  });

  it('assertSpecialistWorkflowOwnership lança quando há conflito', () => {
    expect(() =>
      assertSpecialistWorkflowOwnership([
        { role: 'specialist', name: 'A', workflowKey: 'dup' },
        { role: 'specialist', name: 'B', workflowKey: 'dup' },
      ]),
    ).toThrow(/VALIDATION_ERROR|workflow/i);
  });
});
