import { describe, expect, it } from '@jest/globals';
import { BusinessToolRegistry } from './business-tool-registry.js';

describe('BusinessToolRegistry', () => {
  it('listCatalog returns sorted items with preset metadata when available', () => {
    const registry = new BusinessToolRegistry();
    registry.register('z_last', async () => ({}));
    registry.register('crm_create_party', async () => ({}));

    const cat = registry.listCatalog();
    expect(cat.length).toBe(2);
    const crm = cat.find((x) => x.actionId === 'crm_create_party');
    expect(crm?.title).toContain('CRM');
    expect(crm?.packId).toBe('crm');
    expect(crm?.operationType).toBe('write');
    expect((crm?.inputSchema as { required?: string[] })?.required).toContain('name');
    expect(crm?.requiredFieldLabels?.length).toBeGreaterThan(0);
    const z = cat.find((x) => x.actionId === 'z_last');
    expect(z?.title).toBe('z_last');
    expect(z?.description).toBe('');
    expect(z?.operationType).toBe('read');
    // pt sort: CRM before z
    expect(cat[0].actionId).toBe('crm_create_party');
    expect(cat[1].actionId).toBe('z_last');
  });

  it('exposes explicit schema for crm_update_party (avoids generic additionalProperties schema)', () => {
    const registry = new BusinessToolRegistry();
    registry.register('crm_update_party', async () => ({}));

    const cat = registry.listCatalog();
    const update = cat.find((x) => x.actionId === 'crm_update_party');
    expect(update?.packId).toBe('crm');
    expect((update?.inputSchema as { required?: string[] })?.required).toContain('partyId');
    expect((update?.inputSchema as { properties?: Record<string, unknown> })?.properties).toHaveProperty('partyId');
  });
});
