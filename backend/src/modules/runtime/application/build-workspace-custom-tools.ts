import { tool } from '@openai/agents';
import { z } from 'zod';
import type { IWorkspaceCustomToolDefinition } from '../ports/agent-runtime.provider.js';
import type { IBusinessToolRuntime } from '../../business-tools/application/business-tool-runtime.js';
import { logToolInvocation } from './tool-invocation-logger.js';
import { getBusinessActionPreset } from '../../business-tools/application/business-action-presets.js';
import {
  classifyBusinessActionOperation,
  operationPolicyPromptLine,
} from '../../business-tools/application/business-action-operation-policy.js';

const genericArgs = z.object({
  query: z
    .string()
    .describe(
      'Payload ou texto de consulta para a ferramenta; use string vazia quando não aplicável.',
    ),
});

function slugToToolName(slug: string): string {
  const s = slug.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
  return `ws_${s}`.slice(0, 64);
}

function hasObjectProperties(schema: Record<string, unknown> | undefined): boolean {
  if (!schema || typeof schema !== 'object') return false;
  if (schema.type !== 'object') return false;
  const props = schema.properties;
  return !!props && typeof props === 'object' && !Array.isArray(props);
}

function resolveInternalActionParameterSchema(
  definitionSchema: Record<string, unknown> | undefined,
  presetSchema: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (hasObjectProperties(definitionSchema)) return definitionSchema as Record<string, unknown>;
  if (hasObjectProperties(presetSchema)) return presetSchema as Record<string, unknown>;
  return definitionSchema ?? presetSchema ?? {};
}

function buildLenientInternalActionJsonSchema(
  definitionSchema: Record<string, unknown> | undefined,
  presetSchema: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const resolved = resolveInternalActionParameterSchema(definitionSchema, presetSchema);
  /**
   * OpenAI Responses API rejeita `type: object` sem `properties` ("object schema missing properties").
   * Sempre incluir `properties` como objeto (vazio no fallback genérico).
   */
  if (!resolved || typeof resolved !== 'object' || resolved.type !== 'object') {
    return { type: 'object', properties: {}, additionalProperties: true };
  }
  const rawProps = resolved.properties;
  const properties =
    rawProps && typeof rawProps === 'object' && !Array.isArray(rawProps)
      ? (rawProps as Record<string, unknown>)
      : {};
  return {
    ...resolved,
    type: 'object',
    properties,
    additionalProperties: true,
  };
}

/**
 * Tools registadas pelo workspace (HTTP webhook, internal business actions, etc.).
 */
export function buildWorkspaceCustomTools(
  defs: IWorkspaceCustomToolDefinition[],
  meta: {
    workspaceId: string;
    correlationId?: string;
    teamContext?: { teamId: string; teamName: string };
    conversationId?: string;
    actorAgentId?: string;
    actorRole?: 'coordinator' | 'specialist';
    singleAgentMode?: boolean;
  },
  opts?: { businessToolRuntime?: IBusinessToolRuntime },
): unknown[] {
  const runtime = opts?.businessToolRuntime;
  const out: unknown[] = [];
  for (const def of defs) {
    if (def.kind === 'internal_action') {
      const actionId = typeof def.config.actionId === 'string' ? def.config.actionId.trim() : '';
      const preset = getBusinessActionPreset(actionId);
      const parameters = buildLenientInternalActionJsonSchema(
        def.jsonSchema ?? undefined,
        (preset?.inputSchema as Record<string, unknown> | undefined) ?? undefined,
      );
      const toolName = slugToToolName(def.slug || def.id);
      if (!actionId || !runtime) {
        out.push(
          tool({
            name: toolName,
            description:
              def.name +
              (runtime ? ' (internal_action sem actionId)' : ' (internal_action — runtime indisponivel)'),
            parameters: genericArgs,
            execute: async () =>
              `[internal_action] configuracao invalida: ${!runtime ? 'sem business runtime' : 'defina config.actionId'}`,
          }),
        );
        continue;
      }
      out.push(
        tool({
          name: toolName,
          description: (() => {
            const operation = classifyBusinessActionOperation(actionId);
            const required =
              preset?.requiredFieldLabels && preset.requiredFieldLabels.length > 0
                ? ` Obrigatórios: ${preset.requiredFieldLabels.join(', ')}.`
                : '';
            const slotHint = preset?.slotFillingPromptHint?.trim()
              ? ` Hint: ${preset.slotFillingPromptHint.trim()}`
              : '';
            return `${def.name} (internal business action: ${actionId}; operation=${operation}). ${operationPolicyPromptLine(operation)}${required}${slotHint}`.trim();
          })(),
          parameters: parameters as never,
          strict: false,
          execute: async (input) => {
            const disallowDirectCoordinatorExecution =
              meta.actorRole === 'coordinator' &&
              meta.singleAgentMode !== true &&
              (preset?.toolKind === 'composite_workflow' || actionId.startsWith('clinic_'));
            if (disallowDirectCoordinatorExecution) {
              return JSON.stringify({
                ok: false,
                errorCode: 'COORDINATOR_DIRECT_EXECUTION_BLOCKED',
                error:
                  'Coordenador não pode executar workflow operacional diretamente no modo padrão; delegue para especialista.',
                result: {
                  actionId,
                  ownerAgent: preset?.ownerAgent,
                  allowedDirectAgents: preset?.allowedDirectAgents ?? [],
                },
              });
            }
            const r = await runtime.execute({
              workspaceId: meta.workspaceId,
              toolDefinitionId: def.id,
              actionId,
              input,
              correlationId: meta.correlationId,
              teamContext: meta.teamContext,
              conversationId: meta.conversationId,
            });
            logToolInvocation({
              workspaceId: meta.workspaceId,
              tool: `internal_action:${actionId}`,
              ok: r.ok,
              correlationId: meta.correlationId,
              detail: r.ok ? undefined : { error: r.error },
            });
            return JSON.stringify({
              ok: r.ok,
              error: r.error,
              errorCode: r.errorCode,
              result: r.result,
            });
          },
        }),
      );
      continue;
    }
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
