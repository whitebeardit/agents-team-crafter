import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { TeamConversationTimelineItem } from "@/lib/types"
import { compareTimelineItemsChronologically } from "@/lib/live/timeline-sort"

export interface TimelineViewModelItem {
  id: string
  runId: string
  seq: number
  timestamp: string
  actor: TeamConversationTimelineItem["actor"]
  actorId?: string
  kind: TeamConversationTimelineItem["kind"]
  timestampLabel: string
  actorLabel: string
  kindLabel: string
  badgeVariant: "default" | "secondary" | "outline" | "destructive"
  excerpt: string
}

function trimExcerpt(text: string, max = 220): string {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max - 1)}...`
}

function actorToLabel(actor: TeamConversationTimelineItem["actor"], agentName?: string): string {
  if (agentName?.trim()) return agentName
  if (actor === "user") return "Usuário"
  if (actor === "coordinator") return "Coordenador"
  if (actor === "specialist") return "Especialista"
  if (actor === "tool") return "Ferramenta"
  return "Sistema"
}

function kindToUi(kind: TeamConversationTimelineItem["kind"]): {
  label: string
  badge: TimelineViewModelItem["badgeVariant"]
} {
  if (kind === "input") return { label: "Input", badge: "outline" }
  if (kind === "thinking") return { label: "Thinking", badge: "secondary" }
  if (kind === "output") return { label: "Output", badge: "default" }
  if (kind === "error") return { label: "Erro", badge: "destructive" }
  if (kind === "tool_call") return { label: "Tool call", badge: "secondary" }
  if (kind === "tool_result") return { label: "Tool result", badge: "secondary" }
  if (kind === "handoff") return { label: "Handoff", badge: "outline" }
  if (kind === "status") return { label: "Status", badge: "outline" }
  return { label: "Atividade", badge: "secondary" }
}

export function buildTimelineViewModel(
  items: TeamConversationTimelineItem[],
  agentDisplayNames: Record<string, string> = {},
): TimelineViewModelItem[] {
  return [...items]
    .sort(compareTimelineItemsChronologically)
    .map((item) => {
      const kind = kindToUi(item.kind)
      const rawAgentName = item.actorId ? agentDisplayNames[item.actorId] : undefined
      let timestampLabel = item.timestamp
      try {
        timestampLabel = format(parseISO(item.timestamp), "dd/MM HH:mm:ss", { locale: ptBR })
      } catch {
        /* keep raw timestamp */
      }
      return {
        id: item.id,
        runId: item.runId,
        seq: item.seq,
        timestamp: item.timestamp,
        actor: item.actor,
        actorId: item.actorId,
        kind: item.kind,
        timestampLabel,
        actorLabel: actorToLabel(item.actor, rawAgentName),
        kindLabel: kind.label,
        badgeVariant: kind.badge,
        excerpt: trimExcerpt(item.content),
      }
    })
}
