/**
 * Alinhado a `actionIdToToolSlug` no backend (`planner-pack-presets.ts`).
 */
export function actionIdToToolSlug(actionId: string): string {
  const s = actionId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  const base = s ? `ba-${s}` : "ba-tool"
  return base.slice(0, 80)
}
