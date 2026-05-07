import type { IToolIntegrationContext } from '../../../shared/kernel/tool-integration.types.js';
import { OPENROUTER_BASE_URL, resolveModelIdForProvider } from '../../../shared/kernel/llm-provider-config.js';
import { getTeamGalleryService } from '../../teams/application/team-gallery.service.js';
import { logToolInvocation } from './tool-invocation-logger.js';

export async function executeCalendarAccess(
  ctx: IToolIntegrationContext,
  args: { query?: string },
  meta: { workspaceId: string; correlationId?: string },
): Promise<string> {
  const base = ctx.calendar?.restBaseUrl?.trim();
  const authHeader = ctx.calendar?.authHeader?.trim();
  if (!base) {
    return '[tool] calendar_access: configure restBaseUrl em Integracoes (ferramentas calendario).';
  }
  const path = (args.query ?? '').trim() || '/';
  try {
    const url = new URL(path.replace(/^\//, ''), base.endsWith('/') ? base : `${base}/`);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;
    const res = await fetch(url.toString(), { method: 'GET', headers, signal: AbortSignal.timeout(30_000) });
    const text = await res.text();
    logToolInvocation({
      workspaceId: meta.workspaceId,
      tool: 'calendar_access',
      ok: res.ok,
      correlationId: meta.correlationId,
      detail: { status: res.status },
    });
    return text.slice(0, 50_000);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logToolInvocation({
      workspaceId: meta.workspaceId,
      tool: 'calendar_access',
      ok: false,
      correlationId: meta.correlationId,
      detail: { error: msg },
    });
    return `[tool] calendar_access erro: ${msg}`;
  }
}

export type TOpenAiImageModel = 'dall-e-2' | 'dall-e-3';
export type TImageToolProvider = 'default' | 'openai' | 'openrouter';

const DALLE2_SIZES = new Set(['256x256', '512x512', '1024x1024']);
const DALLE3_SIZES = new Set(['1024x1024', '1792x1024', '1024x1792']);
const OPENROUTER_IMAGE_MODEL_DEFAULT = 'openai/gpt-image-1';
const OPENROUTER_TEXT_TOOL_MODEL_DEFAULT = 'openai/gpt-4o-mini';

function resolveEffectiveImageModel(
  args: { model?: string },
  ctx: IToolIntegrationContext,
): TOpenAiImageModel {
  const raw = (args.model ?? '').trim();
  if (raw === 'default' || raw === '') {
    return ctx.openai?.defaultImageModel ?? 'dall-e-3';
  }
  if (raw === 'dall-e-2' || raw === 'dall-e-3') return raw;
  return ctx.openai?.defaultImageModel ?? 'dall-e-3';
}

function normalizeSizeForImageModel(model: TOpenAiImageModel, sizeRaw: string): string {
  const set = model === 'dall-e-2' ? DALLE2_SIZES : DALLE3_SIZES;
  const t = sizeRaw.trim();
  if (set.has(t)) return t;
  return model === 'dall-e-2' ? '256x256' : '1024x1024';
}

function maxPromptCharsForImageModel(model: TOpenAiImageModel): number {
  return model === 'dall-e-2' ? 1000 : 3800;
}

function displayModelName(model: TOpenAiImageModel): string {
  return model === 'dall-e-2' ? 'DALL-E 2' : 'DALL-E 3';
}

function openRouterHeaders(ctx: IToolIntegrationContext): Record<string, string> | null {
  const apiKey = ctx.openrouter?.apiKey?.trim();
  if (!apiKey) return null;
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...(ctx.openrouter?.extraHeaders ?? {}),
  };
}

function openRouterChatCompletionsUrl(ctx: IToolIntegrationContext): string {
  const base = (ctx.openrouter?.baseUrl?.trim() || OPENROUTER_BASE_URL).replace(/\/+$/, '');
  return `${base}/chat/completions`;
}

function normalizeOpenRouterModel(raw: string | undefined, fallback: string): string {
  const t = raw?.trim();
  if (!t || t === 'default') return fallback;
  return resolveModelIdForProvider(t, 'openrouter');
}

function extractFirstHttpsUrl(text: string): string | undefined {
  const m = text.match(/https:\/\/[^\s)]+/);
  return m?.[0]?.trim();
}

function extractDataUrlFromUnknown(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const m = value.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/);
    return m?.[0];
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractDataUrlFromUnknown(item);
      if (found) return found;
    }
    return undefined;
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      const found = extractDataUrlFromUnknown(v);
      if (found) return found;
    }
  }
  return undefined;
}

function dataUrlToBuffer(dataUrl: string): { bytes: Buffer; contentType: string } | null {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  return {
    contentType: m[1],
    bytes: Buffer.from(m[2], 'base64'),
  };
}

function teamGalleryHref(params: {
  teamId: string;
  subjectSlug: string;
  filename: string;
}): string {
  const publicBase = (process.env.PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
  const pathSeg = `/api/v1/teams/${encodeURIComponent(params.teamId)}/gallery/${encodeURIComponent(params.subjectSlug)}/file/${encodeURIComponent(params.filename)}`;
  return publicBase ? `${publicBase}${pathSeg}` : pathSeg;
}

async function persistOpenRouterDataUrlIfPossible(
  dataUrl: string,
  prompt: string,
  meta: {
    workspaceId: string;
    teamContext?: { teamId: string; teamName: string; gallerySubjectSlug?: string };
  },
): Promise<{ imageUrl: string; galleryNote: string }> {
  const tc = meta.teamContext;
  const decoded = dataUrlToBuffer(dataUrl);
  if (!tc?.teamId || !tc.teamName || !decoded) {
    return { imageUrl: dataUrl, galleryNote: '' };
  }
  const persisted = await getTeamGalleryService().persistBuffer({
    workspaceId: meta.workspaceId,
    teamId: tc.teamId,
    teamName: tc.teamName,
    prompt,
    subjectSlug: tc.gallerySubjectSlug,
    bytes: decoded.bytes,
    contentType: decoded.contentType,
  });
  if (!persisted) return { imageUrl: dataUrl, galleryNote: '' };
  const href = teamGalleryHref({
    teamId: tc.teamId,
    subjectSlug: persisted.subjectSlug,
    filename: persisted.filename,
  });
  return {
    imageUrl: href,
    galleryNote: [
      '',
      `Copia guardada na galeria do time (assunto: ${persisted.subjectSlug}; ${persisted.bytesWritten} bytes).`,
      href.startsWith('http')
        ? `URL da copia na API (requer autenticacao Bearer): ${href}`
        : `Caminho API da copia (defina PUBLIC_API_BASE_URL para URL absoluta): ${href}`,
    ].join('\n'),
  };
}

async function executeOpenRouterImageGeneration(
  ctx: IToolIntegrationContext,
  args: { prompt?: string; size?: string; model?: string },
  meta: {
    workspaceId: string;
    correlationId?: string;
    teamContext?: { teamId: string; teamName: string; gallerySubjectSlug?: string };
  },
): Promise<string> {
  const headers = openRouterHeaders(ctx);
  if (!headers) {
    return '[tool] image_generation: configure chave OpenRouter em Integracoes (ou OPENROUTER_API_KEY no ambiente).';
  }
  const prompt = (args.prompt ?? '').trim();
  if (!prompt) return '[tool] image_generation: forneca o campo prompt com o pedido da imagem.';
  const model = normalizeOpenRouterModel(
    args.model,
    ctx.openrouter?.defaultImageModel ?? OPENROUTER_IMAGE_MODEL_DEFAULT,
  );
  const size = (args.size ?? '').trim();
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    modalities: ['image'],
    ...(size ? { size } : {}),
  };
  try {
    const res = await fetch(openRouterChatCompletionsUrl(ctx), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    });
    const text = await res.text();
    if (!res.ok) {
      logToolInvocation({
        workspaceId: meta.workspaceId,
        tool: 'image_generation',
        ok: false,
        correlationId: meta.correlationId,
        detail: { provider: 'openrouter', status: res.status, model },
      });
      return `[tool] image_generation OpenRouter: HTTP ${res.status} — ${text.slice(0, 500)}`;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    const dataUrl = extractDataUrlFromUnknown(parsed);
    const httpsUrl = extractFirstHttpsUrl(text);
    const imageUrl = httpsUrl ?? dataUrl;
    if (!imageUrl) {
      logToolInvocation({
        workspaceId: meta.workspaceId,
        tool: 'image_generation',
        ok: false,
        correlationId: meta.correlationId,
        detail: { provider: 'openrouter', noImage: true, model },
      });
      return '[tool] image_generation OpenRouter: resposta sem imagem reconhecivel.';
    }
    const persisted = dataUrl && !httpsUrl
      ? await persistOpenRouterDataUrlIfPossible(dataUrl, prompt, meta)
      : { imageUrl, galleryNote: '' };
    logToolInvocation({
      workspaceId: meta.workspaceId,
      tool: 'image_generation',
      ok: true,
      correlationId: meta.correlationId,
      detail: { provider: 'openrouter', model, size: size || undefined },
    });
    return [
      `Imagem gerada (OpenRouter: ${model}). Inclui na tua resposta ao utilizador o Markdown abaixo (ou equivalente):`,
      '',
      `![Imagem gerada](${persisted.imageUrl})`,
      '',
      `URL: ${persisted.imageUrl}`,
      persisted.galleryNote,
    ].join('\n');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logToolInvocation({
      workspaceId: meta.workspaceId,
      tool: 'image_generation',
      ok: false,
      correlationId: meta.correlationId,
      detail: { provider: 'openrouter', error: msg, model },
    });
    return `[tool] image_generation OpenRouter erro: ${msg}`;
  }
}

export async function executeOpenRouterWebSearch(
  ctx: IToolIntegrationContext,
  args: { query?: string; model?: string },
  meta: { workspaceId: string; correlationId?: string; runtimeModel?: string },
): Promise<string> {
  const headers = openRouterHeaders(ctx);
  if (!headers) return '[tool] web_search: configure chave OpenRouter em Integracoes.';
  const query = (args.query ?? '').trim();
  if (!query) return '[tool] web_search: forneca query.';
  const model = normalizeOpenRouterModel(
    args.model,
    meta.runtimeModel ?? ctx.openrouter?.defaultModel ?? OPENROUTER_TEXT_TOOL_MODEL_DEFAULT,
  );
  try {
    const res = await fetch(openRouterChatCompletionsUrl(ctx), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: `Pesquise na web e responda com fontes: ${query}` }],
        tools: [{ type: 'openrouter:web_search', parameters: { max_results: 5 } }],
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const text = await res.text();
    logToolInvocation({
      workspaceId: meta.workspaceId,
      tool: 'web_search',
      ok: res.ok,
      correlationId: meta.correlationId,
      detail: { provider: 'openrouter', status: res.status, model },
    });
    if (!res.ok) return `[tool] web_search OpenRouter: HTTP ${res.status} — ${text.slice(0, 500)}`;
    const json = JSON.parse(text) as { choices?: Array<{ message?: { content?: unknown } }> };
    return String(json.choices?.[0]?.message?.content ?? text).slice(0, 50_000);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logToolInvocation({
      workspaceId: meta.workspaceId,
      tool: 'web_search',
      ok: false,
      correlationId: meta.correlationId,
      detail: { provider: 'openrouter', error: msg, model },
    });
    return `[tool] web_search OpenRouter erro: ${msg}`;
  }
}

export async function executeOpenRouterWebFetch(
  ctx: IToolIntegrationContext,
  args: { url?: string; query?: string; model?: string },
  meta: { workspaceId: string; correlationId?: string; runtimeModel?: string },
): Promise<string> {
  const headers = openRouterHeaders(ctx);
  if (!headers) return '[tool] web_fetch: configure chave OpenRouter em Integracoes.';
  const url = (args.url ?? args.query ?? '').trim();
  if (!url) return '[tool] web_fetch: forneca url.';
  const model = normalizeOpenRouterModel(
    args.model,
    meta.runtimeModel ?? ctx.openrouter?.defaultModel ?? OPENROUTER_TEXT_TOOL_MODEL_DEFAULT,
  );
  try {
    const res = await fetch(openRouterChatCompletionsUrl(ctx), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: `Leia e resuma o conteudo em ${url}` }],
        tools: [{ type: 'openrouter:web_fetch', parameters: { max_uses: 3, max_content_tokens: 50_000 } }],
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const text = await res.text();
    logToolInvocation({
      workspaceId: meta.workspaceId,
      tool: 'web_fetch',
      ok: res.ok,
      correlationId: meta.correlationId,
      detail: { provider: 'openrouter', status: res.status, model },
    });
    if (!res.ok) return `[tool] web_fetch OpenRouter: HTTP ${res.status} — ${text.slice(0, 500)}`;
    const json = JSON.parse(text) as { choices?: Array<{ message?: { content?: unknown } }> };
    return String(json.choices?.[0]?.message?.content ?? text).slice(0, 50_000);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logToolInvocation({
      workspaceId: meta.workspaceId,
      tool: 'web_fetch',
      ok: false,
      correlationId: meta.correlationId,
      detail: { provider: 'openrouter', error: msg, model },
    });
    return `[tool] web_fetch OpenRouter erro: ${msg}`;
  }
}

/**
 * OpenAI Images API (DALL-E 2 / DALL-E 3). Returns Markdown with HTTPS URL for downstream UI/Telegram.
 */
export async function executeImageGeneration(
  ctx: IToolIntegrationContext,
  args: { prompt?: string; size?: string; model?: string; provider?: TImageToolProvider },
  meta: {
    workspaceId: string;
    correlationId?: string;
    teamContext?: { teamId: string; teamName: string; gallerySubjectSlug?: string };
  },
): Promise<string> {
  const provider = args.provider ?? 'default';
  const modelRaw = (args.model ?? '').trim();
  const shouldUseOpenRouter =
    provider === 'openrouter' ||
    (provider === 'default' &&
      Boolean(ctx.openrouter?.apiKey?.trim()) &&
      (ctx.activeLlmProvider === 'openrouter' || modelRaw.includes('/')));
  if (shouldUseOpenRouter) {
    return executeOpenRouterImageGeneration(ctx, args, meta);
  }
  const apiKey = ctx.openai?.apiKey?.trim();
  if (!apiKey) {
    return ctx.openrouter?.apiKey?.trim()
      ? executeOpenRouterImageGeneration(ctx, args, meta)
      : '[tool] image_generation: configure chave OpenAI ou OpenRouter em Integracoes (ou variaveis de ambiente).';
  }
  const prompt = (args.prompt ?? '').trim();
  if (!prompt) {
    return '[tool] image_generation: forneca o campo prompt com o pedido da imagem.';
  }
  const imageModel = resolveEffectiveImageModel(args, ctx);
  const sizeRaw = (args.size ?? (imageModel === 'dall-e-2' ? '256x256' : '1024x1024')).trim();
  const size = normalizeSizeForImageModel(imageModel, sizeRaw);
  const maxPrompt = maxPromptCharsForImageModel(imageModel);
  const body = {
    model: imageModel,
    prompt: prompt.slice(0, maxPrompt),
    n: 1,
    size,
    response_format: 'url' as const,
  };
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    const text = await res.text();
    if (!res.ok) {
      logToolInvocation({
        workspaceId: meta.workspaceId,
        tool: 'image_generation',
        ok: false,
        correlationId: meta.correlationId,
        detail: { status: res.status },
      });
      return `[tool] image_generation: HTTP ${res.status} — ${text.slice(0, 500)}`;
    }
    let url: string | undefined;
    try {
      const json = JSON.parse(text) as { data?: Array<{ url?: string }> };
      url = json.data?.[0]?.url?.trim();
    } catch {
      logToolInvocation({
        workspaceId: meta.workspaceId,
        tool: 'image_generation',
        ok: false,
        correlationId: meta.correlationId,
        detail: { parseError: true },
      });
      return '[tool] image_generation: resposta JSON invalida da API.';
    }
    if (!url?.startsWith('https://')) {
      logToolInvocation({
        workspaceId: meta.workspaceId,
        tool: 'image_generation',
        ok: false,
        correlationId: meta.correlationId,
        detail: { noUrl: true },
      });
      return '[tool] image_generation: API nao devolveu URL https.';
    }
    logToolInvocation({
      workspaceId: meta.workspaceId,
      tool: 'image_generation',
      ok: true,
      correlationId: meta.correlationId,
      detail: { size, model: imageModel },
    });

    let galleryNote = '';
    const tc = meta.teamContext;
    if (tc?.teamId && tc.teamName) {
      const persisted = await getTeamGalleryService().persistFromUrl({
        workspaceId: meta.workspaceId,
        teamId: tc.teamId,
        teamName: tc.teamName,
        prompt,
        subjectSlug: tc.gallerySubjectSlug,
        imageUrl: url,
      });
      if (persisted) {
        const publicBase = (process.env.PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
        const pathSeg = `/api/v1/teams/${encodeURIComponent(tc.teamId)}/gallery/${encodeURIComponent(persisted.subjectSlug)}/file/${encodeURIComponent(persisted.filename)}`;
        const galleryHref = publicBase ? `${publicBase}${pathSeg}` : pathSeg;
        url = galleryHref;
        galleryNote = [
          '',
          `Copia guardada na galeria do time (assunto: ${persisted.subjectSlug}; ${persisted.bytesWritten} bytes).`,
          publicBase
            ? `URL da copia na API (requer autenticacao Bearer): ${galleryHref}`
            : `Caminho API da copia (defina PUBLIC_API_BASE_URL para URL absoluta): ${galleryHref}`,
        ].join('\n');
      }
    }

    return [
      `Imagem gerada (${displayModelName(imageModel)}). Inclui na tua resposta ao utilizador o Markdown abaixo (ou equivalente):`,
      '',
      `![Imagem gerada](${url})`,
      '',
      `URL: ${url}`,
      galleryNote,
    ].join('\n');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logToolInvocation({
      workspaceId: meta.workspaceId,
      tool: 'image_generation',
      ok: false,
      correlationId: meta.correlationId,
      detail: { error: msg },
    });
    return `[tool] image_generation erro: ${msg}`;
  }
}
