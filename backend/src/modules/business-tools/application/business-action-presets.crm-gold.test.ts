import { describe, expect, it } from '@jest/globals';
import { getBusinessActionPreset } from './business-action-presets.js';

describe('business action presets — CRM GOLD contract', () => {
  it('crm_find_party exposes identifier fields without requiring query', () => {
    const preset = getBusinessActionPreset('crm_find_party');
    expect(preset).toBeDefined();
    expect(preset?.packId).toBe('crm');
    const schema = (preset?.inputSchema ?? {}) as {
      properties?: Record<string, unknown>;
      required?: string[];
    };
    expect(schema.properties).toMatchObject({
      partyId: expect.any(Object),
      email: expect.any(Object),
      phone: expect.any(Object),
      query: expect.any(Object),
    });
    expect(Array.isArray(schema.required) ? schema.required : []).not.toContain('query');
  });

  it('crm_list_parties keeps query optional to support broad list flows', () => {
    const preset = getBusinessActionPreset('crm_list_parties');
    expect(preset).toBeDefined();
    expect(preset?.packId).toBe('crm');
    const schema = (preset?.inputSchema ?? {}) as { required?: string[] };
    expect(Array.isArray(schema.required) ? schema.required : []).not.toContain('query');
  });
});

