"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"
import { useWorkspaceStore } from "@/lib/store/workspace-store"

const LOCALE_MAP: Record<string, string> = {
  "pt-BR": "pt-BR",
  "en-US": "en-US",
  es: "es",
}

/**
 * Applies persisted `user.preferences.theme` and `locale` after bootstrap / login.
 */
export function UserPreferencesSync() {
  const user = useWorkspaceStore((s) => s.user)
  const { setTheme } = useTheme()

  useEffect(() => {
    const prefs = user?.preferences as Record<string, unknown> | undefined
    const theme = prefs?.theme
    if (theme === "light" || theme === "dark" || theme === "system") {
      setTheme(theme)
    }
  }, [user?.id, user?.preferences, setTheme])

  useEffect(() => {
    const prefs = user?.preferences as Record<string, unknown> | undefined
    const loc = prefs?.locale
    if (typeof loc === "string" && LOCALE_MAP[loc]) {
      document.documentElement.lang = LOCALE_MAP[loc] ?? "pt-BR"
    }
  }, [user?.preferences])

  return null
}
