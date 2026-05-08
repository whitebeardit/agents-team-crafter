"use client"

import { useEffect, useMemo, useState } from "react"
import { ApiError, createApiClient } from "@/lib/api/client"
import type { Team } from "@/lib/types"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { pickOperationTeam } from "./pick-operation-team"

/**
 * Resolve o time de operação agent-first a partir da lista carregada e da preferência persistida.
 * Se o pin aponta para um ID fora da lista (paginação), tenta GET /teams/:id; remove pin em 404.
 */
export function useOperationTeamResolution(teams: Team[]) {
  const token = useWorkspaceStore((s) => s.token)
  const refreshToken = useWorkspaceStore((s) => s.refreshToken)
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspace?.id)
  const pinnedMap = useWorkspaceStore((s) => s.primaryOperationTeamByWorkspace)
  const setPrimary = useWorkspaceStore((s) => s.setPrimaryOperationTeamForWorkspace)

  const pinnedId = workspaceId ? pinnedMap[workspaceId] : undefined

  /** Time carregado à parte quando o ID fixado não veio na página de listagem. */
  const [fetchedPinnedOverride, setFetchedPinnedOverride] = useState<Team | null>(null)

  useEffect(() => {
    if (!token || !workspaceId || !pinnedId) {
      return
    }
    if (teams.some((t) => t.id === pinnedId)) {
      return
    }

    let cancelled = false
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => workspaceId,
    })

    void (async () => {
      try {
        const res = await api.get<Team>(`/teams/${pinnedId}`)
        if (!cancelled) setFetchedPinnedOverride(res.data)
      } catch (e) {
        if (!cancelled) {
          setFetchedPinnedOverride(null)
          if (e instanceof ApiError && e.status === 404) {
            setPrimary(workspaceId, null)
          }
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token, refreshToken, workspaceId, pinnedId, teams, setPrimary])

  const operationTeam = useMemo(() => {
    const pinned = workspaceId ? pinnedMap[workspaceId] : undefined
    if (
      pinned &&
      !teams.some((t) => t.id === pinned) &&
      fetchedPinnedOverride?.id === pinned
    ) {
      return fetchedPinnedOverride
    }
    return pickOperationTeam(teams, workspaceId, pinnedMap)
  }, [teams, workspaceId, pinnedMap, fetchedPinnedOverride])

  const usesPinnedPrimary = Boolean(pinnedId && operationTeam?.id === pinnedId)

  return { operationTeam, usesPinnedPrimary, pinnedId: pinnedId ?? null }
}
