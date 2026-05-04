"use client"

import { useEffect } from "react"
import { SESSION_LOST_EVENT } from "@/lib/auth/session-lost-event"
import { useWorkspaceStore } from "@/lib/store/workspace-store"

/** Sincroniza o store com falhas de sessão detetadas em `lib/api/client` (onde `clearAuth` pode ser no-op). */
export function SessionLostBridge() {
  useEffect(() => {
    const onLost = () => {
      useWorkspaceStore.setState({
        isAuthenticated: false,
        user: null,
        token: null,
        refreshToken: null,
        currentWorkspace: null,
        workspaces: [],
      })
    }
    window.addEventListener(SESSION_LOST_EVENT, onLost)
    return () => window.removeEventListener(SESSION_LOST_EVENT, onLost)
  }, [])
  return null
}
