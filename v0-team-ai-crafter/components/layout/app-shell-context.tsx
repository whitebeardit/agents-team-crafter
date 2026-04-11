"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

type TAppShellContext = {
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
  openMobileNav: () => void
  closeMobileNav: () => void
}

const AppShellContext = createContext<TAppShellContext | null>(null)

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const openMobileNav = useCallback(() => setMobileNavOpen(true), [])
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), [])

  const value = useMemo(
    () => ({
      mobileNavOpen,
      setMobileNavOpen,
      openMobileNav,
      closeMobileNav,
    }),
    [mobileNavOpen, openMobileNav, closeMobileNav],
  )

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>
}

export function useAppShell(): TAppShellContext {
  const ctx = useContext(AppShellContext)
  if (!ctx) {
    throw new Error("useAppShell must be used within AppShellProvider")
  }
  return ctx
}
