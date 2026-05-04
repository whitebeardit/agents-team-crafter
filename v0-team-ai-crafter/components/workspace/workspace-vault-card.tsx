"use client"

import { useCallback, useState } from "react"
import { ApiError, createApiClient } from "@/lib/api/client"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Database, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"

type VaultNoteRow = {
  noteId: string
  status: string
  kind: string
  title: string
  bodyPreview: string
  agentId: string
}

export function WorkspaceVaultCard() {
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [rows, setRows] = useState<VaultNoteRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token || !currentWorkspace) return
    setLoading(true)
    try {
      const api = createApiClient({
        getAuth: () => ({ token, refreshToken }),
        setAuth: () => {},
        clearAuth: () => {},
        getWorkspaceId: () => currentWorkspace.id,
      })
      const res = await api.get<VaultNoteRow[]>("/vault/notes?limit=200")
      setRows(res.data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("Falha ao carregar memoria do time")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [token, refreshToken, currentWorkspace])

  const reindex = useCallback(async () => {
    if (!token || !currentWorkspace) return
    setLoading(true)
    try {
      const api = createApiClient({
        getAuth: () => ({ token, refreshToken }),
        setAuth: () => {},
        clearAuth: () => {},
        getWorkspaceId: () => currentWorkspace.id,
      })
      await api.post("/vault/reindex")
      toast.success("Reindex solicitado")
      await load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("Falha ao reindexar vault")
    } finally {
      setLoading(false)
    }
  }, [token, refreshToken, currentWorkspace, load])

  const setStatus = useCallback(
    async (noteId: string, action: "approve" | "reject") => {
      if (!token || !currentWorkspace) return
      setBusyId(noteId)
      try {
        const api = createApiClient({
          getAuth: () => ({ token, refreshToken }),
          setAuth: () => {},
          clearAuth: () => {},
          getWorkspaceId: () => currentWorkspace.id,
        })
        const path =
          action === "approve" ? `/vault/notes/${noteId}/approve` : `/vault/notes/${noteId}/reject`
        await api.put(path)
        toast.success(action === "approve" ? "Nota aprovada" : "Nota rejeitada")
        await load()
      } catch (e) {
        if (e instanceof ApiError) toast.error(e.message)
        else toast.error("Falha ao atualizar nota")
      } finally {
        setBusyId(null)
      }
    },
    [token, refreshToken, currentWorkspace, load],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Memoria do time (second-brain)
        </CardTitle>
        <CardDescription>
          Aprendizados persistidos no vault deste workspace. Coordenadores com memoria persistente recebem resumos
          aprovados; propostas aparecem aqui ate revisao humana.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={!currentWorkspace || loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Carregar
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => void reindex()} disabled={!currentWorkspace || loading}>
            Reindexar
          </Button>
        </div>

        <ScrollArea className="h-[280px] rounded-md border border-border p-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma nota carregada. Clique em Carregar (e confirme permissoes de admin do workspace se aplicavel).
            </p>
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <li key={r.noteId} className="rounded-md border border-border bg-card/40 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium line-clamp-1">{r.title || r.noteId}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {r.status}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {r.kind}
                    </Badge>
                  </div>
                  {r.bodyPreview ? (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{r.bodyPreview}</p>
                  ) : null}
                  {r.status === "proposed" ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        disabled={busyId === r.noteId}
                        onClick={() => void setStatus(r.noteId, "approve")}
                      >
                        Aprovar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === r.noteId}
                        onClick={() => void setStatus(r.noteId, "reject")}
                      >
                        Rejeitar
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
