export type EMemberRole = 'owner' | 'admin' | 'member';

export interface IMemberRecord {
  userId: string;
  workspaceId: string;
  role: EMemberRole;
  joinedAt: Date;
}

export interface IMemberRepository {
  findRole(userId: string, workspaceId: string): Promise<EMemberRole | null>;
  listMembers(workspaceId: string): Promise<
    Array<{ userId: string; role: EMemberRole; joinedAt: Date; name: string; email: string; avatar?: string }>
  >;
  addMember(workspaceId: string, userId: string, role: EMemberRole): Promise<void>;
  updateMemberRole(workspaceId: string, userId: string, role: EMemberRole): Promise<boolean>;
}
