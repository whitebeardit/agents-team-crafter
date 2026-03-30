import { tool } from '@openai/agents';
import { z } from 'zod';
import type { IWorkspaceCustomToolDefinition } from '../ports/agent-runtime.provider.js';
import { logToolInvocation } from './tool-invocation-logger.js';

const genericArgs = z.object({
  query: z.string().optional().describe('Payload or query string for the tool'),
});

function slugToToolName(slug: string): string {
  const s = slug.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
  return `ws_${s}`.slice(0, 64);
}

/**
 * Tools registadas pelo workspace (HTTP webhook, etc.).
 */
export function buildWorkspaceCustomTools(
  defs: IWorkspaceCustomToolDefinition[],
  meta: { workspaceId: string; correlationId?: string },
): unknown[] {
  const out: unknown[] = [];
  for (const def of defs) {
    if (def.kind === 'http_webhook') {
      const url = typeof def.config.url === 'string' ? def.config.url.trim() : '';
      const method = (def.config.method === 'GET' ? 'GET' : 'POST') as 'GET' | 'POST';
      const headers = (def.config.headers as Record<string, string> | undefined) ?? {};
      const secretName = typeof def.config.secretHeaderName === 'string' ? def.config.secretHeaderName : '';
      const secretValue = typeof def.config.secretHeaderValue === 'string' ? def.config.secretHeaderValue : '';
      if (!url) continue;
      out.push(
        tool({
          name: slugToToolName(def.slug || def.id),
          description: def.name + ' (webhook)',
          parameters: genericArgs,
          execute: async (input) => {
            try {
              const h: Record<string, string> = {
                'Content-Type': 'application/json',
                ...headers,
              };
              if (secretName && secretValue) h[secretName] = secretValue;
              const res = await fetch(url, {
                method,
                headers: h,
                body:
                  method === 'POST'
                    ? JSON.stringify({
                        toolDefinitionId: def.id,
                        input,
                        workspaceId: meta.workspaceId,
                      })
                    : undefined,
                signal: AbortSignal.timeout(60_000),
              });
              const text = await res.text();
              logToolInvocation({
                workspaceId: meta.workspaceId,
                tool: `custom_webhook:${def.id}`,
                ok: res.ok,
                correlationId: meta.correlationId,
                detail: { status: res.status },
              });
              return text.slice(0, 100_000);
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              logToolInvocation({
                workspaceId: meta.workspaceId,
                tool: `custom_webhook:${def.id}`,
                ok: false,
                correlationId: meta.correlationId,
                detail: { error: msg },
              });
              return `[custom_tool] erro: ${msg}`;
            }
          },
        }),
      );
      continue;
    }
    if (def.kind === 'builtin_ref') {
      const ref = typeof def.config.builtinId === 'string' ? def.config.builtinId : '';
      out.push(
        tool({
          name: slugToToolName(def.slug || def.id),
          description: `Alias para builtin ${ref}: ${def.name}`,
          parameters: genericArgs,
          execute: async () =>
            `[custom_tool] builtin_ref ${ref}: use as ferramentas catalog padrao no agente.`,
        }),
      );
      continue;
    }
    out.push(
      tool({
        name: slugToToolName(def.slug || def.id),
        description: def.name + ' (mcp_ref — configure MCP HTTP no registo MCP)',
        parameters: genericArgs,
        execute: async () => `[custom_tool] mcp_ref nao executado aqui; use vinculo MCP com HTTP.`,
      }),
    );
  }
  return out;
}
