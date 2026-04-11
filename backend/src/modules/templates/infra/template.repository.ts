import { Types } from 'mongoose';
import { AgentModel } from '../../agents/infra/agent.model.js';
import type { AgentDoc } from '../../agents/infra/agent.model.js';
import { TeamModel } from '../../teams/infra/team.model.js';
import type { TeamDoc } from '../../teams/infra/team.model.js';
import { TeamGraphModel } from '../../graphs/infra/team-graph.model.js';
import type { TeamGraphDoc } from '../../graphs/infra/team-graph.model.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { TemplateModel } from './template.model.js';
import type { TemplateDoc } from './template.model.js';

function notDeleted() {
  return { $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }] };
}

function toListItem(doc: TemplateDoc) {
  const tc = (doc.teamConfig as Record<string, unknown>) ?? {};
  const d = doc as TemplateDoc & {
    vertical?: string;
    prerequisites?: string[];
    applyBehavior?: string;
  };
  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description,
    version: doc.version,
    origin: doc.origin,
    category: doc.category,
    agentCount: doc.agentCount,
    vertical: typeof d.vertical === 'string' ? d.vertical : '',
    prerequisites: Array.isArray(d.prerequisites) ? d.prerequisites : [],
    applyBehavior: typeof d.applyBehavior === 'string' ? d.applyBehavior : '',
    teamConfig: {
      name: tc['name'] ?? doc.name,
      description: tc['description'] ?? doc.description,
    },
  };
}

export class TemplateRepository {
  async list(
    workspaceId: string,
    filters: { origin?: string; category?: string; search?: string },
  ) {
    const q: Record<string, unknown> = { workspaceId: new Types.ObjectId(workspaceId) };
    if (filters.origin) q.origin = filters.origin;
    if (filters.category) q.category = filters.category;
    if (filters.search) {
      const rx = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      q.$or = [{ name: rx }, { description: rx }];
    }
    const docs = await TemplateModel.find(q).sort({ name: 1 }).exec();
    return docs.map((d) => toListItem(d as TemplateDoc));
  }

  async findById(workspaceId: string, id: string) {
    const doc = await TemplateModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    if (!doc) return null;
    const d = doc as TemplateDoc & {
      vertical?: string;
      prerequisites?: string[];
      applyBehavior?: string;
    };
    const tc = (d.teamConfig as Record<string, unknown>) ?? {};
    const agents = (d.agentsSnapshot as Array<{ id?: string; name?: string; role?: string }>) ?? [];
    return {
      id: d._id.toString(),
      name: d.name,
      description: d.description,
      version: d.version,
      origin: d.origin,
      category: d.category,
      agentCount: d.agentCount,
      vertical: typeof d.vertical === 'string' ? d.vertical : '',
      prerequisites: Array.isArray(d.prerequisites) ? d.prerequisites : [],
      applyBehavior: typeof d.applyBehavior === 'string' ? d.applyBehavior : '',
      teamConfig: {
        name: tc['name'] ?? d.name,
        description: tc['description'] ?? d.description,
      },
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
      })),
      graph: d.graph ?? { nodes: [], edges: [] },
    };
  }

  async deleteCompany(workspaceId: string, id: string) {
    const r = await TemplateModel.deleteOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
      origin: 'company',
    });
    return r.deletedCount === 1;
  }

  async saveFromTeam(
    workspaceId: string,
    input: { teamId: string; name: string; description: string; category: string },
  ) {
    const team = (await TeamModel.findOne({
      _id: input.teamId,
      workspaceId: new Types.ObjectId(workspaceId),
    })
      .lean()
      .exec()) as TeamDoc | null;
    if (!team) return null;

    const graphDoc = (await TeamGraphModel.findOne({
      teamId: team._id,
      workspaceId: new Types.ObjectId(workspaceId),
    })
      .lean()
      .exec()) as TeamGraphDoc | null;

    const agentIds = (team.agentIds ?? []) as Types.ObjectId[];
    const coordId = team.coordinatorId as Types.ObjectId;
    const allIds = [...new Set([coordId.toString(), ...agentIds.map((x) => x.toString())])];
    const agents = (await AgentModel.find({
      _id: { $in: allIds.map((i) => new Types.ObjectId(i)) },
      workspaceId: new Types.ObjectId(workspaceId),
      ...notDeleted(),
    })
      .lean()
      .exec()) as unknown as AgentDoc[];

    const agentsSnapshot = agents.map((a) => ({
      id: a._id.toString(),
      name: a.name,
      role: a.role,
    }));

    const doc = await TemplateModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      origin: 'company',
      name: input.name,
      description: input.description,
      category: input.category,
      version: '1.0.0',
      agentCount: agents.length,
      teamConfig: {
        name: team.name,
        description: team.description,
        objective: team.objective,
      },
      graph: graphDoc
        ? { nodes: graphDoc.nodes ?? [], edges: graphDoc.edges ?? [] }
        : { nodes: [], edges: [] },
      agentsSnapshot,
    });

    return {
      id: doc._id.toString(),
      name: doc.name,
      description: doc.description,
      version: doc.version,
      origin: doc.origin,
      category: doc.category,
      agentCount: doc.agentCount,
    };
  }

  async apply(
    workspaceId: string,
    templateId: string,
    input: { teamName: string; teamDescription?: string; channelIds: string[] },
  ) {
    const tpl = (await TemplateModel.findOne({
      _id: templateId,
      workspaceId: new Types.ObjectId(workspaceId),
    })
      .lean()
      .exec()) as TemplateDoc | null;
    if (!tpl) return null;

    const coord = (await AgentModel.findOne({
      workspaceId: new Types.ObjectId(workspaceId),
      role: 'coordinator',
      ...notDeleted(),
    })
      .sort({ name: 1 })
      .lean()
      .exec()) as AgentDoc | null;

    if (!coord) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Nenhum agente coordenador no workspace',
        400,
      );
    }

    const snap = (tpl.agentsSnapshot as Array<{ name?: string }>) ?? [];
    const nameToAgentId = new Map<string, string>();
    for (const s of snap) {
      if (!s.name) continue;
      const ag = (await AgentModel.findOne({
        workspaceId: new Types.ObjectId(workspaceId),
        name: s.name,
        ...notDeleted(),
      })
        .lean()
        .exec()) as AgentDoc | null;
      if (ag) nameToAgentId.set(s.name.toLowerCase(), ag._id.toString());
    }

    const team = await TeamModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      name: input.teamName,
      description: input.teamDescription ?? (tpl.teamConfig as { description?: string })?.description ?? '',
      status: 'draft',
      coordinatorId: coord._id,
      agentIds: [...new Set(nameToAgentId.values())].map((id) => new Types.ObjectId(id)),
      channelIds: input.channelIds.map((id) => new Types.ObjectId(id)),
    });

    const g = tpl.graph as { nodes?: unknown[]; edges?: unknown[] } | undefined;

    await TeamGraphModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      teamId: team._id,
      nodes: g?.nodes ?? [],
      edges: g?.edges ?? [],
    });

    return {
      teamId: team._id.toString(),
      name: team.name,
      status: team.status,
      message: 'Time criado a partir do template',
    };
  }
}
