import { parseExportPayload } from './import-team-from-export.js';

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
