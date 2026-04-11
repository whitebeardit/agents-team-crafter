"use client"

import { useEffect, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { AppHeader } from "@/components/layout/app-header"
import { AppShellProvider } from "@/components/layout/app-shell-context"
import { MobileNavSheet } from "@/components/layout/mobile-nav-sheet"
import { Toaster } from "@/components/ui/sonner"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
  const router = useRouter()
  const { isAuthenticated, bootstrap } = useWorkspaceStore()

  useEffect(() => {
    if (!mounted) return
    if (!isAuthenticated) {
      router.push("/login")
      return
    }
    void bootstrap()
  }, [mounted, isAuthenticated, router, bootstrap])

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Redirecionando para login...</div>
      </div>
    )
  }

  return (
    <AppShellProvider>
      <div className="flex h-[100dvh] min-h-0 overflow-hidden">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <AppHeader />
          <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
        <MobileNavSheet />
        <Toaster position="top-center" />
      </div>
    </AppShellProvider>
  )
}
