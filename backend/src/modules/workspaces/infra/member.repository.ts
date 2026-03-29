import { Types } from 'mongoose';
import type { EMemberRole, IMemberRepository } from '../domain/ports/member-repository.port.js';
import { UserModel } from '../../users/infra/user.model.js';
import { WorkspaceMemberModel } from './workspace-member.model.js';

export class MemberRepository implements IMemberRepository {
  async findRole(userId: string, workspaceId: string): Promise<EMemberRole | null> {
    const row = await WorkspaceMemberModel.findOne({
      workspaceId: new Types.ObjectId(workspaceId),
      userId: new Types.ObjectId(userId),
    }).lean();
    const m = row as { role?: string } | null;
    return (m?.role as EMemberRole) ?? null;
  }

  async listMembers(workspaceId: string) {
    const rows = await WorkspaceMemberModel.find({ workspaceId: new Types.ObjectId(workspaceId) }).lean();
    const userIds = rows.map((r) => r.userId);
    const users = await UserModel.find({ _id: { $in: userIds } }).lean();
    const byId = new Map(
      users.map((u) => {
        const ux = u as { _id: Types.ObjectId; name?: string; email?: string; avatar?: string };
        return [ux._id.toString(), ux] as const;
      }),
    );
    return rows.map((r) => {
      const rr = r as unknown as { userId: Types.ObjectId; role: string; joinedAt: Date };
      const u = byId.get(rr.userId.toString());
      return {
        userId: rr.userId.toString(),
        role: rr.role as EMemberRole,
        joinedAt: rr.joinedAt,
        name: u?.name ?? '',
        email: u?.email ?? '',
        avatar: u?.avatar,
      };
    });
  }

  async addMember(workspaceId: string, userId: string, role: EMemberRole): Promise<void> {
    await WorkspaceMemberModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      userId: new Types.ObjectId(userId),
      role,
      joinedAt: new Date(),
    });
  }

  async updateMemberRole(workspaceId: string, userId: string, role: EMemberRole): Promise<boolean> {
    const res = await WorkspaceMemberModel.findOneAndUpdate(
      {
        workspaceId: new Types.ObjectId(workspaceId),
        userId: new Types.ObjectId(userId),
      },
      { $set: { role } },
      { new: true },
    );
    return !!res;
  }
}
