import { Types } from 'mongoose';
import type { UpdateQuery } from 'mongoose';
import { PartyModel } from './party.model.js';

export type PartyOptionalFieldKey = 'email' | 'phone' | 'notes';

export type IPartyUpdateOperation = {
  set: Partial<{
    displayName: string;
    roles: string[];
    email: string;
    phone: string;
    notes: string;
    status: 'active' | 'inactive';
  }>;
  unset: PartyOptionalFieldKey[];
};

export class PartyRepository {
  async create(
    workspaceId: string,
    input: {
      displayName: string;
      roles?: string[];
      status?: 'active' | 'inactive';
      email?: string;
      phone?: string;
      notes?: string;
    },
  ) {
    const doc = await PartyModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      displayName: input.displayName.trim(),
      roles: input.roles ?? [],
      status: input.status ?? 'active',
      email: input.email?.trim(),
      phone: input.phone?.trim(),
      notes: input.notes?.trim(),
    });
    return this.toPublic(doc);
  }

  async update(workspaceId: string, partyId: string, op: IPartyUpdateOperation) {
    const update: UpdateQuery<unknown> = {};
    if (Object.keys(op.set).length > 0) {
      update.$set = op.set;
    }
    if (op.unset.length > 0) {
      update.$unset = Object.fromEntries(op.unset.map((k) => [k, 1]));
    }
    if (Object.keys(update).length === 0) {
      return null;
    }
    const doc = await PartyModel.findOneAndUpdate(
      { _id: partyId, workspaceId: new Types.ObjectId(workspaceId) },
      update,
      { new: true },
    ).exec();
    return doc ? this.toPublic(doc) : null;
  }

  async findById(workspaceId: string, partyId: string) {
    const doc = await PartyModel.findOne({
      _id: partyId,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    return doc ? this.toPublic(doc) : null;
  }

  async findByQuery(workspaceId: string, query: string, limit = 20) {
    const q = query.trim();
    if (!q) return [];
    const docs = await PartyModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      displayName: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    })
      .limit(limit)
      .exec();
    return docs.map((d) => this.toPublic(d));
  }

  /** Lista recente para pickers (sem query). */
  async listRecent(workspaceId: string, limit = 30) {
    const docs = await PartyModel.find({ workspaceId: new Types.ObjectId(workspaceId) })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .exec();
    return docs.map((d) => this.toPublic(d));
  }

  async listByRole(workspaceId: string, role: string, limit = 50) {
    const docs = await PartyModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      roles: role.trim(),
    })
      .limit(limit)
      .exec();
    return docs.map((d) => this.toPublic(d));
  }

  /**
   * Listagem com filtros opcionais (Loop 87). `query` vazio não bloqueia a listagem.
   */
  async listParties(
    workspaceId: string,
    opts: {
      query?: string;
      roles?: string[];
      status?: 'active' | 'inactive';
      limit?: number;
    },
  ) {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const wid = new Types.ObjectId(workspaceId);
    const q = (opts.query ?? '').trim();
    const parts: Record<string, unknown>[] = [{ workspaceId: wid }];
    if (q) {
      parts.push({
        displayName: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      });
    }
    if (opts.roles && opts.roles.length > 0) {
      const rs = opts.roles.map((r) => r.trim()).filter(Boolean);
      if (rs.length > 0) {
        parts.push({ roles: { $in: rs } });
      }
    }
    if (opts.status === 'active') {
      parts.push({ $or: [{ status: 'active' }, { status: { $exists: false } }] });
    } else if (opts.status === 'inactive') {
      parts.push({ status: 'inactive' });
    }
    const filter = parts.length === 1 ? parts[0]! : { $and: parts };
    const docs = await PartyModel.find(filter).sort({ updatedAt: -1 }).limit(limit).exec();
    return docs.map((d) => this.toPublic(d));
  }

  private toPublic(d: {
    _id: Types.ObjectId;
    displayName: string;
    roles?: string[];
    status?: string;
    email?: string;
    phone?: string;
    notes?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    const st = d.status === 'inactive' ? 'inactive' : 'active';
    return {
      id: d._id.toString(),
      displayName: d.displayName,
      roles: d.roles ?? [],
      status: st,
      email: d.email,
      phone: d.phone,
      notes: d.notes,
      createdAt: d.createdAt?.toISOString(),
      updatedAt: d.updatedAt?.toISOString(),
    };
  }
}
