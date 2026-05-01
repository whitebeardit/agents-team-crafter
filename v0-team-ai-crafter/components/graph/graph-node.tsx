"use client"

import { memo } from "react"
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { Crown, Radio, Database, Plug, Brain } from "lucide-react"
import { AgentWhitebeardIcon } from "@/components/brand/agent-whitebeard-icon"
import { cn } from "@/lib/utils"
import { formatCategoryLabel } from "@/lib/utils/agent-category"
import type { GraphNodeIndicators, AgentRole } from "@/lib/types"
import { useGraphLiveAgent } from "@/components/graph/graph-live-context"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export interface AgentNodeData {
  label: string
  role: AgentRole
  category?: string
  description?: string
  /** Missão / objetivo do agente (plano ou `goal` da API). */
  objective?: string
  skills?: string[]
  responsibilities?: string[]
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

function readAgentRichData(data: AgentNodeDataRecord) {
  const d = data as AgentNodeDataRecord & {
    skills?: string[]
    objective?: string
    responsibilities?: string[]
  }
  return {
    label: d.label,
    category: d.category,
    description: d.description ?? "",
    objective: d.objective ?? "",
    skills: Array.isArray(d.skills) ? d.skills : [],
    responsibilities: Array.isArray(d.responsibilities) ? d.responsibilities : [],
  }
}

function AgentTooltipDetail(props: ReturnType<typeof readAgentRichData>) {
  const hasAny =
    props.category?.trim() ||
    props.description.trim() ||
    props.objective.trim() ||
    props.skills.length > 0 ||
    props.responsibilities.length > 0
  if (!hasAny) {
    return <span className="text-muted-foreground">Sem detalhes adicionais</span>
  }
  return (
    <div className="space-y-2 text-left max-w-md">
      {props.category?.trim() ? (
        <div>
          <p className="font-semibold text-popover-foreground">Categoria</p>
          <p className="text-muted-foreground">{formatCategoryLabel(props.category)}</p>
        </div>
      ) : null}
      {props.description.trim() ? (
        <div>
          <p className="font-semibold text-popover-foreground">Descrição</p>
          <p className="text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">{props.description}</p>
        </div>
      ) : null}
      {props.objective.trim() ? (
        <div>
          <p className="font-semibold text-popover-foreground">Missão</p>
          <p className="text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">{props.objective}</p>
        </div>
      ) : null}
      {props.skills.length > 0 ? (
        <div>
          <p className="font-semibold text-popover-foreground">Skills</p>
          <p className="text-muted-foreground">{props.skills.join(" · ")}</p>
        </div>
      ) : null}
      {props.responsibilities.length > 0 ? (
        <div>
          <p className="font-semibold text-popover-foreground">Responsabilidades</p>
          <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
            {props.responsibilities.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

type CoordinatorNodeType = Node<AgentNodeDataRecord, "coordinator">

export const CoordinatorNode = memo(function CoordinatorNode({
  id,
  data,
  selected,
}: NodeProps<CoordinatorNodeType>) {
  const agentId = String((data as { agentId?: string }).agentId ?? id)
  const live = useGraphLiveAgent(agentId)
  const busy = live?.status === "busy"
  const rich = readAgentRichData(data)
  const hasTooltip =
    Boolean(rich.category?.trim()) ||
    rich.description.trim().length > 0 ||
    rich.objective.trim().length > 0 ||
    rich.skills.length > 0 ||
    rich.responsibilities.length > 0

  const cardInner = (
    <div className="min-w-0 max-w-[14rem]">
      <p className="font-medium text-sm text-foreground">{rich.label}</p>
      <p className="text-xs text-muted-foreground">Coordenador</p>
      {rich.category?.trim() ? (
        <p className="text-xs text-muted-foreground truncate">{formatCategoryLabel(rich.category)}</p>
      ) : null}
      {rich.description.trim() ? (
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{rich.description}</p>
      ) : null}
      {rich.skills.length > 0 ? (
        <p className="text-xs text-muted-foreground truncate mt-0.5">{rich.skills.slice(0, 5).join(" · ")}</p>
      ) : null}
      <NodeIndicators indicators={data.indicators} />
    </div>
  )

  return (
    <div className="relative">
      {live?.lastActivity ? (
        <div className="absolute left-1/2 bottom-full mb-1 z-[60] w-max max-w-[min(240px,70vw)] -translate-x-1/2 pointer-events-none">
          <div className="rounded-md border border-border bg-popover px-2 py-1 text-center text-[10px] leading-snug text-popover-foreground shadow-md">
            <span className="font-medium text-primary">{live.phase}</span>
            <span className="block text-muted-foreground line-clamp-3">{live.lastActivity}</span>
            {live.latestInput ? <span className="block text-left text-muted-foreground">in: {live.latestInput}</span> : null}
            {live.latestThinking ? (
              <span className="block text-left text-muted-foreground">thinking: {live.latestThinking}</span>
            ) : null}
            {live.latestOutput ? (
              <span className="block text-left text-muted-foreground">out: {live.latestOutput}</span>
            ) : null}
          </div>
        </div>
      ) : null}
      <div
        className={cn(
          "px-4 py-3 rounded-lg border-2 min-w-44 max-w-[15rem] transition-all",
          nodeColors.coordinator.bg,
          selected ? "border-primary shadow-lg shadow-primary/20" : nodeColors.coordinator.border,
          busy && "ring-2 ring-warning/80 ring-offset-2 ring-offset-background shadow-lg shadow-warning/20",
        )}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-primary !border-primary-foreground !w-3 !h-3"
        />
        <div className="flex items-start gap-2">
          <Crown className={cn("w-5 h-5 shrink-0 mt-0.5", nodeColors.coordinator.icon)} />
          {hasTooltip ? (
            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <div className="cursor-default min-w-0">{cardInner}</div>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                sideOffset={8}
                className="max-w-md border border-border bg-popover px-3 py-2.5 text-popover-foreground shadow-md z-[100] [&_svg]:hidden"
              >
                <AgentTooltipDetail {...rich} />
              </TooltipContent>
            </Tooltip>
          ) : (
            cardInner
          )}
        </div>
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-primary !border-primary-foreground !w-3 !h-3"
        />
      </div>
    </div>
  )
})

type SpecialistNodeType = Node<AgentNodeDataRecord, "specialist">

export const SpecialistNode = memo(function SpecialistNode({
  id,
  data,
  selected,
}: NodeProps<SpecialistNodeType>) {
  const agentId = String((data as { agentId?: string }).agentId ?? id)
  const live = useGraphLiveAgent(agentId)
  const busy = live?.status === "busy"
  const rich = readAgentRichData(data)
  const hasTooltip =
    Boolean(rich.category?.trim()) ||
    rich.description.trim().length > 0 ||
    rich.objective.trim().length > 0 ||
    rich.skills.length > 0 ||
    rich.responsibilities.length > 0

  const cardInner = (
    <div className="min-w-0 max-w-[14rem]">
      <p className="font-medium text-sm text-foreground">{rich.label}</p>
      <p className="text-xs text-muted-foreground">Especialista</p>
      {rich.category?.trim() ? (
        <p className="text-xs text-muted-foreground truncate">{formatCategoryLabel(rich.category)}</p>
      ) : null}
      {rich.description.trim() ? (
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{rich.description}</p>
      ) : null}
      {rich.skills.length > 0 ? (
        <p className="text-xs text-muted-foreground truncate mt-0.5">{rich.skills.slice(0, 5).join(" · ")}</p>
      ) : null}
      <NodeIndicators indicators={data.indicators} />
    </div>
  )

  return (
    <div className="relative">
      {live?.lastActivity ? (
        <div className="absolute left-1/2 bottom-full mb-1 z-[60] w-max max-w-[min(240px,70vw)] -translate-x-1/2 pointer-events-none">
          <div className="rounded-md border border-border bg-popover px-2 py-1 text-center text-[10px] leading-snug text-popover-foreground shadow-md">
            <span className="font-medium text-accent">{live.phase}</span>
            <span className="block text-muted-foreground line-clamp-3">{live.lastActivity}</span>
            {live.latestInput ? <span className="block text-left text-muted-foreground">in: {live.latestInput}</span> : null}
            {live.latestThinking ? (
              <span className="block text-left text-muted-foreground">thinking: {live.latestThinking}</span>
            ) : null}
            {live.latestOutput ? (
              <span className="block text-left text-muted-foreground">out: {live.latestOutput}</span>
            ) : null}
          </div>
        </div>
      ) : null}
      <div
        className={cn(
          "px-4 py-3 rounded-lg border-2 min-w-44 max-w-[15rem] transition-all",
          nodeColors.specialist.bg,
          selected ? "border-accent shadow-lg shadow-accent/20" : nodeColors.specialist.border,
          busy && "ring-2 ring-accent/90 ring-offset-2 ring-offset-background shadow-lg shadow-accent/25",
        )}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-accent !border-accent-foreground !w-3 !h-3"
        />
        <div className="flex items-start gap-2">
          <AgentWhitebeardIcon className={cn("w-5 h-5 shrink-0 mt-0.5", nodeColors.specialist.icon)} />
          {hasTooltip ? (
            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <div className="cursor-default min-w-0">{cardInner}</div>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                sideOffset={8}
                className="max-w-md border border-border bg-popover px-3 py-2.5 text-popover-foreground shadow-md z-[100] [&_svg]:hidden"
              >
                <AgentTooltipDetail {...rich} />
              </TooltipContent>
            </Tooltip>
          ) : (
            cardInner
          )}
        </div>
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-accent !border-accent-foreground !w-3 !h-3"
        />
      </div>
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
