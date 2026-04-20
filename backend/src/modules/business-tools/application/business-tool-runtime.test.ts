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
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        rawInput: { a: 1 },
        normalizedInput: { a: 1 },
        submittedInput: { a: 1 },
        validationResult: { ok: true },
      }),
    );
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
    expect((r.result as { missingFields?: string[] })?.missingFields).toContain('name');
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'MISSING_REQUIRED_FIELDS',
        rawInput: {},
        normalizedInput: {},
        submittedInput: {},
        missingFields: expect.arrayContaining(['name']),
        validationResult: expect.objectContaining({ ok: false }),
      }),
    );
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
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        rawInput: { 'nome completo': 'Rita Davila', email: 'rita@gmail.com' },
        normalizedInput: expect.objectContaining({ name: 'Rita Davila', email: 'rita@gmail.com' }),
        submittedInput: expect.objectContaining({ name: 'Rita Davila', email: 'rita@gmail.com' }),
      }),
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
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'UNKNOWN_ACTION',
        rawInput: {},
        normalizedInput: {},
        submittedInput: {},
      }),
    );
  });

  it('retries once for retry-safe action on transient execution error', async () => {
    const registry = new BusinessToolRegistry();
    const handler = jest
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('503 temporary unavailable'))
      .mockResolvedValueOnce({ items: [] });
    registry.register('crm_list_parties', handler);
    const append = jest.fn(async () => {});
    const auditRepo = { append } as unknown as BusinessToolAuditRepository;
    const runtime = new BusinessToolRuntime(registry, auditRepo);

    const r = await runtime.execute({
      workspaceId: '507f1f77bcf86cd799439011',
      toolDefinitionId: 'td-list',
      actionId: 'crm_list_parties',
      input: { query: 'cliente' },
    });

    expect(r.ok).toBe(true);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(append).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        errorCode: 'EXECUTION_RETRY',
      }),
    );
    expect(append).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        ok: true,
      }),
    );
  });

  it('does not retry non retry-safe action even with transient error', async () => {
    const registry = new BusinessToolRegistry();
    const handler = jest.fn(async () => {
      throw new Error('503 temporary unavailable');
    });
    registry.register('crm_create_party', handler);
    const append = jest.fn(async () => {});
    const auditRepo = { append } as unknown as BusinessToolAuditRepository;
    const runtime = new BusinessToolRuntime(registry, auditRepo);

    const r = await runtime.execute({
      workspaceId: '507f1f77bcf86cd799439011',
      toolDefinitionId: 'td-create',
      actionId: 'crm_create_party',
      input: { name: 'Rita' },
    });

    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('EXECUTION_ERROR');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'EXECUTION_ERROR',
      }),
    );
  });

  it('returns MISSING_REQUIRED_FIELDS for finance_create_payable when required fields are missing', async () => {
    const registry = new BusinessToolRegistry();
    const handler = jest.fn(async () => ({ ok: true }));
    registry.register('finance_create_payable', handler);
    const append = jest.fn(async () => {});
    const auditRepo = { append } as unknown as BusinessToolAuditRepository;
    const runtime = new BusinessToolRuntime(registry, auditRepo);

    const r = await runtime.execute({
      workspaceId: '507f1f77bcf86cd799439011',
      toolDefinitionId: 'td-finance',
      actionId: 'finance_create_payable',
      input: {},
    });

    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('MISSING_REQUIRED_FIELDS');
    expect(handler).not.toHaveBeenCalled();
    expect((r.result as { missingFields?: string[] })?.missingFields).toEqual(
      expect.arrayContaining(['destinationPartyId', 'amount', 'dueDate']),
    );
  });

  it('normalizes finance payable aliases before validation/execution', async () => {
    const registry = new BusinessToolRegistry();
    const handler = jest.fn(async (ctx: { workspaceId: string; input: unknown; correlationId?: string }) => ({
      payload: ctx.input,
    }));
    registry.register('finance_create_payable', handler);
    const append = jest.fn(async () => {});
    const auditRepo = { append } as unknown as BusinessToolAuditRepository;
    const runtime = new BusinessToolRuntime(registry, auditRepo);

    const r = await runtime.execute({
      workspaceId: '507f1f77bcf86cd799439011',
      toolDefinitionId: 'td-finance',
      actionId: 'finance_create_payable',
      input: { supplierId: 'party-supplier-1', valor: '129.90', vencimento: '2026-04-30' },
    });

    expect(r.ok).toBe(true);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          destinationPartyId: 'party-supplier-1',
          amount: '129.90',
          dueDate: '2026-04-30',
        }),
      }),
    );
  });

  it('returns MISSING_REQUIRED_FIELDS for care_create_subject when required fields are missing', async () => {
    const registry = new BusinessToolRegistry();
    const handler = jest.fn(async () => ({ ok: true }));
    registry.register('care_create_subject', handler);
    const append = jest.fn(async () => {});
    const auditRepo = { append } as unknown as BusinessToolAuditRepository;
    const runtime = new BusinessToolRuntime(registry, auditRepo);

    const r = await runtime.execute({
      workspaceId: '507f1f77bcf86cd799439011',
      toolDefinitionId: 'td-care',
      actionId: 'care_create_subject',
      input: {},
    });

    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('MISSING_REQUIRED_FIELDS');
    expect(handler).not.toHaveBeenCalled();
    expect((r.result as { missingFields?: string[] })?.missingFields).toEqual(
      expect.arrayContaining(['partyId', 'name', 'subjectKind']),
    );
  });

  it('normalizes care aliases before validation/execution', async () => {
    const registry = new BusinessToolRegistry();
    const handler = jest.fn(async (ctx: { workspaceId: string; input: unknown; correlationId?: string }) => ({
      payload: ctx.input,
    }));
    registry.register('care_create_subject', handler);
    const append = jest.fn(async () => {});
    const auditRepo = { append } as unknown as BusinessToolAuditRepository;
    const runtime = new BusinessToolRuntime(registry, auditRepo);

    const r = await runtime.execute({
      workspaceId: '507f1f77bcf86cd799439011',
      toolDefinitionId: 'td-care',
      actionId: 'care_create_subject',
      input: { ownerPartyId: 'party-care-1', nome: 'Paciente B', tipo: 'human' },
    });

    expect(r.ok).toBe(true);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          partyId: 'party-care-1',
          name: 'Paciente B',
          subjectKind: 'human',
        }),
      }),
    );
  });
});
