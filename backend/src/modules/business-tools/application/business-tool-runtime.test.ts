import { describe, expect, it, jest } from '@jest/globals';
import { BusinessToolRegistry } from './business-tool-registry.js';
import { BusinessToolRuntime } from './business-tool-runtime.js';
import type { BusinessToolAuditRepository } from '../infra/business-tool-audit.repository.js';
import { registerCrmPack } from '../../crm/application/register-crm-pack.js';
import type { PartyRepository } from '../../crm/infra/party.repository.js';

describe('BusinessToolRuntime', () => {
  it('executes registered action and audits success', async () => {
    const registry = new BusinessToolRegistry();
    registry.register('test.echo', async ({ input }) => ({ received: input }));
    const append = jest.fn(async () => {});
    const auditRepo = { append } as unknown as BusinessToolAuditRepository;
    const runtime = new BusinessToolRuntime(registry, auditRepo);

    const r = await runtime.execute({
      workspaceId: '507f1f77bcf86cd799439011',
      toolDefinitionId: 'td1',
      actionId: 'test.echo',
      input: { a: 1 },
    });

    expect(r.ok).toBe(true);
    expect(r.result).toEqual({ received: { a: 1 } });
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns MISSING_REQUIRED_FIELDS when preset schema not satisfied (crm_create_party)', async () => {
    const registry = new BusinessToolRegistry();
    const partyRepo = {
      create: jest.fn(),
      listParties: jest.fn(),
    } as unknown as PartyRepository;
    registerCrmPack(registry, partyRepo);
    const append = jest.fn(async () => {});
    const auditRepo = { append } as unknown as BusinessToolAuditRepository;
    const runtime = new BusinessToolRuntime(registry, auditRepo);

    const r = await runtime.execute({
      workspaceId: '507f1f77bcf86cd799439011',
      toolDefinitionId: 'td1',
      actionId: 'crm_create_party',
      input: {},
    });

    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('MISSING_REQUIRED_FIELDS');
    expect((r.result as { missingFields?: string[] })?.missingFields).toContain('displayName');
  });



  it('normalizes alias `nome completo` to `displayName` before schema validation', async () => {
    const registry = new BusinessToolRegistry();
    const partyRepo = {
      create: jest.fn(async (_workspaceId: string, payload: { displayName: string }) => ({ id: 'p1', ...payload })),
      listParties: jest.fn(),
    } as unknown as PartyRepository;
    registerCrmPack(registry, partyRepo);
    const append = jest.fn(async () => {});
    const auditRepo = { append } as unknown as BusinessToolAuditRepository;
    const runtime = new BusinessToolRuntime(registry, auditRepo);

    const r = await runtime.execute({
      workspaceId: '507f1f77bcf86cd799439011',
      toolDefinitionId: 'td1',
      actionId: 'crm_create_party',
      input: { 'nome completo': 'Rita Davila', email: 'rita@gmail.com' },
    });

    expect(r.ok).toBe(true);
    expect(partyRepo.create).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      expect.objectContaining({ displayName: 'Rita Davila' }),
    );
  });
  it('returns UNKNOWN_ACTION when missing handler', async () => {
    const registry = new BusinessToolRegistry();
    const append = jest.fn(async () => {});
    const auditRepo = { append } as unknown as BusinessToolAuditRepository;
    const runtime = new BusinessToolRuntime(registry, auditRepo);

    const r = await runtime.execute({
      workspaceId: '507f1f77bcf86cd799439011',
      toolDefinitionId: 'td1',
      actionId: 'missing',
      input: {},
    });

    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('UNKNOWN_ACTION');
    expect(append.mock.calls.length).toBeGreaterThan(0);
  });
});
