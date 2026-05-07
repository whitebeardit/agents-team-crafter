export interface IAgentListFilters {
  origin?: 'whitebeard' | 'company';
  category?: string;
  channel?: string;
  role?: 'coordinator' | 'specialist';
  search?: string;
  teamId?: string;
}

export interface IAgentRepository {
  list(
    workspaceId: string,
    filters: IAgentListFilters,
    page: number,
    perPage: number,
  ): Promise<{ items: unknown[]; total: number }>;
  findById(workspaceId: string, id: string): Promise<unknown | null>;
  create(workspaceId: string, data: Record<string, unknown>): Promise<unknown>;
  update(workspaceId: string, id: string, data: Record<string, unknown>): Promise<unknown | null>;
  softDelete(workspaceId: string, id: string): Promise<void>;
  distinctCategories(workspaceId: string): Promise<string[]>;
  existsAll(workspaceId: string, ids: string[]): Promise<boolean>;
  countByWorkspace(workspaceId: string): Promise<number>;
  listAllIds(workspaceId: string): Promise<Set<string>>;
  deleteByWorkspaceId(workspaceId: string): Promise<number>;
}
