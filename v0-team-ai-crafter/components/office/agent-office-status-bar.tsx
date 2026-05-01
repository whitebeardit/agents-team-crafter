"use client"

import { Badge } from "@/components/ui/badge"

export function AgentOfficeStatusBar({
  mode,
  connected,
  reconnecting,
  liveError,
  eventCount,
}: {
  mode: "simulation" | "replay" | "live"
  connected?: boolean
  reconnecting?: boolean
  liveError?: string | null
  eventCount: number
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>
        Modo: <span className="font-medium text-foreground">{mode}</span>
      </span>
      <span className="text-border">|</span>
      <span>Eventos: {eventCount}</span>
      {mode === "live" ? (
        <>
          <span className="text-border">|</span>
          {liveError ? (
            <Badge variant="destructive" className="text-[10px]">
              {liveError}
            </Badge>
          ) : reconnecting ? (
            <Badge variant="secondary" className="text-[10px]">
              A reconectar…
            </Badge>
          ) : connected ? (
            <Badge variant="outline" className="border-emerald-500/50 text-[10px] text-emerald-600">
              SSE ligado
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              A ligar…
            </Badge>
          )}
        </>
      ) : null}
    </div>
  )
}
