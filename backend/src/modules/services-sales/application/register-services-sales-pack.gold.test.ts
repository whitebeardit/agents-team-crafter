import { describe, expect, it, jest } from '@jest/globals';
import { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import { registerServicesSalesPack } from './register-services-sales-pack.js';
import type { ServiceCatalogRepository } from '../infra/service-catalog.repository.js';
import type { ServiceOrderRepository } from '../infra/service-order.repository.js';

describe('registerServicesSalesPack — sales_gold_gate', () => {
  it('exposes sales_gold_gate with deterministic contract', async () => {
    const registry = new BusinessToolRegistry();
    const catalog = {
      list: jest.fn(async () => [{ id: 'svc-1', name: 'Consulta', unitPrice: 100, currency: 'BRL' }]),
    } as unknown as ServiceCatalogRepository;
    const orders = {
      goldGateSummary: jest.fn(async () => ({
        approved: false,
        evaluatedAt: '2026-04-14T00:00:00.000Z',
        criteria: [{ code: 'sales_has_paid_orders', passed: false, detail: 'sem pagos' }],
        blockingCriteria: [{ code: 'sales_has_paid_orders', passed: false, detail: 'sem pagos' }],
        snapshot: {
          catalogCount: 1,
          totalOrders: 1,
          openOrders: 1,
          paidOrders: 0,
          paidServices: 0,
          grossPaid: 0,
        },
      })),
    } as unknown as ServiceOrderRepository;

    registerServicesSalesPack(registry, catalog, orders);
    const gate = registry.get('sales_gold_gate');
    expect(gate).toBeDefined();
    const out = await gate!({
      workspaceId: '507f1f77bcf86cd799439011',
      input: {},
    });
    expect(catalog.list).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 1_000);
    expect(orders.goldGateSummary).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 1);
    expect(out).toMatchObject({
      approved: false,
      criteria: expect.any(Array),
      blockingCriteria: expect.any(Array),
      snapshot: expect.any(Object),
    });
  });
});
