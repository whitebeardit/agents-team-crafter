export interface IWorkspaceRecord {
  id: string;
  name: string;
  logo?: string;
  plan: 'free' | 'pro' | 'enterprise';
  settings: Record<string, unknown>;
  limits: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWorkspaceRepository {
  listByUserId(userId: string): Promise<IWorkspaceRecord[]>;
  findById(workspaceId: string): Promise<IWorkspaceRecord | null>;
  findByIdForUser(workspaceId: string, userId: string): Promise<IWorkspaceRecord | null>;
  updateWorkspace(
    workspaceId: string,
    patch: Partial<Pick<IWorkspaceRecord, 'name' | 'logo' | 'settings'>>,
  ): Promise<IWorkspaceRecord | null>;
}
