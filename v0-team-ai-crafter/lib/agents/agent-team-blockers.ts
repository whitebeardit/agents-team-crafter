import type { Team } from "@/lib/types"

export interface IBlockingTeamRow {
  id: string
  name: string
  asCoordinator: boolean
}

/** Times do workspace que impedem exclusao do agente (coordenador ou membro). */
export function getBlockingTeamsForAgent(agentId: string, teams: Team[]): IBlockingTeamRow[] {
  return teams
    .filter((t) => t.coordinatorId === agentId || t.agentIds.includes(agentId))
    .map((t) => ({
      id: t.id,
      name: t.name,
      asCoordinator: t.coordinatorId === agentId,
    }))
}
