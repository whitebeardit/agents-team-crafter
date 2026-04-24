import { Types } from 'mongoose';
import type { IAgentListFilters, IAgentRepository } from '../domain/ports/agent-repository.port.js';
import { AgentModel } from './agent.model.js';
import type { AgentDoc } from './agent.model.js';
import { normalizeAgentCategory } from '../../../shared/utils/agent-category.js';

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
    domain: doc.domain,
    qualityCriteria: doc.qualityCriteria ?? [],
    reuseHints: doc.reuseHints ?? [],
    platformManaged: doc.platformManaged ?? false,
    systemRole: doc.systemRole ?? null,
    systemInstruction: doc.systemInstruction,
    ...(doc.openaiRuntimeModel ? { openaiRuntimeModel: doc.openaiRuntimeModel } : {}),
    capabilities: doc.capabilities,
    knowledge: doc.knowledge,
    channelConfig: doc.channelConfig,
    security: doc.security,
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
  if (filters.category) and.push({ category: normalizeAgentCategory(filters.category) });
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
    const setPayload: Record<string, unknown> = { ...data, version: nextVersion };
    const unset: Record<string, 1> = {};
    if (Object.prototype.hasOwnProperty.call(setPayload, 'openaiRuntimeModel') && setPayload.openaiRuntimeModel === null) {
      delete setPayload.openaiRuntimeModel;
      unset.openaiRuntimeModel = 1;
    }
    const updateDoc =
      Object.keys(unset).length > 0
        ? { $set: setPayload, $unset: unset }
        : { $set: setPayload };
    const doc = await AgentModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      updateDoc,
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
    const raw = vals.filter(Boolean) as string[];
    const canonical = [...new Set(raw.map((c) => normalizeAgentCategory(String(c))))];
    canonical.sort();
    return canonical;
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

  async listByWorkspace(workspaceId: string) {
    const docs = await AgentModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      $and: [notDeleted()],
    })
      .sort({ updatedAt: -1 })
      .exec();
    return docs.map((doc) => toPublic(doc as AgentDoc));
  }

  async countByWorkspace(workspaceId: string) {
    return AgentModel.countDocuments({
      workspaceId: new Types.ObjectId(workspaceId),
      $and: [notDeleted()],
    });
  }

  async deleteByWorkspaceId(workspaceId: string): Promise<number> {
    const res = await AgentModel.deleteMany({
      workspaceId: new Types.ObjectId(workspaceId),
    });
    return res.deletedCount ?? 0;
  }
}
