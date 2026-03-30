import {
  buildStructuralDerivedEdges,
  mergePersistedAndDerivedEdges,
  normalizePersistedChannelEdgesToCoordinator,
  resolveAgentNodeId,
  resolveChannelNodeId,
  stripDerivedGraphEdges,
  isDerivedGraphEdge,
} from './graph-enrichment.js';
import type { IGraphNode } from './graph-types.js';
import { validateTeamGraph } from './graph-validator.js';

describe('graph-enrichment', () => {
  const opaqueNodes: IGraphNode[] = [
    { id: 'node-coord', type: 'coordinator', data: { agentId: 'ag1', label: 'C' } },
    { id: 'node-spec', type: 'specialist', data: { agentId: 'ag2', label: 'S' } },
    { id: 'node-ch', type: 'channel', data: { channelId: 'ch1', label: 'W' } },
  ];

  it('resolveAgentNodeId uses data.agentId for opaque ids', () => {
    expect(resolveAgentNodeId(opaqueNodes, 'ag1')).toBe('node-coord');
    expect(resolveAgentNodeId(opaqueNodes, 'ag2')).toBe('node-spec');
  });

  it('resolveAgentNodeId falls back to node.id when agentId absent', () => {
    const nodes: IGraphNode[] = [{ id: 'ag99', type: 'specialist', data: { label: 'x' } }];
    expect(resolveAgentNodeId(nodes, 'ag99')).toBe('ag99');
  });

  it('resolveChannelNodeId uses data.channelId', () => {
    expect(resolveChannelNodeId(opaqueNodes, 'ch1')).toBe('node-ch');
  });

  it('buildStructuralDerivedEdges links coordinator to specialists and channel to coordinator', () => {
    const team = { coordinatorId: 'ag1', agentIds: ['ag2'], channelIds: ['ch1'] };
    const edges = buildStructuralDerivedEdges(opaqueNodes, team);
    expect(edges.some((e) => e.source === 'node-coord' && e.target === 'node-spec')).toBe(true);
    expect(edges.some((e) => e.source === 'node-ch' && e.target === 'node-coord')).toBe(true);
    expect(edges.some((e) => e.source === 'node-coord' && e.target === 'node-ch')).toBe(false);
    expect(edges.some((e) => e.source === 'node-spec' && e.target === 'node-ch')).toBe(false);
  });

  it('mergePersistedAndDerivedEdges dedupes by directed pair', () => {
    const persisted = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'handoff-legacy', source: 'a', target: 'b', data: { edgeKind: 'handoff' } },
    ];
    const derived = [{ id: 'derived-handoff-a-b', source: 'a', target: 'b', data: { edgeKind: 'handoff' } }];
    const merged = mergePersistedAndDerivedEdges(persisted as never, derived);
    const ab = merged.filter((e) => e.source === 'a' && e.target === 'b');
    expect(ab.length).toBe(1);
  });

  it('stripDerivedGraphEdges removes derived markers', () => {
    const edges = [
      { id: 'u1', source: 'a', target: 'b' },
      { id: 'derived-handoff-a-b', source: 'a', target: 'c', data: { edgeKind: 'handoff' } },
    ];
    expect(stripDerivedGraphEdges(edges)).toHaveLength(1);
    expect(isDerivedGraphEdge(edges[1])).toBe(true);
  });

  const teamCoord = { coordinatorId: 'ag1', agentIds: ['ag2'], channelIds: ['ch1'] };
  const ctx = { agentIds: new Set(['ag1', 'ag2']) };

  it('normalizePersistedChannelEdgesToCoordinator remaps specialist to channel as channel to coordinator', () => {
    const edges = [{ id: 'legacy', source: 'node-spec', target: 'node-ch' }];
    const { edges: out, changed } = normalizePersistedChannelEdgesToCoordinator(
      opaqueNodes,
      edges,
      teamCoord,
      ctx,
    );
    expect(changed).toBe(true);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('node-ch');
    expect(out[0].target).toBe('node-coord');
  });

  it('normalizePersistedChannelEdgesToCoordinator remaps channel to specialist as channel to coordinator', () => {
    const edges = [{ id: 'legacy', source: 'node-ch', target: 'node-spec' }];
    const { edges: out, changed } = normalizePersistedChannelEdgesToCoordinator(
      opaqueNodes,
      edges,
      teamCoord,
      ctx,
    );
    expect(changed).toBe(true);
    expect(out[0].source).toBe('node-ch');
    expect(out[0].target).toBe('node-coord');
  });

  it('normalizePersistedChannelEdgesToCoordinator flips coordinator to channel to channel to coordinator', () => {
    const edges = [{ id: 'ok', source: 'node-coord', target: 'node-ch' }];
    const { edges: out, changed } = normalizePersistedChannelEdgesToCoordinator(
      opaqueNodes,
      edges,
      teamCoord,
      ctx,
    );
    expect(changed).toBe(true);
    expect(out[0].source).toBe('node-ch');
    expect(out[0].target).toBe('node-coord');
  });

  it('normalizePersistedChannelEdgesToCoordinator leaves channel to coordinator unchanged', () => {
    const edges = [{ id: 'ok', source: 'node-ch', target: 'node-coord' }];
    const { edges: out, changed } = normalizePersistedChannelEdgesToCoordinator(
      opaqueNodes,
      edges,
      teamCoord,
      ctx,
    );
    expect(changed).toBe(false);
    expect(out[0]).toEqual(edges[0]);
  });

  it('normalizePersistedChannelEdgesToCoordinator dedupes duplicate remapped edges', () => {
    const edges = [
      { id: 'a', source: 'node-spec', target: 'node-ch' },
      { id: 'b', source: 'node-spec', target: 'node-ch' },
    ];
    const { edges: out, changed } = normalizePersistedChannelEdgesToCoordinator(
      opaqueNodes,
      edges,
      teamCoord,
      ctx,
    );
    expect(changed).toBe(true);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('node-ch');
    expect(out[0].target).toBe('node-coord');
  });

  it('normalizePersistedChannelEdgesToCoordinator skips when coordinator node missing', () => {
    const nodes: IGraphNode[] = [
      { id: 'node-spec', type: 'specialist', data: { agentId: 'ag2' } },
      { id: 'node-ch', type: 'channel', data: { channelId: 'ch1' } },
    ];
    const edges = [{ id: 'x', source: 'node-spec', target: 'node-ch' }];
    const { edges: out, changed } = normalizePersistedChannelEdgesToCoordinator(
      nodes,
      edges,
      teamCoord,
      ctx,
    );
    expect(changed).toBe(false);
    expect(out[0].source).toBe('node-spec');
  });
});

describe('validateTeamGraph with enrich', () => {
  it('does not report ORPHAN_NODE when connectivity exists via derived structural edges', () => {
    const nodes: IGraphNode[] = [
      { id: 'nc', type: 'coordinator', data: { agentId: 'ag1' } },
      { id: 'ns', type: 'specialist', data: { agentId: 'ag2' } },
    ];
    const agentIds = new Set(['ag1', 'ag2']);
    const channelIds = new Set<string>();
    const enrich = {
      team: { coordinatorId: 'ag1', agentIds: ['ag2'], channelIds: [] },
    };
    const r = validateTeamGraph(nodes, [], { agentIds, channelIds }, enrich);
    expect(r.errors.filter((e) => e.code === 'ORPHAN_NODE')).toHaveLength(0);
  });
});
