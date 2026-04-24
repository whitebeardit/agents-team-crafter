/**
 * Catálogo fechado de modelos de chat OpenAI permitidos em workspace / agentes.
 * IDs = strings da API OpenAI.
 */
export enum EOpenAiWorkspaceChatModel {
  Gpt54 = 'gpt-5.4',
  Gpt54Mini = 'gpt-5.4-mini',
  Gpt41 = 'gpt-4.1',
  Gpt41Mini = 'gpt-4.1-mini',
  Gpt4o = 'gpt-4o',
  Gpt4oMini = 'gpt-4o-mini',
}

export const OPENAI_WORKSPACE_CHAT_MODEL_VALUES = Object.values(
  EOpenAiWorkspaceChatModel,
) as EOpenAiWorkspaceChatModel[];

export const DEFAULT_TEAM_PLANNER_MODEL = EOpenAiWorkspaceChatModel.Gpt54;

export const DEFAULT_AGENTS_RUNTIME_MODEL = EOpenAiWorkspaceChatModel.Gpt54Mini;

const MODEL_SET = new Set<string>(OPENAI_WORKSPACE_CHAT_MODEL_VALUES);

export function parseOpenAiWorkspaceChatModel(
  raw: string | undefined | null,
): EOpenAiWorkspaceChatModel | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  return MODEL_SET.has(t) ? (t as EOpenAiWorkspaceChatModel) : undefined;
}

export function effectiveEnabledChatModels(
  enabled: EOpenAiWorkspaceChatModel[] | undefined | null,
): EOpenAiWorkspaceChatModel[] {
  if (!enabled?.length) return [...OPENAI_WORKSPACE_CHAT_MODEL_VALUES];
  const uniq = [...new Set(enabled)];
  return uniq.filter((m) => MODEL_SET.has(m));
}

export function availableWorkspaceChatModels(
  enabled: EOpenAiWorkspaceChatModel[] | undefined | null,
): EOpenAiWorkspaceChatModel[] {
  return effectiveEnabledChatModels(enabled);
}

/**
 * Escolhe o primeiro valor da cadeia presente no conjunto permitido;
 * senão o default de produto se permitido; senão o primeiro modelo permitido.
 */
export function pickResolvedWorkspaceChatModel(params: {
  preferenceChain: Array<EOpenAiWorkspaceChatModel | undefined>;
  enabled: EOpenAiWorkspaceChatModel[] | undefined | null;
  productDefault: EOpenAiWorkspaceChatModel;
}): EOpenAiWorkspaceChatModel {
  const allowed = effectiveEnabledChatModels(params.enabled);
  for (const c of params.preferenceChain) {
    if (c !== undefined && allowed.includes(c)) return c;
  }
  if (allowed.includes(params.productDefault)) return params.productDefault;
  return allowed[0]!;
}

export function parseAgentsRuntimeModelFromEnv(): EOpenAiWorkspaceChatModel | undefined {
  return parseOpenAiWorkspaceChatModel(process.env.OPENAI_AGENTS_RUNTIME_MODEL);
}

export function parseTeamPlannerModelFromEnv(): EOpenAiWorkspaceChatModel | undefined {
  return parseOpenAiWorkspaceChatModel(process.env.OPENAI_TEAM_PLAN_MODEL);
}

/** Heurística: família GPT-5.x no Agents SDK beneficia de modelSettings explícitos. */
export function isGpt5FamilyModel(modelId: string): boolean {
  return modelId.startsWith('gpt-5');
}
