"use client"

import { ThemeProvider } from "@/components/theme-provider"
import { UserPreferencesSync } from "@/components/layout/user-preferences-sync"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <UserPreferencesSync />
      {children}
    </ThemeProvider>
  )
}
