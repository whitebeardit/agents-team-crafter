export const AVAILABLE_TOOL_IDS = [
  'web_search',
  'file_search',
  'internal_actions',
  'code_execution',
  'email_send',
  'calendar_access',
  'database_query',
  'image_generation',
] as const;

/** IDs removidos do catálogo (Loop 60); filtrados em `toolsSchema` e ignorados no runtime. */
export const DEPRECATED_CATALOG_TOOL_IDS = ['crm_access'] as const;

export type TAvailableToolId = (typeof AVAILABLE_TOOL_IDS)[number];

export function isAllowedTool(id: string): boolean {
  return (AVAILABLE_TOOL_IDS as readonly string[]).includes(id);
}

export function stripDeprecatedCatalogToolIds(ids: readonly string[]): string[] {
  const drop = new Set(DEPRECATED_CATALOG_TOOL_IDS as readonly string[]);
  return ids.filter((id) => !drop.has(id));
}

/** Dedupe, remove deprecated IDs, keep only catalog IDs allowed for `capabilities.tools`. */
export function normalizeCatalogToolIds(ids: readonly string[]): string[] {
  const stripped = stripDeprecatedCatalogToolIds(ids);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of stripped) {
    if (!isAllowedTool(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
