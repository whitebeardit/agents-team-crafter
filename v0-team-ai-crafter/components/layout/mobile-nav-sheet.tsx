"use client"

import Link from "next/link"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { AgentWhitebeardIcon } from "@/components/brand/agent-whitebeard-icon"
import { AppNavLinks } from "@/components/layout/app-navigation"
import { useAppShell } from "@/components/layout/app-shell-context"

export function MobileNavSheet() {
  const { mobileNavOpen, setMobileNavOpen, closeMobileNav } = useAppShell()

  return (
    <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <SheetContent
        side="left"
        className="w-[min(100vw-1rem,20rem)] max-w-[85vw] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&>button]:top-3 [&>button]:right-3"
      >
        <SheetDescription className="sr-only">
          Navegação principal do workspace
        </SheetDescription>
        <div className="flex h-full flex-col">
          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-sidebar-border px-4">
            <Link
              href="/dashboard"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-primary"
              onClick={closeMobileNav}
            >
              <AgentWhitebeardIcon className="h-5 w-5 text-primary-foreground" />
            </Link>
            <SheetTitle className="text-lg font-semibold text-sidebar-foreground">TeamAgents</SheetTitle>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
            <AppNavLinks variant="mobile-sheet" onNavigate={closeMobileNav} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
