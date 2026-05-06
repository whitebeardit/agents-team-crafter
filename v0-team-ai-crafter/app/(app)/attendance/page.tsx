"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Clipboard, Headset, Loader2, RefreshCw, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { AgentFirstVerticalStandard } from "@/components/verticals/agent-first-vertical-standard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ApiError, createApiClient } from "@/lib/api/client"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { CrmParty, ScheduleAppointmentsDayResponse, ScheduleAppointment, Team } from "@/lib/types"

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

export default function AttendancePage() {
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [loading, setLoading] = useState(false)
  const [recommendedTeam, setRecommendedTeam] = useState<Team | null>(null)
  const [startDate, setStartDate] = useState(todayDateString)
  const [endDate, setEndDate] = useState(todayDateString)
  const [searchQuery, setSearchQuery] = useState("")
  const [appointments, setAppointments] = useState<ScheduleAppointment[]>([])
  const [partiesById, setPartiesById] = useState<Record<string, CrmParty>>({})
  const [loadingList, setLoadingList] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ScheduleAppointment | null>(null)

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
      const msg = e instanceof ApiError ? e.message : "Não foi possível carregar o time recomendado para Atendimento."
      toast.error(msg)
      setRecommendedTeam(null)
    } finally {
      setLoading(false)
    }
  }, [api, token, currentWorkspace])

  useEffect(() => {
    void loadRecommendedTeam()
  }, [loadRecommendedTeam])

  const loadAttendanceList = useCallback(async () => {
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
      const deduped = Array.from(new Map(merged.map((item) => [item.id, item])).values())
      const onlyCompleted = deduped.filter((item) => item.status === "completed")
      setAppointments(onlyCompleted)

      const partyIds = [...new Set(onlyCompleted.map((item) => item.partyId).filter(Boolean))]
      const parties: Record<string, CrmParty> = {}
      await Promise.all(
        partyIds.map(async (id) => {
          try {
            const partyRes = await api.get<CrmParty>(`/parties/${id}`)
            if (partyRes.data?.id) parties[id] = partyRes.data
          } catch {
            /* sem party visível para o usuário */
          }
        }),
      )
      setPartiesById(parties)
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Não foi possível carregar os atendimentos."
      toast.error(msg)
      setAppointments([])
      setPartiesById({})
    } finally {
      setLoadingList(false)
    }
  }, [api, token, currentWorkspace, startDate, endDate])

  useEffect(() => {
    void loadAttendanceList()
  }, [loadAttendanceList])

  const operationHref = recommendedTeam ? `/teams/${recommendedTeam.id}?tab=debug` : "/teams/create"

  const starterPrompts = [
    "Registre o atendimento da paciente X às 14:00 com resumo do que foi realizado.",
    "Mostre os atendimentos da paciente X nesta semana e a evolução associada.",
    "Valide se há sessão agendada elegível para registrar atendimento agora.",
  ]

  const handleCopyPrompt = useCallback(async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
      toast.success("Prompt copiado. Cole no chat do time para operar Atendimento.")
    } catch {
      toast.error("Não foi possível copiar o prompt.")
    }
  }, [])

  const filteredAppointments = appointments.filter((item) => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    const party = partiesById[item.partyId]
    const haystack = [
      item.title,
      item.id,
      item.partyId,
      item.notes ?? "",
      party?.displayName ?? "",
      party?.email ?? "",
      party?.phone ?? "",
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
      toast.success("Atendimento removido.")
      setPendingDelete(null)
      await loadAttendanceList()
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? `${e.message} (a deleção exige permissão de admin).`
          : "Não foi possível excluir o atendimento."
      toast.error(msg)
    } finally {
      setDeletingId(null)
    }
  }, [api, pendingDelete, loadAttendanceList])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Headset className="h-7 w-7 text-primary" />
            Atendimento
          </h1>
          <p className="text-sm text-muted-foreground">
            Vertical em fase 1 com operação principal via especialistas do time. Esta página oferece entrada guiada e auditoria manual inicial.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadRecommendedTeam()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar
        </Button>
      </div>

      <AgentFirstVerticalStandard
        verticalName="Atendimento"
        summary="Vertical orientada a execução via especialista; esta tela manual é baseline para apoio operacional e auditoria inicial."
        readinessTitle="Readiness da fase 1"
        readinessStatusLabel={recommendedTeam ? "Pronto para operar via time" : "Dependente de time ativo"}
        readinessStatusTone={recommendedTeam ? "default" : "secondary"}
        readinessContent={
          <p>
            {recommendedTeam
              ? `Time recomendado detectado: ${recommendedTeam.name}.`
              : "Nenhum time ativo detectado. Crie um time para iniciar a operação agent-first."}
          </p>
        }
        specialistName="Especialista de Atendimento"
        teamRecommendation="Mesmo time operacional com especialistas clínicos e de agenda"
        ctaHref={operationHref}
        ctaLabel={recommendedTeam ? `Abrir operação no time "${recommendedTeam.name}"` : "Criar time operacional"}
        starterPrompts={starterPrompts}
        fallbackGuidance="Use este espaço para entrada inicial da vertical enquanto os fluxos específicos de atendimento evoluem no frontend."
        troubleshootingItems={[
          "Confirme se existe time ativo para operar via especialista.",
          "Valide se a paciente/contato já está identificado no CRM.",
          "Use o histórico de agenda para localizar a sessão antes do registro de atendimento.",
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Jornada agent-first Atendimento</CardTitle>
          <CardDescription>Fluxo recomendado para operar Atendimento com especialistas no runtime de times.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <p>1. Abra o time operacional recomendado e entre na aba de chat/debug.</p>
            <p>2. Use um starter prompt para iniciar o registro ou auditoria de atendimento.</p>
            <p>3. Execute o fluxo de atendimento via especialista e valide o resultado operacional.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <Link href={operationHref}>
                {recommendedTeam ? `Operar no time "${recommendedTeam.name}"` : "Criar time para operar Atendimento"}
              </Link>
            </Button>
            <span className="text-xs text-muted-foreground">
              Entrada padrão da vertical: operação via time + especialista.
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
          <CardTitle>Atendimentos concluídos (auditoria manual)</CardTitle>
          <CardDescription>
            Nesta fase da UI é possível pesquisar, listar e excluir atendimentos concluídos. Criação e atualização seguem via especialista.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="attendance-start-date">Início</Label>
              <Input
                id="attendance-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="attendance-end-date">Fim</Label>
              <Input id="attendance-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1.5 md:col-span-1">
              <Label htmlFor="attendance-search">Pesquisa</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="attendance-search"
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar por paciente, título, ID, telefone, e-mail ou nota"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => void loadAttendanceList()} disabled={loadingList}>
              {loadingList ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Recarregar lista
            </Button>
          </div>

          <div className="space-y-3">
            {filteredAppointments.map((item) => {
              const party = partiesById[item.partyId]
              return (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{item.title}</p>
                        <Badge variant="secondary">Concluído</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Atendimento ID: {item.id}</p>
                      <p className="text-sm text-muted-foreground">
                        Paciente: {party?.displayName ?? item.partyId}
                        {party?.phone ? ` • ${party.phone}` : ""}
                        {party?.email ? ` • ${party.email}` : ""}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Início: {formatDateTime(item.startsAt)} • Fim: {formatDateTime(item.endsAt)}
                      </p>
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
              )
            })}

            {!loadingList && filteredAppointments.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhum atendimento concluído encontrado para os filtros selecionados.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir atendimento?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `O atendimento "${pendingDelete.title}" será removido permanentemente. Essa ação exige permissão de admin e não pode ser desfeita.`
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
