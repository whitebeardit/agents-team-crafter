"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { formatDistanceToNow, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowLeft, GitBranch, LayoutGrid, Move, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Agent, Team, TeamConversationTimelineItem, TeamRunRecord } from "@/lib/types"
import { createApiClient } from "@/lib/api/client"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { toast } from "sonner"
import { useTeamLiveTimeline } from "@/lib/live/use-team-live-timeline"
import { applyOfficePositionOverrides, buildOfficeLayout } from "@/lib/office/office-layout"
import { clampOfficePosition } from "@/lib/office/office-visual-constants"
import { mapTimelineItemsToOfficeEvents } from "@/lib/office/office-event-mapper"
import { applyOfficeFocus, layoutToVisualAgents } from "@/lib/office/office-view-model"
import { buildDemoOfficeEvents } from "@/lib/office/office-simulation-fixtures"
import type { AgentOfficeController } from "@/lib/office/office-controller"
import { OFFICE_USER_AGENT_ID, type OfficeEvent } from "@/lib/office/office-types"
import { AgentOfficeOverlay } from "@/components/office/agent-office-overlay"
import { AgentOfficeTimelinePanel } from "@/components/office/agent-office-timeline-panel"
import { AgentOfficeControls, type OfficeMode } from "@/components/office/agent-office-controls"
import { AgentOfficeStatusBar } from "@/components/office/agent-office-status-bar"
import { teamRunSourceLabel, teamRunStatusLabel } from "@/lib/runs-display"

const AgentOfficeGame = dynamic(() => import("@/components/office/agent-office-game"), { ssr: false })

function focusPair(event: OfficeEvent, coordinatorId: string): { from?: string; to?: string } {
  switch (event.type) {
    case "user_message":
      return { from: OFFICE_USER_AGENT_ID, to: coordinatorId }
    case "agent_handoff":
      return { from: event.fromAgentId, to: event.toAgentId }
    case "agent_response":
      return {
        from: event.actorId,
        to: event.toAgentId ?? event.fromAgentId ?? coordinatorId,
      }
    case "agent_thinking":
    case "tool_call":
    case "tool_result":
    case "activity":
    case "error":
      return event.actorId ? { from: event.actorId, to: event.actorId } : {}
    default:
      return event.actorId ? { from: event.actorId, to: event.actorId } : {}
  }
}

function resolveSelectedIndex(mode: OfficeMode, selectedIndex: number, length: number): number {
  if (length === 0) return -1
  if (selectedIndex >= 0 && selectedIndex < length) return selectedIndex
  if (mode === "live") return length - 1
  return Math.max(0, Math.min(selectedIndex, length - 1))
}

export function TeamOfficePageClient() {
  const params = useParams<{ id: string }>()
  const teamId = params.id
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [team, setTeam] = useState<Team | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [mode, setMode] = useState<OfficeMode>("simulation")
  const [replayEvents, setReplayEvents] = useState<OfficeEvent[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<1 | 2 | 4>(1)
  const [agentFilter, setAgentFilter] = useState<string | "all">("all")
  const [teamRuns, setTeamRuns] = useState<TeamRunRecord[]>([])
  const [runsLoading, setRunsLoading] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [layoutOverrides, setLayoutOverrides] = useState<Record<string, { x: number; y: number }>>({})
  const [layoutEditMode, setLayoutEditMode] = useState(false)
  const controllerRef = useRef<AgentOfficeController | null>(null)

  const officeStorageKey = useMemo(() => {
    if (!currentWorkspace?.id) return null
    return `office-agent-positions:${currentWorkspace.id}:${teamId}`
  }, [currentWorkspace?.id, teamId])

  useEffect(() => {
    if (!officeStorageKey) return
    try {
      const raw = localStorage.getItem(officeStorageKey)
      if (!raw) {
        setLayoutOverrides({})
        return
      }
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        setLayoutOverrides(parsed as Record<string, { x: number; y: number }>)
      } else {
        setLayoutOverrides({})
      }
    } catch {
      setLayoutOverrides({})
    }
  }, [officeStorageKey])

  const handleAgentPositionCommit = useCallback(
    (agentId: string, x: number, y: number) => {
      const p = clampOfficePosition(x, y)
      setLayoutOverrides((prev) => {
        const next = { ...prev, [agentId]: p }
        if (officeStorageKey) {
          try {
            localStorage.setItem(officeStorageKey, JSON.stringify(next))
          } catch {
            /* quota */
          }
        }
        return next
      })
    },
    [officeStorageKey],
  )

  const handleResetOfficeLayout = useCallback(() => {
    setLayoutOverrides({})
    if (officeStorageKey) {
      try {
        localStorage.removeItem(officeStorageKey)
      } catch {
        /* ignore */
      }
    }
  }, [officeStorageKey])

  const runsForSelect = useMemo((): TeamRunRecord[] => {
    const list = [...teamRuns]
    if (team && selectedRunId && !list.some((r) => r.runId === selectedRunId)) {
      list.unshift({
        id: selectedRunId,
        runId: selectedRunId,
        teamId: team.id,
        coordinatorAgentId: team.coordinatorId,
        trigger: "sync",
        source: "manual",
        status: "running",
        startedAt: new Date().toISOString(),
      })
    }
    return list
  }, [teamRuns, selectedRunId, team])

  const api = useMemo(() => {
    if (!token || !currentWorkspace) return null
    return createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
  }, [token, refreshToken, currentWorkspace])

  const loadRuns = useCallback(async () => {
    if (!api) return
    setRunsLoading(true)
    try {
      const res = await api.get<TeamRunRecord[]>(`/teams/${teamId}/runs?limit=60`)
      const list = res.data ?? []
      setTeamRuns(list)
      setSelectedRunId((prev) => {
        if (prev && list.some((r) => r.runId === prev)) return prev
        if (prev && !list.some((r) => r.runId === prev)) return prev
        const running = list.find((r) => r.status === "running")
        if (running) return running.runId
        return list[0]?.runId ?? null
      })
    } catch {
      setTeamRuns([])
    } finally {
      setRunsLoading(false)
    }
  }, [api, teamId])

  const onForeignRunDetected = useCallback(
    (foreignRunId: string) => {
      toast("Nova execução", {
        description: `Há actividade noutra execução (${foreignRunId.slice(0, 8)}…).`,
        action: {
          label: "Seguir esta execução",
          onClick: () => {
            setSelectedRunId(foreignRunId)
            void loadRuns()
          },
        },
      })
    },
    [loadRuns],
  )

  const {
    items: liveTimelineItems,
    connected,
    reconnecting,
    error: liveError,
  } = useTeamLiveTimeline({
    teamId,
    api,
    enabled: mode === "live" && !!selectedRunId,
    replayLimit: 200,
    coordinatorId: team?.coordinatorId,
    scopeRunId: selectedRunId,
    onForeignRunDetected,
  })

  const simulationEvents = useMemo(() => {
    if (!team) return [] as OfficeEvent[]
    return buildDemoOfficeEvents({
      coordinatorId: team.coordinatorId,
      specialistIds: team.agentIds.filter((id) => id !== team.coordinatorId),
    })
  }, [team])

  const liveOfficeEvents = useMemo(() => {
    if (!team) return []
    return mapTimelineItemsToOfficeEvents(liveTimelineItems, { coordinatorId: team.coordinatorId })
  }, [team, liveTimelineItems])

  const timelineEvents = useMemo((): OfficeEvent[] => {
    if (mode === "live") return liveOfficeEvents
    if (mode === "simulation") return simulationEvents
    return replayEvents
  }, [mode, liveOfficeEvents, simulationEvents, replayEvents])

  const effectiveIndex = resolveSelectedIndex(mode, selectedIndex, timelineEvents.length)

  const activeEvent =
    effectiveIndex >= 0 && effectiveIndex < timelineEvents.length ? timelineEvents[effectiveIndex] : undefined

  const rosterAgents = useMemo(() => {
    if (!team) return [] as Array<{
      id: string
      name: string
      role: "coordinator" | "specialist"
      category?: string
    }>
    const ids = [...team.agentIds]
    if (team.coordinatorId && !ids.includes(team.coordinatorId)) {
      ids.push(team.coordinatorId)
    }
    const rows: Array<{
      id: string
      name: string
      role: "coordinator" | "specialist"
      category?: string
    }> = []
    for (const id of ids) {
      const found = agents.find((a) => a.id === id)
      if (found) {
        rows.push({
          id: found.id,
          name: found.name,
          role: found.id === team.coordinatorId ? "coordinator" : "specialist",
          category: typeof found.category === "string" ? found.category : undefined,
        })
      } else if (id === team.coordinatorId) {
        rows.push({
          id: team.coordinatorId,
          name: "Coordenador",
          role: "coordinator",
        })
      }
    }
    return rows
  }, [team, agents])

  const layoutAgents = useMemo(() => {
    if (!team) return []
    const base = buildOfficeLayout({
      coordinatorId: team.coordinatorId,
      agents: rosterAgents,
    })
    return applyOfficePositionOverrides(base, layoutOverrides)
  }, [team, rosterAgents, layoutOverrides])

  const baseVisualAgents = useMemo(() => layoutToVisualAgents(layoutAgents), [layoutAgents])

  const visualAgents = useMemo(() => {
    if (!team || !activeEvent) {
      return applyOfficeFocus(baseVisualAgents, undefined, undefined)
    }
    const { from, to } = focusPair(activeEvent, team.coordinatorId)
    return applyOfficeFocus(baseVisualAgents, from, to)
  }, [team, baseVisualAgents, activeEvent])

  useEffect(() => {
    if (mode !== "replay" || !team || !api) return
    if (!selectedRunId) {
      setReplayEvents([])
      setSelectedIndex(-1)
      setPlaying(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await api.get<{ items: TeamConversationTimelineItem[] }>(
          `/teams/${teamId}/timeline?runId=${encodeURIComponent(selectedRunId)}&limit=200`,
        )
        if (cancelled) return
        const mapped = mapTimelineItemsToOfficeEvents(res.data.items ?? [], {
          coordinatorId: team.coordinatorId,
        })
        setReplayEvents(mapped)
        setSelectedIndex(mapped.length > 0 ? mapped.length - 1 : -1)
        setPlaying(false)
      } catch {
        if (!cancelled) toast.error("Não foi possível carregar a timeline")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mode, team, api, teamId, selectedRunId])

  useEffect(() => {
    if (!playing || mode === "live" || timelineEvents.length === 0) return
    const ms = Math.max(120, 880 / speed)
    const id = window.setInterval(() => {
      setSelectedIndex((i) => {
        const next = i + 1
        if (next >= timelineEvents.length) return 0
        return next
      })
    }, ms)
    return () => window.clearInterval(id)
  }, [playing, mode, speed, timelineEvents.length])

  useEffect(() => {
    if (!api) return
    let cancelled = false
    void (async () => {
      try {
        const [teamRes, agentsRes] = await Promise.all([
          api.get<Team>(`/teams/${teamId}`),
          api.get<Agent[]>("/agents?page=1&perPage=100"),
        ])
        if (cancelled) return
        setTeam(teamRes.data)
        setAgents(agentsRes.data)
      } catch {
        if (!cancelled) toast.error("Falha ao carregar o time")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [api, teamId])

  useEffect(() => {
    if (!api) return
    void loadRuns()
  }, [api, teamId, loadRuns])

  const activeEventForScene = activeEvent

  const agentOptions = useMemo(
    () => [
      { id: OFFICE_USER_AGENT_ID, name: "Utilizador" },
      ...rosterAgents.map((a) => ({ id: a.id, name: a.name })),
    ],
    [rosterAgents],
  )

  const handleMode = useCallback((m: OfficeMode) => {
    setMode(m)
    setPlaying(false)
    if (m === "simulation") {
      setAgentFilter("all")
      setSelectedIndex(0)
    } else if (m === "live") {
      setSelectedIndex(-1)
    } else if (m === "replay") {
      setSelectedIndex(-1)
    }
  }, [])

  if (!team) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">A carregar…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            href={`/teams/${team.id}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao time
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Escritório virtual: {team.name}</h1>
          <p className="text-sm text-muted-foreground">
            Visualização do trabalho do time em tempo real, replay da timeline ou simulação de demonstração.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
            <Link href={`/teams/${team.id}/graph`}>
              <GitBranch className="h-4 w-4" />
              Editor de grafo
            </Link>
          </Button>
        </div>
      </div>

      <AgentOfficeStatusBar
        mode={mode}
        connected={connected}
        reconnecting={reconnecting}
        liveError={liveError}
        eventCount={timelineEvents.length}
        lastLiveSummary={
          mode === "live" && timelineEvents.length > 0
            ? `${timelineEvents[timelineEvents.length - 1].type} · seq ${timelineEvents[timelineEvents.length - 1].seq}`
            : null
        }
      />

      <AgentOfficeControls
        mode={mode}
        onMode={handleMode}
        playing={playing}
        onTogglePlay={() => setPlaying((p) => !p)}
        speed={speed}
        onSpeed={setSpeed}
        onClear={() => controllerRef.current?.resetFocus()}
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="relative min-h-[360px]">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Move className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <Switch
                id="office-layout-edit"
                checked={layoutEditMode}
                onCheckedChange={setLayoutEditMode}
                title="Permite arrastar agentes no cenário"
              />
              <Label htmlFor="office-layout-edit" className="cursor-pointer text-xs">
                Editar posições no mapa
              </Label>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={Object.keys(layoutOverrides).length === 0}
              title="Remove posições guardadas e repõe o layout por defeito"
              onClick={handleResetOfficeLayout}
            >
              Repor layout
            </Button>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="relative aspect-[1100/680] w-full overflow-hidden">
              <AgentOfficeGame
                agents={visualAgents}
                activeEvent={layoutEditMode ? undefined : activeEventForScene}
                layoutEditMode={layoutEditMode}
                onAgentPositionCommit={handleAgentPositionCommit}
                onControllerReady={(c) => {
                  controllerRef.current = c
                }}
              />
              <AgentOfficeOverlay agents={visualAgents} activeEvent={activeEvent} coordinatorId={team.coordinatorId} />
            </div>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <LayoutGrid className="h-3.5 w-3.5" />
            Phaser: cenário e agentes; texto no painel e no balão React. As posições ficam guardadas neste
            dispositivo.
          </p>
        </div>

        <div className="flex min-h-[280px] flex-col rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-sm font-semibold">Timeline</h2>
            <div className="flex flex-wrap items-center gap-1.5">
              <label className="text-xs text-muted-foreground" htmlFor="office-run-select">
                Execução
              </label>
              <Select
                value={selectedRunId ?? ""}
                onValueChange={(v) => {
                  setSelectedRunId(v || null)
                  setPlaying(false)
                  setSelectedIndex(-1)
                }}
                disabled={runsLoading || (runsForSelect.length === 0 && !selectedRunId)}
              >
                <SelectTrigger id="office-run-select" className="h-8 w-[min(100%,220px)] text-xs">
                  <SelectValue placeholder={runsLoading ? "A carregar…" : "Sem execuções"} />
                </SelectTrigger>
                <SelectContent align="end">
                  {runsForSelect.map((r) => {
                    let rel = ""
                    try {
                      rel = formatDistanceToNow(parseISO(r.startedAt), { locale: ptBR, addSuffix: true })
                    } catch {
                      rel = ""
                    }
                    const pendingList = !teamRuns.some((t) => t.runId === r.runId)
                    return (
                      <SelectItem key={r.runId} value={r.runId} className="text-xs">
                        <span className="font-mono">{r.runId.slice(0, 8)}…</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {teamRunSourceLabel(r.source)} · {teamRunStatusLabel(r.status)}
                          {pendingList ? " · a sincronizar" : null}
                          {rel ? ` · ${rel}` : ""}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                disabled={runsLoading || !api}
                title="Actualizar lista de execuções"
                onClick={() => void loadRuns()}
              >
                <RefreshCw className={`h-4 w-4 ${runsLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
          {mode !== "simulation" && !selectedRunId && !runsLoading && (
            <p className="mb-2 text-xs text-muted-foreground">
              Não há execuções registadas para este time — a timeline do escritório fica vazia até existir pelo menos uma
              run.
            </p>
          )}
          <AgentOfficeTimelinePanel
            events={timelineEvents}
            selectedIndex={effectiveIndex}
            onSelectIndex={(i) => {
              setSelectedIndex(i)
              setPlaying(false)
            }}
            agentFilter={agentFilter}
            onAgentFilter={setAgentFilter}
            agentOptions={agentOptions}
          />
        </div>
      </div>
    </div>
  )
}
