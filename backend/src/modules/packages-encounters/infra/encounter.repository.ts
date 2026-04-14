import { Types } from 'mongoose';
import { EncounterModel } from './encounter.model.js';

export class EncounterRepository {
  async create(
    workspaceId: string,
    input: {
      partyId: string;
      packageSaleId?: string;
      careSubjectId?: string;
      notes?: string;
      durationMinutes?: number;
    },
  ) {
    const doc = await EncounterModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      partyId: new Types.ObjectId(input.partyId),
      packageSaleId: input.packageSaleId ? new Types.ObjectId(input.packageSaleId) : undefined,
      careSubjectId: input.careSubjectId ? new Types.ObjectId(input.careSubjectId) : undefined,
      notes: input.notes ?? '',
      durationMinutes: input.durationMinutes ?? 0,
    });
    return this.pub(doc);
  }

  async listByParty(workspaceId: string, partyId: string) {
    const docs = await EncounterModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      partyId: new Types.ObjectId(partyId),
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();
    return docs.map((d) => this.pub(d));
  }

  async listByPackageSale(workspaceId: string, packageSaleId: string) {
    const docs = await EncounterModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      packageSaleId: new Types.ObjectId(packageSaleId),
    })
      .sort({ createdAt: -1 })
      .exec();
    return docs.map((d) => this.pub(d));
  }

  async findById(workspaceId: string, id: string) {
    const doc = await EncounterModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    return doc ? this.pub(doc) : null;
  }

  async goldGateSnapshot(workspaceId: string) {
    const ws = new Types.ObjectId(workspaceId);
    const stats = await EncounterModel.aggregate<{
      _id: null;
      totalEncounters: number;
      packageLinkedEncounters: number;
      totalDurationMinutes: number;
    }>([
      { $match: { workspaceId: ws } },
      {
        $group: {
          _id: null,
          totalEncounters: { $sum: 1 },
          packageLinkedEncounters: {
            $sum: { $cond: [{ $ifNull: ['$packageSaleId', false] }, 1, 0] },
          },
          totalDurationMinutes: { $sum: { $ifNull: ['$durationMinutes', 0] } },
        },
      },
    ]);
    const totalEncounters = stats[0]?.totalEncounters ?? 0;
    const packageLinkedEncounters = stats[0]?.packageLinkedEncounters ?? 0;
    const totalDurationMinutes = stats[0]?.totalDurationMinutes ?? 0;
    return {
      totalEncounters,
      packageLinkedEncounters,
      totalDurationMinutes,
      avgDurationMinutes: totalEncounters > 0 ? totalDurationMinutes / totalEncounters : 0,
    };
  }

  private pub(doc: {
    _id: Types.ObjectId;
    partyId: Types.ObjectId;
    packageSaleId?: Types.ObjectId;
    careSubjectId?: Types.ObjectId;
    notes?: string;
    durationMinutes?: number;
    createdAt?: Date;
  }) {
    return {
      id: doc._id.toString(),
      partyId: doc.partyId.toString(),
      packageSaleId: doc.packageSaleId?.toString(),
      careSubjectId: doc.careSubjectId?.toString(),
      notes: doc.notes,
      durationMinutes: doc.durationMinutes,
      createdAt: doc.createdAt?.toISOString(),
    };
  }
}
