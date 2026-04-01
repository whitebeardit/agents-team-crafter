"use client"

import { HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/** Legenda read-only: mesmos tipos e linha coordenador–canal que no editor de grafo. */
export function GraphLegendInline({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 mb-1 text-sm shrink-0",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-primary" />
        <span className="text-muted-foreground">Coordenador</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-accent" />
        <span className="text-muted-foreground">Especialista</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-success" />
        <span className="text-muted-foreground">Canal</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-muted-foreground" />
        <span className="text-muted-foreground">Base de Conhecimento</span>
      </div>
      <div className="flex items-center gap-2 min-w-[200px]">
        <div className="flex items-center gap-0.5 shrink-0">
          <span className="text-success text-xs leading-none">‹</span>
          <div className="w-6 h-0 border-t-2 border-success border-solid" />
          <span className="text-success text-xs leading-none">›</span>
        </div>
        <span className="text-muted-foreground">
          Coordenador ↔ canal (desenho bidirecional; passe o rato na linha para o texto)
        </span>
      </div>
    </div>
  )
}

/** Versão compacta (ex.: modo Live) — mesma informação num popover. */
export function GraphLegendPopover() {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
            <HelpCircle className="w-3.5 h-3.5" />
            Legenda do grafo
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto max-w-sm" align="start">
          <p className="text-xs font-medium text-foreground mb-2">Tipos de nó e linhas</p>
          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary shrink-0" />
              <span>Coordenador</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-accent shrink-0" />
              <span>Especialista</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-success shrink-0" />
              <span>Canal</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-muted-foreground shrink-0" />
              <span>Base de Conhecimento</span>
            </div>
            <div className="flex items-start gap-2 pt-1 border-t border-border">
              <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                <span className="text-success text-xs leading-none">‹</span>
                <div className="w-6 h-0 border-t-2 border-success border-solid" />
                <span className="text-success text-xs leading-none">›</span>
              </div>
              <span>
                Coordenador ↔ canal (desenho bidirecional; passe o rato na linha para o texto)
              </span>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
