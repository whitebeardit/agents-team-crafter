"use client"

import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react"

const CHANNEL_IO_TOOLTIP =
  "Entrada e saída de mensagens: o canal comunica com o time apenas através do coordenador."

/** Aresta visualmente bidirecional (dois marcadores); direção no grafo é canal → coordenador para ancorar no topo do nó coordenador. */
export function ChannelIoEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerStart,
    markerEnd,
    interactionWidth,
  } = props

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <g className="react-flow__edge">
      <title>{CHANNEL_IO_TOOLTIP}</title>
      <BaseEdge
        id={id}
        path={edgePath}
        style={style}
        markerStart={markerStart}
        markerEnd={markerEnd}
        interactionWidth={interactionWidth}
      />
    </g>
  )
}
