"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { WORKSPACE_DEFAULT_LOGO } from "@/lib/constants/workspace"
import { cn } from "@/lib/utils"

function workspaceInitials(name: string): string {
  const trimmed = name.trim() || "WS"
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  }
  return trimmed.slice(0, 2).toUpperCase()
}

export function WorkspaceAvatar({
  name,
  logo,
  className,
}: {
  name: string
  logo?: string | null
  className?: string
}) {
  const src = logo?.trim() || WORKSPACE_DEFAULT_LOGO

  return (
    <Avatar className={cn(className)}>
      <AvatarImage src={src} alt="" />
      <AvatarFallback className="text-xs bg-primary/10 text-primary">
        {workspaceInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
