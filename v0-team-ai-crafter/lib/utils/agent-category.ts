/**
 * Canonical slug for agent.category (mirror of backend shared/utils/agent-category.ts).
 */
export function normalizeAgentCategory(raw: string): string {
  const trimmed = (raw ?? "").trim().toLowerCase()
  const withHyphens = trimmed.replace(/[^\p{L}\p{N}]+/gu, "-")
  const collapsed = withHyphens.replace(/-+/g, "-").replace(/^-+|-+$/g, "")
  return collapsed || "geral"
}

/** Display label for a category slug (title-case segments). */
export function formatCategoryLabel(slug: string): string {
  if (!slug) return ""
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}
