"use client"

import { memo } from "react"
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { Crown, Radio, Database, Plug, Brain } from "lucide-react"
import { AgentWhitebeardIcon } from "@/components/brand/agent-whitebeard-icon"
import { cn } from "@/lib/utils"
import type { GraphNodeIndicators, AgentRole } from "@/lib/types"

export interface AgentNodeData {
  label: string
  role: AgentRole
  category?: string
  description?: string
  indicators?: GraphNodeIndicators
}

export interface ChannelNodeData {
  label: string
  channelType: "whatsapp" | "slack" | "email" | "api"
  status?: "connected" | "disconnected"
}

export interface KnowledgeNodeData {
  label: string
  description?: string
}

const nodeColors = {
  coordinator: {
    bg: "bg-primary/10",
    border: "border-primary/30",
    icon: "text-warning",
  },
  specialist: {
    bg: "bg-accent/10",
    border: "border-accent/30",
    icon: "text-accent",
  },
  channel: {
    bg: "bg-success/10",
    border: "border-success/30",
    icon: "text-success",
  },
  knowledge: {
    bg: "bg-secondary",
    border: "border-border",
    icon: "text-muted-foreground",
  },
}

function NodeIndicators({ indicators }: { indicators?: GraphNodeIndicators }) {
  if (!indicators) return null
  
  const { hasMcp, hasKnowledge, hasChannels } = indicators
  const activeIndicators = [
    hasMcp && { icon: Plug, color: "text-primary", title: "MCP conectado" },
    hasKnowledge && { icon: Brain, color: "text-warning", title: "Conhecimento ativo" },
    hasChannels && { icon: Radio, color: "text-success", title: "Canais habilitados" },
  ].filter(Boolean) as { icon: typeof Plug; color: string; title: string }[]

  if (activeIndicators.length === 0) return null

  return (
    <div className="flex items-center gap-1 mt-1">
      {activeIndicators.map(({ icon: Icon, color, title }, index) => (
        <div key={index} className="relative group">
          <Icon className={cn("w-3 h-3", color)} />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-popover border rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
            {title}
          </div>
        </div>
      ))}
    </div>
  )
}

type AgentNodeDataRecord = AgentNodeData & Record<string, unknown>

type CoordinatorNodeType = Node<AgentNodeDataRecord, "coordinator">

export const CoordinatorNode = memo(function CoordinatorNode({
  data,
  selected,
}: NodeProps<CoordinatorNodeType>) {
  return (
    <div
      className={cn(
        "px-4 py-3 rounded-lg border-2 min-w-44 transition-all",
        nodeColors.coordinator.bg,
        selected ? "border-primary shadow-lg shadow-primary/20" : nodeColors.coordinator.border
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-primary !border-primary-foreground !w-3 !h-3"
      />
      <div className="flex items-center gap-2">
        <Crown className={cn("w-5 h-5", nodeColors.coordinator.icon)} />
        <div>
          <p className="font-medium text-sm text-foreground">{data.label}</p>
          <p className="text-xs text-muted-foreground">Coordenador</p>
          <NodeIndicators indicators={data.indicators} />
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-primary !border-primary-foreground !w-3 !h-3"
      />
    </div>
  )
})

type SpecialistNodeType = Node<AgentNodeDataRecord, "specialist">

export const SpecialistNode = memo(function SpecialistNode({
  data,
  selected,
}: NodeProps<SpecialistNodeType>) {
  return (
    <div
      className={cn(
        "px-4 py-3 rounded-lg border-2 min-w-44 transition-all",
        nodeColors.specialist.bg,
        selected ? "border-accent shadow-lg shadow-accent/20" : nodeColors.specialist.border
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-accent !border-accent-foreground !w-3 !h-3"
      />
      <div className="flex items-center gap-2">
        <AgentWhitebeardIcon className={cn("w-5 h-5", nodeColors.specialist.icon)} />
        <div>
          <p className="font-medium text-sm text-foreground">{data.label}</p>
          {data.category && (
            <p className="text-xs text-muted-foreground">{data.category}</p>
          )}
          <NodeIndicators indicators={data.indicators} />
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-accent !border-accent-foreground !w-3 !h-3"
      />
    </div>
  )
})

type ChannelNodeDataRecord = ChannelNodeData & Record<string, unknown>
type ChannelNodeType = Node<ChannelNodeDataRecord, "channel">

export const ChannelNode = memo(function ChannelNode({
  data,
  selected,
}: NodeProps<ChannelNodeType>) {
  const channelLabels: Record<string, string> = {
    whatsapp: "WhatsApp",
    slack: "Slack",
    email: "Email",
    api: "API",
  }

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-lg border-2 min-w-44 transition-all",
        nodeColors.channel.bg,
        selected ? "border-success shadow-lg shadow-success/20" : nodeColors.channel.border
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-success !border-success-foreground !w-3 !h-3"
      />
      <div className="flex items-center gap-2">
        <Radio className={cn("w-5 h-5", nodeColors.channel.icon)} />
        <div>
          <p className="font-medium text-sm text-foreground">{data.label}</p>
          <p className="text-xs text-muted-foreground">
            {channelLabels[data.channelType] || data.channelType}
          </p>
          {data.status && (
            <div className={cn(
              "text-xs mt-1",
              data.status === "connected" ? "text-success" : "text-muted-foreground"
            )}>
              {data.status === "connected" ? "Conectado" : "Desconectado"}
            </div>
          )}
        </div>
      </div>
      <Handle
        id="io-out"
        type="source"
        position={Position.Bottom}
        className="!bg-success !border-success-foreground !w-3 !h-3"
      />
    </div>
  )
})

type KnowledgeNodeDataRecord = KnowledgeNodeData & Record<string, unknown>
type KnowledgeNodeType = Node<KnowledgeNodeDataRecord, "knowledge">

export const KnowledgeNode = memo(function KnowledgeNode({
  data,
  selected,
}: NodeProps<KnowledgeNodeType>) {
  return (
    <div
      className={cn(
        "px-4 py-3 rounded-lg border-2 min-w-44 transition-all",
        nodeColors.knowledge.bg,
        selected ? "border-muted-foreground shadow-lg" : nodeColors.knowledge.border
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-muted-foreground !border-background !w-3 !h-3"
      />
      <div className="flex items-center gap-2">
        <Database className={cn("w-5 h-5", nodeColors.knowledge.icon)} />
        <div>
          <p className="font-medium text-sm text-foreground">{data.label}</p>
          <p className="text-xs text-muted-foreground">Base de Conhecimento</p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-muted-foreground !border-background !w-3 !h-3"
      />
    </div>
  )
})

export const nodeTypes = {
  coordinator: CoordinatorNode,
  specialist: SpecialistNode,
  channel: ChannelNode,
  knowledge: KnowledgeNode,
}
