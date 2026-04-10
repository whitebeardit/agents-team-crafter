import { describe, expect, it, jest } from '@jest/globals';
import { BusinessToolRegistry } from './business-tool-registry.js';
import { BusinessToolRuntime } from './business-tool-runtime.js';
import type { BusinessToolAuditRepository } from '../infra/business-tool-audit.repository.js';

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
