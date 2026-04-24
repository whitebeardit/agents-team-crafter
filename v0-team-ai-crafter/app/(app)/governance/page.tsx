"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ResponsiveTableScroll } from "@/components/ui/responsive-table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { createApiClient, ApiError } from "@/lib/api/client"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import type {
  GovernanceAuditEvent,
  GovernanceAuditListMeta,
  GovernanceAuditTrend,
  GovernanceFeatureFlags,
  GovernanceOpsSummary,
  GovernanceRunsTrend,
  GovernanceTeamSlos,
} from "@/lib/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Download,
  Gavel,
  Loader2,
  ShieldAlert,
  TrendingUp,
} from "lucide-react"
import { toast } from "sonner"
import { ContextualTourHost, ContextualTourManualTrigger } from "@/components/onboarding/contextual-tour"
import {
  governanceAuditEventsToCsv,
  triggerTextDownload,
} from "@/lib/governance/audit-export"
import {
  GovernanceAuditFullMobileCards,
  GovernanceTeamSlosMobileCards,
  GovernanceTimelineMobileCards,
} from "@/components/governance/governance-dense-lists-mobile-cards"

function formatEventType(t: string) {
  return t.replace(/^governance\./, "").replace(/_/g, " ")
}

function formatTrendTick(isoDay: string) {
  const parts = isoDay.split("-")
  if (parts.length !== 3) return isoDay
  const [, m, d] = parts
  return `${d}/${m}`
}

function formatLatencyMs(ms: number | null | undefined): string {
  if (ms == null) return "—"
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

export default function GovernancePage() {
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [ops, setOps] = useState<GovernanceOpsSummary | null>(null)
  const [flags, setFlags] = useState<GovernanceFeatureFlags | null>(null)
  const [auditFull, setAuditFull] = useState<GovernanceAuditEvent[] | null>(null)
  const [auditPageMeta, setAuditPageMeta] = useState<GovernanceAuditListMeta | null>(null)
  const [auditPage, setAuditPage] = useState(1)
  const perPage = 20
  const [auditForbidden, setAuditForbidden] = useState(false)
  const [flagsReadonly, setFlagsReadonly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingFlags, setSavingFlags] = useState(false)
  const [exportingAudit, setExportingAudit] = useState(false)
  const lastExportAtRef = useRef(0)
  const EXPORT_COOLDOWN_MS = 5000
  const [trendDays, setTrendDays] = useState(14)
  const [sloDays, setSloDays] = useState(7)
  const [sloTarget, setSloTarget] = useState(95)
  const [runsTrend, setRunsTrend] = useState<GovernanceRunsTrend | null>(null)
  const [auditTrend, setAuditTrend] = useState<GovernanceAuditTrend | null>(null)
  const [teamSlos, setTeamSlos] = useState<GovernanceTeamSlos | null>(null)
  const [webhookDraft, setWebhookDraft] = useState("")
  const [purgeScope, setPurgeScope] = useState<"all" | "range">("all")
  const [purgeFrom, setPurgeFrom] = useState("")
  const [purgeTo, setPurgeTo] = useState("")
  const [purgePhrase, setPurgePhrase] = useState("")
  const [purgeBusy, setPurgeBusy] = useState(false)

  const load = useCallback(async () => {
    if (!token || !currentWorkspace) return
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
    setLoading(true)
    try {
      const [opsRes, flagsRes, runsTrendRes, auditTrendRes, teamSlosRes] = await Promise.all([
        api.get<GovernanceOpsSummary>("/governance/ops-summary"),
        api.get<GovernanceFeatureFlags>("/governance/feature-flags"),
        api.get<GovernanceRunsTrend>(`/governance/runs-trend?days=${trendDays}`),
        api.get<GovernanceAuditTrend>(`/governance/audit-trend?days=${trendDays}`),
        api.get<GovernanceTeamSlos>(
          `/governance/team-slos?days=${sloDays}&sloTargetPercent=${sloTarget}`,
        ),
      ])
      setOps(opsRes.data)
      setFlags(flagsRes.data)
      setRunsTrend(runsTrendRes.data)
      setAuditTrend(auditTrendRes.data)
      setTeamSlos(teamSlosRes.data)
      setWebhookDraft(flagsRes.data.sloWebhookUrl ?? "")

      let full: GovernanceAuditEvent[] | null = null
      let forbidden = false
      let pageMeta: GovernanceAuditListMeta | null = null
      try {
        const a = await api.get<GovernanceAuditEvent[]>(
          `/governance/audit-events?page=${auditPage}&perPage=${perPage}`,
        )
        full = a.data
        const m = a.meta as unknown as GovernanceAuditListMeta
        if (m && typeof m.page === "number") pageMeta = m
      } catch (e) {
        if (e instanceof ApiError && e.status === 403) {
          forbidden = true
        } else {
          full = []
        }
      }
      setAuditFull(full)
      setAuditPageMeta(pageMeta)
      setAuditForbidden(forbidden)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao carregar governança")
    } finally {
      setLoading(false)
    }
  }, [token, refreshToken, currentWorkspace, auditPage, trendDays, sloDays, sloTarget])

  useEffect(() => {
    void load()
  }, [load])

  const exportAudit = async (format: "csv" | "json") => {
    if (!token || !currentWorkspace) return
    const now = Date.now()
    if (now - lastExportAtRef.current < EXPORT_COOLDOWN_MS && lastExportAtRef.current > 0) {
      toast.error("Aguarde alguns segundos entre exportações.")
      return
    }
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
    setExportingAudit(true)
    try {
      const per = 100
      let page = 1
      let totalPages = 1
      const all: GovernanceAuditEvent[] = []
      do {
        const res = await api.get<GovernanceAuditEvent[]>(
          `/governance/audit-events?page=${page}&perPage=${per}`,
        )
        const m = res.meta as unknown as GovernanceAuditListMeta
        all.push(...res.data)
        totalPages = m?.totalPages ?? 1
        page += 1
      } while (page <= totalPages)

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
      const base = `governance-audit-${currentWorkspace.id}-${stamp}`
      if (format === "csv") {
        triggerTextDownload(`${base}.csv`, governanceAuditEventsToCsv(all), "text/csv;charset=utf-8")
      } else {
        triggerTextDownload(
          `${base}.json`,
          `${JSON.stringify(all, null, 2)}\n`,
          "application/json;charset=utf-8",
        )
      }
      lastExportAtRef.current = Date.now()
      toast.success(`Exportação concluída (${all.length} evento(s)).`)
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        toast.error("Limite de pedidos de auditoria por minuto; tente novamente em instantes.")
      } else {
        toast.error(e instanceof ApiError ? e.message : "Falha ao exportar auditoria")
      }
    } finally {
      setExportingAudit(false)
    }
  }

  const submitAuditPurge = async () => {
    if (!token || !currentWorkspace) return
    if (purgePhrase !== "PURGE_GOVERNANCE_AUDIT") {
      toast.error("Frase de confirmação incorreta.")
      return
    }
    if (purgeScope === "range" && (!purgeFrom.trim() || !purgeTo.trim())) {
      toast.error("Indique início e fim do intervalo.")
      return
    }
    let rangeFromIso: string | undefined
    let rangeToIso: string | undefined
    if (purgeScope === "range") {
      const a = new Date(purgeFrom)
      const b = new Date(purgeTo)
      if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
        toast.error("Datas inválidas.")
        return
      }
      if (a > b) {
        toast.error("O início deve ser anterior ou igual ao fim.")
        return
      }
      rangeFromIso = a.toISOString()
      rangeToIso = b.toISOString()
    }
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
    setPurgeBusy(true)
    try {
      const payload: {
        confirmPhrase: "PURGE_GOVERNANCE_AUDIT"
        scope: "all" | "range"
        from?: string
        to?: string
      } = {
        confirmPhrase: "PURGE_GOVERNANCE_AUDIT",
        scope: purgeScope,
      }
      if (purgeScope === "range") {
        payload.from = rangeFromIso
        payload.to = rangeToIso
      }
      const res = await api.post<{ deletedCount: number; scope: string }>(
        "/governance/audit-events/purge",
        payload,
      )
      toast.success(
        `Removidos ${res.data.deletedCount} evento(s). Novo registo de auditoria criado.`,
      )
      setPurgePhrase("")
      await load()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha na limpeza")
    } finally {
      setPurgeBusy(false)
    }
  }

  const saveFlags = async (patch: Partial<GovernanceFeatureFlags>) => {
    if (!token || !currentWorkspace || !flags) return
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
    setSavingFlags(true)
    try {
      const next = { ...flags, ...patch }
      const res = await api.put<GovernanceFeatureFlags>("/governance/feature-flags", next)
      setFlags(res.data)
      toast.success("Preferências atualizadas")
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setFlagsReadonly(true)
        toast.error("Apenas administradores podem alterar estas opções")
      } else {
        toast.error(e instanceof ApiError ? e.message : "Falha ao salvar")
      }
    } finally {
      setSavingFlags(false)
    }
  }

  if (!token || !currentWorkspace) {
    return null
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <ContextualTourHost screenKey="governance_workspace" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Gavel className="w-8 h-8 text-primary" />
            Governança
          </h1>
          <p className="text-muted-foreground mt-1">
            Operação, auditoria e políticas de overlap do workspace
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ContextualTourManualTrigger screenKey="governance_workspace" />
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/runs">Execuções</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Atualizar"}
          </Button>
        </div>
      </div>

      {loading && !ops ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Carregando…
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Runs com falha (total)</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {ops?.runsFailedTotal ?? "—"}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Runs concluídos (total)</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {ops?.runsCompletedTotal ?? "—"}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Runs em execução</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {ops?.runsRunningTotal ?? "—"}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Taxa de falha (30d)</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {ops?.runsFailureRateLast30d == null
                    ? "—"
                    : `${(ops.runsFailureRateLast30d * 100).toFixed(1)}%`}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Runs OK (30d)</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {ops?.runsCompletedLast30d ?? "—"}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Runs falha (30d)</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {ops?.runsFailedLast30d ?? "—"}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Eventos de auditoria (30d)</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {ops?.governanceAuditEventsLast30d ?? "—"}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Reviews bloqueados (30d)</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {ops?.overlapReviewsBlockedLast30d ?? "—"}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Tendência e SLO por time
                </h2>
                <p className="text-sm text-muted-foreground">
                  Séries diárias (UTC) e taxa de sucesso em runs terminados na janela indicada
                </p>
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground block">Gráficos (dias)</span>
                  <Select
                    value={String(trendDays)}
                    onValueChange={(v) => setTrendDays(Number(v))}
                    disabled={loading}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 dias</SelectItem>
                      <SelectItem value="14">14 dias</SelectItem>
                      <SelectItem value="30">30 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground block">SLO janela</span>
                  <Select
                    value={String(sloDays)}
                    onValueChange={(v) => setSloDays(Number(v))}
                    disabled={loading}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 dias</SelectItem>
                      <SelectItem value="14">14 dias</SelectItem>
                      <SelectItem value="30">30 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground block">Meta SLO</span>
                  <Select
                    value={String(sloTarget)}
                    onValueChange={(v) => setSloTarget(Number(v))}
                    disabled={loading}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="90">90%</SelectItem>
                      <SelectItem value="95">95%</SelectItem>
                      <SelectItem value="99">99%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {teamSlos?.teams?.some((t) => t.meetsSlo === false) && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>SLO fora da meta</AlertTitle>
                <AlertDescription>
                  Um ou mais times estão abaixo da taxa de sucesso definida nesta janela. Se os alertas
                  estiverem ativos, é registado um evento de auditoria por time e dia (deduplicado).
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Runs terminados por dia</CardTitle>
                  <CardDescription>Concluídos vs falhos (UTC)</CardDescription>
                </CardHeader>
                <CardContent className="h-[260px] pt-0">
                  {runsTrend?.series?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={runsTrend.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          tickFormatter={formatTrendTick}
                        />
                        <YAxis allowDecimals={false} width={32} tick={{ fontSize: 11 }} />
                        <Tooltip
                          labelFormatter={(l) => String(l)}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line
                          type="monotone"
                          dataKey="completed"
                          name="OK"
                          stroke="var(--chart-3)"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="failed"
                          name="Falha"
                          stroke="var(--destructive)"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground py-8 text-center">Sem dados.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Eventos de auditoria por dia</CardTitle>
                  <CardDescription>Volume diário (UTC)</CardDescription>
                </CardHeader>
                <CardContent className="h-[260px] pt-0">
                  {auditTrend?.series?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={auditTrend.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          tickFormatter={formatTrendTick}
                        />
                        <YAxis allowDecimals={false} width={32} tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ fontSize: 12 }} />
                        <Area
                          type="monotone"
                          dataKey="count"
                          name="Eventos"
                          stroke="var(--primary)"
                          fill="var(--primary)"
                          fillOpacity={0.2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground py-8 text-center">Sem dados.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  SLO por time ({teamSlos?.sloTargetPercent ?? sloTarget}% de sucesso)
                </CardTitle>
                <CardDescription>
                  Janela rolante de {teamSlos?.windowDays ?? sloDays} dias — apenas runs com estado
                  final (ok ou falha). Latência = tempo entre início e fim do run quando{" "}
                  <code className="text-xs">finishedAt</code> existe.
                </CardDescription>
                {teamSlos?.workspaceLatencyMsPercentiles &&
                  teamSlos.workspaceLatencyMsPercentiles.sampleCount > 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Latência workspace (p50 / p95 / p99):{" "}
                      <span className="font-mono tabular-nums">
                        {formatLatencyMs(teamSlos.workspaceLatencyMsPercentiles.p50Ms)} /{" "}
                        {formatLatencyMs(teamSlos.workspaceLatencyMsPercentiles.p95Ms)} /{" "}
                        {formatLatencyMs(teamSlos.workspaceLatencyMsPercentiles.p99Ms)}
                      </span>{" "}
                      <span className="text-xs">
                        ({teamSlos.workspaceLatencyMsPercentiles.sampleCount} amostras)
                      </span>
                    </p>
                  )}
              </CardHeader>
              <CardContent>
                {!teamSlos?.teams?.length ? (
                  <p className="text-sm text-muted-foreground">Nenhum time com runs terminados nesta janela.</p>
                ) : (
                  <>
                    <GovernanceTeamSlosMobileCards teams={teamSlos.teams} />
                    <div className="hidden md:block">
                      <ResponsiveTableScroll>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Time</TableHead>
                              <TableHead className="text-right">OK</TableHead>
                              <TableHead className="text-right">Falha</TableHead>
                              <TableHead className="text-right">Taxa</TableHead>
                              <TableHead className="text-right">p50</TableHead>
                              <TableHead className="text-right">p95</TableHead>
                              <TableHead>SLO</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {teamSlos.teams.map((row) => (
                              <TableRow key={row.teamId}>
                                <TableCell className="font-medium">{row.teamName}</TableCell>
                                <TableCell className="text-right tabular-nums">{row.completed}</TableCell>
                                <TableCell className="text-right tabular-nums">{row.failed}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {row.successRate == null
                                    ? "—"
                                    : `${(row.successRate * 100).toFixed(1)}%`}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground text-sm">
                                  {formatLatencyMs(row.latencyMsPercentiles?.p50Ms)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground text-sm">
                                  {formatLatencyMs(row.latencyMsPercentiles?.p95Ms)}
                                </TableCell>
                                <TableCell>
                                  {row.meetsSlo == null ? (
                                    <span className="text-muted-foreground text-sm">—</span>
                                  ) : row.meetsSlo ? (
                                    <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                                      Dentro
                                    </Badge>
                                  ) : (
                                    <Badge variant="destructive">Fora</Badge>
                                  )}
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

          {flags && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Políticas do workspace</CardTitle>
                <CardDescription>
                  Sobreposição de especialistas e fluxo do wizard de agentes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="overlap-mode">Modo de overlap</Label>
                    <p className="text-sm text-muted-foreground">
                      {flags.overlapMode === "blocking"
                        ? "Bloqueia criação quando há conflito (padrão)."
                        : "Apenas alerta — criação e execução de planos retornam aviso de governança na resposta quando o draft seria bloqueado."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">Aviso</span>
                    <Switch
                      id="overlap-mode"
                      checked={flags.overlapMode === "blocking"}
                      disabled={savingFlags || flagsReadonly}
                      onCheckedChange={(checked) =>
                        void saveFlags({ overlapMode: checked ? "blocking" : "warning" })
                      }
                    />
                    <span className="text-xs font-medium">Bloqueio</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="wizard-default">Wizard de agente como padrão</Label>
                    <p className="text-sm text-muted-foreground">
                      Indica que a criação guiada é o caminho preferido no produto.
                    </p>
                  </div>
                  <Switch
                    id="wizard-default"
                    checked={flags.agentWizardDefaultPath}
                    disabled={savingFlags || flagsReadonly}
                    onCheckedChange={(v) => void saveFlags({ agentWizardDefaultPath: v })}
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="slo-alerts">Alertas de violação de SLO</Label>
                    <p className="text-sm text-muted-foreground">
                      Regista evento de auditoria quando um time fica abaixo da meta (no máximo uma vez por
                      time e dia UTC).
                    </p>
                  </div>
                  <Switch
                    id="slo-alerts"
                    checked={flags.sloAlertsEnabled !== false}
                    disabled={savingFlags || flagsReadonly}
                    onCheckedChange={(v) => void saveFlags({ sloAlertsEnabled: v })}
                  />
                </div>
                <div className="space-y-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="slo-webhook">Webhook HTTPS (opcional)</Label>
                    <p className="text-sm text-muted-foreground">
                      Recebe um POST JSON quando um alerta SLO é criado (mesmo conteúdo lógico do evento de
                      auditoria). Deixe vazio e guarde para remover.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      id="slo-webhook"
                      type="url"
                      placeholder="https://…"
                      value={webhookDraft}
                      onChange={(e) => setWebhookDraft(e.target.value)}
                      disabled={savingFlags || flagsReadonly}
                      className="font-mono text-sm sm:max-w-xl"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={
                        savingFlags ||
                        flagsReadonly ||
                        webhookDraft.trim() === (flags.sloWebhookUrl ?? "")
                      }
                      onClick={() =>
                        void saveFlags({
                          sloWebhookUrl: webhookDraft.trim() === "" ? "" : webhookDraft.trim(),
                        })
                      }
                    >
                      Guardar URL
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Linha do tempo (resumo)
              </CardTitle>
              <CardDescription>Últimos eventos incluídos no resumo operacional</CardDescription>
            </CardHeader>
            <CardContent>
              {!ops?.recentGovernanceEvents?.length ? (
                <p className="text-sm text-muted-foreground">Nenhum evento ainda.</p>
              ) : (
                <>
                  <GovernanceTimelineMobileCards events={ops.recentGovernanceEvents} />
                  <div className="hidden md:block">
                    <ResponsiveTableScroll>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Evento</TableHead>
                            <TableHead>Quando</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ops.recentGovernanceEvents.map((ev) => (
                            <TableRow key={ev.id}>
                              <TableCell>
                                <Badge variant="outline" className="font-mono text-xs">
                                  {formatEventType(ev.eventType)}
                                </Badge>
                                {Object.keys(ev.payload ?? {}).length > 0 && (
                                  <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">
                                    {JSON.stringify(ev.payload)}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                                {ev.createdAt
                                  ? new Date(ev.createdAt).toLocaleString("pt-BR")
                                  : "—"}
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

          {!auditForbidden && (
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-lg">Limpeza de auditoria</CardTitle>
                <CardDescription>
                  Elimina eventos persistidos deste workspace (admin). O pedido exige a frase exacta de confirmação.
                  Após a operação é criado um evento{" "}
                  <span className="font-mono text-xs">governance.audit_purged</span>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Ambito</span>
                    <Select
                      value={purgeScope}
                      onValueChange={(v) => setPurgeScope(v as "all" | "range")}
                      disabled={purgeBusy}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os eventos</SelectItem>
                        <SelectItem value="range">Intervalo (createdAt)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {purgeScope === "range" ? (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">De</Label>
                        <Input
                          type="datetime-local"
                          value={purgeFrom}
                          onChange={(e) => setPurgeFrom(e.target.value)}
                          disabled={purgeBusy}
                          className="w-[200px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Até</Label>
                        <Input
                          type="datetime-local"
                          value={purgeTo}
                          onChange={(e) => setPurgeTo(e.target.value)}
                          disabled={purgeBusy}
                          className="w-[200px]"
                        />
                      </div>
                    </>
                  ) : null}
                </div>
                <div className="space-y-2 max-w-md">
                  <Label htmlFor="purge-confirm">Confirmar escrevendo PURGE_GOVERNANCE_AUDIT</Label>
                  <Input
                    id="purge-confirm"
                    value={purgePhrase}
                    onChange={(e) => setPurgePhrase(e.target.value)}
                    placeholder="PURGE_GOVERNANCE_AUDIT"
                    autoComplete="off"
                    disabled={purgeBusy}
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={
                    purgeBusy ||
                    purgePhrase !== "PURGE_GOVERNANCE_AUDIT" ||
                    (purgeScope === "range" && (!purgeFrom.trim() || !purgeTo.trim()))
                  }
                  onClick={() => void submitAuditPurge()}
                >
                  {purgeBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Executar limpeza
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                Auditoria completa
              </CardTitle>
              <CardDescription>
                Lista detalhada — visível para administradores do workspace
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditForbidden && (
                <Alert>
                  <AlertTitle>Acesso restrito</AlertTitle>
                  <AlertDescription>
                    Apenas administradores podem listar todos os eventos. O resumo acima continua
                    disponível para o time.
                  </AlertDescription>
                </Alert>
              )}
              {!auditForbidden && auditFull && (
                <div className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
                    <span>
                      {auditPageMeta ? (
                        <>
                          Página {auditPageMeta.page} de {auditPageMeta.totalPages} — {auditPageMeta.total}{" "}
                          evento(s)
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={loading || exportingAudit}
                        onClick={() => void exportAudit("csv")}
                      >
                        {exportingAudit ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4 mr-1" />
                        )}
                        CSV (tudo)
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={loading || exportingAudit}
                        onClick={() => void exportAudit("json")}
                      >
                        {exportingAudit ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4 mr-1" />
                        )}
                        JSON (tudo)
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={auditPage <= 1 || loading}
                        onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                      >
                        Anterior
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          loading ||
                          !auditPageMeta ||
                          auditPageMeta.page >= auditPageMeta.totalPages
                        }
                        onClick={() =>
                          setAuditPage((p) =>
                            auditPageMeta ? Math.min(auditPageMeta.totalPages, p + 1) : p + 1,
                          )
                        }
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                  {auditFull.length === 0 ? (
                    <p className="py-4 text-sm text-muted-foreground md:hidden">Nenhum registro.</p>
                  ) : (
                    <GovernanceAuditFullMobileCards events={auditFull} />
                  )}
                  <div className="hidden md:block">
                    <ResponsiveTableScroll>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Evento</TableHead>
                            <TableHead>Payload</TableHead>
                            <TableHead>Quando</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditFull.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-muted-foreground text-sm">
                                Nenhum registro.
                              </TableCell>
                            </TableRow>
                          ) : (
                            auditFull.map((ev) => (
                              <TableRow key={ev.id}>
                                <TableCell>
                                  <Badge variant="secondary" className="font-mono text-xs">
                                    {ev.eventType}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs font-mono max-w-md truncate">
                                  {JSON.stringify(ev.payload)}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                                  {ev.createdAt
                                    ? new Date(ev.createdAt).toLocaleString("pt-BR")
                                    : "—"}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </ResponsiveTableScroll>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
