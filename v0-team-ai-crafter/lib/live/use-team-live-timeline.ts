"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { pickLongestTrimmed } from "@/lib/utils"
import type {
  TeamConversationTimelineItem,
  TeamCoordinatorDeltaPayload,
  TeamDebugLiveMirrorLine,
  TeamGraphLiveAgentConversationState,
  TeamLiveInboundUserMessage,
  TeamRunProgressEvent,
  TeamRunResponse,
} from "@/lib/types"
import { createApiClient } from "@/lib/api/client"
import { OFFICE_USER_AGENT_ID } from "@/lib/office/office-types"

/** Eventos sem actorId agrupados quando não há coordinatorId no hook. */
const TIMELINE_NO_ACTOR_BUCKET = "__office_timeline_no_actor__"

function resolveTimelineBucket(
  item: TeamConversationTimelineItem,
  coordinatorId?: string,
): string {
  const raw = item.actorId?.trim()
  if (raw) return raw
  if (item.kind === "input") return OFFICE_USER_AGENT_ID
  const c = coordinatorId?.trim()
  if (c) return c
  return TIMELINE_NO_ACTOR_BUCKET
}

function inboundChannelLabel(channel: string): string {
  const m: Record<string, string> = {
    telegram: "Telegram",
    slack: "Slack",
    discord: "Discord",
    teams: "Teams",
    gchat: "Google Chat",
    github: "GitHub",
    linear: "Linear",
    whatsapp: "WhatsApp",
  }
  return m[channel] ?? channel
}

function trimLiveText(text: string, max = 220): string {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max - 1)}...`
}

function computeLiveStateFromTimeline(
  byAgent: Record<string, TeamConversationTimelineItem[]>,
  base: Record<string, TeamGraphLiveAgentConversationState>,
): Record<string, TeamGraphLiveAgentConversationState> {
  const out: Record<string, TeamGraphLiveAgentConversationState> = {}
  for (const [agentId, items] of Object.entries(byAgent)) {
    const existing = base[agentId]
    const latestInput = [...items].reverse().find((it) => it.kind === "input")?.content
    const latestThinking = [...items].reverse().find((it) => it.kind === "thinking")?.content
    const latestOutput = [...items].reverse().find((it) => it.kind === "output")?.content
    const last = items[items.length - 1]
    out[agentId] = {
      status: existing?.status ?? "idle",
      phase: existing?.phase ?? "timeline",
      lastActivity: last?.content ? trimLiveText(last.content, 140) : existing?.lastActivity ?? "Sem atividade",
      recentItems: items.slice(-12),
      latestInput: latestInput ? trimLiveText(latestInput, 120) : undefined,
      latestThinking: latestThinking ? trimLiveText(latestThinking, 120) : undefined,
      latestOutput: latestOutput ? trimLiveText(latestOutput, 120) : undefined,
    }
  }
  for (const [agentId, existing] of Object.entries(base)) {
    if (!out[agentId]) out[agentId] = existing
  }
  return out
}

function mergeTimelineByAgent(
  prev: Record<string, TeamConversationTimelineItem[]>,
  agentId: string,
  item: TeamConversationTimelineItem,
  maxItemsPerAgent = 80,
): Record<string, TeamConversationTimelineItem[]> {
  const current = prev[agentId] ?? []
  if (current.some((i) => i.id === item.id)) return prev
  const next = [...current, item].sort((a, b) => a.seq - b.seq).slice(-maxItemsPerAgent)
  return { ...prev, [agentId]: next }
}

export function useTeamLiveTimeline(input: {
  teamId: string
  api: ReturnType<typeof createApiClient> | null
  enabled: boolean
  replayLimit?: number
  /** Usado para eventos de timeline sem `actorId` (bucket de fallback). */
  coordinatorId?: string
}) {
  const { teamId, api, enabled, replayLimit = 120, coordinatorId } = input

  const [timelineByAgent, setTimelineByAgent] = useState<Record<string, TeamConversationTimelineItem[]>>({})
  const [liveAgentState, setLiveAgentState] = useState<Record<string, TeamGraphLiveAgentConversationState>>({})
  const [liveMirrorLines, setLiveMirrorLines] = useState<TeamDebugLiveMirrorLine[]>([])
  const [liveMirrorStreamText, setLiveMirrorStreamText] = useState("")
  const [connected, setConnected] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seenTimelineIdsRef = useRef<Set<string>>(new Set())
  const generationRef = useRef(0)
  const inboundStreamAccRef = useRef("")

  const items = useMemo(() => {
    const uniq = new Map<string, TeamConversationTimelineItem>()
    for (const list of Object.values(timelineByAgent)) {
      for (const item of list) {
        if (!uniq.has(item.id)) uniq.set(item.id, item)
      }
    }
    return [...uniq.values()].sort((a, b) => (a.seq === b.seq ? a.timestamp.localeCompare(b.timestamp) : a.seq - b.seq))
  }, [timelineByAgent])

  const clear = useCallback(() => {
    seenTimelineIdsRef.current = new Set()
    inboundStreamAccRef.current = ""
    setTimelineByAgent({})
    setLiveMirrorLines([])
    setLiveMirrorStreamText("")
    setError(null)
  }, [])

  useEffect(() => {
    if (!enabled || !api) return

    const ac = new AbortController()
    generationRef.current += 1
    const gen = generationRef.current

    void (async () => {
      let reconnectDelayMs = 700
      seenTimelineIdsRef.current = new Set()
      inboundStreamAccRef.current = ""

      try {
        const replay = await api.get<{ items: TeamConversationTimelineItem[] }>(
          `/teams/${teamId}/timeline?limit=${replayLimit}`,
        )
        const grouped: Record<string, TeamConversationTimelineItem[]> = {}
        for (const item of replay.data.items ?? []) {
          const bucket = resolveTimelineBucket(item, coordinatorId)
          if (!seenTimelineIdsRef.current.has(item.id)) {
            seenTimelineIdsRef.current.add(item.id)
            grouped[bucket] = [...(grouped[bucket] ?? []), item].slice(-80)
          }
        }
        setTimelineByAgent(grouped)
        setLiveAgentState((base) => computeLiveStateFromTimeline(grouped, base))
      } catch {
        /* replay opcional */
      }

      while (!ac.signal.aborted && gen === generationRef.current) {
        try {
          setReconnecting(false)
          setConnected(true)
          await api.streamTeamLive(
            teamId,
            {
              onInboundUserMessage: (d: TeamLiveInboundUserMessage) => {
                setLiveMirrorStreamText("")
                setLiveMirrorLines((prev) => [
                  ...prev,
                  {
                    role: "user",
                    content: d.text,
                    sourceLabel: inboundChannelLabel(d.channel),
                  },
                ])
              },
              onCoordinatorDelta: (payload: TeamCoordinatorDeltaPayload) => {
                if (payload.source !== "inbound") return
                inboundStreamAccRef.current += payload.text
                setLiveMirrorStreamText((prev) => prev + payload.text)
              },
              onAgentStatus: (e: TeamRunProgressEvent) => {
                setLiveAgentState((prev) => ({
                  ...prev,
                  [e.agentId]: {
                    status: e.status,
                    phase: e.phase,
                    lastActivity: e.detail ?? e.phase,
                    recentItems: prev[e.agentId]?.recentItems ?? [],
                    latestInput: prev[e.agentId]?.latestInput,
                    latestThinking: prev[e.agentId]?.latestThinking,
                    latestOutput: prev[e.agentId]?.latestOutput,
                  },
                }))
              },
              onTimelineItem: (item: TeamConversationTimelineItem) => {
                if (seenTimelineIdsRef.current.has(item.id)) return
                seenTimelineIdsRef.current.add(item.id)
                const bucket = resolveTimelineBucket(item, coordinatorId)
                setTimelineByAgent((prev) => {
                  const merged = mergeTimelineByAgent(prev, bucket, item)
                  setLiveAgentState((base) => computeLiveStateFromTimeline(merged, base))
                  return merged
                })
              },
              onRunComplete: (data: TeamRunResponse) => {
                if (data.source === "inbound") {
                  const er = data.externalResponse
                  const streamed = inboundStreamAccRef.current.trim()
                  inboundStreamAccRef.current = ""
                  const text = pickLongestTrimmed(er?.text, streamed) || "(sem texto)"
                  setLiveMirrorStreamText("")
                  setLiveMirrorLines((prev) => [
                    ...prev,
                    {
                      role: "assistant",
                      content: text,
                      sourceLabel: "Resposta (inbound)",
                      format: er?.format,
                    },
                  ])
                }
                window.setTimeout(() => setLiveAgentState({}), 3200)
              },
              onError: (err) => {
                setError(err.message ?? "Erro no stream live")
              },
            },
            ac.signal,
          )
          setConnected(false)
        } catch {
          if (ac.signal.aborted) break
          setConnected(false)
          setReconnecting(true)
          await new Promise((resolve) => setTimeout(resolve, reconnectDelayMs))
          reconnectDelayMs = Math.min(4000, reconnectDelayMs * 2)
        }
      }
    })().catch(() => {
      /* abort ou rede */
    })

    return () => {
      ac.abort()
      generationRef.current += 1
      clear()
      setLiveAgentState({})
      setConnected(false)
      setReconnecting(false)
    }
  }, [enabled, api, teamId, replayLimit, clear, coordinatorId])

  return {
    items,
    liveAgentState,
    liveMirrorLines,
    liveMirrorStreamText,
    connected,
    reconnecting,
    error,
    clear,
  }
}
