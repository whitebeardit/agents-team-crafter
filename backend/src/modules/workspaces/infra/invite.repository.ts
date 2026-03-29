import { Types } from 'mongoose';
import { InviteModel } from './invite.model.js';

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
}
