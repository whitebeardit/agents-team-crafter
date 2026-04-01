"use client"

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type MiniMapProps,
} from "@xyflow/react"
import { cn } from "@/lib/utils"

/** Estilos do painel de zoom (+/−/fit/interactive) alinhados ao tema (evita ícones claros sobre fundo claro no dark mode). */
export const graphFlowControlsClassName = cn(
  "!bg-card !border !border-border !shadow-lg rounded-md overflow-hidden",
  "[&_.react-flow__controls-button]:bg-background [&_.react-flow__controls-button]:text-foreground",
  "[&_.react-flow__controls-button]:border-0 [&_.react-flow__controls-button]:border-b [&_.react-flow__controls-button]:border-border",
  "[&_.react-flow__controls-button:last-child]:border-b-0",
  "[&_.react-flow__controls-button_svg]:!fill-current [&_.react-flow__controls-button_svg]:!stroke-current [&_.react-flow__controls-button_svg]:text-foreground",
  "[&_.react-flow__controls-button:hover]:bg-muted",
)

const defaultMiniMapNodeColor: NonNullable<MiniMapProps["nodeColor"]> = (node) => {
  switch (node.type) {
    case "coordinator":
      return "var(--primary)"
    case "specialist":
      return "var(--accent)"
    case "channel":
      return "var(--success)"
    default:
      return "var(--muted-foreground)"
  }
}

export interface GraphFlowOverlaysProps {
  /** Sobrescreve cores dos nós no minimapa (ex.: preview só coordinator/specialist). */
  minimapNodeColor?: MiniMapProps["nodeColor"]
}

export function GraphFlowOverlays({ minimapNodeColor }: GraphFlowOverlaysProps) {
  return (
    <>
      <Controls className={graphFlowControlsClassName} />
      <MiniMap
        className="!bg-card !border !border-border shadow-md [&_.react-flow__minimap-mask]:fill-background/40"
        nodeColor={minimapNodeColor ?? defaultMiniMapNodeColor}
        pannable
        zoomable
      />
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
    </>
  )
}
