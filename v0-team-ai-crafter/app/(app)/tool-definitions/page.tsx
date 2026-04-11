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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type TBusinessCatalogItem = {
  actionId: string
  title: string
  description: string
  packId?: string
}

type ToolKindCreate = "http_webhook" | "builtin_ref" | "internal_action"

type ToolDef = {
  id: string
  name: string
  slug: string
  kind: "builtin_ref" | "http_webhook" | "mcp_ref" | "internal_action"
  enabled: boolean
  config: Record<string, unknown>
}

function describeToolConfig(tool: ToolDef, catalogByActionId?: Record<string, TBusinessCatalogItem>): string {
  if (tool.kind === "internal_action") {
    const aid = typeof tool.config?.actionId === "string" ? tool.config.actionId : ""
    if (!aid) return "Acao interna do backend"
    const meta = catalogByActionId?.[aid]
    return meta ? `${meta.title} — ${aid}` : `Acao interna: ${aid}`
  }
  if (tool.kind === "http_webhook") {
    return typeof tool.config.url === "string" ? tool.config.url : "Webhook HTTP"
  }
  if (tool.kind === "builtin_ref") {
    return typeof tool.config.builtinId === "string"
      ? `Builtin: ${tool.config.builtinId}`
      : "Referencia builtin"
  }
  if (tool.kind === "mcp_ref") {
    return typeof tool.config.toolName === "string"
      ? `MCP tool: ${tool.config.toolName}`
      : "Referencia MCP"
  }
  return "Sem configuracao adicional"
}

function describeToolDependencies(tool: ToolDef): string {
  switch (tool.kind) {
    case "internal_action":
      return "Executa uma acao registada na plataforma (MongoDB / dominio de negocio). Escolha a acao pelo catalogo ao criar a definicao — nao e necessario digitar o actionId."
    case "http_webhook":
      return "O runtime faz HTTP para o URL indicado; o seu servico deve estar acessivel e validar autenticacao."
    case "builtin_ref":
      return "Alias no workspace (sem URL nesta definicao). Execucao completa: catalogo no agente + Integracoes."
    case "mcp_ref":
      return "Requer MCP ligado no workspace e permissoes na ferramenta remota."
    default:
      return ""
  }
}

export default function ToolDefinitionsPage() {
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [items, setItems] = useState<ToolDef[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [kind, setKind] = useState<ToolKindCreate>("http_webhook")
  const [url, setUrl] = useState("")
  const [catalog, setCatalog] = useState<TBusinessCatalogItem[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  /** actionIds disponíveis escolhidos para criação em lote (Loop 61). */
  const [selectedInternalActionIds, setSelectedInternalActionIds] = useState<string[]>([])
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
    [token, refreshToken, currentWorkspace?.id],
  )

  const load = async () => {
    if (!api) return
    setLoading(true)
    try {
      const r = await api.get<ToolDef[]>("/tool-definitions")
      setItems(r.data)
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha ao listar tools"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [token, refreshToken, currentWorkspace?.id])

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
      const r = await api.get<TBusinessCatalogItem[]>("/business-actions/catalog")
      setCatalog(r.data)
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha ao carregar catalogo de acoes"
      toast.error(msg)
      setCatalog([])
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
  }

  const handleCreate = async () => {
    if (!api) return
    try {
      if (kind === "internal_action") {
        const toCreate = selectedInternalActionIds.filter((id) => !usedInternalActionIds.has(id))
        if (toCreate.length === 0) {
          toast.error("Selecione pelo menos uma acao ainda nao definida neste workspace")
          return
        }
        setBulkSubmitting(true)
        type TBulkRes = {
          created: ToolDef[]
          skipped: { actionId: string; reason: string }[]
          errors: { actionId: string; message: string }[]
        }
        const r = await api.post<TBulkRes>("/tool-definitions/bulk-internal-actions", {
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
      ? internalSelectedToCreateCount > 0 && !catalogLoading && !bulkSubmitting
      : Boolean(name.trim() && slug.trim()) && (kind === "http_webhook" ? Boolean(url.trim()) : true)

  const catalogByActionId = useMemo(() => {
    const m: Record<string, TBusinessCatalogItem> = {}
    for (const c of catalog) {
      m[c.actionId] = c
    }
    return m
  }, [catalog])

  const handleToggleEnabled = async (item: ToolDef, enabled: boolean) => {
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
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tools do workspace</h1>
          <p className="text-sm text-muted-foreground">
            Definicoes associaveis aos agentes (aba Ferramentas). Tipos: <code className="text-xs">internal_action</code>{" "}
            (accoes de negocio), <code className="text-xs">http_webhook</code>, <code className="text-xs">builtin_ref</code>,{" "}
            <code className="text-xs">mcp_ref</code>. O planner pode criar <code className="text-xs">internal_action</code>{" "}
            ao fazer bind — continuam a precisar de estar activas aqui.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v)
            if (!v) resetCreateForm()
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova tool
            </Button>
          </DialogTrigger>
          <DialogContent>
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>Accoes da plataforma</Label>
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
            <ul className="space-y-3">
              {items.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{t.name}</p>
                      <Badge variant={t.enabled ? "default" : "secondary"}>
                        {t.enabled ? "Ativa" : "Desativada"}
                      </Badge>
                      <Badge variant="outline">{t.kind}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{t.slug}</p>
                    <p className="text-xs text-muted-foreground mt-1 break-all">{describeToolConfig(t, catalogByActionId)}</p>
                    <p className="text-xs text-muted-foreground mt-1.5 border-l-2 border-primary/30 pl-2">
                      {describeToolDependencies(t)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Ativa</span>
                      <Switch
                        checked={t.enabled}
                        disabled={togglingId === t.id}
                        onCheckedChange={(checked) => void handleToggleEnabled(t, checked)}
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => void handleDelete(t.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
