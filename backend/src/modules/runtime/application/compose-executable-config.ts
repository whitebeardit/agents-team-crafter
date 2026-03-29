import type { IExecutableAgentConfig } from '../ports/agent-runtime.provider.js';

/** Monta o DTO de runtime a partir de partes ja carregadas (agente + knowledge + bindings + handoff). */
export function composeExecutableAgentConfig(parts: {
  agentId: string;
  workspaceId: string;
  systemInstruction?: string;
  tools: string[];
  mcpBindingIds: string[];
  knowledgeSourceIds: string[];
  handoffTargets: string[];
}): IExecutableAgentConfig {
  return { ...parts };
}
