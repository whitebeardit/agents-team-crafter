import type { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import type { ReminderRepository } from '../infra/reminder.repository.js';

export function registerReminderPack(registry: BusinessToolRegistry, reminders: ReminderRepository): void {
  registry.register('schedule_create_reminder', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const title = typeof data.title === 'string' ? data.title : '';
    const at = typeof data.at === 'string' ? data.at : '';
    if (!title.trim() || !at) throw new Error('title e at (ISO) obrigatorios');
    return reminders.create(workspaceId, { title, at });
  });

  registry.register('schedule_list_reminders_by_date', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const date = typeof data.date === 'string' ? data.date : '';
    if (!date) throw new Error('date (ISO dia) obrigatorio');
    return { reminders: await reminders.listByDate(workspaceId, date) };
  });

  registry.register('schedule_mark_reminder_done', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const reminderId = typeof data.reminderId === 'string' ? data.reminderId : '';
    if (!reminderId) throw new Error('reminderId obrigatorio');
    const r = await reminders.markDone(workspaceId, reminderId);
    if (!r) throw new Error('Lembrete nao encontrado');
    return r;
  });

  registry.register('schedule_cancel_reminder', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const reminderId = typeof data.reminderId === 'string' ? data.reminderId : '';
    if (!reminderId) throw new Error('reminderId obrigatorio');
    const r = await reminders.cancel(workspaceId, reminderId);
    if (!r) throw new Error('Lembrete nao encontrado');
    return r;
  });
}
