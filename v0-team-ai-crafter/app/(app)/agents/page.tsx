"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ContextualTourHost, ContextualTourManualTrigger } from "@/components/onboarding/contextual-tour"
import { Search, Filter, X, Sparkles } from "lucide-react"
import { AgentCard } from "@/components/agents/agent-card"
import { AgentDetailsDrawer } from "@/components/agents/agent-details-drawer"
import type { Agent, AgentOrigin, ChannelType } from "@/lib/types"
import { ApiError, createApiClient } from "@/lib/api/client"
import { getBlockingTeamsForAgent } from "@/lib/agents/agent-team-blockers"
import { formatCategoryLabel } from "@/lib/utils/agent-category"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { Team } from "@/lib/types"

const channelOptions = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "slack", label: "Slack" },
  { value: "email", label: "Email" },
  { value: "api", label: "API" },
]

export default function AgentsPage() {
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [search, setSearch] = useState("")
  const [originFilter, setOriginFilter] = useState<AgentOrigin | "all">("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [channelFilter, setChannelFilter] = useState<ChannelType | "all">("all")
  const [roleFilter, setRoleFilter] = useState<"coordinator" | "specialist" | "all">("all")
  const [teamFilter, setTeamFilter] = useState<string>("all")
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentCategories, setAgentCategories] = useState<string[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [addToTeamOpen, setAddToTeamOpen] = useState(false)
  const [agentToAdd, setAgentToAdd] = useState<Agent | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState<string>("")
  const [addingToTeam, setAddingToTeam] = useState(false)
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingAgent, setDeletingAgent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!token || !currentWorkspace) return
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })

    void (async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const qs = new URLSearchParams()
        if (originFilter !== "all") qs.set("origin", originFilter)
        if (categoryFilter !== "all") qs.set("category", categoryFilter)
        if (channelFilter !== "all") qs.set("channel", channelFilter)
        if (roleFilter !== "all") qs.set("role", roleFilter)
        if (teamFilter !== "all") qs.set("teamId", teamFilter)
        if (search) qs.set("search", search)
        qs.set("page", "1")
        qs.set("perPage", "100")

        const [listRes, catsRes, teamsRes] = await Promise.all([
          api.get<Agent[]>(`/agents?${qs.toString()}`),
          api.get<string[]>("/agents/categories"),
          api.get<Team[]>("/teams?page=1&perPage=100"),
        ])
        setAgents(listRes.data)
        setAgentCategories(catsRes.data)
        setTeams(teamsRes.data)
      } catch {
        setLoadError("Não foi possível carregar o catálogo de agentes. Tente novamente.")
      } finally {
        setLoading(false)
      }
    })()
  }, [token, refreshToken, currentWorkspace, originFilter, categoryFilter, channelFilter, roleFilter, teamFilter, search])

  const filteredAgents = useMemo(() => agents, [agents])

  const blockingTeamsForDelete = useMemo(
    () => (agentToDelete ? getBlockingTeamsForAgent(agentToDelete.id, teams) : []),
    [agentToDelete, teams],
  )

  const hasFilters =
    originFilter !== "all" ||
    categoryFilter !== "all" ||
    channelFilter !== "all" ||
    roleFilter !== "all" ||
    teamFilter !== "all" ||
    search !== ""

  const clearFilters = () => {
    setSearch("")
    setOriginFilter("all")
    setCategoryFilter("all")
    setChannelFilter("all")
    setRoleFilter("all")
    setTeamFilter("all")
  }

  const handleViewAgent = (agent: Agent) => {
    setSelectedAgent(agent)
    setDrawerOpen(true)
  }

  const handleAddToTeam = (agent: Agent) => {
    setAgentToAdd(agent)
    setSelectedTeamId("")
    setAddToTeamOpen(true)
  }

  const confirmAddToTeam = async () => {
    if (!token || !currentWorkspace || !agentToAdd || !selectedTeamId) return
    const selectedTeam = teams.find((team) => team.id === selectedTeamId)
    if (!selectedTeam) {
      toast.error("Time nao encontrado")
      return
    }

    if (selectedTeam.agentIds.includes(agentToAdd.id) || selectedTeam.coordinatorId === agentToAdd.id) {
      toast.info("Agente ja pertence a este time")
      setAddToTeamOpen(false)
      return
    }

    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })

    setAddingToTeam(true)
    try {
      const updatedTeam = await api.put<Team>(`/teams/${selectedTeamId}`, {
        agentIds: [...selectedTeam.agentIds, agentToAdd.id],
      })
      setTeams((prev) => prev.map((team) => (team.id === selectedTeamId ? updatedTeam.data : team)))
      toast.success(`Agente adicionado ao time ${updatedTeam.data.name}`)
      setAddToTeamOpen(false)
      setAgentToAdd(null)
      setSelectedTeamId("")
    } catch {
      toast.error("Falha ao adicionar agente ao time")
    } finally {
      setAddingToTeam(false)
    }
  }

  const handleRequestDeleteAgent = (agent: Agent) => {
    setAgentToDelete(agent)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDeleteAgent = async () => {
    if (!token || !currentWorkspace || !agentToDelete) return
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
    setDeletingAgent(true)
    try {
      await api.del<{ message: string }>(`/agents/${agentToDelete.id}`)
      toast.success("Agente removido com sucesso")
      const removedId = agentToDelete.id
      setAgents((prev) => prev.filter((a) => a.id !== removedId))
      setTeams((prev) =>
        prev.map((t) => ({
          ...t,
          agentIds: t.agentIds.filter((id) => id !== removedId),
        })),
      )
      if (selectedAgent?.id === removedId) {
        setSelectedAgent(null)
        setDrawerOpen(false)
      }
      setDeleteDialogOpen(false)
      setAgentToDelete(null)
    } catch (e) {
      if (e instanceof ApiError && e.code === "CONFLICT") {
        const raw = e.details.teams
        const list = Array.isArray(raw) ? (raw as Array<{ name?: string }>) : []
        const names = list.map((t) => t.name).filter(Boolean).join(", ")
        toast.error(e.message, {
          description: names ? `Times: ${names}` : undefined,
        })
      } else {
        toast.error("Falha ao excluir agente")
      }
    } finally {
      setDeletingAgent(false)
    }
  }

  return (
    <div className="space-y-6">
      <ContextualTourHost screenKey="agents_catalog" />
      {/* Page Header */}
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="text-3xl font-bold text-foreground">Catálogo de Agentes</h1>
          <div className="flex flex-wrap items-center gap-2">
            <ContextualTourManualTrigger screenKey="agents_catalog" />
            <Button asChild className="gap-2">
              <Link href="/agents/create">
                <Sparkles className="w-4 h-4" />
                Wizard de Agente
              </Link>
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground mt-1">
          Explore, reutilize e crie agentes com overlap guard no workspace
        </p>
      </div>

      {/* Origin Tabs */}
      <Tabs
        value={originFilter}
        onValueChange={(v) => setOriginFilter(v as AgentOrigin | "all")}
      >
        <TabsList className="bg-secondary">
          <TabsTrigger value="all">
            Todos
            <Badge variant="secondary" className="ml-2">
              {agents.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="whitebeard">
            Whitebeard
            <Badge variant="secondary" className="ml-2">
              {agents.filter((a) => a.origin === "whitebeard").length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="company">
            Minha Empresa
            <Badge variant="secondary" className="ml-2">
              {agents.filter((a) => a.origin === "company").length}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-64 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar agentes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-secondary border-border"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44 bg-secondary border-border">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Categorias</SelectItem>
            {agentCategories.map((category) => (
              <SelectItem key={category} value={category}>
                {formatCategoryLabel(category)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={channelFilter}
          onValueChange={(v) => setChannelFilter(v as ChannelType | "all")}
        >
          <SelectTrigger className="w-40 bg-secondary border-border">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Canais</SelectItem>
            {channelOptions.map((channel) => (
              <SelectItem key={channel.value} value={channel.value}>
                {channel.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={roleFilter}
          onValueChange={(v) => setRoleFilter(v as "coordinator" | "specialist" | "all")}
        >
          <SelectTrigger className="w-44 bg-secondary border-border">
            <SelectValue placeholder="Funcao" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as funcoes</SelectItem>
            <SelectItem value="coordinator">Coordenadores</SelectItem>
            <SelectItem value="specialist">Especialistas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="w-44 bg-secondary border-border">
            <SelectValue placeholder="Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os times</SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" onClick={clearFilters} className="gap-1">
            <X className="w-4 h-4" />
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {filteredAgents.length} agente{filteredAgents.length !== 1 ? "s" : ""}{" "}
        encontrado{filteredAgents.length !== 1 ? "s" : ""}
      </div>

      {/* Agents Grid */}
      {loading ? (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Carregando agentes...
        </div>
      ) : loadError ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive"
          role="alert"
        >
          {loadError}
        </div>
      ) : filteredAgents.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onView={handleViewAgent}
              onAddToTeam={handleAddToTeam}
              onDelete={handleRequestDeleteAgent}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Filter className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground">
            Nenhum agente encontrado
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Tente ajustar os filtros ou termos de busca
          </p>
          <Button variant="outline" onClick={clearFilters} className="mt-4">
            Limpar filtros
          </Button>
        </div>
      )}

      {/* Agent Details Drawer */}
      <AgentDetailsDrawer
        agent={selectedAgent}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onAddToTeam={handleAddToTeam}
      />

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) setAgentToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agente</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Esta acao remove o agente <strong className="text-foreground">{agentToDelete?.name}</strong> do
                  catalogo da sua empresa (nao pode ser desfeita pelo painel).
                </p>
                {blockingTeamsForDelete.length > 0 ? (
                  <div className="rounded-md border border-border bg-secondary/40 p-3 text-foreground">
                    <p className="font-medium text-sm mb-2">Remova o agente dos times antes de excluir:</p>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {blockingTeamsForDelete.map((row) => (
                        <li key={row.id}>
                          {row.name}
                          <span className="text-muted-foreground">
                            {" "}
                            ({row.asCoordinator ? "coordenador" : "membro"})
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-sm">
                      <Link href="/teams" className="text-primary underline underline-offset-4">
                        Gerir times
                      </Link>
                    </p>
                  </div>
                ) : (
                  <p>Nenhum time referencia este agente; pode confirmar a exclusao.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAgent}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={blockingTeamsForDelete.length > 0 || deletingAgent}
              onClick={() => void handleConfirmDeleteAgent()}
            >
              {deletingAgent ? "Removendo..." : "Excluir"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={addToTeamOpen} onOpenChange={setAddToTeamOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar agente ao time</DialogTitle>
            <DialogDescription>
              Selecione um time para adicionar {agentToAdd?.name ?? "o agente"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="add-agent-team-select">Time</Label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger id="add-agent-team-select">
                <SelectValue placeholder="Selecione um time" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddToTeamOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmAddToTeam} disabled={!selectedTeamId || addingToTeam}>
              {addingToTeam ? "Adicionando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
