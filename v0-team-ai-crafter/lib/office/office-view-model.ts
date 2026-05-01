import type { OfficeAgentVisualState } from "./office-types"
import type { OfficeLayoutAgent } from "./office-layout"

export function layoutToVisualAgents(layout: OfficeLayoutAgent[]): OfficeAgentVisualState[] {
  return layout.map((a) => ({
    agentId: a.agentId,
    name: a.name,
    role: a.role,
    status: a.status,
    x: a.x,
    y: a.y,
    active: a.active,
    dimmed: a.dimmed,
    category: a.category,
  }))
}

export function applyOfficeFocus(
  agents: OfficeAgentVisualState[],
  fromAgentId?: string,
  toAgentId?: string,
): OfficeAgentVisualState[] {
  if (!fromAgentId && !toAgentId) {
    return agents.map((agent) => ({
      ...agent,
      active: false,
      dimmed: false,
      status: agent.status === "error" ? "error" : "idle",
    }))
  }

  return agents.map((agent) => {
    const focused = agent.agentId === fromAgentId || agent.agentId === toAgentId
    return {
      ...agent,
      active: focused,
      dimmed: Boolean(fromAgentId || toAgentId) && !focused,
      status: focused ? "speaking" : agent.status === "error" ? "error" : "idle",
    }
  })
}
