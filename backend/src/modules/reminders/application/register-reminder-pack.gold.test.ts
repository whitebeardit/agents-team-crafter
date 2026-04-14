import { describe, expect, it, jest } from '@jest/globals';
import { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import { registerReminderPack } from './register-reminder-pack.js';
import type { ReminderRepository } from '../infra/reminder.repository.js';

describe('registerReminderPack — reminders_gold_gate', () => {
  it('exposes reminders_gold_gate with deterministic contract', async () => {
    const registry = new BusinessToolRegistry();
    const reminders = {
      goldGateSummary: jest.fn(async () => ({
        approved: false,
        evaluatedAt: '2026-04-14T00:00:00.000Z',
        criteria: [{ code: 'reminders_has_history', passed: false, detail: 'sem lembretes' }],
        blockingCriteria: [{ code: 'reminders_has_history', passed: false, detail: 'sem lembretes' }],
        snapshot: { total: 0, open: 0, done: 0, cancelled: 0, overdueOpen: 0 },
      })),
    } as unknown as ReminderRepository;

    registerReminderPack(registry, reminders);
    const gate = registry.get('reminders_gold_gate');
    expect(gate).toBeDefined();

    const out = await gate!({
      workspaceId: '507f1f77bcf86cd799439011',
      input: {},
    });

    expect(reminders.goldGateSummary).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(out).toMatchObject({
      approved: false,
      criteria: expect.any(Array),
      blockingCriteria: expect.any(Array),
      snapshot: expect.any(Object),
    });
  });
});
