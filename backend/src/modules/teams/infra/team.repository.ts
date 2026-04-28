import { Types } from 'mongoose';
import type { ITeamAgentRef, ITeamRepository } from '../domain/ports/team-repository.port.js';
import { TeamModel } from './team.model.js';
import type { TeamDoc } from './team.model.js';
import { TeamGraphModel } from '../../graphs/infra/team-graph.model.js';

function toPublic(doc: TeamDoc, extras: Record<string, unknown> = {}) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description,
    objective: doc.objective,
    status: doc.status,
    coordinatorId: doc.coordinatorId.toString(),
    agentIds: (doc.agentIds ?? []).map((x) => x.toString()),
    channelIds: (doc.channelIds ?? []).map((x) => x.toString()),
    primaryChannel: doc.primaryChannel,
    singleAgentMode: doc.singleAgentMode === true,
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
    ...extras,
  };
}

export class TeamRepository implements ITeamRepository {
  async list(workspaceId: string, filters: { status?: string; search?: string }, page: number, perPage: number) {
    const and: Record<string, unknown>[] = [{ workspaceId: new Types.ObjectId(workspaceId) }];
    if (filters.status) and.push({ status: filters.status });
    if (filters.search) {
      const rx = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      and.push({ $or: [{ name: rx }, { description: rx }] });
    }
    const q = and.length > 1 ? { $and: and } : { workspaceId: new Types.ObjectId(workspaceId) };
    const skip = (page - 1) * perPage;
    const [docs, total] = await Promise.all([
      TeamModel.find(q).sort({ updatedAt: -1 }).skip(skip).limit(perPage),
      TeamModel.countDocuments(q),
    ]);
    return { items: docs.map((d) => toPublic(d as TeamDoc)), total };
  }

  async findById(workspaceId: string, id: string) {
    const doc = await TeamModel.findOne({ _id: id, workspaceId: new Types.ObjectId(workspaceId) });
    return doc ? toPublic(doc as TeamDoc) : null;
  }

  /** Mapa teamId → nome para enriquecer métricas (ex.: SLO por time). */
  async findNamesByIds(workspaceId: string, teamIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const unique = [...new Set(teamIds)].filter(Boolean);
    if (unique.length === 0) return map;
    const docs = await TeamModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      _id: { $in: unique.map((id) => new Types.ObjectId(id)) },
    })
      .select({ _id: 1, name: 1 })
      .lean();
    for (const d of docs) {
      map.set(String(d._id), String(d.name));
    }
    return map;
  }

  async create(workspaceId: string, data: Record<string, unknown>) {
    const payload: Record<string, unknown> = {
      workspaceId: new Types.ObjectId(workspaceId),
      name: data.name,
      description: data.description ?? '',
      objective: data.objective,
      status: data.status ?? 'draft',
      coordinatorId: new Types.ObjectId(String(data.coordinatorId)),
      agentIds: (data.agentIds as string[]).map((id) => new Types.ObjectId(id)),
      channelIds: ((data.channelIds as string[]) ?? []).map((id) => new Types.ObjectId(id)),
      primaryChannel: data.primaryChannel,
      singleAgentMode: data.singleAgentMode === true,
    };
    const doc = await TeamModel.create(payload);
    return toPublic(doc as TeamDoc);
  }

  async update(workspaceId: string, id: string, data: Record<string, unknown>) {
    const set: Record<string, unknown> = { ...data };
    if (data.coordinatorId) set.coordinatorId = new Types.ObjectId(String(data.coordinatorId));
    if (data.agentIds) set.agentIds = (data.agentIds as string[]).map((x) => new Types.ObjectId(x));
    if (data.channelIds) set.channelIds = (data.channelIds as string[]).map((x) => new Types.ObjectId(x));
    const doc = await TeamModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      { $set: set },
      { new: true },
    );
    return doc ? toPublic(doc as TeamDoc) : null;
  }

  async delete(workspaceId: string, id: string) {
    await TeamModel.deleteOne({ _id: id, workspaceId: new Types.ObjectId(workspaceId) });
    await TeamGraphModel.deleteOne({
      workspaceId: new Types.ObjectId(workspaceId),
      teamId: new Types.ObjectId(id),
    });
  }

  async findLean(workspaceId: string, id: string) {
    return TeamModel.findOne({ _id: id, workspaceId: new Types.ObjectId(workspaceId) }).lean();
  }

  /**
   * Times ativos (exceto `excludeTeamId`) que compartilham algum dos channelIds informados.
   */
  async findActiveTeamsConflictingChannelIds(
    workspaceId: string,
    channelIds: string[],
    excludeTeamId?: string,
  ): Promise<Array<{ id: string; name: string }>> {
    if (channelIds.length === 0) return [];
    const filter: Record<string, unknown> = {
      workspaceId: new Types.ObjectId(workspaceId),
      status: 'active',
      channelIds: { $in: channelIds.map((id) => new Types.ObjectId(id)) },
    };
    if (excludeTeamId) {
      filter._id = { $ne: new Types.ObjectId(excludeTeamId) };
    }
    const docs = await TeamModel.find(filter).select('_id name').lean();
    return docs.map((d) => ({
      id: String((d as { _id: Types.ObjectId })._id),
      name: String((d as { name?: string }).name ?? ''),
    }));
  }

  /** Times do workspace que referenciam o agente como coordenador ou membro. */
  async findTeamsReferencingAgent(workspaceId: string, agentId: string): Promise<ITeamAgentRef[]> {
    const oid = new Types.ObjectId(agentId);
    const docs = await TeamModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      $or: [{ coordinatorId: oid }, { agentIds: oid }],
    })
      .select('_id name coordinatorId')
      .lean();
    return docs.map((d) => {
      const row = d as unknown as { _id: Types.ObjectId; name?: string; coordinatorId: Types.ObjectId };
      return {
        id: String(row._id),
        name: String(row.name ?? ''),
        asCoordinator: String(row.coordinatorId) === agentId,
      };
    });
  }

  /** Qualquer time do workspace que referencia o canal em `channelIds` (qualquer status). */
  async findTeamsWithChannelId(workspaceId: string, channelId: string) {
    const docs = await TeamModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      channelIds: new Types.ObjectId(channelId),
    })
      .select('_id name')
      .lean();
    return docs.map((d) => {
      const row = d as { _id: Types.ObjectId; name?: string };
      return {
        id: String(row._id),
        name: String(row.name ?? ''),
      };
    });
  }

  /** Times ativos que incluem o canal (documento Channel) nos channelIds. */
  async findActiveTeamsWithChannelId(workspaceId: string, channelId: string) {
    const docs = await TeamModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      status: 'active',
      channelIds: new Types.ObjectId(channelId),
    }).lean();
    return docs.map((d) => {
      const row = d as unknown as {
        _id: Types.ObjectId;
        coordinatorId: Types.ObjectId;
        name?: string;
      };
      return {
        id: String(row._id),
        coordinatorId: String(row.coordinatorId),
        name: String(row.name ?? ''),
      };
    });
  }

  async duplicate(workspaceId: string, teamId: string, name: string) {
    const src = (await TeamModel.findOne({
      _id: teamId,
      workspaceId: new Types.ObjectId(workspaceId),
    }).lean()) as TeamDoc | null;
    if (!src) return null;
    const copy = await TeamModel.create({
      workspaceId: src.workspaceId,
      name,
      description: src.description,
      objective: src.objective,
      status: 'draft',
      coordinatorId: src.coordinatorId,
      agentIds: src.agentIds ?? [],
      channelIds: src.channelIds ?? [],
      primaryChannel: src.primaryChannel,
      singleAgentMode: src.singleAgentMode === true,
    });
    const g = (await TeamGraphModel.findOne({
      teamId: src._id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).lean()) as { nodes?: unknown[]; edges?: unknown[] } | null;
    if (g) {
      await TeamGraphModel.create({
        workspaceId: new Types.ObjectId(workspaceId),
        teamId: copy._id,
        nodes: g.nodes ?? [],
        edges: g.edges ?? [],
      });
    }
    return toPublic(copy as TeamDoc);
  }

  async deleteByWorkspaceId(workspaceId: string): Promise<number> {
    const workspaceObjectId = new Types.ObjectId(workspaceId);
    await TeamGraphModel.deleteMany({ workspaceId: workspaceObjectId });
    const res = await TeamModel.deleteMany({ workspaceId: workspaceObjectId });
    return res.deletedCount ?? 0;
  }
}
