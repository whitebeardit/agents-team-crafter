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
});
