"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Users,
  FileStack,
  Radio,
  Wrench,
  Settings,
  Plus,
  Gavel,
  History,
  CalendarDays,
  Activity,
} from "lucide-react"
import { AgentWhitebeardIcon } from "@/components/brand/agent-whitebeard-icon"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export type NavItem = {
  name: string
  href: string
  icon: LucideIcon | typeof AgentWhitebeardIcon
}

export const APP_NAVIGATION: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Times", href: "/teams", icon: Users },
  { name: "Agentes", href: "/agents", icon: AgentWhitebeardIcon },
  { name: "Templates", href: "/templates", icon: FileStack },
  { name: "Canais", href: "/channels", icon: Radio },
  { name: "Agenda", href: "/schedule", icon: CalendarDays },
  { name: "Tools", href: "/tool-definitions", icon: Wrench },
  { name: "Governança", href: "/governance", icon: Gavel },
  { name: "Execuções", href: "/runs", icon: History },
  { name: "Observabilidade", href: "/observability", icon: Activity },
]

type NavVariant = "sidebar-expanded" | "sidebar-collapsed" | "mobile-sheet"

export function AppNavLinks({
  variant,
  onNavigate,
  className,
}: {
  variant: NavVariant
  onNavigate?: () => void
  className?: string
}) {
  const pathname = usePathname()
  const collapsed = variant === "sidebar-collapsed"
  const showLabels = variant !== "sidebar-collapsed"

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-11",
      active
        ? "bg-sidebar-accent text-sidebar-primary"
        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
      collapsed && "justify-center px-0",
    )

  const wrapWithTooltip = (node: React.ReactNode, label: string) => {
    if (!collapsed) return node
    return (
      <Tooltip>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <nav className={cn("flex flex-col", className)}>
      <ul className="space-y-1">
        {APP_NAVIGATION.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const inner = (
            <Link
              href={item.href}
              className={linkClass(isActive)}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {showLabels && <span>{item.name}</span>}
            </Link>
          )
          return (
            <li key={item.name}>
              {variant === "sidebar-collapsed"
                ? wrapWithTooltip(inner, item.name)
                : inner}
            </li>
          )
        })}
      </ul>

      <div
        className={cn(
          "mt-6 pt-6 border-t border-sidebar-border",
          variant === "mobile-sheet" && "mt-4 pt-4",
        )}
      >
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/teams/create"
                className={cn(
                  "flex min-h-11 items-center justify-center rounded-lg py-2.5 text-sm font-medium transition-colors",
                  "bg-primary/10 text-primary hover:bg-primary/20",
                )}
                onClick={onNavigate}
              >
                <Plus className="h-5 w-5 shrink-0" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Criar Time</TooltipContent>
          </Tooltip>
        ) : (
          <Link
            href="/teams/create"
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              "bg-primary/10 text-primary hover:bg-primary/20",
            )}
            onClick={onNavigate}
          >
            <Plus className="h-5 w-5 shrink-0" />
            <span>Criar Time</span>
          </Link>
        )}
      </div>

      <div className="mt-4 border-t border-sidebar-border pt-4">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/settings"
                className={cn(
                  "flex min-h-11 items-center justify-center rounded-lg py-2.5 text-sm font-medium transition-colors",
                  "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
                onClick={onNavigate}
              >
                <Settings className="h-5 w-5 shrink-0" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Configurações</TooltipContent>
          </Tooltip>
        ) : (
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-11",
              "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
            )}
            onClick={onNavigate}
          >
            <Settings className="w-5 h-5 shrink-0" />
            <span>Configurações</span>
          </Link>
        )}
      </div>
    </nav>
  )
}
