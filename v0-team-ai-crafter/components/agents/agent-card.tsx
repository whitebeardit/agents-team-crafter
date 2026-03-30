"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Crown, MoreVertical, Eye, Plus, Copy, Trash2 } from "lucide-react"
import { AgentWhitebeardIcon } from "@/components/brand/agent-whitebeard-icon"
import type { Agent } from "@/lib/types"
import { formatCategoryLabel } from "@/lib/utils/agent-category"

interface AgentCardProps {
  agent: Agent
  onView?: (agent: Agent) => void
  onAddToTeam?: (agent: Agent) => void
  onDuplicate?: (agent: Agent) => void
  onDelete?: (agent: Agent) => void
}

const originLabels = {
  whitebeard: "Whitebeard",
  company: "Minha Empresa",
}

const originColors = {
  whitebeard: "bg-primary/10 text-primary border-primary/20",
  company: "bg-accent/10 text-accent border-accent/20",
}

const channelLabels: Record<string, string> = {
  whatsapp: "WhatsApp",
  slack: "Slack",
  email: "Email",
  api: "API",
}

export function AgentCard({ agent, onView, onAddToTeam, onDuplicate, onDelete }: AgentCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <Card className="border-border bg-card hover:bg-card/80 transition-colors group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12 rounded-lg">
              <AvatarFallback
                className={`rounded-lg text-sm font-medium ${
                  agent.role === "coordinator"
                    ? "bg-primary/20 text-primary"
                    : "bg-accent/20 text-accent"
                }`}
              >
                {agent.origin === "whitebeard" ? (
                  <AgentWhitebeardIcon className="size-10 shrink-0" aria-hidden />
                ) : (
                  getInitials(agent.name)
                )}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{agent.name}</h3>
                {agent.role === "coordinator" && (
                  <Crown className="w-4 h-4 text-warning" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  variant="outline"
                  className={`text-xs ${originColors[agent.origin]}`}
                >
                  {originLabels[agent.origin]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  v{agent.version}
                </span>
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView?.(agent)}>
                <Eye className="w-4 h-4 mr-2" />
                Ver detalhes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddToTeam?.(agent)}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar ao time
              </DropdownMenuItem>
              {agent.origin === "whitebeard" && (
                <DropdownMenuItem onClick={() => onDuplicate?.(agent)}>
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicar
                </DropdownMenuItem>
              )}
              {agent.origin === "company" && onDelete && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(agent)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir agente
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
          {agent.description}
        </p>

        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Skills
          </p>
          <div className="flex flex-wrap gap-1">
            {agent.skills.slice(0, 3).map((skill) => (
              <Badge key={skill} variant="secondary" className="text-xs">
                {skill}
              </Badge>
            ))}
            {agent.skills.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{agent.skills.length - 3}
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {agent.channels.map((channel) => (
                <Badge
                  key={channel}
                  variant="outline"
                  className="text-xs px-1.5"
                >
                  {channelLabels[channel]}
                </Badge>
              ))}
            </div>
            <Badge
              variant="outline"
              className="text-xs capitalize"
            >
              {formatCategoryLabel(agent.category)}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
