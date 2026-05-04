"use client"

import { useMemo, useState } from "react"
import { Clock3, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { TeamConversationTimelineItem } from "@/lib/types"
import { buildTimelineViewModel } from "@/lib/live/timeline-view-model"

interface LiveConversationTimelineDrawerProps {
  items: TeamConversationTimelineItem[]
  agentDisplayNames?: Record<string, string>
  loading?: boolean
  emptyLabel?: string
  title?: string
  showFilters?: boolean
  groupByRun?: boolean
  density?: "compact" | "detailed"
  errorLabel?: string | null
}

const PAGE_SIZE = 60

export function LiveConversationTimelineDrawer({
  items,
  agentDisplayNames = {},
  loading = false,
  emptyLabel = "Sem eventos de timeline no momento.",
  title = "Timeline conversacional",
  showFilters = true,
  groupByRun = true,
  density = "compact",
  errorLabel = null,
}: LiveConversationTimelineDrawerProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [kindFilter, setKindFilter] = useState<"all" | TeamConversationTimelineItem["kind"]>("all")
  const [actorFilter, setActorFilter] = useState<string>("all")
  const vm = useMemo(() => buildTimelineViewModel(items, agentDisplayNames), [items, agentDisplayNames])
  const actorOptions = useMemo(() => {
    const values = Array.from(new Set(vm.map((item) => item.actorLabel)))
    return values.sort((a, b) => a.localeCompare(b))
  }, [vm])
  const filtered = useMemo(() => {
    return vm.filter((item) => {
      if (kindFilter !== "all" && item.kind !== kindFilter) return false
      if (actorFilter !== "all" && item.actorLabel !== actorFilter) return false
      return true
    })
  }, [vm, kindFilter, actorFilter])
  const visible = filtered.slice(Math.max(0, filtered.length - visibleCount))
  const hasMore = filtered.length > visible.length

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-md border border-border bg-card/30">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" />
          {title}
        </div>
        <Badge variant="outline" className="text-[10px]">
          {filtered.length}/{vm.length} eventos
        </Badge>
      </div>

      {showFilters ? (
        <div className="grid grid-cols-2 gap-2 border-b border-border px-3 py-2">
          <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as typeof kindFilter)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="input">Input</SelectItem>
              <SelectItem value="thinking">Thinking</SelectItem>
              <SelectItem value="output">Output</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="error">Erro</SelectItem>
              <SelectItem value="activity">Atividade</SelectItem>
              <SelectItem value="handoff">Handoff</SelectItem>
              <SelectItem value="tool_call">Tool call</SelectItem>
              <SelectItem value="tool_result">Tool result</SelectItem>
              <SelectItem value="memory">Memória</SelectItem>
            </SelectContent>
          </Select>
          <Select value={actorFilter} onValueChange={(v) => setActorFilter(v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Ator" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os atores</SelectItem>
              {actorOptions.map((actor) => (
                <SelectItem key={actor} value={actor}>
                  {actor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 px-3 py-2">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Carregando timeline...
            </div>
          ) : null}

          {!loading && visible.length === 0 ? (
            <p className="text-xs text-muted-foreground">{emptyLabel}</p>
          ) : null}
          {errorLabel ? <p className="text-xs text-destructive">{errorLabel}</p> : null}

          {visible.map((item, idx) => {
            const prev = idx > 0 ? visible[idx - 1] : null
            const showRunSeparator = groupByRun && (!prev || prev.runId !== item.runId)
            return (
              <div key={item.id} className="space-y-1">
                {showRunSeparator ? (
                  <div className="pt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Run {item.runId.slice(0, 8)}
                  </div>
                ) : null}
                <div className="rounded-md border border-border bg-background px-2.5 py-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={item.badgeVariant} className="text-[10px]">
                        {item.kindLabel}
                      </Badge>
                      <span className="text-[11px] text-foreground">{item.actorLabel}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{item.timestampLabel}</span>
                  </div>
                  <p className={density === "compact" ? "text-xs leading-relaxed text-foreground" : "text-sm leading-relaxed text-foreground"}>
                    {item.excerpt}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {hasMore ? (
        <div className="border-t border-border px-3 py-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
          >
            Carregar mais
          </Button>
        </div>
      ) : null}
    </div>
  )
}
