import { describe, expect, it, jest } from '@jest/globals';
import { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import { registerCarePack } from './register-care-pack.js';
import type { CareSubjectRepository } from '../infra/care-subject.repository.js';

describe('registerCarePack — care_gold_gate', () => {
  it('exposes care_gold_gate with deterministic contract', async () => {
    const registry = new BusinessToolRegistry();
    const care = {
      goldGateSummary: jest.fn(async () => ({
        approved: false,
        evaluatedAt: '2026-04-14T00:00:00.000Z',
        criteria: [{ code: 'care_has_subjects', passed: false, detail: 'sem sujeitos' }],
        blockingCriteria: [{ code: 'care_has_subjects', passed: false, detail: 'sem sujeitos' }],
        snapshot: {
          totalSubjects: 0,
          subjectsWithNotes: 0,
          partiesWithSubjects: 0,
          avgSubjectsPerParty: 0,
          kinds: {},
        },
      })),
    } as unknown as CareSubjectRepository;

    registerCarePack(registry, care);
    const gate = registry.get('care_gold_gate');
    expect(gate).toBeDefined();
    const out = await gate!({
      workspaceId: '507f1f77bcf86cd799439011',
      input: {},
    });
    expect(care.goldGateSummary).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(out).toMatchObject({
      approved: false,
      criteria: expect.any(Array),
      blockingCriteria: expect.any(Array),
      snapshot: expect.any(Object),
    });
  });
});
