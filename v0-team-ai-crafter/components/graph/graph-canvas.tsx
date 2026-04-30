"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  MarkerType,
} from "@xyflow/react"
import { GraphFlowOverlays } from "@/components/graph/graph-flow-overlays"
import "@xyflow/react/dist/style.css"

import { ChannelIoEdge } from "./channel-io-edge"
import { nodeTypes } from "./graph-node"
import { NodeConfigPanel } from "./node-config-panel"
import type { Agent, Channel, Team, TeamGraphLiveAgentState } from "@/lib/types"
import { GraphLiveAgentsContext } from "@/components/graph/graph-live-context"
import {
  resolveAgentNodeId,
  resolveChannelNodeId,
  type GraphNodeLike,
} from "@/lib/graph-derived-edges"
import {
  applyRosterStackLayout,
  canvasEntityKey,
  hasValidPosition,
  mergePersistedWithTeamRoster,
} from "./graph-layout-utils"

interface GraphCanvasProps {
  team: Team
  agents: Agent[]
  channels: Channel[]
  initialGraph: { nodes: unknown[]; edges: unknown[] }
  onGraphChange?: (graph: { nodes: Node[]; edges: Edge[] }) => void
  onTeamEntityRemove?: (ctx: {
    node: Node
    nodes: Node[]
    edges: Edge[]
  }) => Promise<{ ok: boolean; message?: string }>
  /** Estado em tempo real por agentId (modo live no editor de grafo). */
  liveAgentState?: Record<string, TeamGraphLiveAgentState>
}

const toNode = (value: unknown): Node | null => {
  if (!value || typeof value !== "object") return null
  const node = value as Partial<Node>
  if (!node.id || !node.position || !node.data) return null
  return {
    id: String(node.id),
    type: (node.type as string) || "specialist",
    position: node.position as { x: number; y: number },
    data: node.data as Record<string, unknown>,
  }
}

const toEdge = (value: unknown): Edge | null => {
  if (!value || typeof value !== "object") return null
  const edge = value as Partial<Edge>
  if (!edge.id || !edge.source || !edge.target) return null
  return {
    id: String(edge.id),
    source: String(edge.source),
    target: String(edge.target),
    type: edge.type,
    animated: edge.animated,
    label: edge.label,
    style: edge.style,
    markerEnd: edge.markerEnd,
    markerStart: edge.markerStart,
    data: edge.data,
  }
}

function toGraphNodeLike(nodes: Node[]): GraphNodeLike[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type,
    data: n.data as { agentId?: string; channelId?: string },
  }))
}

const GRAPH_CENTER_X = 320
const COORDINATOR_Y = 220
const SPECIALISTS_Y = 520
const CHANNELS_Y = 40
const ROSTER_HORIZONTAL_SPACING = 340

function edgePairKey(source: string, target: string): string {
  return `${source}|${target}`
}

/** Evita aresta duplicada no mesmo par source→target (persistido vs derivado estrutural). */
function mergeEdgesByPair(base: Edge[], extra: Edge[]): Edge[] {
  const keys = new Set(base.map((e) => edgePairKey(e.source, e.target)))
  const out = [...base]
  for (const e of extra) {
    const k = edgePairKey(e.source, e.target)
    if (!keys.has(k)) {
      keys.add(k)
      out.push(e)
    }
  }
  return out
}

const EDGE_STROKE_WIDTH = 2
const CHANNEL_EDGE_STROKE = 3

const graphEdgeTypes = {
  channelIo: ChannelIoEdge,
} satisfies EdgeTypes

function isCoordinatorChannelLink(e: Edge, nodes: Node[]): boolean {
  const a = nodes.find((n) => n.id === e.source)
  const b = nodes.find((n) => n.id === e.target)
  if (!a || !b) return false
  const channelNode = a.type === "channel" ? a : b.type === "channel" ? b : null
  const other = channelNode?.id === e.source ? b : a
  return channelNode !== null && other.type === "coordinator"
}

/** Garante estilo no cliente (GET); tokens oklch usam var(--token) no SVG, nunca hsl(var(...)). */
function decorateDerivedEdgeStyles(edges: Edge[], nodes: Node[]): Edge[] {
  const successStroke = "var(--success)"
  return edges.map((e) => {
    const kind = (e.data as { edgeKind?: string; channelIo?: boolean } | undefined)?.edgeKind
    if (kind === "structural") {
      const specialistSpine = e.animated === true
      if (specialistSpine) {
        return {
          ...e,
          type: e.type ?? "default",
          animated: true,
          style: {
            strokeWidth: EDGE_STROKE_WIDTH,
            ...e.style,
            stroke: "var(--primary)",
          },
          markerEnd: e.markerEnd ?? {
            type: MarkerType.ArrowClosed,
            color: "var(--primary)",
          },
        }
      }
      return {
        ...e,
        type: "channelIo",
        animated: false,
        style: {
          strokeWidth: CHANNEL_EDGE_STROKE,
          ...e.style,
          stroke: successStroke,
        },
        markerStart: {
          type: MarkerType.ArrowClosed,
          color: successStroke,
        },
        markerEnd: e.markerEnd ?? {
          type: MarkerType.ArrowClosed,
          color: successStroke,
        },
      }
    }
    if (isCoordinatorChannelLink(e, nodes)) {
      return {
        ...e,
        type: "channelIo",
        style: {
          strokeWidth: CHANNEL_EDGE_STROKE,
          ...e.style,
          stroke: successStroke,
        },
        markerStart: {
          type: MarkerType.ArrowClosed,
          color: successStroke,
        },
        markerEnd: e.markerEnd ?? {
          type: MarkerType.ArrowClosed,
          color: successStroke,
        },
      }
    }
    const baseStroke = (e.style as { stroke?: string } | undefined)?.stroke
    return {
      ...e,
      type: e.type ?? "default",
      style: {
        strokeWidth: EDGE_STROKE_WIDTH,
        ...e.style,
        stroke: baseStroke && baseStroke !== "" ? baseStroke : "var(--foreground)",
      },
      markerEnd: e.markerEnd
        ?? ({ type: MarkerType.ArrowClosed, color: "var(--foreground)" } as Edge["markerEnd"]),
    }
  })
}

function buildStructuralTemplateEdges(
  nodes: Node[],
  coordinator: Agent | undefined,
  specialists: Agent[],
  teamChannels: Channel[]
): Edge[] {
  const like = toGraphNodeLike(nodes)
  const edges: Edge[] = []
  if (!coordinator) return edges

  const coordNode = resolveAgentNodeId(like, coordinator.id)
  if (!coordNode) return edges

  for (const agent of specialists) {
    const specNode = resolveAgentNodeId(like, agent.id)
    if (!specNode || specNode === coordNode) continue
    edges.push({
      id: `derived-structural-${coordNode}-${specNode}`,
      source: coordNode,
      target: specNode,
      animated: true,
      style: { stroke: "var(--primary)", strokeWidth: EDGE_STROKE_WIDTH },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "var(--primary)",
      },
      data: { edgeKind: "structural" as const },
    })
  }

  if (teamChannels.length > 0) {
    for (const channel of teamChannels) {
      const chNode = resolveChannelNodeId(like, channel.id)
      if (!chNode) continue
      edges.push({
        id: `derived-structural-${chNode}-${coordNode}`,
        source: chNode,
        target: coordNode,
        style: { stroke: "var(--success)", strokeWidth: CHANNEL_EDGE_STROKE },
        data: { edgeKind: "structural" as const, channelIo: true as const },
      })
    }
  }

  return edges
}

export function GraphCanvas({
  team,
  agents,
  channels,
  initialGraph,
  onGraphChange,
  onTeamEntityRemove,
  liveAgentState = {},
}: GraphCanvasProps) {
  const coordinator = agents.find((a) => a.id === team.coordinatorId)
  const specialists = agents.filter((a) => team.agentIds.includes(a.id))
  /**
   * Nós de canal no canvas = interseção de GET /channels com Team.channelIds (entidades do workspace
   * associadas ao time). Não usar Agent.channels (tipos habilitados na ficha do agente) aqui.
   * Para depurar “falta canal”: comparar team.channelIds.length com esta lista e com a API.
   */
  const teamChannels = channels.filter((c) => team.channelIds.includes(c.id))

  const initialNodes: Node[] = useMemo(() => {
    const nodes: Node[] = []

    if (coordinator) {
      nodes.push({
        id: coordinator.id,
        type: "coordinator",
        position: { x: GRAPH_CENTER_X, y: COORDINATOR_Y },
        data: {
          label: coordinator.name,
          role: "coordinator",
          category: coordinator.category,
          description: coordinator.description,
          objective: coordinator.goal ?? "",
          skills: coordinator.skills ?? [],
          responsibilities: coordinator.responsibilities ?? [],
          agentId: coordinator.id,
        },
      })
    }

    specialists.forEach((agent, index) => {
      const xOffset = (index - (specialists.length - 1) / 2) * ROSTER_HORIZONTAL_SPACING
      nodes.push({
        id: agent.id,
        type: "specialist",
        position: { x: GRAPH_CENTER_X + xOffset, y: SPECIALISTS_Y },
        data: {
          label: agent.name,
          role: "specialist",
          category: agent.category,
          description: agent.description,
          objective: agent.goal ?? "",
          skills: agent.skills ?? [],
          responsibilities: agent.responsibilities ?? [],
          agentId: agent.id,
        },
      })
    })

    teamChannels.forEach((channel, index) => {
      const xOffset = (index - (teamChannels.length - 1) / 2) * ROSTER_HORIZONTAL_SPACING
      nodes.push({
        id: channel.id,
        type: "channel",
        position: { x: GRAPH_CENTER_X + xOffset, y: CHANNELS_Y },
        data: {
          label: channel.name,
          channelType: channel.type,
          status: channel.status,
          channelId: channel.id,
        },
      })
    })

    return nodes
  }, [coordinator, specialists, teamChannels])

  const initialEdges: Edge[] = useMemo(
    () => buildStructuralTemplateEdges(initialNodes, coordinator, specialists, teamChannels),
    [initialNodes, coordinator, specialists, teamChannels]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [removeInProgress, setRemoveInProgress] = useState(false)
  const hydratedGraphKey = useRef<string | null>(null)

  const persistedNodes = useMemo(
    () => (initialGraph.nodes ?? []).map(toNode).filter((n): n is Node => n !== null),
    [initialGraph.nodes]
  )
  const persistedEdges = useMemo(
    () => (initialGraph.edges ?? []).map(toEdge).filter((e): e is Edge => e !== null),
    [initialGraph.edges]
  )

  const teamRosterKey = useMemo(
    () =>
      `${team.coordinatorId}|${[...team.agentIds].sort().join(",")}|${[...team.channelIds].sort().join(",")}`,
    [team.coordinatorId, team.agentIds, team.channelIds]
  )

  const persistedLayoutKey = useMemo(() => {
    const nodeSignature = persistedNodes
      .map((n) => {
        const position = hasValidPosition(n.position) ? `${n.position.x},${n.position.y}` : "na"
        return `${n.id}:${position}`
      })
      .sort()
      .join("|")
    const edgeSignature = persistedEdges
      .map((e) => `${e.id}:${e.source}->${e.target}`)
      .sort()
      .join("|")
    return `${nodeSignature}::${edgeSignature}`
  }, [persistedNodes, persistedEdges])

  useEffect(() => {
    const nextKey = `${team.id}:${teamRosterKey}:${persistedLayoutKey}`
    if (hydratedGraphKey.current === nextKey) return
    hydratedGraphKey.current = nextKey

    const merged =
      persistedNodes.length > 0
        ? mergePersistedWithTeamRoster(persistedNodes, initialNodes)
        : initialNodes
    const activeNodes = applyRosterStackLayout(merged, initialNodes)

    const structural = buildStructuralTemplateEdges(
      activeNodes,
      coordinator,
      specialists,
      teamChannels
    )
    const userEdges = persistedEdges
    const base =
      userEdges.length > 0
        ? mergeEdgesByPair(userEdges, structural)
        : structural

    setNodes(activeNodes)
    setEdges(decorateDerivedEdgeStyles(base, activeNodes))
  }, [
    team.id,
    teamRosterKey,
    persistedNodes,
    persistedEdges,
    persistedLayoutKey,
    initialNodes,
    coordinator,
    specialists,
    teamChannels,
    setEdges,
    setNodes,
  ])

  useEffect(() => {
    onGraphChange?.({ nodes, edges })
  }, [nodes, edges, onGraphChange])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const handleDeleteNode = useCallback(
    async (id: string) => {
      const target = nodes.find((n) => n.id === id)
      if (!target) return

      const isTeamEntity =
        target.type === "coordinator" ||
        target.type === "specialist" ||
        target.type === "channel"

      if (isTeamEntity && onTeamEntityRemove) {
        setRemoveInProgress(true)
        try {
          const result = await onTeamEntityRemove({ node: target, nodes, edges })
          if (!result.ok) {
            return
          }
          setSelectedNode(null)
        } finally {
          setRemoveInProgress(false)
        }
        return
      }

      setNodes((nds) => nds.filter((node) => node.id !== id))
      setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id))
      setSelectedNode(null)
    },
    [nodes, edges, onTeamEntityRemove, setNodes, setEdges]
  )

  return (
    <div className="relative w-full h-full">
      <GraphLiveAgentsContext.Provider value={liveAgentState}>
        <ReactFlow
          colorMode="dark"
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes as NodeTypes}
          edgeTypes={graphEdgeTypes}
          nodesConnectable={false}
          defaultEdgeOptions={{
            style: { stroke: "var(--foreground)", strokeWidth: EDGE_STROKE_WIDTH },
          }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          className="bg-background"
        >
          <GraphFlowOverlays
            minimapNodeColor={(node) => {
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
            }}
          />
        </ReactFlow>
      </GraphLiveAgentsContext.Provider>

      {selectedNode && (
        <NodeConfigPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onDelete={handleDeleteNode}
          deleteBusy={removeInProgress}
        />
      )}
    </div>
  )
}
