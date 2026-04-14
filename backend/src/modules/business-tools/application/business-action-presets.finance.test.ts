import { describe, expect, it } from '@jest/globals';
import { getBusinessActionPreset } from './business-action-presets.js';

describe('business-action-presets finance (Loop 100)', () => {
  it('defines explicit schema for finance payment status actions', () => {
    const markReceivablePaid = getBusinessActionPreset('finance_mark_receivable_paid');
    const markPayablePaid = getBusinessActionPreset('finance_mark_payable_paid');

    expect((markReceivablePaid?.inputSchema as { required?: string[] }).required).toEqual(['receivableId']);
    expect((markPayablePaid?.inputSchema as { required?: string[] }).required).toEqual(['payableId']);
  });

  it('defines explicit empty-object schema for finance read-only aggregate actions', () => {
    const overdueReceivables = getBusinessActionPreset('finance_list_overdue_receivables');
    const overduePayables = getBusinessActionPreset('finance_list_overdue_payables');
    const totalByPayer = getBusinessActionPreset('finance_total_receivable_by_payer');
    const totalByDestination = getBusinessActionPreset('finance_total_payable_by_destination');
    const goldGate = getBusinessActionPreset('finance_gold_gate');

    expect((overdueReceivables?.inputSchema as { required?: string[] }).required).toEqual([]);
    expect((overduePayables?.inputSchema as { required?: string[] }).required).toEqual([]);
    expect((totalByPayer?.inputSchema as { required?: string[] }).required).toEqual([]);
    expect((totalByDestination?.inputSchema as { required?: string[] }).required).toEqual([]);
    expect((goldGate?.inputSchema as { required?: string[] }).required).toEqual([]);
  });
});
