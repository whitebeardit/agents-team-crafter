import { tool } from '@openai/agents';
import { z } from 'zod';
import type { TAvailableToolId } from '../../agents/domain/available-tools.js';
import { isAllowedTool } from '../../agents/domain/available-tools.js';
import type { IMcpToolSpec } from '../ports/agent-runtime.provider.js';
import type { IToolIntegrationContext } from '../../../shared/kernel/tool-integration.types.js';
import {
  executeCalendarAccess,
  executeDatabaseQuery,
  executeImageGeneration,
} from './tool-builtin-executors.js';
import { logToolInvocation } from './tool-invocation-logger.js';

const CATALOG_STUB: Record<
  TAvailableToolId,
  { description: string; stubResult: (input: Record<string, unknown>) => string }
> = {
  web_search: {
    description: 'Search the public web for up-to-date information (stub until wired to a search API).',
    stubResult: () =>
      '[catalog_stub] web_search: integrate a search provider; returning placeholder. Include URLs in the user message for best results today.',
  },
  file_search: {
    description: 'Search uploaded or connected files (stub).',
    stubResult: () =>
      '[catalog_stub] file_search: connect a file index; no retrieval executed in this runtime.',
  },
  internal_actions: {
    description: 'Execute approved internal workspace actions (stub).',
    stubResult: () =>
      '[catalog_stub] internal_actions: wire to your action backend; execution not performed here.',
  },
  code_execution: {
    description: 'Run code in a sandbox (stub).',
    stubResult: () =>
      '[catalog_stub] code_execution: sandbox not available in this runtime.',
  },
  email_send: {
    description: 'Send email via connected provider (stub).',
    stubResult: () => '[catalog_stub] email_send: SMTP/API not invoked in this runtime.',
  },
  calendar_access: {
    description: 'Read or write calendar events via REST integration or stub.',
    stubResult: () =>
      '[catalog_stub] calendar_access: configure toolCalendar.restBaseUrl em Integracoes.',
  },
  database_query: {
    description: 'Run a read-only SQL query (Postgres) when URL configured, else stub.',
    stubResult: () =>
      '[catalog_stub] database_query: configure toolDatabase.postgresReadOnlyUrl em Integracoes.',
  },
  image_generation: {
    description: 'Generate images via OpenAI (DALL-E 2/3) when API key is configured.',
    stubResult: () =>
      '[catalog_stub] image_generation: configure chave OpenAI em Integracoes (ou OPENAI_API_KEY) para gerar imagens reais.',
  },
};

const catalogArgs = z.object({
  query: z.string().optional().describe('Optional query, path, or SQL depending on the tool'),
});

/**
 * Sizes cover DALL-E 2 and DALL-E 3; executor normalizes invalid size for the resolved model.
 * All keys required for strict OpenAI function JSON Schema validation.
 */
export const imageGenerationArgs = z.object({
  prompt: z
    .string()
    .min(1)
    .max(3800)
    .describe('Detailed prompt describing the image (DALL-E 2 max 1000 chars enforced server-side).'),
  size: z
    .enum(['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'])
    .describe(
      'DALL-E 2: 256x256, 512x512, 1024x1024. DALL-E 3: 1024x1024, 1792x1024, 1024x1792. Square social: prefer 1024x1024 or 256x256 for lower cost.',
    ),
  model: z
    .enum(['dall-e-2', 'dall-e-3', 'default'])
    .describe(
      'Use default to apply workspace Integrations default model; otherwise dall-e-2 (lower cost) or dall-e-3 (quality).',
    ),
});

export type TBuildCatalogMeta = {
  workspaceId: string;
  correlationId?: string;
  teamContext?: { teamId: string; teamName: string };
};

/**
 * Function tools do catálogo (IDs persistidos em capabilities.tools).
 */
export function buildCapabilityCatalogTools(
  toolIds: string[],
  integration: IToolIntegrationContext | undefined,
  meta: TBuildCatalogMeta,
): unknown[] {
  const out: unknown[] = [];
  const ctx = integration ?? {};

  for (const id of toolIds) {
    if (!isAllowedTool(id)) continue;
    const bid = id as TAvailableToolId;

    if (bid === 'database_query' && ctx.database?.postgresReadOnlyUrl) {
      out.push(
        tool({
          name: `catalog_${id}`.slice(0, 64),
          description:
            'Run a read-only SQL query against the workspace Postgres (SELECT/WITH only, LIMIT applied).',
          parameters: catalogArgs,
          execute: async (input) =>
            executeDatabaseQuery(ctx, input as { query?: string }, {
              workspaceId: meta.workspaceId,
              correlationId: meta.correlationId,
            }),
        }),
      );
      continue;
    }
    if (bid === 'calendar_access' && ctx.calendar?.restBaseUrl) {
      out.push(
        tool({
          name: `catalog_${id}`.slice(0, 64),
          description: 'GET calendar REST endpoint; query field is relative path.',
          parameters: catalogArgs,
          execute: async (input) =>
            executeCalendarAccess(ctx, input as { query?: string }, {
              workspaceId: meta.workspaceId,
              correlationId: meta.correlationId,
            }),
        }),
      );
      continue;
    }
    if (bid === 'image_generation' && ctx.openai?.apiKey) {
      out.push(
        tool({
          name: `catalog_${id}`.slice(0, 64),
          description:
            'Generate an image with OpenAI Images API (DALL-E 2 or DALL-E 3). Returns Markdown ![...](https://...) with a public HTTPS URL. Set model to default to use the workspace default from Integrations.',
          parameters: imageGenerationArgs,
          execute: async (input) =>
            executeImageGeneration(ctx, input as { prompt?: string; size?: string; model?: string }, {
              workspaceId: meta.workspaceId,
              correlationId: meta.correlationId,
              teamContext: meta.teamContext,
            }),
        }),
      );
      continue;
    }

    const metaStub = CATALOG_STUB[bid];
    out.push(
      tool({
        name: `catalog_${id}`.slice(0, 64),
        description: metaStub.description,
        parameters: catalogArgs,
        execute: async (input) => {
          logToolInvocation({
            workspaceId: meta.workspaceId,
            tool: `catalog_${id}`,
            ok: true,
            correlationId: meta.correlationId,
            detail: { stub: true },
          });
          return metaStub.stubResult(input as Record<string, unknown>);
        },
      }),
    );
  }
  return out;
}

function sanitizeToolNamePart(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
}

/**
 * Function tools espelhando MCPs vinculados (HTTP ou stub).
 */
export function buildMcpSdkTools(
  specs: IMcpToolSpec[],
  meta: TBuildCatalogMeta,
): unknown[] {
  return specs.map((spec) => {
    const safeBinding = sanitizeToolNamePart(spec.bindingId);
    const safeTool = sanitizeToolNamePart(spec.toolName);
    const name = `mcp_${safeBinding}_${safeTool}`.slice(0, 64);
    return tool({
      name,
      description: `${spec.toolDescription} (MCP: ${spec.mcpDisplayName})`,
      parameters: z.object({
        arguments: z
          .string()
          .optional()
          .describe('JSON or free-form payload for the MCP tool'),
      }),
      needsApproval: spec.requiresApproval,
      execute: async (input) => {
        if (spec.mcpHttpEndpoint?.trim()) {
          try {
            const res = await fetch(spec.mcpHttpEndpoint.trim(), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(spec.mcpHttpHeaders ?? {}),
              },
              body: JSON.stringify({
                tool: spec.toolName,
                bindingId: spec.bindingId,
                arguments: input,
              }),
              signal: AbortSignal.timeout(60_000),
            });
            const text = await res.text();
            logToolInvocation({
              workspaceId: meta.workspaceId,
              tool: name,
              ok: res.ok,
              correlationId: meta.correlationId,
              detail: { mcpHttp: true, status: res.status },
            });
            return text.slice(0, 100_000);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            logToolInvocation({
              workspaceId: meta.workspaceId,
              tool: name,
              ok: false,
              correlationId: meta.correlationId,
              detail: { error: msg },
            });
            return JSON.stringify({ ok: false, error: msg });
          }
        }
        return JSON.stringify({
          ok: true,
          mcp: spec.mcpDisplayName,
          tool: spec.toolName,
          bindingId: spec.bindingId,
          input,
          note: 'MCP HTTP nao configurado em McpConnection.config.mcpHttpUrl; stub resposta.',
        });
      },
    });
  });
}
