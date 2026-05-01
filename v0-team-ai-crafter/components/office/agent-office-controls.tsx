"use client"

import { Button } from "@/components/ui/button"

export type OfficeMode = "simulation" | "replay" | "live"

export function AgentOfficeControls({
  mode,
  onMode,
  playing,
  onTogglePlay,
  speed,
  onSpeed,
  onClear,
}: {
  mode: OfficeMode
  onMode: (m: OfficeMode) => void
  playing: boolean
  onTogglePlay: () => void
  speed: 1 | 2 | 4
  onSpeed: (s: 1 | 2 | 4) => void
  onClear: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 rounded-md border border-border bg-muted/40 p-1">
        <Button
          type="button"
          size="sm"
          variant={mode === "simulation" ? "default" : "ghost"}
          className="h-8 text-xs"
          onClick={() => onMode("simulation")}
        >
          Simulação
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "replay" ? "default" : "ghost"}
          className="h-8 text-xs"
          onClick={() => onMode("replay")}
        >
          Replay
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "live" ? "default" : "ghost"}
          className="h-8 text-xs"
          onClick={() => onMode("live")}
        >
          Live
        </Button>
      </div>
      {mode !== "live" ? (
        <>
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={onTogglePlay}>
            {playing ? "Pausar" : "Reproduzir"}
          </Button>
          <div className="flex gap-1">
            {([1, 2, 4] as const).map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={speed === s ? "secondary" : "outline"}
                className="h-8 min-w-9 px-2 text-xs"
                onClick={() => onSpeed(s)}
              >
                {s}x
              </Button>
            ))}
          </div>
        </>
      ) : null}
      <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={onClear}>
        Limpar foco
      </Button>
    </div>
  )
}
