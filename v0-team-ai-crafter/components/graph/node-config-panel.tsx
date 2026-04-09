"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { X, Crown, Radio, Database, Trash2 } from "lucide-react"
import { AgentWhitebeardIcon } from "@/components/brand/agent-whitebeard-icon"
import type { Node } from "@xyflow/react"

interface NodeConfigPanelProps {
  node: Node | null
  onClose: () => void
  onDelete: (id: string) => void | Promise<void>
  deleteBusy?: boolean
}

const nodeIcons = {
  coordinator: Crown,
  specialist: AgentWhitebeardIcon,
  channel: Radio,
  knowledge: Database,
}

const nodeLabels = {
  coordinator: "Coordenador",
  specialist: "Especialista",
  channel: "Canal",
  knowledge: "Base de Conhecimento",
}

export function NodeConfigPanel({
  node,
  onClose,
  onDelete,
  deleteBusy = false,
}: NodeConfigPanelProps) {
  if (!node) return null

  const Icon = nodeIcons[node.type as keyof typeof nodeIcons] || AgentWhitebeardIcon
  const data = (node.data ?? {}) as Record<string, unknown>

  return (
    <Card className="w-80 border-border bg-card shadow-xl absolute right-4 top-4 z-10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">
              {nodeLabels[node.type as keyof typeof nodeLabels] || "Nó"}
            </CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 rounded-md border border-border bg-secondary/30 p-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Nome</p>
            <p className="font-medium">{String(data.label ?? "Sem nome")}</p>
          </div>
          {(node.type === "coordinator" || node.type === "specialist") && (
            <div>
              <p className="text-xs text-muted-foreground">Descrição</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {String(data.description ?? "A composição estrutural do time é gerida fora do canvas.")}
              </p>
            </div>
          )}
          {node.type === "channel" && (
            <div>
              <p className="text-xs text-muted-foreground">Tipo de canal</p>
              <Badge variant="outline" className="mt-1">
                {String(data.channelType ?? "N/A")}
              </Badge>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            O canvas é estrutural: use a ficha do time e os wizards para adicionar ou redefinir composição.
          </p>
        </div>

        <Separator />

        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <span className="font-medium">ID:</span> {node.id}
          </p>
          {(node.type === "coordinator" || node.type === "specialist") &&
            (node.data as { agentId?: string }).agentId && (
              <p>
                <span className="font-medium">Agente:</span>{" "}
                {(node.data as { agentId?: string }).agentId}
              </p>
            )}
          {node.type === "channel" && (node.data as { channelId?: string }).channelId && (
            <p>
              <span className="font-medium">Canal:</span>{" "}
              {(node.data as { channelId?: string }).channelId}
            </p>
          )}
          <p>
            <span className="font-medium">Posição:</span> x:{" "}
            {Math.round(node.position.x)}, y: {Math.round(node.position.y)}
          </p>
        </div>

        <Separator />

        <Button
          variant="outline"
          className="w-full text-destructive hover:text-destructive"
          disabled={deleteBusy}
          onClick={() => void onDelete(node.id)}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {deleteBusy ? "Removendo..." : "Remover do time e grafo"}
        </Button>
      </CardContent>
    </Card>
  )
}
