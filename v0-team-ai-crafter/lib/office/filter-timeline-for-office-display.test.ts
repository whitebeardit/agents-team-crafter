import test from "node:test"
import assert from "node:assert/strict"
import { filterTimelineItemsForOfficeDisplay } from "@/lib/office/filter-timeline-for-office-display"
import type { TeamConversationTimelineItem } from "@/lib/types"

test("filterTimelineItemsForOfficeDisplay removes streaming chunks but keeps final output", () => {
  const items = [
    {
      id: "1",
      workspaceId: "w",
      teamId: "t",
      runId: "r",
      seq: 1,
      timestamp: "2026-05-02T12:00:00.000Z",
      actor: "coordinator" as const,
      actorId: "coord",
      kind: "output" as const,
      content: "Ol",
      meta: { streaming: true, chunk: true },
    },
    {
      id: "2",
      workspaceId: "w",
      teamId: "t",
      runId: "r",
      seq: 2,
      timestamp: "2026-05-02T12:00:01.000Z",
      actor: "coordinator" as const,
      actorId: "coord",
      kind: "output" as const,
      content: "Olá! Como posso ajudar?",
      meta: { final: true, format: "plain" },
    },
  ] satisfies TeamConversationTimelineItem[]

  const out = filterTimelineItemsForOfficeDisplay(items, { hideStreamingChunks: true })
  assert.equal(out.length, 1)
  assert.equal(out[0]?.id, "2")
})
