import { describe, expect, it } from '@jest/globals';
import { buildSpecialistSystemInstruction } from './build-specialist-system-instruction.js';

describe('buildSpecialistSystemInstruction', () => {
  it('merges base instruction with mission, skills, and security', () => {
    const text = buildSpecialistSystemInstruction({
      systemInstruction: 'Base prompt.',
      goal: 'Ship quality answers.',
      responsibilities: ['A', 'B'],
      skills: ['sql', 'ux'],
      security: { accessLevel: 'read', requiresApproval: true },
    });
    expect(text).toContain('Base prompt.');
    expect(text).toContain('## Objective');
    expect(text).toContain('Ship quality answers.');
    expect(text).toContain('## Responsibilities');
    expect(text).toContain('- A');
    expect(text).toContain('## Skills tags');
    expect(text).toContain('sql, ux');
    expect(text).toContain('read');
    expect(text).toContain('## Tool contract policy (Loop 98.5)');
    expect(text).toContain('MISSING_REQUIRED_FIELDS');
    expect(text).toContain('EXECUTION_ERROR');
    expect(text).toContain('UNKNOWN_ACTION');
    expect(text).toContain('crm_create_party');
    expect(text).toContain('name');
    expect(text).toContain('phone');
    expect(text).toContain('schedule_create_appointment');
    expect(text).toContain('Guardrail agendamento');
    expect(text).toContain('patient_operational_overview');
    expect(text).toContain('package_list_by_party');
    expect(text).toContain('Guardrail pacotes');
    expect(text).toContain('Não confundir listagem com saldo pontual');
    expect(text).toContain('Não pedir IDs internos');
    expect(text).toContain('opções humanas numeradas (1..N)');
    expect(text).toContain('verification.found=true');
  });

  it('appends knowledge appendix when provided', () => {
    const text = buildSpecialistSystemInstruction(
      { systemInstruction: 'X' },
      '## Knowledge sources linked to this agent\n- **KB** (document): desc',
    );
    expect(text).toContain('X');
    expect(text).toContain('## Knowledge sources linked');
  });
});
