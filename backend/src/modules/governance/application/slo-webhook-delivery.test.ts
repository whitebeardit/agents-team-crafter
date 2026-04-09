import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { deliverSloBreachWebhook } from './slo-webhook-delivery.js';

describe('deliverSloBreachWebhook', () => {
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, status: 200 } as Response),
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it('POSTs JSON payload', async () => {
    await deliverSloBreachWebhook('https://example.com/hook', {
      schema: 'whitebeard.governance.slo_breached',
      version: 1,
      workspaceId: 'ws1',
      teamId: 't1',
      teamName: 'Team',
      successRate: 0.5,
      sloTargetPercent: 99,
      windowDays: 7,
      occurredAt: new Date().toISOString(),
    });
    const call = (globalThis.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe('https://example.com/hook');
    expect(call[1]?.method).toBe('POST');
    expect((call[1]?.headers as Record<string, string>)['content-type']).toBe('application/json');
  });
});
