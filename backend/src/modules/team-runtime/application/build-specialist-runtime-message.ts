import type { TRuntimeInputPart } from '../../runtime/ports/agent-runtime.provider.js';
import type { ITeamInvocationImageInput } from '../domain/team-invocation.js';

/**
 * Specialists only receive what the coordinator passes in the tool `instruction` argument.
 * This merges in the original user message when the coordinator omitted it, so specialists
 * always see the same raw user content the coordinator saw (unless already embedded).
 */
const USER_MESSAGE_SEPARATOR = '\n\n---\n[Mensagem do utilizador]\n';

export function buildSpecialistRuntimeMessage(
  coordinatorInstruction: string,
  invocationMessage: string,
): string {
  const inst = coordinatorInstruction.trim();
  const user = invocationMessage.trim();
  if (!user) return inst;
  if (!inst) return user;
  if (inst.includes(user)) return inst;
  return `${inst}${USER_MESSAGE_SEPARATOR}${user}`;
}

function mapInvocationMediaToRuntimeParts(media: ITeamInvocationImageInput[]): TRuntimeInputPart[] {
  return media
    .filter((m) => m.kind === 'image' && typeof m.url === 'string' && m.url.trim().startsWith('http'))
    .map((m) => ({
      type: 'input_image' as const,
      imageUrl: m.url.trim(),
      ...(m.mimeType ? { mimeType: m.mimeType } : {}),
    }));
}

export function buildSpecialistRuntimeInput(args: {
  coordinatorInstruction: string;
  invocationMessage: string;
  invocationMedia?: ITeamInvocationImageInput[];
}): { message: string; contentParts?: TRuntimeInputPart[] } {
  const message = buildSpecialistRuntimeMessage(args.coordinatorInstruction, args.invocationMessage);
  const media = Array.isArray(args.invocationMedia) ? args.invocationMedia : [];
  const mediaParts = mapInvocationMediaToRuntimeParts(media);
  if (mediaParts.length === 0) return { message };
  return { message, contentParts: mediaParts };
}
