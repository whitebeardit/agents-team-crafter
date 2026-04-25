import { parseExportPayload } from './import-team-from-export.js';
import { AGENT_EXPORT_VERSION } from '../../agents/application/build-agent-export.js';

describe('parseExportPayload', () => {
  it('aceita exportKind template', () => {
    const raw = {
      exportVersion: '2',
      exportKind: 'template',
      team: {
        name: 'T',
        coordinatorId: 'a1',
        agentIds: ['a1'],
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
          provider: 'native',
          config: {},
        },
      ],
      agents: [
        {
          exportVersion: AGENT_EXPORT_VERSION,
          exportKind: 'agent' as const,
          exportedAt: 'x',
          agent: { id: 'a1', name: 'A', role: 'coordinator' } as never,
          mcpBindings: [],
        },
      ],
    };
    const p = parseExportPayload(raw);
    expect(p.kind).toBe('ok');
  });
});
