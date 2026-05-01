"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { OFFICE_USER_AGENT_ID, type OfficeEvent, type OfficeEventType } from "@/lib/office/office-types"

function kindLabel(t: OfficeEventType): string {
  const m: Partial<Record<OfficeEventType, string>> = {
    user_message: "input",
    agent_thinking: "thinking",
    agent_handoff: "handoff",
    agent_response: "output",
    tool_call: "tool",
    tool_result: "tool_result",
    activity: "activity",
    run_complete: "run",
    error: "error",
  }
  return m[t] ?? t
}

export function AgentOfficeTimelinePanel({
  events,
  selectedIndex,
  onSelectIndex,
  agentFilter,
  onAgentFilter,
  agentOptions,
}: {
  events: OfficeEvent[]
  selectedIndex: number
  onSelectIndex: (index: number) => void
  agentFilter: string | "all"
  onAgentFilter: (id: string | "all") => void
  agentOptions: { id: string; name: string }[]
}) {
  const filtered = events.filter((ev) => {
    if (agentFilter === "all") return true
    if (agentFilter === OFFICE_USER_AGENT_ID) {
      return (
        ev.actorId === OFFICE_USER_AGENT_ID ||
        ev.type === "user_message" ||
        ev.fromAgentId === OFFICE_USER_AGENT_ID
      )
    }
    return ev.actorId === agentFilter || ev.fromAgentId === agentFilter || ev.toAgentId === agentFilter
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground" htmlFor="office-tl-filter">
          Filtrar agente
        </label>
        <select
          id="office-tl-filter"
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={agentFilter}
          onChange={(e) => {
            const v = e.target.value
            onAgentFilter(v === "all" ? "all" : v)
          }}
        >
          <option value="all">Todos</option>
          {agentOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border">
        <ul className="divide-y divide-border text-xs">
          {filtered.map((ev, i) => {
            const globalIndex = events.indexOf(ev)
            const active = globalIndex === selectedIndex
            const time = (() => {
              try {
                return format(new Date(ev.timestamp), "HH:mm:ss", { locale: ptBR })
              } catch {
                return "—"
              }
            })()
            return (
              <li key={ev.id}>
                <button
                  type="button"
                  title={ev.message || "(sem texto)"}
                  className={cn(
                    "flex w-full flex-col gap-0.5 px-2 py-2 text-left transition-colors hover:bg-muted/60",
                    active && "bg-primary/10",
                  )}
                  onClick={() => onSelectIndex(globalIndex)}
                >
                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                    <span className="tabular-nums text-muted-foreground">{time}</span>
                    <span className="font-mono text-[10px] uppercase text-primary">{kindLabel(ev.type)}</span>
                  </span>
                  <span className="line-clamp-2 text-foreground">{ev.message || "(sem texto)"}</span>
                  <details className="mt-0.5 text-[10px] text-muted-foreground">
                    <summary className="cursor-pointer select-none hover:text-foreground">Texto completo</summary>
                    <p className="mt-1 whitespace-pre-wrap break-words text-foreground">{ev.message || "(sem texto)"}</p>
                  </details>
                </button>
              </li>
            )
          })}
        </ul>
        {filtered.length === 0 ? (
          <p className="p-3 text-muted-foreground">Nenhum evento para os filtros actuais.</p>
        ) : null}
      </div>
    </div>
  )
}
