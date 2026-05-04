import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3001),
    MONGODB_URI: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().default('7d'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
    CORS_ORIGIN: z.string().default('*'),
    /** Fallback demo/local quando o workspace nao tem chave OpenAI em integracoes. */
    OPENAI_API_KEY: z.string().min(1).optional(),
    /**
     * Provider LLM padrão quando o workspace não define um explicitamente.
     * 'openrouter' (padrão em código quando omitido) ou 'openai'.
     */
    LLM_PROVIDER: z.enum(['openai', 'openrouter']).optional(),
    /** Chave de fallback para OpenRouter (usado com provider OpenRouter sem BYOK no workspace). */
    OPENROUTER_API_KEY: z.string().min(1).optional(),
    /** Header HTTP-Referer enviado ao OpenRouter (melhora ranking na plataforma deles). */
    OPENROUTER_HTTP_REFERER: z.string().optional(),
    /** Título da aplicação enviado ao OpenRouter via X-OpenRouter-Title. */
    OPENROUTER_APP_TITLE: z.string().optional(),
    /**
     * Primeiro segmento do título dinâmico por request (`<app>/<workspace>/<agent>` no X-OpenRouter-Title).
     * Default: team-agents-bff.
     */
    OPENROUTER_ATTRIBUTION_APP: z.string().optional(),
    /**
     * Limite de tokens de saída (completion) para OpenRouter — runtime Agents + planner JSON.
     * Default 4096; intervalo 256–32768. Reduz reservas de crédito (evita 402 com max_tokens alto).
     */
    OPENROUTER_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(256).max(32768).optional(),
    /** Redis para Chat SDK (state-redis). Sem isto, usa state in-memory por processo. */
    REDIS_URL: z.string().min(1).optional(),
    /** Assinatura Slack Events API (verificação de webhook). */
    SLACK_SIGNING_SECRET: z.string().min(1).optional(),
    /** Apenas testes: pular verificação de assinatura no webhook Slack. */
    CHAT_SDK_SKIP_SIGNATURE_VERIFY: z.enum(['0', '1']).optional(),
    /**
     * Chave mestra hex 64 chars (32 bytes) para AES-256-GCM dos segredos de canal por workspace.
     * Opcional em dev/test sem persistir segredos; obrigatoria em producao.
     */
    ENCRYPTION_MASTER_KEY: z.string().min(64).optional(),
    /**
     * Emails (separados por virgula) tratados como admin global mesmo sem isPlatformAdmin no Mongo.
     * Normalizados em minusculas; util para contas antigas ou JWT emitido antes do flag.
     */
    PLATFORM_ADMIN_EMAILS: z.string().optional(),
    /**
     * Quando `1`, ao executar `team-plans/:id/execute` cria/atualiza `WorkspaceToolDefinition` (internal_action)
     * e associa `customToolDefinitionIds` aos agentes novos do plano a partir de `requiredTools` / `requiredPacks`.
     * Default `0` (seguro).
     */
    /** Opcional nos testes; em `loadEnv` normaliza para `0`. */
    TEAM_PLAN_AUTO_BIND_TOOLS: z.enum(['0', '1']).optional(),
    /**
     * `1` permite o endpoint de reset de fábrica (apenas platform admin). Default `0`.
     * Mesmo com `1`, em `NODE_ENV=production` exige também DANGER_ZONE_FACTORY_RESET_ALLOW_PRODUCTION=1.
     */
    DANGER_ZONE_FACTORY_RESET_ENABLED: z.enum(['0', '1']).optional(),
    /** `1` permite reset total em produção (além do master switch). Default `0`. */
    DANGER_ZONE_FACTORY_RESET_ALLOW_PRODUCTION: z.enum(['0', '1']).optional(),
    /** Raiz dos vaults Obsidian por workspace (`<VAULT_ROOT>/<workspaceId>/`). Default: `./data/vaults`. */
    VAULT_ROOT: z.string().min(1).optional(),
    /** Timeout ms para `second_brain_recall` (default 1500). */
    SECOND_BRAIN_RECALL_TIMEOUT_MS: z.coerce.number().int().min(200).max(10_000).optional(),
    /** TTL ms do cache de recall por workspace+agente+tópico (default 60000). */
    SECOND_BRAIN_RECALL_CACHE_TTL_MS: z.coerce.number().int().min(0).max(600_000).optional(),
    /** Máximo de propostas por hora por workspace (default 60). */
    SECOND_BRAIN_PROPOSE_RATE_PER_HOUR: z.coerce.number().int().min(1).max(10_000).optional(),
    /** Após N falhas seguidas, circuit breaker desativa recall/propose até expirar (default 5). */
    SECOND_BRAIN_BREAKER_THRESHOLD: z.coerce.number().int().min(1).max(100).optional(),
    /** Duração ms do circuit breaker aberto (default 300000). */
    SECOND_BRAIN_BREAKER_OPEN_MS: z.coerce.number().int().min(1_000).max(3_600_000).optional(),
    /** Budget de tokens para injeção de learnings no prompt do especialista (default 1000). */
    VAULT_LEARNINGS_TOKEN_BUDGET: z.coerce.number().int().min(100).max(8000).optional(),
    /** Summarizer offline pós-run: `1` ativa (default `0`). */
    SECOND_BRAIN_SUMMARIZER_ENABLED: z.enum(['0', '1']).optional(),
    /** Amostragem 1 em N runs para summarizer (default 5). */
    SECOND_BRAIN_SUMMARIZER_SAMPLE_N: z.coerce.number().int().min(1).max(100).optional(),
    /** `1` activa recall hibrido com embeddings OpenAI + cosine in-app no Mongo. */
    EMBEDDINGS_ENABLED: z.enum(['0', '1']).optional(),
    /** Modelo OpenAI para embeddings (default text-embedding-3-small). */
    EMBEDDINGS_MODEL: z.string().min(1).optional(),
    /** Top-K candidatos semanticos antes de fusao com heuristica textual (default 20). */
    EMBEDDINGS_TOPK: z.coerce.number().int().min(5).max(100).optional(),
    /** Max notas com vector a carregar por recall (default 200). */
    EMBEDDINGS_CANDIDATE_CAP: z.coerce.number().int().min(50).max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== 'production') return;
    const k = data.ENCRYPTION_MASTER_KEY?.trim();
    if (!k) {
      ctx.addIssue({
        code: 'custom',
        message:
          'ENCRYPTION_MASTER_KEY e obrigatoria em producao (64 caracteres hex; gere com openssl rand -hex 32).',
        path: ['ENCRYPTION_MASTER_KEY'],
      });
      return;
    }
    if (k.length !== 64 || !/^[0-9a-fA-F]+$/.test(k)) {
      ctx.addIssue({
        code: 'custom',
        message: 'ENCRYPTION_MASTER_KEY deve ter exatamente 64 caracteres hexadecimais (32 bytes).',
        path: ['ENCRYPTION_MASTER_KEY'],
      });
    }
  });

type IEnvParsed = z.infer<typeof envSchema>;

export type IEnv = IEnvParsed & {
  VAULT_ROOT?: string;
  SECOND_BRAIN_RECALL_TIMEOUT_MS?: number;
  SECOND_BRAIN_RECALL_CACHE_TTL_MS?: number;
  SECOND_BRAIN_PROPOSE_RATE_PER_HOUR?: number;
  SECOND_BRAIN_BREAKER_THRESHOLD?: number;
  SECOND_BRAIN_BREAKER_OPEN_MS?: number;
  VAULT_LEARNINGS_TOKEN_BUDGET?: number;
  SECOND_BRAIN_SUMMARIZER_ENABLED?: '0' | '1';
  SECOND_BRAIN_SUMMARIZER_SAMPLE_N?: number;
  EMBEDDINGS_ENABLED?: '0' | '1';
  EMBEDDINGS_MODEL?: string;
  EMBEDDINGS_TOPK?: number;
  EMBEDDINGS_CANDIDATE_CAP?: number;
  /** Definido por loadEnv; em testes pode omitir (createDeps usa conjunto vazio). */
  platformAdminEmails?: ReadonlySet<string>;
  /** Normalizado em loadEnv; testes podem omitir (equivalente a `0`). */
  DANGER_ZONE_FACTORY_RESET_ENABLED?: '0' | '1';
  DANGER_ZONE_FACTORY_RESET_ALLOW_PRODUCTION?: '0' | '1';
  LLM_PROVIDER?: 'openai' | 'openrouter';
  OPENROUTER_API_KEY?: string;
  OPENROUTER_HTTP_REFERER?: string;
  OPENROUTER_APP_TITLE?: string;
  OPENROUTER_ATTRIBUTION_APP?: string;
  OPENROUTER_MAX_OUTPUT_TOKENS?: number;
};

export function parsePlatformAdminEmails(raw: string | undefined): ReadonlySet<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function loadEnv(): IEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid env: ${JSON.stringify(msg)}`);
  }
  const data = parsed.data;
  return {
    ...data,
    VAULT_ROOT: data.VAULT_ROOT?.trim() || undefined,
    SECOND_BRAIN_RECALL_TIMEOUT_MS: data.SECOND_BRAIN_RECALL_TIMEOUT_MS,
    SECOND_BRAIN_RECALL_CACHE_TTL_MS: data.SECOND_BRAIN_RECALL_CACHE_TTL_MS,
    SECOND_BRAIN_PROPOSE_RATE_PER_HOUR: data.SECOND_BRAIN_PROPOSE_RATE_PER_HOUR,
    SECOND_BRAIN_BREAKER_THRESHOLD: data.SECOND_BRAIN_BREAKER_THRESHOLD,
    SECOND_BRAIN_BREAKER_OPEN_MS: data.SECOND_BRAIN_BREAKER_OPEN_MS,
    VAULT_LEARNINGS_TOKEN_BUDGET: data.VAULT_LEARNINGS_TOKEN_BUDGET,
    SECOND_BRAIN_SUMMARIZER_ENABLED: data.SECOND_BRAIN_SUMMARIZER_ENABLED ?? '0',
    SECOND_BRAIN_SUMMARIZER_SAMPLE_N: data.SECOND_BRAIN_SUMMARIZER_SAMPLE_N,
    EMBEDDINGS_ENABLED: data.EMBEDDINGS_ENABLED ?? '0',
    EMBEDDINGS_MODEL: data.EMBEDDINGS_MODEL,
    EMBEDDINGS_TOPK: data.EMBEDDINGS_TOPK,
    EMBEDDINGS_CANDIDATE_CAP: data.EMBEDDINGS_CANDIDATE_CAP,
    TEAM_PLAN_AUTO_BIND_TOOLS: data.TEAM_PLAN_AUTO_BIND_TOOLS ?? '0',
    DANGER_ZONE_FACTORY_RESET_ENABLED: data.DANGER_ZONE_FACTORY_RESET_ENABLED ?? '0',
    DANGER_ZONE_FACTORY_RESET_ALLOW_PRODUCTION: data.DANGER_ZONE_FACTORY_RESET_ALLOW_PRODUCTION ?? '0',
    platformAdminEmails: parsePlatformAdminEmails(data.PLATFORM_ADMIN_EMAILS),
  };
}
