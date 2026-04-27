export type TNormalizedAgentCapabilities = {
  tools: string[];
  platformBuiltInTools: string[];
  openaiBuiltInTools: string[];
  customToolDefinitionIds: string[];
};

function asUniqueStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string'))];
}

export function normalizeAgentCapabilities(raw: unknown): TNormalizedAgentCapabilities {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    tools: asUniqueStringArray(source['tools']),
    platformBuiltInTools: asUniqueStringArray(source['platformBuiltInTools']),
    openaiBuiltInTools: asUniqueStringArray(source['openaiBuiltInTools']),
    customToolDefinitionIds: asUniqueStringArray(source['customToolDefinitionIds']),
  };
}
