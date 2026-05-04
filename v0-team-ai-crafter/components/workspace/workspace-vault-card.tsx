"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ApiError, createApiClient } from "@/lib/api/client"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Database, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import type { Agent, Team } from "@/lib/types"

type VaultNoteRow = {
  noteId: string
  status: string
  kind: string
  title: string
  bodyPreview: string
  agentId: string
  partyId?: string
  contentHash?: string
}

type WorkspaceVaultCardProps = {
  /** Deep link a partir de `?vaultNote=` */
  deepLinkNoteId?: string
  /** Deep link a partir de `?vaultParty=` */
  deepLinkPartyId?: string
}

export function WorkspaceVaultCard({ deepLinkNoteId, deepLinkPartyId }: WorkspaceVaultCardProps) {
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [rows, setRows] = useState<VaultNoteRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [partyFilter, setPartyFilter] = useState("")
  const [teamFilter, setTeamFilter] = useState("")
  const [agentFilter, setAgentFilter] = useState("")
  const [parties, setParties] = useState<Array<{ id: string; displayName: string }>>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const rowRefs = useRef<Record<string, HTMLLIElement | null>>({})

  const agentsInSelectedTeam = useMemo(() => {
    if (!teamFilter.trim()) return agents
    const t = teams.find((x) => x.id === teamFilter.trim())
    if (!t?.agentIds?.length) return []
    const set = new Set(t.agentIds)
    return agents.filter((a) => set.has(a.id))
  }, [agents, teamFilter, teams])

  const api = useCallback(() => {
    if (!token || !currentWorkspace) return null
    return createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
  }, [token, refreshToken, currentWorkspace])

  useEffect(() => {
    if (deepLinkPartyId) setPartyFilter(deepLinkPartyId)
  }, [deepLinkPartyId])

  useEffect(() => {
    const client = api()
    if (!client) return
    void (async () => {
      try {
        const res = await client.get<Array<{ id: string; displayName: string }>>("/parties?limit=50")
        setParties(Array.isArray(res.data) ? res.data : [])
      } catch {
        setParties([])
      }
      try {
        const tr = await client.get<Team[]>("/teams?page=1&perPage=100")
        setTeams(Array.isArray(tr.data) ? tr.data : [])
      } catch {
        setTeams([])
      }
      try {
        const ar = await client.get<Agent[]>("/agents?page=1&perPage=100")
        setAgents(Array.isArray(ar.data) ? ar.data : [])
      } catch {
        setAgents([])
      }
    })()
  }, [api])

  const load = useCallback(async () => {
    const client = api()
    if (!client) return
    setLoading(true)
    try {
      let path: string
      if (partyFilter.trim()) {
        path = `/vault/parties/${encodeURIComponent(partyFilter.trim())}/notes?limit=200`
      } else {
        const q = new URLSearchParams({ limit: "200" })
        const aid = agentFilter.trim()
        const tid = teamFilter.trim()
        if (aid) q.set("agentId", aid)
        else if (tid) q.set("teamId", tid)
        path = `/vault/notes?${q.toString()}`
      }
      const res = await client.get<VaultNoteRow[]>(path)
      setRows(res.data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("Falha ao carregar memoria do time")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [api, partyFilter, teamFilter, agentFilter])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const client = api()
    if (!client || teams.length === 0) return
    const teamId = teams[0]!.id
    const ac = new AbortController()
    void client.streamTeamLive(
      teamId,
      {
        onVaultNoteChanged: () => {
          void load()
        },
      },
      ac.signal,
    )
    return () => ac.abort()
  }, [api, teams, load])

  useEffect(() => {
    if (!deepLinkNoteId || rows.length === 0) return
    const el = rowRefs.current[deepLinkNoteId]
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [deepLinkNoteId, rows])

  const reindex = useCallback(async () => {
    const client = api()
    if (!client) return
    setLoading(true)
    try {
      await client.post("/vault/reindex")
      toast.success("Reindex solicitado")
      await load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("Falha ao reindexar vault")
    } finally {
      setLoading(false)
    }
  }, [api, load])

  const setStatus = useCallback(
    async (noteId: string, action: "approve" | "reject", contentHash?: string) => {
      const client = api()
      if (!client) return
      setBusyId(noteId)
      try {
        const path =
          action === "approve" ? `/vault/notes/${noteId}/approve` : `/vault/notes/${noteId}/reject`
        await client.put(path, undefined, contentHash ? { ifMatch: contentHash } : undefined)
        toast.success(action === "approve" ? "Nota aprovada" : "Nota rejeitada")
        await load()
      } catch (e) {
        if (e instanceof ApiError) toast.error(e.message)
        else toast.error("Falha ao atualizar nota")
      } finally {
        setBusyId(null)
      }
    },
    [api, load],
  )

  const removeNote = useCallback(
    async (noteId: string, contentHash?: string) => {
      const client = api()
      if (!client) return
      setBusyId(noteId)
      try {
        await client.del(`/vault/notes/${encodeURIComponent(noteId)}`, contentHash ? { ifMatch: contentHash } : {})
        toast.success("Nota removida")
        await load()
      } catch (e) {
        if (e instanceof ApiError) toast.error(e.message)
        else toast.error("Falha ao apagar nota")
      } finally {
        setBusyId(null)
      }
    },
    [api, load],
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
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Time</Label>
            <Select
              value={teamFilter.trim() ? teamFilter : "__all_teams__"}
              onValueChange={(v) => {
                const next = v === "__all_teams__" ? "" : v
                setTeamFilter(next)
                if (next) {
                  const t = teams.find((x) => x.id === next)
                  const allowed = new Set(t?.agentIds ?? [])
                  if (agentFilter && !allowed.has(agentFilter)) setAgentFilter("")
                }
              }}
            >
              <SelectTrigger className="w-[min(100%,240px)]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all_teams__">Todos</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name || t.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Agente</Label>
            <Select
              value={agentFilter.trim() ? agentFilter : "__all_agents__"}
              onValueChange={(v) => setAgentFilter(v === "__all_agents__" ? "" : v)}
            >
              <SelectTrigger className="w-[min(100%,260px)]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all_agents__">Todos</SelectItem>
                {agentsInSelectedTeam.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name || a.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Cliente (party)</Label>
            <Select
              value={partyFilter.trim() ? partyFilter : "__all__"}
              onValueChange={(v) => setPartyFilter(v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="w-[min(100%,280px)]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {parties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.displayName || p.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={!currentWorkspace || loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Carregar
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => void reindex()} disabled={!currentWorkspace || loading}>
            Reindexar
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground max-w-3xl">
          Com <strong className="font-medium text-foreground/80">Time</strong> em Todos, o filtro{" "}
          <strong className="font-medium text-foreground/80">Agente</strong> lista todos os agentes do workspace. Ao
          escolher um time especifico, o filtro de Agente lista apenas os membros desse time. O filtro{" "}
          <strong className="font-medium text-foreground/80">Cliente</strong> e independente.
        </p>

        <ScrollArea className="h-[280px] rounded-md border border-border p-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma nota carregada. Clique em Carregar (e confirme permissoes de admin do workspace se aplicavel).
            </p>
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => {
                const agentName = agents.find((a) => a.id === r.agentId)?.name
                const teamsForRow = teams.filter((t) => t.agentIds?.includes(r.agentId))
                const partyName = r.partyId ? parties.find((p) => p.id === r.partyId)?.displayName : undefined
                return (
                <li
                  key={r.noteId}
                  ref={(el) => {
                    rowRefs.current[r.noteId] = el
                  }}
                  className="rounded-md border border-border bg-card/40 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium line-clamp-1">{r.title || r.noteId}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {r.status}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {r.kind}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-sky-500/30 bg-sky-500/15 text-[10px] text-sky-700 dark:text-sky-300"
                    >
                      {agentName ?? `Agente ${r.agentId.slice(0, 8)}…`}
                    </Badge>
                    {teamsForRow.map((t) => (
                      <Badge
                        key={`${r.noteId}-team-${t.id}`}
                        variant="outline"
                        className="border-violet-500/30 bg-violet-500/15 text-[10px] text-violet-700 dark:text-violet-300"
                      >
                        {t.name || t.id}
                      </Badge>
                    ))}
                    {r.partyId ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-500/30 bg-emerald-500/15 text-[10px] text-emerald-700 dark:text-emerald-300"
                      >
                        {partyName ?? r.partyId}
                      </Badge>
                    ) : null}
                  </div>
                  {r.bodyPreview ? (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{r.bodyPreview}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.status === "proposed" ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          disabled={busyId === r.noteId}
                          onClick={() => void setStatus(r.noteId, "approve", r.contentHash)}
                        >
                          Aprovar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyId === r.noteId}
                          onClick={() => void setStatus(r.noteId, "reject", r.contentHash)}
                        >
                          Rejeitar
                        </Button>
                      </>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busyId === r.noteId}
                      onClick={() => {
                        if (
                          !window.confirm(
                            "Apagar esta nota definitivamente? O ficheiro sera removido do vault e do indice.",
                          )
                        )
                          return
                        void removeNote(r.noteId, r.contentHash)
                      }}
                    >
                      Apagar
                    </Button>
                  </div>
                </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
