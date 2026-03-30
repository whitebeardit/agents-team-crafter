// Agent types
export type AgentRole = "coordinator" | "specialist"
export type AgentOrigin = "whitebeard" | "company"
export type AgentStatus = "draft" | "active" | "archived"
export type AccessLevel = "read" | "write" | "restricted"

export interface AgentCapabilities {
  tools: string[]
  mcpBindings: string[]
}

export interface AgentKnowledge {
  sources: string[]
  useSessionMemory: boolean
  usePersistentMemory: boolean
  fixedContext?: string
}

export interface AgentChannelConfig {
  enabled: ChannelType[]
  canReplyDirectly: boolean
}

export interface AgentSecurity {
  requiresApproval: boolean
  accessLevel: AccessLevel
}

/** Body de `POST /api/v1/teams/:id/run` */
export interface TeamRunRequest {
  message: string
  channel?: string
  locale?: string
  requestedAccessLevel?: AccessLevel
  taskType?: string
}

export interface TeamRunExternalResponse {
  text: string
  format?: "plain" | "markdown"
}

export interface TeamRunSpecialistResult {
  specialistAgentId: string
  summary: string
  structured?: Record<string, unknown>
}

/** Dados em `data` de `POST /api/v1/teams/:id/run` */
export interface TeamRunResponse {
  runId: string
  teamId: string
  coordinatorAgentId: string
  externalResponse: TeamRunExternalResponse
  specialistResults: TeamRunSpecialistResult[]
  events: unknown[]
}

/** @deprecated Use `TeamRunRequest` / `POST /teams/:id/run` */
export type AgentRunRequest = TeamRunRequest

/** @deprecated Legado do runtime por agente; use team run */
export type AgentRunDecision = { kind: "continue" }

/** @deprecated Replaced by `TeamRunResponse` (`POST /api/v1/teams/:id/run`) */
export interface AgentRunResponse {
  runId: string
  agentId: string
  selectedAgentId: string
  decision: AgentRunDecision
  output: unknown
  events: unknown[]
}

/** Códigos de erro relevantes ao runtime (além de 401/403/404 genéricos) */
export type AgentRuntimeErrorCode = "VALIDATION_ERROR" | "NOT_FOUND" | "TEAM_RUNTIME_GUARD" | "TEAM_RUNTIME_INVARIANT"

export interface Agent {
  id: string
  name: string
  description: string
  role: AgentRole
  origin: AgentOrigin
  skills: string[]
  version: string
  avatar?: string
  category: string
  channels: ChannelType[]
  status: AgentStatus
  
  // Extended fields
  goal?: string
  responsibilities?: string[]
  systemInstruction?: string
  
  capabilities?: AgentCapabilities
  knowledge?: AgentKnowledge
  channelConfig?: AgentChannelConfig
  security?: AgentSecurity
}

// MCP types
export type MCPStatus = "connected" | "disconnected" | "pending"

export interface MCPTool {
  name: string
  description: string
}

export interface MCPConnection {
  id: string
  name: string
  description: string
  status: MCPStatus
  tools: MCPTool[]
  tenantId: string
  icon?: string
  createdAt: string
  updatedAt: string
}

export interface AgentMCPBinding {
  id: string
  agentId: string
  mcpConnectionId: string
  allowedTools: string[]
  requiresApproval: boolean
  createdAt: string
}

// Knowledge Source types
export type KnowledgeSourceType = "document" | "database" | "api" | "website"

export interface KnowledgeSource {
  id: string
  name: string
  type: KnowledgeSourceType
  description: string
  status: "active" | "inactive" | "syncing"
  lastSyncAt?: string
  itemCount?: number
}

// Team types
export type TeamStatus = "active" | "draft" | "inactive"

export interface Team {
  id: string
  name: string
  description: string
  status: TeamStatus
  coordinatorId: string
  agentIds: string[]
  channelIds: string[]
  createdAt: string
  updatedAt: string
}

// Template types
export interface Template {
  id: string
  name: string
  description: string
  version: string
  origin: AgentOrigin
  category: string
  agentCount: number
  teamConfig: Partial<Team>
}

// Channel types
export type ChannelType =
  | "whatsapp"
  | "slack"
  | "email"
  | "api"
  | "teams"
  | "discord"
  | "gchat"
  | "telegram"
  | "github"
  | "linear"
export type ChannelStatus = "connected" | "disconnected" | "pending"

export type ChannelProvider = "native" | "chat_sdk"

export interface Channel {
  id: string
  type: ChannelType
  /** native = integração própria; chat_sdk = entrada via Chat SDK (Slack, etc.) */
  provider?: ChannelProvider
  /** Ex.: slack quando provider é chat_sdk */
  platform?: string
  name: string
  status: ChannelStatus
  teamId?: string
  config?: Record<string, unknown>
  /** Segredos mascarados quando existem no backend */
  secretsMasked?: Record<string, string>
  /** URL pública do webhook (Chat SDK) */
  webhookUrl?: string
}

// Workspace types
export interface Workspace {
  id: string
  name: string
  logo?: string
  plan: "free" | "pro" | "enterprise"
}

// User types
export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  workspaceIds: string[]
  /** Admin global: cria workspaces e convida em qualquer tenant */
  isPlatformAdmin?: boolean
}

// Graph Node types for React Flow
export type GraphNodeType = "coordinator" | "specialist" | "channel" | "knowledge"

export interface GraphNodeIndicators {
  hasMcp: boolean
  hasKnowledge: boolean
  hasChannels: boolean
}

export interface GraphNode {
  id: string
  type: GraphNodeType
  data: {
    label: string
    agentId?: string
    channelId?: string
    description?: string
    category?: string
    role?: AgentRole
    indicators?: GraphNodeIndicators
  }
  position: { x: number; y: number }
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  type?: string
  animated?: boolean
}

// Dashboard metrics
export interface DashboardMetrics {
  activeTeams: number
  availableAgents: number
  connectedChannels: number
  templates: number
}

// Wizard step types
export interface TeamWizardData {
  name: string
  description: string
  objective: string
  primaryChannel: ChannelType | null
  coordinatorId: string | null
  specialistIds: string[]
  /** IDs de canais do workspace (GET /channels) a associar ao time em channelIds */
  channelIds: string[]
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// Available tools for agents
export const availableTools = [
  { id: "web_search", name: "Busca na Web", description: "Buscar informacoes na internet" },
  { id: "file_search", name: "Busca em Arquivos", description: "Buscar em documentos e arquivos" },
  { id: "internal_actions", name: "Acoes Internas", description: "Executar acoes no sistema interno" },
  { id: "code_execution", name: "Execucao de Codigo", description: "Executar codigo Python/JS" },
  { id: "email_send", name: "Enviar Email", description: "Enviar emails automaticamente" },
  { id: "calendar_access", name: "Acesso ao Calendario", description: "Ler e criar eventos" },
  { id: "crm_access", name: "Acesso ao CRM", description: "Consultar e atualizar CRM" },
  { id: "database_query", name: "Consulta ao Banco", description: "Executar queries SQL" },
] as const
