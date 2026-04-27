import { buildAgentExportPayload, AGENT_EXPORT_VERSION } from './build-agent-export.js';

describe('buildAgentExportPayload', () => {
  it('inclui metadados, agent, mcpBindings e sections derivados', () => {
    const agent: Record<string, unknown> = {
      id: 'a1',
      name: 'Test',
      goal: 'g1',
      responsibilities: ['r1'],
      systemInstruction: 'si',
      systemRole: 'team-crafter',
      qualityCriteria: ['q1'],
      capabilities: { tools: ['web_search'] },
    };
    const mcp = [{ id: 'b1' }];

    const p = buildAgentExportPayload(agent, mcp);
    expect(p.exportVersion).toBe(AGENT_EXPORT_VERSION);
    expect(p.exportKind).toBe('agent');
    expect(p.agent).toEqual({
      ...agent,
      capabilities: {
        tools: ['web_search'],
        platformBuiltInTools: [],
        openaiBuiltInTools: [],
        customToolDefinitionIds: [],
      },
      knowledge: undefined,
      security: undefined,
      channelConfig: undefined,
    });
    expect(p.mcpBindings).toBe(mcp);
    expect(p.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(p.sections.mission).toEqual({ goal: 'g1', responsibilities: ['r1'] });
    expect(p.sections.system).toEqual({
      systemInstruction: 'si',
      systemRole: 'team-crafter',
      openaiRuntimeModel: undefined,
    });
    expect(p.sections.quality).toEqual({ qualityCriteria: ['q1'], reuseHints: undefined });
  });

  it('preserva runtime completo com capabilities normalizadas', () => {
    const agent: Record<string, unknown> = {
      id: 'agent-1',
      name: 'Especialista CRM',
      role: 'specialist',
      openaiRuntimeModel: 'gpt-5.4-mini',
      capabilities: {
        tools: ['legacy.tool', 'legacy.tool'],
        platformBuiltInTools: ['crm.search_customer'],
        openaiBuiltInTools: ['web_search', 'file_search'],
        customToolDefinitionIds: ['custom-tool-1'],
      },
      knowledge: {
        sources: ['source-1'],
        useSessionMemory: true,
        usePersistentMemory: false,
      },
      security: {
        requiresApproval: true,
        accessLevel: 'write',
      },
      channelConfig: {
        telegram: { enabled: true },
      },
    };
    const mcpBindings = [{ mcpConnectionId: 'mcp-1', allowedTools: ['crm.search_customer'] }];

    const payload = buildAgentExportPayload(agent, mcpBindings);
    expect(payload.agent.capabilities).toEqual({
      tools: ['legacy.tool'],
      platformBuiltInTools: ['crm.search_customer'],
      openaiBuiltInTools: ['web_search', 'file_search'],
      customToolDefinitionIds: ['custom-tool-1'],
    });
    expect(payload.sections.runtime.capabilities).toEqual(payload.agent.capabilities);
    expect(payload.sections.runtime.knowledge).toEqual(agent.knowledge);
    expect(payload.sections.runtime.security).toEqual(agent.security);
    expect(payload.sections.runtime.channelConfig).toEqual(agent.channelConfig);
    expect(payload.sections.runtime.openaiRuntimeModel).toBe('gpt-5.4-mini');
    expect(payload.sections.runtime.mcpBindings).toEqual(mcpBindings);
  });
});
