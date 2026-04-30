import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { IAppDeps } from '../../../config/container.js';

describe('importTeamFromExport — reutilização de canais', () => {
  const workspaceId = 'ws-reuse-1';
  const assertWorkspaceQuotaDelta = jest.fn(async () => undefined);
  let importTeamFromExport: (typeof import('./import-team-from-export.js'))['importTeamFromExport'];
  let teamImportBodySchemaFn: (typeof import('./import-team-from-export.js'))['teamImportBodySchema'];

  beforeAll(async () => {
    jest.resetModules();
    await jest.unstable_mockModule('../../workspaces/application/workspace-plan-limits.js', () => ({
      assertWorkspaceQuotaDelta,
    }));
    const mod = await import('./import-team-from-export.js');
    importTeamFromExport = mod.importTeamFromExport;
    teamImportBodySchemaFn = mod.teamImportBodySchema;
  }, 30_000);

  function buildMinV2Export() {
    return {
      exportKind: 'team' as const,
      exportVersion: '2' as const,
      team: {
        name: 'T',
        description: 'd',
        status: 'draft' as const,
        coordinatorId: 'a1',
        agentIds: ['a2'],
        channelIds: ['c1'],
        primaryChannel: 'c1',
      },
      graph: {
        nodes: [
          { id: 'n-coord', type: 'coordinator' as const, data: { agentId: 'a1' } },
          { id: 'n-spec', type: 'specialist' as const, data: { agentId: 'a2' } },
          { id: 'n-ch', type: 'channel' as const, data: { channelId: 'c1' } },
        ],
        edges: [
          { id: 'e1', source: 'n-coord', target: 'n-ch' },
          { id: 'e2', source: 'n-coord', target: 'n-spec' },
        ],
      },
      channels: [{ id: 'c1', type: 'api', name: 'C', status: 'connected' as const }],
      channelsFull: [
        {
          legacyId: 'c1',
          type: 'api' as const,
          name: 'C',
          status: 'connected' as const,
          provider: 'native' as const,
          config: {},
          secretsEncrypted: { iv: 'x', payload: 'y' },
        },
      ],
      agents: [
        {
          exportVersion: '2' as const,
          exportKind: 'agent' as const,
          exportedAt: '2020-01-01T00:00:00.000Z',
          agent: {
            id: 'a1',
            name: 'Coord',
            role: 'coordinator' as const,
            systemInstruction: 'x',
            capabilities: { tools: ['clinic_get_patient_full_snapshot'] },
          },
          mcpBindings: [],
        },
        {
          exportVersion: '2' as const,
          exportKind: 'agent' as const,
          exportedAt: '2020-01-01T00:00:00.000Z',
          agent: {
            id: 'a2',
            name: 'S',
            role: 'specialist' as const,
            capabilities: { tools: ['clinic_create_patient'] },
          },
          mcpBindings: [],
        },
      ],
    };
  }

  function buildDepsForImport(agentCreateSpy: ReturnType<typeof jest.fn>) {
    const createFromImportSnapshot = jest.fn();
    const findByIdCh = jest.fn(
      async (_w: string, id: string) => (id === 'c1' ? { id: 'c1', teamId: null } : null),
    );
    const agentRepo = {
      create: agentCreateSpy,
      listAllIds: jest.fn(async () => new Set(['na1', 'na2', 'c1'])),
      softDelete: jest.fn(),
    };
    const channelRepo = {
      findById: findByIdCh,
      createFromImportSnapshot,
      update: jest.fn(async () => ({})),
      listAllIds: jest.fn(async () => new Set(['c1'])),
    };
    const teamRepo = {
      create: jest.fn(async () => ({ id: 't-new' })),
      findById: jest.fn(async (_ws, id) => {
        if (id === 't-new') {
          return { id: 't-new', coordinatorId: 'na1', agentIds: ['na2'], channelIds: ['c1'] };
        }
        return null;
      }),
      update: jest.fn(),
      findTeamsReferencingAgent: jest.fn(async () => []),
    };
    return {
      deps: {
        agentRepo,
        channelRepo,
        teamRepo,
        teamGraphRepo: { upsert: jest.fn(async () => undefined) },
        mcpRepo: { findById: jest.fn(async () => null) },
        agentMcpBindingRepo: { create: jest.fn(async () => ({})) },
        workspaceToolDefinitionRepo: {
          findBySlug: jest.fn(async (_ws: string, slug: string) => ({
            id: `def-${slug}`,
            slug,
            jsonSchema: { type: 'object', properties: { any: { type: 'string' } } },
          })),
        },
        workspaceIntegrationsService: undefined,
      } as unknown as IAppDeps,
      createFromImportSnapshot,
    };
  }

  it('não chama createFromImportSnapshot e mapeia identidade; quota de canais = 0', async () => {
    const createFromImportSnapshot = jest.fn();
    const findByIdCh = jest.fn(
      async (_w: string, id: string) => (id === 'c1' ? { id: 'c1', teamId: null } : null),
    );

    let created = 0;
    const agentRepo = {
      create: jest.fn(async () => {
        created += 1;
        return { id: created === 1 ? 'na1' : 'na2' };
      }),
      listAllIds: jest.fn(async () => new Set(['na1', 'na2', 'c1'])),
      softDelete: jest.fn(),
    };
    const channelRepo = {
      findById: findByIdCh,
      createFromImportSnapshot,
      update: jest.fn(async () => ({})),
      listAllIds: jest.fn(async () => new Set(['c1'])),
    };
    const teamRepo = {
      create: jest.fn(async () => ({ id: 't-new' })),
      findById: jest.fn(async (_ws, id) => {
        if (id === 't-new') {
          return { id: 't-new', coordinatorId: 'na1', agentIds: ['na2'], channelIds: ['c1'] };
        }
        return null;
      }),
      update: jest.fn(),
      findTeamsReferencingAgent: jest.fn(async () => []),
    };
    const teamGraphRepo = { upsert: jest.fn(async () => undefined) };
    const mcpRepo = { findById: jest.fn(async () => null) };
    const agentMcpBindingRepo = { create: jest.fn(async () => ({})) };
    const workspaceToolDefinitionRepo = {
      findBySlug: jest.fn(async (_ws: string, slug: string) => ({
        id: `def-${slug}`,
        slug,
        jsonSchema: { type: 'object', properties: { any: { type: 'string' } } },
      })),
    };

    const deps = {
      agentRepo,
      channelRepo,
      teamRepo,
      teamGraphRepo,
      mcpRepo,
      agentMcpBindingRepo,
      workspaceToolDefinitionRepo,
      workspaceIntegrationsService: undefined,
    } as unknown as IAppDeps;

    const payload = buildMinV2Export();
    const r = await importTeamFromExport(deps, workspaceId, {
      mode: 'create',
      importBody: teamImportBodySchemaFn.parse({ payload }),
      sameWorkspaceMcp: true,
    });

    expect(createFromImportSnapshot).not.toHaveBeenCalled();
    expect(r.oldToNewChannelIds['c1']).toBe('c1');
    expect(createFromImportSnapshot).toHaveBeenCalledTimes(0);
    const quotaCalls = assertWorkspaceQuotaDelta.mock.calls as unknown as Array<
      [unknown, string, { teams?: number; agents?: number; channels?: number }]
    >;
    const quotaWithZeroChannels = quotaCalls.find(
      (c) => c[1] === workspaceId && c[2].channels === 0,
    );
    expect(quotaWithZeroChannels).toBeTruthy();
  });

  it('usa runtime em sections.runtime quando agent nao tiver runtime', async () => {
    const payload = buildMinV2Export();
    payload.agents[1]!.agent = { id: 'a2', name: 'S', role: 'specialist' } as never;
    (payload.agents[1] as Record<string, unknown>).sections = {
      runtime: {
        capabilities: {
          tools: ['legacy.tool'],
          platformBuiltInTools: ['crm.search_customer'],
          openaiBuiltInTools: ['web_search'],
          customToolDefinitionIds: ['507f1f77bcf86cd799439011'],
        },
        knowledge: { sources: ['source-1'], useSessionMemory: true, usePersistentMemory: false },
        security: { requiresApproval: true, accessLevel: 'write' },
        channelConfig: { enabled: ['api'], canReplyDirectly: true },
        openaiRuntimeModel: 'gpt-5.4-mini',
      },
      system: {},
    } as never;

    let created = 0;
    const createSpy = jest.fn(async (_ws: string, body: Record<string, unknown>) => {
      created += 1;
      return { id: created === 1 ? 'na1' : 'na2', ...body };
    });
    const { deps } = buildDepsForImport(createSpy);

    await importTeamFromExport(deps, workspaceId, {
      mode: 'create',
      importBody: teamImportBodySchemaFn.parse({ payload }),
      sameWorkspaceMcp: true,
    });

    const specialistBody = createSpy.mock.calls[1]?.[1] as Record<string, unknown>;
    expect((specialistBody.capabilities as Record<string, unknown>)['platformBuiltInTools']).toEqual([
      'crm.search_customer',
    ]);
    expect((specialistBody.capabilities as Record<string, unknown>)['openaiBuiltInTools']).toEqual([
      'web_search',
    ]);
    expect(specialistBody.knowledge).toEqual({
      sources: ['source-1'],
      useSessionMemory: true,
      usePersistentMemory: false,
    });
    expect(specialistBody.security).toEqual({ requiresApproval: true, accessLevel: 'write' });
    expect(specialistBody.channelConfig).toEqual({ enabled: ['api'], canReplyDirectly: true });
    expect(specialistBody.openaiRuntimeModel).toBe('gpt-5.4-mini');
    expect((specialistBody.capabilities as Record<string, unknown>)['customToolDefinitionIds']).toEqual([
      'def-ba-legacy-tool',
    ]);
  });

  it('prioriza runtime em agent sobre sections.runtime', async () => {
    const payload = buildMinV2Export();
    payload.agents[1]!.agent = {
      id: 'a2',
      name: 'S',
      role: 'specialist',
      capabilities: {
        tools: ['legacy.agent'],
        platformBuiltInTools: ['scheduling.create_appointment'],
        openaiBuiltInTools: ['file_search'],
        customToolDefinitionIds: ['507f1f77bcf86cd799439012'],
      },
      openaiRuntimeModel: 'gpt-4o-mini',
    } as never;
    (payload.agents[1] as Record<string, unknown>).sections = {
      runtime: {
        capabilities: {
          tools: ['legacy.runtime'],
          platformBuiltInTools: ['crm.search_customer'],
          openaiBuiltInTools: ['web_search'],
          customToolDefinitionIds: ['507f1f77bcf86cd799439011'],
        },
        openaiRuntimeModel: 'gpt-5.4-mini',
      },
      system: {},
    } as never;

    let created = 0;
    const createSpy = jest.fn(async (_ws: string, body: Record<string, unknown>) => {
      created += 1;
      return { id: created === 1 ? 'na1' : 'na2', ...body };
    });
    const { deps } = buildDepsForImport(createSpy);

    await importTeamFromExport(deps, workspaceId, {
      mode: 'create',
      importBody: teamImportBodySchemaFn.parse({ payload }),
      sameWorkspaceMcp: true,
    });

    const specialistBody = createSpy.mock.calls[1]?.[1] as Record<string, unknown>;
    expect((specialistBody.capabilities as Record<string, unknown>)['tools']).toEqual(['legacy.agent']);
    expect((specialistBody.capabilities as Record<string, unknown>)['platformBuiltInTools']).toEqual([
      'scheduling.create_appointment',
    ]);
    expect((specialistBody.capabilities as Record<string, unknown>)['openaiBuiltInTools']).toEqual([
      'file_search',
    ]);
    expect(specialistBody.openaiRuntimeModel).toBe('gpt-4o-mini');
    expect((specialistBody.capabilities as Record<string, unknown>)['customToolDefinitionIds']).toEqual([
      'def-ba-legacy-agent',
    ]);
  });

  it('falha quando agente nao informa tools canônicas', async () => {
    const payload = buildMinV2Export();
    payload.agents[1]!.agent = {
      id: 'a2',
      name: 'S',
      role: 'specialist',
      capabilities: { tools: [], customToolDefinitionIds: ['507f1f77bcf86cd799439012'] },
    } as never;
    const createSpy = jest.fn(async (_ws: string, body: Record<string, unknown>) => ({ id: 'na1', ...body }));
    const { deps } = buildDepsForImport(createSpy);

    await expect(
      importTeamFromExport(deps, workspaceId, {
        mode: 'create',
        importBody: teamImportBodySchemaFn.parse({ payload }),
        sameWorkspaceMcp: true,
      }),
    ).rejects.toMatchObject({
      code: 'IMPORT_AGENT_TOOLS_REQUIRED',
    });
  });
});
