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
          agent: { id: 'a1', name: 'Coord', role: 'coordinator' as const, systemInstruction: 'x' },
          mcpBindings: [],
        },
        {
          exportVersion: '2' as const,
          exportKind: 'agent' as const,
          exportedAt: '2020-01-01T00:00:00.000Z',
          agent: { id: 'a2', name: 'S', role: 'specialist' as const },
          mcpBindings: [],
        },
      ],
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

    const deps = {
      agentRepo,
      channelRepo,
      teamRepo,
      teamGraphRepo,
      mcpRepo,
      agentMcpBindingRepo,
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
});
