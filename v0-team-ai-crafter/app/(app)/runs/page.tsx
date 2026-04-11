"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, ExternalLink, History, Loader2 } from "lucide-react"
import { createApiClient, ApiError } from "@/lib/api/client"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import type { TeamRunRecord } from "@/lib/types"
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
import { ResponsiveTableScroll } from "@/components/ui/responsive-table"
import { toast } from "sonner"
import { ContextualTourHost, ContextualTourManualTrigger } from "@/components/onboarding/contextual-tour"
import { RunsListMobileCards, runStatusBadgeVariant } from "@/components/runs/runs-list-mobile-cards"

export default function RunsPage() {
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [runs, setRuns] = useState<TeamRunRecord[]>([])
  const [loading, setLoading] = useState(true)

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
    setLoading(true)
    void (async () => {
      try {
        const res = await api.get<TeamRunRecord[]>("/runs?limit=80")
        setRuns(res.data)
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Falha ao carregar execuções")
        setRuns([])
      } finally {
        setLoading(false)
      }
    })()
  }, [api])

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
            Até 80 runs ordenados por início. Abra o time para ver detalhes, passos e eventos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
              Carregando…
            </div>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhuma execução registada ainda.</p>
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
                        <TableHead>Início</TableHead>
                        <TableHead className="w-[100px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runs.map((r) => (
                        <TableRow key={r.runId}>
                          <TableCell>
                            <Badge variant={runStatusBadgeVariant(r.status)}>{r.status}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-[200px] truncate" title={r.runId}>
                            {r.runId}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{r.teamId}</TableCell>
                          <TableCell className="text-sm">
                            {r.source}
                            {r.channel ? ` · ${r.channel}` : ""}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {r.startedAt ? new Date(r.startedAt).toLocaleString("pt-BR") : "—"}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
                              <Link href={`/teams/${r.teamId}`}>
                                <span className="sr-only">Abrir time</span>
                                <ExternalLink className="w-4 h-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
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
