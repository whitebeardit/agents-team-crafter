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
}
