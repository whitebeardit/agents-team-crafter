import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  CORS_ORIGIN: z.string().default('*'),
  /** Fallback demo/local quando o workspace nao tem chave OpenAI em integracoes. */
  OPENAI_API_KEY: z.string().min(1).optional(),
  /** Redis para Chat SDK (state-redis). Sem isto, usa state in-memory por processo. */
  REDIS_URL: z.string().min(1).optional(),
  /** Assinatura Slack Events API (verificação de webhook). */
  SLACK_SIGNING_SECRET: z.string().min(1).optional(),
  /** Apenas testes: pular verificação de assinatura no webhook Slack. */
  CHAT_SDK_SKIP_SIGNATURE_VERIFY: z.enum(['0', '1']).optional(),
  /**
   * Chave mestra hex 64 chars (32 bytes) para AES-256-GCM dos segredos de canal por workspace.
   * Opcional em dev sem persistir segredos; obrigatória para PUT /channels/:id/secrets.
   */
  ENCRYPTION_MASTER_KEY: z.string().min(64).optional(),
  /**
   * Limite de handoffs encadeados numa unica mensagem (executeAgentRun).
   * Evita loops longos na orquestracao; padrao 4.
   */
  RUNTIME_MAX_HANDOFF_DEPTH: z.coerce.number().int().min(0).max(32).default(4),
  /**
   * Emails (separados por virgula) tratados como admin global mesmo sem isPlatformAdmin no Mongo.
   * Normalizados em minusculas; util para contas antigas ou JWT emitido antes do flag.
   */
  PLATFORM_ADMIN_EMAILS: z.string().optional(),
});

type IEnvParsed = z.infer<typeof envSchema>;

export type IEnv = IEnvParsed & {
  /** Definido por loadEnv; em testes pode omitir (createDeps usa conjunto vazio). */
  platformAdminEmails?: ReadonlySet<string>;
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
    platformAdminEmails: parsePlatformAdminEmails(data.PLATFORM_ADMIN_EMAILS),
  };
}
