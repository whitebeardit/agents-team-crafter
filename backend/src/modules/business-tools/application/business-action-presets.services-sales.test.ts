import { describe, expect, it } from '@jest/globals';
import { getBusinessActionPreset } from './business-action-presets.js';

describe('business-action-presets services/sales (Loop 104)', () => {
  it('defines explicit schema for service catalog actions', () => {
    const createItem = getBusinessActionPreset('service_catalog_create_item');
    const listItems = getBusinessActionPreset('service_catalog_list_items');

    expect((createItem?.inputSchema as { required?: string[] }).required).toEqual(['name', 'unitPrice']);
    expect((listItems?.inputSchema as { required?: string[] }).required).toEqual([]);
  });

  it('defines explicit schema for service sales lifecycle actions', () => {
    const createOrder = getBusinessActionPreset('sales_create_service_order');
    const addItem = getBusinessActionPreset('sales_add_service_item');
    const markPaid = getBusinessActionPreset('sales_mark_order_paid');
    const history = getBusinessActionPreset('sales_get_customer_purchase_history');
    const topServices = getBusinessActionPreset('sales_top_services');
    const totalPaid = getBusinessActionPreset('sales_total_paid_by_service');

    expect((createOrder?.inputSchema as { required?: string[] }).required).toEqual(['partyId', 'lines']);
    expect((addItem?.inputSchema as { required?: string[] }).required).toEqual(['orderId', 'line']);
    expect((markPaid?.inputSchema as { required?: string[] }).required).toEqual(['orderId']);
    expect((history?.inputSchema as { required?: string[] }).required).toEqual(['partyId']);
    expect((topServices?.inputSchema as { required?: string[] }).required).toEqual([]);
    expect((totalPaid?.inputSchema as { required?: string[] }).required).toEqual([]);
  });
});
