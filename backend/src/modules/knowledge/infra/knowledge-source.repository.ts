import { Types } from 'mongoose';
import { KnowledgeSourceModel } from './knowledge-source.model.js';
import type { KnowledgeSourceDoc } from './knowledge-source.model.js';

export class KnowledgeSourceRepository {
  async list(workspaceId: string, filters: { type?: string; status?: string }) {
    const q: Record<string, unknown> = { workspaceId: new Types.ObjectId(workspaceId) };
    if (filters.type) q.type = filters.type;
    if (filters.status) q.status = filters.status;
    const docs = await KnowledgeSourceModel.find(q).sort({ name: 1 }).exec();
    return docs.map((d) => {
      const x = d as KnowledgeSourceDoc;
      return {
        id: x._id.toString(),
        name: x.name,
        type: x.type,
        description: x.description,
        status: x.status,
        lastSyncAt: x.lastSyncAt?.toISOString(),
        itemCount: x.itemCount ?? 0,
      };
    });
  }

  async findById(workspaceId: string, id: string) {
    const doc = await KnowledgeSourceModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    if (!doc) return null;
    const x = doc as KnowledgeSourceDoc;
    return {
      id: x._id.toString(),
      name: x.name,
      type: x.type,
      description: x.description,
      status: x.status,
      lastSyncAt: x.lastSyncAt?.toISOString(),
      itemCount: x.itemCount ?? 0,
      config: (x.config as Record<string, unknown>) ?? {},
    };
  }

  async create(
    workspaceId: string,
    input: {
      name: string;
      type: KnowledgeSourceDoc['type'];
      description?: string;
      config: Record<string, unknown>;
    },
  ) {
    const doc = await KnowledgeSourceModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      name: input.name,
      type: input.type,
      description: input.description ?? '',
      status: 'inactive',
      config: input.config,
    });
    const x = doc as KnowledgeSourceDoc;
    return {
      id: x._id.toString(),
      name: x.name,
      type: x.type,
      description: x.description,
      status: x.status,
      createdAt: x.createdAt?.toISOString(),
    };
  }

  async update(
    workspaceId: string,
    id: string,
    input: { name?: string; description?: string },
  ) {
    const doc = await KnowledgeSourceModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      { $set: input },
      { new: true },
    ).exec();
    if (!doc) return null;
    const x = doc as KnowledgeSourceDoc;
    return {
      id: x._id.toString(),
      name: x.name,
      description: x.description,
    };
  }

  async delete(workspaceId: string, id: string) {
    const r = await KnowledgeSourceModel.deleteOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    });
    return r.deletedCount === 1;
  }

  /** Sync assincrono fake: marca syncing e completa em background. */
  async startSync(workspaceId: string, id: string) {
    const startedAt = new Date().toISOString();
    const doc = await KnowledgeSourceModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      { $set: { status: 'syncing' } },
      { new: true },
    ).exec();
    if (!doc) return null;

    setImmediate(() => {
      void KnowledgeSourceModel.findOneAndUpdate(
        { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
        {
          $set: {
            status: 'active',
            lastSyncAt: new Date(),
            itemCount: Math.floor(Math.random() * 500) + 50,
          },
        },
      ).exec();
    });

    return {
      status: 'syncing' as const,
      startedAt,
      estimatedDuration: '5m',
    };
  }
}
