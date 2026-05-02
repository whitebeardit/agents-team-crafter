import type { TeamConversationTimelineItem } from "@/lib/types"

function isLifecycleActivityNoise(it: TeamConversationTimelineItem): boolean {
  if (it.kind !== "activity") return false
  const meta = it.meta as Record<string, unknown> | undefined
  const et = typeof meta?.eventType === "string" ? meta.eventType : ""
  if (!et) return false
  return et.endsWith("Started") || et.endsWith("Finished")
}

/**
 * Modo compacto do escritório: menos ruído operacional.
 * - Remove chunks de `output` em streaming (mantém `meta.final`).
 * - Remove `activity` de ciclo de vida (coordinatorStarted/Finished, specialistStarted/Finished, …).
 */
export function filterTimelineItemsForOfficeDisplay(
  items: TeamConversationTimelineItem[],
  options: { hideStreamingChunks: boolean },
): TeamConversationTimelineItem[] {
  if (!options.hideStreamingChunks) return items
  return items.filter((it) => {
    if (isLifecycleActivityNoise(it)) return false
    if (it.kind !== "output") return true
    const meta = it.meta as Record<string, unknown> | undefined
    if (!meta) return true
    if (meta.final === true) return true
    if (meta.streaming === true && meta.chunk === true) return false
    return true
  })
}
