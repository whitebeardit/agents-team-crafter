"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Sparkles, Play, PencilLine, AlertTriangle } from "lucide-react"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { ApiError, createApiClient } from "@/lib/api/client"
import type {
  GovernanceFeatureFlags,
  GovernanceOverlapMode,
  TeamPlanAgentDraft,
  TeamPlanDraft,
} from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { createOperationId } from "@/lib/utils/operation-id"
import { ReactFlow, type Node, type Edge } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { nodeTypes as graphNodeTypes } from "@/components/graph/graph-node"
import { GraphLegendInline } from "@/components/graph/graph-legend"
import { GraphFlowOverlays } from "@/components/graph/graph-flow-overlays"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

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
  const [executionPhase, setExecutionPhase] = useState<null | "creating_agents" | "creating_team" | "graph" | "activate">(null)
  const [executionDetail, setExecutionDetail] = useState<string>("")
  const [openaiKeyConfiguredInWorkspace, setOpenaiKeyConfiguredInWorkspace] = useState<boolean | null>(null)
  const [overlapMode, setOverlapMode] = useState<GovernanceOverlapMode>("blocking")

  const previewGraphNodes = useMemo(() => (plan ? enrichPreviewNodes(plan) : []), [plan])
  const previewGraphEdges = useMemo(
    () => (plan?.graph?.edges ?? []).map(toEdge).filter(Boolean) as Edge[],
    [plan],
  )

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
    void api
      .get<{ secretsMasked: { openaiApiKeyConfigured: boolean } }>("/settings/workspace/integrations")
      .then((r) => setOpenaiKeyConfiguredInWorkspace(r.data.secretsMasked.openaiApiKeyConfigured))
      .catch(() => setOpenaiKeyConfiguredInWorkspace(false))
  }, [api])

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
      setPlan(res.data)
      const meta = res.data.plannerMeta
      if (meta?.usedFallback) toast.warning("Plano gerado em modo template")
      else toast.success("Plano criado. Revise e ajuste se necessário.")
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
            const p = payload as { data?: TeamPlanDraft; meta?: Record<string, unknown> } | TeamPlanDraft
            const data =
              p && typeof p === "object" && "data" in p && p.data ? p.data : (p as TeamPlanDraft)
            const meta =
              p && typeof p === "object" && "meta" in p ? (p as { meta?: Record<string, unknown> }).meta : undefined
            setPlan(data)
            const teamId = data.result?.teamId
            if (meta?.governanceWarning) {
              toast.warning(
                "Time criado com aviso de governança: conflitos de overlap aceitos conforme a política do workspace.",
              )
            } else {
              toast.success("Time criado e configurado com sucesso")
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
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Whitebeard AI Builder</h1>
            <p className="text-muted-foreground mt-1">Descreva o problema e gere um time completo com plano editável.</p>
          </div>
          <Button variant="outline" asChild>
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
            {plan.plannerMeta?.usedFallback && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Plano em modo template</AlertTitle>
                <AlertDescription>
                  A resposta do planner caiu em fallback. Revise cuidadosamente antes de executar.
                </AlertDescription>
              </Alert>
            )}
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
              <Input value={plan.team.name} onChange={(e) => setPlan({ ...plan, team: { ...plan.team, name: e.target.value } })} />
            </div>
            <div className="space-y-2">
              <Label>Objetivo do time</Label>
              <Textarea value={plan.team.objective} onChange={(e) => setPlan({ ...plan, team: { ...plan.team, objective: e.target.value } })} />
            </div>
            <div className="space-y-3">
              <Label>Agentes planejados</Label>
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
                      setPlan({ ...plan, agents })
                    }}
                  />
                  <Textarea
                    value={agent.description}
                    onChange={(e) => {
                      const agents = [...plan.agents]
                      agents[index] = { ...agents[index], description: e.target.value }
                      setPlan({ ...plan, agents })
                    }}
                  />
                  <Input
                    value={agent.skills.join(", ")}
                    onChange={(e) => {
                      const agents = [...plan.agents]
                      agents[index] = { ...agents[index], skills: parseCsv(e.target.value) }
                      setPlan({ ...plan, agents })
                    }}
                    placeholder="skills separadas por vírgula"
                  />
                  {agent.overlapReason ? <p className="text-xs text-muted-foreground">{agent.overlapReason}</p> : null}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Pré-visualização do grafo</Label>
              <GraphLegendInline />
              <div className="h-[280px] rounded-lg border overflow-hidden">
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
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={saveEdits} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PencilLine className="w-4 h-4 mr-2" />}
                Salvar ajustes
              </Button>
              <Button
                onClick={executePlan}
                disabled={
                  isExecuting ||
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
