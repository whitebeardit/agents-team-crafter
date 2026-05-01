/** Shared layout/visual constants for Phaser office scene and React overlay (single source of truth). */

export const OFFICE_GAME_WIDTH = 1100
export const OFFICE_GAME_HEIGHT = 680

/** Max on-screen height for agent sprites (~20% of canvas). */
export const AGENT_MAX_DISPLAY_HEIGHT = Math.round(OFFICE_GAME_HEIGHT * 0.2)

/** Feet Y must be large enough that sprite top (feetY − height) stays inside the canvas. */
export const USER_FEET_MARGIN_TOP = 12

/** Lower band (~floor zone): avoids user + dialogue bubble clipping at top of scene. */
export const USER_FEET_Y = Math.max(
  AGENT_MAX_DISPLAY_HEIGHT + USER_FEET_MARGIN_TOP,
  Math.round(OFFICE_GAME_HEIGHT * 0.32),
)

/**
 * Overlay bubble anchor: approximate upper body/head from feet position (game coords).
 * bubbleAnchorY = feetY − AGENT_MAX_DISPLAY_HEIGHT * BUBBLE_ANCHOR_HEIGHT_RATIO
 */
export const BUBBLE_ANCHOR_HEIGHT_RATIO = 0.92

const POSITION_PAD = 24

/** Keep agent feet / sprite anchor inside the game canvas when dragging. */
export function clampOfficePosition(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(OFFICE_GAME_WIDTH - POSITION_PAD, Math.max(POSITION_PAD, x)),
    y: Math.min(OFFICE_GAME_HEIGHT - POSITION_PAD, Math.max(POSITION_PAD, y)),
  }
}
