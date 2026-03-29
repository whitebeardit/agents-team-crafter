/**
 * Configuracao executavel agregada para o runtime de agentes (Fase 15).
 * Composicao a partir de Agent + config + bindings + knowledge + handoff.
 */
export interface IExecutableAgentConfig {
  agentId: string;
  workspaceId: string;
  systemInstruction?: string;
  tools: string[];
  mcpBindingIds: string[];
  knowledgeSourceIds: string[];
  handoffTargets: string[];
}

export type TRuntimeEvent =
  | { type: 'taskType'; value: string }
  | { type: 'toolResult'; tool: string; status: 'success' | 'error'; errorCode?: string }
  | { type: 'handoff'; fromAgentId: string; toAgentId: string; reason: string };

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

export interface IAgentRuntimeProvider {
  /** Prepara ou valida a configuracao para execucao (stub pode retornar eco). */
  compile(config: IExecutableAgentConfig): Promise<{ ok: boolean; detail?: string }>;

  /** Executa uma etapa de linguagem+tools para um agente especifico (sem handoff automatico). */
  runStep(config: IExecutableAgentConfig, input: IAgentRunInput): Promise<IAgentRunResult>;
}
