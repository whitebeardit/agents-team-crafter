/** Alinhado ao backend `graph-enrichment.ts`: arestas derivadas não devem ir no PUT. */

const DERIVED_HANDOFF_PREFIX = "derived-handoff-"
const DERIVED_STRUCTURAL_PREFIX = "derived-structural-"

export function isDerivedGraphEdge(edge: unknown): boolean {
  if (!edge || typeof edge !== "object") return false
  const rec = edge as Record<string, unknown>
  const id = String(rec.id ?? "")
  if (id.startsWith(DERIVED_HANDOFF_PREFIX) || id.startsWith(DERIVED_STRUCTURAL_PREFIX)) return true
  if (id.startsWith("handoff-")) return true
  const data = rec.data as Record<string, unknown> | undefined
  const kind = data?.edgeKind
  return kind === "handoff" || kind === "structural"
}

export function stripDerivedGraphEdges<T>(edges: T[]): T[] {
  return edges.filter((e) => !isDerivedGraphEdge(e))
}

export type GraphNodeLike = {
  id: string
  type?: string
  data?: { agentId?: string; channelId?: string }
}

export function resolveAgentNodeId(nodes: GraphNodeLike[], agentId: string): string | undefined {
  for (const n of nodes) {
    if (n.type !== "coordinator" && n.type !== "specialist") continue
    if (n.data?.agentId === agentId) return n.id
  }
  for (const n of nodes) {
    if (n.type !== "coordinator" && n.type !== "specialist") continue
    if (!n.data?.agentId && n.id === agentId) return n.id
  }
  return undefined
}

export function resolveChannelNodeId(nodes: GraphNodeLike[], channelId: string): string | undefined {
  for (const n of nodes) {
    if (n.type !== "channel") continue
    if (n.data?.channelId === channelId) return n.id
  }
  for (const n of nodes) {
    if (n.type !== "channel") continue
    if (!n.data?.channelId && n.id === channelId) return n.id
  }
  return undefined
}
