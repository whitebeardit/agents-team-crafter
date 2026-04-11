"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { ContextualTourHost, ContextualTourManualTrigger } from "@/components/onboarding/contextual-tour"
import { Plus, Users } from "lucide-react"
import { TeamCard } from "@/components/teams/team-card"
import { useCallback, useEffect, useState } from "react"
import type { TeamStatus } from "@/lib/types"
import type { Agent, Team } from "@/lib/types"
import { createApiClient } from "@/lib/api/client"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { toast } from "sonner"

export default function TeamsPage() {
  const router = useRouter()
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [statusFilter, setStatusFilter] = useState<TeamStatus | "all">("all")
  const [teams, setTeams] = useState<Team[]>([])
  const [agentsById, setAgentsById] = useState<Record<string, Agent>>({})
  const [teamPendingDelete, setTeamPendingDelete] = useState<Team | null>(null)
  const [deleting, setDeleting] = useState(false)

  const buildApiClient = useCallback(() => {
    if (!token || !currentWorkspace) return null
    return createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
  }, [token, refreshToken, currentWorkspace])

  useEffect(() => {
    const api = buildApiClient()
    if (!api) return
    void (async () => {
      const qs = new URLSearchParams()
      if (statusFilter !== "all") qs.set("status", statusFilter)
      qs.set("page", "1")
      qs.set("perPage", "50")
      const [teamsRes, agentsRes] = await Promise.all([
        api.get<Team[]>(`/teams?${qs.toString()}`),
        api.get<Agent[]>("/agents?page=1&perPage=100"),
      ])
      setTeams(teamsRes.data)
      setAgentsById(
        Object.fromEntries(agentsRes.data.map((agent) => [agent.id, agent] as const)),
      )
    })()
  }, [buildApiClient, statusFilter])

  const handleEditTeam = useCallback(
    (team: Team) => {
      router.push(`/teams/${team.id}?edit=1`)
    },
    [router],
  )

  const handleConfirmDelete = useCallback(async () => {
    if (!teamPendingDelete) return
    const api = buildApiClient()
    if (!api) return
    const id = teamPendingDelete.id
    setDeleting(true)
    try {
      await api.del(`/teams/${id}`)
      setTeams((prev) => prev.filter((t) => t.id !== id))
      toast.success("Time removido com sucesso")
      setTeamPendingDelete(null)
    } catch {
      toast.error("Falha ao excluir o time")
    } finally {
      setDeleting(false)
    }
  }, [buildApiClient, teamPendingDelete])

  const filteredTeams =
    statusFilter === "all"
      ? teams
      : teams.filter((t) => t.status === statusFilter)

  const activeCount = teams.filter((t) => t.status === "active").length
  const draftCount = teams.filter((t) => t.status === "draft").length

  return (
    <div className="space-y-6">
      <ContextualTourHost screenKey="teams_list" />
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Times</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seus times de agentes de IA
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <ContextualTourManualTrigger screenKey="teams_list" />
          <Link href="/teams/create">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Criar Time
            </Button>
          </Link>
        </div>
      </div>

      {/* Status Tabs */}
      <Tabs
        value={statusFilter}
        onValueChange={(v) => setStatusFilter(v as TeamStatus | "all")}
      >
        <TabsList className="bg-secondary">
          <TabsTrigger value="all">
            Todos
            <Badge variant="secondary" className="ml-2">
              {teams.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="active">
            Ativos
            <Badge variant="secondary" className="ml-2">
              {activeCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="draft">
            Rascunhos
            <Badge variant="secondary" className="ml-2">
              {draftCount}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Teams Grid */}
      {filteredTeams.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTeams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              coordinatorName={agentsById[team.coordinatorId]?.name}
              onEdit={handleEditTeam}
              onDelete={setTeamPendingDelete}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground">
            Nenhum time encontrado
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Crie seu primeiro time de agentes
          </p>
          <Link href="/teams/create">
            <Button className="mt-4 gap-2">
              <Plus className="w-4 h-4" />
              Criar Time
            </Button>
          </Link>
        </div>
      )}

      <AlertDialog
        open={teamPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setTeamPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir time?</AlertDialogTitle>
            <AlertDialogDescription>
              {teamPendingDelete
                ? `Esta ação não pode ser desfeita. O time "${teamPendingDelete.name}" será removido permanentemente.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => void handleConfirmDelete()}
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
