import pg from 'pg';
import type { IToolIntegrationContext } from '../../../shared/kernel/tool-integration.types.js';
import { getTeamGalleryService } from '../../teams/application/team-gallery.service.js';
import { assertReadOnlySelectSql } from './sql-readonly-guard.js';
import { logToolInvocation } from './tool-invocation-logger.js';

const MAX_ROWS = 100;

export async function executeDatabaseQuery(
  ctx: IToolIntegrationContext,
  args: { query?: string },
  meta: { workspaceId: string; correlationId?: string },
): Promise<string> {
  const url = ctx.database?.postgresReadOnlyUrl?.trim();
  if (!url) {
    return '[tool] database_query: configure postgresReadOnlyUrl em Configuracoes > Integracoes (ferramentas).';
  }
  const raw = (args.query ?? '').trim();
  if (!raw) {
    return '[tool] database_query: forneca query com SQL SELECT.';
  }
  let sql: string;
  try {
    sql = assertReadOnlySelectSql(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return `[tool] database_query: ${msg}`;
  }
  const client = new pg.Client({ connectionString: url, statement_timeout: 30_000 });
  try {
    await client.connect();
    const limited = sql.toLowerCase().includes('limit') ? sql : `${sql} LIMIT ${MAX_ROWS}`;
    const res = await client.query(limited);
    logToolInvocation({
      workspaceId: meta.workspaceId,
      tool: 'database_query',
      ok: true,
      correlationId: meta.correlationId,
      detail: { rowCount: res.rowCount },
    });
    return JSON.stringify({ rows: res.rows, rowCount: res.rowCount }, null, 0);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logToolInvocation({
      workspaceId: meta.workspaceId,
      tool: 'database_query',
      ok: false,
      correlationId: meta.correlationId,
      detail: { error: msg },
    });
    return `[tool] database_query erro: ${msg}`;
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function executeCrmAccess(
  ctx: IToolIntegrationContext,
  args: { query?: string },
  meta: { workspaceId: string; correlationId?: string },
): Promise<string> {
  const base = ctx.crm?.restBaseUrl?.trim();
  const token = ctx.crm?.bearerToken?.trim();
  if (!base) {
    return '[tool] crm_access: configure restBaseUrl em Integracoes (ferramentas CRM).';
  }
  const q = (args.query ?? '').trim() || '*';
  try {
    const url = new URL(base.endsWith('/') ? base.slice(0, -1) : base);
    url.searchParams.set('q', q);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url.toString(), { method: 'GET', headers, signal: AbortSignal.timeout(30_000) });
    const text = await res.text();
    logToolInvocation({
      workspaceId: meta.workspaceId,
      tool: 'crm_access',
      ok: res.ok,
      correlationId: meta.correlationId,
      detail: { status: res.status },
    });
    return text.slice(0, 50_000);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logToolInvocation({
      workspaceId: meta.workspaceId,
      tool: 'crm_access',
      ok: false,
      correlationId: meta.correlationId,
      detail: { error: msg },
    });
    return `[tool] crm_access erro: ${msg}`;
  }
}

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

const DALLE2_SIZES = new Set(['256x256', '512x512', '1024x1024']);
const DALLE3_SIZES = new Set(['1024x1024', '1792x1024', '1024x1792']);

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

/**
 * OpenAI Images API (DALL-E 2 / DALL-E 3). Returns Markdown with HTTPS URL for downstream UI/Telegram.
 */
export async function executeImageGeneration(
  ctx: IToolIntegrationContext,
  args: { prompt?: string; size?: string; model?: string },
  meta: {
    workspaceId: string;
    correlationId?: string;
    teamContext?: { teamId: string; teamName: string };
  },
): Promise<string> {
  const apiKey = ctx.openai?.apiKey?.trim();
  if (!apiKey) {
    return '[tool] image_generation: configure chave OpenAI em Integracoes (ou OPENAI_API_KEY no ambiente).';
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
        imageUrl: url,
      });
      if (persisted) {
        const publicBase = (process.env.PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
        const pathSeg = `/api/v1/teams/${encodeURIComponent(tc.teamId)}/gallery/${encodeURIComponent(persisted.subjectSlug)}/file/${encodeURIComponent(persisted.filename)}`;
        const galleryHref = publicBase ? `${publicBase}${pathSeg}` : pathSeg;
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
