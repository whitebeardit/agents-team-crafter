import { parseExportPayload, resolveTeamImportMode } from './import-team-from-export.js';

describe('parseExportPayload', () => {
  it('aceita v2 com channelsFull alinhado a channelIds', () => {
    const raw = {
      exportKind: 'team',
      exportVersion: '2',
      team: {
        name: 'T',
        coordinatorId: 'a1',
        agentIds: ['a2'],
        channelIds: ['c1'],
      },
      graph: { nodes: [], edges: [] },
      channels: [{ id: 'c1', type: 'api', name: 'C', status: 'pending' }],
      channelsFull: [
        {
          legacyId: 'c1',
          type: 'api',
          name: 'C',
          status: 'pending',
          provider: 'native' as const,
          config: {},
        },
      ],
      agents: [
        {
          exportVersion: '2',
          exportKind: 'agent' as const,
          exportedAt: '2020-01-01T00:00:00.000Z',
          agent: { id: 'a1', name: 'Coord', role: 'coordinator' },
          mcpBindings: [],
        },
        {
          exportVersion: '2',
          exportKind: 'agent' as const,
          exportedAt: '2020-01-01T00:00:00.000Z',
          agent: { id: 'a2', name: 'S', role: 'specialist' },
          mcpBindings: [],
        },
      ],
    };
    const p = parseExportPayload(raw);
    expect(p.kind).toBe('ok');
    if (p.kind === 'ok') {
      expect(p.value.exportVersion).toBe('2');
      expect(p.value.channelsFull?.[0]!.legacyId).toBe('c1');
    }
  });

  it('rejeita v1 com canais sem channelsFull', () => {
    const raw = {
      exportKind: 'team',
      exportVersion: '1',
      team: { name: 'T', coordinatorId: 'a1', agentIds: [], channelIds: ['c1'] },
      graph: { nodes: [], edges: [] },
      channels: [],
      agents: [
        {
          exportVersion: '1',
          exportKind: 'agent' as const,
          exportedAt: '2020-01-01T00:00:00.000Z',
          agent: { id: 'a1', name: 'C', role: 'coordinator' },
          mcpBindings: [],
        },
      ],
    };
    const p = parseExportPayload(raw);
    expect(p.kind).toBe('error');
  });
});

describe('resolveTeamImportMode', () => {
  it('substitui automaticamente se team.id do export existir no workspace (e forceCreate e false)', async () => {
    const teamRepo = {
      findById: jest.fn(async (_ws: string, id: string) => (id === 't1' ? { id: 't1' } : null)),
    };
    const p = { team: { id: 't1' } };
    const r = await resolveTeamImportMode(teamRepo as never, 'ws1', p, false);
    expect(r.mode).toBe('replace');
    expect(r.replaceTeamId).toBe('t1');
    expect(r.autoResolvedReplace).toBe(true);
  });

  it('cria se team.id nao existir', async () => {
    const teamRepo = { findById: jest.fn(async () => null) };
    const r = await resolveTeamImportMode(teamRepo as never, 'ws1', { team: { id: 't1' } }, false);
    expect(r.mode).toBe('create');
    expect(r.autoResolvedReplace).toBe(false);
  });

  it('forca create com forceCreate', async () => {
    const teamRepo = {
      findById: jest.fn(async () => ({ id: 't1' })),
    };
    const r = await resolveTeamImportMode(teamRepo as never, 'ws1', { team: { id: 't1' } }, true);
    expect(r.mode).toBe('create');
  });
});
