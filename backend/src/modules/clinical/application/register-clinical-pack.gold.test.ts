import { describe, expect, it, jest } from '@jest/globals';
import { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import { registerClinicalPack } from './register-clinical-pack.js';
import type { ClinicalRepository } from '../infra/clinical.repository.js';
import type { PartyRepository } from '../../crm/infra/party.repository.js';

describe('registerClinicalPack — clinical_gold_gate', () => {
  it('exposes clinical_gold_gate with deterministic contract', async () => {
    const registry = new BusinessToolRegistry();
    const clinical = {
      goldGateSummary: jest.fn(async () => ({
        approved: false,
        evaluatedAt: '2026-04-14T00:00:00.000Z',
        criteria: [{ code: 'clinical_has_anamnesis', passed: false, detail: 'sem anamnese' }],
        blockingCriteria: [{ code: 'clinical_has_anamnesis', passed: false, detail: 'sem anamnese' }],
        snapshot: {
          anamnesisCount: 0,
          structuredAnamnesisCount: 0,
          evolutionCount: 0,
          totalEncounters: 0,
          closedEncounters: 0,
          openEncounters: 0,
        },
      })),
    } as unknown as ClinicalRepository;

    registerClinicalPack(registry, clinical, {} as PartyRepository);
    const gate = registry.get('clinical_gold_gate');
    expect(gate).toBeDefined();
    const out = await gate!({
      workspaceId: '507f1f77bcf86cd799439011',
      input: {},
    });
    expect(clinical.goldGateSummary).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(out).toMatchObject({
      approved: false,
      criteria: expect.any(Array),
      blockingCriteria: expect.any(Array),
      snapshot: expect.any(Object),
    });
  });
});
