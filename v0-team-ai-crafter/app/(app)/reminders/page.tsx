"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BellRing, Clipboard, Loader2, RefreshCw, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { AgentFirstVerticalStandard } from "@/components/verticals/agent-first-vertical-standard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ApiError, createApiClient } from "@/lib/api/client"
import { formatRecordOrigin } from "@/lib/format-record-origin"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import type { CrmParty, ReminderListItem, RemindersReadiness, ScheduleAppointmentsDayResponse, Team } from "@/lib/types"

function todayDateString() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function addDays(isoDate: string, days: number): string {
  const dt = new Date(`${isoDate}T00:00:00`)
  dt.setDate(dt.getDate() + days)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, "0")
  const d = String(dt.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function formatDateTime(value: string | undefined): string {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleString("pt-BR")
  } catch {
    return value
  }
}

function buildReadiness(reminders: ReminderListItem[]): RemindersReadiness {
  const total = reminders.length
  const cancelled = reminders.filter((item) => item.status === "cancelled").length
  const completed = reminders.filter((item) => item.status === "completed").length
  const noShow = reminders.filter((item) => item.status === "no_show").length
  const withCareContext = reminders.filter((item) => Boolean(item.careSubjectId)).length
  const active = total - cancelled
  const activeRate = total > 0 ? Math.round((active / total) * 100) : 0
  const health: RemindersReadiness["health"] = total === 0 ? "critical" : noShow > completed ? "attention" : "ok"

  return {
    total,
    active,
    cancelled,
    completed,
    noShow,
    withCareContext,
    activeRate,
    health,
    generatedAt: new Date().toISOString(),
    checks: [
      {
        code: "reminders_has_volume",
        status: total > 0 ? "ok" : "critical",
        message: total > 0 ? "Há lembretes no período selecionado." : "Nenhum lembrete encontrado no período.",
        nextStep: total > 0 ? "Acompanhar evolução por status." : "Ampliar período e validar criação de lembretes.",
        value: total,
      },
      {
        code: "reminders_active_rate",
        status: activeRate >= 70 ? "ok" : activeRate >= 40 ? "attention" : "critical",
        message: "Percentual de lembretes ativos",
        nextStep: "Revisar cancelamentos e confirmar critérios de envio.",
        value: activeRate,
      },
      {
        code: "reminders_care_context",
        status: withCareContext > 0 ? "ok" : "attention",
        message: "Lembretes com contexto de careSubjectId",
        nextStep: "Validar vínculo clínico quando aplicável.",
        value: withCareContext,
      },
    ],
  }
}

function statusLabel(status: string): string {
  if (status === "completed") return "Concluído"
  if (status === "cancelled") return "Cancelado"
  if (status === "no_show") return "Falta"
  if (status === "confirmed") return "Confirmado"
  return "Agendado"
}

export default function RemindersPage() {
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [loading, setLoading] = useState(false)
  const [recommendedTeam, setRecommendedTeam] = useState<Team | null>(null)
  const [startDate, setStartDate] = useState(addDays(todayDateString(), -30))
  const [endDate, setEndDate] = useState(todayDateString)
  const [searchQuery, setSearchQuery] = useState("")
  const [reminders, setReminders] = useState<ReminderListItem[]>([])
  const [readiness, setReadiness] = useState<RemindersReadiness | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ReminderListItem | null>(null)

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

  const loadRecommendedTeam = useCallback(async () => {
    if (!token || !currentWorkspace) return
    setLoading(true)
    try {
      const teamRes = await api.get<Team[]>("/teams?status=active&page=1&perPage=1")
      setRecommendedTeam(teamRes.data[0] ?? null)
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Não foi possível carregar o time recomendado para Lembretes."
      toast.error(msg)
      setRecommendedTeam(null)
    } finally {
      setLoading(false)
    }
  }, [api, token, currentWorkspace])

  useEffect(() => {
    void loadRecommendedTeam()
  }, [loadRecommendedTeam])

  const loadReminders = useCallback(async () => {
    if (!token || !currentWorkspace) return
    if (!startDate || !endDate) {
      toast.error("Informe data inicial e final.")
      return
    }
    if (startDate > endDate) {
      toast.error("A data inicial deve ser menor ou igual à data final.")
      return
    }
    const MAX_RANGE_DAYS = 31
    const totalDays =
      Math.floor((new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime()) / 86400000) + 1
    if (totalDays > MAX_RANGE_DAYS) {
      toast.error(`Intervalo muito grande. Use no máximo ${MAX_RANGE_DAYS} dias por busca.`)
      return
    }

    setLoadingList(true)
    try {
      const dates: string[] = []
      for (let i = 0; i < totalDays; i += 1) dates.push(addDays(startDate, i))
      const responses = await Promise.all(
        dates.map((date) => api.get<ScheduleAppointmentsDayResponse>(`/schedule/appointments?date=${encodeURIComponent(date)}`)),
      )
      const merged = responses.flatMap((res) => (Array.isArray(res.data?.appointments) ? res.data.appointments : []))
      const reminderScoped = merged.filter((item) => Boolean(item.reminderId))
      const deduped = Array.from(new Map(reminderScoped.map((item) => [item.id, item])).values())
      const ordered = deduped.sort((a, b) => a.startsAt.localeCompare(b.startsAt))

      const partyIds = [...new Set(ordered.map((item) => item.partyId).filter(Boolean))]
      const partiesById: Record<string, CrmParty> = {}
      await Promise.all(
        partyIds.map(async (id) => {
          try {
            const partyRes = await api.get<CrmParty>(`/parties/${id}`)
            if (partyRes.data?.id) partiesById[id] = partyRes.data
          } catch {
            // party pode não estar visível para o usuário atual.
          }
        }),
      )

      const rows: ReminderListItem[] = ordered.map((item) => ({
        id: item.id,
        reminderId: item.reminderId,
        title: item.title,
        partyId: item.partyId,
        careSubjectId: item.careSubjectId,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        notes: item.notes,
        status: item.status,
        origin: item.origin,
        party: partiesById[item.partyId] ?? null,
      }))
      setReminders(rows)
      setReadiness(buildReadiness(rows))
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Não foi possível carregar os lembretes."
      toast.error(msg)
      setReminders([])
      setReadiness(buildReadiness([]))
    } finally {
      setLoadingList(false)
    }
  }, [api, token, currentWorkspace, startDate, endDate])

  useEffect(() => {
    void loadReminders()
  }, [loadReminders])

  const operationHref = recommendedTeam ? `/teams/${recommendedTeam.id}?tab=debug` : "/teams/create"

  const starterPrompts = [
    "Liste lembretes pendentes de hoje e priorize os mais críticos.",
    "Mostre lembretes cancelados/falhos da semana e proponha reexecução.",
    "Quais lembretes com contexto clínico exigem follow-up manual imediato?",
  ]

  const handleCopyPrompt = useCallback(async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
      toast.success("Prompt copiado. Cole no chat do time para operar Lembretes.")
    } catch {
      toast.error("Não foi possível copiar o prompt.")
    }
  }, [])

  const filteredReminders = reminders.filter((item) => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    const haystack = [
      item.id,
      item.reminderId ?? "",
      item.title,
      item.partyId,
      item.careSubjectId ?? "",
      item.notes ?? "",
      item.party?.displayName ?? "",
      item.party?.email ?? "",
      item.party?.phone ?? "",
    ]
      .join(" ")
      .toLowerCase()
    return haystack.includes(q)
  })

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return
    setDeletingId(pendingDelete.id)
    try {
      await api.del(`/schedule/appointments/${pendingDelete.id}`)
      toast.success("Lembrete removido.")
      setPendingDelete(null)
      await loadReminders()
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? `${e.message} (a deleção exige permissão de admin e pode ser bloqueada por vínculos).`
          : "Não foi possível excluir o lembrete."
      toast.error(msg)
    } finally {
      setDeletingId(null)
    }
  }, [api, pendingDelete, loadReminders])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <BellRing className="h-7 w-7 text-primary" />
            Lembretes
          </h1>
          <p className="text-sm text-muted-foreground">
            Vertical de lembretes com operação principal via especialistas. Esta UI cobre auditoria manual e troubleshooting operacional.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadRecommendedTeam()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar
        </Button>
      </div>

      <AgentFirstVerticalStandard
        verticalName="Lembretes"
        summary="Vertical orientada à orquestração de lembretes via especialistas; painel manual para auditoria de execução e saúde operacional."
        readinessTitle="Readiness da fase 1"
        readinessStatusLabel={
          readiness?.health === "ok"
            ? "Saúde operacional estável"
            : readiness?.health === "critical"
              ? "Saúde crítica"
              : "Saúde em atenção"
        }
        readinessStatusTone={readiness?.health === "ok" ? "default" : readiness?.health === "critical" ? "destructive" : "secondary"}
        readinessContent={
          <p>
            Lembretes no período: <strong>{readiness?.total ?? 0}</strong>. Ativos: <strong>{readiness?.activeRate ?? 0}%</strong>.
          </p>
        }
        specialistName="Especialista de Lembretes"
        teamRecommendation="Mesmo time operacional com especialistas de agenda, care e atendimento"
        ctaHref={operationHref}
        ctaLabel={recommendedTeam ? `Abrir operação no time "${recommendedTeam.name}"` : "Criar time operacional"}
        starterPrompts={starterPrompts}
        fallbackGuidance="Use esta tela para monitorar volume, estados e consistência dos lembretes quando for necessário troubleshooting manual."
        troubleshootingItems={[
          "Verifique concentração de lembretes cancelados/no-show no período.",
          "Confirme se há time ativo para operação agent-first.",
          "Antes de excluir, valide impacto em fluxos clínicos e agenda.",
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Lembretes (auditoria manual)</CardTitle>
          <CardDescription>Pesquisa por intervalo de até 31 dias, busca textual e exclusão com confirmação.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="reminders-start-date">Início</Label>
              <Input id="reminders-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reminders-end-date">Fim</Label>
              <Input id="reminders-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reminders-search">Pesquisa</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reminders-search"
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Paciente, reminderId, título, ID, telefone ou nota"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => void loadReminders()} disabled={loadingList}>
              {loadingList ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Recarregar lista
            </Button>
          </div>

          <div className="space-y-3">
            {filteredReminders.map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{item.title}</p>
                      <Badge variant={item.status === "completed" ? "default" : "secondary"}>{statusLabel(item.status)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Registro ID: {item.id}</p>
                    <p className="text-xs text-muted-foreground">reminderId: {item.reminderId ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">careSubjectId: {item.careSubjectId ?? "—"}</p>
                    <p className="text-sm text-muted-foreground">
                      Paciente: {item.party?.displayName ?? item.partyId}
                      {item.party?.phone ? ` • ${item.party.phone}` : ""}
                      {item.party?.email ? ` • ${item.party.email}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Início: {formatDateTime(item.startsAt)} • Fim: {formatDateTime(item.endsAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatRecordOrigin(item.origin)}</p>
                    {item.notes ? <p className="text-sm">Notas: {item.notes}</p> : null}
                  </div>
                  <div className="flex shrink-0 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      disabled={deletingId === item.id}
                      onClick={() => setPendingDelete(item)}
                    >
                      {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      <span className="ml-2">Excluir</span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {!loadingList && filteredReminders.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhum lembrete encontrado para os filtros selecionados.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jornada agent-first Lembretes</CardTitle>
          <CardDescription>Fluxo recomendado para operar lembretes com especialistas no runtime de times.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <p>1. Abra o time operacional recomendado e entre na aba de chat/debug.</p>
            <p>2. Use um starter prompt para triagem de pendências, reexecução e follow-up.</p>
            <p>3. Execute o fluxo via especialista e valide nesta tela os estados finais.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <Link href={operationHref}>
                {recommendedTeam ? `Operar no time "${recommendedTeam.name}"` : "Criar time para operar Lembretes"}
              </Link>
            </Button>
            <span className="text-xs text-muted-foreground">Entrada padrão da vertical: operação via time + especialista.</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {starterPrompts.map((prompt) => (
              <Button
                key={prompt}
                type="button"
                variant="outline"
                className="h-auto justify-start whitespace-normal text-left text-xs"
                onClick={() => void handleCopyPrompt(prompt)}
              >
                <Clipboard className="mr-2 h-3.5 w-3.5 shrink-0" />
                {prompt}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Readiness Lembretes</CardTitle>
          <CardDescription>Indicadores rápidos para troubleshooting da execução de lembretes.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Total" value={readiness?.total} />
          <MetricCard label="Ativos" value={readiness?.active} />
          <MetricCard label="Cancelados" value={readiness?.cancelled} />
          <MetricCard label="Concluídos" value={readiness?.completed} />
          <MetricCard label="No-show" value={readiness?.noShow} />
          <MetricCard label="Com contexto de care" value={readiness?.withCareContext} />
        </CardContent>
        <CardContent className="space-y-2 pt-0">
          <p className="text-xs text-muted-foreground">
            Saúde atual: <strong>{readiness?.health ?? "—"}</strong> • Gerado em{" "}
            {readiness?.generatedAt ? new Date(readiness.generatedAt).toLocaleString() : "—"}
          </p>
          <div className="space-y-1">
            {(readiness?.checks ?? []).map((check) => (
              <div key={check.code} className="rounded-md border p-2 text-xs">
                <p className="font-medium">
                  [{check.status}] {check.message} ({check.value})
                </p>
                <p className="text-muted-foreground">{check.nextStep}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lembrete?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `O lembrete "${pendingDelete.title}" será removido permanentemente. Essa ação exige permissão de admin e pode falhar se houver vínculos operacionais.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={!!deletingId} onClick={() => void confirmDelete()}>
              {deletingId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar exclusão
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{typeof value === "number" ? value : "—"}</p>
    </div>
  )
}
