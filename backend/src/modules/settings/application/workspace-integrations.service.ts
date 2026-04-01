import type { IEnv } from '../../../config/env.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { decryptJson, encryptJson } from '../../../utils/secrets-crypto.js';
import type { WorkspaceRepository } from '../../workspaces/infra/workspace.repository.js';
import {
  type IWorkspaceIntegrationsPayload,
  type IPutWorkspaceIntegrationsBody,
  maskIntegrationsForApi,
  mergeWorkspaceIntegrationsPayload,
} from '../domain/workspace-integrations.schema.js';
import type { IToolIntegrationContext } from '../../../shared/kernel/tool-integration.types.js';
import { resolveOperationalCatalogTools } from '../../agents/domain/operational-catalog-tools.js';
import nodemailer from 'nodemailer';

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
      return decryptJson<IWorkspaceIntegrationsPayload>(k, enc);
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
    };
  }

  async putPartial(workspaceId: string, patch: IPutWorkspaceIntegrationsBody) {
    const current = (await this.getPlainPayload(workspaceId)) ?? {};
    const next = mergeWorkspaceIntegrationsPayload(current, patch);
    const hasAny =
      Boolean(next.openaiApiKey?.trim()) ||
      Boolean(next.smtp?.host?.trim() && next.smtp?.user?.trim() && next.smtp?.password?.trim()) ||
      Boolean(
        next.slack &&
          Object.values(next.slack).some((v) => typeof v === 'string' && v.trim().length > 0),
      ) ||
      Boolean(next.toolDatabase?.postgresReadOnlyUrl?.trim()) ||
      Boolean(next.toolCrm?.restBaseUrl?.trim() || next.toolCrm?.bearerToken?.trim()) ||
      Boolean(next.toolCalendar?.restBaseUrl?.trim() || next.toolCalendar?.authHeader?.trim());
    if (!hasAny) {
      await this.workspaceRepo.setIntegrationSecretsEncrypted(workspaceId, null);
      return {
        secretsMasked: maskIntegrationsForApi(null),
        operationalCatalogTools: resolveOperationalCatalogTools({}),
      };
    }
    const enc = encryptJson(this.requireMasterKey(), next);
    await this.workspaceRepo.setIntegrationSecretsEncrypted(workspaceId, enc);
    const ctxAfter = await this.getToolIntegrationContext(workspaceId);
    return {
      secretsMasked: maskIntegrationsForApi(next),
      operationalCatalogTools: resolveOperationalCatalogTools(ctxAfter),
    };
  }

  /** Contexto para tools builtin (catalog) no runtime de agentes. */
  async getToolIntegrationContext(workspaceId: string): Promise<IToolIntegrationContext> {
    const p = await this.getPlainPayload(workspaceId);
    if (!p) return {};
    const out: IToolIntegrationContext = {};
    if (p.toolDatabase?.postgresReadOnlyUrl?.trim()) {
      out.database = { postgresReadOnlyUrl: p.toolDatabase.postgresReadOnlyUrl.trim() };
    }
    if (p.toolCrm?.restBaseUrl?.trim() || p.toolCrm?.bearerToken?.trim()) {
      out.crm = {
        restBaseUrl: p.toolCrm.restBaseUrl?.trim(),
        bearerToken: p.toolCrm.bearerToken?.trim(),
      };
    }
    if (p.toolCalendar?.restBaseUrl?.trim() || p.toolCalendar?.authHeader?.trim()) {
      out.calendar = {
        restBaseUrl: p.toolCalendar.restBaseUrl?.trim(),
        authHeader: p.toolCalendar.authHeader?.trim(),
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
