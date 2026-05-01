import type { TRuntimeInputPart } from '../../runtime/ports/agent-runtime.provider.js';
import type { ITeamInvocationImageInput } from '../domain/team-invocation.js';
import { dedupeHttpsImageUrls } from './image-url-extractor.js';

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

function mapInvocationMediaToRuntimeParts(
  media: ITeamInvocationImageInput[],
  extraImageUrls: string[],
): TRuntimeInputPart[] {
  const fromInvocation = media
    .filter((m) => m.kind === 'image' && typeof m.url === 'string' && m.url.trim().startsWith('http'))
    .map((m) => ({
      imageUrl: m.url.trim(),
      ...(m.mimeType ? { mimeType: m.mimeType } : {}),
    }));
  const dedupedUrls = dedupeHttpsImageUrls([
    ...fromInvocation.map((m) => m.imageUrl),
    ...extraImageUrls,
  ]);
  return dedupedUrls.map((url) => {
    const typed = fromInvocation.find((m) => m.imageUrl === url);
    return {
      type: 'input_image' as const,
      imageUrl: url,
      ...(typed?.mimeType ? { mimeType: typed.mimeType } : {}),
    };
  });
}

export function buildSpecialistRuntimeInput(args: {
  coordinatorInstruction: string;
  invocationMessage: string;
  invocationMedia?: ITeamInvocationImageInput[];
  extraImageUrls?: string[];
}): { message: string; contentParts?: TRuntimeInputPart[] } {
  const message = buildSpecialistRuntimeMessage(args.coordinatorInstruction, args.invocationMessage);
  const media = Array.isArray(args.invocationMedia) ? args.invocationMedia : [];
  const extraImageUrls = Array.isArray(args.extraImageUrls) ? args.extraImageUrls : [];
  const mediaParts = mapInvocationMediaToRuntimeParts(media, extraImageUrls);
  if (mediaParts.length === 0) return { message };
  return { message, contentParts: mediaParts };
}
