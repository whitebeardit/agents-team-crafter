"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  FileStack,
  Radio,
  Wrench,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  Gavel,
  History,
} from "lucide-react"
import { AgentWhitebeardIcon } from "@/components/brand/agent-whitebeard-icon"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useState } from "react"

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Times",
    href: "/teams",
    icon: Users,
  },
  {
    name: "Agentes",
    href: "/agents",
    icon: AgentWhitebeardIcon,
  },
  {
    name: "Templates",
    href: "/templates",
    icon: FileStack,
  },
  {
    name: "Canais",
    href: "/channels",
    icon: Radio,
  },
  {
    name: "Tools",
    href: "/tool-definitions",
    icon: Wrench,
  },
  {
    name: "Governança",
    href: "/governance",
    icon: Gavel,
  },
  {
    name: "Execuções",
    href: "/runs",
    icon: History,
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
              <AgentWhitebeardIcon className="w-5 h-5 text-primary-foreground" />
            </div>
            {!collapsed && (
              <span className="text-lg font-semibold text-sidebar-foreground">
                TeamAgents
              </span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4">
          <ul className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <li key={item.name}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-primary"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                        )}
                      >
                        <item.icon className="w-5 h-5 shrink-0" />
                        {!collapsed && <span>{item.name}</span>}
                      </Link>
                    </TooltipTrigger>
                    {collapsed && (
                      <TooltipContent side="right">
                        {item.name}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </li>
              )
            })}
          </ul>

          {/* Quick Action */}
          <div className="mt-6 pt-6 border-t border-sidebar-border">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/teams/create"
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    "bg-primary/10 text-primary hover:bg-primary/20",
                    collapsed && "justify-center"
                  )}
                >
                  <Plus className="w-5 h-5 shrink-0" />
                  {!collapsed && <span>Criar Time</span>}
                </Link>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right">
                  Criar Time
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </nav>

        {/* Settings & Collapse */}
        <div className="px-3 py-4 border-t border-sidebar-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/settings"
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <Settings className="w-5 h-5 shrink-0" />
                {!collapsed && <span>Configurações</span>}
              </Link>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">
                Configurações
              </TooltipContent>
            )}
          </Tooltip>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "w-full mt-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
              collapsed && "px-0"
            )}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 mr-2" />
                <span>Recolher</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
