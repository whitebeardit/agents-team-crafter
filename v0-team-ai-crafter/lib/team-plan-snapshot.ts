import type { TeamPlanDraft } from "@/lib/types"

export const TEAM_PLAN_SNAPSHOT_SCHEMA_VERSION = 1 as const
export const TEAM_PLAN_SNAPSHOT_KIND = "team-plan-draft" as const

export type TTeamPlanExportEnvelope = {
  schemaVersion: typeof TEAM_PLAN_SNAPSHOT_SCHEMA_VERSION
  kind: typeof TEAM_PLAN_SNAPSHOT_KIND
  exportedAt: string
  plan: Omit<TeamPlanDraft, "id" | "result">
}

export function buildTeamPlanExportEnvelope(plan: TeamPlanDraft): TTeamPlanExportEnvelope {
  const { id: _i, result: _r, ...rest } = plan
  return {
    schemaVersion: TEAM_PLAN_SNAPSHOT_SCHEMA_VERSION,
    kind: TEAM_PLAN_SNAPSHOT_KIND,
    exportedAt: new Date().toISOString(),
    plan: rest,
  }
}
