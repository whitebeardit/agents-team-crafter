import { describe, expect, it } from '@jest/globals';
import { getBusinessActionPreset } from './business-action-presets.js';

describe('business-action-presets packages/encounters (Loop 103)', () => {
  it('defines explicit schema for package sale actions', () => {
    const sell = getBusinessActionPreset('package_sell_to_party');
    const balance = getBusinessActionPreset('package_get_balance');

    expect((sell?.inputSchema as { required?: string[] }).required).toEqual([
      'partyId',
      'packageName',
      'unitsTotal',
    ]);
    expect((balance?.inputSchema as { required?: string[] }).required).toEqual(['packageSaleId']);
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
});
