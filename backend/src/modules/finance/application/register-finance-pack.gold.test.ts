import { describe, expect, it, jest } from '@jest/globals';
import { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import { registerFinancePack } from './register-finance-pack.js';
import type { FinanceRepository } from '../infra/finance.repository.js';

describe('registerFinancePack — finance_gold_gate', () => {
  it('exposes finance_gold_gate with deterministic contract', async () => {
    const registry = new BusinessToolRegistry();
    const finance = {
      goldGateSummary: jest.fn(async () => ({
        approved: false,
        evaluatedAt: '2026-04-14T00:00:00.000Z',
        criteria: [{ code: 'finance_has_open_titles', passed: false, detail: 'sem títulos' }],
        blockingCriteria: [{ code: 'finance_has_open_titles', passed: false, detail: 'sem títulos' }],
        snapshot: { openReceivables: 0, openPayables: 0, overdueReceivables: 0, overduePayables: 0 },
      })),
    } as unknown as FinanceRepository;

    registerFinancePack(registry, finance);
    const gate = registry.get('finance_gold_gate');
    expect(gate).toBeDefined();
    const out = await gate!({
      workspaceId: '507f1f77bcf86cd799439011',
      input: {},
    });
    expect(finance.goldGateSummary).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(out).toMatchObject({
      approved: false,
      criteria: expect.any(Array),
      blockingCriteria: expect.any(Array),
      snapshot: expect.any(Object),
    });
  });
});
