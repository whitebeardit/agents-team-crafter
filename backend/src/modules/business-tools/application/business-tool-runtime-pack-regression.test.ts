import { describe, expect, it, jest } from '@jest/globals';
import type { BusinessToolAuditRepository } from '../infra/business-tool-audit.repository.js';
import { BusinessToolRegistry } from './business-tool-registry.js';
import { BusinessToolRuntime } from './business-tool-runtime.js';
import { getBusinessActionPreset } from './business-action-presets.js';

describe('BusinessToolRuntime pack regression (Loop 98.9)', () => {
  it('executes representative actions across core packs (crm/care/finance/reminders/scheduling)', async () => {
    const cases = [
      { actionId: 'crm_create_party', packId: 'crm', input: { name: 'Cliente A' } },
      {
        actionId: 'care_create_subject',
        packId: 'care',
        input: { partyId: 'party-care-1', name: 'Paciente A', subjectKind: 'human' },
      },
      {
        actionId: 'finance_create_payable',
        packId: 'finance',
        input: { destinationPartyId: 'party-fin-1', amount: 120, dueDate: '2026-04-30' },
      },
      {
        actionId: 'schedule_create_reminder',
        packId: 'reminders',
        input: { title: 'Ligar cliente', at: '2026-04-12T08:30:00Z' },
      },
      {
        actionId: 'schedule_create_appointment',
        packId: 'scheduling',
        input: {
          partyId: 'party-sched-1',
          title: 'Consulta inicial',
          startsAt: '2026-04-12T09:00:00Z',
          endsAt: '2026-04-12T10:00:00Z',
        },
      },
    ] as const;

    const registry = new BusinessToolRegistry();
    for (const c of cases) {
      registry.register(c.actionId, async ({ input }) => ({ ok: true, actionId: c.actionId, echoed: input }));
    }
    const append = jest.fn(async () => {});
    const runtime = new BusinessToolRuntime(registry, { append } as unknown as BusinessToolAuditRepository);

    for (const c of cases) {
      const preset = getBusinessActionPreset(c.actionId);
      expect(preset?.packId).toBe(c.packId);
      const res = await runtime.execute({
        workspaceId: '507f1f77bcf86cd799439011',
        toolDefinitionId: `td-${c.actionId}`,
        actionId: c.actionId,
        input: c.input,
      });
      expect(res.ok).toBe(true);
      expect(res.result).toEqual(
        expect.objectContaining({
          ok: true,
          actionId: c.actionId,
        }),
      );
    }
  });
});
