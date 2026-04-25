/** Espelha `AVAILABLE_TOOL_IDS` do backend (`capabilities.tools`). */
export const CATALOG_TOOL_IDS = [
  "web_search",
  "file_search",
  "internal_actions",
  "code_execution",
  "email_send",
  "calendar_access",
  "image_generation",
] as const

export type CatalogToolId = (typeof CATALOG_TOOL_IDS)[number]

/**
 * IDs que não podem repetir entre dois especialistas no mesmo plano (enforcement Loop 78).
 * Manter alinhado a `SPECIALIST_EXCLUSIVE_CATALOG_TOOL_IDS` no backend.
 */
export const SPECIALIST_EXCLUSIVE_CATALOG_TOOL_IDS: readonly CatalogToolId[] = [
  "calendar_access",
  "internal_actions",
  "email_send",
  "image_generation",
  "file_search",
]

/** Utilitários que podem repetir entre especialistas (fora da colisão de domínio). */
export const CATALOG_UTILITY_TOOL_IDS: readonly CatalogToolId[] = CATALOG_TOOL_IDS.filter(
  (id) => !(SPECIALIST_EXCLUSIVE_CATALOG_TOOL_IDS as readonly string[]).includes(id),
)

const LABELS_PT: Record<CatalogToolId, string> = {
  web_search: "Pesquisa web",
  file_search: "Busca em ficheiros",
  internal_actions: "Ações internas (técnico/avançado)",
  code_execution: "Execução de código",
  email_send: "Envio de email",
  calendar_access: "Calendário",
  image_generation: "Geração de imagens",
}

export function catalogToolLabelPt(id: CatalogToolId): string {
  return LABELS_PT[id] ?? id
}
