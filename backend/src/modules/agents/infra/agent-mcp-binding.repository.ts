import { Types } from 'mongoose';
import { AgentMcpBindingModel } from './agent-mcp-binding.model.js';
import type { AgentMcpBindingDoc } from './agent-mcp-binding.model.js';
import { McpConnectionModel } from '../../mcps/infra/mcp-connection.model.js';
import type { McpConnectionRepository } from '../../mcps/infra/mcp-connection.repository.js';

export class AgentMcpBindingRepository {
  constructor(private readonly mcpRepo: McpConnectionRepository) {}

  async listByAgent(workspaceId: string, agentId: string) {
    const docs = await AgentMcpBindingModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      agentId: new Types.ObjectId(agentId),
    })
      .sort({ createdAt: 1 })
      .exec();

    const out = [];
    for (const raw of docs) {
      const b = raw as AgentMcpBindingDoc;
      const mcp = await McpConnectionModel.findById(b.mcpConnectionId).select('name status').lean();
      const m = mcp as { name?: string; status?: string } | null;
      out.push({
        id: b._id.toString(),
        agentId: b.agentId.toString(),
        mcpConnectionId: b.mcpConnectionId.toString(),
        mcpConnection: m
          ? {
              id: b.mcpConnectionId.toString(),
              name: m.name ?? '',
              status: m.status ?? 'pending',
            }
          : {
              id: b.mcpConnectionId.toString(),
              name: '',
              status: 'pending',
            },
        allowedTools: b.allowedTools ?? [],
        requiresApproval: b.requiresApproval ?? false,
        createdAt: b.createdAt?.toISOString(),
      });
    }
    return out;
  }

  async create(
    workspaceId: string,
    agentId: string,
    input: { mcpConnectionId: string; allowedTools: string[]; requiresApproval: boolean },
  ) {
    const allowed = await this.mcpRepo.getToolNames(workspaceId, input.mcpConnectionId);
    for (const t of input.allowedTools) {
      if (!allowed.has(t)) {
        return { error: 'INVALID_TOOL' as const, tool: t };
      }
    }
    const doc = await AgentMcpBindingModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      agentId: new Types.ObjectId(agentId),
      mcpConnectionId: new Types.ObjectId(input.mcpConnectionId),
      allowedTools: input.allowedTools,
      requiresApproval: input.requiresApproval,
    });
    const b = doc as AgentMcpBindingDoc;
    return {
      ok: true as const,
      data: {
        id: b._id.toString(),
        agentId: b.agentId.toString(),
        mcpConnectionId: b.mcpConnectionId.toString(),
        allowedTools: b.allowedTools ?? [],
        requiresApproval: b.requiresApproval ?? false,
        createdAt: b.createdAt?.toISOString(),
      },
    };
  }

  async update(
    workspaceId: string,
    agentId: string,
    bindingId: string,
    input: { allowedTools?: string[]; requiresApproval?: boolean },
  ) {
    const cur = await AgentMcpBindingModel.findOne({
      _id: bindingId,
      workspaceId: new Types.ObjectId(workspaceId),
      agentId: new Types.ObjectId(agentId),
    }).exec();
    if (!cur) return null;
    const b = cur as AgentMcpBindingDoc;
    if (input.allowedTools) {
      const allowed = await this.mcpRepo.getToolNames(workspaceId, b.mcpConnectionId.toString());
      for (const t of input.allowedTools) {
        if (!allowed.has(t)) {
          return { error: 'INVALID_TOOL' as const, tool: t };
        }
      }
    }
    const set: Record<string, unknown> = {};
    if (input.allowedTools !== undefined) set.allowedTools = input.allowedTools;
    if (input.requiresApproval !== undefined) set.requiresApproval = input.requiresApproval;
    const updated = await AgentMcpBindingModel.findOneAndUpdate(
      { _id: bindingId, workspaceId: new Types.ObjectId(workspaceId), agentId: new Types.ObjectId(agentId) },
      { $set: set },
      { new: true },
    ).exec();
    const u = updated as AgentMcpBindingDoc;
    return {
      ok: true as const,
      data: {
        id: u._id.toString(),
        agentId: u.agentId.toString(),
        mcpConnectionId: u.mcpConnectionId.toString(),
        allowedTools: u.allowedTools ?? [],
        requiresApproval: u.requiresApproval ?? false,
        updatedAt: u.updatedAt?.toISOString(),
      },
    };
  }

  async delete(workspaceId: string, agentId: string, bindingId: string) {
    const r = await AgentMcpBindingModel.deleteOne({
      _id: bindingId,
      workspaceId: new Types.ObjectId(workspaceId),
      agentId: new Types.ObjectId(agentId),
    });
    return r.deletedCount === 1;
  }
}
