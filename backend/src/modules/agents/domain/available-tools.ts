export const AVAILABLE_TOOL_IDS = [
  'web_search',
  'file_search',
  'internal_actions',
  'code_execution',
  'email_send',
  'calendar_access',
  'crm_access',
  'database_query',
  'image_generation',
] as const;

export type TAvailableToolId = (typeof AVAILABLE_TOOL_IDS)[number];

export function isAllowedTool(id: string): boolean {
  return (AVAILABLE_TOOL_IDS as readonly string[]).includes(id);
}
