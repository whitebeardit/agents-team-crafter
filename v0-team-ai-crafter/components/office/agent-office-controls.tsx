"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export type OfficeMode = "simulation" | "replay" | "live"

export function AgentOfficeControls({
  mode,
  onMode,
  playing,
  onTogglePlay,
  speed,
  onSpeed,
  onClear,
  livePaceEnabled,
  onLivePaceEnabled,
  liveDwellMs,
  onLiveDwellMs,
  hideStreamChunks,
  onHideStreamChunks,
}: {
  mode: OfficeMode
  onMode: (m: OfficeMode) => void
  playing: boolean
  onTogglePlay: () => void
  speed: 1 | 2 | 4
  onSpeed: (s: 1 | 2 | 4) => void
  onClear: () => void
  /** Live: avançar um evento de cada vez no mapa/balão */
  livePaceEnabled?: boolean
  onLivePaceEnabled?: (v: boolean) => void
  liveDwellMs?: number
  onLiveDwellMs?: (ms: number) => void
  /** Live/replay visual: esconder deltas SSE de output (canal fica legível) */
  hideStreamChunks?: boolean
  onHideStreamChunks?: (v: boolean) => void
}) {
  const showLivePace =
    mode === "live" &&
    onLivePaceEnabled != null &&
    livePaceEnabled !== undefined &&
    onLiveDwellMs != null &&
    liveDwellMs !== undefined

  const showStreamFilter =
    (mode === "live" || mode === "replay") &&
    onHideStreamChunks != null &&
    hideStreamChunks !== undefined

  const showOfficeTimelineOpts = showLivePace || showStreamFilter

  return (
    <div className="flex flex-col gap-2">
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
      {showOfficeTimelineOpts ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
          {showStreamFilter ? (
            <div className="flex items-center gap-2">
              <Switch
                id="office-hide-stream"
                checked={hideStreamChunks}
                onCheckedChange={onHideStreamChunks}
                title="Esconde deltas de streaming no output e eventos de ciclo (CoordinatorStarted/Finished, …); mostra tudo se desligar"
              />
              <Label htmlFor="office-hide-stream" className="cursor-pointer text-muted-foreground">
                Vista compacta (sem deltas nem Started/Finished)
              </Label>
            </div>
          ) : null}
          {showLivePace ? (
            <>
              <div className="flex items-center gap-2">
                <Switch
                  id="office-live-pace"
                  checked={livePaceEnabled}
                  onCheckedChange={onLivePaceEnabled}
                  title="Mostra cada evento no mapa durante alguns ms antes do seguinte"
                />
                <Label htmlFor="office-live-pace" className="cursor-pointer text-muted-foreground">
                  Passo a passo no Live
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="office-live-dwell" className="text-muted-foreground">
                  Pausa (ms)
                </Label>
                <Input
                  id="office-live-dwell"
                  type="number"
                  min={200}
                  max={8000}
                  step={100}
                  className="h-8 w-[5.5rem] font-mono text-xs"
                  value={liveDwellMs}
                  disabled={!livePaceEnabled}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10)
                    if (Number.isNaN(n)) return
                    onLiveDwellMs(Math.min(8000, Math.max(200, n)))
                  }}
                />
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
