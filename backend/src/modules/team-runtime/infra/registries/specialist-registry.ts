import { tool } from '@openai/agents';
import { z } from 'zod';

export function specialistToolName(agentId: string): string {
  const safe = agentId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `specialist_${safe}`.slice(0, 64);
}

/** Reverse tool name → specialist id using the same roster encoding as buildOpenAiTools. */
export function resolveSpecialistAgentIdFromToolName(
  toolName: string,
  specialistIds: string[],
): string | undefined {
  for (const id of specialistIds) {
    if (specialistToolName(id) === toolName) return id;
  }
  return undefined;
}

export type TExecuteSpecialistFn = (specialistAgentId: string, instruction: string) => Promise<string>;

/**
 * Builds OpenAI Agents SDK function tools: each specialist is exposed only as a tool to the coordinator.
 */
export class SpecialistRegistry {
  buildOpenAiTools(args: {
    specialists: Array<{ id: string; name: string; description?: string }>;
    executeSpecialist: TExecuteSpecialistFn;
  }): unknown[] {
    if (args.specialists.length === 0) return [];
    return args.specialists.map((s) =>
      tool({
        name: specialistToolName(s.id),
        description: `Internal specialist "${s.name}". ${s.description ?? ''}`.trim(),
        parameters: z.object({
          instruction: z.string().min(1).describe('Clear task for the specialist'),
        }),
        execute: async ({ instruction }) => args.executeSpecialist(s.id, instruction),
      }),
    );
  }
}
