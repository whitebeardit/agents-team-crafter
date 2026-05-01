import type { TeamConversationTimelineItem } from "@/lib/types"

export type OfficeAgentRole = "coordinator" | "specialist"

export type OfficeAgentStatus =
  | "idle"
  | "thinking"
  | "walking"
  | "speaking"
  | "waiting"
  | "done"
  | "error"

export type OfficeEventType =
  | "user_message"
  | "agent_thinking"
  | "agent_handoff"
  | "agent_response"
  | "tool_call"
  | "tool_result"
  | "activity"
  | "run_complete"
  | "error"

export type OfficeAgentVisualState = {
  agentId: string
  name: string
  role: OfficeAgentRole
  status: OfficeAgentStatus
  x: number
  y: number
  active: boolean
  dimmed: boolean
  currentBubble?: string
  category?: string
}

export type OfficeEvent = {
  id: string
  seq: number
  timestamp: string
  type: OfficeEventType
  fromAgentId?: string
  toAgentId?: string
  actorId?: string
  message: string
  original?: TeamConversationTimelineItem
}

export type OfficeInteraction = {
  fromAgentId?: string
  toAgentId?: string
  message?: string
  startedAt: number
  kind: OfficeEventType
}

export type AgentOfficeState = {
  agents: OfficeAgentVisualState[]
  events: OfficeEvent[]
  activeInteraction?: OfficeInteraction
  selectedEventId?: string
  mode: "simulation" | "replay" | "live"
  playback: {
    playing: boolean
    speed: 1 | 2 | 4
    cursorSeq?: number
  }
}
