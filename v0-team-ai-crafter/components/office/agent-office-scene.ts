import Phaser from "phaser"
import type { AgentOfficeController } from "@/lib/office/office-controller"
import {
  OFFICE_USER_AGENT_ID,
  type OfficeAgentVisualState,
  type OfficeEvent,
} from "@/lib/office/office-types"

export const OFFICE_GAME_WIDTH = 1100
export const OFFICE_GAME_HEIGHT = 680

export const AGENT_OFFICE_SCENE_KEY = "AgentOfficeScene"

const COLOR_COORD = 0xf59e0b
const COLOR_SPEC = 0x38bdf8
const COLOR_USER = 0x22c55e
const COLOR_DIM = 0x64748b
const COLOR_LINE = 0x22d3ee
const COLOR_ERR = 0xff4444

function roleBaseColor(role: OfficeAgentVisualState["role"]): number {
  if (role === "coordinator") return COLOR_COORD
  if (role === "user") return COLOR_USER
  return COLOR_SPEC
}

function pickStickStroke(agent: OfficeAgentVisualState): number {
  if (agent.status === "error") return COLOR_ERR
  return roleBaseColor(agent.role)
}

export class AgentOfficeScene extends Phaser.Scene {
  private agentContainers = new Map<string, Phaser.GameObjects.Container>()
  private lineGraphics?: Phaser.GameObjects.Graphics
  private lineTween?: Phaser.Tweens.Tween
  private visualStates = new Map<string, OfficeAgentVisualState>()

  constructor() {
    super({ key: AGENT_OFFICE_SCENE_KEY })
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0f172a)
    this.createOfficeBackground()
  }

  private createOfficeBackground() {
    const g = this.add.graphics()
    g.fillStyle(0x1e293b, 1)
    g.fillRect(0, 0, OFFICE_GAME_WIDTH, OFFICE_GAME_HEIGHT)
    g.fillStyle(0x0f172a, 1)
    g.fillRect(0, OFFICE_GAME_HEIGHT * 0.55, OFFICE_GAME_WIDTH, OFFICE_GAME_HEIGHT * 0.45)
    g.lineStyle(2, 0x334155, 0.6)
    g.strokeRect(40, 60, OFFICE_GAME_WIDTH - 80, OFFICE_GAME_HEIGHT - 120)
    g.setDepth(-10)

    const floor = this.add.graphics()
    floor.fillStyle(0x1e293b, 0.85)
    floor.fillEllipse(OFFICE_GAME_WIDTH / 2, OFFICE_GAME_HEIGHT - 48, OFFICE_GAME_WIDTH * 0.72, 56)
    floor.setDepth(-9)
  }

  syncAgents(agents: OfficeAgentVisualState[]) {
    this.visualStates = new Map(agents.map((a) => [a.agentId, a]))
    const ids = new Set(agents.map((a) => a.agentId))
    for (const id of this.agentContainers.keys()) {
      if (!ids.has(id)) {
        this.agentContainers.get(id)?.destroy(true)
        this.agentContainers.delete(id)
      }
    }
    for (const agent of agents) {
      this.createOrUpdateAgent(agent)
    }
  }

  private drawStickFigure(gfx: Phaser.GameObjects.Graphics, agent: OfficeAgentVisualState) {
    gfx.clear()
    const stroke = agent.dimmed ? COLOR_DIM : pickStickStroke(agent)
    const alpha = agent.dimmed ? 0.55 : 1
    gfx.lineStyle(3, stroke, alpha)
    gfx.strokeCircle(0, -40, 12)
    gfx.lineBetween(0, -28, 0, 14)
    gfx.lineBetween(-26, -14, 26, -14)
    gfx.lineBetween(0, 14, -18, 46)
    gfx.lineBetween(0, 14, 18, 46)
  }

  private createOrUpdateAgent(agent: OfficeAgentVisualState) {
    let container = this.agentContainers.get(agent.agentId)
    if (!container) {
      container = this.add.container(agent.x, agent.y)
      this.agentContainers.set(agent.agentId, container)
      const stick = this.add.graphics()
      const label = this.add
        .text(0, 58, agent.name, {
          fontSize: "13px",
          color: "#e2e8f0",
          fontFamily: "system-ui, sans-serif",
        })
        .setOrigin(0.5, 0)
      label.setWordWrapWidth(200)
      container.add([stick, label])
      container.setData("stick", stick)
      container.setData("label", label)
    }
    container.setPosition(agent.x, agent.y)
    const stick = container.getData("stick") as Phaser.GameObjects.Graphics
    const label = container.getData("label") as Phaser.GameObjects.Text
    label.setText(agent.name.length > 28 ? `${agent.name.slice(0, 26)}…` : agent.name)
    this.applyVisualState(container, agent)
  }

  private applyVisualState(container: Phaser.GameObjects.Container, agent: OfficeAgentVisualState) {
    const stick = container.getData("stick") as Phaser.GameObjects.Graphics
    if (agent.status === "error") {
      container.setAlpha(1)
    } else if (agent.dimmed) {
      container.setAlpha(0.38)
    } else {
      container.setAlpha(1)
    }
    this.drawStickFigure(stick, agent)
  }

  focusAgents(fromAgentId?: string, toAgentId?: string) {
    for (const [agentId, container] of this.agentContainers.entries()) {
      const agent = this.visualStates.get(agentId)
      if (!agent) continue
      const focused = agentId === fromAgentId || agentId === toAgentId
      if (!fromAgentId && !toAgentId) {
        this.applyVisualState(container, { ...agent, dimmed: false, active: false })
      } else {
        this.applyVisualState(container, { ...agent, dimmed: !focused, active: focused })
      }
    }
  }

  resetFocus() {
    this.lineTween?.stop()
    this.lineTween = undefined
    this.lineGraphics?.destroy()
    this.lineGraphics = undefined
    for (const [agentId, container] of this.agentContainers.entries()) {
      const agent = this.visualStates.get(agentId)
      if (!agent) continue
      this.applyVisualState(container, { ...agent, dimmed: false, active: false, status: agent.status })
    }
  }

  setAgentsDimmed(dimmed: boolean) {
    for (const [agentId, container] of this.agentContainers.entries()) {
      const agent = this.visualStates.get(agentId)
      if (!agent) continue
      this.applyVisualState(container, { ...agent, dimmed, active: false })
    }
  }

  playEvent(event: OfficeEvent) {
    const coordinatorFallback = [...this.visualStates.values()].find((a) => a.role === "coordinator")

    if (event.type === "agent_handoff") {
      const from = event.fromAgentId
      const to = event.toAgentId
      this.focusAgents(from, to)
      this.drawInteractionLine(from, to)
      if (from) this.pulseAgent(from)
      if (to) this.pulseAgent(to)
      return
    }

    if (event.type === "agent_response") {
      const from = event.actorId
      const to = event.toAgentId ?? event.fromAgentId ?? coordinatorFallback?.agentId
      this.focusAgents(from, to)
      if (from) this.pulseAgent(from)
      return
    }

    if (event.type === "agent_thinking" || event.type === "tool_call") {
      const id = event.actorId
      if (id) {
        this.focusAgents(id, id)
        this.pulseAgent(id)
      }
      return
    }

    if (event.type === "error") {
      const id = event.actorId
      if (id) {
        this.focusAgents(id, id)
        const container = this.agentContainers.get(id)
        if (container) {
          const agent = this.visualStates.get(id)
          if (agent) {
            const stick = container.getData("stick") as Phaser.GameObjects.Graphics
            this.drawStickFigure(stick, { ...agent, status: "error", dimmed: false })
          }
          container.setAlpha(1)
        }
      }
      return
    }

    if (event.type === "user_message") {
      this.focusAgents(OFFICE_USER_AGENT_ID, OFFICE_USER_AGENT_ID)
      this.pulseAgent(OFFICE_USER_AGENT_ID)
    }
  }

  private drawInteractionLine(fromId?: string, toId?: string) {
    this.lineTween?.stop()
    this.lineGraphics?.destroy()
    if (!fromId || !toId || fromId === toId) return
    const a = this.agentContainers.get(fromId)
    const b = this.agentContainers.get(toId)
    if (!a || !b) return

    const gfx = this.add.graphics()
    gfx.setDepth(5)
    this.lineGraphics = gfx

    const updateLine = (alpha: number) => {
      gfx.clear()
      gfx.lineStyle(3, COLOR_LINE, alpha)
      const ax = a.x
      const ay = a.y
      const bx = b.x
      const by = b.y
      const cx = (ax + bx) / 2
      const cy = (ay + by) / 2 - 40
      const n = 28
      gfx.beginPath()
      gfx.moveTo(ax, ay)
      for (let i = 1; i <= n; i += 1) {
        const t = i / n
        const x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cx + t * t * bx
        const y = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * cy + t * t * by
        gfx.lineTo(x, y)
      }
      gfx.strokePath()
    }

    updateLine(0.85)
    this.lineTween = this.tweens.addCounter({
      from: 0.35,
      to: 1,
      duration: 700,
      yoyo: true,
      repeat: -1,
      onUpdate: (tw) => {
        const raw = tw.getValue()
        const v = typeof raw === "number" && !Number.isNaN(raw) ? raw : 0.85
        updateLine(v)
      },
    })
  }

  private pulseAgent(agentId: string) {
    const container = this.agentContainers.get(agentId)
    if (!container) return
    this.tweens.killTweensOf(container)
    container.setScale(1)
    this.tweens.add({
      targets: container,
      scale: 1.08,
      duration: 160,
      yoyo: true,
      ease: "Sine.easeInOut",
    })
  }

  getController(): AgentOfficeController {
    const scene = this
    return {
      playEvent: (event: OfficeEvent) => scene.playEvent(event),
      syncAgents: (agents: OfficeAgentVisualState[]) => scene.syncAgents(agents),
      focusAgents: (from, to) => scene.focusAgents(from, to),
      resetFocus: () => scene.resetFocus(),
      setAgentsDimmed: (d) => scene.setAgentsDimmed(d),
      destroy: () => {
        scene.resetFocus()
      },
    }
  }
}
