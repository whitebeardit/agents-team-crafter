"use client"

import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { WorkspaceAvatar } from "@/components/workspace/workspace-avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, LogOut, User, Bell, Search, Menu } from "lucide-react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { useAppShell } from "@/components/layout/app-shell-context"

export function AppHeader() {
  const { openMobileNav } = useAppShell()
  const router = useRouter()
  const { user, currentWorkspace, workspaces, setCurrentWorkspace, logout } =
    useWorkspaceStore()

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const getPlanBadge = (plan: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      enterprise: "default",
      pro: "secondary",
      free: "outline",
    }
    const labels: Record<string, string> = {
      enterprise: "Enterprise",
      pro: "Pro",
      free: "Free",
    }
    return (
      <Badge variant={variants[plan] || "outline"} className="ml-2 text-xs">
        {labels[plan] || plan}
      </Badge>
    )
  }

  return (
    <header className="flex h-16 min-h-16 shrink-0 items-center gap-2 border-b border-border bg-card px-3 sm:px-4 lg:px-6">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11 shrink-0 lg:hidden"
        onClick={openMobileNav}
        aria-label="Abrir menu de navegação"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Search — compacto em mobile; expande a partir de md */}
      <div className="relative hidden min-w-0 flex-1 md:block md:max-w-md lg:max-w-lg">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar agentes, times, templates..."
          className="border-border bg-secondary pl-10"
          aria-label="Buscar na aplicação"
        />
      </div>
      {/* Espaço entre menu e acções em mobile (sem barra de pesquisa) */}
      <div className="min-w-0 flex-1 md:hidden" aria-hidden />

      {/* Right side */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2 md:gap-4">
        {/* Workspace Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-11 max-w-[11rem] gap-2 border-border bg-secondary px-2 sm:max-w-none sm:px-3"
            >
              <WorkspaceAvatar
                name={currentWorkspace?.name ?? "WS"}
                logo={currentWorkspace?.logo}
                className="h-7 w-7 shrink-0"
              />
              <span className="hidden min-w-0 truncate sm:inline md:max-w-32">
                {currentWorkspace?.name || "Selecionar"}
              </span>
              {currentWorkspace && (
                <span className="hidden sm:inline">{getPlanBadge(currentWorkspace.plan)}</span>
              )}
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => setCurrentWorkspace(workspace)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <WorkspaceAvatar name={workspace.name} logo={workspace.logo} className="h-6 w-6 shrink-0" />
                <span className="flex-1 min-w-0 truncate">{workspace.name}</span>
                {getPlanBadge(workspace.plan)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative h-11 w-11 shrink-0" aria-label="Notificações">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-11 gap-2 px-2 sm:px-3">
              <Avatar className="h-8 w-8 shrink-0">
                {user?.avatar ? (
                  <AvatarImage src={user.avatar} alt="" className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-primary text-sm text-primary-foreground">
                  {user ? getInitials(user.name) : "U"}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-24 truncate text-sm sm:inline">
                {user?.name || "Usuário"}
              </span>
              <ChevronDown className="hidden h-4 w-4 opacity-50 sm:inline" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{user?.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {user?.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => router.push("/settings?tab=profile")}
            >
              <User className="w-4 h-4 mr-2" />
              Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
