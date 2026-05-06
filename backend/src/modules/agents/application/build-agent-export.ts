import { normalizeAgentCapabilities } from './agent-capabilities.js';

/** Versão do formato de export (agente e time alinham a mesma string). */
export const AGENT_EXPORT_VERSION = '2';

export function buildAgentRuntimeSnapshot(agent: Record<string, unknown>, mcpBindings: unknown[]) {
  return {
    openaiRuntimeModel: agent['openaiRuntimeModel'],
    imageGenerationModel: agent['imageGenerationModel'],
    capabilities: normalizeAgentCapabilities(agent['capabilities']),
    knowledge: agent['knowledge'],
    channelConfig: agent['channelConfig'],
    security: agent['security'],
    mcpBindings,
  };
}

function buildAgentExportSections(agent: Record<string, unknown>, runtime: ReturnType<typeof buildAgentRuntimeSnapshot>) {
  return {
    mission: {
      goal: agent['goal'],
      responsibilities: agent['responsibilities'],
    },
    system: {
      systemInstruction: agent['systemInstruction'],
      systemRole: agent['systemRole'],
      openaiRuntimeModel: agent['openaiRuntimeModel'],
      imageGenerationModel: agent['imageGenerationModel'],
    },
    domainProfile: agent['domain'],
    quality: {
      qualityCriteria: agent['qualityCriteria'],
      reuseHints: agent['reuseHints'],
    },
    runtime,
  };
}

export function buildAgentExportPayload(agent: Record<string, unknown>, mcpBindings: unknown[]) {
  const runtime = buildAgentRuntimeSnapshot(agent, mcpBindings);
  return {
    exportVersion: AGENT_EXPORT_VERSION,
    exportKind: 'agent' as const,
    exportedAt: new Date().toISOString(),
    agent: {
      ...agent,
      capabilities: runtime.capabilities,
      knowledge: runtime.knowledge,
      security: runtime.security,
      channelConfig: runtime.channelConfig,
    },
    mcpBindings,
    sections: buildAgentExportSections(agent, runtime),
  };
}

export type TAgentExportPayload = ReturnType<typeof buildAgentExportPayload>;
