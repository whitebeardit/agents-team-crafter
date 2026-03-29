import type { IGraphEdge, IGraphNode } from './graph-types.js';

export interface ITeamGraphEnrichTeam {
  coordinatorId: string;
  agentIds: string[];
  channelIds: string[];
}

/** Minimal agent shape for handoff derivation */
export interface IGraphEnrichAgent {
  id: string;
  handoff?: { targets?: string[] };
}

const DERIVED_HANDOFF_PREFIX = 'derived-handoff-';
const DERIVED_STRUCTURAL_PREFIX = 'derived-structural-';

export function isDerivedGraphEdge(edge: unknown): boolean {
  if (!edge || typeof edge !== 'object') return false;
  const rec = edge as Record<string, unknown>;
  const id = String(rec.id ?? '');
  if (id.startsWith(DERIVED_HANDOFF_PREFIX) || id.startsWith(DERIVED_STRUCTURAL_PREFIX)) return true;
  if (id.startsWith('handoff-')) return true;
  const data = rec.data as Record<string, unknown> | undefined;
  const kind = data?.edgeKind;
  return kind === 'handoff' || kind === 'structural';
}

export function stripDerivedGraphEdges(edges: unknown[]): unknown[] {
  return edges.filter((e) => !isDerivedGraphEdge(e));
}

/** Resolve React Flow node id for an agent (coordinator/specialist nodes). */
export function resolveAgentNodeId(nodes: IGraphNode[], agentId: string): string | undefined {
  for (const n of nodes) {
    if (n.type !== 'coordinator' && n.type !== 'specialist') continue;
    const aid = n.data?.agentId;
    if (aid === agentId) return n.id;
  }
  for (const n of nodes) {
    if (n.type !== 'coordinator' && n.type !== 'specialist') continue;
    if (!n.data?.agentId && n.id === agentId) return n.id;
  }
  return undefined;
}

export function resolveChannelNodeId(nodes: IGraphNode[], channelId: string): string | undefined {
  for (const n of nodes) {
    if (n.type !== 'channel') continue;
    const cid = n.data?.channelId;
    if (cid === channelId) return n.id;
  }
  for (const n of nodes) {
    if (n.type !== 'channel') continue;
    if (!n.data?.channelId && n.id === channelId) return n.id;
  }
  return undefined;
}

/**
 * Structural edges: coordinator → each specialist; channel → coordinator for each team channel
 * (direção alinhada ao React Flow: target no topo do coordenador para I/O externo).
 */
export function buildStructuralDerivedEdges(
  nodes: IGraphNode[],
  team: ITeamGraphEnrichTeam,
): IGraphEdge[] {
  const out: IGraphEdge[] = [];
  const coordNode = resolveAgentNodeId(nodes, team.coordinatorId);
  if (!coordNode) return out;

  for (const sid of team.agentIds) {
    const specNode = resolveAgentNodeId(nodes, sid);
    if (!specNode || specNode === coordNode) continue;
    out.push({
      id: `${DERIVED_STRUCTURAL_PREFIX}${coordNode}-${specNode}`,
      source: coordNode,
      target: specNode,
      animated: true,
      data: { edgeKind: 'structural' as const },
    });
  }

  for (const chId of team.channelIds) {
    const chNode = resolveChannelNodeId(nodes, chId);
    if (!chNode) continue;
    out.push({
      id: `${DERIVED_STRUCTURAL_PREFIX}${chNode}-${coordNode}`,
      source: chNode,
      target: coordNode,
      data: { edgeKind: 'structural' as const },
    });
  }

  return out;
}

export function buildHandoffDerivedEdges(nodes: IGraphNode[], agents: IGraphEnrichAgent[]): IGraphEdge[] {
  const out: IGraphEdge[] = [];
  for (const a of agents) {
    const src = resolveAgentNodeId(nodes, a.id);
    if (!src) continue;
    for (const t of a.handoff?.targets ?? []) {
      if (t === a.id) continue;
      const tgt = resolveAgentNodeId(nodes, t);
      if (!tgt) continue;
      out.push({
        id: `${DERIVED_HANDOFF_PREFIX}${src}-${tgt}`,
        source: src,
        target: tgt,
        data: { edgeKind: 'handoff' as const },
      });
    }
  }
  return out;
}

function edgePairKey(source: string, target: string): string {
  return `${source}|${target}`;
}

/** Same semantics as graph-validator resolveAgentIdFromGraphNode (kept here to avoid circular imports). */
function resolveAgentIdFromGraphNode(
  n: IGraphNode | undefined,
  ctx: { agentIds: Set<string> },
): string | undefined {
  if (!n || (n.type !== 'coordinator' && n.type !== 'specialist')) return undefined;
  const aid = n.data?.agentId;
  if (aid) return aid;
  if (ctx.agentIds.has(n.id)) return n.id;
  return undefined;
}

/**
 * Remaps persisted edges that connect a channel to a non-coordinator agent so the coordinator end
 * is the team coordinator node; canonical direction for channel↔coordinator is channel → coordinator
 * (merge com arestas derivadas usa par dirigido). Expects non-derived edges. Deduplica por source|target.
 */
export function normalizePersistedChannelEdgesToCoordinator(
  nodes: IGraphNode[],
  edges: unknown[],
  team: ITeamGraphEnrichTeam,
  ctx: { agentIds: Set<string> },
): { edges: IGraphEdge[]; changed: boolean } {
  const nonDerived = edges.filter((e) => !isDerivedGraphEdge(e)) as IGraphEdge[];
  const coordNodeId = resolveAgentNodeId(nodes, team.coordinatorId);
  if (!coordNodeId) {
    return { edges: nonDerived, changed: false };
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  let changed = false;
  const remapped: IGraphEdge[] = [];

  for (const e of nonDerived) {
    const src = nodeById.get(e.source);
    const tgt = nodeById.get(e.target);
    const srcCh = src?.type === 'channel';
    const tgtCh = tgt?.type === 'channel';
    if (srcCh === tgtCh) {
      remapped.push({ ...e });
      continue;
    }
    const agentNode = srcCh ? tgt : src;
    if (!agentNode || (agentNode.type !== 'coordinator' && agentNode.type !== 'specialist')) {
      remapped.push({ ...e });
      continue;
    }
    const agentId = resolveAgentIdFromGraphNode(agentNode, ctx);
    let source = e.source;
    let target = e.target;
    if (agentId !== undefined && agentId !== team.coordinatorId) {
      if (srcCh) {
        target = coordNodeId;
      } else {
        source = e.target;
        target = coordNodeId;
      }
      changed = true;
    }
    remapped.push({ ...e, source, target });
  }

  const canonicalDir: IGraphEdge[] = remapped.map((e) => {
    const src = nodeById.get(e.source);
    const tgt = nodeById.get(e.target);
    if (!src || !tgt) return e;
    const sc = src.type === 'channel';
    const tc = tgt.type === 'channel';
    if (sc === tc) return e;
    const chNodeId = sc ? e.source : e.target;
    const otherId = sc ? e.target : e.source;
    const other = nodeById.get(otherId);
    if (other?.type !== 'coordinator' || otherId !== coordNodeId) return e;
    if (e.source === chNodeId && e.target === coordNodeId) return e;
    if (e.source === coordNodeId && e.target === chNodeId) {
      changed = true;
      return { ...e, source: chNodeId, target: coordNodeId };
    }
    return e;
  });

  const seen = new Set<string>();
  const deduped: IGraphEdge[] = [];
  for (const e of canonicalDir) {
    const k = edgePairKey(e.source, e.target);
    if (seen.has(k)) {
      changed = true;
      continue;
    }
    seen.add(k);
    deduped.push(e);
  }
  if (deduped.length !== nonDerived.length) changed = true;

  return { edges: deduped, changed };
}

/** Merge persisted (non-derived) edges with derived; skip derived pairs already present in persisted. */
export function mergePersistedAndDerivedEdges(
  persistedEdges: IGraphEdge[],
  derived: IGraphEdge[],
): IGraphEdge[] {
  const clean = persistedEdges.filter((e) => !isDerivedGraphEdge(e));
  const keys = new Set(clean.map((e) => edgePairKey(e.source, e.target)));
  const out = [...clean];
  for (const e of derived) {
    const k = edgePairKey(e.source, e.target);
    if (!keys.has(k)) {
      keys.add(k);
      out.push(e);
    }
  }
  return out;
}

export function computeAllDerivedEdges(
  nodes: IGraphNode[],
  team: ITeamGraphEnrichTeam,
  agents: IGraphEnrichAgent[],
): IGraphEdge[] {
  const structural = buildStructuralDerivedEdges(nodes, team);
  const handoff = buildHandoffDerivedEdges(nodes, agents);
  return mergePersistedAndDerivedEdges([], [...structural, ...handoff]);
}

export function enrichTeamGraphPayload(
  nodes: unknown[],
  edges: unknown[],
  team: ITeamGraphEnrichTeam,
  agents: IGraphEnrichAgent[],
): { nodes: unknown[]; edges: IGraphEdge[] } {
  const n = nodes as IGraphNode[];
  const e = edges as IGraphEdge[];
  const derived = computeAllDerivedEdges(n, team, agents);
  const merged = mergePersistedAndDerivedEdges(e, derived);
  return { nodes, edges: merged };
}

/** Normalize node.data.agentId / channelId when missing but node.id matches a known entity id. */
export function normalizeGraphNodesEntityFields(
  nodes: unknown[],
  team: ITeamGraphEnrichTeam,
): unknown[] {
  const agentSet = new Set([team.coordinatorId, ...team.agentIds]);
  const channelSet = new Set(team.channelIds);
  return nodes.map((raw) => {
    if (!raw || typeof raw !== 'object') return raw;
    const node = { ...(raw as Record<string, unknown>) };
    const type = String(node.type ?? '');
    const data = { ...((node.data as Record<string, unknown>) ?? {}) };
    const id = String(node.id ?? '');
    if (type === 'coordinator' || type === 'specialist') {
      if (!data.agentId && agentSet.has(id)) data.agentId = id;
    }
    if (type === 'channel') {
      if (!data.channelId && channelSet.has(id)) data.channelId = id;
    }
    node.data = data;
    return node;
  });
}
