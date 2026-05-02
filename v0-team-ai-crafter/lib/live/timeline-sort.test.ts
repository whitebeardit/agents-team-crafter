import test from "node:test"
import assert from "node:assert/strict"
import { compareTimelineItemsChronologically } from "@/lib/live/timeline-sort"

test("orders by timestamp across runs, not by seq alone", () => {
  const laterInput = { timestamp: "2026-05-02T10:00:00.000Z", runId: "run-b", seq: 1 }
  const earlierOutput = { timestamp: "2026-05-02T09:00:00.000Z", runId: "run-a", seq: 2 }
  const items = [laterInput, earlierOutput].sort(compareTimelineItemsChronologically)
  assert.equal(items[0]?.runId, "run-a")
  assert.equal(items[1]?.runId, "run-b")
})
