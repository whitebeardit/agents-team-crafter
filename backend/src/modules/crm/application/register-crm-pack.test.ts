import { describe, expect, it, jest } from '@jest/globals';
import { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import type { PartyRepository } from '../infra/party.repository.js';
import { registerCrmPack } from './register-crm-pack.js';

describe('registerCrmPack', () => {
  it('crm_create_party aceita nome em linguagem natural', async () => {
    const registry = new BusinessToolRegistry();
    const create = jest.fn(async (ws: string, payload: Record<string, unknown>) => ({ id: 'party-1', ...payload, ws }));
    const parties = { create } as unknown as PartyRepository;
    registerCrmPack(registry, parties);
    const h = registry.get('crm_create_party');
    expect(h).toBeDefined();

    const out = await h!({
      workspaceId: '507f1f77bcf86cd799439011',
      input: { name: 'Maria Silva', phone: '+55 11 99999-0000', email: 'maria@empresa.test' },
    });

    expect(create).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      expect.objectContaining({
        displayName: 'Maria Silva',
        phone: '+55 11 99999-0000',
        email: 'maria@empresa.test',
        roles: ['customer'],
      }),
    );
    expect(out).toEqual(expect.objectContaining({ id: 'party-1', displayName: 'Maria Silva' }));
  });

  it('crm_create_party retorna erro legível quando nome não é informado', async () => {
    const registry = new BusinessToolRegistry();
    const create = jest.fn(async () => ({}));
    const parties = { create } as unknown as PartyRepository;
    registerCrmPack(registry, parties);
    const h = registry.get('crm_create_party');
    expect(h).toBeDefined();

    await expect(
      h!({
        workspaceId: '507f1f77bcf86cd799439011',
        input: { email: 'sem-nome@empresa.test' },
      }),
    ).rejects.toThrow('Nome do cliente obrigatorio');
    expect(create).not.toHaveBeenCalled();
  });

  it('crm_create_party retorna erro legível quando celular não é informado', async () => {
    const registry = new BusinessToolRegistry();
    const create = jest.fn(async () => ({}));
    const parties = { create } as unknown as PartyRepository;
    registerCrmPack(registry, parties);
    const h = registry.get('crm_create_party');
    expect(h).toBeDefined();

    await expect(
      h!({
        workspaceId: '507f1f77bcf86cd799439011',
        input: { name: 'Cliente sem celular' },
      }),
    ).rejects.toThrow('Celular do cliente obrigatorio (phone)');
    expect(create).not.toHaveBeenCalled();
  });

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

  it('crm_list_parties não exige query e usa vazio por padrão', async () => {
    const registry = new BusinessToolRegistry();
    const listParties = jest.fn(async () => [] as Awaited<ReturnType<PartyRepository['listParties']>>);
    const parties = { listParties } as unknown as PartyRepository;
    registerCrmPack(registry, parties);
    const h = registry.get('crm_list_parties');
    expect(h).toBeDefined();

    await h!({
      workspaceId: '507f1f77bcf86cd799439011',
      input: { roles: ['customer'] },
    });

    expect(listParties).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      expect.objectContaining({ query: '', roles: ['customer'] }),
    );
  });

  it('crm_find_party prioriza busca por partyId quando informado', async () => {
    const registry = new BusinessToolRegistry();
    const findById = jest.fn(async () => ({ id: 'party-1', displayName: 'Cliente A', roles: [], status: 'active' }));
    const findByEmailOrPhone = jest.fn(async () => []);
    const findByQuery = jest.fn(async () => []);
    const parties = { findById, findByEmailOrPhone, findByQuery } as unknown as PartyRepository;
    registerCrmPack(registry, parties);
    const h = registry.get('crm_find_party');
    expect(h).toBeDefined();
    const out = await h!({
      workspaceId: '507f1f77bcf86cd799439011',
      input: { partyId: 'party-1', email: 'ignored@test.com', query: 'ignored' },
    });
    expect(findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'party-1');
    expect(findByEmailOrPhone).not.toHaveBeenCalled();
    expect(findByQuery).not.toHaveBeenCalled();
    expect(out).toEqual({
      parties: [{ id: 'party-1', displayName: 'Cliente A', roles: [], status: 'active' }],
    });
  });

  it('crm_find_party usa email/telefone quando presentes e sem partyId', async () => {
    const registry = new BusinessToolRegistry();
    const findById = jest.fn(async () => null);
    const findByEmailOrPhone = jest.fn(async () => [{ id: 'party-2', displayName: 'Cliente B', roles: [], status: 'active' }]);
    const findByQuery = jest.fn(async () => []);
    const parties = { findById, findByEmailOrPhone, findByQuery } as unknown as PartyRepository;
    registerCrmPack(registry, parties);
    const h = registry.get('crm_find_party');
    expect(h).toBeDefined();
    const out = await h!({
      workspaceId: '507f1f77bcf86cd799439011',
      input: { email: 'cliente@empresa.test' },
    });
    expect(findById).not.toHaveBeenCalled();
    expect(findByEmailOrPhone).toHaveBeenCalledWith('507f1f77bcf86cd799439011', {
      email: 'cliente@empresa.test',
      phone: '',
    });
    expect(findByQuery).not.toHaveBeenCalled();
    expect(out).toEqual({
      parties: [{ id: 'party-2', displayName: 'Cliente B', roles: [], status: 'active' }],
    });
  });

  it('crm_find_party faz fallback para query quando email/telefone não encontram e query foi informada', async () => {
    const registry = new BusinessToolRegistry();
    const findById = jest.fn(async () => null);
    const findByEmailOrPhone = jest.fn(async () => []);
    const findByQuery = jest.fn(async () => [{ id: 'party-3', displayName: 'Cliente C', roles: [], status: 'active' }]);
    const parties = { findById, findByEmailOrPhone, findByQuery } as unknown as PartyRepository;
    registerCrmPack(registry, parties);
    const h = registry.get('crm_find_party');
    expect(h).toBeDefined();
    const out = await h!({
      workspaceId: '507f1f77bcf86cd799439011',
      input: { email: 'nao-encontrado@test.com', query: 'Cliente C' },
    });
    expect(findByEmailOrPhone).toHaveBeenCalledWith('507f1f77bcf86cd799439011', {
      email: 'nao-encontrado@test.com',
      phone: '',
    });
    expect(findByQuery).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'Cliente C');
    expect(out).toEqual({
      parties: [{ id: 'party-3', displayName: 'Cliente C', roles: [], status: 'active' }],
    });
  });

  it('crm_find_party retorna erro explícito quando nenhum critério é informado', async () => {
    const registry = new BusinessToolRegistry();
    const findById = jest.fn(async () => null);
    const findByEmailOrPhone = jest.fn(async () => []);
    const findByQuery = jest.fn(async () => []);
    const parties = { findById, findByEmailOrPhone, findByQuery } as unknown as PartyRepository;
    registerCrmPack(registry, parties);
    const h = registry.get('crm_find_party');
    expect(h).toBeDefined();
    await expect(
      h!({
        workspaceId: '507f1f77bcf86cd799439011',
        input: {},
      }),
    ).rejects.toThrow('Informe partyId, email, phone ou query para localizar cliente');
    expect(findById).not.toHaveBeenCalled();
    expect(findByEmailOrPhone).not.toHaveBeenCalled();
    expect(findByQuery).not.toHaveBeenCalled();
  });
});
