import { Types } from 'mongoose';
import { InviteModel } from './invite.model.js';

export interface IInviteRecord {
  inviteId: string;
  workspaceId: string;
  email: string;
  role: 'admin' | 'member';
  expiresAt: Date;
  consumedAt?: Date;
  revokedAt?: Date;
}

export interface IInviteListItem {
  inviteId: string;
  email: string;
  role: 'admin' | 'member';
  expiresAt: string;
  consumedAt?: string;
  revokedAt?: string;
  createdAt: string;
}

export class InviteRepository {
  async create(data: {
    workspaceId: string;
    email: string;
    role: 'admin' | 'member';
    expiresAt: Date;
  }) {
    const doc = await InviteModel.create({
      workspaceId: new Types.ObjectId(data.workspaceId),
      email: data.email.toLowerCase(),
      role: data.role,
      expiresAt: data.expiresAt,
    });
    return {
      inviteId: doc._id.toString(),
      email: doc.email,
      role: doc.role,
      expiresAt: doc.expiresAt.toISOString(),
    };
  }

  async findValidById(inviteId: string): Promise<IInviteRecord | null> {
    const doc = await InviteModel.findById(inviteId);
    if (!doc) return null;
    const d = doc as {
      _id: Types.ObjectId;
      workspaceId: Types.ObjectId;
      email: string;
      role: 'admin' | 'member';
      expiresAt: Date;
      consumedAt?: Date;
      revokedAt?: Date;
    };
    return {
      inviteId: d._id.toString(),
      workspaceId: d.workspaceId.toString(),
      email: d.email,
      role: d.role,
      expiresAt: d.expiresAt,
      consumedAt: d.consumedAt,
      revokedAt: d.revokedAt,
    };
  }

  async listByWorkspace(workspaceId: string): Promise<IInviteListItem[]> {
    const docs = await InviteModel.find({ workspaceId: new Types.ObjectId(workspaceId) })
      .sort({ createdAt: -1 })
      .lean();
    return docs.map((raw) => {
      const d = raw as unknown as {
        _id: Types.ObjectId;
        email: string;
        role: 'admin' | 'member';
        expiresAt: Date;
        consumedAt?: Date;
        revokedAt?: Date;
        createdAt: Date;
      };
      return {
        inviteId: d._id.toString(),
        email: d.email,
        role: d.role,
        expiresAt: d.expiresAt.toISOString(),
        consumedAt: d.consumedAt?.toISOString(),
        revokedAt: d.revokedAt?.toISOString(),
        createdAt: d.createdAt.toISOString(),
      };
    });
  }

  async revoke(inviteId: string, workspaceId: string): Promise<boolean> {
    const res = await InviteModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(inviteId),
        workspaceId: new Types.ObjectId(workspaceId),
        $and: [
          { $or: [{ consumedAt: { $exists: false } }, { consumedAt: null }] },
          { $or: [{ revokedAt: { $exists: false } }, { revokedAt: null }] },
        ],
      },
      { $set: { revokedAt: new Date() } },
      { new: true },
    );
    return !!res;
  }

  async findOneInWorkspace(
    inviteId: string,
    workspaceId: string,
  ): Promise<IInviteRecord | null> {
    const doc = await InviteModel.findOne({
      _id: new Types.ObjectId(inviteId),
      workspaceId: new Types.ObjectId(workspaceId),
    });
    if (!doc) return null;
    const d = doc as {
      _id: Types.ObjectId;
      workspaceId: Types.ObjectId;
      email: string;
      role: 'admin' | 'member';
      expiresAt: Date;
      consumedAt?: Date;
      revokedAt?: Date;
    };
    return {
      inviteId: d._id.toString(),
      workspaceId: d.workspaceId.toString(),
      email: d.email,
      role: d.role,
      expiresAt: d.expiresAt,
      consumedAt: d.consumedAt,
      revokedAt: d.revokedAt,
    };
  }

  async markConsumed(inviteId: string): Promise<boolean> {
    const res = await InviteModel.findByIdAndUpdate(inviteId, {
      $set: { consumedAt: new Date() },
    });
    return !!res;
  }

  /** Remove o documento; some da listagem (histórico deixa de aparecer). */
  async deletePermanently(inviteId: string, workspaceId: string): Promise<boolean> {
    const res = await InviteModel.findOneAndDelete({
      _id: new Types.ObjectId(inviteId),
      workspaceId: new Types.ObjectId(workspaceId),
    });
    return !!res;
  }
}
