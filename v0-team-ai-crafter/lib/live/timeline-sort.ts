import type { TeamConversationTimelineItem } from "@/lib/types"

/**
 * Ordenação global da conversa: várias execuções têm `seq` reiniciado por run;
 * ordenar só por `seq` agrupa inputs de runs diferentes e esconde outputs.
 */
export function compareTimelineItemsChronologically(
  a: Pick<TeamConversationTimelineItem, "timestamp" | "runId" | "seq">,
  b: Pick<TeamConversationTimelineItem, "timestamp" | "runId" | "seq">,
): number {
  const byTime = a.timestamp.localeCompare(b.timestamp)
  if (byTime !== 0) return byTime
  const byRun = a.runId.localeCompare(b.runId)
  if (byRun !== 0) return byRun
  return a.seq - b.seq
}
