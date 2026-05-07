/**
 * Snapshot das integracoes de tools por workspace (sem credenciais em logs).
 */
export interface IToolIntegrationContext {
  activeLlmProvider?: 'openai' | 'openrouter';
  calendar?: {
    restBaseUrl?: string;
    authHeader?: string;
  };
  /** Present when workspace or env has OpenAI key; enables catalog `image_generation`. */
  openai?: {
    apiKey: string;
    /** Padrao do workspace quando a tool envia `model: default`. */
    defaultImageModel?: 'dall-e-2' | 'dall-e-3';
  };
  /** Present when workspace or env has OpenRouter key; enables OpenRouter server tools. */
  openrouter?: {
    apiKey: string;
    baseUrl: string;
    extraHeaders?: Record<string, string>;
    /** Default text/runtime model for OpenRouter web helper calls. */
    defaultModel?: string;
    /** Default image model for OpenRouter image_generation when the tool input uses `model: default`. */
    defaultImageModel?: string;
  };
}
