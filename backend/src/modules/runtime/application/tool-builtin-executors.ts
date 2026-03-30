import pg from 'pg';
import type { IToolIntegrationContext } from '../../../shared/kernel/tool-integration.types.js';
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
