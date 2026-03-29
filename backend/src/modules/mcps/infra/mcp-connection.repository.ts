import { Types } from 'mongoose';
import { McpConnectionModel } from './mcp-connection.model.js';
import type { McpConnectionDoc } from './mcp-connection.model.js';

export const MOCK_SYNCED_TOOLS = [
  { name: 'consultar_nota', description: 'Consulta NF-e pelo numero ou chave de acesso' },
  { name: 'validar_documento', description: 'Valida XML de documento fiscal' },
  { name: 'emitir_nfe', description: 'Emite nova nota fiscal eletronica' },
  { name: 'cancelar_nfe', description: 'Cancela nota fiscal emitida' },
];

function toPublic(doc: McpConnectionDoc, withConfig = false) {
  const base: Record<string, unknown> = {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description,
    status: doc.status,
    tools: doc.tools ?? [],
    tenantId: doc.workspaceId.toString(),
    icon: doc.icon,
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
  };
  if (withConfig) base['config'] = doc.config ?? {};
  return base;
}

export class McpConnectionRepository {
  async list(workspaceId: string, filters: { status?: string; search?: string }) {
    const and: Record<string, unknown>[] = [{ workspaceId: new Types.ObjectId(workspaceId) }];
    if (filters.status) and.push({ status: filters.status });
    if (filters.search) {
      const rx = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      and.push({ $or: [{ name: rx }, { description: rx }] });
    }
    const q = and.length > 1 ? { $and: and } : { workspaceId: new Types.ObjectId(workspaceId) };
    const docs = await McpConnectionModel.find(q).sort({ name: 1 }).exec();
    return docs.map((d) => toPublic(d as McpConnectionDoc, false));
  }

  async findById(workspaceId: string, id: string, withConfig = false) {
    const doc = await McpConnectionModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    return doc ? toPublic(doc as McpConnectionDoc, withConfig) : null;
  }

  async getToolNames(workspaceId: string, id: string): Promise<Set<string>> {
    const doc = await McpConnectionModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    })
      .select('tools')
      .lean();
    if (!doc) return new Set();
    const tools = (doc as { tools?: Array<{ name: string }> }).tools ?? [];
    return new Set(tools.map((t) => t.name));
  }

  async create(
    workspaceId: string,
    input: { name: string; description?: string; icon?: string; config: Record<string, unknown> },
  ) {
    const doc = await McpConnectionModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      name: input.name,
      description: input.description ?? '',
      icon: input.icon ?? 'plug',
      status: 'pending',
      tools: [],
      config: input.config,
    });
    return toPublic(doc as McpConnectionDoc, true);
  }

  async update(workspaceId: string, id: string, input: { name?: string; description?: string }) {
    const doc = await McpConnectionModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      { $set: input },
      { new: true },
    ).exec();
    return doc
      ? {
          id: (doc as McpConnectionDoc)._id.toString(),
          name: (doc as McpConnectionDoc).name,
          description: (doc as McpConnectionDoc).description,
          status: (doc as McpConnectionDoc).status,
        }
      : null;
  }

  async delete(workspaceId: string, id: string) {
    const r = await McpConnectionModel.deleteOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    });
    return r.deletedCount === 1;
  }

  async connect(workspaceId: string, id: string) {
    await McpConnectionModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      { $set: { status: 'connected' } },
    ).exec();
    return { status: 'connecting' as const, message: 'Conectando ao servico...' };
  }

  async disconnect(workspaceId: string, id: string) {
    const doc = await McpConnectionModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      { $set: { status: 'disconnected', disconnectedAt: new Date() } },
      { new: true },
    ).exec();
    if (!doc) return null;
    const d = doc as McpConnectionDoc;
    return {
      id: d._id.toString(),
      status: d.status,
      disconnectedAt: (d.disconnectedAt ?? new Date()).toISOString(),
    };
  }

  async syncTools(workspaceId: string, id: string) {
    const syncedAt = new Date().toISOString();
    await McpConnectionModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      { $set: { tools: MOCK_SYNCED_TOOLS, status: 'connected' } },
    ).exec();
    return {
      toolsCount: MOCK_SYNCED_TOOLS.length,
      syncedAt,
      tools: MOCK_SYNCED_TOOLS,
    };
  }
}
