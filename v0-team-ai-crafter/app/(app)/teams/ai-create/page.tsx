"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Sparkles, Play, PencilLine } from "lucide-react"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { ApiError, createApiClient } from "@/lib/api/client"
import type { TeamPlanAgentDraft, TeamPlanDraft } from "@/lib/types"
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
import { AlertTriangle } from "lucide-react"

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

/** Mapeia `data.agentId` do grafo (`coordinator`, `specialist-1`, …) — alinhado ao backend `buildDefaultGraph`. */
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

export default function AiCreateTeamPage() {
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
    null | "creating_agents" | "creating_team" | "graph" | "activate"
  >(null)
  const [executionDetail, setExecutionDetail] = useState<string>("")
  const [openaiKeyConfiguredInWorkspace, setOpenaiKeyConfiguredInWorkspace] = useState<boolean | null>(null)

  const previewGraphNodes = useMemo(
    () => (plan ? enrichPreviewNodes(plan) : []),
    [plan],
  )
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
      if (meta?.usedFallback) {
        toast.warning("Plano gerado em modo template (sem resposta válida da IA). Veja o aviso abaixo.")
      } else {
        toast.success("Plano criado. Revise e ajuste se necessário.")
      }
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
          onComplete: (data) => {
            setPlan(data)
            const teamId = data.result?.teamId
            toast.success("Time criado e configurado com sucesso")
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
    <div className="py-4 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Whitebeard AI Builder</h1>
          <p className="text-muted-foreground mt-1">Descreva o problema e gere um time completo com plano editável.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/teams/create">Voltar ao wizard clássico</Link>
        </Button>
      </div>

      {openaiKeyConfiguredInWorkspace === false && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>OpenAI não configurada no workspace</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Para usar o planner com modelo real, adicione uma chave em{" "}
            <Link href="/settings" className="font-medium text-primary underline-offset-4 hover:underline">
              Configurações → Integrações
            </Link>{" "}
            ou defina <code className="text-xs bg-muted px-1 rounded">OPENAI_API_KEY</code> no servidor do backend
            (fallback para desenvolvimento).
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>1) Descreva o problema</CardTitle>
          <CardDescription>O agente cria um plano com time, agentes, responsabilidades e execução.</CardDescription>
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
            {isGenerating ? "Gerando plano..." : "Gerar plano com IA"}
          </Button>
        </CardContent>
      </Card>

      {plan && (
        <Card>
          <CardHeader>
            <CardTitle>2) Revise e edite o plano</CardTitle>
            <CardDescription>Você pode ajustar qualquer campo antes de executar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {plan.plannerMeta?.usedFallback && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Plano em modo template</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    {plan.plannerMeta?.fallbackReason === "no_openai_key" &&
                      "Nenhuma chave OpenAI disponível para este workspace ou servidor."}
                    {plan.plannerMeta?.fallbackReason === "openai_request_failed" &&
                      "A chamada ao modelo OpenAI falhou. Verifique a chave e a rede."}
                    {plan.plannerMeta?.fallbackReason === "json_extract_failed" &&
                      "A resposta do modelo não pôde ser interpretada como JSON."}
                    {plan.plannerMeta?.fallbackReason === "schema_validation_failed" &&
                      "A resposta do modelo não passou na validação do plano."}
                    {plan.plannerMeta?.fallbackReason &&
                      !["no_openai_key", "openai_request_failed", "json_extract_failed", "schema_validation_failed"].includes(
                        plan.plannerMeta.fallbackReason,
                      ) &&
                      `Motivo: ${plan.plannerMeta.fallbackReason}.`}
                    {!plan.plannerMeta?.fallbackReason &&
                      !plan.plannerMeta?.usedOpenAi &&
                      "O plano não foi gerado pela IA (configuração ou validação)."}
                  </p>
                  <p className="text-sm">
                    <Link href="/settings" className="font-medium underline-offset-4 hover:underline">
                      Abrir Configurações (Integrações)
                    </Link>
                    {" · "}
                    Chave de ambiente no backend: <code className="text-xs bg-background/80 px-1 rounded">OPENAI_API_KEY</code>
                  </p>
                  {plan.plannerMeta?.parseErrorSummary && (
                    <p className="text-xs font-mono opacity-90 line-clamp-3">{plan.plannerMeta.parseErrorSummary}</p>
                  )}
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
            <div className="space-y-2">
              <Label>Nome do time</Label>
              <Input value={plan.team.name} onChange={(e) => setPlan({ ...plan, team: { ...plan.team, name: e.target.value } })} />
            </div>
            <div className="space-y-2">
              <Label>Objetivo do time</Label>
              <Textarea
                value={plan.team.objective}
                onChange={(e) => setPlan({ ...plan, team: { ...plan.team, objective: e.target.value } })}
              />
            </div>
            <div className="space-y-3">
              <Label>Agentes planejados</Label>
              {plan.agents.map((agent, index) => (
                <div key={`${agent.role}-${index}`} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{agent.role}</Badge>
                    <Input
                      value={agent.name}
                      onChange={(e) => {
                        const agents = [...plan.agents]
                        agents[index] = { ...agents[index], name: e.target.value }
                        setPlan({ ...plan, agents })
                      }}
                    />
                  </div>
                  <Textarea
                    value={agent.description}
                    onChange={(e) => {
                      const agents = [...plan.agents]
                      agents[index] = { ...agents[index], description: e.target.value }
                      setPlan({ ...plan, agents })
                    }}
                    placeholder="Descrição do agente"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Skills (separadas por vírgula)</Label>
                      <Input
                        value={agent.skills.join(", ")}
                        onChange={(e) => {
                          const agents = [...plan.agents]
                          agents[index] = { ...agents[index], skills: parseCsv(e.target.value) }
                          setPlan({ ...plan, agents })
                        }}
                        placeholder="ex: atendimento, triagem, priorização"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Responsabilidades (1 por linha)</Label>
                      <Textarea
                        value={agent.responsibilities.join("\n")}
                        onChange={(e) => {
                          const agents = [...plan.agents]
                          agents[index] = {
                            ...agents[index],
                            responsibilities: e.target.value
                              .split(/\r?\n/)
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }
                          setPlan({ ...plan, agents })
                        }}
                        className="min-h-20"
                        placeholder={"Ex:\n- Classificar casos\n- Escalar quando necessário"}
                      />
                    </div>
                  </div>
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
                  onInit={(instance) => {
                    requestAnimationFrame(() => {
                      instance.fitView({ padding: 0.15, maxZoom: 1.25, duration: 150 })
                    })
                  }}
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
              <p className="text-xs text-muted-foreground">
                Este preview é somente leitura. O layout final pode ser ajustado no Editor de Grafo após o time ser criado.
              </p>
            </div>
            <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              Checklist: {(plan.executionChecklist ?? []).join(" • ")}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={saveEdits} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PencilLine className="w-4 h-4 mr-2" />}
                Salvar ajustes
              </Button>
              <Button onClick={executePlan} disabled={isExecuting}>
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
