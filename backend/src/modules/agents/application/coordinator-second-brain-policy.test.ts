import { describe, expect, it } from '@jest/globals';
import {
  COORDINATOR_SECOND_BRAIN_POLICY_TEXT,
  ensureCoordinatorSecondBrainPolicy,
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
});
