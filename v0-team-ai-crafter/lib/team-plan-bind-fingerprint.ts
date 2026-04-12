import type { TeamPlanBindOverrides, TeamPlanDraft } from "@/lib/types"

function sortIds(ids: string[] | undefined): string[] {
  return [...(ids ?? [])].map((s) => s.trim()).filter(Boolean).sort()
}

function stableBindOverrides(o: TeamPlanBindOverrides | undefined): string {
  if (!o?.agents) return ""
  const keys = Object.keys(o.agents).sort()
  return keys
    .map((k) => {
      const e = o.agents[k]
      const ex = sortIds(e?.excludedActionIds)
      return `${k}:${e?.mode ?? "inherit"}:${ex.join(",")}`
    })
    .join("|")
}

/**
 * Impressão digital estável do que o backend usa para `bind-preview` / bind execute
 * (Loops 83–85). Omite textos cosméticos, catalogTools, grafo, etc.
 */
export function teamPlanBindFingerprint(plan: TeamPlanDraft): string {
  const agents = plan.agents.map((a) => ({
    role: a.role,
    planningMode: a.planningMode ?? "new",
    existingAgentId: a.existingAgentId ?? null,
    rbi: sortIds(a.requiredBusinessActionIds),
    rpi: sortIds(a.requiredPackIds),
  }))
  return JSON.stringify({
    rp: sortIds(plan.requiredPacks),
    rt: sortIds(plan.requiredTools),
    bo: stableBindOverrides(plan.bindOverrides),
    agents,
  })
}

/** Há packs/tools globais ou listas por agente que exigem revisão de bind. */
export function planHasBindReviewHints(plan: TeamPlanDraft): boolean {
  const global = (plan.requiredPacks?.length ?? 0) + (plan.requiredTools?.length ?? 0) > 0
  const perAgent = plan.agents.some(
    (a) => (a.requiredBusinessActionIds?.length ?? 0) > 0 || (a.requiredPackIds?.length ?? 0) > 0,
  )
  return global || perAgent
}
