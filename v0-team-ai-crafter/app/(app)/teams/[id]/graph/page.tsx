"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, Images, Info, MessageSquareCode, Save, Plus, Radio, Database, RadioReceiver } from "lucide-react"
import { AgentWhitebeardIcon } from "@/components/brand/agent-whitebeard-icon"
import { GraphCanvas } from "@/components/graph/graph-canvas"
import { TeamDebugConsole } from "@/components/teams/team-debug-console"
import type { Agent, Channel, Team, TeamDebugLiveMirrorLine, TeamGraphLiveAgentState } from "@/lib/types"
import { ApiError, createApiClient } from "@/lib/api/client"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import type { Edge, Node } from "@xyflow/react"
import { stripDerivedGraphEdges } from "@/lib/graph-derived-edges"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { GraphLegendInline, GraphLegendPopover } from "@/components/graph/graph-legend"

function inboundChannelLabel(channel: string): string {
  const m: Record<string, string> = {
    telegram: "Telegram",
    slack: "Slack",
    discord: "Discord",
    teams: "Teams",
    gchat: "Google Chat",
    github: "GitHub",
    linear: "Linear",
    whatsapp: "WhatsApp",
  }
  return m[channel] ?? channel
}

export default function GraphEditorPage({
  params: _params,
}: {
  params: Promise<{ id: string }>
}) {
  const params = useParams<{ id: string }>()
  const id = params.id
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [team, setTeam] = useState<Team | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [graph, setGraph] = useState<{ nodes: unknown[]; edges: unknown[] }>({ nodes: [], edges: [] })
  const [graphDraft, setGraphDraft] = useState<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] })
  const [saving, setSaving] = useState(false)
  const [liveMode, setLiveMode] = useState(false)
  const [liveSheetOpen, setLiveSheetOpen] = useState(false)
  const [liveAgentState, setLiveAgentState] = useState<Record<string, TeamGraphLiveAgentState>>({})
  const [liveMirrorLines, setLiveMirrorLines] = useState<TeamDebugLiveMirrorLine[]>([])
  const [liveMirrorStreamText, setLiveMirrorStreamText] = useState("")

  const removeResolveRef = useRef<((value: boolean) => void) | null>(null)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [removeDialogCopy, setRemoveDialogCopy] = useState({ title: "", description: "" })

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
    if (liveMode) setLiveSheetOpen(true)
    else setLiveSheetOpen(false)
  }, [liveMode])

  useEffect(() => {
    if (!liveMode) {
      setLiveMirrorLines([])
      setLiveMirrorStreamText("")
    }
  }, [liveMode])

  /** Grafo + espelho consola: GET /teams/:id/live (inbound + runs manuais via bus). */
  useEffect(() => {
    if (!liveMode || !api) return
    const ac = new AbortController()
    void api
      .streamTeamLive(
        id,
        {
          onInboundUserMessage: (d) => {
            setLiveMirrorStreamText("")
            setLiveMirrorLines((prev) => [
              ...prev,
              {
                role: "user",
                content: d.text,
                sourceLabel: inboundChannelLabel(d.channel),
              },
            ])
          },
          onCoordinatorDelta: (payload) => {
            if (payload.source !== "inbound") return
            setLiveMirrorStreamText((prev) => prev + payload.text)
          },
          onAgentStatus: (e) => {
            setLiveAgentState((prev) => ({
              ...prev,
              [e.agentId]: {
                status: e.status,
                phase: e.phase,
                lastActivity: e.detail ?? e.phase,
              },
            }))
          },
          onRunComplete: (data) => {
            if (data.source === "inbound") {
              const er = data.externalResponse
              const text = er?.text?.trim() || "(sem texto)"
              setLiveMirrorStreamText("")
              setLiveMirrorLines((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: text,
                  sourceLabel: "Resposta (inbound)",
                  format: er?.format,
                },
              ])
            }
            window.setTimeout(() => setLiveAgentState({}), 3200)
          },
        },
        ac.signal,
      )
      .catch(() => {
        /* abort ou rede */
      })
    return () => ac.abort()
  }, [liveMode, api, id])

  const loadGraphData = useCallback(async () => {
    if (!api) return
    try {
      const [teamRes, agentsRes, channelsRes, graphRes] = await Promise.all([
        api.get<Team>(`/teams/${id}`),
        api.get<Agent[]>("/agents?page=1&perPage=100"),
        api.get<Channel[]>("/channels"),
        api.get<{ nodes: unknown[]; edges: unknown[] }>(`/teams/${id}/graph`),
      ])

      setTeam(teamRes.data)
      setAgents(agentsRes.data)
      setChannels(channelsRes.data)
      setGraph(graphRes.data)
    } catch {
      toast.error("Falha ao carregar dados do grafo")
    }
  }, [api, id])

  useEffect(() => {
    void loadGraphData()
  }, [loadGraphData])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadGraphData()
    }
    const onFocus = () => {
      void loadGraphData()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onFocus)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onFocus)
    }
  }, [loadGraphData])

  const handleSaveGraph = async () => {
    if (!api || !team) return
    setSaving(true)
    try {
      const edgesToPersist = stripDerivedGraphEdges(graphDraft.edges)
      await api.put(`/teams/${id}/graph`, {
        nodes: graphDraft.nodes,
        edges: edgesToPersist,
      })
      const graphRes = await api.get<{ nodes: unknown[]; edges: unknown[] }>(`/teams/${id}/graph`)
      setGraph(graphRes.data)
      toast.success("Grafo salvo com sucesso")
    } catch {
      toast.error("Falha ao salvar grafo")
    } finally {
      setSaving(false)
    }
  }

  const finishRemoveDialog = useCallback((value: boolean) => {
    removeResolveRef.current?.(value)
    removeResolveRef.current = null
    setRemoveDialogOpen(false)
  }, [])

  const askRemoveConfirm = useCallback((title: string, description: string) => {
    return new Promise<boolean>((resolve) => {
      removeResolveRef.current = resolve
      setRemoveDialogCopy({ title, description })
      setRemoveDialogOpen(true)
    })
  }, [])

  const handleTeamEntityRemove = useCallback(
    async (ctx: { node: Node; nodes: Node[]; edges: Edge[] }) => {
      if (!api || !team) {
        toast.error("Sessao ou time indisponivel")
        return { ok: false, message: "Sessao ou time indisponivel" }
      }

      const { node, nodes, edges } = ctx

      if (node.type === "coordinator") {
        const msg =
          "O coordenador nao pode ser removido pelo grafo. Altere o coordenador na ficha do time antes."
        toast.error(msg)
        return { ok: false, message: msg }
      }

      if (node.type === "specialist") {
        const agentId = String((node.data as { agentId?: string }).agentId ?? node.id)

        const label = String((node.data as { label?: string }).label ?? agentId)
        const ok = await askRemoveConfirm(
          "Remover especialista do time?",
          `O agente "${label}" sera retirado da composicao do time (agentIds) e o grafo guardado sera atualizado sem este no. Esta acao persiste imediatamente.`,
        )
        if (!ok) {
          return { ok: false, message: "Cancelado" }
        }

        try {
          const nextNodes = nodes.filter((n) => n.id !== node.id)
          const nextEdges = edges.filter((e) => e.source !== node.id && e.target !== node.id)
          const edgesToPersist = stripDerivedGraphEdges(nextEdges)
          const nextAgentIds = team.agentIds.filter((aid) => aid !== agentId)

          await api.put(`/teams/${id}`, { agentIds: nextAgentIds })
          await api.put(`/teams/${id}/graph`, { nodes: nextNodes, edges: edgesToPersist })
          await loadGraphData()
          toast.success("Agente removido do time e grafo atualizados")
          return { ok: true }
        } catch (e) {
          const msg = e instanceof ApiError ? e.message : "Falha ao remover agente do time"
          toast.error(msg)
          return { ok: false, message: msg }
        }
      }

      if (node.type === "channel") {
        const channelId = String((node.data as { channelId?: string }).channelId ?? node.id)
        const label = String((node.data as { label?: string }).label ?? channelId)

        const ok = await askRemoveConfirm(
          "Remover canal do time?",
          `O canal "${label}" sera retirado da composicao do time (channelIds) e o grafo guardado sera atualizado. Confirma?`,
        )
        if (!ok) {
          return { ok: false, message: "Cancelado" }
        }

        try {
          const nextNodes = nodes.filter((n) => n.id !== node.id)
          const nextEdges = edges.filter((e) => e.source !== node.id && e.target !== node.id)
          const edgesToPersist = stripDerivedGraphEdges(nextEdges)
          const nextChannelIds = team.channelIds.filter((cid) => cid !== channelId)

          await api.put(`/teams/${id}`, { channelIds: nextChannelIds })
          await api.put(`/teams/${id}/graph`, { nodes: nextNodes, edges: edgesToPersist })
          await loadGraphData()
          toast.success("Canal removido do time e grafo atualizados")
          return { ok: true }
        } catch (e) {
          const msg = e instanceof ApiError ? e.message : "Falha ao remover canal do time"
          toast.error(msg)
          return { ok: false, message: msg }
        }
      }

      return { ok: false, message: "Tipo de no nao suportado" }
    },
    [api, askRemoveConfirm, id, loadGraphData, team],
  )

  if (!team) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] min-h-0">
      <AlertDialog
        open={removeDialogOpen}
        onOpenChange={(open) => {
          if (!open) finishRemoveDialog(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{removeDialogCopy.title}</AlertDialogTitle>
            <AlertDialogDescription>{removeDialogCopy.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                finishRemoveDialog(true)
              }}
            >
              Confirmar remocao
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/teams/${team.id}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
          <Link href={`/teams/${team.id}/gallery`}>
            <Button type="button" variant="outline" size="sm" className="gap-1.5">
              <Images className="w-4 h-4" />
              Galeria
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Editor de Grafo: {team.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Coordenador liga-se aos especialistas e aos canais do time. Especialistas não são porta de entrada ou
              saída externa.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5">
            <Switch
              id="graph-live-mode"
              checked={liveMode}
              onCheckedChange={(v) => {
                setLiveMode(v)
                if (!v) {
                  setLiveAgentState({})
                  setLiveSheetOpen(false)
                }
              }}
            />
            <Label htmlFor="graph-live-mode" className="flex items-center gap-1.5 text-sm cursor-pointer">
              <RadioReceiver className="w-4 h-4 text-primary" />
              Live
            </Label>
            {liveMode ? (
              <Badge variant="secondary" className="text-xs">
                SSE
              </Badge>
            ) : null}
          </div>
          {liveMode && api && !liveSheetOpen ? (
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setLiveSheetOpen(true)}>
              <MessageSquareCode className="w-4 h-4" />
              Console
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                Adicionar Nó
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <AgentWhitebeardIcon className="w-4 h-4 mr-2" />
                Agente Especialista
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Radio className="w-4 h-4 mr-2" />
                Canal
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Database className="w-4 h-4 mr-2" />
                Base de Conhecimento
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button className="gap-2" onClick={handleSaveGraph} disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 gap-3">
        {/* Legend: compact when Live to maximize graph height */}
        {liveMode ? <GraphLegendPopover /> : <GraphLegendInline />}

        {team.channelIds.length === 0 && (
          <Alert className="shrink-0 border-warning/50 bg-warning/5 py-3">
            <Info className="h-4 w-4" />
            <AlertTitle className="text-sm">Nenhum canal associado a este time</AlertTitle>
            <AlertDescription className={liveMode ? "text-xs leading-snug" : "space-y-2"}>
              {liveMode ? (
                <p>
                  <Link href={`/teams/${team.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                    Ficha do time → Canais
                  </Link>{" "}
                  para associar canais.
                </p>
              ) : (
                <>
                  <p>
                    Os nós de canal no grafo vêm da composição do time: cada id em{" "}
                    <code className="text-xs bg-muted px-1 rounded">channelIds</code> que exista em GET{" "}
                    <code className="text-xs bg-muted px-1 rounded">/channels</code> gera um nó. Tipos de canal na ficha do
                    coordenador não preenchem isto sozinhos.
                  </p>
                  <p>
                    <Link
                      href={`/teams/${team.id}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Abrir ficha do time → tab Canais
                    </Link>{" "}
                    para selecionar canais do workspace.
                  </p>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {liveMode ? (
          <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 shrink-0 text-primary" />
            <span>
              Com Live, as mensagens passam pelo coordenador; o grafo mostra atividade por agente.
            </span>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="link" className="h-auto p-0 text-xs text-primary">
                  Ler mais
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 text-xs" align="start">
                <p className="text-muted-foreground leading-relaxed">
                  Os canais do time ligam-se sempre ao <strong className="text-foreground">coordenador</strong> (linha
                  verde mais espessa). O layout padrão empilha canais acima, coordenador no meio e especialistas abaixo.
                  Ao gravar o grafo, arestas entre canal e agente devem ligar ao nó do coordenador. O backend rejeita
                  layout inválido ao salvar.
                </p>
              </PopoverContent>
            </Popover>
          </div>
        ) : (
          <Alert className="shrink-0">
            <Info className="h-4 w-4" />
            <AlertTitle>Canais e coordenador</AlertTitle>
            <AlertDescription>
              Os canais do time ligam-se sempre ao <strong>coordenador</strong> (linha verde mais espessa, com setas
              nas duas pontas só no desenho — entrada e saída de mensagens passam pelo coordenador). O layout padrão
              empilha <strong>canais acima</strong>, coordenador no meio e especialistas abaixo. Ao gravar o grafo,
              arestas persistidas entre canal e agente devem ligar ao nó do coordenador. O backend rejeita layout
              inválido ao salvar.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex-1 min-h-0 rounded-lg border border-border overflow-hidden">
          <GraphCanvas
            team={team}
            agents={agents}
            channels={channels}
            initialGraph={graph}
            onGraphChange={setGraphDraft}
            onTeamEntityRemove={handleTeamEntityRemove}
            liveAgentState={liveMode ? liveAgentState : {}}
          />
        </div>
      </div>

      {api ? (
        <Sheet
          open={liveMode && liveSheetOpen}
          onOpenChange={(open) => {
            if (!liveMode) return
            setLiveSheetOpen(open)
          }}
        >
          <SheetContent
            side="right"
            className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md [&>button]:top-3"
          >
            <SheetHeader className="space-y-1 border-b border-border px-4 py-3 text-left">
              <SheetTitle className="text-base">Console em tempo real</SheetTitle>
              <SheetDescription className="text-xs leading-relaxed">
                <code className="rounded bg-muted px-1 py-0.5 text-[10px]">GET /teams/:id/live</code> atualiza o grafo
                com <strong>agentStatus</strong> (Telegram e consola). O chat usa{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[10px]">POST /teams/:id/run/stream</code>.
              </SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 pt-2">
              <TeamDebugConsole
                teamId={id}
                api={api}
                coordinatorLabel={agents.find((a) => a.id === team.coordinatorId)?.name}
                useStreamRun
                useHttpRun={false}
                liveMirrorLines={liveMirrorLines}
                liveMirrorStreamText={liveMirrorStreamText}
                variant="compact"
                hideHeader
                className="flex min-h-0 flex-1"
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  )
}
