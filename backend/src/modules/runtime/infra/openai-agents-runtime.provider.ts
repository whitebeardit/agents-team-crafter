import { Agent, Runner } from '@openai/agents';
import { OpenAIProvider } from '@openai/agents-openai';
import type {
  IAgentRuntimeProvider,
  IAgentRunInput,
  IAgentRunResult,
  IExecutableAgentConfig,
} from '../ports/agent-runtime.provider.js';
import { formatAgentUserMessage } from '../application/format-agent-user-message.js';

/** Runtime provider usando OpenAI Agents SDK como motor de linguagem. */
export class OpenAIAgentsRuntimeProvider implements IAgentRuntimeProvider {
  constructor() {}

  async compile(config: IExecutableAgentConfig) {
    return {
      ok: true,
      detail: `openai-agents-runtime ready (tools=${config.tools.length}, mcpBindings=${config.mcpBindingIds.length})`,
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

    const agent = new Agent({
      name: `Agent:${config.agentId}`,
      instructions: config.systemInstruction ?? 'Voce e um agente de IA.',
      tools: [],
    });

    const userMessage = formatAgentUserMessage(input);
    const runner = new Runner({
      modelProvider: new OpenAIProvider({ apiKey }),
    });

    try {
      const result = await runner.run(agent, userMessage, { stream: false });
      const finalOutput = String((result as { finalOutput?: unknown }).finalOutput ?? '');

      const events: IAgentRunResult['events'] = [];
      if (input.taskType) events.push({ type: 'taskType', value: input.taskType });

      return { finalOutput, events };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const events: IAgentRunResult['events'] = [];
      if (input.taskType) events.push({ type: 'taskType', value: input.taskType });
      return {
        finalOutput: `Erro ao executar modelo: ${msg}`,
        events,
      };
    }
  }
}
