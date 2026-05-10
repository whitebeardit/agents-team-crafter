import { describe, expect, it } from '@jest/globals';
import {
  COORDINATOR_DISABLE_SECOND_BRAIN_TOOLS_MARKER,
  COORDINATOR_SECOND_BRAIN_POLICY_TEXT,
  ensureCoordinatorSecondBrainPolicy,
  stripCoordinatorSecondBrainPolicySection,
} from './coordinator-second-brain-policy.js';

describe('ensureCoordinatorSecondBrainPolicy', () => {
  it('appends policy when marker absent', () => {
    const out = ensureCoordinatorSecondBrainPolicy('Coordenador base.');
    expect(out).toContain('Coordenador base.');
    expect(out).toContain('COORDINATOR_SECOND_BRAIN_POLICY_V1');
    expect(out).toContain('second_brain_recall');
  });

  it('is idempotent when marker already present', () => {
    const once = ensureCoordinatorSecondBrainPolicy('X');
    const twice = ensureCoordinatorSecondBrainPolicy(once);
    expect(twice).toBe(once);
  });

  it('returns only policy text for empty base', () => {
    const out = ensureCoordinatorSecondBrainPolicy('');
    expect(out.trim()).toBe(COORDINATOR_SECOND_BRAIN_POLICY_TEXT.trim());
  });

  it('does not append recall policy when disable marker is present', () => {
    const base = `${COORDINATOR_DISABLE_SECOND_BRAIN_TOOLS_MARKER}\n\nCoordenador clinica.`;
    const out = ensureCoordinatorSecondBrainPolicy(base);
    expect(out).toBe(base);
    expect(out).not.toContain('second_brain_recall');
  });

  it('stripCoordinatorSecondBrainPolicySection removes appended recall block', () => {
    const withRecall = `Intro.\n\n[COORDINATOR_SECOND_BRAIN_POLICY_V1]\n## Memória`;
    expect(stripCoordinatorSecondBrainPolicySection(withRecall)).toBe('Intro.');
  });
});
