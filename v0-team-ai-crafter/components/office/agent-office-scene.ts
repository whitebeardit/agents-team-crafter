import Phaser from "phaser"
import type { AgentOfficeController } from "@/lib/office/office-controller"
import type { OfficeAgentVisualState, OfficeEvent } from "@/lib/office/office-types"

export const OFFICE_GAME_WIDTH = 1100
export const OFFICE_GAME_HEIGHT = 680

export const AGENT_OFFICE_SCENE_KEY = "AgentOfficeScene"

const COLOR_COORD = 0xf59e0b
const COLOR_SPEC = 0x38bdf8
const COLOR_DIM = 0x64748b
const COLOR_LINE = 0x22d3ee

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

  private createOrUpdateAgent(agent: OfficeAgentVisualState) {
    let container = this.agentContainers.get(agent.agentId)
    if (!container) {
      container = this.add.container(agent.x, agent.y)
      this.agentContainers.set(agent.agentId, container)
      const circle = this.add.circle(0, 0, 38, COLOR_SPEC, 1)
      circle.setStrokeStyle(3, 0xffffff, 0.35)
      const label = this.add
        .text(0, 52, agent.name, {
          fontSize: "13px",
          color: "#e2e8f0",
          fontFamily: "system-ui, sans-serif",
        })
        .setOrigin(0.5, 0)
      label.setWordWrapWidth(200)
      container.add([circle, label])
      container.setData("circle", circle)
      container.setData("label", label)
    }
    container.setPosition(agent.x, agent.y)
    const circle = container.getData("circle") as Phaser.GameObjects.Arc
    const label = container.getData("label") as Phaser.GameObjects.Text
    label.setText(agent.name.length > 28 ? `${agent.name.slice(0, 26)}…` : agent.name)
    const baseColor = agent.role === "coordinator" ? COLOR_COORD : COLOR_SPEC
    circle.setFillStyle(baseColor, 1)
    this.applyVisualState(container, agent)
  }

  private applyVisualState(container: Phaser.GameObjects.Container, agent: OfficeAgentVisualState) {
    const circle = container.getData("circle") as Phaser.GameObjects.Arc
    const baseColor = agent.role === "coordinator" ? COLOR_COORD : COLOR_SPEC
    if (agent.status === "error") {
      container.setAlpha(1)
      circle.setFillStyle(0xff4444, 1)
      return
    }
    if (agent.dimmed) {
      container.setAlpha(0.38)
      circle.setFillStyle(COLOR_DIM, 1)
    } else {
      container.setAlpha(1)
      circle.setFillStyle(baseColor, 1)
    }
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
          const circle = container.getData("circle") as Phaser.GameObjects.Arc
          circle.setFillStyle(0xff4444, 1)
          container.setAlpha(1)
        }
      }
      return
    }

    if (event.type === "user_message") {
      this.resetFocus()
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
