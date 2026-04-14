import type { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import type { ServiceCatalogRepository } from '../infra/service-catalog.repository.js';
import type { ServiceOrderRepository } from '../infra/service-order.repository.js';

export function registerServicesSalesPack(
  registry: BusinessToolRegistry,
  catalog: ServiceCatalogRepository,
  orders: ServiceOrderRepository,
): void {
  registry.register('service_catalog_create_item', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const name = typeof data.name === 'string' ? data.name : '';
    const unitPrice = typeof data.unitPrice === 'number' ? data.unitPrice : Number(data.unitPrice);
    if (!name.trim() || Number.isNaN(unitPrice)) throw new Error('name e unitPrice obrigatorios');
    return catalog.create(workspaceId, {
      name: name.trim(),
      unitPrice,
      currency: typeof data.currency === 'string' ? data.currency : 'BRL',
    });
  });

  registry.register('service_catalog_list_items', async ({ workspaceId }) => ({
    items: await catalog.list(workspaceId),
  }));

  registry.register('sales_create_service_order', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const partyId = typeof data.partyId === 'string' ? data.partyId : '';
    if (!partyId) throw new Error('partyId obrigatorio');
    const linesRaw = data.lines;
    if (!Array.isArray(linesRaw) || linesRaw.length === 0) throw new Error('lines obrigatorio');
    const lines = linesRaw.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        catalogItemId: String(r.catalogItemId ?? ''),
        quantity: Number(r.quantity),
        unitPrice: Number(r.unitPrice),
      };
    });
    return orders.create(workspaceId, partyId, lines);
  });

  registry.register('sales_add_service_item', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const orderId = typeof data.orderId === 'string' ? data.orderId : '';
    if (!orderId) throw new Error('orderId obrigatorio');
    const r = data.line as Record<string, unknown> | undefined;
    if (!r) throw new Error('line obrigatorio');
    const line = {
      catalogItemId: String(r.catalogItemId ?? ''),
      quantity: Number(r.quantity),
      unitPrice: Number(r.unitPrice),
    };
    const u = await orders.addLine(workspaceId, orderId, line);
    if (!u) throw new Error('Pedido nao encontrado ou fechado');
    return u;
  });

  registry.register('sales_mark_order_paid', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const orderId = typeof data.orderId === 'string' ? data.orderId : '';
    if (!orderId) throw new Error('orderId obrigatorio');
    const u = await orders.markPaid(workspaceId, orderId);
    if (!u) throw new Error('Pedido nao encontrado');
    return u;
  });

  registry.register('sales_get_customer_purchase_history', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const partyId = typeof data.partyId === 'string' ? data.partyId : '';
    if (!partyId) throw new Error('partyId obrigatorio');
    return { orders: await orders.listByParty(workspaceId, partyId) };
  });

  registry.register('sales_top_services', async ({ workspaceId }) => ({
    top: await orders.aggregateTopServices(workspaceId),
  }));

  registry.register('sales_total_paid_by_service', async ({ workspaceId }) => ({
    totals: await orders.totalPaidByService(workspaceId),
  }));

  registry.register('sales_gold_gate', async ({ workspaceId }) => {
    const catalogItems = await catalog.list(workspaceId, 1_000);
    return orders.goldGateSummary(workspaceId, catalogItems.length);
  });
}
