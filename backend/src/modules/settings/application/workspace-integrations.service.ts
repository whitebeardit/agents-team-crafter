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
    return { secretsMasked: maskIntegrationsForApi(plain) };
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
      );
    if (!hasAny) {
      await this.workspaceRepo.setIntegrationSecretsEncrypted(workspaceId, null);
      return maskIntegrationsForApi(null);
    }
    const enc = encryptJson(this.requireMasterKey(), next);
    await this.workspaceRepo.setIntegrationSecretsEncrypted(workspaceId, enc);
    return maskIntegrationsForApi(next);
  }

  async resolveOpenAiApiKey(workspaceId: string): Promise<string | undefined> {
    const p = await this.getPlainPayload(workspaceId);
    const w = p?.openaiApiKey?.trim();
    if (w) return w;
    return (
      process.env.OPENAI_API_KEY?.trim() ||
      this.env.OPENAI_API_KEY?.trim() ||
      undefined
    );
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
