import type { IToolIntegrationContext } from '../../../shared/kernel/tool-integration.types.js';

/**
 * Configuracao executavel agregada para o runtime de agentes (Fase 15).
 * Composicao a partir de Agent + config + bindings + knowledge.
 */
export interface IMcpToolSpec {
  bindingId: string;
  mcpConnectionId: string;
  mcpDisplayName: string;
  toolName: string;
  toolDescription: string;
  requiresApproval: boolean;
  /** Se definido no McpConnection.config, chama HTTP em vez de stub. */
  mcpHttpEndpoint?: string;
  mcpHttpHeaders?: Record<string, string>;
}

export interface IWorkspaceCustomToolDefinition {
  id: string;
  name: string;
  slug: string;
  kind: 'builtin_ref' | 'http_webhook' | 'mcp_ref';
  jsonSchema: Record<string, unknown>;
  config: Record<string, unknown>;
}

export interface IExecutableAgentConfig {
  agentId: string;
  workspaceId: string;
  systemInstruction?: string;
  tools: string[];
  /** @deprecated Prefer mcpToolSpecs; kept for logging/back compat */
  mcpBindingIds: string[];
  knowledgeSourceIds: string[];
  mcpToolSpecs: IMcpToolSpec[];
  /** Integracoes cifradas (tools catalog database/crm/calendar). */
  toolIntegrationContext?: IToolIntegrationContext;
  /** Definicoes dinamicas do workspace (webhook, etc.). */
  customToolDefinitions?: IWorkspaceCustomToolDefinition[];
}

export type TRuntimeEvent =
  | { type: 'taskType'; value: string }
  | { type: 'toolResult'; tool: string; status: 'success' | 'error'; errorCode?: string };

export interface IAgentRunInput {
  message: string;
  channel?: string;
  locale?: string;
  requestedAccessLevel?: 'read' | 'write' | 'restricted';
  taskType?: string;
  /** BYOK por workspace; se omitido, o provider pode usar OPENAI_API_KEY do ambiente (demo). */
  openaiApiKey?: string;
  /** Estado para manter determinismo (PolicyEngine), não para o LLM decidir. */
  depth?: number;
  visitedAgentIds?: string[];
  correlationId?: string;
}

export interface IAgentRunResult {
  finalOutput: string;
  events: TRuntimeEvent[];
}

/** Opaque SDK tool references (e.g. OpenAI Agents function tools for specialists). */
export type TCoordinatorSdkTool = unknown;

export interface ICoordinatorRunParams {
  coordinatorAgentId: string;
  workspaceId: string;
  systemInstruction?: string;
  userMessage: string;
  openaiApiKey?: string;
  sdkTools: readonly TCoordinatorSdkTool[];
}

export interface IAgentRuntimeProvider {
  /** Prepara ou valida a configuracao para execucao (stub pode retornar eco). */
  compile(config: IExecutableAgentConfig): Promise<{ ok: boolean; detail?: string }>;

  /** Executa uma etapa de linguagem+tools para um agente especifico. */
  runStep(config: IExecutableAgentConfig, input: IAgentRunInput): Promise<IAgentRunResult>;

  /**
   * Single coordinator agent with specialist tools only (no handoff chain).
   * Specialists are invoked via sdkTools, not as separate top-level agents.
   */
  runCoordinatorTurn(params: ICoordinatorRunParams): Promise<IAgentRunResult>;
}
