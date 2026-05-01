"use client"

import type { OfficeAgentVisualState, OfficeEvent } from "@/lib/office/office-types"
import { OFFICE_GAME_HEIGHT, OFFICE_GAME_WIDTH } from "@/components/office/agent-office-scene"

const BUBBLE_MAX = 168

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function bubbleSpeaker(event: OfficeEvent, agents: OfficeAgentVisualState[], coordinatorId: string): string | null {
  switch (event.type) {
    case "user_message":
      return null
    case "agent_handoff":
      return event.toAgentId ?? event.fromAgentId ?? null
    case "agent_response":
      return event.actorId ?? null
    case "agent_thinking":
    case "tool_call":
    case "tool_result":
    case "activity":
    case "error":
      return event.actorId ?? null
    default:
      return event.actorId ?? coordinatorId
  }
}

export function AgentOfficeOverlay({
  agents,
  activeEvent,
  coordinatorId,
}: {
  agents: OfficeAgentVisualState[]
  activeEvent?: OfficeEvent
  coordinatorId: string
}) {
  if (!activeEvent?.message) return null

  const speakerId = bubbleSpeaker(activeEvent, agents, coordinatorId)
  const speaker = speakerId ? agents.find((a) => a.agentId === speakerId) : null
  const title =
    activeEvent.type === "user_message"
      ? "Utilizador"
      : speaker?.name ?? (speakerId ? `Agente ${speakerId.slice(0, 8)}…` : "Evento")

  const leftPct = speaker
    ? (speaker.x / OFFICE_GAME_WIDTH) * 100
    : 50
  const topPct = speaker
    ? (speaker.y / OFFICE_GAME_HEIGHT) * 100
    : 8

  return (
    <div
      className="pointer-events-none absolute z-10 flex max-w-[min(100%,22rem)] flex-col gap-1 rounded-lg border border-border bg-card/95 px-3 py-2 text-sm shadow-lg backdrop-blur-sm"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: "translate(-50%, calc(-100% - 12px))",
      }}
    >
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className="text-foreground leading-snug">{truncate(activeEvent.message, BUBBLE_MAX)}</p>
      <p className="text-[10px] text-muted-foreground tabular-nums">
        {activeEvent.type} · seq {activeEvent.seq}
      </p>
    </div>
  )
}
