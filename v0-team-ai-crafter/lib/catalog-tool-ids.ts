/** Espelha `AVAILABLE_TOOL_IDS` do backend (`capabilities.tools`). */
export const CATALOG_TOOL_IDS = [
  "web_search",
  "file_search",
  "internal_actions",
  "code_execution",
  "email_send",
  "calendar_access",
  "database_query",
  "image_generation",
] as const

export type CatalogToolId = (typeof CATALOG_TOOL_IDS)[number]

const LABELS_PT: Record<CatalogToolId, string> = {
  web_search: "Pesquisa web",
  file_search: "Busca em ficheiros",
  internal_actions: "Ações internas (catálogo)",
  code_execution: "Execução de código",
  email_send: "Envio de email",
  calendar_access: "Calendário",
  database_query: "Consulta SQL (Postgres)",
  image_generation: "Geração de imagens",
}

export function catalogToolLabelPt(id: CatalogToolId): string {
  return LABELS_PT[id] ?? id
}
