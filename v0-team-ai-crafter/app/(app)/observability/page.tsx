"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Activity, ChevronDown, Loader2, RefreshCw, Timer, Wrench } from "lucide-react"
import { ApiError, createApiClient } from "@/lib/api/client"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import type { ObservabilityMetricsSummary, TeamPlanMetricsKpis } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

function formatMaybeSeconds(value: number | null): string {
  if (value === null) return "—"
  if (value < 0.01 && value > 0) return "< 0,01 s"
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 })} s`
}

function formatCount(n: number): string {
  return n.toLocaleString("pt-BR")
}

function KpiStat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border/60 bg-muted/30 px-3 py-2", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function KpiGrid({ kpis }: { kpis: TeamPlanMetricsKpis }) {
  const ex = kpis.teamPlanExecute
  const tr = kpis.autoBindTruncations
  const dur = kpis.executeDuration
  const ab = kpis.autoBindActions

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Execuções de team-plan
          </CardTitle>
          <CardDescription>Contador por resultado (processo inteiro).</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <KpiStat label="Total" value={formatCount(ex.total)} className="col-span-2 sm:col-span-1" />
          <KpiStat label="Sucesso" value={formatCount(ex.byOutcome.success)} />
          <KpiStat label="Erro" value={formatCount(ex.byOutcome.error)} />
          <KpiStat label="Idempotente" value={formatCount(ex.byOutcome.idempotent)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" />
            Duração da execução
          </CardTitle>
          <CardDescription>Histograma agregado (média = soma / observações).</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          <KpiStat label="Observações" value={formatCount(dur.observationCount)} />
          <KpiStat label="Tempo médio" value={formatMaybeSeconds(dur.avgSeconds)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            Auto-bind de tools
          </CardTitle>
          <CardDescription>Truncagens e tamanho médio das listas por execução.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <KpiStat label="Truncagens (total)" value={formatCount(tr.total)} />
            <KpiStat label="Com auto-bind ligado" value={formatCount(tr.whenAutoBindOn)} />
            <KpiStat label="Com auto-bind desligado" value={formatCount(tr.whenAutoBindOff)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <KpiStat
              label="Média actionIds pedidos"
              value={ab.requested.avg === null ? "—" : ab.requested.avg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
            />
            <KpiStat
              label="Média actionIds aplicados"
              value={ab.applied.avg === null ? "—" : ab.applied.avg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ObservabilityPage() {
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [data, setData] = useState<ObservabilityMetricsSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rawOpen, setRawOpen] = useState(false)

  const api = useMemo(
    () =>
      createApiClient({
        getAuth: () => ({ token, refreshToken }),
        setAuth: () => {},
        clearAuth: () => {},
        getWorkspaceId: () => currentWorkspace?.id ?? null,
      }),
    [token, refreshToken, currentWorkspace?.id],
  )

  const load = useCallback(async () => {
    if (!token || !currentWorkspace) return
    setLoading(true)
    setForbidden(false)
    setError(null)
    try {
      const res = await api.get<ObservabilityMetricsSummary>("/observability/metrics-summary")
      setData(res.data)
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setForbidden(true)
        setData(null)
      } else {
        setError(e instanceof ApiError ? e.message : "Não foi possível carregar as métricas.")
        setData(null)
      }
    } finally {
      setLoading(false)
    }
  }, [api, token, currentWorkspace])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Activity className="h-7 w-7 text-primary" />
            Observabilidade
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            KPIs do team-plan (execute e auto-bind) a partir do Prometheus interno. Dados ao nível do processo; acesso restrito a
            administradores do workspace.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Atualizar</span>
        </Button>
      </div>

      {forbidden && (
        <Alert>
          <AlertTitle>Sem permissão</AlertTitle>
          <AlertDescription>
            Apenas donos e administradores do workspace podem ver este resumo. O endpoint completo Prometheus continua disponível em{" "}
            <code className="text-xs bg-muted px-1 rounded">GET /metrics</code> no servidor (fora do prefixo <code className="text-xs">/api/v1</code>).
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data && !forbidden && (
        <>
          <p className="text-sm text-muted-foreground">
            Coletado em {new Date(data.collectedAt).toLocaleString("pt-BR")} · {data.metrics.length} série(s) Prometheus
          </p>
          <KpiGrid kpis={data.kpis} />

          <Collapsible open={rawOpen} onOpenChange={setRawOpen}>
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div className="space-y-1.5 min-w-0">
                  <CardTitle className="text-base">Detalhe técnico (JSON)</CardTitle>
                  <CardDescription>
                    Séries filtradas <code className="text-xs">agents_team_crafter_*</code> — uso avançado.
                  </CardDescription>
                </div>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5">
                    <ChevronDown className={cn("h-4 w-4 transition-transform", rawOpen && "rotate-180")} />
                    {rawOpen ? "Ocultar JSON" : "Ver JSON"}
                  </Button>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <pre className="text-xs font-mono bg-muted/50 border border-border rounded-lg p-4 overflow-auto max-h-[min(50vh,400px)] whitespace-pre-wrap break-all">
                    {JSON.stringify(data.metrics, null, 2)}
                  </pre>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </>
      )}
    </div>
  )
}
