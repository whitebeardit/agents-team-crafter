import test from "node:test"
import assert from "node:assert/strict"
import { buildTimelineViewModel } from "@/lib/live/timeline-view-model"
import type { TeamConversationTimelineItem } from "@/lib/types"

test("buildTimelineViewModel maps and orders timeline items", () => {
  const items: TeamConversationTimelineItem[] = [
    {
      id: "2",
      workspaceId: "w1",
      teamId: "t1",
      runId: "r1",
      seq: 2,
      timestamp: "2026-05-01T10:00:02.000Z",
      actor: "coordinator",
      actorId: "a-coord",
      kind: "thinking",
      content: "Analisando contexto",
    },
    {
      id: "1",
      workspaceId: "w1",
      teamId: "t1",
      runId: "r1",
      seq: 1,
      timestamp: "2026-05-01T10:00:01.000Z",
      actor: "user",
      kind: "input",
      content: "Qual é o status?",
    },
  ]

  const vm = buildTimelineViewModel(items, { "a-coord": "Coordenador X" })
  assert.equal(vm.length, 2)
  assert.equal(vm[0]?.id, "1")
  assert.equal(vm[0]?.kindLabel, "Input")
  assert.equal(vm[1]?.actorLabel, "Coordenador X")
  assert.equal(vm[1]?.kindLabel, "Thinking")
  assert.equal(vm[1]?.kind, "thinking")
  assert.equal(vm[1]?.actor, "coordinator")
})

test("buildTimelineViewModel uses timestamp fallback and trims excerpts", () => {
  const long = "a".repeat(400)
  const items: TeamConversationTimelineItem[] = [
    {
      id: "x1",
      workspaceId: "w1",
      teamId: "t1",
      runId: "r1",
      seq: 1,
      timestamp: "invalid-date",
      actor: "system",
      kind: "error",
      content: long,
    },
  ]
  const vm = buildTimelineViewModel(items)
  assert.equal(vm[0]?.timestampLabel, "invalid-date")
  assert.equal(vm[0]?.kindLabel, "Erro")
  assert.ok((vm[0]?.excerpt.length ?? 0) < long.length)
})
