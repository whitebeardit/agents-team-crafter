import type {
  IExecutableAgentConfig,
  IMcpToolSpec,
  IWorkspaceCustomToolDefinition,
} from '../ports/agent-runtime.provider.js';
import type { IToolIntegrationContext } from '../../../shared/kernel/tool-integration.types.js';
import type { IBusinessToolRuntime } from '../../business-tools/application/business-tool-runtime.js';

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
  businessToolRuntime?: IBusinessToolRuntime;
  teamContext?: { teamId: string; teamName: string };
}): IExecutableAgentConfig {
  return { ...parts };
}
