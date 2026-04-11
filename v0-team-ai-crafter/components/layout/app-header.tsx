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
import { ChevronDown, LogOut, User, Bell, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"

export function AppHeader() {
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
    <header className="flex items-center justify-between h-16 px-6 border-b border-border bg-card">
      {/* Search */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar agentes, times, templates..."
            className="pl-10 bg-secondary border-border"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Workspace Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 bg-secondary border-border">
              <WorkspaceAvatar
                name={currentWorkspace?.name ?? "WS"}
                logo={currentWorkspace?.logo}
                className="h-7 w-7 shrink-0"
              />
              <span className="max-w-32 truncate">
                {currentWorkspace?.name || "Selecionar"}
              </span>
              {currentWorkspace && getPlanBadge(currentWorkspace.plan)}
              <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
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
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="w-8 h-8">
                {user?.avatar ? (
                  <AvatarImage src={user.avatar} alt="" className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {user ? getInitials(user.name) : "U"}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-24 truncate text-sm">
                {user?.name || "Usuário"}
              </span>
              <ChevronDown className="w-4 h-4 opacity-50" />
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
