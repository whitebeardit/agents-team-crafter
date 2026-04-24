import { createHash } from 'node:crypto';

/** Alinhado a `teamRunBodySchema` (conversationId max 128). */
const MAX_LEN = 128;
const PREFIX = 'inbound:';

function normalizePlatformLabel(platformLabel: string): string {
  const s = platformLabel
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (s.length > 0 ? s : 'unknown').slice(0, 24);
}

/**
 * ID de sessão de debug estabelecido e determinístico por fio (Chat SDK `thread.id` + rótulo do adapter).
 * Usado com `TeamDebugSession` (lista de sessões / auditoria) para inbound, como o UUID do console.
 */
export function buildInboundDebugConversationId(platformLabel: string, threadId: string): string {
  const p = normalizePlatformLabel(platformLabel);
  const t = (threadId ?? '').trim();
  if (!t) {
    return `${PREFIX}${p}:no-thread`.slice(0, MAX_LEN);
  }
  const base = `${PREFIX}${p}:`;
  if (base.length + t.length <= MAX_LEN) {
    return base + t;
  }
  const h = createHash('sha256').update(t, 'utf8').digest('hex');
  return (base + h).slice(0, MAX_LEN);
}
