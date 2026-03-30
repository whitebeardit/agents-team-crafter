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
