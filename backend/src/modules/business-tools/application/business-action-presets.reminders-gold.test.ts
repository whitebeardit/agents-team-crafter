import { describe, expect, it } from '@jest/globals';
import { getBusinessActionPreset } from './business-action-presets.js';

describe('business-action-presets reminders (Loop 127)', () => {
  it('defines explicit schema for reminders lifecycle actions and gold gate', () => {
    const createReminder = getBusinessActionPreset('schedule_create_reminder');
    const listByDate = getBusinessActionPreset('schedule_list_reminders_by_date');
    const markDone = getBusinessActionPreset('schedule_mark_reminder_done');
    const cancelReminder = getBusinessActionPreset('schedule_cancel_reminder');
    const goldGate = getBusinessActionPreset('reminders_gold_gate');

    expect((createReminder?.inputSchema as { required?: string[] }).required).toEqual(['title', 'at']);
    expect((listByDate?.inputSchema as { required?: string[] }).required).toEqual(['date']);
    expect((markDone?.inputSchema as { required?: string[] }).required).toEqual(['reminderId']);
    expect((cancelReminder?.inputSchema as { required?: string[] }).required).toEqual(['reminderId']);
    expect((goldGate?.inputSchema as { required?: string[] }).required).toEqual([]);
  });
});
