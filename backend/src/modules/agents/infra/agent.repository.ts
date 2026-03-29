import { Types } from 'mongoose';
import type { IAgentListFilters, IAgentRepository } from '../domain/ports/agent-repository.port.js';
import { AgentModel } from './agent.model.js';
import type { AgentDoc } from './agent.model.js';

function toPublic(doc: AgentDoc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description,
    role: doc.role,
    origin: doc.origin,
    skills: doc.skills ?? [],
    version: doc.version,
    avatar: doc.avatar,
    category: doc.category,
    channels: doc.channels ?? [],
    status: doc.status,
    goal: doc.goal,
    responsibilities: doc.responsibilities,
    systemInstruction: doc.systemInstruction,
    capabilities: doc.capabilities,
    knowledge: doc.knowledge,
    channelConfig: doc.channelConfig,
    security: doc.security,
    handoff: doc.handoff,
    documentation: doc.documentation,
    changelog: doc.changelog,
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
  };
}

function bumpVersion(v: string): string {
  const parts = v.split('.');
  if (parts.length !== 3) return v;
  const patch = parseInt(parts[2] ?? '0', 10);
  if (Number.isNaN(patch)) return v;
  return `${parts[0]}.${parts[1]}.${patch + 1}`;
}

function notDeleted() {
  return { $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }] };
}

function buildListFilter(workspaceId: string, filters: IAgentListFilters) {
  const and: Record<string, unknown>[] = [
    { workspaceId: new Types.ObjectId(workspaceId) },
    notDeleted(),
  ];
  if (filters.origin) and.push({ origin: filters.origin });
  if (filters.category) and.push({ category: filters.category });
  if (filters.role) and.push({ role: filters.role });
  if (filters.channel) and.push({ channels: filters.channel });
  if (filters.search) {
    const rx = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    and.push({ $or: [{ name: rx }, { description: rx }] });
  }
  return { $and: and };
}

export class AgentRepository implements IAgentRepository {
  async list(workspaceId: string, filters: IAgentListFilters, page: number, perPage: number) {
    const q = buildListFilter(workspaceId, filters);
    const skip = (page - 1) * perPage;
    const [docs, total] = await Promise.all([
      AgentModel.find(q).sort({ updatedAt: -1 }).skip(skip).limit(perPage).exec(),
      AgentModel.countDocuments(q),
    ]);
    return { items: docs.map((d) => toPublic(d as AgentDoc)), total };
  }

  async findById(workspaceId: string, id: string) {
    const doc = await AgentModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
      $and: [notDeleted()],
    });
    return doc ? toPublic(doc as AgentDoc) : null;
  }


  async create(workspaceId: string, data: Record<string, unknown>) {
    const doc = await AgentModel.create({
      ...data,
      workspaceId: new Types.ObjectId(workspaceId),
    });
    return toPublic(doc as AgentDoc);
  }

  async update(workspaceId: string, id: string, data: Record<string, unknown>) {
    const current = await AgentModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
      $and: [notDeleted()],
    });
    if (!current) return null;
    const nextVersion = bumpVersion((current as AgentDoc).version ?? '1.0.0');
    const doc = await AgentModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      { $set: { ...data, version: nextVersion } },
      { new: true },
    );
    return doc ? toPublic(doc as AgentDoc) : null;
  }

  async softDelete(workspaceId: string, id: string) {
    await AgentModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId), origin: 'company' },
      { $set: { deletedAt: new Date(), status: 'archived' } },
    );
  }

  async distinctCategories(workspaceId: string) {
    const vals = await AgentModel.distinct('category', {
      workspaceId: new Types.ObjectId(workspaceId),
      $and: [notDeleted()],
    });
    return vals.filter(Boolean).sort() as string[];
  }

  async existsAll(workspaceId: string, ids: string[]) {
    if (ids.length === 0) return true;
    const count = await AgentModel.countDocuments({
      _id: { $in: ids.map((i) => new Types.ObjectId(i)) },
      workspaceId: new Types.ObjectId(workspaceId),
      $and: [notDeleted()],
    });
    return count === ids.length;
  }

  async listAllIds(workspaceId: string): Promise<Set<string>> {
    const docs = await AgentModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      $and: [notDeleted()],
    })
      .select('_id')
      .lean();
    return new Set(docs.map((d) => String((d as { _id: unknown })._id)));
  }

  async countByWorkspace(workspaceId: string) {
    return AgentModel.countDocuments({
      workspaceId: new Types.ObjectId(workspaceId),
      $and: [notDeleted()],
    });
  }
}
