import type { Team } from "@/lib/types"

/**
 * Escolhe o time usado nas rotas verticais (CRM, agenda, etc.): preferência persistida por workspace, senão primeiro ativo na lista.
 */
export function pickOperationTeam(
  teams: Team[],
  workspaceId: string | undefined,
  pinnedByWorkspace: Record<string, string>,
): Team | null {
  if (teams.length === 0) return null
  if (!workspaceId) return teams[0] ?? null
  const pinned = pinnedByWorkspace[workspaceId]
  if (pinned) {
    const hit = teams.find((t) => t.id === pinned)
    if (hit) return hit
  }
  return teams[0] ?? null
}
