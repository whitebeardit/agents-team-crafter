import { Types } from 'mongoose';
import { CareSubjectModel } from './care-subject.model.js';

export class CareSubjectRepository {
  async create(
    workspaceId: string,
    input: { partyId: string; name: string; subjectKind: 'human' | 'animal' | 'psych'; notes?: string },
  ) {
    const doc = await CareSubjectModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      partyId: new Types.ObjectId(input.partyId),
      name: input.name.trim(),
      subjectKind: input.subjectKind,
      notes: input.notes?.trim(),
    });
    return this.toPublic(doc);
  }

  async update(
    workspaceId: string,
    id: string,
    patch: Partial<{ name: string; subjectKind: 'human' | 'animal' | 'psych'; notes: string }>,
  ) {
    const doc = await CareSubjectModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      { $set: patch },
      { new: true },
    ).exec();
    return doc ? this.toPublic(doc) : null;
  }

  async findById(workspaceId: string, id: string) {
    const doc = await CareSubjectModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    return doc ? this.toPublic(doc) : null;
  }

  async listByParty(workspaceId: string, partyId: string, limit = 50) {
    const docs = await CareSubjectModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      partyId: new Types.ObjectId(partyId),
    })
      .limit(limit)
      .exec();
    return docs.map((d) => this.toPublic(d));
  }

  private toPublic(d: {
    _id: Types.ObjectId;
    partyId: Types.ObjectId;
    name: string;
    subjectKind: string;
    notes?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    return {
      id: d._id.toString(),
      partyId: d.partyId.toString(),
      name: d.name,
      subjectKind: d.subjectKind,
      notes: d.notes,
      createdAt: d.createdAt?.toISOString(),
      updatedAt: d.updatedAt?.toISOString(),
    };
  }
}
