"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  Radio,
  GitBranch,
  Images,
  Edit,
  Power,
  Crown,
  Clock,
  Calendar,
  MessageSquareCode,
  ShieldCheck,
  LayoutDashboard,
} from "lucide-react"
import { ContextualTourHost, ContextualTourManualTrigger } from "@/components/onboarding/contextual-tour"
import { AgentWhitebeardIcon } from "@/components/brand/agent-whitebeard-icon"
import type { Agent, Channel, ChannelType, Team, TeamReadinessResult, TeamRunRecord } from "@/lib/types"
import { channelTypeLabels, channelStatusLabels } from "@/lib/constants/channel-labels"
import { createApiClient } from "@/lib/api/client"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import { formatCategoryLabel } from "@/lib/utils/agent-category"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TeamDebugConsole } from "@/components/teams/team-debug-console"

const statusColors = {
  active: "bg-success/10 text-success border-success/20",
  draft: "bg-warning/10 text-warning border-warning/20",
  inactive: "bg-muted text-muted-foreground border-muted",
}

const statusLabels = {
  active: "Ativo",
  draft: "Rascunho",
  inactive: "Inativo",
}

function TeamAgentDigestMeta({
  agent,
  showCoordinatorChannelTypes,
}: {
  agent: Partial<Agent>
  showCoordinatorChannelTypes: boolean
}) {
  const version = typeof agent.version === "string" ? agent.version.trim() : ""
  const category = typeof agent.category === "string" ? agent.category.trim() : ""
  const skills = agent.skills ?? []
  const channelTypes = (agent.channels ?? []) as ChannelType[]

  return (
    <div className="mt-2 space-y-2.5 text-sm">
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <div>
          <p className="text-xs text-muted-foreground">Versão</p>
          <p className="font-medium tabular-nums">{version || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Categoria</p>
          <p className="font-medium">{category ? formatCategoryLabel(category) : "—"}</p>
        </div>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">Skills</p>
        <div className="flex flex-wrap gap-1">
          {skills.length > 0 ? (
            skills.map((s) => (
              <Badge key={s} variant="secondary" className="text-xs font-normal">
                {s}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </div>
      </div>
      {showCoordinatorChannelTypes && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Canais (tipos do agente)</p>
          <p className="text-xs text-muted-foreground mb-1.5 leading-relaxed">
            Instâncias (webhooks Chat SDK) configuram-se em{" "}
            <Link href="/channels" className="text-primary underline-offset-4 hover:underline">
              Canais
            </Link>{" "}
            e neste time na tab Canais.
          </p>
          <div className="flex flex-wrap gap-1">
            {channelTypes.length > 0 ? (
              channelTypes.map((c) => (
                <Badge key={c} variant="outline" className="text-xs font-normal">
                  {channelTypeLabels[c] ?? c}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function TeamDetailsPage({
  params: _params,
}: {
  params: Promise<{ id: string }>
}) {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = params.id
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [team, setTeam] = useState<(Team & { coordinator?: Partial<Agent>; agents?: Agent[]; channels?: Channel[] }) | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  const [workspaceChannels, setWorkspaceChannels] = useState<Channel[]>([])
  const [channelsLoading, setChannelsLoading] = useState(false)
  const [channelDraftIds, setChannelDraftIds] = useState<string[]>([])
  const [savingChannelIds, setSavingChannelIds] = useState(false)
  const [runs, setRuns] = useState<TeamRunRecord[]>([])
  const [readiness, setReadiness] = useState<TeamReadinessResult | null>(null)
  const [readinessLoading, setReadinessLoading] = useState(false)
  const [mainTab, setMainTab] = useState("overview")

  const TEAM_PAGE_TAB_VALUES = ["overview", "agents", "channels", "runs", "debug"] as const

  useEffect(() => {
    const t = searchParams.get("tab")
    if (t && (TEAM_PAGE_TAB_VALUES as readonly string[]).includes(t)) {
      setMainTab(t)
    }
  }, [searchParams])

  const debugApi = useMemo(() => {
    if (!token || !currentWorkspace) return null
    return createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
  }, [token, refreshToken, currentWorkspace])

  useEffect(() => {
    if (!token || !currentWorkspace) return
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
    void (async () => {
      const res = await api.get<any>(`/teams/${id}`)
      setTeam(res.data)
      const runsRes = await api.get<TeamRunRecord[]>(`/teams/${id}/runs`)
      setRuns(runsRes.data)
      setReadinessLoading(true)
      try {
        const rd = await api.get<TeamReadinessResult>(`/teams/${id}/readiness`)
        setReadiness(rd.data)
      } catch {
        setReadiness(null)
      } finally {
        setReadinessLoading(false)
      }
    })()
  }, [token, refreshToken, currentWorkspace, id])

  const editFromQuery = searchParams.get("edit")
  useEffect(() => {
    if (!team) return
    if (editFromQuery !== "1" && editFromQuery !== "true") return
    setEditName(team.name)
    setEditDescription(team.description ?? "")
    setEditOpen(true)
    router.replace(`/teams/${id}`, { scroll: false })
  }, [team, editFromQuery, id, router])

  const teamChannelIdsKey =
    team && `${team.id}:${[...team.channelIds].sort().join(",")}`

  useEffect(() => {
    if (!team) return
    setChannelDraftIds([...team.channelIds])
    // team.channelIds snapshot encoded in teamChannelIdsKey
  }, [team, teamChannelIdsKey])

  useEffect(() => {
    if (!token || !currentWorkspace) return
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
    setChannelsLoading(true)
    void (async () => {
      try {
        const res = await api.get<Channel[]>("/channels")
        setWorkspaceChannels(res.data)
      } catch {
        toast.error("Falha ao carregar canais do workspace")
      } finally {
        setChannelsLoading(false)
      }
    })()
  }, [token, refreshToken, currentWorkspace])

  const teamChannels = useMemo((): Channel[] => {
    if (!team) return []
    return ((team as { channels?: Channel[] }).channels ?? []) as Channel[]
  }, [team])

  const lastRun = useMemo(() => {
    if (runs.length === 0) return null
    return [...runs].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0]
  }, [runs])

  const channelCockpit = useMemo(() => {
    const total = teamChannels.length
    const connected = teamChannels.filter((c) => c.status === "connected").length
    const notConnected = teamChannels.filter((c) => c.status !== "connected")
    return { total, connected, notConnected }
  }, [teamChannels])

  const agentDisplayNamesForDebug = useMemo(() => {
    const m: Record<string, string> = {}
    if (!team) return m
    const agents = (team as Team & { agents?: Agent[] }).agents
    if (!agents) return m
    for (const a of agents) {
      if (a.id && a.name) m[a.id] = a.name
    }
    return m
  }, [team])

  const cockpitPriorities = useMemo(() => {
    if (!readiness?.items?.length) return [] as TeamReadinessResult["items"]
    const rank: Record<string, number> = { blocked: 0, attention: 1, info: 2 }
    return [...readiness.items]
      .sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9))
      .slice(0, 4)
  }, [readiness])

  if (!team) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  const coordinator = (team as any).coordinator as Partial<Agent> | undefined
  const specialists = ((team as any).agents as Agent[] | undefined) ?? []
  const channels = teamChannels

  const createdAt = format(new Date(team.createdAt), "dd 'de' MMMM 'de' yyyy", {
    locale: ptBR,
  })
  const updatedAt = format(new Date(team.updatedAt), "dd 'de' MMMM 'de' yyyy", {
    locale: ptBR,
  })

  const buildApiClient = () => {
    if (!token || !currentWorkspace) return null
    return createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
  }

  const handleOpenEdit = () => {
    setEditName(team.name)
    setEditDescription(team.description ?? "")
    setEditOpen(true)
  }

  const handleSaveEdit = async () => {
    const api = buildApiClient()
    if (!api) return
    setSavingEdit(true)
    try {
      const updated = await api.put<Team>(`/teams/${team.id}`, {
        name: editName.trim(),
        description: editDescription.trim(),
      })
      setTeam((prev) => (prev ? { ...prev, ...updated.data } : prev))
      toast.success("Time atualizado com sucesso")
      setEditOpen(false)
    } catch {
      toast.error("Falha ao atualizar time")
    } finally {
      setSavingEdit(false)
    }
  }

  const handleStatusChange = async () => {
    const api = buildApiClient()
    if (!api) return
    setChangingStatus(true)
    try {
      const nextStatusAction = team.status === "active" ? "deactivate" : "activate"
      const nextStatus = team.status === "active" ? "inactive" : "active"
      await api.post(`/teams/${team.id}/${nextStatusAction}`)
      setTeam((prev) => (prev ? { ...prev, status: nextStatus } : prev))
      toast.success(nextStatus === "active" ? "Time ativado" : "Time desativado")
    } catch {
      toast.error("Falha ao alterar status do time")
    } finally {
      setChangingStatus(false)
    }
  }

  const handleSaveChannelIds = async () => {
    const api = buildApiClient()
    if (!api || !team) return
    setSavingChannelIds(true)
    try {
      await api.put<Team>(`/teams/${team.id}`, { channelIds: channelDraftIds })
      const res = await api.get<(Team & { channels?: Channel[] })>(`/teams/${team.id}`)
      setTeam(res.data)
      toast.success("Composicao de canais do time atualizada")
    } catch {
      toast.error("Falha ao guardar canais do time")
    } finally {
      setSavingChannelIds(false)
    }
  }

  return (
    <div className="space-y-6">
      <ContextualTourHost screenKey="team_detail" />
      {/* Back Link */}
      <Link
        href="/teams"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para Times
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{team.name}</h1>
            <Badge variant="outline" className={statusColors[team.status]}>
              {statusLabels[team.status]}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">{team.description}</p>
        </div>
        <div className="-mx-1 flex max-w-full flex-wrap items-center gap-2 px-1 sm:mx-0 sm:justify-end sm:px-0">
          <ContextualTourManualTrigger screenKey="team_detail" />
          <Link href={`/teams/${team.id}/gallery`}>
            <Button variant="outline" className="gap-2">
              <Images className="w-4 h-4" />
              Galeria
            </Button>
          </Link>
          <Link href={`/teams/${team.id}/graph`}>
            <Button variant="outline" className="gap-2">
              <GitBranch className="w-4 h-4" />
              Editar Grafo
            </Button>
          </Link>
          <Button variant="outline" className="gap-2" onClick={handleOpenEdit}>
            <Edit className="w-4 h-4" />
            Editar
          </Button>
          {team.status === "active" ? (
            <Button variant="outline" className="gap-2 text-warning" onClick={handleStatusChange} disabled={changingStatus}>
              <Power className="w-4 h-4" />
              {changingStatus ? "Desativando..." : "Desativar"}
            </Button>
          ) : (
            <Button className="gap-2" onClick={handleStatusChange} disabled={changingStatus}>
              <Power className="w-4 h-4" />
              {changingStatus ? "Ativando..." : "Ativar"}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab}>
        <div className="-mx-1 w-full overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] lg:mx-0 lg:overflow-visible lg:pb-0">
          <TabsList className="inline-flex h-auto min-h-10 w-max gap-1 bg-secondary p-1 lg:grid lg:h-auto lg:w-full lg:grid-cols-5 lg:gap-1">
            <TabsTrigger value="overview" className="shrink-0">
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="agents" className="shrink-0">
              Agentes
            </TabsTrigger>
            <TabsTrigger value="channels" className="shrink-0">
              Canais
            </TabsTrigger>
            <TabsTrigger value="runs" className="shrink-0">
              Execução
            </TabsTrigger>
            <TabsTrigger value="debug" className="gap-1.5 shrink-0">
              <MessageSquareCode className="w-3.5 h-3.5" />
              Console
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          <Card
            className={`border-border bg-card ${
              readiness?.level === "blocked"
                ? "border-destructive/40"
                : readiness?.level === "attention"
                  ? "border-warning/40"
                  : ""
            }`}
          >
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Prontidão operacional</CardTitle>
                    <CardDescription className="mt-0.5">
                      {readinessLoading
                        ? "A avaliar configuração do time…"
                        : readiness?.headline ?? "Indisponível — tente recarregar a página."}
                    </CardDescription>
                  </div>
                </div>
                {!readinessLoading && readiness ? (
                  <Badge
                    variant="outline"
                    className={
                      readiness.level === "ready"
                        ? "border-success/30 bg-success/10 text-success"
                        : readiness.level === "attention"
                          ? "border-warning/30 bg-warning/10 text-warning"
                          : "border-destructive/30 bg-destructive/10 text-destructive"
                    }
                  >
                    {readiness.level === "ready"
                      ? "Pronto"
                      : readiness.level === "attention"
                        ? "Atenção"
                        : "Bloqueado"}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            {readiness && !readinessLoading && readiness.items.length === 0 ? (
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">Sem pendências na verificação actual.</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Verificado em{" "}
                  {format(new Date(readiness.checkedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </CardContent>
            ) : null}
            {readiness && !readinessLoading && readiness.items.length > 0 ? (
              <CardContent className="space-y-3 pt-0">
                <ul className="space-y-3">
                  {readiness.items.map((item, idx) => (
                    <li
                      key={`${item.code}-${idx}`}
                      className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-sm"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium">{item.title}</span>
                        <Badge
                          variant="outline"
                          className={
                            item.severity === "blocked"
                              ? "border-destructive/30 text-destructive"
                              : item.severity === "attention"
                                ? "border-warning/30 text-warning"
                                : "text-muted-foreground"
                          }
                        >
                          {item.severity === "blocked"
                            ? "Bloqueio"
                            : item.severity === "attention"
                              ? "Atenção"
                              : "Info"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">{item.detail}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Próximo passo:</span> {item.nextStep}
                      </p>
                      {item.routeHint ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button variant="secondary" size="sm" asChild>
                            <Link href={item.routeHint}>{item.ctaLabel ?? "Resolver agora"}</Link>
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Verificado em{" "}
                  {format(new Date(readiness.checkedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </CardContent>
            ) : null}
          </Card>

          {/* Loop 90 — cockpit: última atividade, canais, prioridades, atalhos */}
          <Card className="border-border bg-card border-dashed">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start gap-3">
                <div className="rounded-lg bg-accent/10 p-2">
                  <LayoutDashboard className="h-5 w-5 text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg">Cockpit operacional</CardTitle>
                  <CardDescription className="mt-0.5">
                    Última actividade, canais e atalhos para testar ou corrigir — sem substituir as abas abaixo.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-secondary/20 px-3 py-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Última run</p>
                  {lastRun ? (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={lastRun.status === "completed" ? "secondary" : "outline"}>{lastRun.status}</Badge>
                        <Badge variant="outline">{lastRun.source}</Badge>
                        {lastRun.channel ? <Badge variant="outline">{lastRun.channel}</Badge> : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(lastRun.startedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        {lastRun.finishedAt
                          ? ` → ${format(new Date(lastRun.finishedAt), "HH:mm", { locale: ptBR })}`
                          : ""}
                      </p>
                      <button
                        type="button"
                        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                        onClick={() => setMainTab("runs")}
                      >
                        Abrir histórico de execução
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Ainda não há runs persistidas para este time.</p>
                  )}
                </div>
                <div className="rounded-lg border border-border bg-secondary/20 px-3 py-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Canais no time</p>
                  {channelCockpit.total === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Nenhum canal associado. Ligue instâncias em{" "}
                      <button
                        type="button"
                        className="font-medium text-primary underline-offset-4 hover:underline"
                        onClick={() => setMainTab("channels")}
                      >
                        Canais
                      </button>{" "}
                      para receber tráfego externo.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      <p className="text-2xl font-semibold tabular-nums">
                        {channelCockpit.connected}/{channelCockpit.total}
                        <span className="text-sm font-normal text-muted-foreground"> ligados</span>
                      </p>
                      {channelCockpit.notConnected.length > 0 ? (
                        <p className="text-sm text-warning">
                          {channelCockpit.notConnected.length} canal(is) não estão em estado ligado.
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Todos os canais associados estão ligados.</p>
                      )}
                      <button
                        type="button"
                        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                        onClick={() => setMainTab("channels")}
                      >
                        Gerir canais do time
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {(cockpitPriorities.length > 0 || !coordinator) && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    O que resolver agora
                  </p>
                  <ul className="space-y-2">
                    {!coordinator ? (
                      <li className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="outline" className="shrink-0 border-destructive/40 text-destructive">
                          Bloqueio
                        </Badge>
                        <span className="text-muted-foreground">
                          Coordenador em falta — corrija na ficha do time ou em Agentes.
                        </span>
                        <Button variant="secondary" size="sm" asChild>
                          <Link href={`/teams/${team.id}?tab=agents`}>Escolher coordenador</Link>
                        </Button>
                      </li>
                    ) : null}
                    {cockpitPriorities.map((item, idx) => (
                      <li key={`${item.code}-${idx}`} className="flex flex-wrap items-start gap-2 text-sm">
                        <Badge
                          variant="outline"
                          className={
                            item.severity === "blocked"
                              ? "shrink-0 border-destructive/40 text-destructive"
                              : item.severity === "attention"
                                ? "shrink-0 border-warning/40 text-warning"
                                : "shrink-0"
                          }
                        >
                          {item.severity === "blocked" ? "Bloqueio" : item.severity === "attention" ? "Atenção" : "Info"}
                        </Badge>
                        <span className="flex flex-1 flex-wrap items-center gap-2 text-muted-foreground">
                          <span className="font-medium text-foreground">{item.title}</span>
                          {item.routeHint ? (
                            <Button variant="secondary" size="sm" className="h-7 text-xs" asChild>
                              <Link href={item.routeHint}>{item.ctaLabel ?? "Resolver"}</Link>
                            </Button>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => setMainTab("debug")}>
                  <MessageSquareCode className="h-3.5 w-3.5" />
                  Testar no console
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setMainTab("runs")}>
                  Execução
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setMainTab("channels")}>
                  Canais
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href={`/teams/${team.id}/graph`}>Editor de grafo</Link>
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href="/runs">Todas as runs</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <AgentWhitebeardIcon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {specialists.length + 1}
                    </p>
                    <p className="text-sm text-muted-foreground">Agentes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-accent/10">
                    <Radio className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{channels.length}</p>
                    <p className="text-sm text-muted-foreground">Canais</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-secondary">
                    <Calendar className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{createdAt}</p>
                    <p className="text-sm text-muted-foreground">Criado em</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-secondary">
                    <Clock className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{updatedAt}</p>
                    <p className="text-sm text-muted-foreground">Atualizado em</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coordinator Card */}
          {coordinator && (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Crown className="w-5 h-5 text-warning" />
                  Coordenador
                </CardTitle>
                <CardDescription>
                  Agente responsável por gerenciar o fluxo de trabalho
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-4 p-4 rounded-lg bg-secondary/50">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Crown className="w-6 h-6 text-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold">{coordinator.name}</h4>
                    {coordinator.description ? (
                      <p className="text-sm text-muted-foreground mt-1">{coordinator.description}</p>
                    ) : null}
                    <TeamAgentDigestMeta agent={coordinator} showCoordinatorChannelTypes />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="mt-6 space-y-6">
          {/* Coordinator */}
          {coordinator && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Coordenador
              </h3>
              <Card className="border-border bg-card">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Crown className="w-6 h-6 text-warning" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold">{coordinator.name}</h4>
                      {coordinator.description ? (
                        <p className="text-sm text-muted-foreground mt-1">{coordinator.description}</p>
                      ) : null}
                      <TeamAgentDigestMeta agent={coordinator} showCoordinatorChannelTypes />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Specialists */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Especialistas ({specialists.length})
            </h3>
            {specialists.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {specialists.map((agent) => (
                  <Card key={agent.id} className="border-border bg-card">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                          <AgentWhitebeardIcon className="w-5 h-5 text-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium">{agent.name}</h4>
                          {agent.description ? (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{agent.description}</p>
                          ) : null}
                          <TeamAgentDigestMeta agent={agent} showCoordinatorChannelTypes={false} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum especialista adicionado
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="debug" className="mt-6 space-y-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg">Teste local do runtime</CardTitle>
              <CardDescription>
                Mensagens usam <code className="text-xs bg-muted px-1 rounded">POST /teams/:id/run</code> com o mesmo
                motor do coordenador (OpenAI Agents SDK) que os webhooks Chat SDK. Útil para validar prompts e
                ferramentas antes de publicar em canais externos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {debugApi ? (
                <TeamDebugConsole
                  teamId={team.id}
                  api={debugApi}
                  coordinatorAgentId={team.coordinatorId}
                  coordinatorLabel={coordinator?.name}
                  agentDisplayNames={agentDisplayNamesForDebug}
                  useHttpRun
                />
              ) : (
                <p className="text-sm text-muted-foreground">Inicie sessão com um workspace para usar o console.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runs" className="mt-6 space-y-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg">Runs persistidas</CardTitle>
              <CardDescription>
                Histórico operacional do time para inspeção rápida, replay manual e auditoria básica.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma run persistida ainda para este time.</p>
              ) : (
                runs.map((run) => (
                  <div key={run.runId} className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{run.source}</Badge>
                      <Badge variant={run.status === "completed" ? "secondary" : "outline"}>{run.status}</Badge>
                      <Badge variant="outline">{run.channel || "debug"}</Badge>
                    </div>
                    <div className="text-sm">
                      <p className="font-medium">{run.runId}</p>
                      <p className="text-muted-foreground">
                        Início: {format(new Date(run.startedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        {run.finishedAt
                          ? ` · Fim: ${format(new Date(run.finishedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}`
                          : ""}
                      </p>
                    </div>
                    {run.externalResponse?.text ? (
                      <p className="text-sm text-muted-foreground line-clamp-3">{run.externalResponse.text}</p>
                    ) : run.error?.message ? (
                      <p className="text-sm text-destructive">{run.error.message}</p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Channels Tab — composição do time (channelIds); grafo usa esta lista + GET /channels */}
        <TabsContent value="channels" className="mt-6 space-y-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg">Canais associados ao time</CardTitle>
              <CardDescription>
                Marque os canais do workspace que fazem parte deste time. O editor de grafo mostra um nó por canal
                selecionado (ligado ao coordenador). Isto não altera apenas os &quot;tipos&quot; de canal na ficha do
                agente coordenador.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {channelsLoading ? (
                <p className="text-sm text-muted-foreground">A carregar canais do workspace...</p>
              ) : workspaceChannels.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Não existem canais no workspace. Crie canais na área de Canais antes de os associar aqui.
                </p>
              ) : (
                <div className="space-y-3">
                  {workspaceChannels.map((ch) => {
                    const checked = channelDraftIds.includes(ch.id)
                    return (
                      <Label
                        key={ch.id}
                        className={`flex items-center justify-between gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                          checked ? "border-success bg-success/5" : "border-border bg-secondary/50 hover:bg-secondary"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              if (v) {
                                setChannelDraftIds((prev) => [...prev, ch.id])
                              } else {
                                setChannelDraftIds((prev) => prev.filter((id) => id !== ch.id))
                              }
                            }}
                          />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{ch.name}</p>
                            <p className="text-sm text-muted-foreground">{channelTypeLabels[ch.type]}</p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            ch.status === "connected"
                              ? "shrink-0 bg-success/10 text-success border-success/20"
                              : "shrink-0 bg-muted text-muted-foreground"
                          }
                        >
                          {channelStatusLabels[ch.status]}
                        </Badge>
                      </Label>
                    )
                  })}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  type="button"
                  onClick={() => void handleSaveChannelIds()}
                  disabled={savingChannelIds || channelsLoading || workspaceChannels.length === 0}
                >
                  {savingChannelIds ? "A guardar..." : "Guardar composicao de canais"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {channelDraftIds.length} selecionado(s) · {channels.length} no time após último guardar
                </span>
              </div>
            </CardContent>
          </Card>

          {channels.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Resumo (guardado)</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {channels.map((channel) => (
                  <Card key={channel.id} className="border-border bg-card">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                            <Radio className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-medium">{channel.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {channelTypeLabels[channel.type]}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            channel.status === "connected"
                              ? "bg-success/10 text-success border-success/20"
                              : "bg-muted text-muted-foreground"
                          }
                        >
                          {channelStatusLabels[channel.status]}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar time</DialogTitle>
            <DialogDescription>Atualize os dados basicos do time.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="team-edit-name">Nome</Label>
              <Input id="team-edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-edit-description">Descricao</Label>
              <Input
                id="team-edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit || !editName.trim()}>
              {savingEdit ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
