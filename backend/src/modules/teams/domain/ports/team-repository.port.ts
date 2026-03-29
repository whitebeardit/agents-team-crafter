export interface ITeamAgentRef {
  id: string;
  name: string;
  asCoordinator: boolean;
}

export interface ITeamRepository {
  list(workspaceId: string, filters: { status?: string; search?: string }, page: number, perPage: number): Promise<{ items: unknown[]; total: number }>;
  findById(workspaceId: string, id: string): Promise<unknown | null>;
  create(workspaceId: string, data: Record<string, unknown>): Promise<unknown>;
  update(workspaceId: string, id: string, data: Record<string, unknown>): Promise<unknown | null>;
  delete(workspaceId: string, id: string): Promise<void>;
  duplicate(workspaceId: string, teamId: string, name: string): Promise<unknown | null>;
  findTeamsReferencingAgent(workspaceId: string, agentId: string): Promise<ITeamAgentRef[]>;
}
