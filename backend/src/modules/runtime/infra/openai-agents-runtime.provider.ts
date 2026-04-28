import { Agent, Runner } from '@openai/agents';
import { OpenAIProvider } from '@openai/agents-openai';
import type { Tool } from '@openai/agents';
import type {
  IAgentRuntimeProvider,
  IAgentRunInput,
  IAgentRunResult,
  ICoordinatorRunParams,
  IExecutableAgentConfig,
} from '../ports/agent-runtime.provider.js';
import { formatAgentUserMessage } from '../application/format-agent-user-message.js';
import { buildCapabilityCatalogTools, buildMcpSdkTools } from '../application/build-specialist-sdk-tools.js';
import { buildWorkspaceCustomTools } from '../application/build-workspace-custom-tools.js';
import { isGpt5FamilyModel } from '../../../shared/kernel/openai-workspace-chat-models.js';

function buildAgentModelOptions(modelId: string): { model: string; modelSettings?: object } {
  if (!isGpt5FamilyModel(modelId)) {
    return { model: modelId };
  }
  return {
    model: modelId,
    modelSettings: {
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
    const apiKey = input.openaiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return {
        finalOutput:
          'Chave OpenAI nao configurada. Defina integracoes do workspace em Configuracoes ou OPENAI_API_KEY no ambiente (apenas demo).',
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
      ...buildAgentModelOptions(config.openaiRuntimeModel),
    });

    const userMessage = formatAgentUserMessage(input);
    const runner = new Runner({
      modelProvider: new OpenAIProvider({ apiKey }),
    });

    try {
      const result = await runner.run(agent, userMessage, { stream: false });
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
    const apiKey = params.openaiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return {
        finalOutput:
          'Chave OpenAI nao configurada. Defina integracoes do workspace em Configuracoes ou OPENAI_API_KEY no ambiente (apenas demo).',
        events: [],
      };
    }

    const tools = (params.sdkTools ?? []) as Tool[];
    const agent = new Agent({
      name: `Coordinator:${params.coordinatorAgentId}`,
      instructions: params.systemInstruction ?? 'Voce e o coordenador do time de agentes.',
      tools,
      handoffs: [],
      ...buildAgentModelOptions(params.openaiRuntimeModel),
    });

    const runner = new Runner({
      modelProvider: new OpenAIProvider({ apiKey }),
    });

    try {
      if (params.onAssistantTextDelta) {
        const streamed = await runner.run(agent, params.userMessage, { stream: true });
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

      const result = await runner.run(agent, params.userMessage, { stream: false });
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
