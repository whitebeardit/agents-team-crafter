/**
 * Canonical slug for agent.category: trim, lowercase, non-alphanumeric → hyphen, collapse, default geral.
 */
export function normalizeAgentCategory(raw: string): string {
  const trimmed = (raw ?? '').trim().toLowerCase();
  const withHyphens = trimmed.replace(/[^\p{L}\p{N}]+/gu, '-');
  const collapsed = withHyphens.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return collapsed || 'geral';
}
