import { Types } from 'mongoose';
import { WorkspaceToolDefinitionModel } from './workspace-tool-definition.model.js';
import type { WorkspaceToolDefinitionDoc } from './workspace-tool-definition.model.js';

export class WorkspaceToolDefinitionRepository {
  async list(workspaceId: string) {
    const docs = await WorkspaceToolDefinitionModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
    })
      .sort({ name: 1 })
      .exec();
    return docs.map((d) => this.toPublic(d as WorkspaceToolDefinitionDoc));
  }

  async listByIds(workspaceId: string, ids: string[]) {
    if (ids.length === 0) return [];
    const oids = ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    const docs = await WorkspaceToolDefinitionModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      _id: { $in: oids },
      enabled: true,
    }).exec();
    return docs.map((d) => this.toPublic(d as WorkspaceToolDefinitionDoc));
  }

  async findById(workspaceId: string, id: string) {
    const doc = await WorkspaceToolDefinitionModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    return doc ? this.toPublic(doc as WorkspaceToolDefinitionDoc) : null;
  }

  async create(
    workspaceId: string,
    input: {
      name: string;
      slug: string;
      kind: 'builtin_ref' | 'http_webhook' | 'mcp_ref';
      jsonSchema?: Record<string, unknown>;
      config?: Record<string, unknown>;
    },
  ) {
    const doc = await WorkspaceToolDefinitionModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase().replace(/\s+/g, '-'),
      kind: input.kind,
      jsonSchema: input.jsonSchema ?? {},
      config: input.config ?? {},
      enabled: true,
    });
    return this.toPublic(doc as WorkspaceToolDefinitionDoc);
  }

  async update(
    workspaceId: string,
    id: string,
    input: Partial<{
      name: string;
      slug: string;
      kind: 'builtin_ref' | 'http_webhook' | 'mcp_ref';
      jsonSchema: Record<string, unknown>;
      config: Record<string, unknown>;
      enabled: boolean;
    }>,
  ) {
    const doc = await WorkspaceToolDefinitionModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      { $set: input },
      { new: true },
    ).exec();
    return doc ? this.toPublic(doc as WorkspaceToolDefinitionDoc) : null;
  }

  async delete(workspaceId: string, id: string) {
    const r = await WorkspaceToolDefinitionModel.deleteOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    });
    return r.deletedCount === 1;
  }

  private toPublic(d: WorkspaceToolDefinitionDoc) {
    return {
      id: d._id.toString(),
      name: d.name,
      slug: d.slug,
      kind: d.kind,
      jsonSchema: (d.jsonSchema as Record<string, unknown>) ?? {},
      config: (d.config as Record<string, unknown>) ?? {},
      enabled: d.enabled ?? true,
      createdAt: d.createdAt?.toISOString(),
      updatedAt: d.updatedAt?.toISOString(),
    };
  }
}
