import { z } from 'zod';
import { maskSecretValue } from '../../../utils/mask-secret.js';
import type { EChatSdkPlatform } from './chat-sdk-platform.js';

const slackSecretsBody = z.object({
  signingSecret: z.string().min(1),
  botToken: z.string().min(1),
});

const discordSecretsBody = z.object({
  botToken: z.string().min(1),
  publicKey: z.string().min(1),
  applicationId: z.string().min(1).optional(),
});

const teamsSecretsBody = z.object({
  appId: z.string().min(1),
  appPassword: z.string().min(1),
  appTenantId: z.string().min(1).optional(),
  appType: z.enum(['MultiTenant', 'SingleTenant']).optional(),
});

const telegramSecretsBody = z.object({
  botToken: z.string().min(1),
  secretToken: z.string().optional(),
});

/** Service account JSON (Google Chat) */
const gchatSecretsBody = z.object({
  credentialsJson: z.string().min(1),
  googleChatProjectNumber: z.string().optional(),
  impersonateUser: z.string().optional(),
});

const githubSecretsBody = z.object({
  webhookSecret: z.string().min(1),
  token: z.string().min(1).optional(),
  appId: z.string().min(1).optional(),
  privateKey: z.string().min(1).optional(),
  installationId: z.coerce.number().int().positive().optional(),
});

const linearSecretsBody = z.object({
  webhookSecret: z.string().min(1),
  apiKey: z.string().min(1).optional(),
  accessToken: z.string().min(1).optional(),
  clientId: z.string().min(1).optional(),
  clientSecret: z.string().min(1).optional(),
});

const whatsappSecretsBody = z.object({
  accessToken: z.string().min(1),
  appSecret: z.string().min(1),
  verifyToken: z.string().min(1),
});

export type ISlackSecretsPayload = z.infer<typeof slackSecretsBody> & { platform: 'slack' };
export type IDiscordSecretsPayload = z.infer<typeof discordSecretsBody> & { platform: 'discord' };
export type ITeamsSecretsPayload = z.infer<typeof teamsSecretsBody> & { platform: 'teams' };
export type ITelegramSecretsPayload = z.infer<typeof telegramSecretsBody> & { platform: 'telegram' };
export type IGchatSecretsPayload = z.infer<typeof gchatSecretsBody> & { platform: 'gchat' };
export type IGithubSecretsPayload = z.infer<typeof githubSecretsBody> & { platform: 'github' };
export type ILinearSecretsPayload = z.infer<typeof linearSecretsBody> & { platform: 'linear' };
export type IWhatsappSecretsPayload = z.infer<typeof whatsappSecretsBody> & { platform: 'whatsapp' };

export type IChatSdkSecretsPayload =
  | ISlackSecretsPayload
  | IDiscordSecretsPayload
  | ITeamsSecretsPayload
  | ITelegramSecretsPayload
  | IGchatSecretsPayload
  | IGithubSecretsPayload
  | ILinearSecretsPayload
  | IWhatsappSecretsPayload;

export function parseChatSdkSecretsBody(platform: EChatSdkPlatform, body: unknown): IChatSdkSecretsPayload {
  switch (platform) {
    case 'slack':
      return { platform: 'slack', ...slackSecretsBody.parse(body) };
    case 'discord':
      return { platform: 'discord', ...discordSecretsBody.parse(body) };
    case 'teams':
      return { platform: 'teams', ...teamsSecretsBody.parse(body) };
    case 'telegram':
      return { platform: 'telegram', ...telegramSecretsBody.parse(body) };
    case 'gchat':
      return { platform: 'gchat', ...gchatSecretsBody.parse(body) };
    case 'github':
      return { platform: 'github', ...githubSecretsBody.parse(body) };
    case 'linear':
      return { platform: 'linear', ...linearSecretsBody.parse(body) };
    case 'whatsapp':
      return { platform: 'whatsapp', ...whatsappSecretsBody.parse(body) };
    default: {
      const _x: never = platform;
      throw new Error(`Unknown platform: ${_x}`);
    }
  }
}

/** Máscaras para GET /channels (sem plaintext). */
export function maskSecretPayloadForApi(p: IChatSdkSecretsPayload): Record<string, string> {
  const out: Record<string, string> = { platform: p.platform };
  if (p.platform === 'slack') {
    out.signingSecret = maskSecretValue(p.signingSecret);
    out.botToken = maskSecretValue(p.botToken);
  } else if (p.platform === 'discord') {
    out.botToken = maskSecretValue(p.botToken);
    out.publicKey = maskSecretValue(p.publicKey);
  } else if (p.platform === 'teams') {
    out.appId = p.appId;
    out.appPassword = maskSecretValue(p.appPassword);
  } else if (p.platform === 'telegram') {
    out.botToken = maskSecretValue(p.botToken);
    if (p.secretToken) out.secretToken = maskSecretValue(p.secretToken);
  } else if (p.platform === 'gchat') {
    out.credentialsJson = '{credentials}';
  } else if (p.platform === 'github') {
    out.webhookSecret = maskSecretValue(p.webhookSecret);
    if (p.token) out.token = maskSecretValue(p.token);
    if (p.privateKey) out.privateKey = maskSecretValue(p.privateKey);
  } else if (p.platform === 'linear') {
    out.webhookSecret = maskSecretValue(p.webhookSecret);
    if (p.apiKey) out.apiKey = maskSecretValue(p.apiKey);
    if (p.accessToken) out.accessToken = maskSecretValue(p.accessToken);
    if (p.clientSecret) out.clientSecret = maskSecretValue(p.clientSecret);
  } else if (p.platform === 'whatsapp') {
    out.accessToken = maskSecretValue(p.accessToken);
    out.appSecret = maskSecretValue(p.appSecret);
    out.verifyToken = maskSecretValue(p.verifyToken);
  }
  return out;
}
