/** Versão do formato de export (agente e time alinham a mesma string). */
export const AGENT_EXPORT_VERSION = '2';

function buildAgentExportSections(agent: Record<string, unknown>) {
  return {
    mission: {
      goal: agent['goal'],
      responsibilities: agent['responsibilities'],
    },
    system: {
      systemInstruction: agent['systemInstruction'],
      systemRole: agent['systemRole'],
      openaiRuntimeModel: agent['openaiRuntimeModel'],
    },
    domainProfile: agent['domain'],
    quality: {
      qualityCriteria: agent['qualityCriteria'],
      reuseHints: agent['reuseHints'],
    },
    runtime: {
      capabilities: agent['capabilities'],
      knowledge: agent['knowledge'],
      channelConfig: agent['channelConfig'],
      security: agent['security'],
    },
  };
}

export function buildAgentExportPayload(agent: Record<string, unknown>, mcpBindings: unknown[]) {
  return {
    exportVersion: AGENT_EXPORT_VERSION,
    exportKind: 'agent' as const,
    exportedAt: new Date().toISOString(),
    agent,
    mcpBindings,
    sections: buildAgentExportSections(agent),
  };
}

export type TAgentExportPayload = ReturnType<typeof buildAgentExportPayload>;
