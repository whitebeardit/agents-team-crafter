import { validateTeamGraph } from './graph-validator.js';
import type { IGraphEdge, IGraphNode } from './graph-types.js';

describe('graph-validator channel edges', () => {
  const agentIds = new Set(['coord1', 'spec1']);
  const channelIds = new Set(['ch1']);
  const enrich = {
    team: { coordinatorId: 'coord1', agentIds: ['spec1'], channelIds: ['ch1'] },
  };

  const baseNodes: IGraphNode[] = [
    { id: 'n-coord', type: 'coordinator', data: { agentId: 'coord1' } },
    { id: 'n-spec', type: 'specialist', data: { agentId: 'spec1' } },
    { id: 'n-ch', type: 'channel', data: { channelId: 'ch1' } },
  ];

  it('accepts persisted edge coordinator node to channel', () => {
    const edges: IGraphEdge[] = [{ id: 'e1', source: 'n-coord', target: 'n-ch' }];
    const r = validateTeamGraph(baseNodes, edges, { agentIds, channelIds }, enrich);
    expect(r.errors.filter((e) => e.code === 'CHANNEL_EDGE_INVALID')).toHaveLength(0);
  });

  it('accepts persisted edge channel node to coordinator', () => {
    const edges: IGraphEdge[] = [{ id: 'e2', source: 'n-ch', target: 'n-coord' }];
    const r = validateTeamGraph(baseNodes, edges, { agentIds, channelIds }, enrich);
    expect(r.errors.filter((e) => e.code === 'CHANNEL_EDGE_INVALID')).toHaveLength(0);
  });

  it('rejects specialist to channel edge', () => {
    const edges: IGraphEdge[] = [{ id: 'e1', source: 'n-spec', target: 'n-ch' }];
    const r = validateTeamGraph(baseNodes, edges, { agentIds, channelIds }, enrich);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.code === 'CHANNEL_EDGE_INVALID')).toBe(true);
  });

  it('rejects edge between two channel nodes', () => {
    const nodes: IGraphNode[] = [
      { id: 'n-coord', type: 'coordinator', data: { agentId: 'coord1' } },
      { id: 'n-spec', type: 'specialist', data: { agentId: 'spec1' } },
      { id: 'n-ch', type: 'channel', data: { channelId: 'ch1' } },
      { id: 'n-ch2', type: 'channel', data: { channelId: 'ch2' } },
    ];
    const enrich2 = {
      team: { coordinatorId: 'coord1', agentIds: ['spec1'], channelIds: ['ch1', 'ch2'] },
    };
    const edges: IGraphEdge[] = [{ id: 'e-bad', source: 'n-ch', target: 'n-ch2' }];
    const r = validateTeamGraph(
      nodes,
      edges,
      { agentIds, channelIds: new Set(['ch1', 'ch2']) },
      enrich2,
    );
    expect(r.errors.some((e) => e.code === 'CHANNEL_EDGE_INVALID')).toBe(true);
  });
});
