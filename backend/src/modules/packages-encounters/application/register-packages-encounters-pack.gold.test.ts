import { describe, expect, it, jest } from '@jest/globals';
import { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import { registerPackagesEncountersPack } from './register-packages-encounters-pack.js';
import type { PackageSaleRepository } from '../infra/package-sale.repository.js';
import type { EncounterRepository } from '../infra/encounter.repository.js';
import type { PartyRepository } from '../../crm/infra/party.repository.js';
import type { CareSubjectRepository } from '../../care/infra/care-subject.repository.js';

describe('registerPackagesEncountersPack — packages_encounters_gold_gate', () => {
  it('exposes packages_encounters_gold_gate with deterministic contract', async () => {
    const registry = new BusinessToolRegistry();
    const packages = {
      goldGateSnapshot: jest.fn(async () => ({
        totalSales: 1,
        fullyConsumedSales: 0,
        activeSales: 1,
        unitsTotal: 10,
        unitsUsed: 2,
        unitsRemaining: 8,
      })),
    } as unknown as PackageSaleRepository;
    const encounters = {
      goldGateSnapshot: jest.fn(async () => ({
        totalEncounters: 1,
        packageLinkedEncounters: 1,
        totalDurationMinutes: 50,
        avgDurationMinutes: 50,
      })),
    } as unknown as EncounterRepository;
    const parties = {} as PartyRepository;
    const careSubjects = {} as CareSubjectRepository;

    registerPackagesEncountersPack(registry, packages, encounters, parties, careSubjects);
    const gate = registry.get('packages_encounters_gold_gate');
    expect(gate).toBeDefined();
    const out = await gate!({
      workspaceId: '507f1f77bcf86cd799439011',
      input: {},
    });
    expect(packages.goldGateSnapshot).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(encounters.goldGateSnapshot).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(out).toMatchObject({
      approved: true,
      criteria: expect.any(Array),
      blockingCriteria: expect.any(Array),
      snapshot: expect.any(Object),
    });
  });
});
