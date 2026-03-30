import type { AgentMcpBindingRepository } from '../../agents/infra/agent-mcp-binding.repository.js';
import type { McpConnectionRepository } from '../../mcps/infra/mcp-connection.repository.js';
import type { IMcpToolSpec } from '../ports/agent-runtime.provider.js';

/**
 * Expande vínculos MCP do agente em especificações para function tools do SDK.
 */
export async function loadMcpToolSpecsForAgent(
  workspaceId: string,
  agentId: string,
  bindingRepo: AgentMcpBindingRepository,
  mcpRepo: McpConnectionRepository,
): Promise<IMcpToolSpec[]> {
  const bindings = await bindingRepo.listByAgent(workspaceId, agentId);
  const specs: IMcpToolSpec[] = [];

  for (const b of bindings) {
    const mcp = await mcpRepo.findById(workspaceId, b.mcpConnectionId, true);
    const tools = (mcp?.tools as Array<{ name: string; description?: string }>) ?? [];
    const byName = new Map(tools.map((t) => [t.name, t.description?.trim() ?? '']));
    const cfg = (mcp?.config as Record<string, unknown> | undefined) ?? {};
    const mcpHttpUrl = typeof cfg.mcpHttpUrl === 'string' ? cfg.mcpHttpUrl.trim() : undefined;
    const mcpHttpHeaders =
      cfg.mcpHttpHeaders && typeof cfg.mcpHttpHeaders === 'object' && cfg.mcpHttpHeaders !== null
        ? (cfg.mcpHttpHeaders as Record<string, string>)
        : undefined;

    for (const toolName of b.allowedTools) {
      specs.push({
        bindingId: b.id,
        mcpConnectionId: b.mcpConnectionId,
        mcpDisplayName: b.mcpConnection.name || 'MCP',
        toolName,
        toolDescription: byName.get(toolName) || `MCP tool ${toolName}`,
        requiresApproval: b.requiresApproval,
        ...(mcpHttpUrl ? { mcpHttpEndpoint: mcpHttpUrl, mcpHttpHeaders } : {}),
      });
    }
  }

  return specs;
}
