"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Sparkles, Play, PencilLine, AlertTriangle, Info } from "lucide-react"
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
} from "@/lib/types"
import { getPlannerFallbackCopy } from "@/lib/planner-fallback-messages"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { createOperationId } from "@/lib/utils/operation-id"
import { plannerPackLabelPt } from "@/lib/planner-pack-labels"
import {
  CATALOG_TOOL_IDS,
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

type TeamPlanningPolicy = {
  autoBindMode: "inherit" | "enabled" | "disabled"
  autoBindEnabled: boolean
  source: "workspace_enabled" | "workspace_disabled" | "environment_default"
  reusedAgentBindMode: "manual" | "merge"
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

  const previewGraphNodes = useMemo(() => (plan ? enrichPreviewNodes(plan) : []), [plan])
  const previewGraphEdges = useMemo(
    () => (plan?.graph?.edges ?? []).map(toEdge).filter(Boolean) as Edge[],
    [plan],
  )
  const requiredCapabilityCount = (plan?.requiredPacks?.length ?? 0) + (plan?.requiredTools?.length ?? 0)
  const reusedAgentsCount = plan?.agents.filter((agent) => agent.planningMode === "existing").length ?? 0
  const requiresBindReview = requiredCapabilityCount > 0
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

  const plannerFallbackCopy = useMemo(() => {
    if (!plan?.plannerMeta?.usedFallback) return null
    return getPlannerFallbackCopy(plan.plannerMeta as TeamPlanPlannerMeta)
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
    setBindPreviewApproved(false)
    try {
      const res = await api.get<TeamPlanBindPreview>(`/team-plans/${planId}/bind-preview`)
      setBindPreview(res.data)
    } catch (e) {
      setBindPreview(null)
      const message = e instanceof ApiError ? e.message : "Falha ao gerar preview de bind"
      toast.error(message)
    } finally {
      setIsBindPreviewLoading(false)
    }
  }

  const enableBindDefinitionsInline = async (actionIds: string[]) => {
    if (!api || !plan || actionIds.length === 0) return
    setIsBindEnableSaving(true)
    setBindPreviewApproved(false)
    try {
      const res = await api.post<{
        preview: TeamPlanBindPreview
        reactivatedToolDefinitionIds: string[]
      }>(`/team-plans/${plan.id}/bind-enable-definitions`, { actionIds })
      setBindPreview(res.data.preview)
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
    setBindPreviewApproved(false)
    try {
      const res = await api.put<{ plan: TeamPlanDraft; preview: TeamPlanBindPreview }>(
        `/team-plans/${planId}/bind-overrides`,
        { bindOverrides: normalizeBindOverrides(bindOverrides) },
      )
      setPlan(res.data.plan)
      setBindPreview(res.data.preview)
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

  const generatePlan = async () => {
    if (!api || problem.trim().length < 10) return
    setIsGenerating(true)
    try {
      const res = await api.post<TeamPlanDraft>("/team-plans", {
        problem: problem.trim(),
        context: context.trim() || undefined,
      })
      setLastExecutionMeta(null)
      setBindPreview(null)
      setBindPreviewApproved(false)
      setPlan(res.data)
      if ((res.data.requiredPacks?.length ?? 0) > 0 || (res.data.requiredTools?.length ?? 0) > 0) {
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
      setBindPreview(null)
      await refreshBindPreview(res.data.id)
      toast.success("Plano atualizado")
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Falha ao salvar alterações"
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const executePlan = async () => {
    if (!api || !plan) return
    setIsExecuting(true)
    setExecutionPhase(null)
    setExecutionDetail("")
    setLastExecutionMeta(null)
    if (requiresBindReview && (!bindPreview || !bindPreviewApproved)) {
      toast.warning("Revise e aprove o preview de bind antes de executar o plano.")
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
            toast.error(e.message)
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
        <CardContent className="space-y-3">
          <Label htmlFor="problem">Problema principal</Label>
          <Textarea
            id="problem"
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="Ex: temos alto volume de tickets e baixa taxa de resolução no primeiro contato..."
            className="min-h-28"
          />
          <Label htmlFor="context">Contexto opcional</Label>
          <Textarea
            id="context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
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
          <CardHeader>
            <CardTitle>Revisar plano</CardTitle>
            <CardDescription>Edite o plano e confirme reuso, novos agentes e conflitos antes de executar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
            {((plan.requiredPacks?.length ?? 0) > 0 || (plan.requiredTools?.length ?? 0) > 0) && (
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
                    O execute fica liberado apos revisar o preview de bind da ultima versao salva do plano.
                  </p>
                </AlertDescription>
              </Alert>
            )}
            {requiresBindReview ? (
              <Card>
                <CardHeader>
                  <CardTitle>Preview de bind</CardTitle>
                  <CardDescription>
                    Mostra o que o backend pretende criar, reutilizar e vincular antes do execute.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={bindPreview?.effectiveBindEnabled ? "default" : "secondary"}>
                      {bindPreview?.effectiveBindEnabled ? "Bind efetivo" : "Sem bind efetivo"}
                    </Badge>
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
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Salve o plano e gere o preview para liberar a execucao com visibilidade do bind.
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : null}
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
            <div className="space-y-2">
              <Label>Nome do time</Label>
              <Input
                value={plan.team.name}
                onChange={(e) => {
                  setBindPreview(null)
                  setBindPreviewApproved(false)
                  setPlan({ ...plan, team: { ...plan.team, name: e.target.value } })
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Objetivo do time</Label>
              <Textarea
                value={plan.team.objective}
                onChange={(e) => {
                  setBindPreview(null)
                  setBindPreviewApproved(false)
                  setPlan({ ...plan, team: { ...plan.team, objective: e.target.value } })
                }}
              />
            </div>
            <div className="space-y-3">
              <Label>Agentes planejados</Label>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Ferramentas por domínio</AlertTitle>
                <AlertDescription className="text-muted-foreground text-sm">
                  Cada especialista deve ter um âmbito distinto: as ferramentas marcadas como de domínio (SQL, calendário,
                  ações internas, e-mail, imagem, ficheiros) não podem ser atribuídas a dois especialistas ao mesmo tempo.
                  O coordenador pode partilhar utilitários com um especialista sem conflito.
                </AlertDescription>
              </Alert>
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
                <div key={`${agent.role}-${index}`} className="border rounded-lg p-3 space-y-2">
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
                      setBindPreview(null)
                      setBindPreviewApproved(false)
                      setPlan({ ...plan, agents })
                    }}
                  />
                  <Textarea
                    value={agent.description}
                    onChange={(e) => {
                      const agents = [...plan.agents]
                      agents[index] = { ...agents[index], description: e.target.value }
                      setBindPreview(null)
                      setBindPreviewApproved(false)
                      setPlan({ ...plan, agents })
                    }}
                  />
                  <Input
                    value={agent.skills.join(", ")}
                    onChange={(e) => {
                      const agents = [...plan.agents]
                      agents[index] = { ...agents[index], skills: parseCsv(e.target.value) }
                      setBindPreview(null)
                      setBindPreviewApproved(false)
                      setPlan({ ...plan, agents })
                    }}
                    placeholder="skills separadas por vírgula"
                  />
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">Ferramentas builtin (catálogo OpenAI)</Label>
                    <p className="text-xs text-muted-foreground">
                      Por defeito o plano sugere um subconjunto por papel; ajuste antes de executar.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {CATALOG_TOOL_IDS.map((tid) => (
                        <label key={tid} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={(agent.catalogTools ?? []).includes(tid)}
                            onCheckedChange={(c) => {
                              const agents = [...plan.agents]
                              const cur = new Set(agents[index]?.catalogTools ?? [])
                              if (c === true) cur.add(tid)
                              else cur.delete(tid)
                              agents[index] = { ...agents[index]!, catalogTools: [...cur] }
                              setBindPreview(null)
                              setBindPreviewApproved(false)
                              setPlan({ ...plan, agents })
                            }}
                          />
                          <span>{catalogToolLabelPt(tid)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {agent.overlapReason ? <p className="text-xs text-muted-foreground">{agent.overlapReason}</p> : null}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Pré-visualização do grafo</Label>
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
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                variant="outline"
                onClick={saveEdits}
                disabled={isSaving || specialistExclusiveCollisions.length > 0}
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
                  isBindPreviewLoading ||
                  specialistExclusiveCollisions.length > 0 ||
                  (requiresBindReview && (!bindPreview || !bindPreviewApproved)) ||
                  (overlapMode === "blocking" && (plan.reuseSummary?.conflicts?.length ?? 0) > 0)
                }
              >
                {isExecuting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                {isExecuting ? "Executando..." : "Executar plano"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
