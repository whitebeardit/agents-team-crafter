"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Loader2, RefreshCw } from "lucide-react"
import { ApiError, createApiClient } from "@/lib/api/client"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import type { CrmParty } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

type PartyStatusFilter = "all" | "active" | "inactive"
type CrmReadiness = {
  total: number
  active: number
  inactive: number
  withoutEmail: number
  withoutPhone: number
  updatedLast7d: number
  health: "ok" | "attention" | "critical"
  checks: Array<{
    code: string
    status: "ok" | "attention" | "critical"
    message: string
    nextStep: string
    value: number
  }>
  generatedAt: string
}
type CrmGoldGate = {
  approved: boolean
  evaluatedAt: string
  criteria: Array<{
    code: string
    label: string
    passed: boolean
    detail: string
  }>
  blockingCriteria: Array<{
    code: string
    label: string
    passed: boolean
    detail: string
  }>
}

function statusBadgeVariant(status: string | undefined): "default" | "secondary" {
  return status === "inactive" ? "secondary" : "default"
}

export default function CrmPage() {
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [loading, setLoading] = useState(false)
  const [parties, setParties] = useState<CrmParty[]>([])
  const [query, setQuery] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [statusFilter, setStatusFilter] = useState<PartyStatusFilter>("all")
  const [readiness, setReadiness] = useState<CrmReadiness | null>(null)
  const [goldGate, setGoldGate] = useState<CrmGoldGate | null>(null)

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

  const loadParties = useCallback(async () => {
    if (!token || !currentWorkspace) return
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (query.trim()) qs.set("q", query.trim())
      if (email.trim()) qs.set("email", email.trim())
      if (phone.trim()) qs.set("phone", phone.trim())
      if (statusFilter !== "all") qs.set("status", statusFilter)
      qs.set("limit", "50")
      const path = `/parties?${qs.toString()}`
      const [res, readinessRes, goldGateRes] = await Promise.all([
        api.get<CrmParty[]>(path),
        api.get<CrmReadiness>("/parties/readiness"),
        api.get<CrmGoldGate>("/parties/gold-gate"),
      ])
      setParties(res.data)
      setReadiness(readinessRes.data)
      setGoldGate(goldGateRes.data)
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Não foi possível carregar os contatos"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [api, token, currentWorkspace, query, email, phone, statusFilter])

  useEffect(() => {
    void loadParties()
  }, [loadParties])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CRM</h1>
          <p className="text-sm text-muted-foreground">
            Painel de auditoria manual. A entrada operacional padrão continua sendo via especialista no runtime de times.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => void loadParties()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </Button>
          <Button asChild type="button">
            <Link href="/teams">Operar via especialista</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Use nome, e-mail, telefone e estado para encontrar contatos rapidamente.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="crm-q">Nome</Label>
            <Input id="crm-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ex.: Clínica Silva" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="crm-email">E-mail</Label>
            <Input id="crm-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@empresa.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="crm-phone">Telefone</Label>
            <Input id="crm-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="crm-status">Status</Label>
            <select
              id="crm-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PartyStatusFilter)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </div>
          <div className="md:col-span-4 flex justify-end">
            <Button type="button" onClick={() => void loadParties()} disabled={loading}>
              Aplicar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Este ecrã é para <strong>auditoria manual</strong> do que os especialistas executaram.
          Para criar/editar/desativar no fluxo padrão de produto, use um time com especialista CRM.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Readiness CRM</CardTitle>
          <CardDescription>Indicadores rápidos para troubleshooting da vertical CRM.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Total" value={readiness?.total} />
          <MetricCard label="Ativos" value={readiness?.active} />
          <MetricCard label="Inativos" value={readiness?.inactive} />
          <MetricCard label="Sem e-mail" value={readiness?.withoutEmail} />
          <MetricCard label="Sem telefone" value={readiness?.withoutPhone} />
          <MetricCard label="Atualizados 7d" value={readiness?.updatedLast7d} />
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

      <Card>
        <CardHeader>
          <CardTitle>Gate CRM GOLD (Loop 120.9)</CardTitle>
          <CardDescription>Estado de aceite operacional do CRM como vertical GOLD.</CardDescription>
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

      <div className="grid gap-3">
        {parties.map((party) => (
          <Card key={party.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{party.displayName}</p>
                  <Badge variant={statusBadgeVariant(party.status)}>{party.status === "inactive" ? "Inativo" : "Ativo"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">ID: {party.id}</p>
                <p className="text-sm text-muted-foreground">{party.email || "Sem e-mail"} • {party.phone || "Sem telefone"}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {!loading && parties.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhum contato encontrado para os filtros selecionados.
            </CardContent>
          </Card>
        ) : null}
      </div>
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
