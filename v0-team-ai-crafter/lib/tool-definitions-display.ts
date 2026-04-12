/** Helpers partilhados entre tabela e cartões (Loop 75). */

export type TBusinessCatalogItem = {
  actionId: string
  title: string
  description: string
  packId?: string
}

export type ToolDefinitionRow = {
  id: string
  name: string
  slug: string
  kind: "builtin_ref" | "http_webhook" | "mcp_ref" | "internal_action"
  enabled: boolean
  config: Record<string, unknown>
}

export function describeToolConfig(
  tool: ToolDefinitionRow,
  catalogByActionId?: Record<string, TBusinessCatalogItem>,
): string {
  if (tool.kind === "internal_action") {
    const aid = typeof tool.config?.actionId === "string" ? tool.config.actionId : ""
    if (!aid) return "Acao interna do backend"
    const meta = catalogByActionId?.[aid]
    return meta ? `${meta.title} — ${aid}` : `Acao interna: ${aid}`
  }
  if (tool.kind === "http_webhook") {
    return typeof tool.config.url === "string" ? tool.config.url : "Webhook HTTP"
  }
  if (tool.kind === "builtin_ref") {
    return typeof tool.config.builtinId === "string"
      ? `Builtin: ${tool.config.builtinId}`
      : "Referencia builtin"
  }
  if (tool.kind === "mcp_ref") {
    return typeof tool.config.toolName === "string"
      ? `MCP tool: ${tool.config.toolName}`
      : "Referencia MCP"
  }
  return "Sem configuracao adicional"
}

export function describeToolDependencies(tool: ToolDefinitionRow): string {
  switch (tool.kind) {
    case "internal_action":
      return "Executa uma acao registada na plataforma (MongoDB / dominio de negocio). Escolha a acao pelo catalogo ao criar a definicao — nao e necessario digitar o actionId."
    case "http_webhook":
      return "O runtime faz HTTP para o URL indicado; o seu servico deve estar acessivel e validar autenticacao."
    case "builtin_ref":
      return "Alias no workspace (sem URL nesta definicao). Execucao completa: catalogo no agente + Integracoes."
    case "mcp_ref":
      return "Requer MCP ligado no workspace e permissoes na ferramenta remota."
    default:
      return ""
  }
}
