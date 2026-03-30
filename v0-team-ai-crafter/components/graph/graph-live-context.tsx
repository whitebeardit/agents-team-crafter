"use client"

import { createContext, useContext } from "react"
import type { TeamGraphLiveAgentState } from "@/lib/types"

export const GraphLiveAgentsContext = createContext<Record<string, TeamGraphLiveAgentState>>({})

export function useGraphLiveAgent(agentId: string): TeamGraphLiveAgentState | undefined {
  const map = useContext(GraphLiveAgentsContext)
  return map[agentId]
}
