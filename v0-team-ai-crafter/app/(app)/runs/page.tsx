"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, ExternalLink, History, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { createApiClient, ApiError } from "@/lib/api/client"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import type { TeamRunRecord } from "@/lib/types"
import {
  formatRunDurationMs,
  teamRunSourceLabel,
  teamRunStatusLabel,
  teamRunTriggerLabel,
} from "@/lib/runs-display"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ResponsiveTableScroll } from "@/components/ui/responsive-table"
import { toast } from "sonner"
import { ContextualTourHost, ContextualTourManualTrigger } from "@/components/onboarding/contextual-tour"
import { RunsListMobileCards, runStatusBadgeVariant } from "@/components/runs/runs-list-mobile-cards"

export default function RunsPage() {
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [runs, setRuns] = useState<TeamRunRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<
    "all" | "completed" | "failed" | "running" | "interrupted" | "cancelled"
  >("all")
  const [sourceFilter, setSourceFilter] = useState<"all" | "manual" | "inbound" | "planner">("all")

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
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "80" })
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (sourceFilter !== "all") params.set("source", sourceFilter)
      const res = await api.get<TeamRunRecord[]>(`/runs?${params.toString()}`)
      setRuns(res.data ?? [])
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao carregar execuções")
      setRuns([])
    } finally {
      setLoading(false)
    }
  }, [api, statusFilter, sourceFilter])

  useEffect(() => {
    void loadRuns()
  }, [loadRuns])

  if (!token || !currentWorkspace) {
    return null
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <ContextualTourHost screenKey="runs_list" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <History className="w-8 h-8 text-primary" />
            Execuções (runs)
          </h1>
          <p className="text-muted-foreground mt-1">
            Observabilidade das últimas execuções de times neste workspace
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ContextualTourManualTrigger screenKey="runs_list" />
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/governance">Governança</Link>
          </Button>
        </div>
      </div>

      <Card data-tour-anchor="runs-list-recent">
        <CardHeader>
          <CardTitle className="text-lg">Lista recente</CardTitle>
          <CardDescription>
            Até 80 runs ordenados por início. Filtre por estado e origem; abra o time para ver passos e o console de
            teste.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">Filtrar</span>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                <SelectItem value="completed">Concluída</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
                <SelectItem value="interrupted">Interrompida</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
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
            <div className="flex items-center gap-2 text-muted-foreground py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
              Carregando…
            </div>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Nenhuma execução corresponde aos filtros ou ainda não há runs neste workspace.
            </p>
          ) : (
            <>
              <RunsListMobileCards runs={runs} />
              <div className="hidden md:block">
                <ResponsiveTableScroll>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Estado</TableHead>
                        <TableHead>Run</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Gatilho</TableHead>
                        <TableHead>Interrupção</TableHead>
                        <TableHead>Duração</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead className="w-[100px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runs.map((r) => {
                        const dur = formatRunDurationMs(r.startedAt, r.finishedAt)
                        return (
                          <TableRow key={r.runId}>
                            <TableCell>
                              <Badge variant={runStatusBadgeVariant(r.status)}>{teamRunStatusLabel(r.status)}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs max-w-[200px] truncate" title={r.runId}>
                              {r.runId}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{r.teamId}</TableCell>
                            <TableCell className="text-sm">
                              {teamRunSourceLabel(r.source)}
                              {r.channel ? ` · ${r.channel}` : ""}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[140px] truncate" title={r.trigger}>
                              {teamRunTriggerLabel(r.trigger)}
                            </TableCell>
                            <TableCell className="text-sm max-w-[360px] align-top">
                              {r.interrupt?.interruptReasonMessage ? (
                                <div className="space-y-1">
                                  <p className="font-medium text-amber-700 dark:text-amber-400 line-clamp-2">
                                    {r.interrupt.interruptReasonMessage}
                                  </p>
                                  {r.interrupt.nextStep ? (
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      Próximo passo: {r.interrupt.nextStep}
                                    </p>
                                  ) : null}
                                  {r.interrupt.interruptReasonDetail ? (
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      Detalhe técnico: {r.interrupt.interruptReasonDetail}
                                    </p>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
                              {dur ?? "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                              {r.startedAt
                                ? format(new Date(r.startedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
                                <Link href={`/teams/${r.teamId}?tab=runs`}>
                                  <span className="sr-only">Abrir execução no time</span>
                                  <ExternalLink className="w-4 h-4" />
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </ResponsiveTableScroll>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
