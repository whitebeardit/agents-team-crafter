/**
 * Snapshot das integracoes de tools por workspace (sem credenciais em logs).
 */
export interface IToolIntegrationContext {
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
}
