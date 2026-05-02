/**
 * Taxonomia para camadas de bind (Clínica GOLD vs primitivas universais).
 * Espelha `isClinicalOperationalBriefing` / prefixos de negócio em
 * `backend/.../team-plan-adequacy-gate.ts` — manter comentários ao alterar.
 */
import type { TeamPlanBindPreview, TeamPlanDraft, TeamPlanStructuredBriefing } from "@/lib/types"

/** Prefixos de business actions consideradas primitivas universais em contexto clínico. */
export const CLINIC_UNIVERSAL_PREFIXES = [
  "crm_",
  "schedule_",
  "finance_",
  "clinical_",
  "package_",
  "attendance_",
  "care_",
] as const

/** Packs de domínio “universal” em paralelo a `clinic_ops`. */
export const CLINIC_UNIVERSAL_PACKS = ["care", "clinical", "scheduling", "finance", "packages_encounters"] as const

// --- Alinhado a team-plan-adequacy-gate.ts (isClinicalOperationalBriefing) ---

function normalize(values: ReadonlyArray<string | undefined> | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value?.trim().toLowerCase() ?? "").filter(Boolean))]
}

function normalizeText(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? ""
}

function includesAny(text: string, tokens: readonly string[]): boolean {
  return tokens.some((token) => text.includes(token))
}

const CLINICAL_BRIEFING_TOKENS = [
  "clinic",
  "clinica",
  "clínica",
  "saude",
  "saúde",
  "psicolog",
  "paciente",
  "sessao",
  "sessão",
  "prontuario",
  "prontuário",
  "terapia",
  "atendimento clinico",
  "atendimento clínico",
] as const

const CLINICAL_DOMAIN_IDS = ["clinic_ops", "clinical", "care", "packages_encounters", "scheduling"] as const

const CLINICAL_OPERATION_TOKENS = [
  "atendimento",
  "agendamento",
  "agenda",
  "sessao",
  "sessão",
  "pacote",
  "prontuario",
  "prontuário",
  "cobranca",
  "cobrança",
  "financeiro",
  "acompanhamento",
  "crud",
] as const

/**
 * Mesma ideia que `isClinicalOperationalBriefing` no backend: briefing clínico
 * com sinal operacional (ou sem operationKinds ainda definidos).
 */
export function isClinicalOperationalBriefing(briefing?: TeamPlanStructuredBriefing | null): boolean {
  if (!briefing) return false
  const domainValues = normalize([
    briefing.primaryDomain,
    ...(briefing.secondaryDomains ?? []),
    ...(briefing.domainsNeeded ?? []),
    ...(briefing.mustHaveCapabilities ?? []),
  ])
  const entityValues = normalize([...(briefing.mainEntities ?? []), ...(briefing.sharedEntities ?? [])])
  const operationValues = normalize(briefing.operationKinds)
  const textBlob = [
    briefing.problemSummary,
    briefing.businessType,
    briefing.operationalUnit,
    briefing.businessGoal,
    briefing.coreJourney,
    briefing.primaryDomain,
    ...(briefing.secondaryDomains ?? []),
    ...(briefing.domainsNeeded ?? []),
    ...(briefing.mainEntities ?? []),
    ...(briefing.sharedEntities ?? []),
    ...(briefing.mustHaveCapabilities ?? []),
  ]
    .map(normalizeText)
    .join(" ")

  const hasClinicalSignal =
    includesAny(textBlob, CLINICAL_BRIEFING_TOKENS) ||
    domainValues.some((domain) => (CLINICAL_DOMAIN_IDS as readonly string[]).includes(domain)) ||
    entityValues.some((entity) => includesAny(entity, CLINICAL_BRIEFING_TOKENS))
  if (!hasClinicalSignal) return false

  const hasOperationalSignal =
    operationValues.length === 0 ||
    operationValues.some((operation) => includesAny(operation, CLINICAL_OPERATION_TOKENS)) ||
    includesAny(textBlob, CLINICAL_OPERATION_TOKENS)
  return hasOperationalSignal
}

export type BusinessActionKind = "clinic_gold" | "universal_primitive" | "other"

export function classifyBusinessActionId(actionId: string): BusinessActionKind {
  const id = actionId.trim()
  if (id.startsWith("clinic_")) return "clinic_gold"
  if (CLINIC_UNIVERSAL_PREFIXES.some((prefix) => id.startsWith(prefix))) return "universal_primitive"
  return "other"
}

export type PackClinicLayer = "clinic_ops_layer" | "universal_layer" | "other"

export function classifyPackIdForClinicLayer(packId: string): PackClinicLayer {
  const k = packId.trim().toLowerCase()
  if (k === "clinic_ops") return "clinic_ops_layer"
  if ((CLINIC_UNIVERSAL_PACKS as readonly string[]).includes(k)) return "universal_layer"
  return "other"
}

export type ToolDefinitionBindLayer = "recommended" | "fallback" | "other"

export function classifyToolDefinitionLayer(def: {
  actionId: string
  packIds: readonly string[]
}): ToolDefinitionBindLayer {
  const aid = def.actionId.trim()
  if (aid.startsWith("clinic_")) return "recommended"
  if (def.packIds.some((p) => p.trim().toLowerCase() === "clinic_ops")) return "recommended"
  if (classifyBusinessActionId(aid) === "universal_primitive") return "fallback"
  return "other"
}

export function planHasClinicGoldSignal(plan: TeamPlanDraft | null): boolean {
  if (!plan) return false
  const packIds = [...(plan.requiredPacks ?? []), ...plan.agents.flatMap((a) => a.requiredPackIds ?? [])].map((p) =>
    p.trim().toLowerCase(),
  )
  if (packIds.includes("clinic_ops")) return true
  const actionIds = [...(plan.requiredTools ?? []), ...plan.agents.flatMap((a) => a.requiredBusinessActionIds ?? [])]
    .map((a) => a.trim())
    .filter(Boolean)
  return actionIds.some((id) => id.startsWith("clinic_"))
}

export function bindPreviewHasClinicGoldSignal(preview: TeamPlanBindPreview): boolean {
  for (const d of preview.toolDefinitions) {
    if (d.actionId.trim().startsWith("clinic_")) return true
    if (d.packIds.some((p) => p.trim().toLowerCase() === "clinic_ops")) return true
  }
  for (const p of preview.suggestedPacks) {
    if (p.packId.trim().toLowerCase() === "clinic_ops") return true
  }
  for (const a of preview.agents) {
    const ids = [...a.actionIdsToLink, ...a.actionIdsCandidate, ...a.defaultActionIdsToLink]
    if (ids.some((id) => id.trim().startsWith("clinic_"))) return true
  }
  return false
}

/** True quando devemos aplicar UI em camadas (resumo simples + secções no avançado). */
export function shouldApplyClinicBindLayers(
  plan: TeamPlanDraft | null,
  bindPreview: TeamPlanBindPreview | null | undefined,
): boolean {
  if (!plan?.briefing) return false
  if (!isClinicalOperationalBriefing(plan.briefing)) return false
  if (planHasClinicGoldSignal(plan)) return true
  if (bindPreview && bindPreviewHasClinicGoldSignal(bindPreview)) return true
  return false
}

export function countBindPreviewFallbackDefinitions(preview: TeamPlanBindPreview): number {
  return preview.toolDefinitions.filter((d) => classifyToolDefinitionLayer(d) === "fallback").length
}

export function splitActionIdsByBindLayer(actionIds: readonly string[]): {
  recommended: string[]
  fallback: string[]
  other: string[]
} {
  const recommended: string[] = []
  const fallback: string[] = []
  const other: string[] = []
  for (const raw of actionIds) {
    const id = raw.trim()
    const k = classifyBusinessActionId(id)
    if (k === "clinic_gold") recommended.push(raw)
    else if (k === "universal_primitive") fallback.push(raw)
    else other.push(raw)
  }
  return { recommended, fallback, other }
}
