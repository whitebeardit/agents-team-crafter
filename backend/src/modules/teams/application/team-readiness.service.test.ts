import { describe, expect, it, jest } from '@jest/globals';
import { computeTeamReadiness } from './team-readiness.service.js';
import type { TTeamReadinessDeps } from './team-readiness.service.js';

function mockDeps(over: Partial<TTeamReadinessDeps> = {}): TTeamReadinessDeps {
  const teamRepo = {
    findById: jest.fn(async () => ({
      id: 't1',
      name: 'T',
      status: 'active',
      coordinatorId: 'c1',
      agentIds: ['s1'],
      channelIds: [],
    })),
  };
  const agentRepo = {
    findById: jest.fn(async (_ws: string, id: string) => {
      if (id === 'c1') return { id: 'c1', name: 'Coord', role: 'coordinator', capabilities: { tools: [] } };
      if (id === 's1') return { id: 's1', name: 'Spec', role: 'specialist', capabilities: { tools: [] } };
      return null;
    }),
    listAllIds: jest.fn(async () => new Set(['c1', 's1'])),
  };
  const channelRepo = {
    findById: jest.fn(),
    listAllIds: jest.fn(async () => new Set<string>()),
  };
  const teamGraphRepo = {
    get: jest.fn(async () => ({ nodes: [], edges: [] })),
    upsert: jest.fn(async () => undefined),
  };
  const workspaceToolDefinitionRepo = {
    findById: jest.fn(),
  };
  const workspaceIntegrationsService = {
    getToolIntegrationContext: jest.fn(async () => ({})),
  };
  const base = {
    teamRepo,
    agentRepo,
    channelRepo,
    teamGraphRepo,
    workspaceToolDefinitionRepo,
    workspaceIntegrationsService,
  };
  return { ...(base as unknown as TTeamReadinessDeps), ...over };
}

describe('computeTeamReadiness', () => {
  it('returns blocked when team missing', async () => {
    const deps = mockDeps({
      teamRepo: { findById: jest.fn(async () => null) } as unknown as TTeamReadinessDeps['teamRepo'],
    });
    const r = await computeTeamReadiness('ws', 'tid', deps);
    expect(r.level).toBe('blocked');
    const missing = r.items.find((i) => i.code === 'team_not_found');
    expect(missing).toBeDefined();
    expect(missing?.ctaLabel).toBe('Lista de times');
    expect(missing?.routeHint).toBe('/teams');
  });

  it('flags draft team as attention', async () => {
    const deps = mockDeps({
      teamRepo: {
        findById: jest.fn(async () => ({
          id: 't1',
          status: 'draft',
          coordinatorId: 'c1',
          agentIds: [],
          channelIds: [],
        })),
      } as unknown as TTeamReadinessDeps['teamRepo'],
    });
    const r = await computeTeamReadiness('ws', 't1', deps);
    expect(r.items.some((i) => i.code === 'team_status_draft')).toBe(true);
    expect(['attention', 'blocked']).toContain(r.level);
  });

  it('flags active channel team without specialists as attention', async () => {
    const deps = mockDeps({
      teamRepo: {
        findById: jest.fn(async () => ({
          id: 't1',
          status: 'active',
          coordinatorId: 'c1',
          agentIds: [],
          channelIds: ['ch1'],
        })),
      } as unknown as TTeamReadinessDeps['teamRepo'],
      channelRepo: {
        findById: jest.fn(async () => ({ id: 'ch1', status: 'connected' })),
        listAllIds: jest.fn(async () => new Set(['ch1'])),
      } as unknown as TTeamReadinessDeps['channelRepo'],
    });
    const r = await computeTeamReadiness('ws', 't1', deps);
    expect(r.items.some((i) => i.code === 'team_without_specialists')).toBe(true);
  });

  it('flags coordinator execution workflows from workspace tools', async () => {
    const deps = mockDeps({
      agentRepo: {
        findById: jest.fn(async (_ws: string, id: string) => {
          if (id === 'c1') {
            return {
              id: 'c1',
              name: 'Coord',
              role: 'coordinator',
              capabilities: { tools: [], customToolDefinitionIds: ['def1'] },
            };
          }
          if (id === 's1') return { id: 's1', name: 'Spec', role: 'specialist', capabilities: { tools: [] } };
          return null;
        }),
        listAllIds: jest.fn(async () => new Set(['c1', 's1'])),
      } as unknown as TTeamReadinessDeps['agentRepo'],
      workspaceToolDefinitionRepo: {
        findById: jest.fn(async (_ws: string, id: string) =>
          id === 'def1'
            ? {
                id: 'def1',
                enabled: true,
                kind: 'internal_action',
                name: 'Clínica — Agendar sessão',
                config: { actionId: 'clinic_schedule_session' },
              }
            : null,
        ),
      } as unknown as TTeamReadinessDeps['workspaceToolDefinitionRepo'],
    });
    const r = await computeTeamReadiness('ws', 't1', deps);
    expect(r.items.some((i) => i.code === 'coordinator_has_execution_workflows')).toBe(true);
  });
});
