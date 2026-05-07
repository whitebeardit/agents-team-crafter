/** Tamanho máximo do cabeçalho X-OpenRouter-Title (OpenRouter trunca em dashboards). */
export const OPENROUTER_DASHBOARD_TITLE_MAX = 200;

/**
 * Normaliza cabeçalhos de atribuição OpenRouter antes de enviar no fetch/SDK.
 *
 * A documentação oficial exige **`HTTP-Referer`** para criar/atribuir a app nos logs e rankings;
 * `X-OpenRouter-Title` só acompanha o nome — **deve ir em conjunto** com o Referer, nunca em substituição.
 *
 * @see https://openrouter.ai/docs/app-attribution
 */
export function preferOpenRouterTitleOverReferer(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers || Object.keys(headers).length === 0) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    const t = typeof v === 'string' ? v.trim() : '';
    if (t) out[k] = t;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

const SEGMENT_DEFAULT_MAX = 80;
const APP_SEGMENT_MAX = 48;

/**
 * Normaliza um segmento do título exibido no dashboard OpenRouter (coluna App).
 * Remove quebras de linha, barras que quebrariam o formato a/b/c, e caracteres não imprimíveis ASCII.
 */
export function sanitizeOpenRouterTitleSegment(raw: string, maxLen: number = SEGMENT_DEFAULT_MAX): string {
  const collapsed = raw.replace(/[\r\n\t]+/g, ' ').replace(/[/\\]+/g, '-').trim();
  const ascii = collapsed.replace(/[^\x20-\x7E]+/g, '_');
  const cut = ascii.slice(0, maxLen).trim();
  return cut.length > 0 ? cut : 'unnamed';
}

/**
 * Extrai um rótulo curto de origem a partir do `HTTP-Referer` (host + porta não standard).
 * Usado no início de {@link buildOpenRouterDashboardTitle} para uma única string no dashboard OpenRouter.
 */
export function openRouterOriginLabelFromHttpReferer(raw: string | undefined): string | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  try {
    const u = new URL(t);
    const host = u.hostname;
    const port = u.port && u.port !== '80' && u.port !== '443' ? `:${u.port}` : '';
    const label = `${host}${port}`;
    return sanitizeOpenRouterTitleSegment(label, 96);
  } catch {
    return sanitizeOpenRouterTitleSegment(t.replace(/^https?:\/\//i, ''), 96);
  }
}

/**
 * Uma única string para `X-OpenRouter-Title`: opcionalmente
 * `<origem> | <appSlug>/<workspaceName>/<agentName>`.
 * A origem vem do host do `HTTP-Referer` (mesmo URL enviado ao OpenRouter para atribuição de app).
 */
export function buildOpenRouterDashboardTitle(parts: {
  appSlug: string;
  workspaceName: string;
  agentName: string;
  publicOrigin?: string | undefined;
}): string {
  const originRaw = parts.publicOrigin?.trim();
  const origin = originRaw ? sanitizeOpenRouterTitleSegment(originRaw, 96) : '';
  const a = sanitizeOpenRouterTitleSegment(parts.appSlug, APP_SEGMENT_MAX);
  const w = sanitizeOpenRouterTitleSegment(parts.workspaceName, SEGMENT_DEFAULT_MAX);
  const g = sanitizeOpenRouterTitleSegment(parts.agentName, SEGMENT_DEFAULT_MAX);
  const core = `${a}/${w}/${g}`;
  const full = origin ? `${origin} | ${core}` : core;
  return full.length > OPENROUTER_DASHBOARD_TITLE_MAX ? full.slice(0, OPENROUTER_DASHBOARD_TITLE_MAX) : full;
}
