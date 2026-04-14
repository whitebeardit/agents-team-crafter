import { Types } from 'mongoose';
import { ReminderModel } from './reminder.model.js';

function utcDayRange(dayIso: string) {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(dayIso.trim())
    ? new Date(`${dayIso.trim()}T00:00:00.000Z`)
    : new Date(dayIso);
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 23, 59, 59, 999));
  return { start, end };
}

export class ReminderRepository {
  async create(workspaceId: string, input: { title: string; at: string }) {
    const doc = await ReminderModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      title: input.title.trim(),
      at: new Date(input.at),
      done: false,
      cancelled: false,
    });
    return { id: doc._id.toString(), at: doc.at.toISOString() };
  }

  async listByDate(workspaceId: string, dayIso: string) {
    const { start, end } = utcDayRange(dayIso);
    const docs = await ReminderModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      cancelled: false,
      at: { $gte: start, $lte: end },
    }).exec();
    return docs.map((d) => ({
      id: d._id.toString(),
      title: d.title,
      at: d.at.toISOString(),
      done: d.done,
    }));
  }

  async markDone(workspaceId: string, id: string) {
    const doc = await ReminderModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      { $set: { done: true } },
      { new: true },
    ).exec();
    return doc ? { id: doc._id.toString(), done: true } : null;
  }

  async cancel(workspaceId: string, id: string) {
    const doc = await ReminderModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      { $set: { cancelled: true } },
      { new: true },
    ).exec();
    return doc ? { id: doc._id.toString(), cancelled: true } : null;
  }

  async goldGateSummary(workspaceId: string) {
    const wid = new Types.ObjectId(workspaceId);
    const [summary] = await ReminderModel.aggregate([
      { $match: { workspaceId: wid } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          done: { $sum: { $cond: [{ $eq: ['$done', true] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$cancelled', true] }, 1, 0] } },
          overdueOpen: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$done', false] },
                    { $eq: ['$cancelled', false] },
                    { $lt: ['$at', '$$NOW'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]).exec();

    const total = Number(summary?.total ?? 0);
    const done = Number(summary?.done ?? 0);
    const cancelled = Number(summary?.cancelled ?? 0);
    const overdueOpen = Number(summary?.overdueOpen ?? 0);
    const open = Math.max(0, total - done - cancelled);

    const criteria = [
      {
        code: 'reminders_has_history',
        passed: total > 0,
        detail: total > 0 ? `${total} lembrete(s) registrado(s).` : 'Nenhum lembrete registrado.',
      },
      {
        code: 'reminders_has_concluded_or_cancelled',
        passed: done + cancelled > 0,
        detail:
          done + cancelled > 0
            ? `${done + cancelled} lembrete(s) concluído(s)/cancelado(s).`
            : 'Sem lembretes concluídos ou cancelados.',
      },
      {
        code: 'reminders_overdue_open_within_limit',
        passed: overdueOpen <= 3,
        detail:
          overdueOpen <= 3
            ? `${overdueOpen} lembrete(s) em atraso aberto(s).`
            : `${overdueOpen} lembrete(s) em atraso aberto(s) (acima do limite operacional).`,
      },
    ];

    const blockingCriteria = criteria.filter((c) => !c.passed);
    return {
      approved: blockingCriteria.length === 0,
      evaluatedAt: new Date().toISOString(),
      criteria,
      blockingCriteria,
      snapshot: {
        total,
        open,
        done,
        cancelled,
        overdueOpen,
      },
    };
  }

}
