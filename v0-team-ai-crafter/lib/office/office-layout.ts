export type OfficeLayoutAgent = {
  agentId: string
  name: string
  role: "coordinator" | "specialist"
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
  const center = { x: 520, y: 280 }

  const coordinator = input.agents.find((a) => a.id === input.coordinatorId)
  const specialists = input.agents.filter((a) => a.id !== input.coordinatorId)

  const result: OfficeLayoutAgent[] = []

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

  const radius = 260
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
