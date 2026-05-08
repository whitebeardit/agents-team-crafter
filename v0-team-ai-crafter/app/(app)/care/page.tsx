"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Clipboard, HeartPulse, Loader2, RefreshCw, Search, Trash2 } from "lucide-react"
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
import type { CareCaseListItem, CareReadiness, CrmParty, ScheduleAppointmentsDayResponse, Team } from "@/lib/types"

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

function buildReadiness(cases: CareCaseListItem[]): CareReadiness {
  const total = cases.length
  const completed = cases.filter((item) => item.status === "completed").length
  const cancelled = cases.filter((item) => item.status === "cancelled").length
  const noShow = cases.filter((item) => item.status === "no_show").length
  const withNotes = cases.filter((item) => Boolean(item.notes?.trim())).length
  const withClinicalLink = cases.filter((item) => Boolean(item.careSubjectId)).length
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
  const health: CareReadiness["health"] = total === 0 ? "critical" : noShow > completed ? "attention" : "ok"
  const generatedAt = new Date().toISOString()

  return {
    total,
    completed,
    cancelled,
    noShow,
    withNotes,
    withClinicalLink,
    completionRate,
    health,
    generatedAt,
    checks: [
      {
        code: "care_has_cases",
        status: total > 0 ? "ok" : "critical",
        message: total > 0 ? "Há casos de cuidado no período." : "Nenhum caso de cuidado encontrado no período.",
        nextStep: total > 0 ? "Validar distribuição por estado na listagem." : "Ampliar o intervalo ou revisar operação do time.",
        value: total,
      },
      {
        code: "care_completion_rate",
        status: completionRate >= 50 ? "ok" : completionRate >= 25 ? "attention" : "critical",
        message: "Taxa de casos concluídos no período",
        nextStep: "Usar especialista para revisar bloqueios e follow-up.",
        value: completionRate,
      },
      {
        code: "care_has_clinical_link",
        status: withClinicalLink > 0 ? "ok" : "attention",
        message: "Casos com vínculo clínico (careSubjectId)",
        nextStep: "Confirmar contexto clínico antes de novas mutações operacionais.",
        value: withClinicalLink,
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

export default function CarePage() {
  const { token, refreshToken, currentWorkspace, setPrimaryOperationTeamForWorkspace } = useWorkspaceStore()
  const [loading, setLoading] = useState(false)
  const [teamCandidates, setTeamCandidates] = useState<Team[]>([])
  const { operationTeam, usesPinnedPrimary } = useOperationTeamResolution(teamCandidates)
  const [startDate, setStartDate] = useState(addDays(todayDateString(), -30))
  const [endDate, setEndDate] = useState(todayDateString)
  const [searchQuery, setSearchQuery] = useState("")
  const [careCases, setCareCases] = useState<CareCaseListItem[]>([])
  const [readiness, setReadiness] = useState<CareReadiness | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<CareCaseListItem | null>(null)

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
      const msg = e instanceof ApiError ? e.message : "Não foi possível carregar o time recomendado para Care."
      toast.error(msg)
      setTeamCandidates([])
    } finally {
      setLoading(false)
    }
  }, [api, token, currentWorkspace])

  useEffect(() => {
    void loadRecommendedTeam()
  }, [loadRecommendedTeam])

  const loadCareCases = useCallback(async () => {
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
      const careScoped = merged.filter((item) => Boolean(item.careSubjectId))
      const deduped = Array.from(new Map(careScoped.map((item) => [item.id, item])).values())
      const ordered = deduped.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      const partyIds = [...new Set(ordered.map((item) => item.partyId).filter(Boolean))]
      const partiesById: Record<string, CrmParty> = {}
      await Promise.all(
        partyIds.map(async (id) => {
          try {
            const partyRes = await api.get<CrmParty>(`/parties/${id}`)
            if (partyRes.data?.id) partiesById[id] = partyRes.data
          } catch {
            // Ignora party sem permissao visivel para o usuario.
          }
        }),
      )

      const rows: CareCaseListItem[] = ordered.map((item) => ({
        id: item.id,
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
      setCareCases(rows)
      setReadiness(buildReadiness(rows))
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Não foi possível carregar os casos de Care."
      toast.error(msg)
      setCareCases([])
      setReadiness(buildReadiness([]))
    } finally {
      setLoadingList(false)
    }
  }, [api, token, currentWorkspace, startDate, endDate])

  useEffect(() => {
    void loadCareCases()
  }, [loadCareCases])

  const operationHref = operationTeam ? `/teams/${operationTeam.id}?tab=debug` : "/teams/create"
  const auxiliaryTeamLinks = operationTeam
    ? [
        { label: "Consola do time", href: `/teams/${operationTeam.id}` },
        { label: "Escritório virtual", href: `/teams/${operationTeam.id}/office` },
      ]
    : []

  const starterPrompts = [
    "Liste os casos de cuidado ativos da paciente X e próximos passos.",
    "Resuma evolução recente e sinalize riscos de continuidade de cuidado.",
    "Priorize casos com falta/no-show e proponha follow-up para hoje.",
  ]

  const handleCopyPrompt = useCallback(async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
      toast.success("Prompt copiado. Cole no chat do time para operar Care.")
    } catch {
      toast.error("Não foi possível copiar o prompt.")
    }
  }, [])

  const filteredCases = careCases.filter((item) => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    const haystack = [
      item.id,
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
      toast.success("Caso de Care removido.")
      setPendingDelete(null)
      await loadCareCases()
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? `${e.message} (a deleção exige permissão de admin e pode ser bloqueada por vínculos).`
          : "Não foi possível excluir o caso de Care."
      toast.error(msg)
    } finally {
      setDeletingId(null)
    }
  }, [api, pendingDelete, loadCareCases])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <HeartPulse className="h-7 w-7 text-primary" />
            Care
          </h1>
          <p className="text-sm text-muted-foreground">
            Vertical com operação principal via especialistas do time. Esta UI cobre auditoria manual de casos com contexto clínico.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadRecommendedTeam()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar
        </Button>
      </div>

      <AgentFirstVerticalStandard
        verticalName="Care"
        summary="Vertical orientada à continuidade de cuidado via especialistas; esta tela manual é secundária para auditoria e apoio operacional."
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
            Casos no período: <strong>{readiness?.total ?? 0}</strong>. Taxa de conclusão:{" "}
            <strong>{readiness?.completionRate ?? 0}%</strong>.
          </p>
        }
        specialistName="Especialista de Care"
        teamRecommendation="Um time por negócio; Care partilha Party (CRM) e careSubjectId com Clinical e agenda."
        ctaHref={operationHref}
        ctaLabel={operationTeam ? `Abrir operação no time "${operationTeam.name}"` : "Criar time operacional"}
        starterPrompts={starterPrompts}
        fallbackGuidance="Use esta tela para inspeção manual de casos, triagem de inconsistências e suporte ao troubleshooting da operação agent-first."
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
          "Confirme se há time ativo antes de operar via especialista.",
          "Defina um time principal se existirem vários times ativos.",
          "Antes de excluir, valide possíveis dependências clínicas e operacionais.",
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Casos de Care (auditoria manual)</CardTitle>
          <CardDescription>Pesquisa por intervalo de até 31 dias, busca textual e exclusão com confirmação.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="care-start-date">Início</Label>
              <Input id="care-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="care-end-date">Fim</Label>
              <Input id="care-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="care-search">Pesquisa</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="care-search"
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Paciente, ID, careSubjectId, título, telefone ou nota"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => void loadCareCases()} disabled={loadingList}>
              {loadingList ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Recarregar lista
            </Button>
          </div>

          <div className="space-y-3">
            {filteredCases.map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{item.title}</p>
                      <Badge variant={item.status === "completed" ? "default" : "secondary"}>{statusLabel(item.status)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Caso ID: {item.id}</p>
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
            {!loadingList && filteredCases.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhum caso de Care encontrado para os filtros selecionados.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jornada agent-first Care</CardTitle>
          <CardDescription>Fluxo recomendado para operar continuidade de cuidado via time especialista.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <p>1. Abra o time operacional recomendado e entre na aba de chat/debug.</p>
            <p>2. Use um starter prompt para orientar priorização, follow-up ou revisão de evolução.</p>
            <p>3. Execute o fluxo via especialista e use esta tela para validação manual quando necessário.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <Link href={operationHref}>
                {operationTeam ? `Operar no time "${operationTeam.name}"` : "Criar time para operar Care"}
              </Link>
            </Button>
            <span className="text-xs text-muted-foreground">
              {operationTeam
                ? usesPinnedPrimary
                  ? "Time principal definido: verticais sugerem este time."
                  : "Entrada padrão da vertical: operação via time + especialista."
                : "Sem time ativo: crie um time para operar em modo agent-first."}
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
          <CardTitle>Readiness Care</CardTitle>
          <CardDescription>Indicadores rápidos para troubleshooting da vertical Care.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Total" value={readiness?.total} />
          <MetricCard label="Concluídos" value={readiness?.completed} />
          <MetricCard label="Cancelados" value={readiness?.cancelled} />
          <MetricCard label="No-show" value={readiness?.noShow} />
          <MetricCard label="Com notas" value={readiness?.withNotes} />
          <MetricCard label="Com vínculo clínico" value={readiness?.withClinicalLink} />
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
            <AlertDialogTitle>Excluir caso de Care?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `O caso "${pendingDelete.title}" será removido permanentemente. Essa ação exige permissão de admin e pode falhar se houver vínculos operacionais.`
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
