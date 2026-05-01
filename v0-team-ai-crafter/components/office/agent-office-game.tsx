"use client"

import { useEffect, useRef } from "react"
import Phaser from "phaser"
import type { AgentOfficeController } from "@/lib/office/office-controller"
import type { OfficeAgentVisualState, OfficeEvent } from "@/lib/office/office-types"
import {
  AGENT_OFFICE_SCENE_KEY,
  AgentOfficeScene,
  OFFICE_GAME_HEIGHT,
  OFFICE_GAME_WIDTH,
} from "@/components/office/agent-office-scene"

export default function AgentOfficeGame({
  agents,
  activeEvent,
  onControllerReady,
}: {
  agents: OfficeAgentVisualState[]
  activeEvent?: OfficeEvent
  onControllerReady?: (controller: AgentOfficeController) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const controllerRef = useRef<AgentOfficeController | null>(null)

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: OFFICE_GAME_WIDTH,
      height: OFFICE_GAME_HEIGHT,
      backgroundColor: "#0f172a",
      scene: [AgentOfficeScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: OFFICE_GAME_WIDTH,
        height: OFFICE_GAME_HEIGHT,
      },
    }

    const game = new Phaser.Game(config)
    gameRef.current = game

    let attempts = 0
    const wire = () => {
      attempts += 1
      const scene = game.scene.getScene(AGENT_OFFICE_SCENE_KEY) as AgentOfficeScene | undefined
      if (!scene || attempts > 240) return
      if (!scene.sys?.isActive()) {
        requestAnimationFrame(wire)
        return
      }
      const c = scene.getController()
      controllerRef.current = c
      onControllerReady?.(c)
      c.syncAgents(agents)
    }
    requestAnimationFrame(wire)

    return () => {
      controllerRef.current?.destroy()
      controllerRef.current = null
      game.destroy(true)
      gameRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; agents synced below
  }, [])

  useEffect(() => {
    controllerRef.current?.syncAgents(agents)
  }, [agents])

  useEffect(() => {
    const c = controllerRef.current
    if (!c) return
    if (!activeEvent) {
      c.resetFocus()
      return
    }
    c.playEvent(activeEvent)
  }, [activeEvent])

  return <div ref={containerRef} className="min-h-[340px] w-full overflow-hidden rounded-lg border border-border bg-[#0f172a]" />
}
