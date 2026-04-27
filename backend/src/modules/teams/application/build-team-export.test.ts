import { describe, expect, it, jest } from '@jest/globals';
import { AGENT_EXPORT_VERSION } from '../../agents/application/build-agent-export.js';
import { buildTeamExportPayload } from './build-team-export.js';

describe('buildTeamExportPayload', () => {
  it('agrega time, grafo, canais e export de cada agente', async () => {
    const team = {
      id: 't1',
      coordinatorId: 'c1',
      agentIds: ['c1', 's1'],
      channelIds: ['ch1'],
    };
    const agentC = { id: 'c1', name: 'Coord' };
    const agentS = { id: 's1', name: 'Spec' };
    const deps = {
      teamRepo: { findById: jest.fn(async () => team) },
      teamGraphRepo: { get: jest.fn(async () => ({ nodes: [{ id: 'n1' }], edges: [] })) },
      channelRepo: {
        listByIds: jest.fn(async () => [
          {
            _id: { toString: () => 'ch1' },
            type: 'api',
            name: 'Ch',
            status: 'connected',
            provider: 'native',
            config: { x: 1 },
          },
        ]),
      },
      agentRepo: {
        findById: jest.fn(async (_ws: string, id: string) => (id === 'c1' ? agentC : id === 's1' ? agentS : null)),
      },
      agentMcpBindingRepo: { listByAgent: jest.fn(async () => []) },
    };

    const p = await buildTeamExportPayload(deps as never, 'ws1', 't1');
    expect(p.exportVersion).toBe(AGENT_EXPORT_VERSION);
    expect(p.exportKind).toBe('team');
    expect(p.team).toBe(team);
    expect(p.graph.nodes).toEqual([{ id: 'n1' }]);
    expect(p.channels[0].id).toBe('ch1');
    expect(p.channelsFull).toBeDefined();
    expect(p.channelsFull![0]!.legacyId).toBe('ch1');
    expect(p.channelsFull![0]!.config).toEqual({ x: 1 });
    expect(p.agents).toHaveLength(2);
    expect(p.agents[0].agent).toEqual({
      ...agentC,
      capabilities: {
        tools: [],
        platformBuiltInTools: [],
        openaiBuiltInTools: [],
        customToolDefinitionIds: [],
      },
      knowledge: undefined,
      security: undefined,
      channelConfig: undefined,
    });
    expect(p.agents[1].agent).toEqual({
      ...agentS,
      capabilities: {
        tools: [],
        platformBuiltInTools: [],
        openaiBuiltInTools: [],
        customToolDefinitionIds: [],
      },
      knowledge: undefined,
      security: undefined,
      channelConfig: undefined,
    });
  });

  it('falha com 422 se agente referenciado nao existir', async () => {
    const team = { id: 't1', coordinatorId: 'c1', agentIds: ['s1'] };
    const deps = {
      teamRepo: { findById: jest.fn(async () => team) },
      teamGraphRepo: { get: jest.fn(async () => ({ nodes: [], edges: [] })) },
      channelRepo: { listByIds: jest.fn(async () => []) },
      agentRepo: {
        findById: jest.fn(async (_ws: string, id: string) => (id === 'c1' ? { id: 'c1' } : null)),
      },
      agentMcpBindingRepo: { listByAgent: jest.fn(async () => []) },
    };

    await expect(buildTeamExportPayload(deps as never, 'ws1', 't1')).rejects.toMatchObject({
      code: 'AGENT_REFS_INCOMPLETE',
      httpStatus: 422,
    });
  });

  it('preserva runtime completo dos agentes no export de time', async () => {
    const team = {
      id: 't1',
      coordinatorId: 'c1',
      agentIds: ['s1'],
      channelIds: ['ch1'],
    };
    const specialistRuntime = {
      capabilities: {
        tools: ['legacy.tool'],
        platformBuiltInTools: ['crm.search_customer'],
        openaiBuiltInTools: ['web_search'],
        customToolDefinitionIds: ['custom-tool-1'],
      },
      knowledge: { sources: ['source-1'], useSessionMemory: true, usePersistentMemory: false },
      security: { requiresApproval: true, accessLevel: 'write' },
      channelConfig: { enabled: ['api'], canReplyDirectly: true },
      openaiRuntimeModel: 'gpt-5.4-mini',
    };
    const deps = {
      teamRepo: { findById: jest.fn(async () => team) },
      teamGraphRepo: { get: jest.fn(async () => ({ nodes: [], edges: [] })) },
      channelRepo: {
        listByIds: jest.fn(async () => [
          {
            _id: { toString: () => 'ch1' },
            type: 'api',
            name: 'Ch',
            status: 'connected',
            provider: 'native',
            config: { x: 1 },
          },
        ]),
      },
      agentRepo: {
        findById: jest.fn(async (_ws: string, id: string) =>
          id === 'c1'
            ? { id: 'c1', name: 'Coord', role: 'coordinator' }
            : { id: 's1', name: 'Spec', role: 'specialist', ...specialistRuntime },
        ),
      },
      agentMcpBindingRepo: {
        listByAgent: jest.fn(async (_ws: string, id: string) =>
          id === 's1' ? [{ mcpConnectionId: 'mcp-1', allowedTools: ['crm.search_customer'] }] : [],
        ),
      },
    };

    const payload = await buildTeamExportPayload(deps as never, 'ws1', 't1');
    const specialist = payload.agents[1]!;
    expect(specialist.agent.capabilities).toEqual(specialistRuntime.capabilities);
    expect(specialist.sections.runtime.capabilities).toEqual(specialistRuntime.capabilities);
    expect(specialist.sections.runtime.knowledge).toEqual(specialistRuntime.knowledge);
    expect(specialist.sections.runtime.security).toEqual(specialistRuntime.security);
    expect(specialist.sections.runtime.channelConfig).toEqual(specialistRuntime.channelConfig);
    expect(specialist.sections.runtime.openaiRuntimeModel).toEqual(specialistRuntime.openaiRuntimeModel);
    expect(specialist.mcpBindings).toEqual([{ mcpConnectionId: 'mcp-1', allowedTools: ['crm.search_customer'] }]);
    expect(specialist.sections.runtime.mcpBindings).toEqual([
      { mcpConnectionId: 'mcp-1', allowedTools: ['crm.search_customer'] },
    ]);
  });
});
