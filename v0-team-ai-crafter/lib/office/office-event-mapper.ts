import type { TeamConversationTimelineItem } from "@/lib/types"
import { OFFICE_USER_AGENT_ID, type OfficeEvent, type OfficeEventType } from "./office-types"

function readString(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim().length > 0) return v.trim()
  return undefined
}

function displayMessage(item: TeamConversationTimelineItem): string {
  const meta = item.meta ?? {}
  return readString(meta.displayText) ?? item.content ?? ""
}

function kindToOfficeType(kind: TeamConversationTimelineItem["kind"]): OfficeEventType {
  switch (kind) {
    case "input":
      return "user_message"
    case "thinking":
      return "agent_thinking"
    case "output":
      return "agent_response"
    case "handoff":
      return "agent_handoff"
    case "tool_call":
      return "tool_call"
    case "tool_result":
      return "tool_result"
    case "error":
      return "error"
    case "activity":
    case "status":
    default:
      return "activity"
  }
}

export function mapTimelineItemToOfficeEvent(
  item: TeamConversationTimelineItem,
  context: { coordinatorId: string },
): OfficeEvent {
  const fromAgentId = readString(item.meta?.fromAgentId)
  const toAgentId = readString(item.meta?.toAgentId)
  const message = displayMessage(item)

  if (item.kind === "handoff") {
    return {
      id: item.id,
      seq: item.seq,
      timestamp: item.timestamp,
      type: "agent_handoff",
      fromAgentId: fromAgentId ?? context.coordinatorId,
      toAgentId: toAgentId ?? item.actorId,
      actorId: item.actorId,
      message,
      original: item,
    }
  }

  if (item.kind === "thinking") {
    return {
      id: item.id,
      seq: item.seq,
      timestamp: item.timestamp,
      type: "agent_thinking",
      actorId: item.actorId,
      message,
      original: item,
    }
  }

  if (item.kind === "output") {
    const outputSpeakerId = fromAgentId ?? item.actorId
    return {
      id: item.id,
      seq: item.seq,
      timestamp: item.timestamp,
      type: "agent_response",
      fromAgentId: outputSpeakerId,
      toAgentId: toAgentId ?? context.coordinatorId,
      actorId: outputSpeakerId,
      message,
      original: item,
    }
  }

  if (item.kind === "tool_call") {
    return {
      id: item.id,
      seq: item.seq,
      timestamp: item.timestamp,
      type: "tool_call",
      actorId: item.actorId,
      message,
      original: item,
    }
  }

  if (item.kind === "error") {
    return {
      id: item.id,
      seq: item.seq,
      timestamp: item.timestamp,
      type: "error",
      actorId: item.actorId,
      message,
      original: item,
    }
  }

  if (item.kind === "input") {
    return {
      id: item.id,
      seq: item.seq,
      timestamp: item.timestamp,
      type: "user_message",
      actorId: OFFICE_USER_AGENT_ID,
      message,
      original: item,
    }
  }

  return {
    id: item.id,
    seq: item.seq,
    timestamp: item.timestamp,
    type: kindToOfficeType(item.kind),
    actorId: item.actorId,
    message,
    original: item,
  }
}

export function mapTimelineItemsToOfficeEvents(
  items: TeamConversationTimelineItem[],
  context: { coordinatorId: string },
): OfficeEvent[] {
  const seen = new Set<string>()
  const out: OfficeEvent[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(mapTimelineItemToOfficeEvent(item, context))
  }
  return out.sort((a, b) => (a.seq === b.seq ? a.timestamp.localeCompare(b.timestamp) : a.seq - b.seq))
}
