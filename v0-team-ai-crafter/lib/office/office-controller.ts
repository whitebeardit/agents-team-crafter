import type { OfficeAgentVisualState, OfficeEvent } from "./office-types"

export type AgentOfficeController = {
  playEvent(event: OfficeEvent): void
  syncAgents(agents: OfficeAgentVisualState[]): void
  focusAgents(fromAgentId?: string, toAgentId?: string): void
  resetFocus(): void
  setAgentsDimmed(dimmed: boolean): void
  destroy(): void
}
