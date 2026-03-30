/**
 * Configuracao executavel agregada para o runtime de agentes (Fase 15).
 * Composicao a partir de Agent + config + bindings + knowledge.
 */
export interface IExecutableAgentConfig {
  agentId: string;
  workspaceId: string;
  systemInstruction?: string;
  tools: string[];
  mcpBindingIds: string[];
  knowledgeSourceIds: string[];
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
