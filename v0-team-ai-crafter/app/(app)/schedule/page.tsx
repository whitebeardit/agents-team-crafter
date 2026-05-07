"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { CalendarDays, CheckCircle2, ChevronsUpDown, Clipboard, Loader2, RefreshCw } from "lucide-react"
import { ApiError, createApiClient } from "@/lib/api/client"
import { formatRecordOrigin } from "@/lib/format-record-origin"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import type { CrmParty, ScheduleAgendaResponse, ScheduleAppointment, Team } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ContextualTourHost, ContextualTourManualTrigger } from "@/components/onboarding/contextual-tour"
import { ResponsiveTableScroll } from "@/components/ui/responsive-table"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Switch } from "@/components/ui/switch"
import { CreatePartyDialog } from "@/components/schedule/create-party-dialog"
import { AgentFirstVerticalStandard } from "@/components/verticals/agent-first-vertical-standard"
type ScheduleGoldGate = {
  approved: boolean
  evaluatedAt: string
  criteria: Array<{
    code: string
    label: string
    passed: boolean
    detail: string
  }>
}
function todayDateString() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function formatTimeRange(startsAt: string, endsAt: string) {
  try {
    const a = new Date(startsAt)
    const b = new Date(endsAt)
    return `${a.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} – ${b.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
  } catch {
    return `${startsAt} – ${endsAt}`
  }
}

const STATUS_PT: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  no_show: "Falta",
  completed: "Concluído",
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "confirmed":
      return "border-blue-500/30 bg-blue-500/10 text-blue-200"
    case "completed":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
    case "cancelled":
      return "border-muted bg-muted/50 text-muted-foreground"
    case "no_show":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200"
    default:
      return "border-border bg-muted/30"
  }
}

export default function SchedulePage() {
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [date, setDate] = useState(todayDateString)
  const [showCancelled, setShowCancelled] = useState(true)
  const [loading, setLoading] = useState(false)
  const [agenda, setAgenda] = useState<ScheduleAgendaResponse | null>(null)
  const [goldGate, setGoldGate] = useState<ScheduleGoldGate | null>(null)
  const [partiesById, setPartiesById] = useState<Record<string, CrmParty>>({})
  const [recommendedTeam, setRecommendedTeam] = useState<Team | null>(null)

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

  const loadAgenda = useCallback(async () => {
    if (!token || !currentWorkspace) return
    setLoading(true)
    try {
      const qs = new URLSearchParams({
        date,
        includeCancelled: showCancelled ? "true" : "false",
      })
      const [res, gate, teamRes] = await Promise.all([
        api.get<ScheduleAgendaResponse>(`/schedule/agenda?${qs.toString()}`),
        api.get<ScheduleGoldGate>(`/schedule/gold-gate?date=${encodeURIComponent(date)}`),
        api.get<Team[]>("/teams?status=active&page=1&perPage=1"),
      ])
      setAgenda(res.data)
      setGoldGate(gate.data)
      setRecommendedTeam(teamRes.data[0] ?? null)
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Não foi possível carregar a agenda."
      toast.error(msg)
      setAgenda(null)
    } finally {
      setLoading(false)
    }
  }, [api, date, showCancelled, token, currentWorkspace])

  useEffect(() => {
    void loadAgenda()
  }, [loadAgenda])

  useEffect(() => {
    if (!agenda?.appointments?.length || !token || !currentWorkspace) return
    const ids = [...new Set(agenda.appointments.map((a) => a.partyId))]
    let cancelled = false
    void (async () => {
      const next: Record<string, CrmParty> = {}
      await Promise.all(
        ids.map(async (id) => {
          try {
            const r = await api.get<CrmParty>(`/parties/${id}`)
            if (r.data?.id) next[id] = r.data
          } catch {
            /* contato removido ou sem permissão */
          }
        }),
      )
      if (!cancelled) setPartiesById((prev) => ({ ...prev, ...next }))
    })()
    return () => {
      cancelled = true
    }
  }, [agenda?.appointments, api, token, currentWorkspace])

  const operationHref = recommendedTeam ? `/teams/${recommendedTeam.id}?tab=debug` : "/teams/create"

  const starterPrompts = [
    "Mostre os próximos horários livres para o cliente X esta semana.",
    "Reagende o compromisso Y para o próximo horário disponível.",
    "Liste no-shows do dia e proponha follow-up automático.",
  ]

  const handleCopyPrompt = useCallback(async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
      toast.success("Prompt copiado. Cole no chat do time para operar a agenda.")
    } catch {
      toast.error("Não foi possível copiar o prompt.")
    }
  }, [])

  return (
    <div className="space-y-6 max-w-6xl">
      <ContextualTourHost screenKey="schedule" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-7 w-7 text-primary" />
            Agenda
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Painel de auditoria manual. A entrada operacional padrão da agenda continua sendo via especialistas no runtime de times.
          </p>
          <ContextualTourManualTrigger screenKey="schedule" className="mt-3" />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="schedule-date">Dia</Label>
            <Input
              id="schedule-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-[11rem]"
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch
              id="show-cancelled"
              checked={showCancelled}
              onCheckedChange={(v) => setShowCancelled(Boolean(v))}
            />
            <Label htmlFor="show-cancelled" className="text-sm font-normal cursor-pointer">
              Mostrar cancelados
            </Label>
          </div>
          <Button type="button" variant="outline" size="icon" onClick={() => void loadAgenda()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button asChild type="button">
            <Link href="/teams">Operar via especialista</Link>
          </Button>
        </div>
      </div>

      <AgentFirstVerticalStandard
        verticalName="Scheduling"
        summary="Vertical de agenda com operação principal via time e especialistas; UI manual usada para auditoria e suporte."
        readinessTitle="Readiness / GOLD gate do dia"
        readinessStatusLabel={goldGate?.approved ? "GOLD aprovado" : "GOLD pendente"}
        readinessStatusTone={goldGate?.approved ? "default" : "secondary"}
        readinessContent={
          <p>
            Dia selecionado: <strong>{date}</strong>. Gate:{" "}
            <strong>{goldGate?.approved ? "aprovado" : "pendente"}</strong>.
          </p>
        }
        specialistName="Especialista de Agenda"
        teamRecommendation="Mesmo time operacional do negócio com foco em scheduling"
        ctaHref={operationHref}
        ctaLabel={recommendedTeam ? `Abrir operação no time "${recommendedTeam.name}"` : "Criar time operacional"}
        starterPrompts={starterPrompts}
        fallbackGuidance="Use esta tela para auditar compromissos, confirmar estado operacional e apoiar troubleshooting quando o fluxo agent-first precisar de validação manual."
        troubleshootingItems={[
          "Confira se o gate GOLD do dia está pendente por volume de cancelamentos/no-shows.",
          "Valide se o time recomendado está ativo antes de operar via especialista.",
          "Use tabela manual para auditar horários e estados antes de reexecutar no runtime.",
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Jornada agent-first Scheduling (Loop 132)</CardTitle>
          <CardDescription>
            Fluxo recomendado para operar a agenda pelo time especialista e usar esta tela apenas para auditoria manual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {[
              "Abra o time operacional e entre no chat/debug para iniciar a operação.",
              "Use um starter prompt para consulta, reagendamento ou follow-up.",
              "Execute confirmações, no-show e conclusão via especialista de agenda.",
              "Retorne nesta página para auditar o estado final e o gate do dia.",
            ].map((step) => (
              <div key={step} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                <p>{step}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <Link href={operationHref}>
                {recommendedTeam ? `Operar no time "${recommendedTeam.name}"` : "Criar time para operar agenda"}
              </Link>
            </Button>
            <span className="text-xs text-muted-foreground">
              {recommendedTeam
                ? "Entrada padrão da agenda: operação via time + especialista."
                : "Sem time ativo detectado: crie um time para iniciar a operação agent-first."}
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
          <CardTitle>Gate Scheduling GOLD (Loop 121)</CardTitle>
          <CardDescription>Sinal operacional do aceite GOLD para a agenda do dia.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">
            Status:{" "}
            <strong className={goldGate?.approved ? "text-emerald-600" : "text-amber-600"}>
              {goldGate?.approved ? "Aprovado" : "Pendente"}
            </strong>
          </p>
          <p className="text-xs text-muted-foreground">
            Avaliado em {goldGate?.evaluatedAt ? new Date(goldGate.evaluatedAt).toLocaleString() : "—"}
          </p>
          <div className="space-y-1">
            {(goldGate?.criteria ?? []).map((item) => (
              <div key={item.code} className="rounded-md border p-2 text-xs">
                <p className="font-medium">
                  {item.passed ? "✅" : "⚠️"} {item.label}
                </p>
                <p className="text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Este ecrã é exclusivo para <strong>auditoria manual</strong> do que os especialistas fizeram.
          Para criar/editar/cancelar/reagendar compromissos, utilize um time com especialista de agenda em <strong>/teams</strong>.
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Compromissos</CardTitle>
            <CardDescription>
              Horários e estado operacional do dia para auditoria humana (sem mutações diretas por esta tela).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!agenda?.appointments?.length ? (
              <p className="text-sm text-muted-foreground">Nenhum compromisso neste dia.</p>
            ) : (
              <ResponsiveTableScroll>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Horário</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Auditoria</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agenda.appointments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap font-mono text-xs">
                          {formatTimeRange(a.startsAt, a.endsAt)}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{a.title}</div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div
                              className="text-xs text-muted-foreground truncate max-w-[200px]"
                              title={
                                partiesById[a.partyId]?.displayName
                                  ? `${partiesById[a.partyId]!.displayName} · ${a.partyId}`
                                  : a.partyId
                              }
                            >
                              {partiesById[a.partyId]?.displayName ? (
                                <>
                                  <span className="text-foreground/90">{partiesById[a.partyId]!.displayName}</span>
                                  <span className="font-mono opacity-70"> · {a.partyId.slice(-6)}</span>
                                </>
                              ) : (
                                <span className="font-mono">{a.partyId}</span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">{formatRecordOrigin(a.origin)}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadgeClass(a.status)}>
                            {STATUS_PT[a.status] ?? a.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          Operar via especialista
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveTableScroll>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Disponibilidade</CardTitle>
            <CardDescription>
              Slots derivados das janelas cadastradas; <span className="text-emerald-400">livre</span> ou{" "}
              <span className="text-rose-400">ocupado</span>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!agenda?.availability?.length ? (
              <p className="text-sm text-muted-foreground">
                Sem slots calculados. Adicione uma janela de disponibilidade ou crie compromissos com horário.
              </p>
            ) : (
              <ul className="space-y-2 max-h-[420px] overflow-auto pr-1">
                {agenda.availability.map((w, i) => (
                  <li
                    key={`${w.slotId}-${w.startsAt}-${i}`}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span className="font-mono text-xs">{formatTimeRange(w.startsAt, w.endsAt)}</span>
                    <Badge variant="outline" className={w.available ? "border-emerald-500/40 text-emerald-200" : "border-rose-500/40 text-rose-200"}>
                      {w.available ? "Livre" : "Ocupado"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {agenda && agenda.slots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Janelas de disponibilidade (cadastro)</CardTitle>
            <CardDescription>Blocos base usados para fatiar os slots acima.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {agenda.slots.map((s) => (
                <li key={s.id} className="rounded-md border border-border px-3 py-2 text-sm">
                  <div className="font-medium">{s.label || "Janela"}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {formatTimeRange(s.startsAt, s.endsAt)} · {s.slotMinutes} min
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

    </div>
  )
}

function PartySearchCombo({
  api,
  partyId,
  partyDisplayName,
  onSelect,
}: {
  api: ReturnType<typeof createApiClient>
  partyId: string
  partyDisplayName: string
  onSelect: (id: string, displayName: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [parties, setParties] = useState<CrmParty[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")

  const load = useCallback(
    async (q: string) => {
      setLoading(true)
      try {
        const path = q.trim() ? `/parties?q=${encodeURIComponent(q.trim())}&limit=40` : "/parties?limit=40"
        const res = await api.get<CrmParty[]>(path)
        setParties(Array.isArray(res.data) ? res.data : [])
      } catch {
        setParties([])
      } finally {
        setLoading(false)
      }
    },
    [api],
  )

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => void load(search), 280)
    return () => clearTimeout(t)
  }, [open, search, load])

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) {
          setSearch("")
          void load("")
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate text-left">
            {partyDisplayName ? (
              <>
                <span className="font-medium">{partyDisplayName}</span>
                <span className="ml-1 font-mono text-xs text-muted-foreground">({partyId.slice(-8)})</span>
              </>
            ) : (
              <span className="text-muted-foreground">Pesquisar contato…</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Nome do contato…" value={search} onValueChange={setSearch} />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A carregar…
              </div>
            ) : (
              <>
                <CommandEmpty>Nenhum contato encontrado.</CommandEmpty>
                <CommandGroup>
                  {parties.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.id}
                      onSelect={() => {
                        onSelect(p.id, p.displayName)
                        setOpen(false)
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span>{p.displayName}</span>
                        {(p.email || p.phone) && (
                          <span className="text-xs text-muted-foreground">
                            {[p.email, p.phone].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function NewAppointmentDialog({
  date,
  onCreated,
  api,
}: {
  date: string
  onCreated: () => void
  api: ReturnType<typeof createApiClient>
}) {
  const [open, setOpen] = useState(false)
  const [partyId, setPartyId] = useState("")
  const [partyDisplayName, setPartyDisplayName] = useState("")
  const [manualPartyId, setManualPartyId] = useState("")
  const [title, setTitle] = useState("")
  const [startLocal, setStartLocal] = useState(`${date}T09:00`)
  const [endLocal, setEndLocal] = useState(`${date}T10:00`)
  const [remindLocal, setRemindLocal] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setStartLocal(`${date}T09:00`)
      setEndLocal(`${date}T10:00`)
    }
  }, [date, open])

  async function submit() {
    const effectivePartyId = manualPartyId.trim() || partyId.trim()
    if (!effectivePartyId || !title.trim()) {
      toast.error("Escolha um contato (ou cole o ID) e preencha o título.")
      return
    }
    setSaving(true)
    try {
      const startsAt = new Date(startLocal).toISOString()
      const endsAt = new Date(endLocal).toISOString()
      if (new Date(startsAt) >= new Date(endsAt)) {
        toast.error("O início deve ser antes do fim.")
        setSaving(false)
        return
      }
      await api.post("/schedule/appointments", {
        partyId: effectivePartyId,
        title: title.trim(),
        startsAt,
        endsAt,
        ...(remindLocal ? { remindAt: new Date(remindLocal).toISOString() } : {}),
      })
      toast.success("Compromisso criado")
      setOpen(false)
      setPartyId("")
      setPartyDisplayName("")
      setManualPartyId("")
      setTitle("")
      setRemindLocal("")
      onCreated()
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha ao criar"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">Novo compromisso</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo compromisso</DialogTitle>
          <DialogDescription>
            Pesquise pelo nome do contato no CRM ou, se preferir, expanda e cole o ObjectId manualmente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1.5">
            <Label>Contato</Label>
            <PartySearchCombo
              api={api}
              partyId={partyId}
              partyDisplayName={partyDisplayName}
              onSelect={(id, name) => {
                setPartyId(id)
                setPartyDisplayName(name)
                setManualPartyId("")
              }}
            />
            <div className="flex justify-end">
              <CreatePartyDialog
                api={api}
                trigger={
                  <Button type="button" variant="link" className="h-auto p-0 text-xs text-muted-foreground">
                    + Criar contato novo
                  </Button>
                }
                onCreated={(p) => {
                  setPartyId(p.id)
                  setPartyDisplayName(p.displayName)
                  setManualPartyId("")
                }}
              />
            </div>
          </div>
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-8 px-0 text-xs text-muted-foreground">
                Colar ID manualmente (avançado)
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-1">
              <Input
                value={manualPartyId}
                onChange={(e) => {
                  setManualPartyId(e.target.value)
                  if (e.target.value.trim()) {
                    setPartyId("")
                    setPartyDisplayName("")
                  }
                }}
                placeholder="ObjectId do contato"
                className="font-mono text-sm"
              />
            </CollapsibleContent>
          </Collapsible>
          <div className="space-y-1.5">
            <Label htmlFor="ap-title">Título</Label>
            <Input id="ap-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Consulta de retorno" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ap-start">Início</Label>
              <Input id="ap-start" type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-end">Fim</Label>
              <Input id="ap-end" type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ap-remind">Lembrete (opcional)</Label>
            <Input id="ap-remind" type="datetime-local" value={remindLocal} onChange={(e) => setRemindLocal(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AvailabilityDialog({
  date,
  onCreated,
  api,
}: {
  date: string
  onCreated: () => void
  api: ReturnType<typeof createApiClient>
}) {
  const [open, setOpen] = useState(false)
  const [startLocal, setStartLocal] = useState(`${date}T09:00`)
  const [endLocal, setEndLocal] = useState(`${date}T18:00`)
  const [slotMinutes, setSlotMinutes] = useState(60)
  const [label, setLabel] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setStartLocal(`${date}T09:00`)
      setEndLocal(`${date}T18:00`)
    }
  }, [date, open])

  async function submit() {
    setSaving(true)
    try {
      const startsAt = new Date(startLocal).toISOString()
      const endsAt = new Date(endLocal).toISOString()
      if (new Date(startsAt) >= new Date(endsAt)) {
        toast.error("O início deve ser antes do fim.")
        setSaving(false)
        return
      }
      await api.post("/schedule/availability", {
        startsAt,
        endsAt,
        slotMinutes,
        ...(label.trim() ? { label: label.trim() } : {}),
      })
      toast.success("Disponibilidade registada")
      setOpen(false)
      setLabel("")
      onCreated()
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha ao guardar"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary">
          Nova janela
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Janela de disponibilidade</DialogTitle>
          <DialogDescription>Define um intervalo e o tamanho de cada slot (minutos).</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="av-start">Início</Label>
              <Input id="av-start" type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="av-end">Fim</Label>
              <Input id="av-end" type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="av-slot">Slot (min)</Label>
              <Input
                id="av-slot"
                type="number"
                min={5}
                step={5}
                value={slotMinutes}
                onChange={(e) => setSlotMinutes(Number(e.target.value) || 60)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="av-label">Rótulo (opcional)</Label>
              <Input id="av-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Manhã" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
