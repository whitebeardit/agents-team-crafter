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

function tryBindController(game: Phaser.Game, agents: OfficeAgentVisualState[]): AgentOfficeController | null {
  if (!game.scene.isActive(AGENT_OFFICE_SCENE_KEY)) return null
  const scene = game.scene.getScene(AGENT_OFFICE_SCENE_KEY) as AgentOfficeScene | undefined
  if (!scene) return null
  const c = scene.getController()
  c.syncAgents(agents)
  return c
}

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

    const bindOrRetry = () => {
      const c = tryBindController(game, agents)
      if (!c) return false
      controllerRef.current = c
      onControllerReady?.(c)
      return true
    }

    const onGameReady = () => {
      if (bindOrRetry()) return
      let attempts = 0
      const poll = () => {
        attempts += 1
        if (bindOrRetry()) return
        if (attempts > 120) {
          const scene = game.scene.getScene(AGENT_OFFICE_SCENE_KEY) as AgentOfficeScene | undefined
          if (scene) {
            const c = scene.getController()
            controllerRef.current = c
            onControllerReady?.(c)
            c.syncAgents(agents)
            if (process.env.NODE_ENV === "development") {
              console.warn("[AgentOfficeGame] Controller ligado em fallback após poll.")
            }
            return
          }
          console.error("[AgentOfficeGame] Scene Phaser não ficou activa; canvas pode ficar vazio.")
          return
        }
        requestAnimationFrame(poll)
      }
      requestAnimationFrame(poll)
    }

    game.events.once(Phaser.Core.Events.READY, onGameReady)

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

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 min-h-0 w-full overflow-hidden rounded-lg border border-border bg-[#0f172a]"
    />
  )
}
