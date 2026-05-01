import { USER_FEET_Y } from "@/lib/office/office-visual-constants"
import { OFFICE_USER_AGENT_ID } from "@/lib/office/office-types"

export type OfficeLayoutAgent = {
  agentId: string
  name: string
  role: "coordinator" | "specialist" | "user"
  x: number
  y: number
  active: boolean
  dimmed: boolean
  status: "idle"
  category?: string
}

export function buildOfficeLayout(input: {
  coordinatorId: string
  agents: Array<{
    id: string
    name: string
    role: "coordinator" | "specialist"
    category?: string
  }>
}): OfficeLayoutAgent[] {
  /** Tuned for small full-body sprites on the clinica background (arc + vertical spread). */
  const center = { x: 520, y: 288 }

  const coordinator = input.agents.find((a) => a.id === input.coordinatorId)
  const specialists = input.agents.filter(
    (a) => a.id !== input.coordinatorId && a.id !== OFFICE_USER_AGENT_ID,
  )

  const result: OfficeLayoutAgent[] = []

  result.push({
    agentId: OFFICE_USER_AGENT_ID,
    name: "Utilizador",
    role: "user",
    x: center.x,
    y: USER_FEET_Y,
    active: false,
    dimmed: false,
    status: "idle",
  })

  if (coordinator) {
    result.push({
      agentId: coordinator.id,
      name: coordinator.name,
      role: "coordinator",
      x: center.x,
      y: center.y,
      active: false,
      dimmed: false,
      status: "idle",
      category: coordinator.category,
    })
  }

  const radius = 235
  const startAngle = Math.PI * 0.15
  const endAngle = Math.PI * 0.85

  specialists.forEach((agent, index) => {
    const t = specialists.length <= 1 ? 0.5 : index / (specialists.length - 1)
    const angle = startAngle + (endAngle - startAngle) * t

    result.push({
      agentId: agent.id,
      name: agent.name,
      role: "specialist",
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
      active: false,
      dimmed: false,
      status: "idle",
      category: agent.category,
    })
  })

  return result
}

export function applyOfficePositionOverrides(
  layout: OfficeLayoutAgent[],
  overrides: Record<string, { x: number; y: number }> | null | undefined,
): OfficeLayoutAgent[] {
  if (!overrides || Object.keys(overrides).length === 0) return layout
  return layout.map((a) => {
    const o = overrides[a.agentId]
    if (!o) return a
    return { ...a, x: o.x, y: o.y }
  })
}
