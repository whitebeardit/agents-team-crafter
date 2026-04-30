import { expect, test } from "@playwright/test"
import type { Node } from "@xyflow/react"
import { applyRosterStackLayout, mergePersistedWithTeamRoster } from "../components/graph/graph-layout-utils"

function makeNode(input: Partial<Node> & { id: string; type: string }): Node {
  return {
    id: input.id,
    type: input.type,
    position: input.position ?? { x: 0, y: 0 },
    data: input.data ?? {},
  } as Node
}

test.describe("graph layout persistence helpers", () => {
  test("merge preserves persisted position for roster nodes", () => {
    const persisted = [
      makeNode({
        id: "coord-1",
        type: "coordinator",
        position: { x: 900, y: 100 },
        data: { agentId: "coord-1", label: "Persisted" },
      }),
    ]
    const template = [
      makeNode({
        id: "coord-1",
        type: "coordinator",
        position: { x: 320, y: 220 },
        data: { agentId: "coord-1", label: "Template" },
      }),
    ]

    const merged = mergePersistedWithTeamRoster(persisted, template)

    expect(merged).toHaveLength(1)
    expect(merged[0]?.position).toEqual({ x: 900, y: 100 })
  })

  test("merge falls back to template position when persisted position is invalid", () => {
    const persisted = [
      makeNode({
        id: "spec-1",
        type: "specialist",
        position: { x: Number.NaN, y: Number.NaN },
        data: { agentId: "spec-1" },
      }),
    ]
    const template = [
      makeNode({
        id: "spec-1",
        type: "specialist",
        position: { x: 640, y: 520 },
        data: { agentId: "spec-1" },
      }),
    ]

    const merged = mergePersistedWithTeamRoster(persisted, template)

    expect(merged[0]?.position).toEqual({ x: 640, y: 520 })
  })

  test("applyRosterStackLayout only fills missing/invalid position", () => {
    const template = [
      makeNode({
        id: "channel-1",
        type: "channel",
        position: { x: 200, y: 40 },
        data: { channelId: "channel-1" },
      }),
      makeNode({
        id: "spec-1",
        type: "specialist",
        position: { x: 600, y: 520 },
        data: { agentId: "spec-1" },
      }),
    ]
    const nodes = [
      makeNode({
        id: "channel-1",
        type: "channel",
        position: { x: Number.NaN, y: Number.NaN },
        data: { channelId: "channel-1" },
      }),
      makeNode({
        id: "spec-1",
        type: "specialist",
        position: { x: 1100, y: 900 },
        data: { agentId: "spec-1" },
      }),
    ]

    const laidOut = applyRosterStackLayout(nodes, template)

    expect(laidOut[0]?.position).toEqual({ x: 200, y: 40 })
    expect(laidOut[1]?.position).toEqual({ x: 1100, y: 900 })
  })
})
