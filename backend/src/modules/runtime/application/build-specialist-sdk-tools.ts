import { tool } from '@openai/agents';
import { z } from 'zod';
import type { TAvailableToolId } from '../../agents/domain/available-tools.js';
import { isAllowedTool } from '../../agents/domain/available-tools.js';
import type { IMcpToolSpec } from '../ports/agent-runtime.provider.js';
import type { IToolIntegrationContext } from '../../../shared/kernel/tool-integration.types.js';
import {
  executeCalendarAccess,
  executeImageGeneration,
  executeOpenRouterWebFetch,
  executeOpenRouterWebSearch,
} from './tool-builtin-executors.js';
import { logToolInvocation } from './tool-invocation-logger.js';

const CATALOG_STUB: Record<
  TAvailableToolId,
  { description: string; stubResult: (input: Record<string, unknown>) => string }
> = {
  web_search: {
    description: 'Search the public web for up-to-date information via OpenRouter when configured.',
    stubResult: () =>
      '[catalog_stub] web_search: configure OpenRouter in Integracoes to run real web search.',
  },
  web_fetch: {
    description: 'Fetch and extract content from a URL via OpenRouter when configured.',
    stubResult: () =>
      '[catalog_stub] web_fetch: configure OpenRouter in Integracoes to fetch URL content.',
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
  image_generation: {
    description: 'Generate images via OpenRouter or OpenAI when API key is configured.',
    stubResult: () =>
      '[catalog_stub] image_generation: configure chave OpenRouter ou OpenAI em Integracoes para gerar imagens reais.',
  },
};

/** Modo estrito OpenAI: propriedades em `properties` devem constar em `required`; usar "" quando não houver filtro. */
export const catalogQueryArgs = z.object({
  query: z
    .string()
    .describe(
      'Texto de consulta, caminho relativo ou SQL conforme a ferramenta. Use string vazia quando não houver filtro específico.',
    ),
});

export const webFetchArgs = z.object({
  url: z
    .string()
    .min(1)
    .describe('Fully qualified URL to fetch, e.g. https://example.com/page.'),
  model: z
    .string()
    .min(1)
    .max(200)
    .describe('Use default to apply the effective OpenRouter model, or provider/model for a specific OpenRouter model.'),
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
    .string()
    .min(1)
    .max(200)
    .describe(
      'Use default to apply the effective provider default; use dall-e-2/dall-e-3 for OpenAI or provider/model (e.g. bytedance-seed/seedream-4.5) for OpenRouter.',
    ),
  provider: z
    .enum(['default', 'openai', 'openrouter'])
    .describe('Use default for workspace provider preference, or force openai/openrouter.'),
});

export type TBuildCatalogMeta = {
  workspaceId: string;
  correlationId?: string;
  teamContext?: { teamId: string; teamName: string; gallerySubjectSlug?: string };
  runtimeModel?: string;
  imageGenerationModel?: string;
};

function applyImageModelOverride(
  input: { prompt?: string; size?: string; model?: string; provider?: 'default' | 'openai' | 'openrouter' },
  override?: string,
): { prompt?: string; size?: string; model?: string; provider?: 'default' | 'openai' | 'openrouter' } {
  const rawModel = input.model?.trim();
  const model = rawModel && rawModel !== 'default' ? rawModel : override?.trim();
  if (!model) return input;
  const provider =
    model === 'dall-e-2' || model === 'dall-e-3'
      ? 'openai'
      : model.includes('/')
        ? 'openrouter'
        : input.provider;
  return {
    ...input,
    model,
    ...(provider ? { provider } : {}),
  };
}

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

    if (bid === 'web_search' && ctx.openrouter?.apiKey) {
      out.push(
        tool({
          name: `catalog_${id}`.slice(0, 64),
          description:
            'Search the public web using OpenRouter server tool. Returns a concise grounded response with sources when available.',
          parameters: catalogQueryArgs,
          execute: async (input) =>
            executeOpenRouterWebSearch(ctx, input as { query?: string; model?: string }, {
              workspaceId: meta.workspaceId,
              ...(meta.correlationId ? { correlationId: meta.correlationId } : {}),
              ...(meta.runtimeModel ? { runtimeModel: meta.runtimeModel } : {}),
            }),
        }),
      );
      continue;
    }
    if (bid === 'web_fetch' && ctx.openrouter?.apiKey) {
      out.push(
        tool({
          name: `catalog_${id}`.slice(0, 64),
          description: 'Fetch and extract content from a URL using OpenRouter server tool.',
          parameters: webFetchArgs,
          execute: async (input) =>
            executeOpenRouterWebFetch(ctx, input as { url?: string; model?: string }, {
              workspaceId: meta.workspaceId,
              ...(meta.correlationId ? { correlationId: meta.correlationId } : {}),
              ...(meta.runtimeModel ? { runtimeModel: meta.runtimeModel } : {}),
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
          parameters: catalogQueryArgs,
          execute: async (input) =>
            executeCalendarAccess(ctx, input as { query?: string }, {
              workspaceId: meta.workspaceId,
              correlationId: meta.correlationId,
            }),
        }),
      );
      continue;
    }
    if (bid === 'image_generation' && (ctx.openai?.apiKey || ctx.openrouter?.apiKey)) {
      out.push(
        tool({
          name: `catalog_${id}`.slice(0, 64),
          description:
            'Generate an image with OpenRouter image models or OpenAI Images API. Returns Markdown ![...](...) with an image URL or saved gallery URL. Set provider/model explicitly when needed.',
          parameters: imageGenerationArgs,
          execute: async (input) =>
            executeImageGeneration(
              ctx,
              applyImageModelOverride(
                input as { prompt?: string; size?: string; model?: string; provider?: 'default' | 'openai' | 'openrouter' },
                meta.imageGenerationModel,
              ),
              {
                workspaceId: meta.workspaceId,
                correlationId: meta.correlationId,
                teamContext: meta.teamContext,
              },
            ),
        }),
      );
      continue;
    }

    const metaStub = CATALOG_STUB[bid];
    out.push(
      tool({
        name: `catalog_${id}`.slice(0, 64),
        description: metaStub.description,
        parameters: catalogQueryArgs,
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
          .describe(
            'JSON ou texto livre para a ferramenta MCP; use string vazia quando não houver payload.',
          ),
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
                arguments:
                  typeof input === 'object' && input !== null && 'arguments' in input
                    ? String((input as { arguments: string }).arguments)
                    : '',
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
