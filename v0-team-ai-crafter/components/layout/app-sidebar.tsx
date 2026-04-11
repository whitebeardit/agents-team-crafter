"use client"

import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { AgentWhitebeardIcon } from "@/components/brand/agent-whitebeard-icon"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useState } from "react"
import { AppNavLinks } from "@/components/layout/app-navigation"

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 lg:flex",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-4">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
              <AgentWhitebeardIcon className="h-5 w-5 text-primary-foreground" />
            </div>
            {!collapsed && (
              <span className="truncate text-lg font-semibold text-sidebar-foreground">TeamAgents</span>
            )}
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
          <AppNavLinks variant={collapsed ? "sidebar-collapsed" : "sidebar-expanded"} />
        </div>

        <div className="shrink-0 border-t border-sidebar-border px-3 py-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "h-11 w-full text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              collapsed && "px-0",
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="mr-2 h-4 w-4" />
                <span>Recolher</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
