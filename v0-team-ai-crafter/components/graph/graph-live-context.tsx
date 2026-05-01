"use client"

import { createContext, useContext } from "react"
import type { TeamGraphLiveAgentConversationState } from "@/lib/types"

export const GraphLiveAgentsContext = createContext<Record<string, TeamGraphLiveAgentConversationState>>({})

export function useGraphLiveAgent(agentId: string): TeamGraphLiveAgentConversationState | undefined {
  const map = useContext(GraphLiveAgentsContext)
  return map[agentId]
}
