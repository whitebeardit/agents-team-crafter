import { describe, expect, it, jest } from '@jest/globals';
import { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import { registerPackagesEncountersPack } from './register-packages-encounters-pack.js';
import type { PackageSaleRepository } from '../infra/package-sale.repository.js';
import type { EncounterRepository } from '../infra/encounter.repository.js';
import type { PartyRepository } from '../../crm/infra/party.repository.js';
import type { CareSubjectRepository } from '../../care/infra/care-subject.repository.js';
import type { PackageConsumptionRepository } from '../infra/package-consumption.repository.js';

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
    const parties = {
      findById: jest.fn(async (_ws: string, id: string) =>
        id ? { id, displayName: 'stub' } : undefined,
      ),
    } as unknown as PartyRepository;
    const careSubjects = {} as CareSubjectRepository;
    const consumptions = { createOnce: jest.fn() } as unknown as PackageConsumptionRepository;

    registerPackagesEncountersPack(registry, packages, encounters, parties, careSubjects, consumptions);
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

  it('lists package sales by party with eligibility summary', async () => {
    const registry = new BusinessToolRegistry();
    const packages = {
      listByParty: jest.fn(async () => [
        { id: 'sale-1', partyId: 'party-1', packageName: 'Pacote A', unitsTotal: 4, unitsUsed: 1, remaining: 3 },
        { id: 'sale-2', partyId: 'party-1', packageName: 'Pacote B', unitsTotal: 2, unitsUsed: 2, remaining: 0 },
      ]),
      goldGateSnapshot: jest.fn(async () => ({
        totalSales: 0,
        fullyConsumedSales: 0,
        activeSales: 0,
        unitsTotal: 0,
        unitsUsed: 0,
        unitsRemaining: 0,
      })),
    } as unknown as PackageSaleRepository;
    const encounters = {
      goldGateSnapshot: jest.fn(async () => ({
        totalEncounters: 0,
        packageLinkedEncounters: 0,
        totalDurationMinutes: 0,
        avgDurationMinutes: 0,
      })),
    } as unknown as EncounterRepository;
    const parties = {
      findById: jest.fn(async (_ws: string, id: string) =>
        id ? { id, displayName: 'stub' } : undefined,
      ),
    } as unknown as PartyRepository;
    const careSubjects = {} as CareSubjectRepository;
    const consumptions = { createOnce: jest.fn() } as unknown as PackageConsumptionRepository;

    registerPackagesEncountersPack(registry, packages, encounters, parties, careSubjects, consumptions);
    const list = registry.get('package_list_by_party');
    expect(list).toBeDefined();

    const out = (await list!({
      workspaceId: '507f1f77bcf86cd799439011',
      input: { partyId: 'party-1' },
    })) as {
      eligible: boolean;
      eligiblePackageSaleIds: string[];
      ineligibleReason: string | null;
      packageSales: unknown[];
    };

    expect(packages.listByParty).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'party-1');
    expect(out.eligible).toBe(true);
    expect(out.eligiblePackageSaleIds).toEqual(['sale-1']);
    expect(out.ineligibleReason).toBeNull();
    expect(out.packageSales).toHaveLength(2);
  });

  it('package_list_by_party resolves partyId from phone when unique', async () => {
    const registry = new BusinessToolRegistry();
    const packages = {
      listByParty: jest.fn(async () => []),
      goldGateSnapshot: jest.fn(async () => ({
        totalSales: 0,
        fullyConsumedSales: 0,
        activeSales: 0,
        unitsTotal: 0,
        unitsUsed: 0,
        unitsRemaining: 0,
      })),
    } as unknown as PackageSaleRepository;
    const encounters = {
      goldGateSnapshot: jest.fn(async () => ({
        totalEncounters: 0,
        packageLinkedEncounters: 0,
        totalDurationMinutes: 0,
        avgDurationMinutes: 0,
      })),
    } as unknown as EncounterRepository;
    const parties = {
      findByEmailOrPhone: jest.fn(async () => [{ id: 'party-from-phone' }]),
      findById: jest.fn(async () => ({ id: 'party-from-phone', displayName: 'X' })),
    } as unknown as PartyRepository;
    const careSubjects = {} as CareSubjectRepository;
    const consumptions = { createOnce: jest.fn() } as unknown as PackageConsumptionRepository;

    registerPackagesEncountersPack(registry, packages, encounters, parties, careSubjects, consumptions);
    const list = registry.get('package_list_by_party');
    await list!({
      workspaceId: '507f1f77bcf86cd799439011',
      input: { phone: '+5599988877766' },
    });

    expect(parties.findByEmailOrPhone).toHaveBeenCalled();
    expect(packages.listByParty).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'party-from-phone');
  });
});
