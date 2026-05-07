"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { createApiClient, ApiError } from "@/lib/api/client"
import { actionIdToToolSlug } from "@/lib/business-action-slug"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "sonner"
import { Plus, Trash2, Wrench } from "lucide-react"
import { ContextualTourHost, ContextualTourManualTrigger } from "@/components/onboarding/contextual-tour"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ResponsiveTableScroll } from "@/components/ui/responsive-table"
import { ToolDefinitionsListMobileCards } from "@/components/tool-definitions/tool-definitions-list-mobile-cards"
import {
  describeToolConfig,
  type TBusinessCatalogItem,
  type ToolDefinitionRow,
} from "@/lib/tool-definitions-display"
import type { BusinessActionDomain } from "@/lib/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ToolKindCreate = "http_webhook" | "builtin_ref" | "internal_action"

export default function ToolDefinitionsPage() {
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [items, setItems] = useState<ToolDefinitionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [kind, setKind] = useState<ToolKindCreate>("http_webhook")
  const [url, setUrl] = useState("")
  const [catalog, setCatalog] = useState<TBusinessCatalogItem[]>([])
  const [domains, setDomains] = useState<BusinessActionDomain[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  /** actionIds disponíveis escolhidos para criação em lote (Loop 61). */
  const [selectedInternalActionIds, setSelectedInternalActionIds] = useState<string[]>([])
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([])
  const [bulkSubmitting, setBulkSubmitting] = useState(false)

  /** Referência estável: sem isso, cada render recria o client e o efeito de `loadCatalog` volta a correr em loop. */
  const api = useMemo(
    () =>
      token && currentWorkspace
        ? createApiClient({
            getAuth: () => ({ token, refreshToken }),
            setAuth: () => {},
            clearAuth: () => {},
            getWorkspaceId: () => currentWorkspace.id,
          })
        : null,
    [token, refreshToken, currentWorkspace],
  )

  const load = useCallback(async () => {
    if (!api) return
    setLoading(true)
    try {
      const r = await api.get<ToolDefinitionRow[]>("/tool-definitions")
      setItems(r.data)
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha ao listar tools"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  const usedInternalActionIds = useMemo(() => {
    const ids = new Set<string>()
    for (const t of items) {
      if (t.kind === "internal_action" && typeof t.config?.actionId === "string") {
        ids.add(t.config.actionId)
      }
    }
    return ids
  }, [items])

  const loadCatalog = useCallback(async () => {
    if (!api) return
    setCatalogLoading(true)
    try {
      const [r, domainRes] = await Promise.all([
        api.get<TBusinessCatalogItem[]>("/business-actions/catalog"),
        api.get<BusinessActionDomain[]>("/business-actions/domains"),
      ])
      setCatalog(r.data)
      setDomains(domainRes.data)
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha ao carregar catalogo de acoes"
      toast.error(msg)
      setCatalog([])
      setDomains([])
    } finally {
      setCatalogLoading(false)
    }
  }, [api])

  useEffect(() => {
    if (!api) return
    void loadCatalog()
  }, [api, loadCatalog])

  const resetCreateForm = () => {
    setName("")
    setSlug("")
    setUrl("")
    setKind("http_webhook")
    setSelectedInternalActionIds([])
    setSelectedDomainIds([])
  }

  const availableCatalog = useMemo(
    () => catalog.filter((c) => !usedInternalActionIds.has(c.actionId)),
    [catalog, usedInternalActionIds],
  )

  const toggleInternalActionId = (actionId: string, checked: boolean) => {
    setSelectedInternalActionIds((prev) => {
      if (checked) {
        if (prev.includes(actionId)) return prev
        return [...prev, actionId]
      }
      return prev.filter((id) => id !== actionId)
    })
  }

  const selectAllAvailableInternal = () => {
    setSelectedInternalActionIds(availableCatalog.map((c) => c.actionId))
  }

  const clearInternalSelection = () => {
    setSelectedInternalActionIds([])
    setSelectedDomainIds([])
  }

  const toggleDomainId = (domainId: string, checked: boolean) => {
    setSelectedDomainIds((prev) => {
      if (checked) return prev.includes(domainId) ? prev : [...prev, domainId]
      return prev.filter((id) => id !== domainId)
    })
  }

  const handleCreate = async () => {
    if (!api) return
    try {
      if (kind === "internal_action") {
        const toCreate = selectedInternalActionIds.filter((id) => !usedInternalActionIds.has(id))
        if (toCreate.length === 0 && selectedDomainIds.length === 0) {
          toast.error("Selecione pelo menos uma acao ainda nao definida neste workspace")
          return
        }
        setBulkSubmitting(true)
        type TBulkRes = {
          created: ToolDefinitionRow[]
          skipped: { actionId: string; reason: string }[]
          errors: { actionId: string; message: string }[]
        }
        const r =
          selectedDomainIds.length > 0
            ? await api.post<TBulkRes>("/tool-definitions/bulk-internal-action-domains", {
                domainIds: selectedDomainIds,
              })
            : await api.post<TBulkRes>("/tool-definitions/bulk-internal-actions", {
                actionIds: toCreate,
              })
        const { created, skipped, errors } = r.data
        const parts: string[] = []
        if (created.length) parts.push(`${created.length} criada(s)`)
        if (skipped.length) parts.push(`${skipped.length} ignorada(s)`)
        if (errors.length) parts.push(`${errors.length} erro(s)`)
        if (created.length > 0) {
          toast.success(parts.join(" · ") || "Concluido")
        } else if (skipped.length > 0 && errors.length === 0) {
          toast.message("Nada de novo a criar", {
            description: skipped.map((s) => `${s.actionId} (${s.reason})`).join("; ") || undefined,
          })
        } else {
          toast.error(errors.map((e) => `${e.actionId}: ${e.message}`).join("; ") || "Falha ao criar")
        }
        if (errors.length > 0 && created.length > 0) {
          toast.error(errors.map((e) => `${e.actionId}: ${e.message}`).join("; "))
        }
        setOpen(false)
        resetCreateForm()
        void load()
        return
      }
      if (!name.trim() || !slug.trim()) return
      const config: Record<string, unknown> =
        kind === "http_webhook" ? { url: url.trim(), method: "POST" } : { builtinId: "web_search" }
      await api.post("/tool-definitions", {
        name: name.trim(),
        slug: slug.trim(),
        kind,
        config,
      })
      toast.success("Tool criada")
      setOpen(false)
      resetCreateForm()
      void load()
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha ao criar"
      toast.error(msg)
    } finally {
      setBulkSubmitting(false)
    }
  }

  const internalSelectedToCreateCount = useMemo(
    () => selectedInternalActionIds.filter((id) => !usedInternalActionIds.has(id)).length,
    [selectedInternalActionIds, usedInternalActionIds],
  )

  const canSubmitCreate =
    kind === "internal_action"
      ? (internalSelectedToCreateCount > 0 || selectedDomainIds.length > 0) && !catalogLoading && !bulkSubmitting
      : Boolean(name.trim() && slug.trim()) && (kind === "http_webhook" ? Boolean(url.trim()) : true)

  const catalogByActionId = useMemo(() => {
    const m: Record<string, TBusinessCatalogItem> = {}
    for (const c of catalog) {
      m[c.actionId] = c
    }
    return m
  }, [catalog])

  const handleToggleEnabled = async (item: ToolDefinitionRow, enabled: boolean) => {
    if (!api) return
    setTogglingId(item.id)
    try {
      await api.put(`/tool-definitions/${item.id}`, { enabled })
      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, enabled } : row)))
      toast.success(enabled ? "Tool ativada" : "Tool desativada")
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha ao atualizar tool"
      toast.error(msg)
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!api) return
    try {
      await api.del(`/tool-definitions/${id}`)
      toast.success("Removida")
      void load()
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha ao remover"
      toast.error(msg)
    }
  }

  const enabledCount = items.filter((item) => item.enabled).length
  const disabledCount = items.length - enabledCount

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-6 px-4 py-4 sm:p-6">
      <ContextualTourHost screenKey="tool_definitions" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold sm:text-2xl">Tools do workspace</h1>
          <p className="text-sm text-muted-foreground">
            Definicoes associaveis aos agentes (aba Ferramentas). Tipos: <code className="text-xs">internal_action</code>{" "}
            (accoes de negocio), <code className="text-xs">http_webhook</code>, <code className="text-xs">builtin_ref</code>,{" "}
            <code className="text-xs">mcp_ref</code>. O planner pode criar <code className="text-xs">internal_action</code>{" "}
            ao fazer bind — continuam a precisar de estar activas aqui.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
          <ContextualTourManualTrigger screenKey="tool_definitions" className="w-full sm:w-auto" />
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v)
            if (!v) resetCreateForm()
          }}
        >
          <DialogTrigger asChild>
            <Button className="w-full shrink-0 sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Nova tool
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {kind === "http_webhook"
                  ? "Nova tool — HTTP webhook"
                  : kind === "builtin_ref"
                    ? "Nova tool — Referencia builtin"
                    : "Nova tool — Acao interna (negocio)"}
              </DialogTitle>
              <DialogDescription>
                {kind === "http_webhook"
                  ? "O runtime faz um pedido HTTP (POST) para o URL quando o modelo invoca esta tool. O servico deve estar acessivel e validar autenticacao."
                  : kind === "builtin_ref"
                    ? "Esta opcao nao pede URL aqui. Integracoes reais (Postgres, CRM, calendario, OpenAI) ficam em Configuracoes > Integracoes; habilite as ferramentas de catalogo na ficha do agente para execucao completa."
                    : "Seleccione uma ou varias accoes do catalogo. O nome e o slug sao gerados automaticamente; pode adicionar varias de uma vez."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={kind}
                  onValueChange={(v) => {
                    setKind(v as ToolKindCreate)
                    setSelectedInternalActionIds([])
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http_webhook">HTTP webhook</SelectItem>
                    <SelectItem value="builtin_ref">Referencia builtin</SelectItem>
                    <SelectItem value="internal_action">Acao interna (negocio)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {kind === "internal_action" ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Domínios de negócio</Label>
                    <div className="rounded-md border border-border p-2 space-y-2 max-h-52 overflow-y-auto">
                      {domains.length === 0 ? (
                        <p className="text-sm text-muted-foreground px-1">Nenhum domínio disponível.</p>
                      ) : (
                        domains.map((domain) => {
                          const checked = selectedDomainIds.includes(domain.id)
                          return (
                            <label
                              key={domain.id}
                              className="flex items-start gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                            >
                              <Checkbox checked={checked} onCheckedChange={(v) => toggleDomainId(domain.id, v === true)} className="mt-0.5" />
                              <span className="min-w-0 flex-1">
                                <span className="font-medium text-sm block">{domain.label}</span>
                                <span className="text-xs text-muted-foreground line-clamp-2">{domain.description}</span>
                                <span className="text-[10px] text-muted-foreground block mt-0.5">
                                  {(domain.availableActionCount ?? domain.actionIds.length)} actions
                                  {(domain.dependsOnDomainIds ?? []).length > 0
                                    ? ` · depende de ${(domain.dependsOnDomainIds ?? []).join(", ")}`
                                    : ""}
                                </span>
                              </span>
                            </label>
                          )
                        })
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Ao selecionar domínio, o backend cria também as actions de dependência.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>Accoes da plataforma (avançado)</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={catalogLoading || availableCatalog.length === 0}
                        onClick={() => selectAllAvailableInternal()}
                      >
                        Seleccionar todas
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        disabled={selectedInternalActionIds.length === 0}
                        onClick={() => clearInternalSelection()}
                      >
                        Limpar
                      </Button>
                    </div>
                  </div>
                  {catalogLoading ? (
                    <p className="text-sm text-muted-foreground">A carregar catalogo...</p>
                  ) : (
                    <div className="rounded-md border border-border max-h-[min(50vh,280px)] overflow-y-auto p-2 space-y-2">
                      {availableCatalog.length === 0 ? (
                        <p className="text-sm text-muted-foreground px-1">
                          Todas as accoes do catalogo ja tem definicao neste workspace, ou o catalogo esta vazio.
                        </p>
                      ) : (
                        availableCatalog.map((c) => {
                          const checked = selectedInternalActionIds.includes(c.actionId)
                          return (
                            <label
                              key={c.actionId}
                              className="flex items-start gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => toggleInternalActionId(c.actionId, v === true)}
                                className="mt-0.5"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="font-medium text-sm block">{c.title}</span>
                                {c.description ? (
                                  <span className="text-xs text-muted-foreground line-clamp-2">{c.description}</span>
                                ) : null}
                                <span className="text-[10px] font-mono text-muted-foreground block mt-0.5">
                                  {c.actionId} → slug {actionIdToToolSlug(c.actionId)}
                                </span>
                              </span>
                            </label>
                          )
                        })
                      )}
                    </div>
                  )}
                  {usedInternalActionIds.size > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {usedInternalActionIds.size} accao(oes) ja definida(s) neste workspace — nao aparecem na lista.
                    </p>
                  ) : null}
                </div>
              ) : (
                <>
                  <div>
                    <Label>Nome</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label>Slug (unico)</Label>
                    <Input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className="mt-1"
                      placeholder="minha-api"
                    />
                  </div>
                </>
              )}
              {kind === "http_webhook" ? (
                <div>
                  <Label>URL</Label>
                  <Input value={url} onChange={(e) => setUrl(e.target.value)} className="mt-1" placeholder="https://..." />
                </div>
              ) : null}
              {kind === "builtin_ref" ? (
                <p className="text-sm text-muted-foreground rounded-md border border-border bg-muted/40 px-3 py-2">
                  Sem campo URL: referencias <code className="text-xs">builtin_ref</code> sao aliases no workspace. Para
                  dados ou APIs internas, prefira <strong>Acao interna</strong> ou as tools de catalogo no agente.
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => void handleCreate()} disabled={!canSubmitCreate}>
                {kind === "internal_action"
                  ? `Adicionar${internalSelectedToCreateCount ? ` (${internalSelectedToCreateCount})` : ""}`
                  : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ativas</CardTitle>
            <CardDescription>Aparecem na ficha do agente para habilitacao.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{enabledCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Desativadas</CardTitle>
            <CardDescription>Ficam ocultas na aba Ferramentas dos agentes.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{disabledCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Jornada recomendada</CardTitle>
            <CardDescription>Crie ou ative aqui, depois habilite no agente.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <Link href="/agents" className="text-primary underline-offset-4 hover:underline">
              Abrir agentes
            </Link>
          </CardContent>
        </Card>
      </div>

      <Alert>
        <Wrench className="h-4 w-4" />
        <AlertTitle>Dependencias, integracoes e habilitacao</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            <code className="text-xs">internal_action</code> frequentemente depende de integracoes em{" "}
            <Link href="/settings?tab=integrations" className="text-primary underline-offset-4 hover:underline">
              Configuracoes &gt; Integracoes
            </Link>
            . Webhooks precisam de URL acessivel; <code className="text-xs">builtin_ref</code> nao. A definicao deve
            estar <strong>activa</strong> aqui e depois na aba <strong>Ferramentas</strong> do agente.
          </p>
          <p>
            O planner pode criar <code className="text-xs">internal_action</code> ao fazer bind; a entrada continua
            obrigatoria nesta lista.
          </p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
          <CardDescription>Requer perfil admin para criar, ativar/desativar ou remover.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma tool registada.</p>
          ) : (
            <>
              <ToolDefinitionsListMobileCards
                items={items}
                catalogByActionId={catalogByActionId}
                togglingId={togglingId}
                onToggle={(t, enabled) => void handleToggleEnabled(t, enabled)}
                onDelete={(id) => void handleDelete(id)}
              />
              <div className="hidden md:block">
                <ResponsiveTableScroll>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Estado</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="min-w-[180px]">Resumo</TableHead>
                        <TableHead className="w-[120px] text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>
                            <Badge variant={t.enabled ? "default" : "secondary"}>
                              {t.enabled ? "Ativa" : "Desativada"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{t.name}</TableCell>
                          <TableCell className="font-mono text-xs">{t.slug}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{t.kind}</Badge>
                          </TableCell>
                          <TableCell
                            className="max-w-[280px] truncate text-xs text-muted-foreground"
                            title={describeToolConfig(t, catalogByActionId)}
                          >
                            {describeToolConfig(t, catalogByActionId)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Switch
                                checked={t.enabled}
                                disabled={togglingId === t.id}
                                onCheckedChange={(checked) => void handleToggleEnabled(t, checked)}
                              />
                              <Button variant="ghost" size="icon" onClick={() => void handleDelete(t.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
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
  )
}
