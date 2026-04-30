import type { Node } from "@xyflow/react"

/** Chave estável para casar nó do grafo com agente/canal do time. */
export function canvasEntityKey(n: Node): string | null {
  const t = n.type
  if (t === "coordinator" || t === "specialist") {
    const d = n.data as { agentId?: string }
    return `agent:${String(d.agentId ?? n.id)}`
  }
  if (t === "channel") {
    const d = n.data as { channelId?: string }
    return `channel:${String(d.channelId ?? n.id)}`
  }
  return null
}

export function hasValidPosition(position: unknown): position is { x: number; y: number } {
  if (!position || typeof position !== "object") return false
  const candidate = position as { x?: unknown; y?: unknown }
  return typeof candidate.x === "number" && Number.isFinite(candidate.x)
    && typeof candidate.y === "number" && Number.isFinite(candidate.y)
}

/**
 * Injeta nós do layout do time; funde dados do persistido com o template (API) e
 * preserva posição persistida sempre que ela estiver válida.
 * Nós sem chave (ex.: knowledge) persistem no fim.
 */
export function mergePersistedWithTeamRoster(persisted: Node[], teamLayout: Node[]): Node[] {
  const byKey = new Map<string, Node>()
  for (const n of persisted) {
    const k = canvasEntityKey(n)
    if (k) byKey.set(k, n)
  }
  const out: Node[] = []
  const usedIds = new Set<string>()
  for (const tmpl of teamLayout) {
    const k = canvasEntityKey(tmpl)
    if (!k) continue
    const existing = byKey.get(k)
    const mergedData = {
      ...((existing?.data ?? {}) as Record<string, unknown>),
      ...((tmpl.data ?? {}) as Record<string, unknown>),
    }
    const base = existing ?? tmpl
    const chosen: Node = {
      ...base,
      id: base.id,
      type: tmpl.type,
      position: hasValidPosition(existing?.position) ? existing.position : tmpl.position,
      data: mergedData,
    }
    out.push(chosen)
    usedIds.add(chosen.id)
  }
  for (const n of persisted) {
    if (canvasEntityKey(n) !== null) continue
    if (usedIds.has(n.id)) continue
    usedIds.add(n.id)
    out.push(n)
  }
  return out
}

/** Alinha posição ao template apenas para nós do roster sem posição válida. */
export function applyRosterStackLayout(nodes: Node[], template: Node[]): Node[] {
  const templatePosByKey = new Map<string, { x: number; y: number }>()
  for (const t of template) {
    const k = canvasEntityKey(t)
    if (k) templatePosByKey.set(k, { ...t.position })
  }
  return nodes.map((n) => {
    const k = canvasEntityKey(n)
    if (!k) return n
    if (hasValidPosition(n.position)) return n
    const pos = templatePosByKey.get(k)
    if (!pos) return n
    return { ...n, position: { x: pos.x, y: pos.y } }
  })
}
