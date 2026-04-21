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

function serializeRuntimePayload(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function mapNewItemsToEvents(result: { newItems?: unknown[] }): IAgentRunResult['events'] {
  const items = result.newItems ?? [];
  const events: IAgentRunResult['events'] = [];
  const byCallId = new Map<string, { tool: string }>();
  for (const item of items) {
    const t = item as {
      type?: string;
      rawItem?: { type?: string; name?: string; callId?: string; output?: unknown; arguments?: unknown };
    };
    if (t.type === 'tool_call_item' || t.rawItem?.type === 'function_call') {
      const name = t.rawItem?.name ?? 'tool';
      const toolInput = serializeRuntimePayload(t.rawItem?.arguments);
      events.push({
        type: 'toolCall',
        tool: name,
        ...(t.rawItem?.callId ? { callId: t.rawItem.callId } : {}),
        ...(toolInput !== undefined ? { toolInput } : {}),
      });
      if (t.rawItem?.callId) byCallId.set(t.rawItem.callId, { tool: name });
      continue;
    }

    if (t.rawItem?.type === 'function_call_output' && t.rawItem.callId) {
      const current = byCallId.get(t.rawItem.callId);
      const tool = current?.tool ?? 'tool';
      const toolOutput = serializeRuntimePayload(t.rawItem.output);
      const parsed = parseToolOutputPayload(t.rawItem.output);
      events.push({
        type: 'toolResult',
        tool,
        callId: t.rawItem.callId,
        ...(toolOutput !== undefined ? { toolOutput } : {}),
        status: parsed?.ok === false ? 'error' : 'success',
        ...(parsed?.ok === false && parsed.errorCode ? { errorCode: parsed.errorCode } : {}),
        ...(parsed?.ok === false && parsed.detail ? { detail: parsed.detail } : {}),
      });
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
      detail: `openai-agents-runtime ready (catalogTools=${config.tools.length}, mcpToolSpecs=${config.mcpToolSpecs.length}, mcpBindingIds=${config.mcpBindingIds.length})`,
    };
  }

  async runStep(config: IExecutableAgentConfig, input: IAgentRunInput): Promise<IAgentRunResult> {
    const apiKey = input.openaiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return {
        finalOutput:
          'Chave OpenAI nao configurada. Defina integracoes do workspace em Configuracoes ou OPENAI_API_KEY no ambiente (apenas demo).',
        events: [
          {
            type: 'runtimeError',
            message: 'Chave OpenAI nao configurada.',
            errorCode: 'OPENAI_API_KEY_MISSING',
            detail: 'Defina integracoes do workspace ou OPENAI_API_KEY para executar o runtime.',
            source: 'provider',
          },
        ],
      };
    }

    const meta = {
      workspaceId: config.workspaceId,
      correlationId: input.correlationId,
      teamContext: config.teamContext,
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
      const events: IAgentRunResult['events'] = [
        {
          type: 'runtimeError',
          message: `Erro ao executar modelo: ${msg}`,
          errorCode: 'RUNTIME_EXECUTION_ERROR',
          detail: msg,
          source: 'runner',
        },
      ];
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
        events: [
          {
            type: 'runtimeError',
            message: 'Chave OpenAI nao configurada.',
            errorCode: 'OPENAI_API_KEY_MISSING',
            detail: 'Defina integracoes do workspace ou OPENAI_API_KEY para executar o coordenador.',
            source: 'provider',
          },
        ],
      };
    }

    const tools = (params.sdkTools ?? []) as Tool[];
    const agent = new Agent({
      name: `Coordinator:${params.coordinatorAgentId}`,
      instructions: params.systemInstruction ?? 'Voce e o coordenador do time de agentes.',
      tools,
      handoffs: [],
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
        events: [
          {
            type: 'runtimeError',
            message: `Erro ao executar coordenador: ${msg}`,
            errorCode: 'COORDINATOR_RUNTIME_ERROR',
            detail: msg,
            source: 'runner',
          },
        ],
      };
    }
  }
}
