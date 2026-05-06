"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BadgeDollarSign, Loader2, RefreshCw, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import type {
  FinanceDeleteBlocker,
  FinancePayableListItem,
  FinancePayablesListResponse,
  FinanceReceivableListItem,
  FinanceReceivablesListResponse,
} from "@/lib/types"

type DeleteTarget =
  | { kind: "receivable"; item: FinanceReceivableListItem }
  | { kind: "payable"; item: FinancePayableListItem }

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

function formatDate(value: string | undefined) {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleDateString("pt-BR")
  } catch {
    return value
  }
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}

function blockersSummary(blockers: FinanceDeleteBlocker[]) {
  return blockers.map((b) => `${b.domain}: ${b.count}`).join(", ")
}

function formatOrigin(origin: { id: string; type: string; slug: string } | undefined) {
  if (!origin) return "Origem: —"
  return `Origem: ${origin.type} · ${origin.slug} · ${origin.id}`
}

export default function FinancePage() {
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [startDate, setStartDate] = useState(addDays(todayDateString(), -30))
  const [endDate, setEndDate] = useState(todayDateString)
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [receivables, setReceivables] = useState<FinanceReceivableListItem[]>([])
  const [payables, setPayables] = useState<FinancePayableListItem[]>([])
  const [pendingDelete, setPendingDelete] = useState<DeleteTarget | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  const validateRange = useCallback(() => {
    if (!startDate || !endDate) {
      toast.error("Informe data inicial e final.")
      return false
    }
    if (startDate > endDate) {
      toast.error("A data inicial deve ser menor ou igual à data final.")
      return false
    }
    const totalDays =
      Math.floor((new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime()) / 86400000) + 1
    if (totalDays > 90) {
      toast.error("Intervalo muito grande. Use no máximo 90 dias por busca.")
      return false
    }
    return true
  }, [startDate, endDate])

  const loadFinance = useCallback(async () => {
    if (!token || !currentWorkspace) return
    if (!validateRange()) return
    setLoading(true)
    try {
      const qs = new URLSearchParams({ startDate, endDate })
      if (searchQuery.trim()) qs.set("q", searchQuery.trim())
      const [receivablesRes, payablesRes] = await Promise.all([
        api.get<FinanceReceivablesListResponse>(`/finance/receivables?${qs.toString()}`),
        api.get<FinancePayablesListResponse>(`/finance/payables?${qs.toString()}`),
      ])
      setReceivables(Array.isArray(receivablesRes.data?.receivables) ? receivablesRes.data.receivables : [])
      setPayables(Array.isArray(payablesRes.data?.payables) ? payablesRes.data.payables : [])
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Não foi possível carregar os dados financeiros."
      toast.error(msg)
      setReceivables([])
      setPayables([])
    } finally {
      setLoading(false)
    }
  }, [api, token, currentWorkspace, validateRange, startDate, endDate, searchQuery])

  useEffect(() => {
    void loadFinance()
  }, [loadFinance])

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return
    const id = pendingDelete.item.id
    setDeletingId(id)
    try {
      const path =
        pendingDelete.kind === "receivable" ? `/finance/receivables/${id}` : `/finance/payables/${id}`
      await api.del(path)
      toast.success("Registro financeiro removido.")
      setPendingDelete(null)
      await loadFinance()
    } catch (e) {
      if (e instanceof ApiError) {
        const refs = (e.details as { references?: FinanceDeleteBlocker[] } | undefined)?.references
        if (e.status === 409 && refs?.length) {
          toast.error(`Exclusão bloqueada: registro em uso (${blockersSummary(refs)}).`)
        } else {
          toast.error(`${e.message} (a deleção exige permissão de admin).`)
        }
      } else {
        toast.error("Não foi possível excluir o registro financeiro.")
      }
    } finally {
      setDeletingId(null)
    }
  }, [api, pendingDelete, loadFinance])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <BadgeDollarSign className="h-7 w-7 text-primary" />
            Financeiro
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestão operacional mínima de títulos: listagem, busca e exclusão protegida por travas de vínculo.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadFinance()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Intervalo máximo de 90 dias e busca textual para recebíveis/pagáveis.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="finance-start-date">Início</Label>
              <Input id="finance-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="finance-end-date">Fim</Label>
              <Input id="finance-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="finance-search">Busca</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="finance-search"
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ID, descrição, cliente, e-mail ou telefone"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => void loadFinance()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Recarregar lista
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contas a receber</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {receivables.map((item) => (
            <div key={item.id} className="rounded-lg border p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{formatMoney(item.amount, item.currency)}</p>
                    <Badge variant={item.paid ? "secondary" : "default"}>{item.paid ? "Pago" : "Aberto"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Recebível ID: {item.id}</p>
                  <p className="text-sm text-muted-foreground">
                    Cliente: {item.party?.displayName ?? item.partyId}
                    {item.party?.phone ? ` • ${item.party.phone}` : ""}
                    {item.party?.email ? ` • ${item.party.email}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Vencimento: {formatDate(item.dueDate)}
                    {item.description ? ` • ${item.description}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatOrigin(item.origin)}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  disabled={deletingId === item.id}
                  onClick={() => setPendingDelete({ kind: "receivable", item })}
                >
                  {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  <span className="ml-2">Excluir</span>
                </Button>
              </div>
            </div>
          ))}
          {!loading && receivables.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum recebível encontrado para os filtros selecionados.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contas a pagar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {payables.map((item) => (
            <div key={item.id} className="rounded-lg border p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{formatMoney(item.amount, item.currency)}</p>
                    <Badge variant={item.paid ? "secondary" : "default"}>{item.paid ? "Pago" : "Aberto"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Pagável ID: {item.id}</p>
                  <p className="text-sm text-muted-foreground">
                    Destino: {item.party?.displayName ?? item.destinationPartyId}
                    {item.party?.phone ? ` • ${item.party.phone}` : ""}
                    {item.party?.email ? ` • ${item.party.email}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Vencimento: {formatDate(item.dueDate)}
                    {item.description ? ` • ${item.description}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatOrigin(item.origin)}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  disabled={deletingId === item.id}
                  onClick={() => setPendingDelete({ kind: "payable", item })}
                >
                  {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  <span className="ml-2">Excluir</span>
                </Button>
              </div>
            </div>
          ))}
          {!loading && payables.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum pagável encontrado para os filtros selecionados.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro financeiro?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `O registro "${pendingDelete.item.id}" será removido permanentemente. Se houver vínculo em uso, a exclusão será bloqueada.`
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
