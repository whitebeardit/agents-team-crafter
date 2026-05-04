import { Agent, Runner } from '@openai/agents';
import { OpenAIProvider } from '@openai/agents-openai';
import OpenAI from 'openai';
import type { Tool } from '@openai/agents';
import type {
  IAgentRuntimeProvider,
  IAgentRunInput,
  IAgentRunResult,
  ICoordinatorRunParams,
  IExecutableAgentConfig,
} from '../ports/agent-runtime.provider.js';
import { formatAgentUserContentParts, formatAgentUserMessage } from '../application/format-agent-user-message.js';
import { buildCapabilityCatalogTools, buildMcpSdkTools } from '../application/build-specialist-sdk-tools.js';
import { buildWorkspaceCustomTools } from '../application/build-workspace-custom-tools.js';
import { isGpt5FamilyModel } from '../../../shared/kernel/openai-workspace-chat-models.js';
import {
  type ILlmProviderConfig,
  buildOpenAiProviderConfig,
  openRouterMaxOutputTokensFromEnv,
  resolveModelIdForProvider,
} from '../../../shared/kernel/llm-provider-config.js';
import { preferOpenRouterTitleOverReferer } from '../../../shared/kernel/openrouter-attribution.js';

/**
 * Resolve a configuração LLM efectiva para um run.
 * Usa `llmConfig` se fornecido; senão constrói config OpenAI legacy a partir de `openaiApiKey`.
 * Devolve null quando não há chave disponível.
 */
function resolveEffectiveLlmConfig(params: {
  llmConfig?: ILlmProviderConfig;
  openaiApiKey?: string;
}): ILlmProviderConfig | null {
  if (params.llmConfig) return params.llmConfig;
  const key = params.openaiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return buildOpenAiProviderConfig(key);
}

/** Alinha tipos quando o TS resolve `openai` por caminhos duplicados (agents-openai vs app). */
function toAgentsOpenAiClient(client: OpenAI) {
  return client as never;
}

function mergeLlmDefaultHeaders(
  config: ILlmProviderConfig,
  runExtra?: Record<string, string>,
): Record<string, string> | undefined {
  const merged: Record<string, string> = { ...(config.extraHeaders ?? {}), ...(runExtra ?? {}) };
  return preferOpenRouterTitleOverReferer(merged);
}

/**
 * Instancia o `OpenAIProvider` a partir da configuração do provider LLM.
 * Para OpenRouter: cliente OpenAI com `defaultHeaders` (HTTP-Referer, X-OpenRouter-Title, etc.).
 * Para OpenAI: Responses API por defeito; usa cliente explícito só quando há headers extra.
 */
function buildProviderFromConfig(
  config: ILlmProviderConfig,
  runExtraHeaders?: Record<string, string>,
): OpenAIProvider {
  const defaultHeaders = mergeLlmDefaultHeaders(config, runExtraHeaders);

  if (config.provider === 'openrouter') {
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      ...(defaultHeaders ? { defaultHeaders } : {}),
    });
    return new OpenAIProvider({ openAIClient: toAgentsOpenAiClient(client), useResponses: false });
  }

  if (defaultHeaders && Object.keys(defaultHeaders).length > 0) {
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      defaultHeaders,
    });
    return new OpenAIProvider({
      openAIClient: toAgentsOpenAiClient(client),
      useResponses: config.useResponses,
    });
  }

  return new OpenAIProvider({ apiKey: config.apiKey, useResponses: config.useResponses });
}

function buildAgentModelOptions(
  modelId: string,
  provider: ILlmProviderConfig['provider'],
): { model: string; modelSettings?: object } {
  const resolvedModel = resolveModelIdForProvider(modelId, provider);
  const openRouterCap =
    provider === 'openrouter' ? { maxTokens: openRouterMaxOutputTokensFromEnv() } : {};

  if (!isGpt5FamilyModel(modelId)) {
    if (provider === 'openrouter') {
      return { model: resolvedModel, modelSettings: openRouterCap };
    }
    return { model: resolvedModel };
  }
  return {
    model: resolvedModel,
    modelSettings: {
      ...openRouterCap,
      reasoning: { effort: 'none' },
      text: { verbosity: 'low' },
    },
  };
}

export function formatRuntimeErrorWithFallback(prefix: string, msg: string): string {
  const lower = msg.toLowerCase();
  const isMaxTurns = lower.includes('max turns') && lower.includes('exceeded');
  if (!isMaxTurns) return `${prefix}: ${msg}`;
  return [
    'Nao consegui concluir este fluxo dentro do limite de interacoes do modelo.',
    'Para CRM, tente uma instrucao direta como:',
    '- "Liste todos os clientes cadastrados".',
    '- "Busque cliente pelo email pessoa@dominio.com".',
    `Detalhe tecnico: ${prefix}: ${msg}`,
  ].join('\n');
}

function parseToolOutputPayload(output: unknown): { ok: boolean; errorCode?: string; detail?: string } | null {
  if (typeof output !== 'string') return null;
  const trimmed = output.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as {
      ok?: unknown;
      errorCode?: unknown;
      error?: unknown;
      result?: unknown;
    };
    if (typeof parsed.ok !== 'boolean') return null;
    if (parsed.ok) return { ok: true };
    const detailCandidate =
      typeof parsed.error === 'string'
        ? parsed.error
        : typeof (parsed.result as { message?: unknown } | undefined)?.message === 'string'
          ? String((parsed.result as { message?: unknown }).message)
          : undefined;
    return {
      ok: false,
      errorCode: typeof parsed.errorCode === 'string' ? parsed.errorCode : undefined,
      detail: detailCandidate,
    };
  } catch {
    return null;
  }
}

export function mapNewItemsToEvents(result: { newItems?: unknown[] }): IAgentRunResult['events'] {
  const items = result.newItems ?? [];
  const events: IAgentRunResult['events'] = [];
  const byCallId = new Map<string, number>();
  for (const item of items) {
    const t = item as {
      type?: string;
      rawItem?: { type?: string; name?: string; callId?: string; output?: unknown };
    };
    if (t.type === 'tool_call_item' || t.rawItem?.type === 'function_call') {
      const name = t.rawItem?.name ?? 'tool';
      const evIndex = events.push({ type: 'toolResult', tool: name, status: 'success' }) - 1;
      if (t.rawItem?.callId) byCallId.set(t.rawItem.callId, evIndex);
      continue;
    }

    if (t.rawItem?.type === 'function_call_output' && t.rawItem.callId) {
      const evIndex = byCallId.get(t.rawItem.callId);
      if (evIndex === undefined) continue;
      const parsed = parseToolOutputPayload(t.rawItem.output);
      if (!parsed) continue;
      if (!parsed.ok) {
        const current = events[evIndex];
        if (current?.type === 'toolResult') {
          events[evIndex] = {
            ...current,
            status: 'error',
            ...(parsed.errorCode ? { errorCode: parsed.errorCode } : {}),
            ...(parsed.detail ? { detail: parsed.detail } : {}),
          };
        }
      }
    }
  }
  return events;
}

type TRunnerInputPart = { type: 'input_text'; text: string } | { type: 'input_image'; image_url: string };

export function buildRunnerInputFromAgentInput(input: IAgentRunInput): string | TRunnerInputPart[] {
  const parts = formatAgentUserContentParts(input);
  if (!parts || parts.length === 0) return formatAgentUserMessage(input);
  return parts.map((p) =>
    p.type === 'input_text'
      ? { type: 'input_text', text: p.text }
      : { type: 'input_image', image_url: p.imageUrl },
  );
}

export function buildRunnerInputFromCoordinatorParams(params: ICoordinatorRunParams): string | TRunnerInputPart[] {
  if (!Array.isArray(params.userContentParts) || params.userContentParts.length === 0) return params.userMessage;
  const base: TRunnerInputPart[] = [{ type: 'input_text', text: params.userMessage }];
  for (const p of params.userContentParts) {
    if (p.type === 'input_text') base.push({ type: 'input_text', text: p.text });
    if (p.type === 'input_image') base.push({ type: 'input_image', image_url: p.imageUrl });
  }
  return base;
}

/** Runtime provider using OpenAI Agents SDK; coordinator uses specialist tools, specialists use plain LLM step. */
export class OpenAIAgentsRuntimeProvider implements IAgentRuntimeProvider {
  constructor() {}

  async compile(config: IExecutableAgentConfig) {
    return {
      ok: true,
      detail: `openai-agents-runtime ready (model=${config.openaiRuntimeModel}, catalogTools=${config.tools.length}, mcpToolSpecs=${config.mcpToolSpecs.length}, mcpBindingIds=${config.mcpBindingIds.length})`,
    };
  }

  async runStep(config: IExecutableAgentConfig, input: IAgentRunInput): Promise<IAgentRunResult> {
    const llmConfig = resolveEffectiveLlmConfig({
      llmConfig: input.llmConfig,
      openaiApiKey: input.openaiApiKey,
    });
    if (!llmConfig) {
      return {
        finalOutput:
          'Chave LLM nao configurada. Defina integracoes do workspace em Configuracoes ou OPENAI_API_KEY / OPENROUTER_API_KEY no ambiente (apenas demo).',
        events: [],
      };
    }

    const meta = {
      workspaceId: config.workspaceId,
      correlationId: input.correlationId,
      teamContext: config.teamContext,
      conversationId: input.conversationId,
      actorAgentId: config.agentId,
      actorRole: 'specialist' as const,
      singleAgentMode: config.singleAgentMode === true,
    };
    const catalogTools = buildCapabilityCatalogTools(
      config.tools,
      config.toolIntegrationContext,
      meta,
    ) as Tool[];
    const mcpTools = buildMcpSdkTools(config.mcpToolSpecs, meta) as Tool[];
    const customTools = buildWorkspaceCustomTools(config.customToolDefinitions ?? [], meta, {
      businessToolRuntime: config.businessToolRuntime,
    }) as Tool[];
    const sdkTools = [...catalogTools, ...mcpTools, ...customTools];

    const agent = new Agent({
      name: `Agent:${config.agentId}`,
      instructions: config.systemInstruction ?? 'Voce e um agente de IA.',
      tools: sdkTools,
      handoffs: [],
      ...buildAgentModelOptions(config.openaiRuntimeModel, llmConfig.provider),
    });

    const userInput = buildRunnerInputFromAgentInput(input);
    const runner = new Runner({
      modelProvider: buildProviderFromConfig(llmConfig, input.llmExtraHeaders),
    });

    try {
      const result = await runner.run(agent, userInput as unknown as string, { stream: false });
      const finalOutput = String((result as { finalOutput?: unknown }).finalOutput ?? '');

      const events: IAgentRunResult['events'] = [...mapNewItemsToEvents(result as { newItems?: unknown[] })];
      if (input.taskType) events.push({ type: 'taskType', value: input.taskType });

      return { finalOutput, events };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const events: IAgentRunResult['events'] = [];
      if (input.taskType) events.push({ type: 'taskType', value: input.taskType });
      return {
        finalOutput: formatRuntimeErrorWithFallback('Erro ao executar modelo', msg),
        events,
      };
    }
  }

  async runCoordinatorTurn(params: ICoordinatorRunParams): Promise<IAgentRunResult> {
    const llmConfig = resolveEffectiveLlmConfig({
      llmConfig: params.llmConfig,
      openaiApiKey: params.openaiApiKey,
    });
    if (!llmConfig) {
      return {
        finalOutput:
          'Chave LLM nao configurada. Defina integracoes do workspace em Configuracoes ou OPENAI_API_KEY / OPENROUTER_API_KEY no ambiente (apenas demo).',
        events: [],
      };
    }

    const tools = (params.sdkTools ?? []) as Tool[];
    const agent = new Agent({
      name: `Coordinator:${params.coordinatorAgentId}`,
      instructions: params.systemInstruction ?? 'Voce e o coordenador do time de agentes.',
      tools,
      handoffs: [],
      ...buildAgentModelOptions(params.openaiRuntimeModel, llmConfig.provider),
    });

    const runner = new Runner({
      modelProvider: buildProviderFromConfig(llmConfig, params.llmExtraHeaders),
    });

    try {
      if (params.onAssistantTextDelta) {
        const coordinatorInput = buildRunnerInputFromCoordinatorParams(params);
        const streamed = await runner.run(agent, coordinatorInput as unknown as string, { stream: true });
        const textStream = streamed.toTextStream({ compatibleWithNodeStreams: true });
        textStream.on('data', (chunk: Buffer | string) => {
          const s = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
          if (s) params.onAssistantTextDelta!(s);
        });
        await streamed.completed;
        const finalOutput = String(streamed.finalOutput ?? '');
        const events = mapNewItemsToEvents(streamed as { newItems?: unknown[] });
        return { finalOutput, events };
      }

      const coordinatorInput = buildRunnerInputFromCoordinatorParams(params);
      const result = await runner.run(agent, coordinatorInput as unknown as string, { stream: false });
      const finalOutput = String((result as { finalOutput?: unknown }).finalOutput ?? '');
      const events = mapNewItemsToEvents(result as { newItems?: unknown[] });
      return { finalOutput, events };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        finalOutput: formatRuntimeErrorWithFallback('Erro ao executar coordenador', msg),
        events: [],
      };
    }
  }
}
