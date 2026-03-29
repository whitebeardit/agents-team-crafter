import type { IAgentRunInput } from '../ports/agent-runtime.provider.js';

/** Monta o texto do usuário enviado ao Agent SDK com metadados de canal/locale/taskType. */
export function formatAgentUserMessage(input: IAgentRunInput): string {
  const meta: string[] = [];
  if (input.channel) meta.push(`channel=${input.channel}`);
  if (input.locale) meta.push(`locale=${input.locale}`);
  if (input.taskType) meta.push(`taskType=${input.taskType}`);
  const prefix = meta.length > 0 ? `[${meta.join('] [')}] ` : '';
  return `${prefix}${input.message}`;
}
