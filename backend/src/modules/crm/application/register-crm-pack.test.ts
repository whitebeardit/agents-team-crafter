import { describe, expect, it, jest } from '@jest/globals';
import { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import type { PartyRepository } from '../infra/party.repository.js';
import { registerCrmPack } from './register-crm-pack.js';

describe('registerCrmPack', () => {
  it('crm_list_parties chama listParties com query vazia', async () => {
    const registry = new BusinessToolRegistry();
    const listParties = jest.fn(async () => [] as Awaited<ReturnType<PartyRepository['listParties']>>);
    const parties = { listParties } as unknown as PartyRepository;
    registerCrmPack(registry, parties);
    const h = registry.get('crm_list_parties');
    expect(h).toBeDefined();
    await h!({
      workspaceId: '507f1f77bcf86cd799439011',
      input: { query: '', roles: ['customer'], status: 'active' },
    });
    expect(listParties).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      expect.objectContaining({ query: '', roles: ['customer'], status: 'active' }),
    );
  });
});
