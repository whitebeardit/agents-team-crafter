"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Loader2,
  Sparkles,
  Play,
  PencilLine,
  AlertTriangle,
  ChevronDown,
  Settings2,
  Download,
  Upload,
} from "lucide-react"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { ApiError, createApiClient } from "@/lib/api/client"
import type {
  GovernanceFeatureFlags,
  GovernanceOverlapMode,
  TeamPlanBindOverrideEntry,
  TeamPlanBindOverrides,
  TeamPlanBindPreview,
  TeamPlanBindPreviewAgent,
  TeamPlanBindPreviewPack,
  TeamPlanAgentDraft,
  TeamPlanDraft,
  TeamPlanExecuteMeta,
  TeamPlanPlannerMeta,
  TeamPlanStructuredBriefing,
} from "@/lib/types"
import { getPlannerFallbackCopy } from "@/lib/planner-fallback-messages"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { resolveChannelHintToProductType } from "@/lib/briefing-channel-hint"
import { buildTeamPlanExportEnvelope } from "@/lib/team-plan-snapshot"
import { createOperationId } from "@/lib/utils/operation-id"
import { bindPreviewApprovalFingerprint } from "@/lib/team-plan-bind-preview-fingerprint"
import { planHasBindReviewHints, teamPlanBindFingerprint } from "@/lib/team-plan-bind-fingerprint"
import { plannerPackLabelPt } from "@/lib/planner-pack-labels"
import {
  CATALOG_UTILITY_TOOL_IDS,
  SPECIALIST_EXCLUSIVE_CATALOG_TOOL_IDS,
  catalogToolLabelPt,
  type CatalogToolId,
} from "@/lib/catalog-tool-ids"
import { ReactFlow, type Node, type Edge } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { nodeTypes as graphNodeTypes } from "@/components/graph/graph-node"
import { GraphLegendInline } from "@/components/graph/graph-legend"
import { GraphFlowOverlays } from "@/components/graph/graph-flow-overlays"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

type TeamPlanningPolicy = {
  autoBindMode: "inherit" | "enabled" | "disabled"
  autoBindEnabled: boolean
  source: "workspace_enabled" | "workspace_disabled" | "environment_default"
  reusedAgentBindMode: "manual" | "merge"
}

type GuidedBuilderStage =
  | "discovery"
  | "business_understanding"
  | "domains_understanding"
  | "briefing_confirmation"
  | "plan_generation"
  | "team_review"
  | "execution"

const GUIDED_BUILDER_FLOW: Array<{ id: GuidedBuilderStage; label: string }> = [
  { id: "discovery", label: "Descoberta do problema" },
  { id: "business_understanding", label: "Entendimento do negócio" },
  { id: "domains_understanding", label: "Domínios necessários" },
  { id: "briefing_confirmation", label: "Confirmação do briefing" },
  { id: "plan_generation", label: "Geração do plano" },
  { id: "team_review", label: "Revisão do time" },
  { id: "execution", label: "Execução" },
]

type DiscoveryQuestion = {
  id:
    | "businessGoal"
    | "businessType"
    | "coreJourney"
    | "domainsNeeded"
    | "mainEntities"
    | "primaryChannel"
    | "constraints"
    | "operationKinds"
  label: string
  helper: string
  placeholder: string
  quickOptions: string[]
}

const DISCOVERY_UNKNOWN = "Não sei ainda"

const DISCOVERY_QUESTIONS: DiscoveryQuestion[] = [
  {
    id: "businessGoal",
    label: "Qual é o objetivo principal do time?",
    helper: "Ex.: aumentar conversão, reduzir no-show, organizar atendimento, melhorar cobrança.",
    placeholder: "Descreva o resultado de negócio esperado...",
    quickOptions: ["Aumentar eficiência operacional", "Reduzir atrasos e falhas", "Melhorar experiência do cliente/paciente"],
  },
  {
    id: "businessType",
    label: "Qual é o tipo de negócio/operação?",
    helper: "Isto ajuda a calibrar os especialistas e packs recomendados.",
    placeholder: "Ex.: clínica psicológica, consultoria, serviços locais, operação comercial...",
    quickOptions: ["Clínica/saúde", "Serviços", "Comercial/CRM"],
  },
  {
    id: "coreJourney",
    label: "Qual é a jornada principal que precisa funcionar melhor?",
    helper: "Pense no fluxo ponta a ponta mais crítico.",
    placeholder: "Ex.: lead → agendamento → atendimento → cobrança → follow-up...",
    quickOptions: ["Captação até fechamento", "Agendamento até conclusão", "Atendimento e acompanhamento"],
  },
  {
    id: "domainsNeeded",
    label: "Quais domínios precisam coexistir no mesmo time?",
    helper: "Pode listar mais de um domínio.",
    placeholder: "Ex.: CRM, Scheduling, Finance, Clinical, Care...",
    quickOptions: ["CRM + Scheduling", "CRM + Scheduling + Finance", "Clinical + Care + Finance"],
  },
  {
    id: "mainEntities",
    label: "Quais entidades o time vai operar?",
    helper: "Ex.: cliente, paciente, lead, agenda, cobrança, sessão, prontuário.",
    placeholder: "Liste as entidades principais...",
    quickOptions: ["Cliente, lead, agenda", "Paciente, sessão, prontuário", "Cliente, pedido, pagamento"],
  },
  {
    id: "primaryChannel",
    label: "Qual é o canal principal de operação?",
    helper: "Ajuda o planner a priorizar o contexto operacional.",
    placeholder: "Ex.: WhatsApp, web, API interna, Slack, Telegram...",
    quickOptions: ["WhatsApp", "Web/App", "API interna"],
  },
  {
    id: "constraints",
    label: "Existe alguma restrição relevante de dados ou integrações?",
    helper: "Se não souber, pode marcar 'Não sei ainda'.",
    placeholder: "Ex.: sem acesso a ERP, dados sensíveis, janela de atendimento...",
    quickOptions: ["LGPD/dados sensíveis", "Integrações legadas", "Sem restrição crítica no momento"],
  },
  {
    id: "operationKinds",
    label: "Que tipo de operação o time deve executar no dia a dia?",
    helper: "Marque a natureza do trabalho esperado.",
    placeholder: "Ex.: CRUD, atendimento, automação, acompanhamento, operação administrativa...",
    quickOptions: ["CRUD + atendimento", "Automação + acompanhamento", "Operação administrativa + auditoria"],
  },
]

function normalizeDiscoveryValue(value: string): string {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : DISCOVERY_UNKNOWN
}

function buildGuidedPlannerInput(
  answers: Partial<Record<DiscoveryQuestion["id"], string>>,
): { problem: string; context: string } {
  const questionById = new Map(DISCOVERY_QUESTIONS.map((q) => [q.id, q]))
  const businessGoal = answers.businessGoal?.trim()
  const coreJourney = answers.coreJourney?.trim()
  const businessType = answers.businessType?.trim()
  const problem =
    businessGoal && businessGoal !== DISCOVERY_UNKNOWN
      ? businessGoal
      : coreJourney && coreJourney !== DISCOVERY_UNKNOWN
        ? `Melhorar jornada operacional: ${coreJourney}`
        : businessType && businessType !== DISCOVERY_UNKNOWN
          ? `Estruturar operação agent-first para ${businessType}`
          : "Estruturar um time operacional agent-first com especialistas por domínio."

  const contextLines = DISCOVERY_QUESTIONS.map((q) => {
    const raw = answers[q.id]?.trim()
    if (!raw) return null
    const normalized = raw.length > 0 ? raw : DISCOVERY_UNKNOWN
    return `- ${questionById.get(q.id)?.label ?? q.id}: ${normalized}`
  }).filter((line): line is string => Boolean(line))

  return {
    problem,
    context: contextLines.join("\n"),
  }
}

function normalizeCsvList(value: string | undefined): string[] {
  if (!value) return []
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))]
}

function normalizeSingleValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed || trimmed === DISCOVERY_UNKNOWN) return undefined
  return trimmed
}

function buildStructuredBriefingFromDiscovery(
  answers: Partial<Record<DiscoveryQuestion["id"], string>>,
  fallbackProblem: string,
): TeamPlanStructuredBriefing {
  const domains = normalizeCsvList(answers.domainsNeeded)
  const entities = normalizeCsvList(answers.mainEntities)
  const constraints = normalizeCsvList(answers.constraints)
  const operationKinds = normalizeCsvList(answers.operationKinds)
  return {
    problemSummary: normalizeSingleValue(fallbackProblem),
    businessType: normalizeSingleValue(answers.businessType),
    operationalUnit: normalizeSingleValue(answers.businessType),
    businessGoal: normalizeSingleValue(answers.businessGoal),
    coreJourney: normalizeSingleValue(answers.coreJourney),
    primaryDomain: domains[0],
    secondaryDomains: domains.slice(1),
    domainsNeeded: domains,
    mainEntities: entities,
    sharedEntities: entities,
    primaryChannel:
      resolveChannelHintToProductType(answers.primaryChannel) ??
      normalizeSingleValue(answers.primaryChannel),
    operationKinds,
    constraints,
    mustHaveCapabilities: domains,
    mustAvoid: [],
    crossDomainIntegrityNeeds: entities.length > 0 ? [`Reusar entidades partilhadas: ${entities.join(", ")}`] : [],
  }
}

type DiscoverySufficiency = {
  status: "sufficient" | "partial" | "insufficient"
  missingSignals: string[]
  answeredSignals: number
  expectedSignals: number
}

function normalizeBriefingStringList(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean))]
}

/** Espelha `evaluateTeamPlanAdequacy` do backend para mensagens consistentes. */
function evaluateClientPlanAdequacy(plan: TeamPlanDraft | null): string[] {
  if (!plan) return []
  const issues: string[] = []
  const coordinatorCount = plan.agents.filter((agent) => agent.role === "coordinator").length
  const specialists = plan.agents.filter((agent) => agent.role === "specialist")
  if (coordinatorCount !== 1) issues.push("Plano precisa de exatamente um coordenador ativo.")
  if (specialists.length === 0) issues.push("Plano sem especialista operacional.")
  const domainsNeeded = normalizeBriefingStringList(plan.briefing?.domainsNeeded)
  const sharedEntities = normalizeBriefingStringList(plan.briefing?.sharedEntities)
  const integrityNeeds = normalizeBriefingStringList(plan.briefing?.crossDomainIntegrityNeeds)
  if (domainsNeeded.length > 0 && specialists.length < Math.min(domainsNeeded.length, 3)) {
    issues.push("Quantidade de especialistas parece insuficiente para os domínios informados.")
  }
  if (domainsNeeded.length > 1 && sharedEntities.length === 0) {
    issues.push("Briefing multi-domínio sem entidades partilhadas explícitas para integridade.")
  }
  if (domainsNeeded.length > 1 && integrityNeeds.length === 0) {
    issues.push("Briefing multi-domínio sem regra de integridade entre domínios.")
  }
  const planChannel = plan.team.primaryChannel?.trim().toLowerCase()
  const briefingResolved = resolveChannelHintToProductType(plan.briefing?.primaryChannel)
  const briefingNorm = briefingResolved ?? plan.briefing?.primaryChannel?.trim().toLowerCase()
  if (briefingNorm && planChannel && briefingNorm !== planChannel) {
    issues.push("Canal principal do plano diverge do canal principal do briefing.")
  }
  const needsOperationalTools = normalizeBriefingStringList(plan.briefing?.operationKinds).some((kind) =>
    ["crud", "atendimento", "automacao", "acompanhamento"].some((token) => kind.includes(token)),
  )
  const hasOperationalCapability = (plan.requiredTools?.length ?? 0) > 0 || (plan.requiredPacks?.length ?? 0) > 0
  if (needsOperationalTools && !hasOperationalCapability) {
    issues.push("Plano sem packs/tools de negócio para a operação declarada no briefing.")
  }
  return issues
}

function evaluateDiscoverySufficiency(briefing: TeamPlanStructuredBriefing): DiscoverySufficiency {
  const signals: Array<{ key: string; ok: boolean }> = [
    { key: "businessGoal", ok: Boolean(briefing.businessGoal?.trim() || briefing.problemSummary?.trim()) },
    { key: "businessType", ok: Boolean(briefing.businessType?.trim() || briefing.operationalUnit?.trim()) },
    { key: "coreJourney", ok: Boolean(briefing.coreJourney?.trim()) },
    { key: "domainsNeeded", ok: Boolean((briefing.domainsNeeded ?? []).length || briefing.primaryDomain?.trim()) },
    { key: "mainEntities", ok: Boolean((briefing.mainEntities ?? []).length) },
    { key: "primaryChannel", ok: Boolean(briefing.primaryChannel?.trim()) },
    { key: "operationKinds", ok: Boolean((briefing.operationKinds ?? []).length) },
  ]
  const answeredSignals = signals.filter((signal) => signal.ok).length
  const expectedSignals = signals.length
  const status: DiscoverySufficiency["status"] =
    answeredSignals >= 6 ? "sufficient" : answeredSignals >= 4 ? "partial" : "insufficient"
  return {
    status,
    missingSignals: signals.filter((signal) => !signal.ok).map((signal) => signal.key),
    answeredSignals,
    expectedSignals,
  }
}

function toNode(value: unknown): Node | null {
  if (!value || typeof value !== "object") return null
  const node = value as Partial<Node>
  if (!node.id || !node.position || !node.data) return null
  return {
    id: String(node.id),
    type: (node.type as string) || "specialist",
    position: node.position as { x: number; y: number },
    data: node.data as Record<string, unknown>,
  }
}

function toEdge(value: unknown): Edge | null {
  if (!value || typeof value !== "object") return null
  const edge = value as Partial<Edge>
  if (!edge.id || !edge.source || !edge.target) return null
  return {
    id: String(edge.id),
    source: String(edge.source),
    target: String(edge.target),
    type: edge.type,
    animated: edge.animated,
    label: edge.label,
    style: edge.style,
    markerEnd: edge.markerEnd,
    markerStart: edge.markerStart,
    data: edge.data,
  }
}

function parseCsv(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function agentsByGraphKey(agents: TeamPlanAgentDraft[]): Map<string, TeamPlanAgentDraft> {
  const map = new Map<string, TeamPlanAgentDraft>()
  const coordinator = agents.find((a) => a.role === "coordinator")
  if (coordinator) map.set("coordinator", coordinator)
  let specialistIndex = 1
  for (const a of agents) {
    if (a.role !== "specialist") continue
    map.set(`specialist-${specialistIndex}`, a)
    specialistIndex += 1
  }
  return map
}

function enrichPreviewNodes(plan: TeamPlanDraft): Node[] {
  const byKey = agentsByGraphKey(plan.agents)
  return (plan.graph?.nodes ?? [])
    .map((raw) => {
      const n = toNode(raw)
      if (!n) return null
      const agentId =
        typeof (n.data as { agentId?: unknown }).agentId === "string"
          ? (n.data as { agentId: string }).agentId
          : undefined
      const agent = agentId ? byKey.get(agentId) : undefined
      if (!agent) return n
      return {
        ...n,
        data: {
          ...n.data,
          label: agent.name,
          role: agent.role,
          category: agent.category,
          description: agent.description,
          objective: agent.objective,
          skills: agent.skills,
          responsibilities: agent.responsibilities,
        },
      }
    })
    .filter((x): x is Node => x !== null)
}

function bindModeLabel(mode: TeamPlanBindPreview["agents"][number]["bindMode"]): string {
  switch (mode) {
    case "new_agent":
      return "novo agente"
    case "reused_merge":
      return "reused com merge"
    case "reused_manual":
      return "reused manual"
    default:
      return "auto-bind desligado"
  }
}

function bindOverrideModeLabel(mode: TeamPlanBindPreview["agents"][number]["overrideMode"]): string {
  switch (mode) {
    case "enabled":
      return "override ligado"
    case "disabled":
      return "override desligado"
    default:
      return "sem override"
  }
}

function normalizeBindOverrides(overrides: TeamPlanBindOverrides): TeamPlanBindOverrides {
  const agents = Object.fromEntries(
    Object.entries(overrides.agents ?? {})
      .map(([agentKey, entry]) => {
        const excludedActionIds = [...new Set((entry.excludedActionIds ?? []).map((value) => value.trim()).filter(Boolean))]
        return [agentKey, { mode: entry.mode ?? "inherit", excludedActionIds }]
      })
      .filter(([, entry]) => entry.mode !== "inherit" || entry.excludedActionIds.length > 0),
  )
  return { agents }
}

function normalizeStringList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function sameStringSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const bSet = new Set(b)
  return a.every((value) => bSet.has(value))
}

function deriveBindOverrideEntry(
  agent: TeamPlanBindPreviewAgent,
  desiredSelectedActionIds: string[],
): TeamPlanBindOverrideEntry | null {
  const candidate = normalizeStringList(agent.actionIdsCandidate)
  const defaultSelected = normalizeStringList(agent.defaultActionIdsToLink.filter((actionId) => candidate.includes(actionId)))
  const desired = normalizeStringList(desiredSelectedActionIds.filter((actionId) => candidate.includes(actionId)))

  if (sameStringSet(desired, defaultSelected)) return null
  if (desired.length === 0) return { mode: "disabled", excludedActionIds: [] }

  const desiredSet = new Set(desired)
  const defaultSet = new Set(defaultSelected)
  const addedBeyondDefault = desired.filter((actionId) => !defaultSet.has(actionId))
  if (addedBeyondDefault.length === 0) {
    return {
      mode: "inherit",
      excludedActionIds: defaultSelected.filter((actionId) => !desiredSet.has(actionId)),
    }
  }

  return {
    mode: "enabled",
    excludedActionIds: candidate.filter((actionId) => !desiredSet.has(actionId)),
  }
}

function buildOverridesFromPreview(
  preview: TeamPlanBindPreview,
  mutator: (agent: TeamPlanBindPreviewAgent, currentSelectedActionIds: string[]) => string[],
): TeamPlanBindOverrides {
  const agents = Object.fromEntries(
    preview.agents
      .map((agent) => {
        const desired = normalizeStringList(mutator(agent, [...agent.actionIdsToLink]))
        const entry = deriveBindOverrideEntry(agent, desired)
        return [agent.planAgentKey, entry] as const
      })
      .filter(([, entry]): entry is TeamPlanBindOverrideEntry => entry !== null),
  )
  return { agents }
}

function definitionStatusLabel(status: TeamPlanBindPreview["toolDefinitions"][number]["currentStatus"]): string {
  switch (status) {
    case "existing_enabled":
      return "existente ativa"
    case "existing_disabled":
      return "existente inativa"
    default:
      return "a criar no execute"
  }
}

function plannedOperationLabel(
  op: TeamPlanBindPreview["toolDefinitions"][number]["plannedOperation"],
): string {
  switch (op) {
    case "create":
      return "criar no execute"
    case "reuse":
      return "reutilizar"
    case "reactivate":
      return "reativar no execute"
    default:
      return "sem acao automatica"
  }
}

export function TeamAiBuilder({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter()
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [problem, setProblem] = useState("")
  const [context, setContext] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isImportingSnapshot, setIsImportingSnapshot] = useState(false)
  const importSnapshotInputRef = useRef<HTMLInputElement>(null)
  const [plan, setPlan] = useState<TeamPlanDraft | null>(null)
  const [operationId] = useState(() => createOperationId())
  const [executionPhase, setExecutionPhase] = useState<
    null | "creating_agents" | "binding_tools" | "creating_team" | "graph" | "activate"
  >(null)
  const [executionDetail, setExecutionDetail] = useState<string>("")
  const [lastExecutionMeta, setLastExecutionMeta] = useState<TeamPlanExecuteMeta | null>(null)
  const [bindPreview, setBindPreview] = useState<TeamPlanBindPreview | null>(null)
  const [isBindPreviewLoading, setIsBindPreviewLoading] = useState(false)
  const [isBindOverrideSaving, setIsBindOverrideSaving] = useState(false)
  const [isBindEnableSaving, setIsBindEnableSaving] = useState(false)
  const [bindPreviewApproved, setBindPreviewApproved] = useState(false)
  const [openaiKeyConfiguredInWorkspace, setOpenaiKeyConfiguredInWorkspace] = useState<boolean | null>(null)
  const [teamPlanningPolicy, setTeamPlanningPolicy] = useState<TeamPlanningPolicy | null>(null)
  const [overlapMode, setOverlapMode] = useState<GovernanceOverlapMode>("blocking")
  /** Loop 89 — modo simples por defeito; avançado mostra preview de bind completo e blocos técnicos. */
  const [builderAdvancedUi, setBuilderAdvancedUi] = useState(false)
  const [guidedDiscoveryEnabled, setGuidedDiscoveryEnabled] = useState(true)
  const [discoveryStep, setDiscoveryStep] = useState(0)
  const [discoveryAnswers, setDiscoveryAnswers] = useState<Partial<Record<DiscoveryQuestion["id"], string>>>({})
  const [briefingConfirmed, setBriefingConfirmed] = useState(false)

  const previewGraphNodes = useMemo(() => (plan ? enrichPreviewNodes(plan) : []), [plan])
  const previewGraphEdges = useMemo(
    () => (plan?.graph?.edges ?? []).map(toEdge).filter(Boolean) as Edge[],
    [plan],
  )
  const reusedAgentsCount = plan?.agents.filter((agent) => agent.planningMode === "existing").length ?? 0
  /** Há hints de capabilities no plano (copy do cartão de sugestões). */
  const hasBindCapabilityHints = useMemo(() => (plan ? planHasBindReviewHints(plan) : false), [plan])
  /** Loop 86 — contrato do backend (`requiresExplicitApproval`) com fallback conservador até carregar o preview. */
  const requiresExplicitBindApproval = useMemo(() => {
    if (!plan) return false
    return (
      bindPreview?.requiresExplicitApproval ??
      (bindPreview ? false : planHasBindReviewHints(plan))
    )
  }, [plan, bindPreview])
  const requiredCapabilityCount = useMemo(() => {
    if (!plan) return 0
    const g = (plan.requiredPacks?.length ?? 0) + (plan.requiredTools?.length ?? 0)
    const pa = plan.agents.reduce(
      (acc, a) =>
        acc + (a.requiredBusinessActionIds?.length ?? 0) + (a.requiredPackIds?.length ?? 0),
      0,
    )
    return g + pa
  }, [plan])
  const bindDiffAgents = useMemo(
    () =>
      bindPreview?.agents.filter(
        (agent) => agent.actionIdsAddedByOverride.length > 0 || agent.actionIdsRemovedByOverride.length > 0,
      ) ?? [],
    [bindPreview],
  )
  const disabledBindDefinitionActionIds = useMemo(
    () =>
      bindPreview?.toolDefinitions.filter((d) => d.currentStatus === "existing_disabled").map((d) => d.actionId) ?? [],
    [bindPreview],
  )

  /** Loop 85 — só invalida preview/aprovação quando mudam inputs que afectam bind no servidor. */
  const proposePlanUpdate = (nextPlan: TeamPlanDraft) => {
    if (plan && teamPlanBindFingerprint(plan) !== teamPlanBindFingerprint(nextPlan)) {
      setBindPreview(null)
      setBindPreviewApproved(false)
    }
    setPlan(nextPlan)
  }

  /** Espelha validação do backend: IDs de domínio não podem repetir entre especialistas. */
  const specialistExclusiveCollisions = useMemo((): string[] => {
    if (!plan) return []
    const specialists = plan.agents.filter((a) => a.role === "specialist")
    const exclusive = new Set<string>(SPECIALIST_EXCLUSIVE_CATALOG_TOOL_IDS)
    const byTool = new Map<string, string[]>()
    for (const ag of specialists) {
      for (const tid of ag.catalogTools ?? []) {
        if (!exclusive.has(tid)) continue
        const list = byTool.get(tid) ?? []
        list.push(ag.name)
        byTool.set(tid, list)
      }
    }
    const out: string[] = []
    for (const [tid, names] of byTool.entries()) {
      if (names.length > 1) {
        const label = catalogToolLabelPt(tid as CatalogToolId)
        out.push(`${label} (${tid}): ${names.join(", ")}`)
      }
    }
    return out
  }, [plan])

  /** Loop 86 — mesmo workflowKey em dois especialistas (validação alinhada ao backend). */
  const specialistWorkflowDuplicates = useMemo(() => {
    if (!plan) return [] as string[]
    const specialists = plan.agents.filter((a) => a.role === "specialist")
    const lowerToNames = new Map<string, string[]>()
    const lowerToKey = new Map<string, string>()
    for (const ag of specialists) {
      const raw = (ag.workflowKey ?? "").trim()
      if (!raw) continue
      const lower = raw.toLowerCase()
      const list = lowerToNames.get(lower) ?? []
      list.push(ag.name)
      lowerToNames.set(lower, list)
      if (!lowerToKey.has(lower)) lowerToKey.set(lower, raw)
    }
    const out: string[] = []
    for (const [lower, names] of lowerToNames) {
      if (names.length > 1) {
        const keyDisp = lowerToKey.get(lower) ?? lower
        out.push(`Workflow "${keyDisp}" repetido entre: ${names.join(", ")}`)
      }
    }
    return out
  }, [plan])

  const executePlanBlockers = useMemo(() => {
    const items: string[] = []
    const adequacyIssues = evaluateClientPlanAdequacy(plan)
    if (specialistExclusiveCollisions.length > 0) {
      items.push("Ferramenta exclusiva de domínio repetida entre especialistas (ajuste as fichas).")
    }
    if (specialistWorkflowDuplicates.length > 0) {
      items.push("Dois ou mais especialistas com o mesmo workflowKey (corrija antes de executar).")
    }
    if (requiresExplicitBindApproval && (!bindPreview || !bindPreviewApproved)) {
      items.push("É necessário rever e aprovar o preview de bind (ou aguardar o carregamento).")
    }
    if (overlapMode === "blocking" && (plan?.reuseSummary?.conflicts?.length ?? 0) > 0) {
      items.push("Conflitos de overlap/reuso bloqueiam a execução com a política atual.")
    }
    if (isBindPreviewLoading) {
      items.push("A carregar preview de bind…")
    }
    if (adequacyIssues.length > 0) {
      items.push(...adequacyIssues)
    }
    return items
  }, [
    plan,
    specialistExclusiveCollisions.length,
    specialistWorkflowDuplicates.length,
    requiresExplicitBindApproval,
    bindPreview,
    bindPreviewApproved,
    overlapMode,
    isBindPreviewLoading,
  ])

  const [catalogToolsEditorIndex, setCatalogToolsEditorIndex] = useState<number | null>(null)

  const handleCatalogToolCheckedChange = (
    agentIndex: number,
    tid: CatalogToolId,
    checked: boolean,
  ) => {
    if (!plan) return
    const agents = [...plan.agents]
    const agent = agents[agentIndex]
    if (!agent) return
    const cur = new Set(agent.catalogTools ?? [])
    if (checked) {
      if (agent.role === "specialist") {
        const exclusive = SPECIALIST_EXCLUSIVE_CATALOG_TOOL_IDS as readonly string[]
        if (exclusive.includes(tid)) {
          const conflict = plan.agents.find(
            (a, i) => a.role === "specialist" && i !== agentIndex && (a.catalogTools ?? []).includes(tid),
          )
          if (conflict) {
            toast.error(
              `"${catalogToolLabelPt(tid)}" já está atribuída ao especialista "${conflict.name}". Remova primeiro noutro agente.`,
            )
            return
          }
        }
      }
      cur.add(tid)
    } else {
      cur.delete(tid)
    }
    agents[agentIndex] = { ...agent, catalogTools: [...cur] }
    proposePlanUpdate({ ...plan, agents })
  }

  const plannerFallbackCopy = useMemo(() => {
    if (!plan?.plannerMeta?.usedFallback) return null
    return getPlannerFallbackCopy(plan.plannerMeta as TeamPlanPlannerMeta)
  }, [plan])
  const plannerIntegrityModel = useMemo(() => {
    const meta = plan?.plannerMeta as TeamPlanPlannerMeta | undefined
    return meta?.integrityModel
  }, [plan])

  const api = useMemo(() => {
    if (!token || !currentWorkspace) return null
    return createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
  }, [token, refreshToken, currentWorkspace])

  useEffect(() => {
    if (!api) return
    void Promise.all([
      api
        .get<{ secretsMasked: { openaiApiKeyConfigured: boolean } }>("/settings/workspace/integrations")
        .then((r) => setOpenaiKeyConfiguredInWorkspace(r.data.secretsMasked.openaiApiKeyConfigured))
        .catch(() => setOpenaiKeyConfiguredInWorkspace(false)),
      api
        .get<TeamPlanningPolicy>("/settings/workspace/team-planning-policy")
        .then((r) => setTeamPlanningPolicy(r.data))
        .catch(() =>
          setTeamPlanningPolicy({
            autoBindMode: "inherit",
            autoBindEnabled: false,
            source: "environment_default",
            reusedAgentBindMode: "manual",
          }),
        ),
    ])
  }, [api])

  const refreshBindPreview = async (planId: string) => {
    if (!api) return
    setIsBindPreviewLoading(true)
    const prevPreview = bindPreview
    const prevApproved = bindPreviewApproved
    try {
      const res = await api.get<TeamPlanBindPreview>(`/team-plans/${planId}/bind-preview`)
      const next = res.data
      setBindPreview(next)
      if (
        prevPreview &&
        bindPreviewApprovalFingerprint(prevPreview) === bindPreviewApprovalFingerprint(next)
      ) {
        setBindPreviewApproved(prevApproved)
      } else {
        setBindPreviewApproved(false)
      }
    } catch (e) {
      setBindPreview(null)
      setBindPreviewApproved(false)
      const message = e instanceof ApiError ? e.message : "Falha ao gerar preview de bind"
      toast.error(message)
    } finally {
      setIsBindPreviewLoading(false)
    }
  }

  const enableBindDefinitionsInline = async (actionIds: string[]) => {
    if (!api || !plan || actionIds.length === 0) return
    setIsBindEnableSaving(true)
    const prevPreview = bindPreview
    const prevApproved = bindPreviewApproved
    try {
      const res = await api.post<{
        preview: TeamPlanBindPreview
        reactivatedToolDefinitionIds: string[]
      }>(`/team-plans/${plan.id}/bind-enable-definitions`, { actionIds })
      const next = res.data.preview
      setBindPreview(next)
      if (
        prevPreview &&
        bindPreviewApprovalFingerprint(prevPreview) === bindPreviewApprovalFingerprint(next)
      ) {
        setBindPreviewApproved(prevApproved)
      } else {
        setBindPreviewApproved(false)
      }
      const n = res.data.reactivatedToolDefinitionIds.length
      if (n > 0) {
        toast.success(`${n} tool definition(s) reativada(s) no workspace. O preview foi atualizado.`)
      } else {
        toast.info("Nenhuma definition inativa correspondente a essas actionIds.")
      }
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Falha ao reativar definitions"
      toast.error(message)
    } finally {
      setIsBindEnableSaving(false)
    }
  }

  const persistBindOverrides = async (planId: string, bindOverrides: TeamPlanBindOverrides) => {
    if (!api) return
    setIsBindOverrideSaving(true)
    const prevPreview = bindPreview
    const prevApproved = bindPreviewApproved
    try {
      const res = await api.put<{ plan: TeamPlanDraft; preview: TeamPlanBindPreview }>(
        `/team-plans/${planId}/bind-overrides`,
        { bindOverrides: normalizeBindOverrides(bindOverrides) },
      )
      setPlan(res.data.plan)
      const next = res.data.preview
      setBindPreview(next)
      if (
        prevPreview &&
        bindPreviewApprovalFingerprint(prevPreview) === bindPreviewApprovalFingerprint(next)
      ) {
        setBindPreviewApproved(prevApproved)
      } else {
        setBindPreviewApproved(false)
      }
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Falha ao salvar overrides de bind"
      toast.error(message)
    } finally {
      setIsBindOverrideSaving(false)
    }
  }

  const persistPreviewMutation = async (
    mutator: (agent: TeamPlanBindPreviewAgent, currentSelectedActionIds: string[]) => string[],
  ) => {
    if (!plan || !bindPreview) return
    await persistBindOverrides(plan.id, buildOverridesFromPreview(bindPreview, mutator))
  }

  const setAgentSelectedActions = async (agent: TeamPlanBindPreviewAgent, selectedActionIds: string[]) => {
    await persistPreviewMutation((currentAgent, currentSelectedActionIds) =>
      currentAgent.planAgentKey === agent.planAgentKey ? selectedActionIds : currentSelectedActionIds,
    )
  }

  const updateAgentBindOverride = async (agent: TeamPlanBindPreviewAgent, enabled: boolean) => {
    await setAgentSelectedActions(agent, enabled ? agent.actionIdsCandidate : [])
  }

  const updateAgentActionOverride = async (agent: TeamPlanBindPreviewAgent, actionId: string, enabled: boolean) => {
    const current = new Set(agent.actionIdsToLink)
    if (enabled) current.add(actionId)
    else current.delete(actionId)
    await setAgentSelectedActions(agent, [...current])
  }

  const applyAgentBatchAction = async (
    agent: TeamPlanBindPreviewAgent,
    action: "apply_all" | "clear_all" | "reset",
  ) => {
    if (action === "apply_all") return setAgentSelectedActions(agent, agent.actionIdsCandidate)
    if (action === "clear_all") return setAgentSelectedActions(agent, [])
    return setAgentSelectedActions(agent, agent.defaultActionIdsToLink)
  }

  const applyGlobalBatchAction = async (action: "apply_all" | "clear_all" | "reset") => {
    await persistPreviewMutation((agent) => {
      if (action === "apply_all") return agent.actionIdsCandidate
      if (action === "clear_all") return []
      return agent.defaultActionIdsToLink
    })
  }

  const applyPackBatchAction = async (pack: TeamPlanBindPreviewPack, action: "apply" | "clear" | "reset") => {
    await persistPreviewMutation((agent, currentSelectedActionIds) => {
      const relevantActionIds = pack.actionIds.filter((actionId) => agent.actionIdsCandidate.includes(actionId))
      if (relevantActionIds.length === 0) return currentSelectedActionIds

      const nextSelected = new Set(currentSelectedActionIds)
      const defaultSelected = new Set(agent.defaultActionIdsToLink)

      if (action === "apply") {
        relevantActionIds.forEach((actionId) => nextSelected.add(actionId))
      } else if (action === "clear") {
        relevantActionIds.forEach((actionId) => nextSelected.delete(actionId))
      } else {
        relevantActionIds.forEach((actionId) => {
          if (defaultSelected.has(actionId)) nextSelected.add(actionId)
          else nextSelected.delete(actionId)
        })
      }

      return [...nextSelected]
    })
  }

  useEffect(() => {
    if (!api) return
    void api
      .get<GovernanceFeatureFlags>("/governance/feature-flags")
      .then((r) => setOverlapMode(r.data.overlapMode))
      .catch(() => {})
  }, [api])

  useEffect(() => {
    try {
      if (localStorage.getItem("team-ai-builder-advanced") === "1") {
        setBuilderAdvancedUi(true)
      }
    } catch {
      /* ignore */
    }
  }, [])

  const persistBuilderAdvancedUi = (value: boolean) => {
    setBuilderAdvancedUi(value)
    try {
      localStorage.setItem("team-ai-builder-advanced", value ? "1" : "0")
    } catch {
      /* ignore */
    }
  }

  const currentDiscoveryQuestion = DISCOVERY_QUESTIONS[discoveryStep]
  const currentDiscoveryValue = currentDiscoveryQuestion ? (discoveryAnswers[currentDiscoveryQuestion.id] ?? "") : ""
  const discoveryAnsweredCount = DISCOVERY_QUESTIONS.filter((q) => {
    const answer = discoveryAnswers[q.id]?.trim()
    return Boolean(answer && answer.length > 0)
  }).length
  const discoveryComplete = discoveryAnsweredCount === DISCOVERY_QUESTIONS.length
  const structuredBriefingPreview = buildStructuredBriefingFromDiscovery(discoveryAnswers, problem.trim())
  const discoverySufficiency = evaluateDiscoverySufficiency(structuredBriefingPreview)
  const currentGuidedStage: GuidedBuilderStage = useMemo(() => {
    if (plan?.result?.teamId) return "execution"
    if (plan) return "team_review"
    if (briefingConfirmed) return "plan_generation"
    if (discoveryAnsweredCount >= 6) return "briefing_confirmation"
    if (discoveryAnsweredCount >= 4) return "domains_understanding"
    if (discoveryAnsweredCount >= 2) return "business_understanding"
    return "discovery"
  }, [plan, briefingConfirmed, discoveryAnsweredCount])

  const setCurrentDiscoveryValue = (value: string) => {
    if (!currentDiscoveryQuestion) return
    setDiscoveryAnswers((prev) => ({ ...prev, [currentDiscoveryQuestion.id]: value }))
  }

  const goNextDiscoveryStep = () => {
    if (!currentDiscoveryQuestion) return
    const nextValue = normalizeDiscoveryValue(currentDiscoveryValue)
    setCurrentDiscoveryValue(nextValue)
    setDiscoveryStep((prev) => Math.min(prev + 1, DISCOVERY_QUESTIONS.length - 1))
  }

  const applyGuidedBriefingToPlanner = () => {
    const safeAnswers = { ...discoveryAnswers }
    if (currentDiscoveryQuestion && !safeAnswers[currentDiscoveryQuestion.id]?.trim()) {
      safeAnswers[currentDiscoveryQuestion.id] = DISCOVERY_UNKNOWN
    }
    const guided = buildGuidedPlannerInput(safeAnswers)
    setProblem(guided.problem)
    setContext(guided.context)
    setBriefingConfirmed(true)
    toast.success("Briefing guiado aplicado no planner. Revise e gere o plano.")
  }

  const generatePlan = async () => {
    if (guidedDiscoveryEnabled && discoverySufficiency.status === "insufficient") {
      toast.warning(
        `Briefing insuficiente para gerar plano. Complete: ${discoverySufficiency.missingSignals.slice(0, 4).join(", ")}.`,
      )
      return
    }
    if (!api || problem.trim().length < 10) return
    setIsGenerating(true)
    try {
      const briefing = guidedDiscoveryEnabled || discoveryAnsweredCount > 0 ? structuredBriefingPreview : undefined
      const res = await api.post<TeamPlanDraft>("/team-plans", {
        problem: problem.trim(),
        context: context.trim() || undefined,
        briefing,
      })
      setLastExecutionMeta(null)
      setBindPreview(null)
      setBindPreviewApproved(false)
      setPlan(res.data)
      if (planHasBindReviewHints(res.data)) {
        void refreshBindPreview(res.data.id)
      }
      const meta = res.data.plannerMeta as TeamPlanPlannerMeta | undefined
      if (meta?.usedFallback) {
        const copy = getPlannerFallbackCopy(meta)
        toast.warning(copy.toastTitle, copy.toastDescription ? { description: copy.toastDescription } : undefined)
      } else toast.success("Plano criado. Revise e ajuste se necessário.")
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Falha ao gerar plano"
      toast.error(message)
    } finally {
      setIsGenerating(false)
    }
  }

  const saveEdits = async () => {
    if (!api || !plan) return
    setIsSaving(true)
    try {
      const res = await api.put<TeamPlanDraft>(`/team-plans/${plan.id}`, {
        team: plan.team,
        agents: plan.agents,
        graph: plan.graph,
      })
      setPlan(res.data)
      await refreshBindPreview(res.data.id)
      toast.success("Plano atualizado")
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Falha ao salvar alterações"
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const downloadTeamPlanSnapshot = () => {
    if (!plan) return
    const envelope = buildTeamPlanExportEnvelope(plan)
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const base =
      plan.team.name
        .replace(/[^a-zA-Z0-9\-_.\s]+/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80) || "team-plan"
    a.href = url
    a.download = `${base}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("JSON exportado.")
  }

  const triggerImportTeamPlanSnapshot = () => importSnapshotInputRef.current?.click()

  const onImportTeamPlanSnapshotFile = async (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]
    ev.target.value = ""
    if (!file || !api) return
    if (plan && !window.confirm("Substituir o plano atual pelo JSON importado? Alterações não guardadas perdem-se.")) {
      return
    }
    setIsImportingSnapshot(true)
    try {
      const text = await file.text()
      const json = JSON.parse(text) as unknown
      const res = await api.post<TeamPlanDraft>("/team-plans/import", json)
      setLastExecutionMeta(null)
      setBindPreview(null)
      setBindPreviewApproved(false)
      setPlan(res.data)
      if (planHasBindReviewHints(res.data)) void refreshBindPreview(res.data.id)
      toast.success("Plano importado. Revise antes de executar.")
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Falha ao importar JSON"
      toast.error(message)
    } finally {
      setIsImportingSnapshot(false)
    }
  }

  const executePlan = async () => {
    if (!api || !plan) return
    if (executePlanBlockers.length > 0) {
      toast.warning(
        `Corrija os bloqueios antes de executar: ${executePlanBlockers.slice(0, 4).join(" · ")}${
          executePlanBlockers.length > 4 ? "…" : ""
        }`,
      )
      return
    }
    setIsExecuting(true)
    setExecutionPhase(null)
    setExecutionDetail("")
    setLastExecutionMeta(null)
    if (requiresExplicitBindApproval && (!bindPreview || !bindPreviewApproved)) {
      toast.warning(
        builderAdvancedUi
          ? "Revise e aprove o preview de bind antes de executar o plano."
          : "Marque a confirmação de bind (cartão «Confirmação rápida») ou abra o modo avançado para rever o preview completo.",
      )
      setIsExecuting(false)
      return
    }
    try {
      await api.streamTeamPlanExecute<TeamPlanDraft>(
        plan.id,
        { operationId },
        {
          onPhase: (e) => {
            setExecutionPhase(e.phase)
            setExecutionDetail(e.detail ?? "")
          },
          onComplete: (payload) => {
            const p = payload as { data?: TeamPlanDraft; meta?: TeamPlanExecuteMeta } | TeamPlanDraft
            const data =
              p && typeof p === "object" && "data" in p && p.data ? p.data : (p as TeamPlanDraft)
            const meta =
              p && typeof p === "object" && "meta" in p ? (p as { meta?: TeamPlanExecuteMeta }).meta : undefined
            setPlan(data)
            setLastExecutionMeta(meta ?? null)
            const teamId = data.result?.teamId
            if (meta?.governanceWarning) {
              toast.warning(
                "Time criado com aviso de governança: conflitos de overlap aceitos conforme a política do workspace.",
              )
            } else {
              toast.success("Time criado e configurado com sucesso")
            }
            if ((meta?.requiredPacks?.length ?? 0) > 0 || (meta?.requiredTools?.length ?? 0) > 0) {
              if (meta?.effectiveBindEnabled ?? meta?.autoBindEnabled) {
                const boundCount = meta?.boundToolDefinitionIds?.length ?? 0
                toast.success(
                  boundCount > 0
                    ? `${boundCount} tool definitions resolvidas para bind automatico.`
                    : "Auto-bind ligado, mas nenhuma tool definition nova precisou ser criada.",
                )
              } else {
                toast.warning(
                  "Capabilities sugeridas nao foram auto-vinculadas. Revise Tools do workspace e as fichas dos agentes.",
                )
              }
            }
            if (meta?.bindOverridesApplied) {
              toast.info("Overrides granulares do bind foram aplicados nesta execução.")
            }
            if (reusedAgentsCount > 0 && (meta?.requiredTools?.length ?? 0) > 0) {
              if (meta?.reusedAgentBindMode === "merge") {
                toast.success(
                  `${meta.reusedAgentsUpdated ?? 0} agente(s) reutilizado(s) receberam merge de tools sugeridas.`,
                )
              } else {
                toast.info(
                  "Agentes reutilizados continuam em modo manual para as tools sugeridas.",
                )
              }
            }
            if (meta?.autoBindActionsTruncated) {
              toast.warning(
                "Algumas capabilities sugeridas foram ignoradas: limite de 64 actionIds por execução no servidor.",
              )
            }
            if ((meta?.reactivatedToolDefinitionIds?.length ?? 0) > 0) {
              toast.success(
                `${meta!.reactivatedToolDefinitionIds!.length} tool definition(s) estavam inativas e foram reativadas para o bind.`,
              )
            }
            if (teamId) router.push(`/teams/${teamId}`)
          },
          onError: (e) => {
            const adequacy = e.details?.adequacy as { issues?: string[] } | undefined
            const issues = adequacy?.issues?.filter(Boolean) ?? []
            if (issues.length > 0) {
              toast.error(e.message, { description: issues.join("\n") })
            } else {
              toast.error(e.message)
            }
          },
        },
      )
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Falha ao executar plano"
      toast.error(message)
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <div className="space-y-6">
      {!embedded ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Whitebeard AI Builder</h1>
            <p className="mt-1 text-muted-foreground">Descreva o problema e gere um time completo com plano editável.</p>
          </div>
          <Button variant="outline" asChild className="w-full shrink-0 sm:w-auto">
            <Link href="/teams/create">Abrir jornada unificada</Link>
          </Button>
        </div>
      ) : null}

      {openaiKeyConfiguredInWorkspace === false && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>OpenAI não configurada no workspace</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Para usar o planner com modelo real, adicione uma chave em{" "}
            <Link href="/settings" className="font-medium text-primary underline-offset-4 hover:underline">
              Configurações → Integrações
            </Link>{" "}
            ou defina <code className="text-xs bg-muted px-1 rounded">OPENAI_API_KEY</code> no servidor do backend.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Descreva o objetivo do time</CardTitle>
          <CardDescription>O planner considera o catálogo do workspace e marca reuso quando houver overlap forte.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-sm font-medium">Fluxo guiado do AI Builder (Loop 130.9)</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {GUIDED_BUILDER_FLOW.map((stage, idx) => {
                const currentIdx = GUIDED_BUILDER_FLOW.findIndex((s) => s.id === currentGuidedStage)
                const done = idx < currentIdx
                const active = idx === currentIdx
                return (
                  <div
                    key={stage.id}
                    className={`rounded-md border px-2 py-1.5 text-xs ${
                      active ? "border-primary bg-primary/10 text-foreground" : done ? "border-emerald-500/30 bg-emerald-500/10" : "text-muted-foreground"
                    }`}
                  >
                    <p className="font-medium">{stage.label}</p>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="rounded-md border bg-muted/40 p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Entrevista guiada (Loop 130.2)</p>
                <p className="text-xs text-muted-foreground">
                  Coleta incremental do briefing para melhorar a qualidade do plano.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="guided-discovery-enabled"
                  checked={guidedDiscoveryEnabled}
                  onCheckedChange={(checked) => setGuidedDiscoveryEnabled(Boolean(checked))}
                />
                <Label htmlFor="guided-discovery-enabled" className="cursor-pointer text-xs">
                  Modo guiado
                </Label>
              </div>
            </div>

            {guidedDiscoveryEnabled && currentDiscoveryQuestion ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Pergunta {discoveryStep + 1} de {DISCOVERY_QUESTIONS.length}
                  </p>
                  <Badge variant={discoveryComplete ? "default" : "secondary"}>
                    {discoveryAnsweredCount}/{DISCOVERY_QUESTIONS.length} respondidas
                  </Badge>
                  <Badge
                    variant={
                      discoverySufficiency.status === "sufficient"
                        ? "default"
                        : discoverySufficiency.status === "partial"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    Briefing {discoverySufficiency.status === "sufficient"
                      ? "suficiente"
                      : discoverySufficiency.status === "partial"
                        ? "parcial"
                        : "insuficiente"}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`guided-${currentDiscoveryQuestion.id}`}>{currentDiscoveryQuestion.label}</Label>
                  <p className="text-xs text-muted-foreground">{currentDiscoveryQuestion.helper}</p>
                </div>
                <Textarea
                  id={`guided-${currentDiscoveryQuestion.id}`}
                  value={currentDiscoveryValue}
                  onChange={(e) => setCurrentDiscoveryValue(e.target.value)}
                  placeholder={currentDiscoveryQuestion.placeholder}
                  className="min-h-20"
                />
                <div className="flex flex-wrap gap-2">
                  {currentDiscoveryQuestion.quickOptions.map((opt) => (
                    <Button
                      key={opt}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentDiscoveryValue(opt)}
                    >
                      {opt}
                    </Button>
                  ))}
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCurrentDiscoveryValue(DISCOVERY_UNKNOWN)}>
                    {DISCOVERY_UNKNOWN}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDiscoveryStep((prev) => Math.max(prev - 1, 0))}
                    disabled={discoveryStep === 0}
                  >
                    Voltar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={goNextDiscoveryStep}
                    disabled={discoveryStep >= DISCOVERY_QUESTIONS.length - 1}
                  >
                    Próxima pergunta
                  </Button>
                  <Button type="button" onClick={applyGuidedBriefingToPlanner}>
                    Aplicar briefing no planner
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          <Label htmlFor="problem">Problema principal</Label>
          <Textarea
            id="problem"
            value={problem}
            onChange={(e) => {
              setProblem(e.target.value)
              if (briefingConfirmed) setBriefingConfirmed(false)
            }}
            placeholder="Ex: temos alto volume de tickets e baixa taxa de resolução no primeiro contato..."
            className="min-h-28"
          />
          <Label htmlFor="context">Contexto opcional</Label>
          <Textarea
            id="context"
            value={context}
            onChange={(e) => {
              setContext(e.target.value)
              if (briefingConfirmed) setBriefingConfirmed(false)
            }}
            placeholder="Restrições, stack, canais já conectados, SLAs..."
            className="min-h-20"
          />
          <Button onClick={generatePlan} disabled={isGenerating || problem.trim().length < 10}>
            {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {isGenerating ? "Gerando plano..." : "Gerar plano assistido"}
          </Button>
        </CardContent>
      </Card>

      {plan && (
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-1.5">
                <CardTitle>Revisar plano</CardTitle>
                <CardDescription>
                  Edite o equipa e os objectivos, depois confirme o bind das tools. Use o modo avançado só para
                  overrides e detalhes técnicos.
                </CardDescription>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5 shrink-0">
                <Settings2 className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="team-ai-builder-advanced"
                      checked={builderAdvancedUi}
                      onCheckedChange={(c) => persistBuilderAdvancedUi(Boolean(c))}
                    />
                    <Label htmlFor="team-ai-builder-advanced" className="text-sm font-medium cursor-pointer">
                      Modo avançado
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-[220px] leading-snug">
                    Mostra preview de bind completo, packs em lote, políticas e contrato por agente (Loop 82).
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="order-1 flex flex-col gap-6">
            {plannerFallbackCopy ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Plano em modo template</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p className="text-destructive-foreground/95">{plannerFallbackCopy.alertExplanation}</p>
                  {plannerFallbackCopy.reasonCode ? (
                    <p className="text-xs font-mono text-muted-foreground">
                      Codigo: <span className="break-all">{plannerFallbackCopy.reasonCode}</span>
                    </p>
                  ) : null}
                  {plannerFallbackCopy.technicalDetail ? (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 mt-1">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Detalhe tecnico (suporte)</p>
                      <code className="text-[11px] leading-snug break-words whitespace-pre-wrap block text-muted-foreground">
                        {plannerFallbackCopy.technicalDetail}
                      </code>
                    </div>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}
            {plannerIntegrityModel ? (
              <Card>
                <CardHeader>
                  <CardTitle>Modelo de integridade entre especialistas (Loop 130.6A)</CardTitle>
                  <CardDescription>
                    Estado:{" "}
                    <strong>{plannerIntegrityModel.status === "defined" ? "definido" : "incompleto"}</strong>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium">Entidades mestras</p>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {plannerIntegrityModel.masterEntities.map((item) => (
                        <li key={`${item.domain}-${item.entity}`}>
                          {item.domain} → {item.entity} ({item.naturalKey})
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium">Regras de ligação</p>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {plannerIntegrityModel.linkRules.map((rule) => (
                        <li key={rule}>{rule}</li>
                      ))}
                    </ul>
                  </div>
                  {plannerIntegrityModel.missingSignals.length > 0 ? (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Integridade incompleta</AlertTitle>
                      <AlertDescription>
                        Sinais faltantes: {plannerIntegrityModel.missingSignals.join(", ")}.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
            </div>
            <div className="order-2 flex flex-col gap-6">
            {hasBindCapabilityHints &&
              (builderAdvancedUi ? (
              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertTitle>Capabilities sugeridas pelo planner</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p className="text-muted-foreground">
                    Aqui o planner apenas sugere capabilities. O bind automatico efetivo segue a politica atual do
                    workspace.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Sugestoes: {requiredCapabilityCount}</Badge>
                    <Badge variant="secondary">Agentes reutilizados: {reusedAgentsCount}</Badge>
                    <Badge variant={teamPlanningPolicy?.autoBindEnabled ? "default" : "secondary"}>
                      {teamPlanningPolicy?.autoBindEnabled ? "Auto-bind ligado" : "Auto-bind desligado"}
                    </Badge>
                    <Badge variant="outline">
                      reused: {teamPlanningPolicy?.reusedAgentBindMode === "merge" ? "merge" : "manual"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    Politica atual:{" "}
                    <strong>
                      {teamPlanningPolicy?.source === "workspace_enabled"
                        ? "workspace forca bind ligado"
                        : teamPlanningPolicy?.source === "workspace_disabled"
                          ? "workspace forca bind desligado"
                          : "herdando padrao do servidor"}
                    </strong>
                    . Ajuste em{" "}
                    <Link href="/settings?tab=integrations" className="text-primary underline-offset-4 hover:underline">
                      Configuracoes → Integracoes
                    </Link>
                    .
                  </p>
                  {reusedAgentsCount > 0 ? (
                    <p className="text-muted-foreground">
                      Para agentes em modo <code className="text-xs">existing</code>, a politica atual e{" "}
                      <strong>
                        {teamPlanningPolicy?.reusedAgentBindMode === "merge"
                          ? "merge automatico"
                          : "habilitacao manual"}
                      </strong>
                      .
                    </p>
                  ) : null}
                  {(plan.requiredPacks?.length ?? 0) > 0 && (
                    <div>
                      <span className="font-medium">Packs: </span>
                      <span className="flex flex-wrap gap-1 mt-1">
                        {plan.requiredPacks!.map((p) => (
                          <Badge key={p} variant="secondary" title={p}>
                            {plannerPackLabelPt(p)}
                          </Badge>
                        ))}
                      </span>
                    </div>
                  )}
                  {(plan.requiredTools?.length ?? 0) > 0 && (
                    <div>
                      <span className="font-medium">Tools (actionIds): </span>
                      <ul className="list-disc list-inside text-sm mt-1 text-muted-foreground">
                        {plan.requiredTools!.map((t) => (
                          <li key={t}>
                            <code className="text-xs">{t}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-muted-foreground">
                    Se o bind automatico estiver desligado, use{" "}
                    <Link href="/tool-definitions" className="text-primary underline-offset-4 hover:underline">
                      Tools
                    </Link>{" "}
                    para garantir que as definitions estejam ativas e depois habilite-as nas fichas dos agentes.
                  </p>
                  <p className="text-muted-foreground">
                    O execute so exige aprovacao manual do preview quando o servidor indicar risco real de bind
                    (campo <code className="text-xs">requiresExplicitApproval</code>).
                  </p>
                </AlertDescription>
              </Alert>
              ) : (
                <Alert>
                  <Sparkles className="h-4 w-4" />
                  <AlertTitle>Capabilities e política de bind</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      O planner sugeriu <strong>{requiredCapabilityCount}</strong> capability(ies). Auto-bind está{" "}
                      <strong>{teamPlanningPolicy?.autoBindEnabled ? "ligado" : "desligado"}</strong> neste workspace.
                      {reusedAgentsCount > 0 ? (
                        <>
                          {" "}
                          Há <strong>{reusedAgentsCount}</strong> agente(s) em modo reutilizado.
                        </>
                      ) : null}
                    </p>
                    <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={() => persistBuilderAdvancedUi(true)}>
                      Ver política completa, packs e lista de actionIds
                    </Button>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
            <div className="order-4 flex flex-col gap-6">
            <Card className={builderAdvancedUi ? undefined : "border-primary/20"}>
                <CardHeader>
                  <CardTitle>{builderAdvancedUi ? "Preview de bind" : "Confirmação rápida de bind"}</CardTitle>
                  <CardDescription>
                    {builderAdvancedUi ? (
                      <>
                        Mostra o que o backend pretende criar, reutilizar e vincular antes do execute.
                        {bindPreview?.bindResolutionMode === "per_agent" ? (
                          <span className="block mt-1.5 text-muted-foreground text-xs leading-relaxed">
                            Modo por agente: cada papel recebe apenas os <code className="text-[11px]">actionIds</code> do
                            seu workflow no plano (menos ruído quando há vários especialistas).
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        Resumo para avançar sem listas técnicas. Para overrides por agente e definitions, ligue o modo
                        avançado.
                      </>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!builderAdvancedUi ? (
                    <div className="space-y-4">
                      {bindPreview ? (
                        <>
                          <p className="text-sm text-muted-foreground">
                            {bindPreview.requiresExplicitApproval ? (
                              <span className="text-foreground">
                                Este plano pede confirmação explícita antes de criar ou reactivar tools no workspace.
                              </span>
                            ) : (
                              <span>
                                O preview actual não exige aprovação manual — pode executar quando os restantes bloqueios
                                estiverem resolvidos.
                              </span>
                            )}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={bindPreview.effectiveBindEnabled ? "default" : "secondary"}>
                              {bindPreview.effectiveBindEnabled ? "Bind efetivo" : "Sem bind efetivo"}
                            </Badge>
                            <Badge variant="outline">definitions {bindPreview.toolDefinitions.length}</Badge>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void (plan ? refreshBindPreview(plan.id) : Promise.resolve())}
                              disabled={isBindPreviewLoading || isBindOverrideSaving}
                            >
                              {isBindPreviewLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                              Atualizar estado
                            </Button>
                            {disabledBindDefinitionActionIds.length > 0 ? (
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                onClick={() => void enableBindDefinitionsInline(disabledBindDefinitionActionIds)}
                                disabled={
                                  isBindPreviewLoading || isBindOverrideSaving || isBindEnableSaving || !plan
                                }
                              >
                                {isBindEnableSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                Ativar definitions inativas ({disabledBindDefinitionActionIds.length})
                              </Button>
                            ) : null}
                          </div>
                          {bindPreview && requiresExplicitBindApproval ? (
                            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3">
                              <Checkbox
                                id="bind-preview-approved-simple"
                                checked={bindPreviewApproved}
                                onCheckedChange={(checked) => setBindPreviewApproved(Boolean(checked))}
                              />
                              <Label htmlFor="bind-preview-approved-simple" className="text-sm leading-snug cursor-pointer">
                                Confirmo que revi o resumo e autorizo executar o plano com o bind actual.
                              </Label>
                            </div>
                          ) : null}
                          <Button type="button" variant="link" className="h-auto p-0" onClick={() => persistBuilderAdvancedUi(true)}>
                            Abrir preview completo de bind (por agente, packs, overrides)
                          </Button>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {isBindPreviewLoading
                            ? "A carregar estado de bind…"
                            : "Guarde o plano ou aguarde o carregamento automático do preview para ver o resumo."}
                        </p>
                      )}
                    </div>
                  ) : null}
                  {builderAdvancedUi ? (
                    <>
                      {bindPreview ? (
                        <p className="text-sm text-muted-foreground">
                          {bindPreview.requiresExplicitApproval ? (
                            <>
                              <span className="font-medium text-foreground">Aprovacao necessaria:</span> ha acoes de bind,
                              reativacao ou overrides que exigem confirmacao antes do execute.
                            </>
                          ) : (
                            <>
                              <span className="font-medium text-foreground">Sem bind de risco imediato:</span> o preview
                              actual nao exige aprovacao manual (apenas se o plano mudar de forma relevante).
                            </>
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Clique em «Atualizar preview» para carregar o contrato do servidor, ou gere um plano com sugestoes
                          de capabilities para obter o preview automaticamente.
                        </p>
                      )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={bindPreview?.effectiveBindEnabled ? "default" : "secondary"}>
                      {bindPreview?.effectiveBindEnabled ? "Bind efetivo" : "Sem bind efetivo"}
                    </Badge>
                    {bindPreview?.bindResolutionMode === "per_agent" ? (
                      <Badge variant="outline" title="Candidatos de acao alinhados ao plano por agente">
                        por agente
                      </Badge>
                    ) : null}
                    <Badge variant="outline">requested {bindPreview?.autoBindActionsRequested ?? 0}</Badge>
                    <Badge variant="outline">applied {bindPreview?.autoBindActionsApplied ?? 0}</Badge>
                    <Badge variant="outline">override agentes {bindPreview?.bindOverrideAgentCount ?? 0}</Badge>
                    <Badge variant="outline">override actions {bindPreview?.bindOverrideActionCount ?? 0}</Badge>
                    <Badge variant="secondary">definitions {bindPreview?.toolDefinitions.length ?? 0}</Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void (plan ? refreshBindPreview(plan.id) : Promise.resolve())}
                      disabled={isBindPreviewLoading || isBindOverrideSaving}
                    >
                      {isBindPreviewLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Atualizar preview
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void applyGlobalBatchAction("apply_all")}
                      disabled={!bindPreview || isBindPreviewLoading || isBindOverrideSaving}
                    >
                      Aplicar tudo
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void applyGlobalBatchAction("clear_all")}
                      disabled={!bindPreview || isBindPreviewLoading || isBindOverrideSaving}
                    >
                      Limpar tudo
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void applyGlobalBatchAction("reset")}
                      disabled={!bindPreview || isBindPreviewLoading || isBindOverrideSaving}
                    >
                      Resetar politica
                    </Button>
                    {disabledBindDefinitionActionIds.length > 0 ? (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => void enableBindDefinitionsInline(disabledBindDefinitionActionIds)}
                        disabled={
                          isBindPreviewLoading || isBindOverrideSaving || isBindEnableSaving || !plan
                        }
                      >
                        {isBindEnableSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Ativar definitions inativas ({disabledBindDefinitionActionIds.length})
                      </Button>
                    ) : null}
                  </div>
                  {bindPreview ? (
                    <>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Tool definitions</p>
                        {bindPreview.toolDefinitions.map((definition) => (
                          <div key={definition.actionId} className="rounded-lg border p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <code className="text-xs">{definition.actionId}</code>
                                {definition.packIds.map((packId) => (
                                  <Badge key={`${definition.actionId}-${packId}`} variant="secondary" title={packId}>
                                    {plannerPackLabelPt(packId)}
                                  </Badge>
                                ))}
                                <Badge variant="outline">{definitionStatusLabel(definition.currentStatus)}</Badge>
                                <Badge
                                  variant={
                                    definition.plannedOperation === "create" || definition.plannedOperation === "reactivate"
                                      ? "default"
                                      : "secondary"
                                  }
                                >
                                  {plannedOperationLabel(definition.plannedOperation)}
                                </Badge>
                              </div>
                              {definition.currentStatus === "existing_disabled" && definition.toolDefinitionId ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => void enableBindDefinitionsInline([definition.actionId])}
                                  disabled={
                                    isBindPreviewLoading || isBindOverrideSaving || isBindEnableSaving || !plan
                                  }
                                >
                                  Ativar no workspace
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                      {bindPreview.suggestedPacks.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Acoes em lote por pack sugerido</p>
                          <div className="grid gap-3 md:grid-cols-2">
                            {bindPreview.suggestedPacks.map((pack) => (
                              <div key={pack.packId} className="rounded-lg border p-3 space-y-3">
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary" title={pack.packId}>
                                      {plannerPackLabelPt(pack.packId)}
                                    </Badge>
                                    <Badge variant="outline">actions {pack.actionIds.length}</Badge>
                                    <Badge variant="outline">padrao {pack.defaultSelectedActionIds.length}</Badge>
                                    <Badge variant="outline">final {pack.selectedActionIds.length}</Badge>
                                  </div>
                                  {(pack.actionIdsAddedByOverride.length > 0 || pack.actionIdsRemovedByOverride.length > 0) && (
                                    <p className="text-sm text-muted-foreground">
                                      Delta: +{pack.actionIdsAddedByOverride.length} / -{pack.actionIdsRemovedByOverride.length}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => void applyPackBatchAction(pack, "apply")}
                                    disabled={isBindPreviewLoading || isBindOverrideSaving}
                                  >
                                    Aplicar pack
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => void applyPackBatchAction(pack, "clear")}
                                    disabled={isBindPreviewLoading || isBindOverrideSaving}
                                  >
                                    Limpar pack
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => void applyPackBatchAction(pack, "reset")}
                                    disabled={isBindPreviewLoading || isBindOverrideSaving}
                                  >
                                    Resetar pack
                                  </Button>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {pack.actionIds.map((actionId) => `\`${actionId}\``).join(", ")}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Diff final do bind</p>
                        <div className="rounded-lg border p-3 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">
                              agentes afetados {bindPreview.diffSummary.affectedAgentCount}
                            </Badge>
                            <Badge variant="outline">acoes adicionadas {bindPreview.diffSummary.addedActionCount}</Badge>
                            <Badge variant="outline">acoes removidas {bindPreview.diffSummary.removedActionCount}</Badge>
                          </div>
                          {bindDiffAgents.length > 0 ? (
                            <div className="space-y-3">
                              {bindDiffAgents.map((agent) => (
                                <div key={`diff-${agent.planAgentKey}`} className="rounded-md border p-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium">{agent.agentName}</span>
                                    <Badge variant="outline">{agent.planAgentKey}</Badge>
                                    <Badge variant="secondary">padrao {agent.defaultActionIdsToLink.length}</Badge>
                                    <Badge variant="secondary">final {agent.actionIdsToLink.length}</Badge>
                                  </div>
                                  {agent.actionIdsAddedByOverride.length > 0 ? (
                                    <p className="mt-2 text-sm text-muted-foreground">
                                      Adicionadas:{" "}
                                      {agent.actionIdsAddedByOverride.map((actionId) => `\`${actionId}\``).join(", ")}
                                    </p>
                                  ) : null}
                                  {agent.actionIdsRemovedByOverride.length > 0 ? (
                                    <p className="mt-2 text-sm text-muted-foreground">
                                      Removidas:{" "}
                                      {agent.actionIdsRemovedByOverride.map((actionId) => `\`${actionId}\``).join(", ")}
                                    </p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              O bind final segue exatamente a politica padrao do workspace.
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Impacto por agente</p>
                        {bindPreview.agents.map((agent) => (
                          <div key={agent.planAgentKey} className="rounded-lg border p-3 space-y-3">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">{agent.agentName}</span>
                                  <Badge variant="outline">{agent.role}</Badge>
                                  <Badge variant="secondary">{agent.planningMode}</Badge>
                                  <Badge variant="outline">{bindModeLabel(agent.bindMode)}</Badge>
                                  {agent.overrideMode !== "inherit" ? (
                                    <Badge variant="secondary">{bindOverrideModeLabel(agent.overrideMode)}</Badge>
                                  ) : null}
                                </div>
                                {agent.targetAgentName ? (
                                  <p className="text-sm text-muted-foreground">Destino: {agent.targetAgentName}</p>
                                ) : null}
                                {agent.defaultBindMode !== agent.bindMode ? (
                                  <p className="text-sm text-muted-foreground">
                                    Politica padrao do workspace: {bindModeLabel(agent.defaultBindMode)}.
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`bind-toggle-${agent.planAgentKey}`}>Aplicar bind</Label>
                                <Switch
                                  id={`bind-toggle-${agent.planAgentKey}`}
                                  checked={agent.effectiveBindEnabled}
                                  disabled={isBindPreviewLoading || isBindOverrideSaving}
                                  onCheckedChange={(checked) => void updateAgentBindOverride(agent, checked)}
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => void applyAgentBatchAction(agent, "apply_all")}
                                disabled={isBindPreviewLoading || isBindOverrideSaving}
                              >
                                Aplicar tudo
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => void applyAgentBatchAction(agent, "clear_all")}
                                disabled={isBindPreviewLoading || isBindOverrideSaving}
                              >
                                Limpar tudo
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => void applyAgentBatchAction(agent, "reset")}
                                disabled={isBindPreviewLoading || isBindOverrideSaving}
                              >
                                Resetar politica
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Padrao do workspace: {agent.defaultActionIdsToLink.length} actionId(s). Final aprovado:{" "}
                              {agent.actionIdsToLink.length}.
                            </p>
                            {agent.actionIdsToLink.length > 0 ? (
                              <p className="text-sm text-muted-foreground">
                                Vai vincular: {agent.actionIdsToLink.map((actionId) => `\`${actionId}\``).join(", ")}
                              </p>
                            ) : null}
                            {agent.actionIdsCandidate.length > 0 ? (
                              <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">Selecionar actionIds para este agente:</p>
                                <div className="space-y-2">
                                  {agent.actionIdsCandidate.map((actionId) => {
                                    const checked = agent.actionIdsToLink.includes(actionId)
                                    const blockedByInactiveDefinition =
                                      agent.actionIdsBlockedByDisabledDefinitions.includes(actionId)
                                    return (
                                      <label
                                        key={`${agent.planAgentKey}-${actionId}`}
                                        className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
                                      >
                                        <Checkbox
                                          checked={checked}
                                          disabled={
                                            !agent.effectiveBindEnabled ||
                                            isBindPreviewLoading ||
                                            isBindOverrideSaving ||
                                            blockedByInactiveDefinition
                                          }
                                          onCheckedChange={(nextChecked) =>
                                            void updateAgentActionOverride(agent, actionId, Boolean(nextChecked))
                                          }
                                        />
                                        <code className="text-xs">{actionId}</code>
                                        {blockedByInactiveDefinition ? (
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="secondary"
                                            className="h-7 text-xs"
                                            onClick={() => void enableBindDefinitionsInline([actionId])}
                                            disabled={
                                              isBindPreviewLoading || isBindOverrideSaving || isBindEnableSaving || !plan
                                            }
                                          >
                                            Ativar definition
                                          </Button>
                                        ) : null}
                                      </label>
                                    )
                                  })}
                                </div>
                              </div>
                            ) : null}
                            {agent.actionIdsAlreadyLinked.length > 0 ? (
                              <p className="text-sm text-muted-foreground">
                                Ja vinculadas: {agent.actionIdsAlreadyLinked.map((actionId) => `\`${actionId}\``).join(", ")}
                              </p>
                            ) : null}
                            {agent.actionIdsExcludedByOverride.length > 0 ? (
                              <p className="text-sm text-muted-foreground">
                                Excluidas pelo override:{" "}
                                {agent.actionIdsExcludedByOverride.map((actionId) => `\`${actionId}\``).join(", ")}
                              </p>
                            ) : null}
                            {agent.actionIdsAddedByOverride.length > 0 ? (
                              <p className="text-sm text-muted-foreground">
                                Adicionadas ao padrao:{" "}
                                {agent.actionIdsAddedByOverride.map((actionId) => `\`${actionId}\``).join(", ")}
                              </p>
                            ) : null}
                            {agent.actionIdsRemovedByOverride.length > 0 ? (
                              <p className="text-sm text-muted-foreground">
                                Removidas do padrao:{" "}
                                {agent.actionIdsRemovedByOverride.map((actionId) => `\`${actionId}\``).join(", ")}
                              </p>
                            ) : null}
                            {agent.actionIdsBlockedByDisabledDefinitions.length > 0 ? (
                              <p className="text-xs text-muted-foreground">
                                Com definition inativa, o checkbox fica bloqueado ate reativar com{" "}
                                <strong>Ativar definition</strong> na linha acima (ou nos cartoes de Tool definitions /
                                botao em lote).
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                      {bindPreview && requiresExplicitBindApproval ? (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="bind-preview-approved"
                            checked={bindPreviewApproved}
                            onCheckedChange={(checked) => setBindPreviewApproved(Boolean(checked))}
                          />
                          <Label htmlFor="bind-preview-approved">
                            Revisei o preview de bind da ultima versao salva e aprovo executar o plano.
                          </Label>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Salve o plano e use «Atualizar preview» para ver o bind antes de executar.
                    </p>
                  )}
                    </>
                  ) : null}
                </CardContent>
              </Card>
            </div>
            <div className="order-5 flex flex-col gap-4">
            {lastExecutionMeta && plan.status === "executed" ? (
              <Alert variant={lastExecutionMeta.effectiveBindEnabled ?? lastExecutionMeta.autoBindEnabled ? "default" : "destructive"}>
                <Sparkles className="h-4 w-4" />
                <AlertTitle>Resultado do bind de tools</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p className="text-muted-foreground">
                    {lastExecutionMeta.effectiveBindEnabled ?? lastExecutionMeta.autoBindEnabled
                      ? "O servidor executou o bind final aprovado para as capabilities sugeridas."
                      : "O servidor executou o plano sem auto-bind. As capabilities continuam dependentes de habilitacao manual."}
                  </p>
                  <p className="text-muted-foreground">
                    Fonte da politica usada nesta execucao:{" "}
                    <strong>
                      {lastExecutionMeta.autoBindPolicySource === "workspace_enabled"
                        ? "workspace ligado"
                        : lastExecutionMeta.autoBindPolicySource === "workspace_disabled"
                          ? "workspace desligado"
                          : "padrao do servidor"}
                    </strong>
                    .
                  </p>
                  <p className="text-muted-foreground">
                    Politica para agentes `reused`:{" "}
                    <strong>{lastExecutionMeta.reusedAgentBindMode === "merge" ? "merge" : "manual"}</strong>.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      requested {lastExecutionMeta.autoBindActionsRequested ?? 0}
                    </Badge>
                    <Badge variant="outline">
                      applied {lastExecutionMeta.autoBindActionsApplied ?? 0}
                    </Badge>
                    <Badge variant="secondary">
                      definitions {lastExecutionMeta.boundToolDefinitionIds?.length ?? 0}
                    </Badge>
                    <Badge variant="outline">
                      override agentes {lastExecutionMeta.bindOverrideAgentCount ?? 0}
                    </Badge>
                    <Badge variant="outline">
                      override actions {lastExecutionMeta.bindOverrideActionCount ?? 0}
                    </Badge>
                    <Badge variant="outline">
                      reused updated {lastExecutionMeta.reusedAgentsUpdated ?? 0}
                    </Badge>
                    <Badge variant="outline">
                      reused skipped {lastExecutionMeta.reusedAgentsSkipped ?? 0}
                    </Badge>
                  </div>
                  {reusedAgentsCount > 0 ? (
                    <p className="text-muted-foreground">
                      Este plano reutilizou {reusedAgentsCount} agente(s).{" "}
                      {lastExecutionMeta.reusedAgentBindMode === "merge"
                        ? "O backend aplicou merge controlado onde necessario."
                        : "Valide manualmente a aba Ferramentas desses agentes se as capabilities forem necessarias no runtime."}
                    </p>
                  ) : null}
                  {lastExecutionMeta.bindOverridesApplied ? (
                    <p className="text-muted-foreground">
                      Overrides granulares ajustaram o bind antes do execute final.
                    </p>
                  ) : null}
                  {lastExecutionMeta.bindDiffSummary ? (
                    <p className="text-muted-foreground">
                      Delta aprovado versus politica do workspace: {lastExecutionMeta.bindDiffSummary.addedActionCount}{" "}
                      adicao(oes), {lastExecutionMeta.bindDiffSummary.removedActionCount} remocao(oes), em{" "}
                      {lastExecutionMeta.bindDiffSummary.affectedAgentCount} agente(s).
                    </p>
                  ) : null}
                  {(lastExecutionMeta.reactivatedToolDefinitionIds?.length ?? 0) > 0 ? (
                    <p className="text-muted-foreground">
                      Definitions reativadas automaticamente para destravar o bind:{" "}
                      {lastExecutionMeta.reactivatedToolDefinitionIds!.length} id(s).
                    </p>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}
            {executionPhase && (
              <div className="rounded-lg border border-dashed p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Executando</span>
                  <Badge variant="outline">{executionPhase}</Badge>
                </div>
                {executionDetail && <p className="text-muted-foreground mt-1">{executionDetail}</p>}
              </div>
            )}
            {plan.reuseSummary?.reuseRecommendations?.length ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Reuso sugerido</AlertTitle>
                <AlertDescription>{plan.reuseSummary.reuseRecommendations.join(" ")}</AlertDescription>
              </Alert>
            ) : null}
            {plan.reuseSummary?.conflicts?.length ? (
              <Alert variant={overlapMode === "warning" ? "default" : "destructive"}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Conflitos no plano</AlertTitle>
                <AlertDescription>
                  {plan.reuseSummary.conflicts.map((conflict) => conflict.reason).join(" ")}
                  {overlapMode === "warning"
                    ? " Com política em modo aviso, você pode executar mesmo assim; o backend registra o aviso."
                    : null}
                </AlertDescription>
              </Alert>
            ) : null}
            </div>
            <div className="order-3 flex flex-col gap-6">
            <div className="space-y-2">
              <Label>Nome do time</Label>
              <Input
                value={plan.team.name}
                onChange={(e) => {
                  proposePlanUpdate({ ...plan, team: { ...plan.team, name: e.target.value } })
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Objetivo do time</Label>
              <Textarea
                value={plan.team.objective}
                onChange={(e) => {
                  proposePlanUpdate({ ...plan, team: { ...plan.team, objective: e.target.value } })
                }}
              />
            </div>
            <div className="space-y-3">
              <Label>Agentes planejados</Label>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Ferramentas de <strong>domínio</strong> (SQL, calendário, e-mail, etc.) não podem repetir entre{" "}
                <strong>especialistas</strong>. Utilitários (
                {CATALOG_UTILITY_TOOL_IDS.map((id) => catalogToolLabelPt(id)).join(", ")}) podem repetir.
              </p>
              {specialistExclusiveCollisions.length > 0 ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Conflito de catalogTools entre especialistas</AlertTitle>
                  <AlertDescription asChild>
                    <ul className="list-disc pl-4 text-sm space-y-1">
                      {specialistExclusiveCollisions.map((line, i) => (
                        <li key={`exclusive-collision-${i}`}>{line}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}
              {plan.agents.map((agent, index) => (
                <div key={`${agent.role}-${index}`} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{agent.role}</Badge>
                    <Badge variant={agent.planningMode === "existing" ? "secondary" : "outline"}>
                      {agent.planningMode ?? "new"}
                    </Badge>
                    {agent.overlapScore ? <Badge variant="secondary">score {agent.overlapScore.toFixed(2)}</Badge> : null}
                  </div>
                  <Input
                    value={agent.name}
                    onChange={(e) => {
                      const agents = [...plan.agents]
                      agents[index] = { ...agents[index], name: e.target.value }
                      proposePlanUpdate({ ...plan, agents })
                    }}
                  />
                  <div className="space-y-1.5">
                    <Label className="text-sm">Missão / objetivo do agente</Label>
                    <Textarea
                      value={agent.objective}
                      onChange={(e) => {
                        const agents = [...plan.agents]
                        agents[index] = { ...agents[index], objective: e.target.value }
                        proposePlanUpdate({ ...plan, agents })
                      }}
                      rows={3}
                      className="min-h-[72px] resize-y"
                    />
                  </div>
                  {builderAdvancedUi &&
                    (agent.workflowKey ||
                      (agent.requiredPackIds?.length ?? 0) > 0 ||
                      (agent.requiredBusinessActionIds?.length ?? 0) > 0) && (
                    <div className="rounded-md border bg-muted/30 px-3 py-2 space-y-2 text-sm">
                      <p className="text-xs font-medium text-muted-foreground">
                        Plano por agente (contrato do planner — Loop 82)
                      </p>
                      {agent.workflowKey ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground">Workflow</span>
                          <code className="text-xs rounded bg-muted px-1.5 py-0.5">{agent.workflowKey}</code>
                        </div>
                      ) : null}
                      {(agent.requiredPackIds?.length ?? 0) > 0 ? (
                        <div>
                          <span className="text-muted-foreground text-xs">Packs neste agente: </span>
                          <span className="flex flex-wrap gap-1 mt-1">
                            {agent.requiredPackIds!.map((p) => (
                              <Badge key={p} variant="outline" className="text-xs">
                                {plannerPackLabelPt(p)}
                              </Badge>
                            ))}
                          </span>
                        </div>
                      ) : null}
                      {(agent.requiredBusinessActionIds?.length ?? 0) > 0 ? (
                        <div>
                          <span className="text-muted-foreground text-xs">Ações de negócio (actionIds): </span>
                          <ul className="list-disc list-inside mt-1 text-xs text-muted-foreground">
                            {agent.requiredBusinessActionIds!.map((t) => (
                              <li key={t}>
                                <code>{t}</code>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label className="text-sm text-muted-foreground">Ferramentas do catálogo (OpenAI)</Label>
                      {builderAdvancedUi ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => setCatalogToolsEditorIndex(index)}>
                          Editar ferramentas
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs h-8"
                          onClick={() => persistBuilderAdvancedUi(true)}
                        >
                          Ajustar no modo avançado
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                      {(agent.catalogTools ?? []).length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          Nenhuma seleccionada — o servidor pode inferir na execução.
                        </span>
                      ) : (
                        (agent.catalogTools ?? []).map((tid) => (
                          <Badge key={tid} variant="secondary" className="font-normal">
                            {catalogToolLabelPt(tid as CatalogToolId)}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <Collapsible defaultOpen={false}>
                    <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md border border-dashed px-2 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-muted/50">
                      <span>Descrição, skills e notas de overlap</span>
                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 pt-2">
                      <Textarea
                        value={agent.description}
                        onChange={(e) => {
                          const agents = [...plan.agents]
                          agents[index] = { ...agents[index], description: e.target.value }
                          proposePlanUpdate({ ...plan, agents })
                        }}
                        placeholder="Descrição do papel"
                      />
                      <Input
                        value={agent.skills.join(", ")}
                        onChange={(e) => {
                          const agents = [...plan.agents]
                          agents[index] = { ...agents[index], skills: parseCsv(e.target.value) }
                          proposePlanUpdate({ ...plan, agents })
                        }}
                        placeholder="Skills separadas por vírgula"
                      />
                      {agent.overlapReason ? (
                        <p className="text-xs text-muted-foreground">{agent.overlapReason}</p>
                      ) : null}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              ))}
            </div>
            <Dialog
              open={catalogToolsEditorIndex !== null}
              onOpenChange={(open) => {
                if (!open) setCatalogToolsEditorIndex(null)
              }}
            >
              <DialogContent className="max-w-lg sm:max-w-xl">
                {catalogToolsEditorIndex !== null && plan.agents[catalogToolsEditorIndex] ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Ferramentas do catálogo</DialogTitle>
                      <DialogDescription>
                        {plan.agents[catalogToolsEditorIndex].name} — builtins do OpenAI Agents SDK por agente.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 max-h-[min(70vh,520px)] overflow-y-auto pr-1">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Domínio (um especialista por ferramenta)</p>
                        <p className="text-xs text-muted-foreground">
                          Ao activar aqui, não pode repetir entre dois especialistas. O coordenador não entra nesta colisão.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {SPECIALIST_EXCLUSIVE_CATALOG_TOOL_IDS.map((tid) => (
                            <label key={tid} className="flex items-center gap-2 text-sm cursor-pointer">
                              <Checkbox
                                checked={
                                  (plan.agents[catalogToolsEditorIndex]?.catalogTools ?? []).includes(tid)
                                }
                                onCheckedChange={(c) =>
                                  handleCatalogToolCheckedChange(catalogToolsEditorIndex, tid, c === true)
                                }
                              />
                              <span>{catalogToolLabelPt(tid)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Utilitários (podem repetir entre especialistas)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {CATALOG_UTILITY_TOOL_IDS.map((tid) => (
                            <label key={tid} className="flex items-center gap-2 text-sm cursor-pointer">
                              <Checkbox
                                checked={
                                  (plan.agents[catalogToolsEditorIndex]?.catalogTools ?? []).includes(tid)
                                }
                                onCheckedChange={(c) =>
                                  handleCatalogToolCheckedChange(catalogToolsEditorIndex, tid, c === true)
                                }
                              />
                              <span>{catalogToolLabelPt(tid)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="secondary" onClick={() => setCatalogToolsEditorIndex(null)}>
                        Fechar
                      </Button>
                    </DialogFooter>
                  </>
                ) : null}
              </DialogContent>
            </Dialog>
            <Collapsible defaultOpen={false} className="space-y-2">
              <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-medium hover:bg-muted/50">
                <span>Pré-visualização do grafo</span>
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-1">
                <GraphLegendInline />
                <div className="h-[220px] overflow-hidden rounded-lg border sm:h-[280px]">
                  <ReactFlow
                    key={`${plan.id}-${previewGraphNodes.length}-${previewGraphEdges.length}`}
                    colorMode="dark"
                    nodeTypes={graphNodeTypes}
                    nodes={previewGraphNodes}
                    edges={previewGraphEdges}
                    fitView
                    fitViewOptions={{ padding: 0.15, maxZoom: 1.25 }}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    elementsSelectable={false}
                    zoomOnScroll={false}
                    panOnScroll
                    proOptions={{ hideAttribution: true }}
                    className="bg-background"
                  >
                    <GraphFlowOverlays />
                  </ReactFlow>
                </div>
              </CollapsibleContent>
            </Collapsible>
            </div>
            <div className="order-6 flex flex-col gap-4">
            {executePlanBlockers.length > 0 ? (
              <Alert variant="secondary">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Execute bloqueado</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {executePlanBlockers.map((b, i) => (
                      <li key={`${i}-${b}`}>{b}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}
            <input
              ref={importSnapshotInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onImportTeamPlanSnapshotFile}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                type="button"
                variant="outline"
                onClick={downloadTeamPlanSnapshot}
                disabled={!plan}
                className="w-full sm:w-auto"
              >
                <Download className="w-4 h-4 mr-2" />
                Descarregar JSON
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={triggerImportTeamPlanSnapshot}
                disabled={!api || isImportingSnapshot}
                className="w-full sm:w-auto"
              >
                {isImportingSnapshot ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Importar JSON
              </Button>
              <Button
                variant="outline"
                onClick={saveEdits}
                disabled={isSaving || specialistExclusiveCollisions.length > 0 || specialistWorkflowDuplicates.length > 0}
                className="w-full sm:w-auto"
              >
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PencilLine className="w-4 h-4 mr-2" />}
                Salvar ajustes
              </Button>
              <Button
                className="w-full sm:w-auto"
                onClick={executePlan}
                disabled={
                  isExecuting ||
                  executePlanBlockers.length > 0 ||
                  specialistExclusiveCollisions.length > 0 ||
                  specialistWorkflowDuplicates.length > 0 ||
                  (requiresExplicitBindApproval && (!bindPreview || !bindPreviewApproved)) ||
                  (overlapMode === "blocking" && (plan.reuseSummary?.conflicts?.length ?? 0) > 0) ||
                  isBindPreviewLoading
                }
              >
                {isExecuting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                {isExecuting ? "Executando..." : "Executar plano"}
              </Button>
            </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
