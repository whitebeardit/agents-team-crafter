"use client"

import { useEffect, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { AppHeader } from "@/components/layout/app-header"
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
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  )
}
