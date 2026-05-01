import type { OfficeAgentVisualState, OfficeEvent } from "./office-types"

export type AgentOfficeController = {
  playEvent(event: OfficeEvent): void
  syncAgents(agents: OfficeAgentVisualState[]): void
  focusAgents(fromAgentId?: string, toAgentId?: string): void
  resetFocus(): void
  setAgentsDimmed(dimmed: boolean): void
  setLayoutEditMode(enabled: boolean): void
  setOnAgentPositionCommit(handler: ((agentId: string, x: number, y: number) => void) | null): void
  destroy(): void
}
