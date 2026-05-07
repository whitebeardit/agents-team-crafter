import { describe, expect, it } from '@jest/globals';
import { getBusinessActionPreset } from './business-action-presets.js';
import { validateBusinessActionInput } from './business-action-input-validation.js';

describe('business-action-presets packages/encounters (Loop 103)', () => {
  it('defines explicit schema for package sale actions', () => {
    const sell = getBusinessActionPreset('package_sell_to_party');
    const balance = getBusinessActionPreset('package_get_balance');
    const listByParty = getBusinessActionPreset('package_list_by_party');

    expect((sell?.inputSchema as { required?: string[] }).required).toEqual(['partyId']);
    expect((balance?.inputSchema as { required?: string[] }).required).toEqual(['packageSaleId']);
    expect((listByParty?.inputSchema as { required?: string[] }).required).toEqual(['partyId']);
  });

  it('defines explicit schema for attendance actions', () => {
    const register = getBusinessActionPreset('attendance_register_session');
    const byParty = getBusinessActionPreset('attendance_list_by_party');
    const bySale = getBusinessActionPreset('attendance_list_by_package_sale');
    const summary = getBusinessActionPreset('attendance_get_party_care_summary');
    const goldGate = getBusinessActionPreset('packages_encounters_gold_gate');

    expect((register?.inputSchema as { required?: string[] }).required).toEqual(['partyId']);
    expect((byParty?.inputSchema as { required?: string[] }).required).toEqual(['partyId']);
    expect((bySale?.inputSchema as { required?: string[] }).required).toEqual(['packageSaleId']);
    expect((summary?.inputSchema as { required?: string[] }).required).toEqual(['partyId']);
    expect((goldGate?.inputSchema as { required?: string[] }).required).toEqual([]);
  });

  it('package_sell_to_party validates partyId and either productSlug or manual package fields', () => {
    expect(validateBusinessActionInput('package_sell_to_party', { partyId: 'p1', productSlug: 'standard' })).toEqual({
      ok: true,
    });
    expect(
      validateBusinessActionInput('package_sell_to_party', { phone: '+5511999999999', productSlug: 'standard' }),
    ).toEqual({ ok: true });
    expect(
      validateBusinessActionInput('package_sell_to_party', { partyId: 'p1', packageName: 'X', unitsTotal: 5 }),
    ).toEqual({ ok: true });
    expect(validateBusinessActionInput('package_sell_to_party', { partyId: 'p1' }).ok).toBe(false);
    expect(validateBusinessActionInput('package_sell_to_party', { partyId: 'p1', packageName: 'X' }).ok).toBe(false);
  });
});
