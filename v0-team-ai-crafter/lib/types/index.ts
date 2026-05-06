// Agent types
export type AgentRole = "coordinator" | "specialist"
export type AgentOrigin = "whitebeard" | "company"
export type AgentStatus = "draft" | "active" | "archived"
export type AccessLevel = "read" | "write" | "restricted"
export type AgentSystemRole = "team-crafter" | "agent-crafter" | "domain-guard" | null

export interface AgentCapabilities {
  tools: string[]
  platformBuiltInTools?: string[]
  openaiBuiltInTools?: string[]
  mcpBindings: string[]
  customToolDefinitionIds?: string[]
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

export interface AgentDomainProfile {
  summary?: string
  keywords?: string[]
  inputDescription?: string
  outputDescription?: string
  boundaries?: string[]
  exclusions?: string[]
}

/** Body de `POST /api/v1/teams/:id/run` */
export interface TeamRunRequest {
  message: string
  channel?: string
  locale?: string
  requestedAccessLevel?: AccessLevel
  taskType?: string
  /** Memória de conversa no console de debug (histórico no servidor). */
  conversationId?: string
}

export interface TeamRunExternalImageAttachment {
  type: "image"
  url: string
}

export interface TeamRunExternalResponse {
  text: string
  format?: "plain" | "markdown"
  attachments?: TeamRunExternalImageAttachment[]
}

export interface TeamRunSpecialistResult {
  specialistAgentId: string
  summary: string
  structured?: Record<string, unknown>
}

/** Evento na timeline de `POST /teams/:id/run` (coordenador, tools, especialistas). */
export interface TeamRunExecutionEvent {
  type: string
  value?: string
  tool?: string
  status?: string
  errorCode?: string
  agentId?: string
  phase?: string
  detail?: string
  /** Texto completo do argumento `instruction` da tool (coordenador). */
  toolInstruction?: string
  /** Mensagem efetiva enviada ao especialista em `runStep` (após merge com a mensagem do utilizador). */
  runtimeMessage?: string
  interrupted?: boolean
  interruptReasonCode?:
    | "MAX_TURNS_REACHED"
    | "NO_PROGRESS_DETECTED"
    | "MISSING_REQUIRED_FIELDS_REPEATED"
    | "EMPTY_SUBMITTED_INPUT_REPEATED"
    | "AMBIGUOUS_ROUTING"
    | "MISSING_REQUIRED_BINDING"
    | "EXECUTION_ABORTED_BY_POLICY"
    | "USER_CANCELLED"
  interruptReasonMessage?: string
  interruptStep?: string
  interruptTool?: string
  interruptPolicy?: string
  progressState?: string
  nextStep?: string
  /** Dica de retomada quando o run é cancelado (alinhado ao backend quando existir). */
  resumeHint?: string
}

/** Item de `GET /teams/:id/debug-sessions` (Loop 91). */
export interface TeamDebugSessionSummary {
  conversationId: string
  updatedAt: string
  turnCount: number
  shortTitle?: string
  shortTitleSlug?: string
}

/** Turno com instante — `GET /teams/:id/debug-sessions/:conversationId`. */
export interface TeamDebugSessionTurn {
  role: "user" | "assistant"
  content: string
  at: string
  format?: "plain" | "markdown"
  attachments?: TeamRunExternalImageAttachment[]
}

/** SSE `agentStatus` durante `POST /teams/:id/run/stream` e `GET /teams/:id/live`. */
export interface TeamRunProgressEvent {
  runId: string
  agentId: string
  status: "idle" | "busy"
  phase: string
  detail?: string
}

/** Estado efémero por agente para o grafo em modo live. */
export interface TeamGraphLiveAgentState {
  status: "idle" | "busy"
  phase: string
  lastActivity: string
}

export type TeamConversationActor = "user" | "coordinator" | "specialist" | "system" | "tool"
export type TeamConversationKind =
  | "input"
  | "output"
  | "thinking"
  | "activity"
  | "tool_call"
  | "tool_result"
  | "handoff"
  | "status"
  | "error"
  | "memory"

export interface TeamConversationTimelineItem {
  id: string
  workspaceId: string
  teamId: string
  runId: string
  seq: number
  timestamp: string
  actor: TeamConversationActor
  actorId?: string
  kind: TeamConversationKind
  content: string
  meta?: Record<string, unknown>
  correlation?: { spanId?: string; parentSpanId?: string }
}

export interface TeamGraphLiveAgentConversationState extends TeamGraphLiveAgentState {
  recentItems: TeamConversationTimelineItem[]
  latestInput?: string
  latestThinking?: string
  latestOutput?: string
}

/** Payload SSE `coordinatorDelta` em `POST /teams/:id/run/stream` e `GET /teams/:id/live`. */
export interface TeamCoordinatorDeltaPayload {
  text: string
  runId?: string
  /** Presente no GET live (merge a partir do envelope); no POST stream manual também. */
  source?: "inbound" | "manual"
}

/** Dados em `data` de `POST /api/v1/teams/:id/run` */
export interface TeamRunResponse {
  runId: string
  teamId: string
  coordinatorAgentId: string
  externalResponse: TeamRunExternalResponse
  specialistResults: TeamRunSpecialistResult[]
  events: TeamRunExecutionEvent[]
  /** Presente em `GET /teams/:id/live` (`runComplete`) para distinguir inbound vs consola. */
  source?: "inbound" | "manual"
}

/** Evento SSE `inboundUserMessage` em `GET /teams/:id/live` (Chat SDK inbound). */
export interface TeamLiveInboundUserMessage {
  channel: string
  text: string
  teamId: string
  channelId: string
  workspaceId: string
}

/** Linhas espelhadas no TeamDebugConsole a partir do live SSE. */
export interface TeamDebugLiveMirrorLine {
  role: "user" | "assistant"
  content: string
  /** ex.: Telegram, slack */
  sourceLabel?: string
  format?: TeamRunExternalResponse["format"]
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
  domain?: AgentDomainProfile
  qualityCriteria?: string[]
  reuseHints?: string[]
  platformManaged?: boolean
  systemRole?: AgentSystemRole
  systemInstruction?: string
  /** Override do modelo OpenAI (runtime); omitido = usar default do workspace / produto. */
  openaiRuntimeModel?: string
  /** Override do modelo de geração de imagem; omitido = usar default do workspace / produto. */
  imageGenerationModel?: string

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
  singleAgentMode?: boolean
  createdAt: string
  updatedAt: string
}

export type AgentMCPBindingWithConnection = AgentMCPBinding & {
  mcpConnection?: { id: string; name: string; status: string }
}

/** Resposta de `GET /agents/:id/export` (campo `data` do envelope). */
export interface AgentExportPayload {
  exportVersion: string
  exportKind: "agent"
  exportedAt: string
  agent: Agent
  mcpBindings: AgentMCPBindingWithConnection[]
  sections: {
    mission: { goal?: string; responsibilities?: string[] }
    system: { systemInstruction?: string; systemRole?: AgentSystemRole; openaiRuntimeModel?: string }
    domainProfile?: AgentDomainProfile
    quality: { qualityCriteria?: string[]; reuseHints?: string[] }
    runtime: {
      capabilities?: AgentCapabilities
      knowledge?: AgentKnowledge
      channelConfig?: AgentChannelConfig
      security?: AgentSecurity
    }
  }
}

/** Linha de canal no export de time (subset estável do backend). */
export interface TeamExportChannelRow {
  id: string
  type: string
  name: string
  status: string
}

/** Canal completo no export v2 (alinhado a `channelIds` do time). */
export interface TeamExportChannelFullSnapshot {
  legacyId: string
  type: string
  name: string
  status: string
  provider: "native" | "chat_sdk"
  platform?: string
  config: Record<string, unknown>
  secretsEncrypted?: {
    algorithm: string
    keyVersion: number
    iv: string
    ciphertext: string
    authTag: string
  }
  metrics?: Record<string, unknown>
  connectedAt?: string
  disconnectedAt?: string
  secretRequired?: boolean
}

export type TemplateCredentialSlot = {
  legacyId: string
  name: string
  type: string
  provider: "native" | "chat_sdk"
  platform?: string
}

/** Resposta de `GET /teams/:id/export` (campo `data` do envelope). */
export interface TeamExportPayload {
  exportVersion: string
  exportKind: "team"
  exportedAt: string
  team: Team & { objective?: string; primaryChannel?: string }
  graph: { nodes: unknown[]; edges: unknown[] }
  channels: TeamExportChannelRow[]
  /** Presente a partir do export v2. */
  channelsFull?: TeamExportChannelFullSnapshot[]
  agents: AgentExportPayload[]
}

/** `GET /teams/:id/template-export` — sem credenciais; partilhável. */
export interface TeamTemplateExportPayload extends Omit<TeamExportPayload, "exportKind"> {
  exportKind: "template"
  templateSourceTeamId?: string
}

/** Resposta de `POST /teams/import` e `PUT /teams/:id/import` (campo `data` do envelope). */
export interface TeamImportResult {
  teamId: string
  oldToNewAgentIds: Record<string, string>
  oldToNewChannelIds: Record<string, string>
  warnings: string[]
}

/** Resposta de `GET /api/v1/teams/:id/readiness` (preflight operacional, Loop 88). */
export type TeamReadinessLevel = "ready" | "attention" | "blocked"
export type TeamReadinessItemSeverity = "blocked" | "attention" | "info"

export interface TeamReadinessItem {
  code: string
  severity: TeamReadinessItemSeverity
  title: string
  detail: string
  nextStep: string
  routeHint?: string
  /** Rótulo do botão de acção directa (Loop 92). */
  ctaLabel?: string
}

export interface TeamReadinessResult {
  level: TeamReadinessLevel
  headline: string
  items: TeamReadinessItem[]
  checkedAt: string
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
  hasFullPayload?: boolean
  templateScope?: "workspace" | "global"
  teamConfig: Partial<Team>
  /** Vertical de negocio (ex.: saude, atendimento) quando curado no seed */
  vertical?: string
  /** Requisitos mostrados antes de aplicar */
  prerequisites?: string[]
  /** O que o backend faz ao aplicar (comportamento real, nao marketing) */
  applyBehavior?: string
  /** Passos sugeridos para validar o time após aplicar (Loop 94) */
  validationSteps?: string[]
  /** Mensagens de exemplo para o console ou canal */
  goldenPrompts?: string[]
  /** Comportamento esperado num cenário feliz */
  expectedOutcome?: string
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
/** Preferências de notificação (persistidas em `user.preferences.notifications`) */
export interface IUserNotificationPreferences {
  email?: boolean
  slack?: boolean
  discord?: boolean
  alertsEnabled?: boolean
  weeklyReport?: boolean
}

/** Tours contextuais por ecrã (Loop 67) — ver `lib/contextual-tours.ts` */
export interface IContextualToursPreferences {
  byWorkspace?: Record<string, Record<string, number>>
}

/** Preferências persistidas em `PUT /settings/profile` (`preferences` no utilizador) */
export interface IUserPreferences {
  locale?: "pt-BR" | "en-US" | "es"
  theme?: "light" | "dark" | "system"
  bio?: string
  notifications?: IUserNotificationPreferences
  /** Versões vistas por workspace e ecrã (`screenKey` → versão) */
  contextualTours?: IContextualToursPreferences
}

export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  preferences?: IUserPreferences & Record<string, unknown>
  workspaceIds: string[]
  /** Admin global: cria workspaces e convida em qualquer tenant */
  isPlatformAdmin?: boolean
  /** De `GET /auth/me`: existe refresh token no servidor para este utilizador */
  session?: { hasRefreshToken?: boolean }
}

/** `GET /platform/danger-zone/status` — admin global */
export interface IPlatformDangerZoneStatus {
  factoryResetAvailable: boolean
  blockedReason: string | null
  requiresProductionSafetyPhrase: boolean
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

export interface TeamPlanAgentDraft {
  name: string
  role: AgentRole
  description: string
  objective: string
  responsibilities: string[]
  skills: string[]
  category: string
  channels: ChannelType[]
  /** Builtins do catálogo OpenAI Agents SDK por agente (Loop 64). */
  catalogTools?: string[]
  /** Loop 82 — domínio de workflow (único entre especialistas no plano). */
  workflowKey?: string
  /** Loop 82 — actionIds de negócio atribuídos a este agente. */
  requiredBusinessActionIds?: string[]
  /** Loop 82 — pack ids atribuídos a este agente. */
  requiredPackIds?: string[]
  planningMode?: "existing" | "new" | "split_required" | "conflict"
  existingAgentId?: string | null
  overlapScore?: number
  overlapReason?: string
}

/** Metadados do planner (POST /team-plans); espelha backend `plannerMeta`. */
export interface TeamPlanPlannerMeta {
  usedOpenAi?: boolean
  usedFallback?: boolean
  fallbackReason?:
    | "no_openai_key"
    | "openai_request_failed"
    | "json_extract_failed"
    | "schema_validation_failed"
    | string
  openaiResolvedFromEnv?: boolean
  /** Modelo OpenAI usado na ultima geracao/reparo do planner. */
  plannerModel?: string
  parseErrorSummary?: string
  briefingSufficiency?: {
    status: "sufficient" | "partial" | "insufficient"
    score: number
    answeredSignals: number
    expectedSignals: number
    missingSignals: string[]
  }
  integrityModel?: {
    status: "defined" | "incomplete"
    masterEntities: Array<{ domain: string; entity: string; naturalKey: string }>
    linkRules: string[]
    deduplicationRules: string[]
    missingSignals: string[]
  }
}

/** Meta do envelope em `POST /team-plans/:id/execute` e evento SSE `complete`. */
export interface TeamPlanExecuteMeta {
  autoBindEnabled?: boolean
  effectiveBindEnabled?: boolean
  autoBindMode?: "inherit" | "enabled" | "disabled"
  autoBindPolicySource?: "workspace_enabled" | "workspace_disabled" | "environment_default"
  reusedAgentBindMode?: "manual" | "merge"
  boundToolDefinitionIds?: string[]
  /** Definitions que estavam `enabled: false` e foram reativadas durante o execute (Loop 51). */
  reactivatedToolDefinitionIds?: string[]
  /** Quantidade de actionIds pedidos pelo planner (antes do cap). */
  autoBindActionsRequested?: number
  /** Quantidade considerada para bind (0 se política desligada). */
  autoBindActionsApplied?: number
  /** `true` se a lista excedeu o teto do servidor (64). */
  autoBindActionsTruncated?: boolean
  bindOverridesApplied?: boolean
  bindOverrideAgentCount?: number
  bindOverrideActionCount?: number
  bindDiffSummary?: TeamPlanBindDiffSummary
  reusedAgentsUpdated?: number
  reusedAgentsSkipped?: number
  requiredPacks?: string[]
  requiredTools?: string[]
  governanceWarning?: unknown
}

export interface TeamPlanBindOverrideEntry {
  mode: "inherit" | "enabled" | "disabled"
  excludedActionIds: string[]
}

export interface TeamPlanBindOverrides {
  agents: Record<string, TeamPlanBindOverrideEntry>
}

export interface TeamPlanBindPreviewDefinition {
  actionId: string
  slug: string
  packIds: string[]
  toolDefinitionId?: string
  enabled?: boolean
  currentStatus: "missing" | "existing_enabled" | "existing_disabled"
  plannedOperation: "create" | "reuse" | "reactivate" | "none"
}

export interface TeamPlanBindPreviewAgent {
  planAgentKey: string
  agentName: string
  role: AgentRole
  planningMode: "existing" | "new" | "split_required" | "conflict"
  targetAgentId?: string
  targetAgentName?: string
  defaultBindMode: "new_agent" | "reused_merge" | "reused_manual" | "auto_bind_disabled"
  bindMode: "new_agent" | "reused_merge" | "reused_manual" | "auto_bind_disabled"
  overrideMode: "inherit" | "enabled" | "disabled"
  effectiveBindEnabled: boolean
  actionIdsCandidate: string[]
  defaultActionIdsToLink: string[]
  actionIdsToLink: string[]
  actionIdsAlreadyLinked: string[]
  actionIdsBlockedByDisabledDefinitions: string[]
  actionIdsExcludedByOverride: string[]
  actionIdsAddedByOverride: string[]
  actionIdsRemovedByOverride: string[]
}

export interface TeamPlanBindPreviewPack {
  packId: string
  actionIds: string[]
  defaultSelectedActionIds: string[]
  selectedActionIds: string[]
  actionIdsAddedByOverride: string[]
  actionIdsRemovedByOverride: string[]
}

export interface TeamPlanBindDiffSummary {
  affectedAgentCount: number
  addedActionCount: number
  removedActionCount: number
}

export interface TeamPlanBindPreview {
  autoBindEnabled: boolean
  effectiveBindEnabled: boolean
  autoBindMode: "inherit" | "enabled" | "disabled"
  autoBindPolicySource: "workspace_enabled" | "workspace_disabled" | "environment_default"
  reusedAgentBindMode: "manual" | "merge"
  autoBindActionsRequested: number
  autoBindActionsApplied: number
  autoBindActionsTruncated: boolean
  bindOverridesApplied: boolean
  bindOverrideAgentCount: number
  bindOverrideActionCount: number
  requiresExplicitApproval: boolean
  /** Loop 83 — candidatos por agente quando o plano tem listas por agente. */
  bindResolutionMode?: "global" | "per_agent"
  toolDefinitions: TeamPlanBindPreviewDefinition[]
  suggestedPacks: TeamPlanBindPreviewPack[]
  diffSummary: TeamPlanBindDiffSummary
  agents: TeamPlanBindPreviewAgent[]
}

export interface TeamPlanDraft {
  id: string
  problem: string
  context?: string
  briefing?: TeamPlanStructuredBriefing | null
  status: "draft" | "ready" | "executing" | "executed" | "failed"
  team: {
    name: string
    objective: string
    description: string
    primaryChannel?: ChannelType
    channelIds: string[]
    singleAgentMode?: boolean
  }
  agents: TeamPlanAgentDraft[]
  graph: { nodes: GraphNode[]; edges: GraphEdge[] }
  executionChecklist: string[]
  /** Packs de negócio sugeridos pelo planner (Loop 26+). */
  requiredPacks?: string[]
  /** actionIds de business tools sugeridos (Loop 26+). */
  requiredTools?: string[]
  bindOverrides?: TeamPlanBindOverrides
  plannerMeta?: TeamPlanPlannerMeta
  reuseSummary?: {
    reuseRecommendations?: string[]
    conflicts?: Array<{ agentName: string; existingAgentId?: string; reason: string }>
    existingAgentRefs?: Array<string | null>
    proposedNewAgents?: string[]
  }
  result?: {
    teamId: string
    coordinatorId: string
    specialistIds: string[]
    activatedAt: string
  } | null
}

export interface TeamPlanStructuredBriefing {
  problemSummary?: string
  businessType?: string
  operationalUnit?: string
  businessGoal?: string
  coreJourney?: string
  primaryDomain?: string
  secondaryDomains?: string[]
  domainsNeeded?: string[]
  mainEntities?: string[]
  sharedEntities?: string[]
  primaryChannel?: string
  operationKinds?: string[]
  constraints?: string[]
  mustHaveCapabilities?: string[]
  mustAvoid?: string[]
  crossDomainIntegrityNeeds?: string[]
}

export interface AgentOverlapMatch {
  agentId: string
  agentName: string
  agentRole: AgentRole
  score: number
  classification: "safe" | "warning" | "conflict"
  reason: string
  recommendation: "safe_to_create" | "refine_scope" | "reuse_existing"
}

export interface AgentOverlapReview {
  id?: string
  workspaceId?: string
  draftAgent: Partial<Agent> & { name: string; role: AgentRole }
  matches: AgentOverlapMatch[]
  decision: "allow" | "review" | "block" | "reuse_existing"
  summary: string
  createdAt?: string
  updatedAt?: string
}

export interface AgentPlanDraft {
  id: string
  status: "draft" | "ready" | "executing" | "executed" | "blocked" | "failed"
  request: {
    objective: string
    context?: string
    expectedOutcome?: string
    role?: AgentRole
    category?: string
    skills?: string[]
    boundaries?: string[]
    exclusions?: string[]
  }
  draftAgent: Partial<Agent> & { name: string; role: AgentRole }
  overlapReview?: AgentOverlapReview | null
  decision: "create_new" | "reuse_existing" | "split_scope" | "blocked"
  notes: string[]
  result?: {
    createdAgentId?: string | null
    createdAgentName?: string | null
    reusedAgentId?: string | null
    reusedAgentName?: string | null
  } | null
  createdAt: string
  updatedAt: string
}

export interface RunStepRecord {
  id: string
  runId: string
  stepIndex: number
  stepType: string
  agentId?: string
  toolName?: string
  status: string
  summary: string
  startedAt?: string
  finishedAt?: string
}

export interface TeamRunRecord {
  id: string
  runId: string
  teamId: string
  coordinatorAgentId: string
  trigger: string
  source: "manual" | "inbound" | "planner"
  channel?: string
  status: "running" | "completed" | "failed" | "interrupted" | "cancelled"
  correlationId?: string
  startedAt: string
  finishedAt?: string
  externalResponse?: TeamRunExternalResponse | null
  error?: { code?: string; message?: string; status?: number } | null
  interrupt?: {
    interrupted?: boolean
    interruptReasonCode?: string
    interruptReasonMessage?: string
    interruptReasonDetail?: string
    interruptStep?: string
    interruptTool?: string
    interruptPolicy?: string
    progressState?: string
    nextStep?: string
  } | null
  steps?: RunStepRecord[]
}

export interface RunEventRecord {
  id: string
  runId: string
  seq: number
  type: string
  payload: Record<string, unknown>
  createdAt: string
}

export type GovernanceOverlapMode = "blocking" | "warning"

export interface GovernanceFeatureFlags {
  overlapMode: GovernanceOverlapMode
  agentWizardDefaultPath: boolean
  /** Alertas de auditoria quando a taxa de sucesso fica abaixo do SLO (dedupe diário). */
  sloAlertsEnabled: boolean
  /** POST JSON opcional quando o SLO falha (mesmo instante do evento de auditoria). */
  sloWebhookUrl?: string
}

export type GovernanceAuditEventType =
  | "governance.overlap_review"
  | "governance.agent_blocked"
  | "governance.overlap_warning_allowed"
  | "governance.override_applied"
  | "governance.team_plan_execute"
  | "governance.team_plan_blocked"
  | "governance.agent_plan_execute"
  | "governance.agent_plan_blocked"
  | "governance.slo_breached"
  | "governance.audit_purged"

export interface GovernanceAuditEvent {
  id: string
  workspaceId?: string
  userId?: string
  correlationId?: string
  eventType: GovernanceAuditEventType
  payload: Record<string, unknown>
  createdAt?: string
}

/** `meta` de `GET /governance/audit-events` (paginação). */
export interface GovernanceAuditListMeta {
  page: number
  perPage: number
  total: number
  totalPages: number
}

export interface GovernanceOpsSummary {
  runsFailedTotal: number
  runsCompletedTotal: number
  /** Runs com status `running` neste workspace. */
  runsRunningTotal: number
  /** Runs concluídos com `startedAt` nos últimos 30 dias. */
  runsCompletedLast30d: number
  /** Runs falhos com `startedAt` nos últimos 30 dias. */
  runsFailedLast30d: number
  /** Entre runs terminados (ok+falha) nos últimos 30 dias; `null` se não houver nenhum. */
  runsFailureRateLast30d: number | null
  overlapReviewsBlockedLast30d: number
  /** Contagem de eventos de auditoria criados nos últimos 30 dias. */
  governanceAuditEventsLast30d: number
  recentGovernanceEvents: GovernanceAuditEvent[]
}

/** Série diária UTC de runs terminados (`GET /governance/runs-trend`). */
export interface GovernanceRunsTrendPoint {
  date: string
  completed: number
  failed: number
}

export interface GovernanceRunsTrend {
  kind: "runs"
  days: number
  since: string
  until: string
  series: GovernanceRunsTrendPoint[]
}

/** Série diária UTC de eventos de auditoria (`GET /governance/audit-trend`). */
export interface GovernanceAuditTrendPoint {
  date: string
  count: number
}

export interface GovernanceAuditTrend {
  kind: "audit"
  days: number
  since: string
  until: string
  series: GovernanceAuditTrendPoint[]
}

/** Percentis de duração (startedAt → finishedAt) em runs terminados com `finishedAt`. */
export interface GovernanceLatencyMsPercentiles {
  p50Ms: number | null
  p90Ms: number | null
  p95Ms: number | null
  p99Ms: number | null
  sampleCount: number
}

/** SLO por time: taxa de sucesso entre runs terminados na janela rolante (`GET /governance/team-slos`). */
export interface GovernanceTeamSloRow {
  teamId: string
  teamName: string
  completed: number
  failed: number
  terminalRuns: number
  successRate: number | null
  meetsSlo: boolean | null
  latencyMsPercentiles: GovernanceLatencyMsPercentiles | null
}

export interface GovernanceTeamSlos {
  windowDays: number
  sloTargetPercent: number
  since: string
  /** Agregado do workspace (todos os times na janela). */
  workspaceLatencyMsPercentiles: GovernanceLatencyMsPercentiles | null
  teams: GovernanceTeamSloRow[]
  /** Quantos eventos `governance.slo_breached` foram criados neste pedido (dedupe evita repetição no mesmo dia). */
  sloBreachesEmitted: number
}

/** Tools de catalogo com execucao real vêm de GET /settings/workspace/integrations → operationalCatalogTools */
export type OperationalCatalogTool = {
  id: string
  name: string
  description: string
}

/** Scheduling API (`GET /schedule/agenda`, `GET /schedule/appointments`) — alinhado ao pack `scheduling`. */
export type ScheduleAppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "cancelled"
  | "no_show"
  | "completed"

export interface ScheduleAppointment {
  id: string
  partyId: string
  title: string
  startsAt: string
  endsAt: string
  notes?: string
  status: ScheduleAppointmentStatus | string
  careSubjectId?: string
  serviceOrderId?: string
  packageSaleId?: string
  encounterId?: string
  reminderId?: string
  createdAt?: string
  updatedAt?: string
}

export interface ScheduleAvailabilitySlotDef {
  id: string
  startsAt: string
  endsAt: string
  slotMinutes: number
  label?: string
}

export interface ScheduleAvailabilityWindow {
  slotId: string
  startsAt: string
  endsAt: string
  available: boolean
}

/** Corpo de `GET /schedule/agenda?date=YYYY-MM-DD` */
export interface ScheduleAgendaResponse {
  availability: ScheduleAvailabilityWindow[]
  slots: ScheduleAvailabilitySlotDef[]
  appointments: ScheduleAppointment[]
}

/** Corpo de `GET /schedule/appointments?date=...` */
export interface ScheduleAppointmentsDayResponse {
  appointments: ScheduleAppointment[]
}

/** CRM: contato comercial (`GET /parties`, `GET /parties/:id`). */
export interface CrmParty {
  id: string
  displayName: string
  roles?: string[]
  status?: "active" | "inactive"
  email?: string
  phone?: string
  notes?: string
  createdAt?: string
  updatedAt?: string
}

/** KPIs derivados no BFF a partir das séries `agents_team_crafter_*`. */
export interface TeamPlanMetricsKpis {
  teamPlanExecute: {
    total: number
    byOutcome: { success: number; error: number; idempotent: number }
  }
  autoBindTruncations: {
    total: number
    whenAutoBindOn: number
    whenAutoBindOff: number
  }
  executeDuration: {
    observationCount: number
    sumSeconds: number
    avgSeconds: number | null
  }
  autoBindActions: {
    requested: { observationCount: number; sum: number; avg: number | null }
    applied: { observationCount: number; sum: number; avg: number | null }
  }
}

/** `GET /observability/metrics-summary` — métricas `agents_team_crafter_*` (Prometheus JSON) + `kpis`. */
export interface ObservabilityMetricsSummary {
  collectedAt: string
  kpis: TeamPlanMetricsKpis
  metrics: Array<{
    name: string
    help?: string
    type?: string
    values?: unknown[]
  }>
}
