import test from "node:test"
import assert from "node:assert/strict"
import { mapTimelineItemsToOfficeEvents } from "@/lib/office/office-event-mapper"
import type { TeamConversationTimelineItem } from "@/lib/types"

const coordinatorId = "agent-coord"
const specialistId = "agent-spec"

function buildItem(
  overrides: Partial<TeamConversationTimelineItem> & Pick<TeamConversationTimelineItem, "id" | "seq" | "kind" | "content">,
): TeamConversationTimelineItem {
  return {
    workspaceId: "ws-1",
    teamId: "team-1",
    runId: "run-1",
    timestamp: `2026-05-01T10:00:0${overrides.seq}.000Z`,
    actor: "system",
    ...overrides,
  }
}

test("mapTimelineItemsToOfficeEvents keeps coordinator-specialist edge during live activity", () => {
  const events = mapTimelineItemsToOfficeEvents(
    [
      buildItem({
        id: "1",
        seq: 1,
        actor: "user",
        kind: "input",
        content: "Preciso de ajuda",
      }),
      buildItem({
        id: "2",
        seq: 2,
        actor: "specialist",
        actorId: specialistId,
        kind: "handoff",
        content: "Encaminhando ao especialista",
      }),
      buildItem({
        id: "3",
        seq: 3,
        actor: "specialist",
        actorId: specialistId,
        kind: "tool_call",
        content: "Consultando CRM",
      }),
      buildItem({
        id: "4",
        seq: 4,
        actor: "specialist",
        actorId: specialistId,
        kind: "activity",
        content: "Especialista em execução",
      }),
      buildItem({
        id: "5",
        seq: 5,
        actor: "specialist",
        actorId: specialistId,
        kind: "output",
        content: "Cliente encontrado",
      }),
    ],
    { coordinatorId },
  )

  assert.deepEqual(
    events.map((event) => ({
      id: event.id,
      type: event.type,
      fromAgentId: event.fromAgentId,
      toAgentId: event.toAgentId,
    })),
    [
      { id: "1", type: "user_message", fromAgentId: undefined, toAgentId: undefined },
      { id: "2", type: "agent_handoff", fromAgentId: coordinatorId, toAgentId: specialistId },
      { id: "3", type: "tool_call", fromAgentId: coordinatorId, toAgentId: specialistId },
      { id: "4", type: "activity", fromAgentId: coordinatorId, toAgentId: specialistId },
      { id: "5", type: "agent_response", fromAgentId: specialistId, toAgentId: coordinatorId },
    ],
  )
})

test("mapTimelineItemsToOfficeEvents does not leak the specialist edge into final coordinator output", () => {
  const events = mapTimelineItemsToOfficeEvents(
    [
      buildItem({
        id: "1",
        seq: 1,
        actor: "specialist",
        actorId: specialistId,
        kind: "handoff",
        content: "Especialista acionado",
      }),
      buildItem({
        id: "2",
        seq: 2,
        actor: "coordinator",
        actorId: coordinatorId,
        kind: "thinking",
        content: "Consolidando resposta",
      }),
      buildItem({
        id: "3",
        seq: 3,
        actor: "coordinator",
        actorId: coordinatorId,
        kind: "output",
        content: "Resposta final ao usuário",
        meta: { final: true },
      }),
    ],
    { coordinatorId },
  )

  assert.equal(events[1]?.fromAgentId, coordinatorId)
  assert.equal(events[1]?.toAgentId, specialistId)
  assert.equal(events[2]?.fromAgentId, coordinatorId)
  assert.equal(events[2]?.toAgentId, coordinatorId)
})
