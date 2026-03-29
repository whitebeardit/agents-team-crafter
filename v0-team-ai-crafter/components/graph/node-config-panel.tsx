"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { X, Crown, Radio, Database, Trash2 } from "lucide-react"
import { AgentWhitebeardIcon } from "@/components/brand/agent-whitebeard-icon"
import type { Node } from "@xyflow/react"

interface NodeConfigPanelProps {
  node: Node | null
  onClose: () => void
  onUpdate: (id: string, data: Record<string, unknown>) => void
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
  onUpdate,
  onDelete,
  deleteBusy = false,
}: NodeConfigPanelProps) {
  if (!node) return null

  const Icon = nodeIcons[node.type as keyof typeof nodeIcons] || AgentWhitebeardIcon

  const handleLabelChange = (label: string) => {
    onUpdate(node.id, { ...(node.data as Record<string, unknown>), label })
  }

  const handleDescriptionChange = (description: string) => {
    onUpdate(node.id, { ...(node.data as Record<string, unknown>), description })
  }

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
        <FieldGroup>
          <Field>
            <FieldLabel>Nome</FieldLabel>
            <Input
              value={(node.data as { label: string }).label || ""}
              onChange={(e) => handleLabelChange(e.target.value)}
              className="bg-secondary border-border"
            />
          </Field>

          {(node.type === "coordinator" || node.type === "specialist") && (
            <Field>
              <FieldLabel>Descrição</FieldLabel>
              <Textarea
                value={(node.data as { description?: string }).description || ""}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                className="bg-secondary border-border min-h-20"
                placeholder="Descreva a função deste agente..."
              />
            </Field>
          )}

          {node.type === "channel" && (
            <Field>
              <FieldLabel>Tipo de Canal</FieldLabel>
              <Badge variant="outline" className="mt-1">
                {(node.data as { channelType?: string }).channelType || "N/A"}
              </Badge>
            </Field>
          )}
        </FieldGroup>

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
