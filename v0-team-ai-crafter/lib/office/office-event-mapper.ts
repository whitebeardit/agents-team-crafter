import type { TeamConversationTimelineItem } from "@/lib/types"
import { compareTimelineItemsChronologically } from "@/lib/live/timeline-sort"
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
    case "memory":
      return "activity"
    case "activity":
    case "status":
    default:
      return "activity"
  }
}

type CoordinatorSpecialistPair = {
  fromAgentId: string
  toAgentId: string
  specialistId: string
}

function buildCoordinatorSpecialistPair(
  fromAgentId: string | undefined,
  toAgentId: string | undefined,
  coordinatorId: string,
): CoordinatorSpecialistPair | undefined {
  if (!fromAgentId || !toAgentId) return undefined
  if (fromAgentId === toAgentId) return undefined
  if (fromAgentId === OFFICE_USER_AGENT_ID || toAgentId === OFFICE_USER_AGENT_ID) return undefined
  if (fromAgentId !== coordinatorId && toAgentId !== coordinatorId) return undefined

  const specialistId = fromAgentId === coordinatorId ? toAgentId : fromAgentId
  if (!specialistId || specialistId === coordinatorId) return undefined

  return {
    fromAgentId,
    toAgentId,
    specialistId,
  }
}

function inferConversationPairForEvent(
  event: OfficeEvent,
  context: { coordinatorId: string },
  activePair?: CoordinatorSpecialistPair,
): CoordinatorSpecialistPair | undefined {
  const explicitPair = buildCoordinatorSpecialistPair(event.fromAgentId, event.toAgentId, context.coordinatorId)
  if (explicitPair) return explicitPair

  if (!activePair || !event.actorId) return undefined
  if (event.actorId === context.coordinatorId) return activePair
  if (event.actorId === activePair.specialistId) return activePair
  return undefined
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
  const uniqueItems: TeamConversationTimelineItem[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    uniqueItems.push(item)
  }

  const sortedUnique = [...uniqueItems].sort(compareTimelineItemsChronologically)
  const mapped = sortedUnique.map((item) => mapTimelineItemToOfficeEvent(item, context))

  const out: OfficeEvent[] = []
  let activePair: CoordinatorSpecialistPair | undefined

  for (const event of mapped) {
    if (event.type === "user_message" || event.type === "run_complete") {
      activePair = undefined
      out.push(event)
      continue
    }

    const explicitPair = buildCoordinatorSpecialistPair(event.fromAgentId, event.toAgentId, context.coordinatorId)
    if (explicitPair) {
      activePair = explicitPair
      out.push(event)
      continue
    }

    if (
      event.type === "agent_thinking" ||
      event.type === "tool_call" ||
      event.type === "tool_result" ||
      event.type === "activity" ||
      event.type === "error"
    ) {
      const inferredPair = inferConversationPairForEvent(event, context, activePair)
      if (inferredPair) {
        activePair = inferredPair
        out.push({
          ...event,
          fromAgentId: event.fromAgentId ?? inferredPair.fromAgentId,
          toAgentId: event.toAgentId ?? inferredPair.toAgentId,
        })
        continue
      }
    }

    out.push(event)
  }

  return out
}
