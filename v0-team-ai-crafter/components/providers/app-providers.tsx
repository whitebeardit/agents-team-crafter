"use client"

import { ThemeProvider } from "@/components/theme-provider"
import { SessionLostBridge } from "@/components/auth/session-lost-bridge"
import { UserPreferencesSync } from "@/components/layout/user-preferences-sync"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <SessionLostBridge />
      <UserPreferencesSync />
      {children}
    </ThemeProvider>
  )
}
