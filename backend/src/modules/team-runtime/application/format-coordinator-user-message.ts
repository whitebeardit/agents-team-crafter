import type { ITeamInvocation } from '../domain/team-invocation.js';
import type { TRuntimeInputPart } from '../../runtime/ports/agent-runtime.provider.js';

/** User text for the coordinator model; includes coordinator-owned external metadata only. */
export function formatCoordinatorUserMessage(invocation: ITeamInvocation): string {
  const c = invocation.coordinatorExternalContext;
  const meta: string[] = [];
  if (c.channelLabel) meta.push(`channel=${c.channelLabel}`);
  if (c.locale) meta.push(`locale=${c.locale}`);
  if (c.taskType) meta.push(`taskType=${c.taskType}`);
  if (c.requestedAccessLevel) meta.push(`access=${c.requestedAccessLevel}`);
  const prefix = meta.length > 0 ? `[${meta.join('] [')}] ` : '';

  const conv = invocation.conversation;
  if (!conv?.history?.length) {
    return `${prefix}${invocation.message}`;
  }
  const histLines = conv.history
    .map((t) =>
      t.role === 'user' ? `Utilizador: ${t.content}` : `Assistente: ${t.content}`,
    )
    .join('\n');
  return `${prefix}## Histórico recente da conversa\n${histLines}\n\n## Mensagem atual\n${invocation.message}`;
}

export function formatCoordinatorUserContentParts(invocation: ITeamInvocation): TRuntimeInputPart[] | undefined {
  const media = Array.isArray(invocation.inputMedia) ? invocation.inputMedia : [];
  const imageParts: TRuntimeInputPart[] = media
    .filter((m) => m.kind === 'image' && typeof m.url === 'string' && m.url.trim().startsWith('http'))
    .map((m) => ({
      type: 'input_image' as const,
      imageUrl: m.url.trim(),
      ...(m.mimeType ? { mimeType: m.mimeType } : {}),
    }));
  return imageParts.length > 0 ? imageParts : undefined;
}
