import Phaser from "phaser"
import type { AgentOfficeController } from "@/lib/office/office-controller"
import {
  AGENT_MAX_DISPLAY_HEIGHT,
  OFFICE_GAME_HEIGHT,
  OFFICE_GAME_WIDTH,
} from "@/lib/office/office-visual-constants"
import {
  OFFICE_USER_AGENT_ID,
  type OfficeAgentVisualState,
  type OfficeEvent,
} from "@/lib/office/office-types"

export { OFFICE_GAME_WIDTH, OFFICE_GAME_HEIGHT, AGENT_MAX_DISPLAY_HEIGHT } from "@/lib/office/office-visual-constants"

export const AGENT_OFFICE_SCENE_KEY = "AgentOfficeScene"

const OFFICE_ASSET_BASE = "/office"

const TEX_OFFICE_BG = "office_bg"
const TEX_AGENT_COORD = "office_agent_coord"
const TEX_AGENT_SPEC = "office_agent_spec"
const TEX_AGENT_USER = "office_agent_user"

const COLOR_LINE = 0x22d3ee
const TINT_ERROR = 0xff6666

export class AgentOfficeScene extends Phaser.Scene {
  private agentContainers = new Map<string, Phaser.GameObjects.Container>()
  private lineGraphics?: Phaser.GameObjects.Graphics
  private lineTween?: Phaser.Tweens.Tween
  private visualStates = new Map<string, OfficeAgentVisualState>()
  private layoutEditMode = false
  private draggingAgentId?: string
  private onAgentPositionCommit?: (agentId: string, x: number, y: number) => void
  private dragHandlersBound = false

  constructor() {
    super({ key: AGENT_OFFICE_SCENE_KEY })
  }

  preload() {
    this.load.image(TEX_OFFICE_BG, `${OFFICE_ASSET_BASE}/cenario-clinica-psy.png`)
    this.load.image(TEX_AGENT_COORD, `${OFFICE_ASSET_BASE}/agt-coordinator.png`)
    this.load.image(TEX_AGENT_SPEC, `${OFFICE_ASSET_BASE}/agt-especialista-default.png`)
    this.load.image(TEX_AGENT_USER, `${OFFICE_ASSET_BASE}/user-default.png`)
  }

  create() {
    this.cameras.main.setBackgroundColor(0x0f172a)
    this.createOfficeBackground()
    this.bindDragHandlers()
  }

  private bindDragHandlers() {
    if (this.dragHandlersBound) return
    this.dragHandlersBound = true
    this.input.on("dragstart", (_pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      if (!this.layoutEditMode) return
      const c = obj as Phaser.GameObjects.Container
      const id = c.getData("agentId") as string | undefined
      if (id) {
        this.draggingAgentId = id
        this.tweens.killTweensOf(c)
        c.setScale(1)
      }
    })
    this.input.on(
      "drag",
      (_pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject, dragX: number, dragY: number) => {
        if (!this.layoutEditMode) return
        ;(obj as Phaser.GameObjects.Container).setPosition(dragX, dragY)
      },
    )
    this.input.on("dragend", (_pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      if (!this.layoutEditMode) return
      const c = obj as Phaser.GameObjects.Container
      const id = c.getData("agentId") as string | undefined
      if (id && this.onAgentPositionCommit) {
        this.onAgentPositionCommit(id, c.x, c.y)
      }
      this.draggingAgentId = undefined
    })
  }

  private setContainerDraggable(container: Phaser.GameObjects.Container, enabled: boolean) {
    const id = container.getData("agentId") as string | undefined
    if (!id) return
    if (enabled) {
      const w = 112
      const h = Math.round(AGENT_MAX_DISPLAY_HEIGHT + 40)
      container.setInteractive(
        new Phaser.Geom.Rectangle(-w / 2, -h, w, h),
        Phaser.Geom.Rectangle.Contains,
      )
      this.input.setDraggable(container, true)
    } else {
      if (container.input) {
        this.input.setDraggable(container, false)
        container.disableInteractive()
      }
    }
  }

  private refreshAllDraggability() {
    for (const container of this.agentContainers.values()) {
      this.setContainerDraggable(container, this.layoutEditMode)
    }
  }

  private createOfficeBackground() {
    this.add
      .image(0, 0, TEX_OFFICE_BG)
      .setOrigin(0, 0)
      .setDisplaySize(OFFICE_GAME_WIDTH, OFFICE_GAME_HEIGHT)
      .setDepth(-10)
  }

  private textureKeyForRole(role: OfficeAgentVisualState["role"]): string {
    if (role === "coordinator") return TEX_AGENT_COORD
    if (role === "user") return TEX_AGENT_USER
    return TEX_AGENT_SPEC
  }

  private sizeAgentSprite(sprite: Phaser.GameObjects.Image) {
    const frame = sprite.frame
    const h = frame.height
    if (!h) return
    const scale = AGENT_MAX_DISPLAY_HEIGHT / h
    sprite.setScale(scale)
  }

  /** True when the factory can still add game objects (avoids null `displayList` after scene/game destroy). */
  private isAddFactoryUsable(): boolean {
    const add = this.add as unknown as { displayList?: unknown } | null | undefined
    return Boolean(add?.displayList)
  }

  syncAgents(agents: OfficeAgentVisualState[]) {
    if (!this.isAddFactoryUsable()) return
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
    this.refreshAllDraggability()
  }

  /** Label sits just below the sprite feet (container origin = bottom-center of sprite). */
  private static readonly LABEL_BELOW_FEET_PX = 8

  private createOrUpdateAgent(agent: OfficeAgentVisualState) {
    let container = this.agentContainers.get(agent.agentId)
    if (!container) {
      container = this.add.container(agent.x, agent.y)
      this.agentContainers.set(agent.agentId, container)
      const texKey = this.textureKeyForRole(agent.role)
      const sprite = this.add.image(0, 0, texKey).setOrigin(0.5, 1)
      this.sizeAgentSprite(sprite)
      const label = this.add
        .text(0, AgentOfficeScene.LABEL_BELOW_FEET_PX, agent.name, {
          fontSize: "12px",
          color: "#f1f5f9",
          fontFamily: "system-ui, sans-serif",
        })
        .setOrigin(0.5, 0)
      label.setStroke("#0f172a", 4)
      label.setWordWrapWidth(200)
      container.add([sprite, label])
      container.setData("sprite", sprite)
      container.setData("label", label)
    }
    container.setData("agentId", agent.agentId)
    if (this.draggingAgentId !== agent.agentId) {
      container.setPosition(agent.x, agent.y)
    }
    const sprite = container.getData("sprite") as Phaser.GameObjects.Image
    const label = container.getData("label") as Phaser.GameObjects.Text
    const desiredTex = this.textureKeyForRole(agent.role)
    if (sprite.texture.key !== desiredTex) {
      sprite.setTexture(desiredTex)
      this.sizeAgentSprite(sprite)
    }
    label.setText(agent.name.length > 28 ? `${agent.name.slice(0, 26)}…` : agent.name)
    label.setY(AgentOfficeScene.LABEL_BELOW_FEET_PX)
    this.applyVisualState(container, agent)
  }

  private styleLabel(label: Phaser.GameObjects.Text, agent: OfficeAgentVisualState) {
    const dimmed = agent.dimmed && agent.status !== "error"
    const prominent = !dimmed && agent.active && agent.status !== "error"

    if (agent.status === "error") {
      label.setStyle({
        fontSize: "12px",
        fontFamily: "system-ui, sans-serif",
        color: "#fecaca",
        fontStyle: "bold",
      })
      label.setStroke("#450a0a", 4)
      return
    }
    if (prominent) {
      label.setStyle({
        fontSize: "13px",
        fontFamily: "system-ui, sans-serif",
        color: "#ffffff",
        fontStyle: "bold",
      })
      label.setStroke("#0f172a", 6)
      return
    }
    if (dimmed) {
      label.setStyle({
        fontSize: "12px",
        fontFamily: "system-ui, sans-serif",
        color: "#94a3b8",
        fontStyle: "normal",
      })
      label.setStroke("#0f172a", 4)
      return
    }
    label.setStyle({
      fontSize: "12px",
      fontFamily: "system-ui, sans-serif",
      color: "#f1f5f9",
      fontStyle: "normal",
    })
    label.setStroke("#0f172a", 4)
  }

  private applyVisualState(container: Phaser.GameObjects.Container, agent: OfficeAgentVisualState) {
    const sprite = container.getData("sprite") as Phaser.GameObjects.Image
    const label = container.getData("label") as Phaser.GameObjects.Text
    container.setAlpha(1)
    label.setAlpha(1)

    if (agent.status === "error") {
      sprite.setAlpha(1)
      sprite.setTint(TINT_ERROR)
      this.styleLabel(label, agent)
      return
    }

    sprite.clearTint()
    sprite.setAlpha(agent.dimmed ? 0.38 : 1)
    this.styleLabel(label, agent)
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

  private clearCommunicationLine() {
    this.lineTween?.stop()
    this.lineTween = undefined
    this.lineGraphics?.destroy()
    this.lineGraphics = undefined
  }

  resetFocus() {
    this.clearCommunicationLine()
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

  private getSpriteCenterWorld(agentId: string): { x: number; y: number } | null {
    const c = this.agentContainers.get(agentId)
    if (!c) return null
    const sprite = c.getData("sprite") as Phaser.GameObjects.Image
    const h = sprite.frame.height * sprite.scaleY
    return { x: c.x, y: c.y - h / 2 }
  }

  /**
   * Directed edge between sprite centres, arrow toward `toId`. Call after `clearCommunicationLine` if replacing.
   */
  private drawDirectedCommunication(fromId?: string, toId?: string) {
    if (!fromId || !toId || fromId === toId) return
    const A = this.getSpriteCenterWorld(fromId)
    const B = this.getSpriteCenterWorld(toId)
    if (!A || !B) return

    const dx = B.x - A.x
    const dy = B.y - A.y
    const len = Math.hypot(dx, dy)
    if (len < 28) return
    const ux = dx / len
    const uy = dy / len
    const startInset = 22
    const endInset = 26
    const x0 = A.x + ux * startInset
    const y0 = A.y + uy * startInset
    const x1 = B.x - ux * endInset
    const y1 = B.y - uy * endInset

    const mx = (x0 + x1) / 2
    const my = (y0 + y1) / 2 - 32
    const perpX = -uy
    const perpY = ux

    const gfx = this.add.graphics()
    gfx.setDepth(5)
    this.lineGraphics = gfx

    const updateLine = (alpha: number) => {
      gfx.clear()
      gfx.lineStyle(3, COLOR_LINE, alpha)
      gfx.beginPath()
      gfx.moveTo(x0, y0)
      const n = 24
      for (let i = 1; i <= n; i += 1) {
        const t = i / n
        const ox = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x1
        const oy = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * y1
        gfx.lineTo(ox, oy)
      }
      gfx.strokePath()

      const tipX = B.x - ux * 10
      const tipY = B.y - uy * 10
      const backX = tipX - ux * 15
      const backY = tipY - uy * 15
      gfx.fillStyle(COLOR_LINE, alpha * 0.95)
      gfx.fillTriangle(tipX, tipY, backX + perpX * 9, backY + perpY * 9, backX - perpX * 9, backY - perpY * 9)
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

  private highlightConversation(fromAgentId?: string, toAgentId?: string, pulseIds: string[] = []) {
    if (fromAgentId && toAgentId && fromAgentId !== toAgentId) {
      this.focusAgents(fromAgentId, toAgentId)
      this.drawDirectedCommunication(fromAgentId, toAgentId)
    } else {
      const singleId = fromAgentId ?? toAgentId
      if (singleId) this.focusAgents(singleId, singleId)
    }

    for (const id of pulseIds) {
      if (id) this.pulseAgent(id)
    }
  }

  playEvent(event: OfficeEvent) {
    if (!this.isAddFactoryUsable()) return
    this.clearCommunicationLine()
    const coordinatorFallback = [...this.visualStates.values()].find((a) => a.role === "coordinator")

    if (event.type === "agent_handoff") {
      const from = event.fromAgentId
      const to = event.toAgentId
      this.highlightConversation(from, to, [from, to].filter((id): id is string => Boolean(id)))
      return
    }

    if (event.type === "agent_response") {
      const from = event.fromAgentId ?? event.actorId
      const to = event.toAgentId ?? event.fromAgentId ?? coordinatorFallback?.agentId
      this.highlightConversation(from, to, [from, to].filter((id): id is string => Boolean(id)))
      return
    }

    if (
      event.type === "agent_thinking" ||
      event.type === "tool_call" ||
      event.type === "tool_result" ||
      event.type === "activity"
    ) {
      const id = event.actorId ?? event.fromAgentId ?? event.toAgentId
      this.highlightConversation(event.fromAgentId ?? id, event.toAgentId ?? id, id ? [id] : [])
      return
    }

    if (event.type === "error") {
      const id = event.actorId
      this.highlightConversation(event.fromAgentId ?? id, event.toAgentId ?? id, id ? [id] : [])
      if (id) {
        const container = this.agentContainers.get(id)
        if (container) {
          const agent = this.visualStates.get(id)
          if (agent) {
            this.applyVisualState(container, { ...agent, status: "error", dimmed: false })
          }
        }
      }
      return
    }

    if (event.type === "user_message") {
      const coordId = coordinatorFallback?.agentId
      this.highlightConversation(
        OFFICE_USER_AGENT_ID,
        coordId,
        [OFFICE_USER_AGENT_ID, coordId].filter((id): id is string => Boolean(id)),
      )
    }
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
      setLayoutEditMode: (enabled: boolean) => {
        scene.layoutEditMode = enabled
        if (!enabled) scene.draggingAgentId = undefined
        scene.refreshAllDraggability()
      },
      setOnAgentPositionCommit: (handler) => {
        scene.onAgentPositionCommit = handler ?? undefined
      },
      destroy: () => {
        scene.resetFocus()
      },
    }
  }
}
