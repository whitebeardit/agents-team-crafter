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
    TEAM_PLAN_AUTO_BIND_TOOLS: data.TEAM_PLAN_AUTO_BIND_TOOLS ?? '0',
    DANGER_ZONE_FACTORY_RESET_ENABLED: data.DANGER_ZONE_FACTORY_RESET_ENABLED ?? '0',
    DANGER_ZONE_FACTORY_RESET_ALLOW_PRODUCTION: data.DANGER_ZONE_FACTORY_RESET_ALLOW_PRODUCTION ?? '0',
    platformAdminEmails: parsePlatformAdminEmails(data.PLATFORM_ADMIN_EMAILS),
  };
}
