"use client"

import { useEffect, useState } from "react"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { createApiClient, ApiError } from "@/lib/api/client"
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
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ToolDef = {
  id: string
  name: string
  slug: string
  kind: "builtin_ref" | "http_webhook" | "mcp_ref"
  enabled: boolean
  config: Record<string, unknown>
}

export default function ToolDefinitionsPage() {
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [items, setItems] = useState<ToolDef[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [kind, setKind] = useState<"http_webhook" | "builtin_ref">("http_webhook")
  const [url, setUrl] = useState("")

  const api = token && currentWorkspace
    ? createApiClient({
        getAuth: () => ({ token, refreshToken }),
        setAuth: () => {},
        clearAuth: () => {},
        getWorkspaceId: () => currentWorkspace.id,
      })
    : null

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

  const handleCreate = async () => {
    if (!api || !name.trim() || !slug.trim()) return
    try {
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
      setName("")
      setSlug("")
      setUrl("")
      void load()
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Falha ao criar"
      toast.error(msg)
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

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tools do workspace</h1>
          <p className="text-sm text-muted-foreground">
            Definicoes dinamicas (webhook HTTP) associaveis aos agentes na aba Ferramentas.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova tool
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova tool</DialogTitle>
              <DialogDescription>Webhook seguro chamado pelo runtime ao invocar a tool.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Slug (unico)</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-1" placeholder="minha-api" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http_webhook">HTTP webhook</SelectItem>
                    <SelectItem value="builtin_ref">Referencia builtin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {kind === "http_webhook" ? (
                <div>
                  <Label>URL</Label>
                  <Input value={url} onChange={(e) => setUrl(e.target.value)} className="mt-1" placeholder="https://..." />
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => void handleCreate()}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
          <CardDescription>Requer perfil admin para criar ou remover.</CardDescription>
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
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{t.slug}</p>
                    <Badge variant="outline" className="mt-1">
                      {t.kind}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => void handleDelete(t.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
