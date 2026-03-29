import { z } from 'zod';
import { maskSecretValue } from '../../../utils/mask-secret.js';

/** Payload interno (plaintext) guardado cifrado em Workspace.integrationSecretsEncrypted */
export interface IWorkspaceIntegrationsPayload {
  openaiApiKey?: string;
  smtp?: {
    host: string;
    port: number;
    secure?: boolean;
    user: string;
    password: string;
    from?: string;
  };
  /** Slack ao nível do workspace (fallback antes de env); canais podem sobrepor com PUT /channels/:id/secrets */
  slack?: {
    signingSecret?: string;
    botToken?: string;
    clientId?: string;
    clientSecret?: string;
  };
}

export const putWorkspaceIntegrationsBodySchema = z.object({
  /** Omitir = manter; string vazia = remover chave */
  openaiApiKey: z.string().optional(),
  smtp: z
    .object({
      host: z.string().optional(),
      port: z.coerce.number().int().min(1).max(65535).optional(),
      secure: z.boolean().optional(),
      user: z.string().optional(),
      password: z.string().optional(),
      from: z.string().optional(),
    })
    .optional(),
  slack: z
    .object({
      signingSecret: z.string().optional(),
      botToken: z.string().optional(),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
    })
    .optional(),
});

export type IPutWorkspaceIntegrationsBody = z.infer<typeof putWorkspaceIntegrationsBodySchema>;

export function maskIntegrationsForApi(payload: IWorkspaceIntegrationsPayload | null): {
  openaiApiKeyConfigured: boolean;
  openaiApiKeyMasked?: string;
  smtp?: {
    host?: string;
    port?: number;
    secure?: boolean;
    userMasked?: string;
    from?: string;
    passwordConfigured: boolean;
  };
  slack?: {
    signingSecretMasked?: string;
    botTokenMasked?: string;
    clientIdMasked?: string;
    clientSecretMasked?: string;
  };
} {
  if (!payload) {
    return { openaiApiKeyConfigured: false };
  }
  const smtp = payload.smtp;
  const slack = payload.slack;
  return {
    openaiApiKeyConfigured: Boolean(payload.openaiApiKey && payload.openaiApiKey.trim()),
    ...(payload.openaiApiKey?.trim()
      ? { openaiApiKeyMasked: maskSecretValue(payload.openaiApiKey) }
      : {}),
    ...(smtp
      ? {
          smtp: {
            host: smtp.host,
            port: smtp.port,
            secure: smtp.secure,
            from: smtp.from,
            ...(smtp.user ? { userMasked: maskSecretValue(smtp.user, 3) } : {}),
            passwordConfigured: Boolean(smtp.password?.trim()),
          },
        }
      : {}),
    ...(slack
      ? {
          slack: {
            ...(slack.signingSecret?.trim()
              ? { signingSecretMasked: maskSecretValue(slack.signingSecret) }
              : {}),
            ...(slack.botToken?.trim() ? { botTokenMasked: maskSecretValue(slack.botToken) } : {}),
            ...(slack.clientId?.trim() ? { clientIdMasked: maskSecretValue(slack.clientId, 4) } : {}),
            ...(slack.clientSecret?.trim()
              ? { clientSecretMasked: maskSecretValue(slack.clientSecret) }
              : {}),
          },
        }
      : {}),
  };
}

export function mergeWorkspaceIntegrationsPayload(
  current: IWorkspaceIntegrationsPayload,
  patch: IPutWorkspaceIntegrationsBody,
): IWorkspaceIntegrationsPayload {
  const next: IWorkspaceIntegrationsPayload = { ...current };

  if (patch.openaiApiKey !== undefined) {
    if (patch.openaiApiKey.trim() === '') delete next.openaiApiKey;
    else next.openaiApiKey = patch.openaiApiKey.trim();
  }

  if (patch.smtp !== undefined) {
    const prev = next.smtp;
    const merged = {
      host: patch.smtp.host !== undefined ? patch.smtp.host : (prev?.host ?? ''),
      port: patch.smtp.port !== undefined ? patch.smtp.port : (prev?.port ?? 587),
      secure: patch.smtp.secure !== undefined ? patch.smtp.secure : (prev?.secure ?? false),
      user: patch.smtp.user !== undefined ? patch.smtp.user : (prev?.user ?? ''),
      password:
        patch.smtp.password !== undefined ? patch.smtp.password : (prev?.password ?? ''),
      from: patch.smtp.from !== undefined ? patch.smtp.from : prev?.from,
    };
    const hostEmpty = merged.host.trim() === '';
    const userEmpty = merged.user.trim() === '';
    if (hostEmpty && userEmpty && (patch.smtp.password === '' || merged.password === '')) {
      delete next.smtp;
    } else if (merged.host.trim() && merged.user.trim() && merged.password.trim()) {
      next.smtp = {
        host: merged.host.trim(),
        port: merged.port,
        secure: Boolean(merged.secure),
        user: merged.user.trim(),
        password: merged.password,
        ...(merged.from?.trim() ? { from: merged.from.trim() } : {}),
      };
    }
  }

  if (patch.slack !== undefined) {
    const prev = next.slack ?? {};
    const merged = {
      signingSecret:
        patch.slack.signingSecret !== undefined ? patch.slack.signingSecret : prev.signingSecret,
      botToken: patch.slack.botToken !== undefined ? patch.slack.botToken : prev.botToken,
      clientId: patch.slack.clientId !== undefined ? patch.slack.clientId : prev.clientId,
      clientSecret:
        patch.slack.clientSecret !== undefined ? patch.slack.clientSecret : prev.clientSecret,
    };
    const cleaned: NonNullable<IWorkspaceIntegrationsPayload['slack']> = {};
    if (merged.signingSecret?.trim()) cleaned.signingSecret = merged.signingSecret.trim();
    if (merged.botToken?.trim()) cleaned.botToken = merged.botToken.trim();
    if (merged.clientId?.trim()) cleaned.clientId = merged.clientId.trim();
    if (merged.clientSecret?.trim()) cleaned.clientSecret = merged.clientSecret.trim();
    if (Object.keys(cleaned).length === 0) delete next.slack;
    else next.slack = cleaned;
  }

  return next;
}
