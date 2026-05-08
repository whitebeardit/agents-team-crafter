"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Clipboard, Loader2, NotebookPen, RefreshCw, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { AgentFirstVerticalStandard } from "@/components/verticals/agent-first-vertical-standard"
import { useOperationTeamResolution } from "@/lib/agent-first/use-operation-team-resolution"
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
import type { ClinicalReadiness, ClinicalSessionListItem, CrmParty, ScheduleAppointmentsDayResponse, Team } from "@/lib/types"

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

function buildReadiness(sessions: ClinicalSessionListItem[]): ClinicalReadiness {
  const total = sessions.length
  const completed = sessions.filter((item) => item.status === "completed").length
  const withNotes = sessions.filter((item) => Boolean(item.notes?.trim())).length
  const noShow = sessions.filter((item) => item.status === "no_show").length
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
  const noteCoverageRate = total > 0 ? Math.round((withNotes / total) * 100) : 0
  const health: ClinicalReadiness["health"] = total === 0 ? "critical" : completionRate < 40 ? "attention" : "ok"

  return {
    total,
    completed,
    withNotes,
    noShow,
    completionRate,
    noteCoverageRate,
    health,
    generatedAt: new Date().toISOString(),
    checks: [
      {
        code: "clinical_has_sessions",
        status: total > 0 ? "ok" : "critical",
        message: total > 0 ? "Há sessões clínicas no período." : "Nenhuma sessão clínica no período.",
        nextStep: total > 0 ? "Revisar qualidade de registro e evolução." : "Ampliar período ou validar execução do time.",
        value: total,
      },
      {
        code: "clinical_completion_rate",
        status: completionRate >= 50 ? "ok" : completionRate >= 30 ? "attention" : "critical",
        message: "Taxa de sessões concluídas",
        nextStep: "Revisar sessões pendentes/no-show com especialista clínico.",
        value: completionRate,
      },
      {
        code: "clinical_note_coverage",
        status: noteCoverageRate >= 60 ? "ok" : noteCoverageRate >= 40 ? "attention" : "critical",
        message: "Cobertura de notas clínicas",
        nextStep: "Completar notas de evolução para sessões sem documentação.",
        value: noteCoverageRate,
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

export default function ClinicalPage() {
  const { token, refreshToken, currentWorkspace, setPrimaryOperationTeamForWorkspace } = useWorkspaceStore()
  const [loading, setLoading] = useState(false)
  const [teamCandidates, setTeamCandidates] = useState<Team[]>([])
  const { operationTeam, usesPinnedPrimary } = useOperationTeamResolution(teamCandidates)
  const [startDate, setStartDate] = useState(addDays(todayDateString(), -30))
  const [endDate, setEndDate] = useState(todayDateString)
  const [searchQuery, setSearchQuery] = useState("")
  const [sessions, setSessions] = useState<ClinicalSessionListItem[]>([])
  const [readiness, setReadiness] = useState<ClinicalReadiness | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ClinicalSessionListItem | null>(null)

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
      const teamRes = await api.get<Team[]>("/teams?status=active&page=1&perPage=100")
      setTeamCandidates(teamRes.data)
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Não foi possível carregar o time recomendado para Clinical."
      toast.error(msg)
      setTeamCandidates([])
    } finally {
      setLoading(false)
    }
  }, [api, token, currentWorkspace])

  useEffect(() => {
    void loadRecommendedTeam()
  }, [loadRecommendedTeam])

  const loadClinicalSessions = useCallback(async () => {
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
      const scoped = merged.filter((item) => Boolean(item.careSubjectId))
      const deduped = Array.from(new Map(scoped.map((item) => [item.id, item])).values())
      const ordered = deduped.sort((a, b) => a.startsAt.localeCompare(b.startsAt))

      const partyIds = [...new Set(ordered.map((item) => item.partyId).filter(Boolean))]
      const partiesById: Record<string, CrmParty> = {}
      await Promise.all(
        partyIds.map(async (id) => {
          try {
            const partyRes = await api.get<CrmParty>(`/parties/${id}`)
            if (partyRes.data?.id) partiesById[id] = partyRes.data
          } catch {
            // party pode estar indisponível para o utilizador atual.
          }
        }),
      )

      const rows: ClinicalSessionListItem[] = ordered.map((item) => ({
        id: item.id,
        title: item.title,
        partyId: item.partyId,
        careSubjectId: item.careSubjectId,
        encounterId: item.encounterId,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        notes: item.notes,
        status: item.status,
        origin: item.origin,
        party: partiesById[item.partyId] ?? null,
      }))
      setSessions(rows)
      setReadiness(buildReadiness(rows))
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Não foi possível carregar as sessões clínicas."
      toast.error(msg)
      setSessions([])
      setReadiness(buildReadiness([]))
    } finally {
      setLoadingList(false)
    }
  }, [api, token, currentWorkspace, startDate, endDate])

  useEffect(() => {
    void loadClinicalSessions()
  }, [loadClinicalSessions])

  const operationHref = operationTeam ? `/teams/${operationTeam.id}?tab=debug` : "/teams/create"
  const auxiliaryTeamLinks = operationTeam
    ? [
        { label: "Consola do time", href: `/teams/${operationTeam.id}` },
        { label: "Escritório virtual", href: `/teams/${operationTeam.id}/office` },
      ]
    : []

  const starterPrompts = [
    "Resuma evolução clínica recente da paciente X com foco em riscos e próximos passos.",
    "Liste sessões com no-show desta semana e proponha plano de follow-up.",
    "Mostre sessões sem nota clínica e gere uma lista de pendências para fechamento.",
  ]

  const handleCopyPrompt = useCallback(async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
      toast.success("Prompt copiado. Cole no chat do time para operar Clinical.")
    } catch {
      toast.error("Não foi possível copiar o prompt.")
    }
  }, [])

  const filteredSessions = sessions.filter((item) => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    const haystack = [
      item.id,
      item.title,
      item.partyId,
      item.careSubjectId ?? "",
      item.encounterId ?? "",
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
      toast.success("Sessão clínica removida.")
      setPendingDelete(null)
      await loadClinicalSessions()
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? `${e.message} (a deleção exige permissão de admin e pode ser bloqueada por vínculos).`
          : "Não foi possível excluir a sessão clínica."
      toast.error(msg)
    } finally {
      setDeletingId(null)
    }
  }, [api, pendingDelete, loadClinicalSessions])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <NotebookPen className="h-7 w-7 text-primary" />
            Clinical
          </h1>
          <p className="text-sm text-muted-foreground">
            Vertical clínica orientada a operação via especialistas. Esta tela atende auditoria manual e monitoramento inicial.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadRecommendedTeam()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar
        </Button>
      </div>

      <AgentFirstVerticalStandard
        verticalName="Clinical"
        summary="Vertical clínica com operação principal via time especialista; UI manual usada para auditoria de sessões e qualidade de registro."
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
            Sessões no período: <strong>{readiness?.total ?? 0}</strong>. Conclusão: <strong>{readiness?.completionRate ?? 0}%</strong>.
          </p>
        }
        specialistName="Especialista Clínico"
        teamRecommendation="Um time por negócio; Clinical exige careSubjectId (Care) e Party (CRM) — evite vocabular misto na conversa."
        ctaHref={operationHref}
        ctaLabel={operationTeam ? `Abrir operação no time "${operationTeam.name}"` : "Criar time operacional"}
        starterPrompts={starterPrompts}
        fallbackGuidance="Use este espaço para revisar sessões, cobertura de notas e consistência do contexto clínico em casos priorizados."
        primaryTeamHint={
          usesPinnedPrimary && operationTeam
            ? `Time principal da operação: «${operationTeam.name}». As outras verticais abrem o mesmo time por defeito.`
            : undefined
        }
        auxiliaryLinks={auxiliaryTeamLinks}
        pinPrimaryTeam={
          operationTeam && currentWorkspace
            ? {
                isPinned: usesPinnedPrimary,
                onPin: () => {
                  setPrimaryOperationTeamForWorkspace(currentWorkspace.id, operationTeam.id)
                  toast.success(`«${operationTeam.name}» é agora o time principal em todas as verticais.`)
                },
                onUnpin: () => {
                  setPrimaryOperationTeamForWorkspace(currentWorkspace.id, null)
                  toast.success("Preferência de time principal removida.")
                },
              }
            : undefined
        }
        troubleshootingItems={[
          "Verifique se as sessões possuem careSubjectId e notas mínimas.",
          "Defina um time principal se existirem vários times ativos.",
          "Antes de excluir, valide impactos em histórico clínico e financeiro.",
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Sessões clínicas (auditoria manual)</CardTitle>
          <CardDescription>Pesquisa por intervalo de até 31 dias, busca textual e exclusão com confirmação.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="clinical-start-date">Início</Label>
              <Input id="clinical-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clinical-end-date">Fim</Label>
              <Input id="clinical-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clinical-search">Pesquisa</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="clinical-search"
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Paciente, sessão, careSubjectId, encounterId, telefone ou nota"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => void loadClinicalSessions()} disabled={loadingList}>
              {loadingList ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Recarregar lista
            </Button>
          </div>

          <div className="space-y-3">
            {filteredSessions.map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{item.title}</p>
                      <Badge variant={item.status === "completed" ? "default" : "secondary"}>{statusLabel(item.status)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Sessão ID: {item.id}</p>
                    <p className="text-xs text-muted-foreground">careSubjectId: {item.careSubjectId ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">encounterId: {item.encounterId ?? "—"}</p>
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
            {!loadingList && filteredSessions.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhuma sessão clínica encontrada para os filtros selecionados.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jornada agent-first Clinical</CardTitle>
          <CardDescription>Fluxo recomendado para operação clínica com especialistas no runtime de times.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <p>1. Abra o time operacional recomendado e entre na aba de chat/debug.</p>
            <p>2. Use um starter prompt para evolução clínica, pendências ou follow-up.</p>
            <p>3. Execute o fluxo no especialista e valide aqui a consistência dos registos.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <Link href={operationHref}>
                {operationTeam ? `Operar no time "${operationTeam.name}"` : "Criar time para operar Clinical"}
              </Link>
            </Button>
            <span className="text-xs text-muted-foreground">
              {operationTeam
                ? usesPinnedPrimary
                  ? "Time principal definido: verticais sugerem este time."
                  : "Entrada padrão da vertical: operação via time + especialista."
                : "Sem time ativo: crie um time após publicar o template clínico."}
            </span>
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
          <CardTitle>Readiness Clinical</CardTitle>
          <CardDescription>Indicadores rápidos para troubleshooting clínico no período selecionado.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Total" value={readiness?.total} />
          <MetricCard label="Concluídas" value={readiness?.completed} />
          <MetricCard label="No-show" value={readiness?.noShow} />
          <MetricCard label="Com notas" value={readiness?.withNotes} />
          <MetricCard label="Conclusão (%)" value={readiness?.completionRate} />
          <MetricCard label="Cobertura de notas (%)" value={readiness?.noteCoverageRate} />
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
            <AlertDialogTitle>Excluir sessão clínica?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `A sessão "${pendingDelete.title}" será removida permanentemente. Essa ação exige permissão de admin e pode falhar se houver vínculos operacionais.`
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
