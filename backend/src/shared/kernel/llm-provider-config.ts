/**
 * Configuração central de provedor LLM.
 * Desacopla o resto do produto de detalhes específicos da OpenAI ou OpenRouter.
 */

export type TLlmProvider = 'openai' | 'openrouter';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const OPENAI_BASE_URL = 'https://api.openai.com/v1';

export interface ILlmProviderConfig {
  provider: TLlmProvider;
  apiKey: string;
  baseUrl: string;
  /** Headers adicionais exigidos pelo provider (e.g. HTTP-Referer para OpenRouter). */
  extraHeaders?: Record<string, string>;
  /**
   * Indica se o Agents SDK deve usar a Responses API (true, padrão OpenAI) ou Chat Completions (false).
   * OpenRouter requer false pois expõe apenas o endpoint Chat Completions.
   */
  useResponses: boolean;
}

/**
 * Constrói a configuração padrão para OpenAI.
 */
export function buildOpenAiProviderConfig(apiKey: string): ILlmProviderConfig {
  return {
    provider: 'openai',
    apiKey,
    baseUrl: OPENAI_BASE_URL,
    useResponses: true,
  };
}

/**
 * Constrói a configuração para OpenRouter.
 * `extraHeaders` opcionais: HTTP-Referer e X-OpenRouter-Title para ranking.
 */
export function buildOpenRouterProviderConfig(
  apiKey: string,
  extraHeaders?: Record<string, string>,
): ILlmProviderConfig {
  return {
    provider: 'openrouter',
    apiKey,
    baseUrl: OPENROUTER_BASE_URL,
    extraHeaders,
    useResponses: false,
  };
}

/**
 * Mapeia um ID de modelo base para o formato do provider alvo.
 *
 * OpenRouter usa o formato `openai/gpt-4o` para modelos da família OpenAI.
 * Se o ID já contiver `/`, assume que já está prefixado e devolve como está.
 */
export function resolveModelIdForProvider(modelId: string, provider: TLlmProvider): string {
  if (provider !== 'openrouter') return modelId;
  if (modelId.includes('/')) return modelId;
  return `openai/${modelId}`;
}

/** Default conservador para contas OpenRouter com poucos créditos (evita 402 por reserva de max_tokens). */
const OPENROUTER_MAX_OUTPUT_TOKENS_DEFAULT = 4096;
const OPENROUTER_MAX_OUTPUT_TOKENS_MIN = 256;
const OPENROUTER_MAX_OUTPUT_TOKENS_CAP = 32768;

/**
 * Limite de tokens de saída para Chat Completions no OpenRouter.
 * O Agents SDK / omitir max_tokens pode fazer o gateway assumir um teto muito alto (ex. 65536),
 * o que dispara erros de crédito (402) em contas gratuitas.
 *
 * Override: `OPENROUTER_MAX_OUTPUT_TOKENS` (256–32768, default 4096).
 */
export function openRouterMaxOutputTokensFromEnv(): number {
  const raw = process.env.OPENROUTER_MAX_OUTPUT_TOKENS?.trim();
  if (!raw) return OPENROUTER_MAX_OUTPUT_TOKENS_DEFAULT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return OPENROUTER_MAX_OUTPUT_TOKENS_DEFAULT;
  return Math.min(OPENROUTER_MAX_OUTPUT_TOKENS_CAP, Math.max(OPENROUTER_MAX_OUTPUT_TOKENS_MIN, n));
}
