import type { IEnv } from '../../../config/env.js';
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

function integrationPayloadHasSecrets(next: IWorkspaceIntegrationsPayload): boolean {
  return (
    Boolean(next.openaiApiKey?.trim()) ||
    Boolean(next.smtp?.host?.trim() && next.smtp?.user?.trim() && next.smtp?.password?.trim()) ||
    Boolean(
      next.slack &&
        Object.values(next.slack).some((v) => typeof v === 'string' && v.trim().length > 0),
    ) ||
    Boolean(next.toolCalendar?.restBaseUrl?.trim() || next.toolCalendar?.authHeader?.trim()) ||
    Boolean(next.imageGenerationModel) ||
    Boolean(next.enabledOpenAiChatModels?.length) ||
    Boolean(next.agentsRuntimeModel) ||
    Boolean(next.teamPlannerModel)
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
      };
    }
    const enc = encryptJson(this.requireMasterKey(), next);
    await this.workspaceRepo.setIntegrationSecretsEncrypted(workspaceId, enc);
    const ctxAfter = await this.getToolIntegrationContext(workspaceId);
    return {
      secretsMasked: maskIntegrationsForApi(next),
      operationalCatalogTools: resolveOperationalCatalogTools(ctxAfter),
      availableOpenAiChatModels: availableWorkspaceChatModels(next.enabledOpenAiChatModels),
    };
  }

  /** Contexto para tools builtin (catalog) no runtime de agentes. */
  async getToolIntegrationContext(workspaceId: string): Promise<IToolIntegrationContext> {
    const p = await this.getPlainPayload(workspaceId);
    if (!p) return {};
    const out: IToolIntegrationContext = {};
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

  async resolveTeamPlannerModel(workspaceId: string): Promise<EOpenAiWorkspaceChatModel> {
    const p = (await this.getPlainPayload(workspaceId)) ?? {};
    return pickResolvedWorkspaceChatModel({
      preferenceChain: [p.teamPlannerModel, parseTeamPlannerModelFromEnv()],
      enabled: p.enabledOpenAiChatModels,
      productDefault: DEFAULT_TEAM_PLANNER_MODEL,
    });
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

  /** Valida override por agente contra o subset habilitado no workspace. */
  async assertAgentRuntimeModelAllowed(
    workspaceId: string,
    model: EOpenAiWorkspaceChatModel | undefined | null,
  ): Promise<void> {
    if (model === undefined || model === null) return;
    const p = (await this.getPlainPayload(workspaceId)) ?? {};
    const allowed = availableWorkspaceChatModels(p.enabledOpenAiChatModels);
    if (!allowed.includes(model)) {
      throw new AppError(
        'VALIDATION_ERROR',
        'O modelo OpenAI escolhido nao esta habilitado para este workspace (Configuracoes > Integracoes).',
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
    const key = await this.resolveOpenAiApiKey(workspaceId);
    if (!key) {
      return { ok: false, message: 'Nenhuma chave OpenAI configurada para este workspace (nem fallback de ambiente).' };
    }
    try {
      const res = await fetch('https://api.openai.com/v1/models?limit=1', {
        headers: { Authorization: `Bearer ${key}` },
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
