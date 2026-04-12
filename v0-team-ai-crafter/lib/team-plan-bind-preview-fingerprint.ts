import type { TeamPlanBindPreview } from "@/lib/types"

function sortIds(ids: readonly string[]): string[] {
  return [...ids].map((s) => s.trim()).filter(Boolean).sort()
}

/**
 * Loop 86 — impressão digital do preview para preservar aprovação quando o bind semântico não mudou.
 */
export function bindPreviewApprovalFingerprint(preview: TeamPlanBindPreview): string {
  const agents = preview.agents.map((a) => ({
    k: a.planAgentKey,
    link: sortIds(a.actionIdsToLink),
  }))
  const defs = preview.toolDefinitions.map((d) => ({
    id: d.actionId,
    op: d.plannedOperation,
  }))
  return JSON.stringify({
    req: preview.requiresExplicitApproval,
    applied: preview.autoBindActionsApplied,
    truncated: preview.autoBindActionsTruncated,
    ov: preview.bindOverridesApplied,
    eff: preview.effectiveBindEnabled,
    agents,
    defs,
  })
}
