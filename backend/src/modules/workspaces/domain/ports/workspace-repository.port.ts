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
  /** Todos os workspaces (admin global) */
  listAll(): Promise<IWorkspaceRecord[]>;
  findById(workspaceId: string): Promise<IWorkspaceRecord | null>;
  findByIdForUser(workspaceId: string, userId: string): Promise<IWorkspaceRecord | null>;
  createWorkspace(input: {
    name: string;
    logo?: string;
    plan?: IWorkspaceRecord['plan'];
  }): Promise<IWorkspaceRecord>;
  updateWorkspace(
    workspaceId: string,
    patch: Partial<Pick<IWorkspaceRecord, 'name' | 'logo' | 'settings'>>,
  ): Promise<IWorkspaceRecord | null>;

  /** Admin global: persiste `plan` e o documento `limits` completo já calculado. */
  updateWorkspacePlanAndLimits(
    workspaceId: string,
    input: { plan: IWorkspaceRecord['plan']; limits: Record<string, unknown> },
  ): Promise<IWorkspaceRecord | null>;
}
