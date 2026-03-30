import type {
  IExecutableAgentConfig,
  IMcpToolSpec,
  IWorkspaceCustomToolDefinition,
} from '../ports/agent-runtime.provider.js';
import type { IToolIntegrationContext } from '../../../shared/kernel/tool-integration.types.js';

/** Monta o DTO de runtime a partir de partes ja carregadas (agente + knowledge + bindings). */
export function composeExecutableAgentConfig(parts: {
  agentId: string;
  workspaceId: string;
  systemInstruction?: string;
  tools: string[];
  mcpBindingIds: string[];
  knowledgeSourceIds: string[];
  mcpToolSpecs: IMcpToolSpec[];
  toolIntegrationContext?: IToolIntegrationContext;
  customToolDefinitions?: IWorkspaceCustomToolDefinition[];
}): IExecutableAgentConfig {
  return { ...parts };
}
