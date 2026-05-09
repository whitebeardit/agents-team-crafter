import { tool } from '@openai/agents';
import { z } from 'zod';

export function specialistToolName(agentId: string): string {
  const safe = agentId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `specialist_${safe}`.slice(0, 64);
}

/**
 * OpenAI models sometimes emit function names with a spurious `.json` suffix.
 * The Agents SDK matches tools by exact name, so we register both the canonical
 * name and the `.json` alias when they differ after the 64-char cap.
 */
export function specialistToolNamesForRegistration(agentId: string): string[] {
  const safe = agentId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const primary = specialistToolName(agentId);
  const rawBase = `specialist_${safe}`;
  const withJson = `${rawBase}.json`.slice(0, 64);
  const names = new Set<string>([primary]);
  if (withJson !== primary) names.add(withJson);
  return [...names];
}

export function normalizeSpecialistToolName(raw: string): string {
  return raw
    .replace(/<\|channel\|>[a-zA-Z0-9_-]+/g, '')
    .replace(/<\|[^|]{1,64}\|>/g, '')
    .replace(/[^a-zA-Z0-9_-].*$/, '')
    .trim();
}

/** Reverse tool name → specialist id using the same roster encoding as buildOpenAiTools. */
export function resolveSpecialistAgentIdFromToolName(
  toolName: string,
  specialistIds: string[],
): string | undefined {
  const normalized = normalizeSpecialistToolName(toolName);
  for (const id of specialistIds) {
    if (specialistToolName(id) === normalized) return id;
  }
  return undefined;
}

export type TExecuteSpecialistFn = (specialistAgentId: string, instruction: string) => Promise<string>;

const SPECIALIST_TOOL_DESCRIPTION_MAX = 900;

export type TSpecialistToolRosterEntry = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  exampleUserPhrases?: string[];
};

function buildSpecialistToolDescription(s: TSpecialistToolRosterEntry): string {
  const parts: string[] = [`Internal specialist "${s.name}".`];
  const cat = s.category?.trim();
  if (cat) parts.push(`Domain: ${cat}.`);
  const desc = s.description?.trim();
  if (desc) parts.push(desc);
  const ph = (s.exampleUserPhrases ?? []).slice(0, 4).filter((p) => p.trim());
  if (ph.length > 0) {
    parts.push(`Example user messages: ${ph.map((p) => JSON.stringify(p.trim())).join(', ')}`);
  }
  let text = parts.join(' ').trim();
  if (text.length > SPECIALIST_TOOL_DESCRIPTION_MAX) {
    text = `${text.slice(0, SPECIALIST_TOOL_DESCRIPTION_MAX - 1)}…`;
  }
  return text;
}

/**
 * Builds OpenAI Agents SDK function tools: each specialist is exposed only as a tool to the coordinator.
 */
export class SpecialistRegistry {
  buildOpenAiTools(args: {
    specialists: TSpecialistToolRosterEntry[];
    executeSpecialist: TExecuteSpecialistFn;
  }): unknown[] {
    if (args.specialists.length === 0) return [];
    const out: unknown[] = [];
    for (const s of args.specialists) {
      const description = buildSpecialistToolDescription(s);
      const execute = async ({ instruction }: { instruction: string }) =>
        args.executeSpecialist(s.id, instruction);
      const params = z.object({
        instruction: z.string().min(1).describe('Clear task for the specialist'),
      });
      for (const name of specialistToolNamesForRegistration(s.id)) {
        out.push(
          tool({
            name,
            description,
            parameters: params,
            execute,
          }),
        );
      }
    }
    return out;
  }
}
