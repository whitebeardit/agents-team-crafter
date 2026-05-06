"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Clipboard, Loader2, Package, RefreshCw, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { AgentFirstVerticalStandard } from "@/components/verticals/agent-first-vertical-standard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ApiError, createApiClient } from "@/lib/api/client"
import { formatRecordOrigin } from "@/lib/format-record-origin"
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
import type { PackageListItem, PackagesListResponse, Team } from "@/lib/types"

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

export default function PackagesPage() {
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [loading, setLoading] = useState(false)
  const [recommendedTeam, setRecommendedTeam] = useState<Team | null>(null)
  const [startDate, setStartDate] = useState(addDays(todayDateString(), -30))
  const [endDate, setEndDate] = useState(todayDateString)
  const [searchQuery, setSearchQuery] = useState("")
  const [packages, setPackages] = useState<PackageListItem[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PackageListItem | null>(null)

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
      const msg = e instanceof ApiError ? e.message : "Não foi possível carregar o time recomendado para Pacotes."
      toast.error(msg)
      setRecommendedTeam(null)
    } finally {
      setLoading(false)
    }
  }, [api, token, currentWorkspace])

  useEffect(() => {
    void loadRecommendedTeam()
  }, [loadRecommendedTeam])

  const loadPackages = useCallback(async () => {
    if (!token || !currentWorkspace) return
    if (!startDate || !endDate) {
      toast.error("Informe data inicial e final.")
      return
    }
    if (startDate > endDate) {
      toast.error("A data inicial deve ser menor ou igual à data final.")
      return
    }
    const totalDays =
      Math.floor((new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime()) / 86400000) + 1
    if (totalDays > 90) {
      toast.error("Intervalo muito grande. Use no máximo 90 dias por busca.")
      return
    }
    setLoadingList(true)
    try {
      const qs = new URLSearchParams({
        startDate,
        endDate,
      })
      if (searchQuery.trim()) qs.set("q", searchQuery.trim())
      const res = await api.get<PackagesListResponse>(`/packages?${qs.toString()}`)
      setPackages(Array.isArray(res.data?.packages) ? res.data.packages : [])
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Não foi possível carregar os pacotes."
      toast.error(msg)
      setPackages([])
    } finally {
      setLoadingList(false)
    }
  }, [api, token, currentWorkspace, startDate, endDate, searchQuery])

  useEffect(() => {
    void loadPackages()
  }, [loadPackages])

  const operationHref = recommendedTeam ? `/teams/${recommendedTeam.id}?tab=debug` : "/teams/create"

  const starterPrompts = [
    "Liste os pacotes ativos da paciente X e os saldos restantes.",
    "Verifique se existe pacote elegível para o cliente X antes de registrar sessão.",
    "Mostre pacotes próximos de esgotar para priorizar renovação.",
  ]

  const handleCopyPrompt = useCallback(async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
      toast.success("Prompt copiado. Cole no chat do time para operar Pacotes.")
    } catch {
      toast.error("Não foi possível copiar o prompt.")
    }
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return
    setDeletingId(pendingDelete.id)
    try {
      await api.del(`/packages/${pendingDelete.id}`)
      toast.success("Pacote removido.")
      setPendingDelete(null)
      await loadPackages()
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? `${e.message} (a deleção exige permissão de admin).`
          : "Não foi possível excluir o pacote."
      toast.error(msg)
    } finally {
      setDeletingId(null)
    }
  }, [api, pendingDelete, loadPackages])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Package className="h-7 w-7 text-primary" />
            Pacotes
          </h1>
          <p className="text-sm text-muted-foreground">
            Vertical com operação principal via especialistas do time. A UI manual cobre auditoria e gestão mínima.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadRecommendedTeam()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar
        </Button>
      </div>

      <AgentFirstVerticalStandard
        verticalName="Pacotes"
        summary="Vertical orientada à operação via especialistas para saldo, elegibilidade e gestão de pacotes."
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
        specialistName="Especialista de Pacotes"
        teamRecommendation="Mesmo time operacional com especialistas de atendimento e agenda"
        ctaHref={operationHref}
        ctaLabel={recommendedTeam ? `Abrir operação no time "${recommendedTeam.name}"` : "Criar time operacional"}
        starterPrompts={starterPrompts}
        fallbackGuidance="Use esta tela para auditoria manual e operações mínimas enquanto a vertical evolui."
        troubleshootingItems={[
          "Confirme se existe time ativo para operar via especialista.",
          "Verifique se o cliente está corretamente vinculado ao pacote.",
          "Antes de excluir, valide impactos no histórico operacional.",
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Pacotes (auditoria manual)</CardTitle>
          <CardDescription>
            Pesquisa por intervalo de até 90 dias, busca textual e exclusão com confirmação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="packages-start-date">Início</Label>
              <Input id="packages-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="packages-end-date">Fim</Label>
              <Input id="packages-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="packages-search">Pesquisa</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="packages-search"
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Paciente, nome do pacote, ID, telefone ou e-mail"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => void loadPackages()} disabled={loadingList}>
              {loadingList ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Recarregar lista
            </Button>
          </div>

          <div className="space-y-3">
            {packages.map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{item.packageName}</p>
                      <Badge variant={item.eligible ? "default" : "secondary"}>
                        {item.eligible ? "Elegível" : "Sem saldo"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Pacote ID: {item.id}</p>
                    <p className="text-sm text-muted-foreground">
                      Paciente: {item.party?.displayName ?? item.partyId}
                      {item.party?.phone ? ` • ${item.party.phone}` : ""}
                      {item.party?.email ? ` • ${item.party.email}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Unidades: {item.unitsUsed}/{item.unitsTotal} • Restantes: {item.remaining}
                    </p>
                    <p className="text-sm text-muted-foreground">Criado em: {formatDateTime(item.createdAt)}</p>
                    <p className="text-xs text-muted-foreground">{formatRecordOrigin(item.origin)}</p>
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

            {!loadingList && packages.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhum pacote encontrado para os filtros selecionados.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jornada agent-first Pacotes</CardTitle>
          <CardDescription>Fluxo recomendado para operação de pacotes com especialistas no runtime de times.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <p>1. Abra o time operacional recomendado e entre na aba de chat/debug.</p>
            <p>2. Use um starter prompt para saldo, elegibilidade ou auditoria de pacotes.</p>
            <p>3. Execute o fluxo via especialista e use esta tela para validação manual quando necessário.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <Link href={operationHref}>
                {recommendedTeam ? `Operar no time "${recommendedTeam.name}"` : "Criar time para operar Pacotes"}
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

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pacote?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `O pacote "${pendingDelete.packageName}" será removido permanentemente. Essa ação exige permissão de admin e não pode ser desfeita.`
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

