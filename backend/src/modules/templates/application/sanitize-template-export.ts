import type { TAgentExportPayload } from '../../agents/application/build-agent-export.js';
import type {
  TTeamExportChannelFullSnapshot,
  TTeamExportPayload,
} from '../../teams/application/build-team-export.js';

const SENSITIVE_AGENT_ROOT_KEYS = new Set([
  'security',
  'channelConfig',
  'knowledge',
  'capabilities',
]);

/**
 * Resultado de export de time apto a partilhar / catálogo, sem credenciais.
 * Mesma forma que `TTeamExportPayload` excepto `exportKind` e metadado `templateSourceTeamId` opcional.
 */
export type TTeamTemplateExportPayload = Omit<TTeamExportPayload, 'exportKind' | 'exportedAt'> & {
  exportKind: 'template';
  /** Id do time de origem (referência interna, pode omitir no download público). */
  templateSourceTeamId?: string;
  exportedAt: string;
};

/**
 * Limpa um `TAgentExportPayload` de dados que não devem constar no JSON de template.
 * Remove `mcpBindings`? — Não: inclui ligação MCP (IDs) para o import; sem segredos nas ligações.
 * Remove nós conhecidos de credencial em `agent` e aninhados.
 */
export function sanitizeAgentForTemplate(exp: TAgentExportPayload): TAgentExportPayload {
  const a = (exp as { agent?: Record<string, unknown> }).agent
    ? { ...((exp as { agent: Record<string, unknown> }).agent) }
    : undefined;
  if (a) {
    for (const k of SENSITIVE_AGENT_ROOT_KEYS) {
      if (k in a) delete a[k];
    }
    if (a.domain && typeof a.domain === 'object' && a.domain !== null) {
      const d = { ...(a.domain as Record<string, unknown>) };
      for (const sk of Object.keys(d)) {
        if (/key|token|password|secret|credential/i.test(sk)) delete d[sk];
      }
      a.domain = d;
    }
  }
  if (!a) return { ...exp };
  const next = { ...exp, agent: a } as TAgentExportPayload;
  if ('sections' in (exp as object) && (exp as { sections?: unknown }).sections) {
    (next as { sections?: unknown }).sections = (exp as { sections?: unknown }).sections;
  }
  return next;
}

function sanitizeChannelFull(
  c: TTeamExportChannelFullSnapshot,
): TTeamExportChannelFullSnapshot {
  const hadSecret = Boolean(c.secretsEncrypted);
  const { secretsEncrypted: _r, ...rest } = c;
  const out: TTeamExportChannelFullSnapshot = {
    ...rest,
  };
  if (hadSecret) {
    (out as TTeamExportChannelFullSnapshot & { secretRequired?: boolean }).secretRequired = true;
  }
  const config = c.config as Record<string, unknown> | undefined;
  if (config && typeof config === 'object') {
    const cfg = { ...config };
    for (const k of Object.keys(cfg)) {
      if (/token|secret|password|key|bearer|authorization/i.test(k)) delete cfg[k];
    }
    out.config = cfg;
  } else {
    out.config = (config ?? {}) as Record<string, unknown>;
  }
  return out;
}

/**
 * Constrói um `exportKind: template` a partir de export de time completo, sem vazar segredos.
 * Marca canais com `secretRequired: true` quando o export tinha `secretsEncrypted`.
 */
export function sanitizeTeamExportToTemplate(
  teamExport: TTeamExportPayload,
  opts?: { includeSourceTeamId?: boolean; sourceTeamId?: string },
): TTeamTemplateExportPayload {
  const out: TTeamTemplateExportPayload = {
    ...teamExport,
    exportKind: 'template',
    exportedAt: new Date().toISOString(),
    team: { ...(teamExport.team as Record<string, unknown>) },
    channelsFull: (teamExport.channelsFull ?? []).map(sanitizeChannelFull),
    agents: (teamExport.agents ?? []).map(sanitizeAgentForTemplate),
  };

  if (opts?.includeSourceTeamId && opts.sourceTeamId) {
    out.templateSourceTeamId = opts.sourceTeamId;
  }

  return out;
}

/**
 * Rejeita se o payload ainda tiver cifrado embutido (pode ser fuga vinda do cliente).
 */
export function assertTemplatePayloadHasNoEncryptedSecrets(
  p: TTeamTemplateExportPayload,
): { ok: true } | { ok: false; reason: string } {
  for (const ch of p.channelsFull ?? []) {
    if (ch.secretsEncrypted) {
      return { ok: false, reason: 'channelsFull: secretsEncrypted nao e permitido em template' };
    }
  }
  return { ok: true };
}
