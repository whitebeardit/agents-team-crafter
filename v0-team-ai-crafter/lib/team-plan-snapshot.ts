import type { TeamPlanDraft } from "@/lib/types"

export const TEAM_PLAN_SNAPSHOT_SCHEMA_VERSION = 2 as const
export const TEAM_PLAN_SNAPSHOT_KIND = "team-plan-draft" as const

export type TTeamPlanExportEnvelopeV1 = {
  schemaVersion: 1
  kind: typeof TEAM_PLAN_SNAPSHOT_KIND
  exportedAt: string
  plan: Omit<TeamPlanDraft, "id" | "result">
}

export type TTeamPlanExportEnvelopeV2 = {
  schemaVersion: typeof TEAM_PLAN_SNAPSHOT_SCHEMA_VERSION
  kind: typeof TEAM_PLAN_SNAPSHOT_KIND
  exportedAt: string
  plan: Omit<TeamPlanDraft, "id" | "result">
  uiCapabilityView?: {
    mode: "simple" | "advanced"
  }
  catalogMetadataSnapshot?: {
    generatedFrom: "team-ai-builder"
    includesSemanticCapabilityHints: boolean
  }
}

export type TTeamPlanExportEnvelope = TTeamPlanExportEnvelopeV2

export function buildTeamPlanExportEnvelope(plan: TeamPlanDraft): TTeamPlanExportEnvelope {
  const { id: _i, result: _r, ...rest } = plan
  return {
    schemaVersion: TEAM_PLAN_SNAPSHOT_SCHEMA_VERSION,
    kind: TEAM_PLAN_SNAPSHOT_KIND,
    exportedAt: new Date().toISOString(),
    plan: rest,
    uiCapabilityView: { mode: "simple" },
    catalogMetadataSnapshot: {
      generatedFrom: "team-ai-builder",
      includesSemanticCapabilityHints: true,
    },
  }
}

export function normalizeImportedTeamPlanSnapshot(
  raw: unknown,
): TTeamPlanExportEnvelopeV1 | TTeamPlanExportEnvelopeV2 {
  const input = raw as Record<string, unknown>
  const schemaVersion = Number(input?.schemaVersion)
  const kind = input?.kind
  const plan = input?.plan
  if (kind !== TEAM_PLAN_SNAPSHOT_KIND || !plan || typeof plan !== "object") {
    throw new Error("Snapshot invalido: envelope sem kind/plan esperados.")
  }
  if (schemaVersion === 1) {
    return input as TTeamPlanExportEnvelopeV1
  }
  if (schemaVersion === 2) {
    return input as TTeamPlanExportEnvelopeV2
  }
  throw new Error("Snapshot invalido: schemaVersion deve ser 1 ou 2.")
}
