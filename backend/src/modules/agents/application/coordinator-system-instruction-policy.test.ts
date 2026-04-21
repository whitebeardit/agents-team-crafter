import { describe, expect, it } from '@jest/globals';
import {
  COORDINATOR_TOOL_CONTRACT_POLICY_TEXT,
  ensureCoordinatorSystemInstructionPolicy,
} from './coordinator-system-instruction-policy.js';

describe('coordinator-system-instruction-policy', () => {
  it('aplica politica obrigatoria quando base estiver vazia', () => {
    const out = ensureCoordinatorSystemInstructionPolicy();
    expect(out).toContain('Política obrigatória para uso de tools');
    expect(out).toContain('campos obrigatórios');
    expect(out).toMatch(/especialistas por nome e dom[ií]nio/i);
  });

  it('anexa politica sem duplicar o texto base', () => {
    const out = ensureCoordinatorSystemInstructionPolicy('Você é um coordenador especialista em operações.');
    expect(out).toContain('Você é um coordenador especialista em operações.');
    expect(out).toContain('COORDINATOR_TOOL_CONTRACT_POLICY_V1');
  });

  it('não duplica política quando já presente', () => {
    const once = ensureCoordinatorSystemInstructionPolicy('Base X');
    const twice = ensureCoordinatorSystemInstructionPolicy(once);
    const markerMatches = twice.match(/COORDINATOR_TOOL_CONTRACT_POLICY_V1/g) ?? [];
    expect(markerMatches).toHaveLength(1);
    expect(twice).toContain(COORDINATOR_TOOL_CONTRACT_POLICY_TEXT.trim().split('\n')[0] ?? '');
  });
});

