import { Types } from 'mongoose';
import { AvailabilitySlotModel } from './availability-slot.model.js';

function utcDayRange(dayIso: string) {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(dayIso.trim())
    ? new Date(`${dayIso.trim()}T00:00:00.000Z`)
    : new Date(dayIso);
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 23, 59, 59, 999));
  return { start, end };
}

export class AvailabilitySlotRepository {
  async create(
    workspaceId: string,
    input: { startsAt: string; endsAt: string; slotMinutes: number; label?: string },
  ) {
    const doc = await AvailabilitySlotModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      slotMinutes: input.slotMinutes,
      label: input.label?.trim() ?? '',
    });
    return this.toPublic(doc);
  }

  async listByDate(workspaceId: string, dayIso: string) {
    const { start, end } = utcDayRange(dayIso);
    const docs = await AvailabilitySlotModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      startsAt: { $gte: start, $lte: end },
    })
      .sort({ startsAt: 1 })
      .exec();
    return docs.map((d) => this.toPublic(d));
  }

  private toPublic(doc: {
    _id: Types.ObjectId;
    startsAt: Date;
    endsAt: Date;
    slotMinutes: number;
    label?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    return {
      id: doc._id.toString(),
      startsAt: doc.startsAt.toISOString(),
      endsAt: doc.endsAt.toISOString(),
      slotMinutes: doc.slotMinutes,
      label: doc.label ?? '',
      createdAt: doc.createdAt?.toISOString(),
      updatedAt: doc.updatedAt?.toISOString(),
    };
  }
}
