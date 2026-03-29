import { Types } from 'mongoose';
import { TeamGraphModel } from './team-graph.model.js';

export class TeamGraphRepository {
  async get(workspaceId: string, teamId: string) {
    const doc = (await TeamGraphModel.findOne({
      workspaceId: new Types.ObjectId(workspaceId),
      teamId: new Types.ObjectId(teamId),
    }).lean()) as { nodes?: unknown[]; edges?: unknown[] } | null;
    if (!doc) return { nodes: [], edges: [] };
    return { nodes: doc.nodes ?? [], edges: doc.edges ?? [] };
  }

  async upsert(workspaceId: string, teamId: string, nodes: unknown[], edges: unknown[]) {
    await TeamGraphModel.findOneAndUpdate(
      { workspaceId: new Types.ObjectId(workspaceId), teamId: new Types.ObjectId(teamId) },
      { $set: { nodes, edges, updatedAt: new Date() } },
      { upsert: true, new: true },
    );
  }
}
