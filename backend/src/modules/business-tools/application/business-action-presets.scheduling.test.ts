import { describe, expect, it } from '@jest/globals';
import { getBusinessActionPreset } from './business-action-presets.js';

describe('business-action-presets scheduling/reminders (Loop 99)', () => {
  it('defines explicit schema for scheduling actions with mandatory ids/dates', () => {
    const createAppointment = getBusinessActionPreset('schedule_create_appointment');
    const reschedule = getBusinessActionPreset('schedule_reschedule_appointment');
    const getAvailability = getBusinessActionPreset('schedule_get_availability');

    expect(createAppointment?.inputSchema).toBeDefined();
    expect(createAppointment?.requiredFieldLabels).toContain('Party (partyId) ou phone');
    expect((createAppointment?.inputSchema as { required?: string[] }).required).toEqual(
      expect.arrayContaining(['partyId', 'title', 'startsAt', 'endsAt']),
    );

    expect((reschedule?.inputSchema as { required?: string[] }).required).toEqual(
      expect.arrayContaining(['appointmentId', 'startsAt', 'endsAt']),
    );

    expect((getAvailability?.inputSchema as { required?: string[] }).required).toEqual(['date']);
  });

  it('defines explicit schema for reminder actions', () => {
    const createReminder = getBusinessActionPreset('schedule_create_reminder');
    const listByDate = getBusinessActionPreset('schedule_list_reminders_by_date');

    expect((createReminder?.inputSchema as { required?: string[] }).required).toEqual(['title', 'at']);
    expect((listByDate?.inputSchema as { required?: string[] }).required).toEqual(['date']);
  });
});
