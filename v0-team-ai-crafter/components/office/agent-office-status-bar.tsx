"use client"

import { Badge } from "@/components/ui/badge"

export function AgentOfficeStatusBar({
  mode,
  connected,
  reconnecting,
  liveError,
  eventCount,
  lastLiveSummary,
}: {
  mode: "simulation" | "replay" | "live"
  connected?: boolean
  reconnecting?: boolean
  liveError?: string | null
  eventCount: number
  /** Ex.: `agent_thinking · seq 12` quando há timeline em Live */
  lastLiveSummary?: string | null
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          Modo: <span className="font-medium text-foreground">{mode}</span>
        </span>
        <span className="text-border">|</span>
        <span>Eventos: {eventCount}</span>
        {mode === "live" && lastLiveSummary ? (
          <>
            <span className="text-border">|</span>
            <span className="max-w-[min(100%,28rem)] truncate" title={lastLiveSummary}>
              Último: {lastLiveSummary}
            </span>
          </>
        ) : null}
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
      {mode === "live" ? (
        <p className="max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
          Para ver actividade em tempo real, envie uma mensagem pelo <strong className="text-foreground">canal</strong>{" "}
          ligado ao time ou execute um run no separador <strong className="text-foreground">Console</strong> na ficha do
          time. Duas abas (grafo + escritório) em Live recebem os mesmos eventos SSE.
        </p>
      ) : null}
    </div>
  )
}
