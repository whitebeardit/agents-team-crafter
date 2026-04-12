"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChevronDown, Loader2, MessageSquareCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ApiError, type createApiClient } from "@/lib/api/client"
import type { RunStepRecord, TeamRunRecord } from "@/lib/types"
import {
  formatRunDurationMs,
  runStepTypeLabel,
  teamRunSourceLabel,
  teamRunStatusLabel,
  teamRunTriggerLabel,
} from "@/lib/runs-display"
import { toast } from "sonner"

type Api = ReturnType<typeof createApiClient>

type TeamRunDetail = TeamRunRecord & { steps?: RunStepRecord[] }

export interface TeamRunsTabProps {
  teamId: string
  api: Api
  /** id → nome (coordenador + especialistas) para a timeline. */
  agentNameById: Record<string, string>
  onOpenConsole: () => void
}

export function TeamRunsTab({ teamId, api, agentNameById, onOpenConsole }: TeamRunsTabProps) {
  const [runs, setRuns] = useState<TeamRunRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "failed" | "running">("all")
  const [sourceFilter, setSourceFilter] = useState<"all" | "manual" | "inbound" | "planner">("all")
  const [openRunId, setOpenRunId] = useState<string | null>(null)
  const [detailByRunId, setDetailByRunId] = useState<Record<string, TeamRunDetail>>({})
  const [detailLoading, setDetailLoading] = useState<string | null>(null)
  const detailFetchedRef = useRef(new Set<string>())

  const loadRuns = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "60" })
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (sourceFilter !== "all") params.set("source", sourceFilter)
      const res = await api.get<TeamRunRecord[]>(`/teams/${teamId}/runs?${params.toString()}`)
      setRuns(res.data ?? [])
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao carregar runs")
      setRuns([])
    } finally {
      setLoading(false)
    }
  }, [api, teamId, statusFilter, sourceFilter])

  useEffect(() => {
    void loadRuns()
  }, [loadRuns])

  const loadDetail = useCallback(async (runId: string) => {
    if (detailFetchedRef.current.has(runId)) return
    detailFetchedRef.current.add(runId)
    setDetailLoading(runId)
    try {
      const res = await api.get<TeamRunDetail>(`/runs/${runId}`)
      setDetailByRunId((prev) => ({ ...prev, [runId]: res.data }))
    } catch (e) {
      detailFetchedRef.current.delete(runId)
      toast.error(e instanceof ApiError ? e.message : "Falha ao carregar detalhe da run")
    } finally {
      setDetailLoading(null)
    }
  }, [api])

  const onOpenChange = (runId: string, open: boolean) => {
    setOpenRunId(open ? runId : null)
    if (open) void loadDetail(runId)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Filtrar</span>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            <SelectItem value="completed">Concluída</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
            <SelectItem value="running">Em execução</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sourceFilter}
          onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as origens</SelectItem>
            <SelectItem value="manual">Consola / HTTP</SelectItem>
            <SelectItem value="inbound">Canal (inbound)</SelectItem>
            <SelectItem value="planner">Planner</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-6">
          <Loader2 className="w-5 h-5 animate-spin" />
          A carregar execuções…
        </div>
      ) : runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma run corresponde aos filtros.</p>
      ) : (
        <ul className="space-y-3">
          {runs.map((run) => {
            const dur = formatRunDurationMs(run.startedAt, run.finishedAt)
            const detail = detailByRunId[run.runId]
            const steps = detail?.steps ?? []
            const isOpen = openRunId === run.runId

            return (
              <li key={run.runId}>
                <Collapsible open={isOpen} onOpenChange={(o) => onOpenChange(run.runId, o)}>
                  <div
                    className={cn(
                      "rounded-lg border border-border bg-secondary/30 transition-colors",
                      run.status === "failed" && "border-destructive/30 bg-destructive/5",
                    )}
                  >
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-start gap-3 p-4 text-left hover:bg-secondary/50 rounded-lg"
                      >
                        <ChevronDown
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                            isOpen && "rotate-180",
                          )}
                        />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={run.status === "completed" ? "secondary" : "outline"}>
                              {teamRunStatusLabel(run.status)}
                            </Badge>
                            <Badge variant="outline">{teamRunSourceLabel(run.source)}</Badge>
                            <Badge variant="outline" className="font-normal">
                              {run.channel || "debug"}
                            </Badge>
                            {dur ? (
                              <span className="text-xs text-muted-foreground tabular-nums">Duração: {dur}</span>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono truncate" title={run.runId}>
                            {run.runId}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {teamRunTriggerLabel(run.trigger)} ·{" "}
                            {format(new Date(run.startedAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                            {run.finishedAt
                              ? ` → ${format(new Date(run.finishedAt), "HH:mm:ss", { locale: ptBR })}`
                              : ""}
                          </p>
                          {!isOpen && run.status === "failed" && run.error?.message ? (
                            <p className="text-sm text-destructive line-clamp-2">{run.error.message}</p>
                          ) : null}
                          {!isOpen && run.externalResponse?.text ? (
                            <p className="text-sm text-muted-foreground line-clamp-2">{run.externalResponse.text}</p>
                          ) : null}
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t border-border px-4 pb-4 pt-0 space-y-4">
                        {detailLoading === run.runId ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-3">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            A carregar passos…
                          </div>
                        ) : (
                          <>
                            {run.error?.message ? (
                              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
                                <p className="font-medium text-destructive">Erro</p>
                                {run.error.code ? (
                                  <p className="text-xs font-mono text-muted-foreground">{run.error.code}</p>
                                ) : null}
                                <p className="text-destructive/90 mt-1">{run.error.message}</p>
                              </div>
                            ) : null}
                            {run.externalResponse?.text ? (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Resposta ao utilizador</p>
                                <p className="text-sm whitespace-pre-wrap break-words rounded-md border border-border bg-background/80 p-3 max-h-48 overflow-y-auto">
                                  {run.externalResponse.text}
                                </p>
                              </div>
                            ) : null}
                            {steps.length > 0 ? (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">Timeline (passos)</p>
                                <ol className="space-y-2 text-sm border border-border rounded-md p-3 bg-muted/20">
                                  {steps.map((s) => {
                                    const agent =
                                      (s.agentId && agentNameById[s.agentId]) ||
                                      (s.agentId ? `${s.agentId.slice(0, 8)}…` : null)
                                    return (
                                      <li
                                        key={`${s.runId}-${s.stepIndex}`}
                                        className="flex flex-wrap gap-x-2 gap-y-1 border-b border-border/60 pb-2 last:border-0 last:pb-0"
                                      >
                                        <span className="text-muted-foreground tabular-nums w-6 shrink-0">
                                          {s.stepIndex}.
                                        </span>
                                        <Badge variant="outline" className="shrink-0 text-[10px]">
                                          {runStepTypeLabel(s.stepType)}
                                        </Badge>
                                        {agent ? (
                                          <span className="font-medium text-foreground">{agent}</span>
                                        ) : null}
                                        {s.toolName ? (
                                          <code className="text-xs bg-muted px-1 rounded">{s.toolName}</code>
                                        ) : null}
                                        <span className="text-muted-foreground w-full pl-8 sm:pl-0 sm:w-auto">
                                          {s.summary}
                                        </span>
                                      </li>
                                    )
                                  })}
                                </ol>
                              </div>
                            ) : isOpen && !detailLoading && steps.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                Sem passos indexados para esta run (ex.: falha antes do motor ou dados antigos).
                              </p>
                            ) : null}
                            <div className="flex flex-wrap gap-2 pt-1">
                              <Button type="button" size="sm" className="gap-1.5" onClick={onOpenConsole}>
                                <MessageSquareCode className="w-3.5 h-3.5" />
                                Retestar no console
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
