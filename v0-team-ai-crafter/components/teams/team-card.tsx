"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Crown,
  Radio,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  GitBranch,
  Clock,
} from "lucide-react"
import { AgentWhitebeardIcon } from "@/components/brand/agent-whitebeard-icon"
import type { Team } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"

interface TeamCardProps {
  team: Team
  coordinatorName?: string
  onEdit?: (team: Team) => void
  onDelete?: (team: Team) => void
}

const statusColors = {
  active: "bg-success/10 text-success border-success/20",
  draft: "bg-warning/10 text-warning border-warning/20",
  inactive: "bg-muted text-muted-foreground border-muted",
}

const statusLabels = {
  active: "Ativo",
  draft: "Rascunho",
  inactive: "Inativo",
}

export function TeamCard({ team, coordinatorName, onEdit, onDelete }: TeamCardProps) {
  const updatedAt = formatDistanceToNow(new Date(team.updatedAt), {
    addSuffix: true,
    locale: ptBR,
  })

  return (
    <Card className="border-border bg-card hover:bg-card/80 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link href={`/teams/${team.id}`}>
                <h3 className="font-semibold text-foreground hover:text-primary transition-colors">
                  {team.name}
                </h3>
              </Link>
              <Badge
                variant="outline"
                className={statusColors[team.status]}
              >
                {statusLabels[team.status]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {team.description}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Ações do time"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/teams/${team.id}`}>
                  <Eye className="w-4 h-4 mr-2" />
                  Ver detalhes
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/teams/${team.id}/graph`}>
                  <GitBranch className="w-4 h-4 mr-2" />
                  Editar grafo
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit?.(team)}>
                <Edit className="w-4 h-4 mr-2" />
                Editar time
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete?.(team)}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <AgentWhitebeardIcon className="w-4 h-4" />
            {team.agentIds.length + 1} agentes
          </span>
          <span className="flex items-center gap-1">
            <Radio className="w-4 h-4" />
            {team.channelIds.length} canais
          </span>
        </div>

        {/* Coordinator */}
        {coordinatorName && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Crown className="w-4 h-4 text-warning" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Coordenador</p>
                  <p className="text-sm font-medium text-foreground">
                    {coordinatorName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {updatedAt}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
