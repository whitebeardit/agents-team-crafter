import type { IEnv } from '../../../config/env.js';
import { preferOpenRouterTitleOverReferer } from '../../../shared/kernel/openrouter-attribution.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { decryptJson, encryptJson } from '../../../utils/secrets-crypto.js';
import type { WorkspaceRepository } from '../../workspaces/infra/workspace.repository.js';
import {
  type IWorkspaceIntegrationsPayload,
  type IPutWorkspaceIntegrationsBody,
  assertWorkspaceChatModelsCoherent,
  maskIntegrationsForApi,
  mergeWorkspaceIntegrationsPayload,
} from '../domain/workspace-integrations.schema.js';
import type { IToolIntegrationContext } from '../../../shared/kernel/tool-integration.types.js';
import { resolveOperationalCatalogTools } from '../../agents/domain/operational-catalog-tools.js';
import nodemailer from 'nodemailer';
import {
  type EOpenAiWorkspaceChatModel,
  DEFAULT_AGENTS_RUNTIME_MODEL,
  DEFAULT_TEAM_PLANNER_MODEL,
  availableWorkspaceChatModels,
  parseAgentsRuntimeModelFromEnv,
  parseOpenAiWorkspaceChatModel,
  parseTeamPlannerModelFromEnv,
  pickResolvedWorkspaceChatModel,
} from '../../../shared/kernel/openai-workspace-chat-models.js';
import {
  type ILlmProviderConfig,
  type TLlmProvider,
  DEFAULT_LLM_PROVIDER,
  OPENAI_BASE_URL,
  OPENROUTER_BASE_URL,
  buildOpenAiProviderConfig,
  buildOpenRouterProviderConfig,
} from '../../../shared/kernel/llm-provider-config.js';
import { isOpenRouterStyleModelId } from '../../../shared/kernel/openrouter-model-id-pattern.js';

function integrationPayloadHasSecrets(next: IWorkspaceIntegrationsPayload): boolean {
  return (
    Boolean(next.openaiApiKey?.trim()) ||
    Boolean(next.openrouterApiKey?.trim()) ||
    Boolean(next.llmProvider) ||
    Boolean(next.openrouterRuntimeModel?.trim()) ||
    Boolean(next.openrouterPlannerModel?.trim()) ||
    Boolean(next.openrouterImageGenerationModel?.trim()) ||
    Boolean(next.smtp?.host?.trim() && next.smtp?.user?.trim() && next.smtp?.password?.trim()) ||
    Boolean(
      next.slack &&
        Object.values(next.slack).some((v) => typeof v === 'string' && v.trim().length > 0),
    ) ||
    Boolean(next.toolCalendar?.restBaseUrl?.trim() || next.toolCalendar?.authHeader?.trim()) ||
    Boolean(next.imageGenerationModel) ||
    Boolean(next.enabledOpenAiChatModels?.length) ||
    Boolean(next.agentsRuntimeModel) ||
    Boolean(next.teamPlannerModel) ||
    Boolean(next.allowedLlmModelIds?.length)
  );
}

export class WorkspaceIntegrationsService {
  constructor(
    private readonly env: IEnv,
    private readonly workspaceRepo: WorkspaceRepository,
  ) {}

  private requireMasterKey(): string {
    const k = this.env.ENCRYPTION_MASTER_KEY;
    if (!k?.trim()) {
      throw new AppError(
        'CONFIG_ERROR',
        'ENCRYPTION_MASTER_KEY nao configurada; necessaria para integracoes do workspace',
        503,
      );
    }
    return k.trim();
  }

  async getPlainPayload(workspaceId: string): Promise<IWorkspaceIntegrationsPayload | null> {
    const enc = await this.workspaceRepo.getIntegrationSecretsEncrypted(workspaceId);
    if (!enc?.ciphertext) return null;
    const k = this.env.ENCRYPTION_MASTER_KEY?.trim();
    if (!k) return null;
    try {
      const parsed = decryptJson<IWorkspaceIntegrationsPayload & { toolCrm?: unknown; toolDatabase?: unknown }>(k, enc);
      if (!parsed) return null;
      if (parsed.toolCrm !== undefined || parsed.toolDatabase !== undefined) {
        delete parsed.toolCrm;
        delete parsed.toolDatabase;
        const next = parsed as IWorkspaceIntegrationsPayload;
        if (integrationPayloadHasSecrets(next)) {
          await this.workspaceRepo.setIntegrationSecretsEncrypted(
            workspaceId,
            encryptJson(this.requireMasterKey(), next),
          );
        } else {
          await this.workspaceRepo.setIntegrationSecretsEncrypted(workspaceId, null);
        }
      }
      return parsed as IWorkspaceIntegrationsPayload;
    } catch {
      return null;
    }
  }

  async getMasked(workspaceId: string) {
    const plain = await this.getPlainPayload(workspaceId);
    const ctx = await this.getToolIntegrationContext(workspaceId);
    return {
      secretsMasked: maskIntegrationsForApi(plain),
      operationalCatalogTools: resolveOperationalCatalogTools(ctx),
      availableOpenAiChatModels: availableWorkspaceChatModels(plain?.enabledOpenAiChatModels),
      /** IDs OpenRouter permitidos no workspace (vazio = sem restricao além do formato). */
      allowedLlmModelIds: plain?.allowedLlmModelIds?.length ? [...plain.allowedLlmModelIds] : [],
    };
  }

  async putPartial(workspaceId: string, patch: IPutWorkspaceIntegrationsBody) {
    const current = (await this.getPlainPayload(workspaceId)) ?? {};
    const next = mergeWorkspaceIntegrationsPayload(current, patch);
    assertWorkspaceChatModelsCoherent(next);
    const hasAny = integrationPayloadHasSecrets(next);
    if (!hasAny) {
      await this.workspaceRepo.setIntegrationSecretsEncrypted(workspaceId, null);
      return {
        secretsMasked: maskIntegrationsForApi(null),
        operationalCatalogTools: resolveOperationalCatalogTools({}),
        availableOpenAiChatModels: availableWorkspaceChatModels(undefined),
        allowedLlmModelIds: [],
      };
    }
    const enc = encryptJson(this.requireMasterKey(), next);
    await this.workspaceRepo.setIntegrationSecretsEncrypted(workspaceId, enc);
    const ctxAfter = await this.getToolIntegrationContext(workspaceId);
    return {
      secretsMasked: maskIntegrationsForApi(next),
      operationalCatalogTools: resolveOperationalCatalogTools(ctxAfter),
      availableOpenAiChatModels: availableWorkspaceChatModels(next.enabledOpenAiChatModels),
      allowedLlmModelIds: next.allowedLlmModelIds?.length ? [...next.allowedLlmModelIds] : [],
    };
  }

  /** Contexto para tools builtin (catalog) no runtime de agentes. */
  async getToolIntegrationContext(workspaceId: string): Promise<IToolIntegrationContext> {
    const p = await this.getPlainPayload(workspaceId);
    const provider =
      p?.llmProvider ??
      ((process.env.LLM_PROVIDER || this.env.LLM_PROVIDER) as TLlmProvider | undefined) ??
      DEFAULT_LLM_PROVIDER;
    const out: IToolIntegrationContext = { activeLlmProvider: provider };
    if (!p) {
      const envOpenRouterKey =
        process.env.OPENROUTER_API_KEY?.trim() || this.env.OPENROUTER_API_KEY?.trim();
      if (envOpenRouterKey) {
        out.openrouter = {
          apiKey: envOpenRouterKey,
          baseUrl: OPENROUTER_BASE_URL,
        };
      }
      return out;
    }
    if (p.toolCalendar?.restBaseUrl?.trim() || p.toolCalendar?.authHeader?.trim()) {
      out.calendar = {
        restBaseUrl: p.toolCalendar.restBaseUrl?.trim(),
        authHeader: p.toolCalendar.authHeader?.trim(),
      };
    }
    const openaiKey = await this.resolveOpenAiApiKey(workspaceId);
    if (openaiKey) {
      out.openai = {
        apiKey: openaiKey,
        ...(p.imageGenerationModel ? { defaultImageModel: p.imageGenerationModel } : {}),
      };
    }
    const openRouterKey =
      p.openrouterApiKey?.trim() ||
      process.env.OPENROUTER_API_KEY?.trim() ||
      this.env.OPENROUTER_API_KEY?.trim();
    if (openRouterKey) {
      const referer = this.resolveOpenRouterHttpReferer();
      const title =
        process.env.OPENROUTER_APP_TITLE?.trim() || this.env.OPENROUTER_APP_TITLE?.trim();
      const extraHeaders: Record<string, string> = {};
      if (referer) extraHeaders['HTTP-Referer'] = referer;
      if (title) extraHeaders['X-OpenRouter-Title'] = title;
      out.openrouter = {
        apiKey: openRouterKey,
        baseUrl: OPENROUTER_BASE_URL,
        ...(Object.keys(extraHeaders).length > 0 ? { extraHeaders } : {}),
        ...(p.openrouterRuntimeModel?.trim() ? { defaultModel: p.openrouterRuntimeModel.trim() } : {}),
        ...(p.openrouterImageGenerationModel?.trim()
          ? { defaultImageModel: p.openrouterImageGenerationModel.trim() }
          : {}),
      };
    }
    return out;
  }

  /**
   * Origem da chave: workspace (BYOK) ou variavel de ambiente (demo/dev).
   */
  async resolveOpenAiApiKeyWithSource(workspaceId: string): Promise<{
    apiKey?: string;
    source: 'workspace' | 'environment' | 'none';
  }> {
    const p = await this.getPlainPayload(workspaceId);
    const w = p?.openaiApiKey?.trim();
    if (w) return { apiKey: w, source: 'workspace' };
    const env = process.env.OPENAI_API_KEY?.trim() || this.env.OPENAI_API_KEY?.trim();
    if (env) return { apiKey: env, source: 'environment' };
    return { source: 'none' };
  }

  async resolveOpenAiApiKey(workspaceId: string): Promise<string | undefined> {
    const r = await this.resolveOpenAiApiKeyWithSource(workspaceId);
    return r.apiKey;
  }

  /**
   * Resolve a configuração completa do provider LLM para o workspace.
   * Prioridade: provider/chave do workspace (BYOK) → default do ambiente (env).
   * Retorna null quando não há chave disponível.
   */
  /**
   * Slug estável do produto para o primeiro segmento do título OpenRouter (dashboard).
   */
  getOpenRouterAttributionAppSlug(): string {
    return (
      process.env.OPENROUTER_ATTRIBUTION_APP?.trim() ||
      this.env.OPENROUTER_ATTRIBUTION_APP?.trim() ||
      'team-agents-bff'
    );
  }

  /**
   * URL enviada em `HTTP-Referer` ao OpenRouter (obrigatória para coluna "App" e rankings).
   * Ordem: OPENROUTER_HTTP_REFERER → primeira origem em CORS_ORIGIN → localhost em não-produção.
   */
  private resolveOpenRouterHttpReferer(): string {
    const explicit =
      process.env.OPENROUTER_HTTP_REFERER?.trim() || this.env.OPENROUTER_HTTP_REFERER?.trim();
    if (explicit) return explicit;
    const cors = process.env.CORS_ORIGIN?.trim() || this.env.CORS_ORIGIN?.trim();
    if (cors && cors !== '*') {
      const first = cors.split(',')[0]?.trim().replace(/\/+$/, '') ?? '';
      if (first.startsWith('http://') || first.startsWith('https://')) return first;
    }
    if (this.env.NODE_ENV !== 'production') return 'http://localhost:3000';
    return '';
  }

  /**
   * Nome do workspace para atribuição OpenRouter (segundo segmento de app/workspace/agent).
   */
  async resolveWorkspaceNameForOpenRouterAttribution(workspaceId: string): Promise<string> {
    const rec = await this.workspaceRepo.findById(workspaceId);
    const raw = rec?.name?.trim();
    if (raw) return raw;
    return `ws-${workspaceId.replace(/[^a-fA-F0-9]/g, '').slice(-8) || 'unknown'}`;
  }

  async resolveLlmProviderConfig(workspaceId: string): Promise<ILlmProviderConfig | null> {
    const p = await this.getPlainPayload(workspaceId);

    // Determinação do provider: workspace explícito > env > DEFAULT_LLM_PROVIDER (openrouter)
    const workspaceProvider = p?.llmProvider;
    const envProvider = (process.env.LLM_PROVIDER || this.env.LLM_PROVIDER) as TLlmProvider | undefined;
    const effectiveProvider: TLlmProvider = workspaceProvider ?? envProvider ?? DEFAULT_LLM_PROVIDER;

    if (effectiveProvider === 'openrouter') {
      const wsKey = p?.openrouterApiKey?.trim();
      const envKey =
        process.env.OPENROUTER_API_KEY?.trim() || this.env.OPENROUTER_API_KEY?.trim();
      const apiKey = wsKey || envKey;
      if (!apiKey) return null;
      const referer = this.resolveOpenRouterHttpReferer();
      const title =
        process.env.OPENROUTER_APP_TITLE?.trim() || this.env.OPENROUTER_APP_TITLE?.trim();
      const extraHeaders: Record<string, string> = {};
      if (referer) extraHeaders['HTTP-Referer'] = referer;
      if (title) extraHeaders['X-OpenRouter-Title'] = title;
      return buildOpenRouterProviderConfig(
        apiKey,
        Object.keys(extraHeaders).length > 0 ? extraHeaders : undefined,
      );
    }

    // OpenAI (default)
    const wsKey = p?.openaiApiKey?.trim();
    const envKey = process.env.OPENAI_API_KEY?.trim() || this.env.OPENAI_API_KEY?.trim();
    const apiKey = wsKey || envKey;
    if (!apiKey) return null;
    return buildOpenAiProviderConfig(apiKey);
  }

  async resolveTeamPlannerModel(workspaceId: string): Promise<EOpenAiWorkspaceChatModel> {
    const p = (await this.getPlainPayload(workspaceId)) ?? {};
    return pickResolvedWorkspaceChatModel({
      preferenceChain: [p.teamPlannerModel, parseTeamPlannerModelFromEnv()],
      enabled: p.enabledOpenAiChatModels,
      productDefault: DEFAULT_TEAM_PLANNER_MODEL,
    });
  }

  /**
   * Resolve o modelo do planner respeitando overrides específicos de OpenRouter.
   * Quando o provider é OpenRouter e há `openrouterPlannerModel`, usa-o directamente.
   */
  async resolveTeamPlannerModelForProvider(workspaceId: string): Promise<string> {
    const p = (await this.getPlainPayload(workspaceId)) ?? {};
    const provider = p.llmProvider ??
      ((process.env.LLM_PROVIDER || this.env.LLM_PROVIDER) as 'openai' | 'openrouter' | undefined) ??
      DEFAULT_LLM_PROVIDER;
    if (provider === 'openrouter' && p.openrouterPlannerModel?.trim()) {
      return p.openrouterPlannerModel.trim();
    }
    const base = await this.resolveTeamPlannerModel(workspaceId);
    return base;
  }

  /**
   * Modelo de chat para runtime Agents SDK (coordenador e especialistas).
   * @param agentOverrideRaw valor persistido no agente (string API); opcional.
   */
  async resolveAgentsRuntimeModel(
    workspaceId: string,
    agentOverrideRaw?: string | null,
  ): Promise<EOpenAiWorkspaceChatModel> {
    const p = (await this.getPlainPayload(workspaceId)) ?? {};
    return pickResolvedWorkspaceChatModel({
      preferenceChain: [
        parseOpenAiWorkspaceChatModel(agentOverrideRaw),
        p.agentsRuntimeModel,
        parseAgentsRuntimeModelFromEnv(),
      ],
      enabled: p.enabledOpenAiChatModels,
      productDefault: DEFAULT_AGENTS_RUNTIME_MODEL,
    });
  }

  /**
   * Resolve o modelo runtime respeitando overrides específicos de OpenRouter.
   * Quando o provider é OpenRouter e há `openrouterRuntimeModel`, usa-o directamente.
   */
  async resolveAgentsRuntimeModelForProvider(
    workspaceId: string,
    agentOverrideRaw?: string | null,
  ): Promise<string> {
    const p = (await this.getPlainPayload(workspaceId)) ?? {};
    const provider = p.llmProvider ??
      ((process.env.LLM_PROVIDER || this.env.LLM_PROVIDER) as 'openai' | 'openrouter' | undefined) ??
      DEFAULT_LLM_PROVIDER;
    const override = typeof agentOverrideRaw === 'string' ? agentOverrideRaw.trim() : '';
    if (provider === 'openrouter') {
      if (override) return override;
      if (p.openrouterRuntimeModel?.trim()) return p.openrouterRuntimeModel.trim();
    } else if (override) {
      const parsed = parseOpenAiWorkspaceChatModel(override);
      if (parsed) return parsed;
    }
    return this.resolveAgentsRuntimeModel(workspaceId, null);
  }

  /** Valida override por agente contra o subset habilitado no workspace. */
  async assertAgentRuntimeModelAllowed(
    workspaceId: string,
    model: EOpenAiWorkspaceChatModel | string | undefined | null,
  ): Promise<void> {
    if (model === undefined || model === null) return;
    const s0 = typeof model === 'string' ? model.trim() : String(model);
    if (!s0) return;
    const p = (await this.getPlainPayload(workspaceId)) ?? {};
    const provider = p.llmProvider ??
      ((process.env.LLM_PROVIDER || this.env.LLM_PROVIDER) as TLlmProvider | undefined) ??
      DEFAULT_LLM_PROVIDER;

    if (provider === 'openrouter') {
      const isSlug = isOpenRouterStyleModelId(s0);
      const enumOk = parseOpenAiWorkspaceChatModel(s0) !== undefined;
      if (!isSlug && !enumOk) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Modelo invalido: use formato provedor/modelo (OpenRouter) ou um modelo GPT suportado.',
          400,
        );
      }
      const allow = p.allowedLlmModelIds?.map((x) => x.trim()).filter(Boolean) ?? [];
      if (allow.length > 0 && !allow.includes(s0)) {
        throw new AppError(
          'VALIDATION_ERROR',
          'O modelo escolhido nao esta na lista de modelos LLM permitidos deste workspace.',
          400,
        );
      }
      return;
    }

    const parsed = parseOpenAiWorkspaceChatModel(s0);
    if (!parsed) {
      throw new AppError('VALIDATION_ERROR', 'Modelo OpenAI invalido para o agente.', 400);
    }
    const allowed = availableWorkspaceChatModels(p.enabledOpenAiChatModels);
    if (!allowed.includes(parsed)) {
      throw new AppError(
        'VALIDATION_ERROR',
        'O modelo OpenAI escolhido nao esta habilitado para este workspace (Configuracoes > Integracoes).',
        400,
      );
    }
  }

  async assertImageGenerationModelAllowed(
    workspaceId: string,
    model: string | undefined | null,
  ): Promise<void> {
    const s0 = typeof model === 'string' ? model.trim() : '';
    if (!s0) return;
    if (s0 === 'dall-e-2' || s0 === 'dall-e-3') return;
    if (!isOpenRouterStyleModelId(s0)) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Modelo de imagem invalido: use dall-e-2, dall-e-3 ou formato provedor/modelo (OpenRouter).',
        400,
      );
    }
    const p = (await this.getPlainPayload(workspaceId)) ?? {};
    const allow = p.allowedLlmModelIds?.map((x) => x.trim()).filter(Boolean) ?? [];
    if (allow.length > 0 && !allow.includes(s0)) {
      throw new AppError(
        'VALIDATION_ERROR',
        'O modelo de imagem escolhido nao esta na lista de modelos LLM permitidos deste workspace.',
        400,
      );
    }
  }

  async getPlainSmtp(workspaceId: string) {
    const p = await this.getPlainPayload(workspaceId);
    return p?.smtp;
  }

  /** Tokens Slack do workspace (signing + bot) quando configurados ao nível do tenant */
  async getPlainSlackWorkspace(workspaceId: string): Promise<{
    signingSecret: string;
    botToken: string;
  } | null> {
    const p = await this.getPlainPayload(workspaceId);
    const s = p?.slack;
    if (s?.signingSecret?.trim() && s?.botToken?.trim()) {
      return { signingSecret: s.signingSecret.trim(), botToken: s.botToken.trim() };
    }
    return null;
  }

  async testOpenAi(workspaceId: string): Promise<{ ok: boolean; message: string }> {
    const config = await this.resolveLlmProviderConfig(workspaceId);
    if (!config) {
      return {
        ok: false,
        message: 'Nenhuma chave LLM configurada para este workspace (nem fallback de ambiente).',
      };
    }
    try {
      if (config.provider === 'openrouter') {
        return await this.testOpenRouterConnection(config);
      }
      const res = await fetch(`${OPENAI_BASE_URL}/models?limit=1`, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          ...(config.extraHeaders ?? {}),
        },
      });
      if (!res.ok) {
        const t = await res.text();
        return { ok: false, message: `OpenAI HTTP ${res.status}: ${t.slice(0, 200)}` };
      }
      return { ok: true, message: 'Ligacao OpenAI OK.' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, message: msg };
    }
  }

  private async testOpenRouterConnection(
    config: ILlmProviderConfig,
  ): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch(`${OPENROUTER_BASE_URL}/models?limit=1`, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          ...(preferOpenRouterTitleOverReferer(config.extraHeaders) ?? {}),
        },
      });
      if (!res.ok) {
        const t = await res.text();
        return { ok: false, message: `OpenRouter HTTP ${res.status}: ${t.slice(0, 200)}` };
      }
      return { ok: true, message: 'Ligacao OpenRouter OK.' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, message: msg };
    }
  }

  async testSmtp(workspaceId: string, toEmail: string): Promise<{ ok: boolean; message: string }> {
    const smtp = await this.getPlainSmtp(workspaceId);
    if (!smtp) {
      return { ok: false, message: 'SMTP nao configurado para este workspace.' };
    }
    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: Boolean(smtp.secure),
        auth: { user: smtp.user, pass: smtp.password },
      });
      const from = smtp.from?.trim() || smtp.user;
      await transporter.sendMail({
        from,
        to: toEmail,
        subject: '[Team Agents] Teste SMTP',
        text: 'Mensagem de teste do workspace.',
      });
      return { ok: true, message: 'E-mail de teste enviado.' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, message: msg };
    }
  }
}
