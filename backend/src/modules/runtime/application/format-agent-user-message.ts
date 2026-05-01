import type { IAgentRunInput } from '../ports/agent-runtime.provider.js';

/** Monta o texto do usuário enviado ao Agent SDK com metadados de canal/locale/taskType. */
export function formatAgentUserMessage(input: IAgentRunInput): string {
  const meta: string[] = [];
  if (input.channel) meta.push(`channel=${input.channel}`);
  if (input.locale) meta.push(`locale=${input.locale}`);
  if (input.taskType) meta.push(`taskType=${input.taskType}`);
  if (input.requestedAccessLevel) meta.push(`access=${input.requestedAccessLevel}`);
  const prefix = meta.length > 0 ? `[${meta.join('] [')}] ` : '';
  return `${prefix}${input.message}`;
}

export function formatAgentUserContentParts(input: IAgentRunInput): IAgentRunInput['contentParts'] | undefined {
  if (!Array.isArray(input.contentParts) || input.contentParts.length === 0) return undefined;
  const text = formatAgentUserMessage(input).trim();
  const prefixed = text ? [{ type: 'input_text' as const, text }, ...input.contentParts] : input.contentParts;
  return prefixed;
}
