import type { TeamConversationTimelineItem } from "@/lib/types"

/**
 * Inbound/streaming append vários `output` com meta.chunk; no escritório isso esconde o diálogo final.
 * Mantém sempre `meta.final` e eventos não-output.
 */
export function filterTimelineItemsForOfficeDisplay(
  items: TeamConversationTimelineItem[],
  options: { hideStreamingChunks: boolean },
): TeamConversationTimelineItem[] {
  if (!options.hideStreamingChunks) return items
  return items.filter((it) => {
    if (it.kind !== "output") return true
    const meta = it.meta as Record<string, unknown> | undefined
    if (!meta) return true
    if (meta.final === true) return true
    if (meta.streaming === true && meta.chunk === true) return false
    return true
  })
}
