import { z } from 'zod';
import { maskSecretValue } from '../../../utils/mask-secret.js';
import {
  EOpenAiWorkspaceChatModel,
  effectiveEnabledChatModels,
} from '../../../shared/kernel/openai-workspace-chat-models.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { TLlmProvider } from '../../../shared/kernel/llm-provider-config.js';

/** Payload interno (plaintext) guardado cifrado em Workspace.integrationSecretsEncrypted */
/** Modelo padrao para a tool de catalogo `image_generation` (override por chamada na tool com `model`). */
export type TImageGenerationModel = 'dall-e-2' | 'dall-e-3';

export interface IWorkspaceIntegrationsPayload {
  openaiApiKey?: string;
  /**
   * Provider LLM explícito para este workspace.
   * Quando omitido herda o default global (env LLM_PROVIDER, ou 'openai').
   */
  llmProvider?: TLlmProvider;
  /** Chave BYOK para OpenRouter quando `llmProvider = 'openrouter'`. */
  openrouterApiKey?: string;
  /** Padrao quando a tool usa `model: default`; se omitido, o runtime usa dall-e-3. */
  imageGenerationModel?: TImageGenerationModel;
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
  /** Base REST para tool catalog_calendar_access (GET path relativo em query) */
  toolCalendar?: {
    restBaseUrl?: string;
    /** Valor completo do header Authorization (ex. Bearer ...) */
    authHeader?: string;
  };
  /** Subconjunto do catálogo; vazio ou omitido = todos os modelos do enum permitidos na UI. */
  enabledOpenAiChatModels?: EOpenAiWorkspaceChatModel[];
  /** Default runtime (coordenador + especialistas) quando o agente não define override. */
  agentsRuntimeModel?: EOpenAiWorkspaceChatModel;
  /** Modelo do team planner (JSON). */
  teamPlannerModel?: EOpenAiWorkspaceChatModel;
  /**
   * Modelo runtime OpenRouter livre (e.g. 'anthropic/claude-sonnet-4-5').
   * Só aplicado quando `llmProvider = 'openrouter'`.
   * Quando omitido e provider=openrouter, usa agentsRuntimeModel com prefixo `openai/`.
   */
  openrouterRuntimeModel?: string;
  /**
   * Modelo planner OpenRouter livre.
   * Só aplicado quando `llmProvider = 'openrouter'`.
   */
  openrouterPlannerModel?: string;
}

export const putWorkspaceIntegrationsBodySchema = z.object({
  /** Omitir = manter; string vazia = remover chave */
  openaiApiKey: z.string().optional(),
  /** Provider LLM do workspace; string vazia = remover e herdar do env. */
  llmProvider: z.union([z.enum(['openai', 'openrouter']), z.literal('')]).optional(),
  /** Chave OpenRouter BYOK; string vazia = remover. */
  openrouterApiKey: z.string().optional(),
  /** Modelo runtime OpenRouter livre; string vazia = remover. */
  openrouterRuntimeModel: z.string().optional(),
  /** Modelo planner OpenRouter livre; string vazia = remover. */
  openrouterPlannerModel: z.string().optional(),
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
  toolCalendar: z
    .object({
      restBaseUrl: z.string().optional(),
      authHeader: z.string().optional(),
    })
    .optional(),
  /** Padrao workspace para geracao de imagem; string vazia remove e volta ao default dall-e-3 no runtime. */
  imageGenerationModel: z.union([z.enum(['dall-e-2', 'dall-e-3']), z.literal('')]).optional(),
  enabledOpenAiChatModels: z.array(z.nativeEnum(EOpenAiWorkspaceChatModel)).optional(),
  agentsRuntimeModel: z
    .union([z.nativeEnum(EOpenAiWorkspaceChatModel), z.literal('')])
    .optional(),
  teamPlannerModel: z
    .union([z.nativeEnum(EOpenAiWorkspaceChatModel), z.literal('')])
    .optional(),
});

export type IPutWorkspaceIntegrationsBody = z.infer<typeof putWorkspaceIntegrationsBodySchema>;

export function maskIntegrationsForApi(payload: IWorkspaceIntegrationsPayload | null): {
  openaiApiKeyConfigured: boolean;
  openaiApiKeyMasked?: string;
  llmProvider?: TLlmProvider;
  openrouterApiKeyConfigured?: boolean;
  openrouterApiKeyMasked?: string;
  openrouterRuntimeModel?: string;
  openrouterPlannerModel?: string;
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
  toolCalendar?: { restBaseUrl?: string; authHeaderConfigured: boolean };
  imageGenerationModel?: TImageGenerationModel;
  enabledOpenAiChatModels?: EOpenAiWorkspaceChatModel[];
  agentsRuntimeModel?: EOpenAiWorkspaceChatModel;
  teamPlannerModel?: EOpenAiWorkspaceChatModel;
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
    ...(payload.llmProvider ? { llmProvider: payload.llmProvider } : {}),
    ...(payload.openrouterApiKey?.trim()
      ? {
          openrouterApiKeyConfigured: true,
          openrouterApiKeyMasked: maskSecretValue(payload.openrouterApiKey),
        }
      : { openrouterApiKeyConfigured: false }),
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
    ...(payload.toolCalendar?.restBaseUrl?.trim() || payload.toolCalendar?.authHeader?.trim()
      ? {
          toolCalendar: {
            restBaseUrl: payload.toolCalendar.restBaseUrl?.trim(),
            authHeaderConfigured: Boolean(payload.toolCalendar.authHeader?.trim()),
          },
        }
      : {}),
    ...(payload.imageGenerationModel ? { imageGenerationModel: payload.imageGenerationModel } : {}),
    ...(payload.enabledOpenAiChatModels?.length
      ? { enabledOpenAiChatModels: payload.enabledOpenAiChatModels }
      : {}),
    ...(payload.agentsRuntimeModel ? { agentsRuntimeModel: payload.agentsRuntimeModel } : {}),
    ...(payload.teamPlannerModel ? { teamPlannerModel: payload.teamPlannerModel } : {}),
    ...(payload.openrouterRuntimeModel ? { openrouterRuntimeModel: payload.openrouterRuntimeModel } : {}),
    ...(payload.openrouterPlannerModel ? { openrouterPlannerModel: payload.openrouterPlannerModel } : {}),
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

  if (patch.llmProvider !== undefined) {
    if (patch.llmProvider === '') delete next.llmProvider;
    else next.llmProvider = patch.llmProvider as TLlmProvider;
  }

  if (patch.openrouterApiKey !== undefined) {
    if (patch.openrouterApiKey.trim() === '') delete next.openrouterApiKey;
    else next.openrouterApiKey = patch.openrouterApiKey.trim();
  }

  if (patch.openrouterRuntimeModel !== undefined) {
    if (patch.openrouterRuntimeModel.trim() === '') delete next.openrouterRuntimeModel;
    else next.openrouterRuntimeModel = patch.openrouterRuntimeModel.trim();
  }

  if (patch.openrouterPlannerModel !== undefined) {
    if (patch.openrouterPlannerModel.trim() === '') delete next.openrouterPlannerModel;
    else next.openrouterPlannerModel = patch.openrouterPlannerModel.trim();
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

  if (patch.toolCalendar !== undefined) {
    const prev = next.toolCalendar ?? {};
    const merged = {
      restBaseUrl: patch.toolCalendar.restBaseUrl !== undefined ? patch.toolCalendar.restBaseUrl : prev.restBaseUrl,
      authHeader: patch.toolCalendar.authHeader !== undefined ? patch.toolCalendar.authHeader : prev.authHeader,
    };
    const empty = !merged.restBaseUrl?.trim() && !merged.authHeader?.trim();
    if (empty) delete next.toolCalendar;
    else {
      next.toolCalendar = {};
      if (merged.restBaseUrl?.trim()) next.toolCalendar.restBaseUrl = merged.restBaseUrl.trim();
      if (merged.authHeader?.trim()) next.toolCalendar.authHeader = merged.authHeader.trim();
    }
  }

  if (patch.imageGenerationModel !== undefined) {
    if (patch.imageGenerationModel === '') delete next.imageGenerationModel;
    else next.imageGenerationModel = patch.imageGenerationModel;
  }

  if (patch.enabledOpenAiChatModels !== undefined) {
    if (!patch.enabledOpenAiChatModels.length) delete next.enabledOpenAiChatModels;
    else next.enabledOpenAiChatModels = [...new Set(patch.enabledOpenAiChatModels)];
  }

  if (patch.agentsRuntimeModel !== undefined) {
    if (patch.agentsRuntimeModel === '') delete next.agentsRuntimeModel;
    else next.agentsRuntimeModel = patch.agentsRuntimeModel;
  }

  if (patch.teamPlannerModel !== undefined) {
    if (patch.teamPlannerModel === '') delete next.teamPlannerModel;
    else next.teamPlannerModel = patch.teamPlannerModel;
  }

  return next;
}

/** Valida defaults de chat contra `enabledOpenAiChatModels` quando a lista está definida e não vazia. */
export function assertWorkspaceChatModelsCoherent(payload: IWorkspaceIntegrationsPayload): void {
  const lim = payload.enabledOpenAiChatModels;
  if (!lim?.length) return;
  const eff = effectiveEnabledChatModels(lim);
  if (payload.agentsRuntimeModel && !eff.includes(payload.agentsRuntimeModel)) {
    throw new AppError(
      'VALIDATION_ERROR',
      'O modelo de runtime dos agentes deve estar entre os modelos OpenAI habilitados neste workspace.',
      400,
    );
  }
  if (payload.teamPlannerModel && !eff.includes(payload.teamPlannerModel)) {
    throw new AppError(
      'VALIDATION_ERROR',
      'O modelo do planner de times deve estar entre os modelos OpenAI habilitados neste workspace.',
      400,
    );
  }
}
